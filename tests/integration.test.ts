import { JsonAdapter } from '../src/adapter';
import { PayloadRequest } from 'payload/types';
import path from 'path';
import fs from 'fs-extra';

// Mock Payload request object
const mockRequest: PayloadRequest = {
  payload: {
    config: {
      collections: [],
      globals: [],
    },
  },
} as any;

describe('JsonAdapter Integration Tests', () => {
  let adapter: JsonAdapter;
  let testDbPath: string;

  beforeEach(async () => {
    // Create unique database path for each test
    testDbPath = path.join(__dirname, `test-integration-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    
    // Clean up any existing test database
    await fs.remove(testDbPath);
    
    adapter = new JsonAdapter({
      dataDir: testDbPath,
      encryption: {
        enabled: false,
      },
      cache: {
        enabled: true,
        ttl: 300000,
        maxSize: 100,
      },
    });

    await adapter.init();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.destroy();
    }
    if (testDbPath) {
      await fs.remove(testDbPath);
    }
  });

  describe('Payload CMS Compatibility', () => {
    it('should implement all required BaseDatabaseAdapter methods', () => {
      // Check that all required methods exist
      const requiredMethods = [
        'init',
        'create',
        'find',
        'findOne',
        'findOneAndUpdate',
        'updateOne',
        'updateMany',
        'deleteOne',
        'deleteMany',
        'count',
        'upsert',
        'beginTransaction',
        'commitTransaction',
        'rollbackTransaction',
        'createGlobal',
        'findGlobal',
        'updateGlobal',
        'createVersion',
        'findVersions',
        'deleteVersions',
        'createMigration',
        'getMigrations',
        'migrateFresh',
        'destroy',
      ];

      requiredMethods.forEach(method => {
        expect(typeof adapter[method]).toBe('function');
      });
    });

    it('should have required properties', () => {
      expect(adapter.packageName).toBe('payload-db-json');
      expect(adapter.defaultIDType).toBe('text');
      expect(typeof adapter.migrationDir).toBe('string');
    });

    it('should handle Payload CMS collection operations', async () => {
      const collection = `users_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      };

      // Create a document
      const created = await adapter.create(collection, userData);

      expect(created).toMatchObject(userData);
      expect(created.id).toBeDefined();

      // Find the document
      const found = await adapter.find(collection, {
        where: { email: { equals: 'test@example.com' } },
      });

      expect(found.docs).toHaveLength(1);
      expect(found.docs[0]).toMatchObject(userData);

      // Update the document
      const updated = await adapter.findOneAndUpdate(
        collection,
        created.id,
        { name: 'Updated User' }
      );

      expect(updated.name).toBe('Updated User');

      // Count documents
      const count = await adapter.count({ collection, where: {} });

      expect(count.totalDocs).toBe(1);

      // Delete the document
      await adapter.deleteOne({
        collection,
        where: { id: { equals: created.id } },
      });

      const afterDelete = await adapter.count({ collection, where: {} });

      expect(afterDelete.totalDocs).toBe(0);
    });

    it('should handle Payload CMS global operations', async () => {
      const globalSlug = `settings_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const globalData = {
        siteName: 'My Site',
        siteDescription: 'A test site',
        maintenanceMode: false,
      };

      // Create global
      const created = await adapter.createGlobal({
        slug: globalSlug,
        data: globalData,
      });

      expect(created).toMatchObject(globalData);

      // Find global
      const found = await adapter.findGlobal({
        slug: globalSlug,
      });

      expect(found).toMatchObject(globalData);

      // Update global
      const updated = await adapter.updateGlobal({
        slug: globalSlug,
        data: { siteName: 'Updated Site' }
      });

      expect(updated.siteName).toBe('Updated Site');
    });

    it('should handle Payload CMS version operations', async () => {
      const collection = `posts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const parentId = 'test-post-id';
      const versionData = {
        parent: parentId,
        title: 'Test Post',
        content: 'This is a test post',
        status: 'draft',
      };

      // Create version
      const created = await adapter.createVersion({
        collection,
        parent: parentId,
        versionData,
      });

      expect(created.parent).toBe(parentId);
      expect(created.title).toBe('Test Post');
      expect(created.id).toBeDefined();

      // Find versions
      const versions = await adapter.findVersions({
        collection,
        where: { parent: { equals: parentId } },
      });

      expect(versions.docs).toHaveLength(1);
      expect(versions.docs[0].parent).toBe(parentId);

      // Delete versions
      await adapter.deleteVersions({
        collection,
        where: { parent: { equals: parentId } },
      });

      const afterDelete = await adapter.findVersions({
        collection,
        where: { parent: { equals: parentId } },
      });

      expect(afterDelete.docs).toHaveLength(0);
    });

    it('should handle Payload CMS migration operations', async () => {
      // Create a separate adapter instance for migration tests to avoid conflicts
      const migrationDbPath = path.join(__dirname, `test-migration-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      const migrationAdapter = new JsonAdapter({
        dataDir: migrationDbPath,
        encryption: {
          enabled: false,
        },
        cache: {
          enabled: true,
          ttl: 300000,
          maxSize: 100,
        },
      });
      
      try {
        await migrationAdapter.init();

        const migrationName = 'test-migration';

        // Create migration
        const created = await migrationAdapter.createMigration({
          name: migrationName,
          batch: 1,
        });

        expect(created.name).toBe(migrationName);
        expect(created.batch).toBe(1);

        // Get migrations
        const migrations = await migrationAdapter.getMigrations();

        expect(migrations).toHaveLength(1);
        expect(migrations[0].name).toBe(migrationName);
      } finally {
        // Clean up
        await migrationAdapter.destroy();
        await fs.remove(migrationDbPath);
      }
    });

    it('should handle transaction operations', async () => {
      const collection = 'transactions-test';
      
      // Begin transaction
      const transaction = await adapter.beginTransaction(mockRequest);
      expect(transaction).toBeDefined();

      try {
        // Create document within transaction
        const created = await adapter.create(collection, { name: 'Transaction Test' });

        expect(created.name).toBe('Transaction Test');

        // Commit transaction
        await adapter.commitTransaction(transaction);

        // Verify document exists after commit
        const found = await adapter.find(collection, {
          where: { id: { equals: created.id } },
        });

        expect(found.docs).toHaveLength(1);
      } catch (error) {
        // Rollback on error
        await adapter.rollbackTransaction(transaction);
        throw error;
      }
    });

    it('should handle complex queries like Payload CMS', async () => {
      const collection = `users_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create test data
      const testData = [
        { name: 'John', age: 25, active: true, tags: ['developer', 'javascript'] },
        { name: 'Jane', age: 30, active: false, tags: ['designer', 'css'] },
        { name: 'Bob', age: 35, active: true, tags: ['manager', 'javascript'] },
      ];

      for (const data of testData) {
        await adapter.create(collection, data);
      }

      // Test complex where conditions
      const activeUsers = await adapter.find(collection, {
        where: { active: { equals: true } },
      });

      expect(activeUsers.docs).toHaveLength(2);

      // Test sorting
      const sortedByAge = await adapter.find(collection, {
        where: {},
        sort: { age: 1 },
      });

      expect(sortedByAge.docs[0].age).toBe(25);
      expect(sortedByAge.docs[2].age).toBe(35);

      // Test pagination
      const paginated = await adapter.find(collection, {
        where: {},
        limit: 2,
        page: 1,
      });

      expect(paginated.docs).toHaveLength(2);
      expect(paginated.totalPages).toBe(2);
      expect(paginated.totalDocs).toBe(3);
    });
  });
});