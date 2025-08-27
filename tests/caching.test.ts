import { JsonAdapter } from '../src/adapter';
import { JsonAdapterConfig } from '../src/types';
import { TestUtils } from './setup';
import path from 'path';
import fs from 'fs';

interface TestRecord {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

describe('JsonAdapter Caching & Auto-save', () => {
  let adapter: JsonAdapter;
  let tempDir: string;
  let config: JsonAdapterConfig;

  beforeEach(async () => {
    tempDir = await TestUtils.createTempDir();
    config = {
      dataDir: tempDir,
      cache: {
        maxSize: 100,
        ttl: 60000,
        autoSaveInterval: 100 // 100ms для быстрого тестирования
      }
    };
    adapter = new JsonAdapter(config);
    await adapter.init();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.destroy();
    }
    await TestUtils.cleanupTempDir(tempDir);
  });

  it('should auto-save dirty collections', async () => {
    // Создаем запись
    const record = await adapter.create<TestRecord>('users', {
      name: 'John Doe',
      email: 'john@example.com'
    });

    // Ждем автосохранения
    await new Promise(resolve => setTimeout(resolve, 150));

    // Проверяем, что файл был создан
    const filePath = path.join(tempDir, 'users.json');
    expect(fs.existsSync(filePath)).toBe(true);

    // Проверяем содержимое файла
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(fileContent.records).toHaveLength(1);
    expect(fileContent.records[0].name).toBe('John Doe');
  });

  it('should save all dirty collections on destroy', async () => {
    // Создаем записи в разных коллекциях
    await adapter.create<TestRecord>('users', {
      name: 'John Doe',
      email: 'john@example.com'
    });

    await adapter.create<TestRecord>('posts', {
      name: 'Test Post',
      email: 'test@example.com'
    });

    // Уничтожаем адаптер (должно вызвать финальное сохранение)
    await adapter.destroy();

    // Проверяем, что оба файла созданы
    expect(fs.existsSync(path.join(tempDir, 'users.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'posts.json'))).toBe(true);
  });

  it('should emit auto-save events', async () => {
    const autoSavedSpy = jest.fn();
    const cacheSavedSpy = jest.fn();

    adapter.on('adapter:autoSaved', autoSavedSpy);
    adapter.on('cache:saved', cacheSavedSpy);

    // Создаем запись
    await adapter.create<TestRecord>('users', {
      name: 'John Doe',
      email: 'john@example.com'
    });

    // Ждем автосохранения
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(autoSavedSpy).toHaveBeenCalledWith({ collections: ['users'] });
    expect(cacheSavedSpy).toHaveBeenCalledWith('users');
  });

  it('should track cache hits and misses', async () => {
    // Создаем новый адаптер для чистой статистики
    const testAdapter = new JsonAdapter(config);
    await testAdapter.init();
    
    try {
      // Первый поиск - должен быть cache miss (коллекция не существует)
      await testAdapter.findOne<TestRecord>('users', 'non-existent-id');
      
      // Создаем запись (загружает коллекцию в кэш)
      const record = await testAdapter.create<TestRecord>('users', {
        name: 'John Doe',
        email: 'john@example.com'
      });
      
      // Второй поиск - должен быть cache hit
      await testAdapter.findOne<TestRecord>('users', record.id);

      const stats = await testAdapter.getStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
      expect(stats.cacheMisses).toBeGreaterThan(0);
    } finally {
      await testAdapter.destroy();
    }
  });
});