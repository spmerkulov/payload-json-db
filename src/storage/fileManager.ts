import { promises as fs, existsSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { EventEmitter } from 'events';
import {
  FileManager as IFileManager,
  CollectionData,
  JsonAdapterError,
  ErrorCodes
} from '../types';
import { validateCollectionName } from '../utils/validation';
import { generateUUID } from '../utils/uuid';

/**
 * Менеджер файлов для работы с JSON коллекциями
 */
export class FileManager extends EventEmitter implements IFileManager {
  private dataDir: string;
  private lockMap = new Map<string, Promise<void>>();

  constructor(dataDir: string) {
    super();
    this.dataDir = resolve(dataDir);
  }

  /**
   * Инициализация файлового менеджера
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Создание папки для резервных копий
      const backupDir = join(this.dataDir, '.backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      // Создание папки для временных файлов
      const tempDir = join(this.dataDir, '.temp');
      await fs.mkdir(tempDir, { recursive: true });
      
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to initialize file manager: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR
      );
    }
  }

  /**
   * Чтение коллекции из файла
   */
  async readCollection(collectionName: string): Promise<CollectionData> {
    validateCollectionName(collectionName);
    
    const filePath = this.getCollectionPath(collectionName);
    
    try {
      // Проверяем существование файла
      if (!existsSync(filePath)) {
        // Создаем новую коллекцию если файл не существует
        return this.createEmptyCollection(collectionName);
      }

      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      if (!fileContent.trim()) {
        return this.createEmptyCollection(collectionName);
      }

      const data = JSON.parse(fileContent) as CollectionData;
      
      // Валидация структуры данных
      this.validateCollectionData(data, collectionName);
      
      // Преобразуем строковые даты обратно в объекты Date
      data.records = data.records.map(record => ({
        ...record,
        createdAt: typeof record.createdAt === 'string' ? new Date(record.createdAt) : (record.createdAt || new Date()),
        updatedAt: typeof record.updatedAt === 'string' ? new Date(record.updatedAt) : (record.updatedAt || new Date())
      }));
      
      return data;
      
    } catch (error) {
      if (error instanceof JsonAdapterError) {
        throw error;
      }
      
      throw new JsonAdapterError(
        `Failed to read collection ${collectionName}: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR,
        collectionName
      );
    }
  }

  /**
   * Запись коллекции в файл с атомарной операцией
   */
  async writeCollection(collectionName: string, data: CollectionData): Promise<void> {
    validateCollectionName(collectionName);
    
    // Используем блокировку для предотвращения конкурентной записи
    const lockKey = `write:${collectionName}`;
    
    if (this.lockMap.has(lockKey)) {
      await this.lockMap.get(lockKey);
    }

    const writePromise = this.performAtomicWrite(collectionName, data);
    this.lockMap.set(lockKey, writePromise);
    
    try {
      await writePromise;
    } finally {
      this.lockMap.delete(lockKey);
    }
  }

  /**
   * Удаление коллекции
   */
  async deleteCollection(collectionName: string): Promise<void> {
    validateCollectionName(collectionName);
    
    const filePath = this.getCollectionPath(collectionName);
    
    try {
      if (existsSync(filePath)) {
        // Создаем резервную копию перед удалением
        await this.backup(collectionName);
        await fs.unlink(filePath);
        this.emit('collection:deleted', collectionName);
      }
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to delete collection ${collectionName}: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR,
        collectionName
      );
    }
  }

  /**
   * Проверка существования коллекции
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    validateCollectionName(collectionName);
    const filePath = this.getCollectionPath(collectionName);
    return existsSync(filePath);
  }

  /**
   * Получение списка всех коллекций
   */
  async listCollections(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dataDir);
      return files
        .filter(file => file.endsWith('.json') && !file.startsWith('.'))
        .map(file => basename(file, '.json'));
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to list collections: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR
      );
    }
  }

  /**
   * Создание резервной копии
   */
  async backup(collectionName?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(this.dataDir, '.backups');
    
    try {
      if (collectionName) {
        // Резервная копия одной коллекции
        const sourceFile = this.getCollectionPath(collectionName);
        const backupFile = join(backupDir, `${collectionName}_${timestamp}.json`);
        
        if (existsSync(sourceFile)) {
          await fs.copyFile(sourceFile, backupFile);
        }
        
        return backupFile;
      } else {
        // Резервная копия всех коллекций
        const collections = await this.listCollections();
        const backupFiles: string[] = [];
        
        for (const collection of collections) {
          const sourceFile = this.getCollectionPath(collection);
          const backupFile = join(backupDir, `${collection}_${timestamp}.json`);
          
          await fs.copyFile(sourceFile, backupFile);
          backupFiles.push(backupFile);
        }
        
        // Создаем манифест резервной копии
        const manifestFile = join(backupDir, `manifest_${timestamp}.json`);
        await fs.writeFile(manifestFile, JSON.stringify({
          timestamp,
          collections: backupFiles.map(f => basename(f)),
          version: '1.0'
        }, null, 2));
        
        return manifestFile;
      }
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to create backup: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR
      );
    }
  }

  /**
   * Восстановление из резервной копии
   */
  async restore(backupPath: string): Promise<void> {
    try {
      const backupFile = resolve(backupPath);
      
      if (!existsSync(backupFile)) {
        throw new JsonAdapterError(
          `Backup file not found: ${backupPath}`,
          ErrorCodes.FILE_SYSTEM_ERROR
        );
      }

      if (backupFile.includes('manifest_')) {
        // Восстановление из манифеста (множественные коллекции)
        await this.restoreFromManifest(backupFile);
      } else {
        // Восстановление одной коллекции
        await this.restoreSingleCollection(backupFile);
      }
      
      this.emit('restore:completed', backupPath);
    } catch (error) {
      if (error instanceof JsonAdapterError) {
        throw error;
      }
      
      throw new JsonAdapterError(
        `Failed to restore from backup: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR
      );
    }
  }

  /**
   * Получение статистики файла коллекции
   */
  async getCollectionStats(collectionName: string): Promise<{
    size: number;
    recordCount: number;
    lastModified: Date;
  }> {
    validateCollectionName(collectionName);
    
    const filePath = this.getCollectionPath(collectionName);
    
    try {
      const stats = await fs.stat(filePath);
      const data = await this.readCollection(collectionName);
      
      return {
        size: stats.size,
        recordCount: data.records.length,
        lastModified: stats.mtime
      };
    } catch (error) {
      throw new JsonAdapterError(
        `Failed to get collection stats: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR,
        collectionName
      );
    }
  }

  // Приватные методы

  private getCollectionPath(collectionName: string): string {
    return join(this.dataDir, `${collectionName}.json`);
  }

  private getTempPath(collectionName: string): string {
    return join(this.dataDir, '.temp', `${collectionName}_${generateUUID()}.tmp`);
  }

  private createEmptyCollection(collectionName: string): CollectionData {
    return {
      metadata: {
        name: collectionName,
        count: 0,
        lastModified: new Date(),
        version: 1,
        indexes: []
      },
      records: []
    };
  }

  private validateCollectionData(data: any, collectionName: string): void {
    if (!data || typeof data !== 'object') {
      throw new JsonAdapterError(
        `Invalid collection data format in ${collectionName}`,
        ErrorCodes.VALIDATION_ERROR,
        collectionName
      );
    }

    if (!data.metadata || !Array.isArray(data.records)) {
      throw new JsonAdapterError(
        `Missing required fields in collection ${collectionName}`,
        ErrorCodes.VALIDATION_ERROR,
        collectionName
      );
    }
  }

  private async performAtomicWrite(collectionName: string, data: CollectionData): Promise<void> {
    const filePath = this.getCollectionPath(collectionName);
    const tempPath = this.getTempPath(collectionName);
    
    try {
      // Обновляем метаданные
      data.metadata.lastModified = new Date();
      data.metadata.count = data.records.length;
      data.metadata.version = (data.metadata.version || 0) + 1;
      
      // Записываем во временный файл
      const jsonContent = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, jsonContent, 'utf-8');
      
      // Атомарное переименование
      await fs.rename(tempPath, filePath);
      
      this.emit('collection:written', collectionName, data.records.length);
      
    } catch (error) {
      // Очистка временного файла в случае ошибки
      try {
        if (existsSync(tempPath)) {
          await fs.unlink(tempPath);
        }
      } catch (cleanupError) {
        // Игнорируем ошибки очистки
      }
      
      throw new JsonAdapterError(
        `Failed to write collection ${collectionName}: ${(error as Error).message}`,
        ErrorCodes.FILE_SYSTEM_ERROR,
        collectionName
      );
    }
  }

  private async restoreFromManifest(manifestPath: string): Promise<void> {
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    const backupDir = dirname(manifestPath);
    
    for (const backupFile of manifest.collections) {
      const backupFilePath = join(backupDir, backupFile);
      await this.restoreSingleCollection(backupFilePath);
    }
  }

  private async restoreSingleCollection(backupPath: string): Promise<void> {
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    const data = JSON.parse(backupContent) as CollectionData;
    
    const collectionName = data.metadata.name;
    const targetPath = this.getCollectionPath(collectionName);
    
    await fs.copyFile(backupPath, targetPath);
    this.emit('collection:restored', collectionName);
  }
}