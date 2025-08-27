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
  // Обязательные свойства BaseDatabaseAdapter
  public name = 'payload-db-json';
  public packageName = 'payload-db-json';
  public defaultIDType: 'text' | 'number' = 'text';
  public migrationDir?: string;
  
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

  private autoSaveTimer?: NodeJS.Timeout | undefined;
  private transactionStack: Map<string, any> = new Map();
  private migrationCollection: string;

  constructor(config: JsonAdapterConfig) {
    super();
    
    // Валидация и объединение конфигурации
    this.config = { ...DEFAULT_CONFIG, ...config } as JsonAdapterConfig;
    validateConfig(this.config);

    // Установка migrationDir
    this.migrationDir = config.migrationDir || `${this.config.dataDir}/migrations`;

    // Инициализация компонентов
    this.fileManager = new FileManager(this.config.dataDir);
    this.cache = new MemoryCache(this.config.cache!);
    
    // Создание уникального имени коллекции миграций для изоляции
    const dbPathHash = this.config.dataDir.replace(/[^a-zA-Z0-9]/g, '_');
    this.migrationCollection = `payload_migrations_${dbPathHash}`;
    
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
        this.autoSaveTimer = undefined as NodeJS.Timeout | undefined;
      }
      
      // Откатываем все активные транзакции
      for (const [transactionId] of this.transactionStack) {
        try {
          await this.rollbackTransaction(transactionId);
        } catch (rollbackError) {
          console.warn(`Failed to rollback transaction ${transactionId}:`, rollbackError);
        }
      }
      
      // Очищаем стек транзакций
      this.transactionStack.clear();
      
      // Финальное сохранение перед уничтожением
      await this.performAutoSave();
      
      // Очистка кэша перед закрытием
      this.cache.destroy();
      
      // Удаляем все слушатели событий
      this.removeAllListeners();
      
      // Эмитируем событие уничтожения перед полной очисткой
      this.emit('adapter:destroyed');
      
      // Принудительная очистка всех ссылок
      this.transactionStack = new Map();
      
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
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

  // ========== НЕДОСТАЮЩИЕ CRUD ОПЕРАЦИИ ==========

  /**
   * Подсчет документов в коллекции
   */
  async count({ collection, where }: { collection: string; where?: any }): Promise<{ totalDocs: number }> {
    try {
      const result = await this.find(collection, { where });
      return { totalDocs: result.docs.length };
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to count documents in collection ${collection}`,
        ErrorCodes.QUERY_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Удаление множественных документов
   */
  async deleteMany({ collection, where }: { collection: string; where: any }): Promise<{ deletedCount: number }> {
    try {
      const result = await this.find(collection, { where });
      let deletedCount = 0;

      for (const doc of result.docs) {
        await this.findOneAndDelete(collection, doc.id);
        deletedCount++;
      }

      return { deletedCount };
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to delete multiple documents in collection ${collection}`,
        ErrorCodes.DELETE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Удаление одного документа
   */
  async deleteOne({ collection, where }: { collection: string; where: any }): Promise<{ deletedCount: number }> {
    try {
      const result = await this.find(collection, { where, limit: 1 });
      if (result.docs.length > 0 && result.docs[0]?.id) {
        await this.findOneAndDelete(collection, result.docs[0].id);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to delete document in collection ${collection}`,
        ErrorCodes.DELETE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Обновление одного документа
   */
  async updateOne({ collection, where, data }: { collection: string; where: any; data: any }): Promise<{ modifiedCount: number }> {
    try {
      const result = await this.find(collection, { where, limit: 1 });
      if (result.docs.length > 0 && result.docs[0]?.id) {
        const updated = await this.findOneAndUpdate(collection, result.docs[0].id, data);
        return { modifiedCount: updated ? 1 : 0 };
      }
      return { modifiedCount: 0 };
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to update document in collection ${collection}`,
        ErrorCodes.UPDATE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Обновление множества документов
   */
  async updateMany({ collection, where, data }: { collection: string; where: any; data: any }): Promise<{ modifiedCount: number }> {
    try {
      const result = await this.find(collection, { where });
      let modifiedCount = 0;

      for (const doc of result.docs) {
        const updated = await this.findOneAndUpdate(collection, doc.id, data);
        if (updated) {
          modifiedCount++;
        }
      }

      return { modifiedCount };
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to update multiple documents in collection ${collection}`,
        ErrorCodes.UPDATE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Upsert операция (создание или обновление)
   */
  async upsert({ collection, where, data }: { collection: string; where: any; data: any }): Promise<any> {
    try {
      // Попытка найти существующий документ
      const result = await this.find(collection, { where, limit: 1 });
      
      if (result.docs.length > 0 && result.docs[0]?.id) {
        // Обновляем существующий
        return await this.findOneAndUpdate(collection, result.docs[0].id, data);
      } else {
        // Создаем новый
        return await this.create(collection, { ...data, ...where });
      }
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to upsert document in collection ${collection}`,
        ErrorCodes.UPDATE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ========== МЕТОДЫ ТРАНЗАКЦИЙ ==========

  /**
   * Начало транзакции
   */
  async beginTransaction(req?: PayloadRequest): Promise<string> {
    const transactionId = generateUUID();
    this.transactionStack.set(transactionId, {
      id: transactionId,
      operations: [],
      startTime: Date.now(),
      req
    });
    
    this.emit('transaction:begin', transactionId);
    return transactionId;
  }

  /**
   * Подтверждение транзакции
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactionStack.get(transactionId);
    if (!transaction) {
      throw new JsonAdapterError(
        `Transaction ${transactionId} not found`,
        ErrorCodes.TRANSACTION_ERROR
      );
    }

    try {
      // В JSON адаптере транзакции эмулируются через кэш
      // Все операции уже выполнены, просто очищаем стек
      this.transactionStack.delete(transactionId);
      this.emit('transaction:commit', transactionId);
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to commit transaction ${transactionId}`,
        ErrorCodes.TRANSACTION_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Откат транзакции
   */
  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactionStack.get(transactionId);
    if (!transaction) {
      throw new JsonAdapterError(
        `Transaction ${transactionId} not found`,
        ErrorCodes.TRANSACTION_ERROR
      );
    }

    try {
      // В JSON адаптере откат эмулируется через очистку кэша
      // и перезагрузку данных из файлов
      this.cache.clear();
      this.transactionStack.delete(transactionId);
      this.emit('transaction:rollback', transactionId);
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to rollback transaction ${transactionId}`,
        ErrorCodes.TRANSACTION_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ========== ОПЕРАЦИИ С ГЛОБАЛЬНЫМИ ДАННЫМИ ==========

  /**
   * Создание глобального документа
   */
  async createGlobal({ slug, data }: { slug: string; data: any }): Promise<any> {
    try {
      return await this.create(`globals_${slug}`, data);
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to create global ${slug}`,
        ErrorCodes.CREATE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Поиск глобального документа
   */
  async findGlobal({ slug }: { slug: string }): Promise<any> {
    try {
      const result = await this.find(`globals_${slug}`);
      return result.docs[0] || null;
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to find global ${slug}`,
        ErrorCodes.QUERY_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Обновление глобального документа
   */
  async updateGlobal({ slug, data }: { slug: string; data: any }): Promise<any> {
    try {
      const existing = await this.findGlobal({ slug });
      if (existing && existing.id) {
        return await this.findOneAndUpdate(
          `globals_${slug}`, 
          existing.id, 
          data
        );
      } else {
        return await this.createGlobal({ slug, data });
      }
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to update global ${slug}`,
        ErrorCodes.UPDATE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ========== ОПЕРАЦИИ С ВЕРСИЯМИ ==========

  /**
   * Создание версии документа
   */
  async createVersion({ collection, parent, versionData }: { collection: string; parent: string; versionData: any }): Promise<any> {
    try {
      const versionDoc = {
        ...versionData,
        parent,
        version: Date.now(),
        createdAt: new Date().toISOString()
      };
      
      return await this.create(
        `${collection}_versions`, 
        versionDoc
      );
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to create version for ${collection}`,
        ErrorCodes.CREATE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Поиск версий документа
   */
  async findVersions({ collection, where }: { collection: string; where?: any }): Promise<QueryResult> {
    try {
      return await this.find(
        `${collection}_versions`, 
        {
          where,
          sort: { version: -1 }
        }
      );
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to find versions for ${collection}`,
        ErrorCodes.QUERY_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Удаление версий документа
   */
  async deleteVersions({ collection, where }: { collection: string; where: any }): Promise<{ deletedCount: number }> {
    try {
      return await this.deleteMany({
        collection: `${collection}_versions`, 
        where
      });
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to delete versions for ${collection}`,
        ErrorCodes.DELETE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ========== ОПЕРАЦИИ МИГРАЦИЙ ==========

  /**
   * Создание записи миграции
   */
  async createMigration({ name, batch }: { name: string; batch?: number }): Promise<any> {
    try {
      const migrationDoc = {
        name,
        batch: batch || 1,
        executedAt: new Date().toISOString()
      };
      
      return await this.create(
        this.migrationCollection, 
        migrationDoc
      );
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to create migration record ${name}`,
        ErrorCodes.CREATE_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Полная миграция (очистка и пересоздание)
   */
  async migrateFresh(): Promise<void> {
    try {
      // Очистка всех данных
      await this.cache.clear();
      
      // Пересоздание структуры директорий
      await this.fileManager.init();
      
      this.emit('migration:fresh');
    } catch (error) {
      throw new JsonAdapterError(
        'Failed to perform fresh migration',
        ErrorCodes.MIGRATION_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Получение выполненных миграций
   */
  async getMigrations(): Promise<any[]> {
    try {
      const result = await this.find(
        this.migrationCollection,
        {
          sort: { batch: 1, executedAt: 1 }
        }
      );
      return result.docs;
    } catch (error) {
      // Если коллекция миграций не существует, возвращаем пустой массив
      return [];
    }
  }

  // Вспомогательные методы удалены, так как используется QueryProcessor
}