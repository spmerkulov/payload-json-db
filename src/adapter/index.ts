import { EventEmitter } from 'events';
import {
  DatabaseAdapter,
  PayloadRequest,
  JsonAdapterConfig,
  JsonDatabaseAdapter,
  JsonRecord,
  QueryOptions,
  QueryResult,
  AdapterStats,
  JsonAdapterError,
  ErrorCodes
} from '../types';
import { FileManager } from '../storage/fileManager';
import { MemoryCache } from '../storage/memoryCache';
import { AESEncryption } from '../security/encryption';
import { QueryProcessor } from '../utils/query';
import { generateUUID } from '../utils/uuid';
import { 
  validateConfig,
  validateCollectionName, 
  validateRecordData, 
  validateQueryOptions 
} from '../utils/validation';
import { DEFAULT_CONFIG } from '../index';

/**
 * Основной класс JSON адаптера для PayloadCMS
 */
export class JsonAdapter extends EventEmitter implements JsonDatabaseAdapter {
  public config: JsonAdapterConfig;
  public fileManager: FileManager;
  public cache: MemoryCache;
  public encryption?: AESEncryption;

  private stats = {
    queryCount: 0,
    totalQueryTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  private autoSaveTimer?: NodeJS.Timeout;

  constructor(config: JsonAdapterConfig) {
    super();
    
    // Валидация и объединение конфигурации
    this.config = { ...DEFAULT_CONFIG, ...config } as JsonAdapterConfig;
    validateConfig(this.config);

    // Инициализация компонентов
    this.fileManager = new FileManager(this.config.dataDir);
    this.cache = new MemoryCache(this.config.cache!);
    
    if (this.config.encryption?.key) {
      this.encryption = new AESEncryption(this.config.encryption.key);
    }

    // Настройка событий кэша
    this.cache.on('hit', (key) => {
      this.stats.cacheHits++;
      this.emit('cache:hit', key);
    });

    this.cache.on('miss', (key) => {
      this.stats.cacheMisses++;
      this.emit('cache:miss', key);
    });
  }

  /**
   * Инициализация адаптера
   */
  async init(): Promise<void> {
    try {
      await this.fileManager.init();
      
      // Запуск автосохранения кэша
      if (this.config.cache?.autoSaveInterval) {
        this.autoSaveTimer = setInterval(async () => {
          await this.performAutoSave();
        }, this.config.cache.autoSaveInterval);
      }

      this.emit('adapter:initialized');
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw new JsonAdapterError(
        'Failed to initialize adapter',
        ErrorCodes.FILE_SYSTEM_ERROR
      );
    }
  }

  /**
   * Подключение к "базе данных" (создание папки данных)
   */
  async connect(): Promise<void> {
    await this.init();
  }

  /**
   * Отключение от "базы данных"
   */
  async destroy(): Promise<void> {
    try {
      // Очищаем таймер автосохранения
      if (this.autoSaveTimer) {
          clearInterval(this.autoSaveTimer);
        }
      
      // Финальное сохранение перед уничтожением
      await this.performAutoSave();
      
      // Очистка кэша перед закрытием
      this.cache.destroy();
      this.removeAllListeners();
      this.emit('adapter:destroyed');
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Создание новой записи
   */
  async create<T extends JsonRecord>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    _req?: PayloadRequest
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      validateCollectionName(collection);
      validateRecordData(data);
      
      const record = await this.createOperation<T>(collection, data as Partial<T>);
      this.updateStats(startTime);
      this.emit('record:created', collection, record.id);
      return record as T;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Поиск записей
   */
  async find<T extends JsonRecord>(
    collection: string,
    options: QueryOptions = {},
    _req?: PayloadRequest
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    
    try {
      validateCollectionName(collection);
      validateQueryOptions(options);
      
      const result = await this.findOperation<T>(collection, options);
      this.updateStats(startTime);
      this.emit('records:found', collection, result.docs.length);
      return result;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Поиск записи по ID
   */
  async findOne<T extends JsonRecord>(
    collection: string,
    idOrWhere: string | Record<string, any>,
    _req?: PayloadRequest
  ): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      let record: T | null;
      
      if (typeof idOrWhere === 'string') {
        // Поиск по ID
        record = await this.findByIdOperation<T>(collection, idOrWhere);
      } else {
        // Поиск по условиям
        const result = await this.findOperation<T>(collection, { where: idOrWhere, limit: 1 });
        record = result.docs.length > 0 ? (result.docs[0] ?? null) : null;
      }
      
      this.updateStats(startTime);
      return record;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Обновление записи
   */
  async findOneAndUpdate<T extends JsonRecord>(
    collection: string,
    id: string,
    data: Partial<T>,
    _req?: PayloadRequest
  ): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const record = await this.updateOperation<T>(collection, id, data);
      this.updateStats(startTime);
      if (record) {
        this.emit('record:updated', collection, record);
      }
      return record;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Удаление записи
   */
  async findOneAndDelete<T extends JsonRecord>(
    collection: string,
    id: string,
    _req?: PayloadRequest
  ): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const record = await this.deleteOperation<T>(collection, id);
      this.updateStats(startTime);
      if (record) {
        this.emit('record:deleted', collection, id);
      }
      return record;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Получение статистики адаптера
   */
  async getStats(): Promise<AdapterStats> {
    const cacheStats = this.cache.getStats();
    return {
      collections: await this.fileManager.listCollections().then(cols => cols.length),
      totalRecords: cacheStats.size,
      totalOperations: this.stats.queryCount,
      totalQueryTime: this.stats.totalQueryTime,
      cacheHitRate: this.stats.queryCount > 0 
        ? this.stats.cacheHits / this.stats.queryCount 
        : 0,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      averageQueryTime: this.stats.queryCount > 0 
        ? this.stats.totalQueryTime / this.stats.queryCount 
        : 0,
      dataSize: process.memoryUsage().heapUsed,
      memoryUsage: {
        cache: process.memoryUsage().heapUsed,
        total: process.memoryUsage().rss
      }
    };
  }

  /**
   * Очистка кэша
   */
  async clearCache(collectionName?: string): Promise<void> {
    if (collectionName) {
      this.cache.delete(collectionName);
    } else {
      this.cache.clear();
    }
    // Сбрасываем статистику кэша
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Резервное копирование
   */
  async backup(collectionName?: string): Promise<string> {
    return await this.fileManager.backup(collectionName);
  }

  /**
   * Восстановление из резервной копии
   */
  async restore(backupPath: string): Promise<void> {
    await this.fileManager.restore(backupPath);
    this.cache.clear(); // Очистка кэша после восстановления
  }

  /**
   * Миграция данных из другого адаптера
   */
  async migrate(_fromAdapter: DatabaseAdapter): Promise<void> {
    throw new JsonAdapterError(
      'Migration not implemented yet',
      ErrorCodes.MIGRATION_ERROR
    );
  }

  // Приватные методы для операций CRUD
  private async createOperation<T extends JsonRecord>(
    collection: string,
    data: Partial<T>
  ): Promise<T> {
    // Загружаем коллекцию
    let collectionData = this.cache.get(collection);
    if (!collectionData) {
      collectionData = await this.fileManager.readCollection(collection);
      this.cache.set(collection, collectionData, false);
      this.stats.cacheMisses++;
    } else {
      this.stats.cacheHits++;
    }

    // Создаем новую запись
    const now = new Date();
    const newRecord: T = {
      ...data,
      id: generateUUID(),
      createdAt: now,
      updatedAt: now
    } as T;

    // Добавляем запись в коллекцию
    collectionData.records.push(newRecord);
    
    // Обновляем кэш
    this.cache.set(collection, collectionData, true);
    
    return newRecord;
  }

  private async findOperation<T extends JsonRecord>(
    collection: string,
    options: QueryOptions
  ): Promise<QueryResult<T>> {
    // Загружаем коллекцию
    let collectionData = this.cache.get(collection);
    if (!collectionData) {
      collectionData = await this.fileManager.readCollection(collection);
      this.cache.set(collection, collectionData, false);
      this.stats.cacheMisses++;
    } else {
      this.stats.cacheHits++;
    }

    // Применяем запрос через QueryProcessor
    const result = QueryProcessor.processQuery<T>(collectionData.records as T[], options);
    
    return result;
  }

  private async findByIdOperation<T extends JsonRecord>(
    collection: string,
    id: string
  ): Promise<T | null> {
    // Загружаем коллекцию
    let collectionData = this.cache.get(collection);
    if (!collectionData) {
      collectionData = await this.fileManager.readCollection(collection);
      this.cache.set(collection, collectionData, false);
      this.stats.cacheMisses++;
    } else {
      this.stats.cacheHits++;
    }

    // Ищем запись по ID
    const record = collectionData.records.find((r: JsonRecord) => r.id === id);
    return (record as T) || null;
  }

  private async updateOperation<T extends JsonRecord>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<T | null> {
    // Загружаем коллекцию
    let collectionData = this.cache.get(collection);
    if (!collectionData) {
      collectionData = await this.fileManager.readCollection(collection);
      this.cache.set(collection, collectionData, false);
      this.stats.cacheMisses++;
    } else {
      this.stats.cacheHits++;
    }

    // Находим индекс записи
    const recordIndex = collectionData.records.findIndex((r: JsonRecord) => r.id === id);
    if (recordIndex === -1) {
      return null;
    }

    // Обновляем запись
    const existingRecord = collectionData.records[recordIndex] as T;
    const updatedRecord: T = {
      ...existingRecord,
      ...data,
      id: existingRecord.id, // ID не должен изменяться
      createdAt: existingRecord.createdAt, // createdAt не должен изменяться
      updatedAt: new Date()
    };

    collectionData.records[recordIndex] = updatedRecord;
    
    // Обновляем кэш
    this.cache.set(collection, collectionData, true);
    
    return updatedRecord;
  }

  private async deleteOperation<T extends JsonRecord>(
    collection: string,
    id: string
  ): Promise<T | null> {
    // Загружаем коллекцию
    let collectionData = this.cache.get(collection);
    if (!collectionData) {
      collectionData = await this.fileManager.readCollection(collection);
      this.cache.set(collection, collectionData, false);
      this.stats.cacheMisses++;
    } else {
      this.stats.cacheHits++;
    }

    // Находим индекс записи
    const recordIndex = collectionData.records.findIndex((r: JsonRecord) => r.id === id);
    if (recordIndex === -1) {
      return null;
    }

    // Удаляем запись
    const deletedRecord = collectionData.records.splice(recordIndex, 1)[0] as T;
    
    // Обновляем кэш
    this.cache.set(collection, collectionData, true);
    
    return deletedRecord;
  }

  private updateStats(startTime: number): void {
    this.stats.queryCount++;
    this.stats.totalQueryTime += Date.now() - startTime;
  }

  /**
   * Выполняет автосохранение грязных коллекций из кэша
   */
  private async performAutoSave(): Promise<void> {
    try {
      const dirtyCollections = this.cache.getDirtyCollections();
      
      for (const collectionName of dirtyCollections) {
        const collectionData = this.cache.get(collectionName);
        if (collectionData) {
          await this.fileManager.writeCollection(collectionName, collectionData);
          this.cache.markClean(collectionName);
          this.emit('cache:saved', collectionName);
        }
      }
      
      if (dirtyCollections.length > 0) {
        this.emit('adapter:autoSaved', { collections: dirtyCollections });
      }
    } catch (error) {
      this.emit('error', new JsonAdapterError(
        'Auto-save failed',
        ErrorCodes.FILE_SYSTEM_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  // Вспомогательные методы удалены, так как используется QueryProcessor
}