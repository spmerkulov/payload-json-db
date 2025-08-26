import { FileManager } from '../src/storage/fileManager';
import { CollectionData, JsonAdapterError } from '../src/types';
import { TestUtils } from './setup';
import { join } from 'path';
import { promises as fs } from 'fs';

describe('FileManager', () => {
  let fileManager: FileManager;
  let testDataDir: string;

  beforeEach(async () => {
    testDataDir = global.TEST_DATA_DIR;
    fileManager = new FileManager(testDataDir);
    await fileManager.init();
  });

  afterEach(async () => {
    // Очистка событий
    fileManager.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should create data directory on init', async () => {
      const newDataDir = join(global.TEST_TEMP_DIR, 'new-data');
      const newFileManager = new FileManager(newDataDir);
      
      await newFileManager.init();
      
      expect(await TestUtils.fileExists(newDataDir)).toBe(true);
      expect(await TestUtils.fileExists(join(newDataDir, '.backups'))).toBe(true);
      expect(await TestUtils.fileExists(join(newDataDir, '.temp'))).toBe(true);
    });

    it('should handle existing directory', async () => {
      // Повторная инициализация не должна вызывать ошибок
      await expect(fileManager.init()).resolves.not.toThrow();
    });
  });

  describe('Collection Operations', () => {
    const testCollectionName = 'test-collection';

    it('should create empty collection when file does not exist', async () => {
      const collection = await fileManager.readCollection(testCollectionName);
      
      expect(collection).toEqual({
        metadata: {
          name: testCollectionName,
          count: 0,
          lastModified: expect.any(Date),
          version: 1,
          indexes: []
        },
        records: []
      });
    });

    it('should write and read collection data', async () => {
      const testData = TestUtils.createTestCollection(testCollectionName, 3);
      const originalVersion = testData.metadata.version;
      
      await fileManager.writeCollection(testCollectionName, testData);
      const readData = await fileManager.readCollection(testCollectionName);
      
      expect(readData.metadata.name).toBe(testCollectionName);
      expect(readData.records).toHaveLength(3);
      expect(readData.metadata.count).toBe(3);
      expect(readData.metadata.version).toBe(originalVersion + 1);
    });

    it('should emit events on write', async () => {
      const testData = TestUtils.createTestCollection(testCollectionName, 2);
      const eventSpy = jest.fn();
      
      fileManager.on('collection:written', eventSpy);
      
      await fileManager.writeCollection(testCollectionName, testData);
      
      expect(eventSpy).toHaveBeenCalledWith(testCollectionName, 2);
    });

    it('should handle concurrent writes safely', async () => {
      const testData1 = TestUtils.createTestCollection(testCollectionName, 1);
      const testData2 = TestUtils.createTestCollection(testCollectionName, 2);
      
      // Запускаем параллельные записи
      const promises = [
        fileManager.writeCollection(testCollectionName, testData1),
        fileManager.writeCollection(testCollectionName, testData2)
      ];
      
      await Promise.all(promises);
      
      // Проверяем, что файл не поврежден
      const result = await fileManager.readCollection(testCollectionName);
      expect(result.metadata.name).toBe(testCollectionName);
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('should check collection existence', async () => {
      expect(await fileManager.collectionExists(testCollectionName)).toBe(false);
      
      const testData = TestUtils.createTestCollection(testCollectionName);
      await fileManager.writeCollection(testCollectionName, testData);
      
      expect(await fileManager.collectionExists(testCollectionName)).toBe(true);
    });

    it('should delete collection', async () => {
      const testData = TestUtils.createTestCollection(testCollectionName);
      await fileManager.writeCollection(testCollectionName, testData);
      
      expect(await fileManager.collectionExists(testCollectionName)).toBe(true);
      
      const eventSpy = jest.fn();
      fileManager.on('collection:deleted', eventSpy);
      
      await fileManager.deleteCollection(testCollectionName);
      
      expect(await fileManager.collectionExists(testCollectionName)).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith(testCollectionName);
    });

    it('should list all collections', async () => {
      const collections = ['users', 'posts', 'categories'];
      
      for (const name of collections) {
        const testData = TestUtils.createTestCollection(name);
        await fileManager.writeCollection(name, testData);
      }
      
      const listedCollections = await fileManager.listCollections();
      
      expect(listedCollections).toEqual(expect.arrayContaining(collections));
      expect(listedCollections).toHaveLength(collections.length);
    });

    it('should get collection statistics', async () => {
      const testData = TestUtils.createTestCollection(testCollectionName, 5);
      await fileManager.writeCollection(testCollectionName, testData);
      
      const stats = await fileManager.getCollectionStats(testCollectionName);
      
      expect(stats.size).toEqual(expect.any(Number));
      expect(stats.recordCount).toBe(5);
      expect(stats.lastModified).toBeDefined();
      expect(new Date(stats.lastModified).getTime()).toBeGreaterThan(0);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Backup and Restore', () => {
    const testCollectionName = 'backup-test';

    beforeEach(async () => {
      const testData = TestUtils.createTestCollection(testCollectionName, 3);
      await fileManager.writeCollection(testCollectionName, testData);
    });

    it('should create single collection backup', async () => {
      const backupPath = await fileManager.backup(testCollectionName);
      
      expect(await TestUtils.fileExists(backupPath)).toBe(true);
      expect(backupPath).toContain('.backups');
      expect(backupPath).toContain(testCollectionName);
    });

    it('should create full backup with manifest', async () => {
      // Создаем несколько коллекций
      const collections = ['users', 'posts'];
      for (const name of collections) {
        const testData = TestUtils.createTestCollection(name);
        await fileManager.writeCollection(name, testData);
      }
      
      const manifestPath = await fileManager.backup();
      
      expect(await TestUtils.fileExists(manifestPath)).toBe(true);
      expect(manifestPath).toContain('manifest_');
      
      const manifest = await TestUtils.readJsonFile(manifestPath);
      expect(manifest).toHaveProperty('timestamp');
      expect(manifest).toHaveProperty('collections');
      expect(manifest.collections).toEqual(expect.any(Array));
    });

    it('should restore single collection', async () => {
      // Создаем резервную копию
      const backupPath = await fileManager.backup(testCollectionName);
      
      // Удаляем оригинальную коллекцию
      await fileManager.deleteCollection(testCollectionName);
      expect(await fileManager.collectionExists(testCollectionName)).toBe(false);
      
      // Восстанавливаем из резервной копии
      const eventSpy = jest.fn();
      fileManager.on('collection:restored', eventSpy);
      
      await fileManager.restore(backupPath);
      
      expect(await fileManager.collectionExists(testCollectionName)).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(testCollectionName);
      
      const restoredData = await fileManager.readCollection(testCollectionName);
      expect(restoredData.records).toHaveLength(3);
    });

    it('should restore from manifest', async () => {
      // Создаем несколько коллекций
      const collections = ['users', 'posts'];
      for (const name of collections) {
        const testData = TestUtils.createTestCollection(name, 2);
        await fileManager.writeCollection(name, testData);
      }
      
      // Создаем полную резервную копию
      const manifestPath = await fileManager.backup();
      
      // Удаляем все коллекции
      for (const name of collections) {
        await fileManager.deleteCollection(name);
      }
      
      // Восстанавливаем из манифеста
      await fileManager.restore(manifestPath);
      
      // Проверяем восстановление
      for (const name of collections) {
        expect(await fileManager.collectionExists(name)).toBe(true);
        const data = await fileManager.readCollection(name);
        expect(data.records).toHaveLength(2);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid collection name', async () => {
      const invalidNames = ['', 'col/lection', 'col\\lection', 'col:lection'];
      
      for (const name of invalidNames) {
        await expect(fileManager.readCollection(name))
          .rejects.toThrow(JsonAdapterError);
      }
    });

    it('should handle corrupted JSON files', async () => {
      const collectionName = 'corrupted';
      const filePath = join(testDataDir, `${collectionName}.json`);
      
      // Создаем поврежденный JSON файл
      await fs.writeFile(filePath, '{ invalid json }');
      
      await expect(fileManager.readCollection(collectionName))
        .rejects.toThrow(JsonAdapterError);
    });

    it('should handle missing backup file', async () => {
      const nonExistentPath = join(global.TEST_TEMP_DIR, 'nonexistent.json');
      
      await expect(fileManager.restore(nonExistentPath))
        .rejects.toThrow(JsonAdapterError);
    });

    it('should handle file system errors gracefully', async () => {
      // Создаем файл менеджер с недоступной директорией
      const invalidPath = 'Z:\\invalid\\path\\that\\does\\not\\exist';
      const invalidFileManager = new FileManager(invalidPath);
      
      await expect(invalidFileManager.init())
        .rejects.toThrow(JsonAdapterError);
    });
  });

  describe('Atomic Operations', () => {
    it('should perform atomic writes', async () => {
      const testCollectionName = 'atomic-test';
      const testData = TestUtils.createTestCollection(testCollectionName, 1000);
      
      // Запускаем запись
      const writePromise = fileManager.writeCollection(testCollectionName, testData);
      
      // Пытаемся читать во время записи
      const readPromise = fileManager.readCollection(testCollectionName);
      
      const [, readResult] = await Promise.all([writePromise, readPromise]);
      
      // Результат чтения должен быть либо пустой коллекцией, либо полной записанной коллекцией
      expect(readResult.records.length === 0 || readResult.records.length === 1000).toBe(true);
    });

    it('should cleanup temporary files on write failure', async () => {
      const testCollectionName = 'cleanup-test';
      const invalidData = { invalid: 'data structure' } as any;
      
      // Мокаем JSON.stringify чтобы вызвать ошибку
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn().mockImplementation(() => {
        throw new Error('Stringify error');
      });
      
      try {
        await expect(fileManager.writeCollection(testCollectionName, invalidData))
          .rejects.toThrow();
        
        // Проверяем, что временные файлы очищены
        const tempDir = join(testDataDir, '.temp');
        const tempFiles = await fs.readdir(tempDir);
        expect(tempFiles).toHaveLength(0);
      } finally {
        // Восстанавливаем оригинальную функцию
        JSON.stringify = originalStringify;
      }
    });
  });
});