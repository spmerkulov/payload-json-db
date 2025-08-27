import { JsonAdapter } from '../src/adapter';
import { JsonAdapterConfig, JsonRecord } from '../src/types';
import { TestUtils } from './setup';
import path from 'path';
import fs from 'fs';

interface TestRecord extends JsonRecord {
  name: string;
  email: string;
  age?: number;
}

describe('JsonAdapter', () => {
  let adapter: JsonAdapter;
  let config: JsonAdapterConfig;
  let testDataDir: string;

  beforeEach(async () => {
    testDataDir = await TestUtils.createTempDir('adapter-test');
    
    config = {
      dataDir: testDataDir,
      cache: {
        enabled: true,
        ttl: 60000,
        maxSize: 100,
        autoSaveInterval: 1000
      },
      performance: {
        maxFileSize: 10 * 1024 * 1024
      }
    };

    adapter = new JsonAdapter(config);
    await adapter.init();
  });

  afterEach(async () => {
    await adapter.destroy();
    TestUtils.cleanupTempDir(testDataDir);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(adapter).toBeDefined();
      expect(fs.existsSync(testDataDir)).toBe(true);
    });

    it('should connect and be ready', async () => {
      await adapter.connect();
      expect(adapter).toBeDefined();
    });
  });

  describe('Create Operations', () => {
    it('should create a new record', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      };

      const record = await adapter.create<TestRecord>('users', data);

      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.name).toBe(data.name);
      expect(record.email).toBe(data.email);
      expect(record.age).toBe(data.age);
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it('should create multiple records', async () => {
      const users = [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Charlie', email: 'charlie@example.com' }
      ];

      const createdUsers = [];
      for (const user of users) {
        const record = await adapter.create<TestRecord>('users', user);
        createdUsers.push(record);
      }

      expect(createdUsers).toHaveLength(3);
      expect(createdUsers.every(u => u.id)).toBe(true);
      expect(new Set(createdUsers.map(u => u.id)).size).toBe(3); // Все ID уникальны
    });

    it('should validate collection name', async () => {
      const data = { name: 'Test', email: 'test@example.com' };
      
      await expect(adapter.create('', data)).rejects.toThrow();
      await expect(adapter.create('invalid/name', data)).rejects.toThrow();
      await expect(adapter.create('invalid\\name', data)).rejects.toThrow();
    });
  });

  describe('Find Operations', () => {
    beforeEach(async () => {
      // Создаем тестовые данные
      await adapter.create<TestRecord>('users', { name: 'Alice', email: 'alice@example.com', age: 25 });
      await adapter.create<TestRecord>('users', { name: 'Bob', email: 'bob@example.com', age: 30 });
      await adapter.create<TestRecord>('users', { name: 'Charlie', email: 'charlie@example.com', age: 35 });
    });

    it('should find all records', async () => {
      const result = await adapter.find<TestRecord>('users');
      
      expect(result.docs).toHaveLength(3);
      expect(result.totalDocs).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should find records with pagination', async () => {
      const result = await adapter.find<TestRecord>('users', {
        limit: 2,
        page: 1
      });
      
      expect(result.docs).toHaveLength(2);
      expect(result.totalDocs).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(false);
    });

    it('should find records with filtering', async () => {
      const result = await adapter.find<TestRecord>('users', {
        where: { age: 30 }
      });
      
      expect(result.docs).toHaveLength(1);
      expect(result.docs[0].name).toBe('Bob');
    });

    it('should find records with sorting', async () => {
      const result = await adapter.find<TestRecord>('users', {
        sort: { age: -1 } // По убыванию возраста
      });
      
      expect(result.docs[0].age).toBe(35); // Charlie
      expect(result.docs[1].age).toBe(30); // Bob
      expect(result.docs[2].age).toBe(25); // Alice
    });

    it('should find one record by conditions', async () => {
      const record = await adapter.findOne<TestRecord>('users', { name: 'Alice' });
      
      expect(record).toBeDefined();
      expect(record!.name).toBe('Alice');
      expect(record!.email).toBe('alice@example.com');
    });

    it('should return null when record not found', async () => {
      const record = await adapter.findOne<TestRecord>('users', { name: 'NonExistent' });
      expect(record).toBeNull();
    });
  });

  describe('Update Operations', () => {
    let testRecord: TestRecord;

    beforeEach(async () => {
      testRecord = await adapter.create<TestRecord>('users', {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      });
    });

    it('should update existing record', async () => {
      // Добавляем небольшую задержку для гарантии разного времени
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updatedRecord = await adapter.findOneAndUpdate<TestRecord>(
        'users',
        testRecord.id,
        { age: 31, email: 'john.doe@example.com' }
      );

      expect(updatedRecord).toBeDefined();
      expect(updatedRecord!.id).toBe(testRecord.id);
      expect(updatedRecord!.age).toBe(31);
      expect(updatedRecord!.email).toBe('john.doe@example.com');
      expect(updatedRecord!.name).toBe('John Doe'); // Не изменилось
      expect(updatedRecord!.createdAt).toEqual(testRecord.createdAt);
      expect(updatedRecord!.updatedAt.getTime()).toBeGreaterThan(testRecord.updatedAt.getTime());
    });

    it('should return null when updating non-existent record', async () => {
      const result = await adapter.findOneAndUpdate<TestRecord>(
        'users',
        'non-existent-id',
        { age: 25 }
      );

      expect(result).toBeNull();
    });

    it('should not allow changing id or createdAt', async () => {
      const originalId = testRecord.id;
      const originalCreatedAt = testRecord.createdAt;

      const updatedRecord = await adapter.findOneAndUpdate<TestRecord>(
        'users',
        testRecord.id,
        { 
          id: 'new-id',
          createdAt: new Date('2020-01-01'),
          name: 'Updated Name'
        } as any
      );

      expect(updatedRecord!.id).toBe(originalId);
      expect(updatedRecord!.createdAt).toEqual(originalCreatedAt);
      expect(updatedRecord!.name).toBe('Updated Name');
    });
  });

  describe('Delete Operations', () => {
    let testRecord: TestRecord;

    beforeEach(async () => {
      testRecord = await adapter.create<TestRecord>('users', {
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should delete existing record', async () => {
      const deletedRecord = await adapter.findOneAndDelete<TestRecord>('users', testRecord.id);

      expect(deletedRecord).toBeDefined();
      expect(deletedRecord!.id).toBe(testRecord.id);
      expect(deletedRecord!.name).toBe(testRecord.name);

      // Проверяем, что запись действительно удалена
      const foundRecord = await adapter.findOne<TestRecord>('users', { id: testRecord.id });
      expect(foundRecord).toBeNull();
    });

    it('should return null when deleting non-existent record', async () => {
      const result = await adapter.findOneAndDelete<TestRecord>('users', 'non-existent-id');
      expect(result).toBeNull();
    });

    it('should update collection after deletion', async () => {
      await adapter.create<TestRecord>('users', { name: 'Alice', email: 'alice@example.com' });
      await adapter.create<TestRecord>('users', { name: 'Bob', email: 'bob@example.com' });

      const beforeCount = (await adapter.find<TestRecord>('users')).totalDocs;
      expect(beforeCount).toBe(3); // testRecord + Alice + Bob

      await adapter.findOneAndDelete<TestRecord>('users', testRecord.id);

      const afterCount = (await adapter.find<TestRecord>('users')).totalDocs;
      expect(afterCount).toBe(2);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide adapter statistics', async () => {
      await adapter.create<TestRecord>('users', { name: 'Test', email: 'test@example.com' });
      await adapter.find<TestRecord>('users');

      const stats = await adapter.getStats();
      
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.totalQueryTime).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHits).toBeGreaterThanOrEqual(0);
      expect(stats.cacheMisses).toBeGreaterThanOrEqual(0);
    });

    it('should clear cache', async () => {
      await adapter.create<TestRecord>('users', { name: 'Test', email: 'test@example.com' });
      
      await adapter.clearCache();
      
      const stats = await adapter.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid collection names', async () => {
      const data = { name: 'Test', email: 'test@example.com' };
      
      await expect(adapter.create('', data)).rejects.toThrow();
      await expect(adapter.find('')).rejects.toThrow();
      await expect(adapter.findOne('invalid/name', {})).rejects.toThrow();
    });

    it('should handle invalid query options', async () => {
      await expect(adapter.find('users', { limit: -1 })).rejects.toThrow();
      await expect(adapter.find('users', { page: 0 })).rejects.toThrow();
    });

    it('should handle invalid record data', async () => {
      await expect(adapter.create('users', null as any)).rejects.toThrow();
      await expect(adapter.create('users', 'invalid' as any)).rejects.toThrow();
    });
  });

  describe('New CRUD Operations', () => {
    let testRecords: TestRecord[];

    beforeEach(async () => {
      testRecords = [
        { id: '1', name: 'Alice', email: 'alice@example.com', age: 25 },
        { id: '2', name: 'Bob', email: 'bob@example.com', age: 30 },
        { id: '3', name: 'Charlie', email: 'charlie@example.com', age: 35 }
      ];

      for (const record of testRecords) {
        await adapter.create<TestRecord>('users', record);
      }
    });

    describe('count', () => {
      it('should count all documents', async () => {
        const count = await adapter.count({ collection: 'users' });
        expect(count).toEqual({ totalDocs: 3 });
      });

      it('should count documents with where clause', async () => {
        const count = await adapter.count({ 
          collection: 'users', 
          where: { age: { $gte: 30 } } 
        });
        expect(count).toEqual({ totalDocs: 2 }); // Bob and Charlie
      });
    });

    describe('deleteMany', () => {
      it('should delete multiple documents', async () => {
        const result = await adapter.deleteMany({ 
          collection: 'users', 
          where: { age: { $gte: 30 } } 
        });
        
        expect(result.deletedCount).toBe(2);
        
        const remaining = await adapter.find<TestRecord>('users');
        expect(remaining.totalDocs).toBe(1);
        expect(remaining.docs[0].name).toBe('Alice');
      });
    });

    describe('deleteOne', () => {
      it('should delete one document', async () => {
        const result = await adapter.deleteOne({ 
          collection: 'users', 
          where: { name: 'Bob' } 
        });
        
        expect(result.deletedCount).toBe(1);
        
        const remaining = await adapter.find<TestRecord>('users');
        expect(remaining.totalDocs).toBe(2);
      });
    });

    describe('updateOne', () => {
      it('should update one document', async () => {
        const result = await adapter.updateOne({ 
          collection: 'users', 
          where: { name: 'Bob' },
          data: { age: 31 }
        });
        
        expect(result.modifiedCount).toBe(1);
        
        const updated = await adapter.findOne<TestRecord>('users', { name: 'Bob' });
        expect(updated?.age).toBe(31);
      });
    });

    describe('upsert', () => {
      it('should update existing document', async () => {
        const result = await adapter.upsert({ 
          collection: 'users', 
          where: { name: 'Bob' },
          data: { age: 32 }
        });
        
        expect(result.name).toBe('Bob');
        expect(result.age).toBe(32);
      });

      it('should create new document if not exists', async () => {
        const result = await adapter.upsert({ 
          collection: 'users', 
          where: { name: 'David' },
          data: { email: 'david@example.com', age: 28 }
        });
        
        expect(result.name).toBe('David');
        expect(result.email).toBe('david@example.com');
        
        const count = await adapter.count({ collection: 'users' });
        expect(count).toEqual({ totalDocs: 4 });
      });
    });
  });

  describe('Transaction Operations', () => {
    it('should begin, commit and rollback transactions', async () => {
      const transactionId = await adapter.beginTransaction();
      expect(transactionId).toBeDefined();
      expect(typeof transactionId).toBe('string');

      await adapter.commitTransaction(transactionId);
      
      // Test rollback
      const transactionId2 = await adapter.beginTransaction();
      await adapter.rollbackTransaction(transactionId2);
    });

    it('should handle invalid transaction IDs', async () => {
      await expect(adapter.commitTransaction('invalid-id')).rejects.toThrow();
      await expect(adapter.rollbackTransaction('invalid-id')).rejects.toThrow();
    });
  });

  describe('Global Operations', () => {
    it('should create and find global data', async () => {
      const globalData = { title: 'Site Title', description: 'Site Description' };
      
      const created = await adapter.createGlobal({ slug: 'site-settings', data: globalData });
      expect(created.title).toBe('Site Title');
      
      const found = await adapter.findGlobal({ slug: 'site-settings' });
      expect(found.title).toBe('Site Title');
      expect(found.description).toBe('Site Description');
    });

    it('should update global data', async () => {
      await adapter.createGlobal({ 
        slug: 'site-settings', 
        data: { title: 'Old Title' } 
      });
      
      const updated = await adapter.updateGlobal({ 
        slug: 'site-settings', 
        data: { title: 'New Title', description: 'New Description' } 
      });
      
      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe('New Description');
    });
  });

  describe('Version Operations', () => {
    it('should create and find versions', async () => {
      const parentDoc = await adapter.create<TestRecord>('posts', {
        name: 'Test Post',
        email: 'test@example.com'
      });
      
      const version = await adapter.createVersion({
        collection: 'posts',
        parent: parentDoc.id,
        versionData: { name: 'Test Post v1', content: 'Version 1 content' }
      });
      
      expect(version.parent).toBe(parentDoc.id);
      expect(version.name).toBe('Test Post v1');
      
      const versions = await adapter.findVersions({ 
        collection: 'posts',
        where: { parent: parentDoc.id }
      });
      
      expect(versions.totalDocs).toBe(1);
      expect(versions.docs[0].parent).toBe(parentDoc.id);
    });

    it('should delete versions', async () => {
      const parentDoc = await adapter.create<TestRecord>('posts', {
        name: 'Test Post',
        email: 'test@example.com'
      });
      
      await adapter.createVersion({
        collection: 'posts',
        parent: parentDoc.id,
        versionData: { name: 'Version 1' }
      });
      
      const result = await adapter.deleteVersions({ 
        collection: 'posts',
        where: { parent: parentDoc.id }
      });
      
      expect(result.deletedCount).toBe(1);
    });
  });

  describe('Migration Operations', () => {
    it('should create migration records', async () => {
      const migration = await adapter.createMigration({ 
        name: '001_initial_migration',
        batch: 1
      });
      
      expect(migration.name).toBe('001_initial_migration');
      expect(migration.batch).toBe(1);
      expect(migration.executedAt).toBeDefined();
    });

    it('should get migration records', async () => {
      await adapter.createMigration({ name: '001_first', batch: 1 });
      await adapter.createMigration({ name: '002_second', batch: 1 });
      
      const migrations = await adapter.getMigrations();
      expect(migrations.length).toBe(2);
      expect(migrations[0].name).toBe('001_first');
      expect(migrations[1].name).toBe('002_second');
    });

    it('should perform fresh migration', async () => {
      await adapter.create<TestRecord>('users', { name: 'Test', email: 'test@example.com' });
      
      await adapter.migrateFresh();
      
      // После fresh migration данные должны быть очищены
      const users = await adapter.find<TestRecord>('users');
      expect(users.totalDocs).toBe(0);
    });
  });
});