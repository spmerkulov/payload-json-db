# Руководство по тестированию

## Содержание

- [Обзор тестирования](#обзор-тестирования)
- [Настройка тестовой среды](#настройка-тестовой-среды)
- [Модульные тесты](#модульные-тесты)
- [Интеграционные тесты](#интеграционные-тесты)
- [E2E тесты](#e2e-тесты)
- [Тесты производительности](#тесты-производительности)
- [Тесты безопасности](#тесты-безопасности)
- [Мокирование и фикстуры](#мокирование-и-фикстуры)
- [Покрытие кода](#покрытие-кода)
- [CI/CD интеграция](#cicd-интеграция)
- [Лучшие практики](#лучшие-практики)

## Обзор тестирования

### Стратегия тестирования

**JSON Database Adapter** использует многоуровневую стратегию тестирования:

- **Модульные тесты (Unit Tests)** - тестирование отдельных компонентов
- **Интеграционные тесты (Integration Tests)** - тестирование взаимодействия компонентов
- **E2E тесты (End-to-End Tests)** - тестирование полных сценариев использования
- **Тесты производительности (Performance Tests)** - нагрузочное тестирование
- **Тесты безопасности (Security Tests)** - проверка уязвимостей

### Структура тестов

```
tests/
├── unit/                    # Модульные тесты
│   ├── adapters/
│   ├── managers/
│   ├── utils/
│   └── validation/
├── integration/             # Интеграционные тесты
│   ├── crud-operations.test.ts
│   ├── caching.test.ts
│   └── encryption.test.ts
├── e2e/                     # E2E тесты
│   ├── payload-integration.test.ts
│   └── real-world-scenarios.test.ts
├── performance/             # Тесты производительности
│   ├── benchmarks.test.ts
│   └── load-testing.test.ts
├── security/                # Тесты безопасности
│   ├── encryption.test.ts
│   └── input-validation.test.ts
├── fixtures/                # Тестовые данные
│   ├── users.json
│   └── posts.json
└── helpers/                 # Вспомогательные функции
    ├── test-adapter.ts
    └── mock-data.ts
```

## Настройка тестовой среды

### 1. Конфигурация Jest

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: true
}
```

### 2. Настройка тестовой среды

```typescript
// tests/setup.ts
import { promises as fs } from 'fs'
import path from 'path'
import { JSONAdapter } from '../src/index'

// Глобальные переменные для тестов
declare global {
  var testAdapter: JSONAdapter
  var testDataDir: string
  var cleanupFunctions: Array<() => Promise<void>>
}

// Настройка перед всеми тестами
beforeAll(async () => {
  // Создаем временную директорию для тестов
  global.testDataDir = path.join(__dirname, 'temp', `test-${Date.now()}`)
  await fs.mkdir(global.testDataDir, { recursive: true })
  
  // Инициализируем массив функций очистки
  global.cleanupFunctions = []
  
  // Настраиваем тестовый адаптер
  global.testAdapter = new JSONAdapter({
    dataDir: global.testDataDir,
    enableCache: true,
    cacheSize: 1000,
    enableEncryption: false, // Отключаем для быстрых тестов
    logLevel: 'error' // Минимальное логирование
  })
})

// Очистка после каждого теста
afterEach(async () => {
  // Очищаем кэш
  if (global.testAdapter) {
    await global.testAdapter.clearCache()
  }
  
  // Выполняем функции очистки
  for (const cleanup of global.cleanupFunctions) {
    await cleanup()
  }
  global.cleanupFunctions = []
})

// Очистка после всех тестов
afterAll(async () => {
  // Закрываем адаптер
  if (global.testAdapter) {
    await global.testAdapter.close()
  }
  
  // Удаляем временную директорию
  try {
    await fs.rmdir(global.testDataDir, { recursive: true })
  } catch (error) {
    console.warn('Failed to cleanup test directory:', error)
  }
})

// Вспомогательные функции для тестов
export const createTestAdapter = (options: any = {}): JSONAdapter => {
  const adapter = new JSONAdapter({
    dataDir: path.join(global.testDataDir, `adapter-${Date.now()}`),
    enableCache: true,
    enableEncryption: false,
    logLevel: 'error',
    ...options
  })
  
  // Добавляем функцию очистки
  global.cleanupFunctions.push(async () => {
    await adapter.close()
  })
  
  return adapter
}

export const createTempDir = async (): Promise<string> => {
  const tempDir = path.join(global.testDataDir, `temp-${Date.now()}`)
  await fs.mkdir(tempDir, { recursive: true })
  
  // Добавляем функцию очистки
  global.cleanupFunctions.push(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true })
    } catch (error) {
      // Игнорируем ошибки очистки
    }
  })
  
  return tempDir
}
```

### 3. Вспомогательные функции

```typescript
// tests/helpers/test-adapter.ts
import { JSONAdapter } from '../../src/index'
import { createTestAdapter } from '../setup'

export class TestAdapterHelper {
  private adapter: JSONAdapter
  
  constructor(options: any = {}) {
    this.adapter = createTestAdapter(options)
  }
  
  getAdapter(): JSONAdapter {
    return this.adapter
  }
  
  async seedData(collection: string, data: any[]): Promise<void> {
    for (const item of data) {
      await this.adapter.create(collection, item)
    }
  }
  
  async clearCollection(collection: string): Promise<void> {
    const items = await this.adapter.find(collection, {})
    for (const item of items) {
      await this.adapter.delete(collection, { id: item.id })
    }
  }
  
  async getCollectionSize(collection: string): Promise<number> {
    return await this.adapter.count(collection, {})
  }
  
  async waitForOperation(operation: Promise<any>, timeout: number = 5000): Promise<any> {
    return Promise.race([
      operation,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ])
  }
}
```

```typescript
// tests/helpers/mock-data.ts
export const mockUsers = [
  {
    id: 'user-1',
    email: 'john@example.com',
    name: 'John Doe',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'user-2',
    email: 'jane@example.com',
    name: 'Jane Smith',
    status: 'active',
    createdAt: '2024-01-02T00:00:00.000Z'
  },
  {
    id: 'user-3',
    email: 'bob@example.com',
    name: 'Bob Johnson',
    status: 'inactive',
    createdAt: '2024-01-03T00:00:00.000Z'
  }
]

export const mockPosts = [
  {
    id: 'post-1',
    title: 'First Post',
    content: 'This is the first post',
    authorId: 'user-1',
    status: 'published',
    createdAt: '2024-01-01T12:00:00.000Z'
  },
  {
    id: 'post-2',
    title: 'Second Post',
    content: 'This is the second post',
    authorId: 'user-2',
    status: 'draft',
    createdAt: '2024-01-02T12:00:00.000Z'
  }
]

export const generateMockUsers = (count: number): any[] => {
  const users = []
  for (let i = 0; i < count; i++) {
    users.push({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      name: `User ${i + 1}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
    })
  }
  return users
}

export const generateMockPosts = (count: number, authorIds: string[]): any[] => {
  const posts = []
  for (let i = 0; i < count; i++) {
    posts.push({
      id: `post-${i + 1}`,
      title: `Post ${i + 1}`,
      content: `Content for post ${i + 1}`,
      authorId: authorIds[i % authorIds.length],
      status: i % 3 === 0 ? 'published' : 'draft',
      createdAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
    })
  }
  return posts
}
```

## Модульные тесты

### 1. Тестирование JSONAdapter

```typescript
// tests/unit/adapters/json-adapter.test.ts
import { JSONAdapter } from '../../../src/adapters/JSONAdapter'
import { TestAdapterHelper } from '../../helpers/test-adapter'
import { mockUsers, mockPosts } from '../../helpers/mock-data'

describe('JSONAdapter', () => {
  let helper: TestAdapterHelper
  let adapter: JSONAdapter
  
  beforeEach(() => {
    helper = new TestAdapterHelper()
    adapter = helper.getAdapter()
  })
  
  describe('create', () => {
    it('should create a new record', async () => {
      const user = mockUsers[0]
      const result = await adapter.create('users', user)
      
      expect(result).toMatchObject(user)
      expect(result.id).toBe(user.id)
    })
    
    it('should throw error for duplicate ID', async () => {
      const user = mockUsers[0]
      await adapter.create('users', user)
      
      await expect(adapter.create('users', user))
        .rejects.toThrow('Record with ID user-1 already exists')
    })
    
    it('should validate required fields', async () => {
      await expect(adapter.create('users', { name: 'Test' }))
        .rejects.toThrow('ID is required')
    })
    
    it('should handle special characters in ID', async () => {
      const user = { ...mockUsers[0], id: 'user-with-special-chars-@#$%' }
      const result = await adapter.create('users', user)
      
      expect(result.id).toBe(user.id)
    })
  })
  
  describe('findByID', () => {
    beforeEach(async () => {
      await helper.seedData('users', mockUsers)
    })
    
    it('should find record by ID', async () => {
      const result = await adapter.findByID('users', 'user-1')
      
      expect(result).toMatchObject(mockUsers[0])
    })
    
    it('should return null for non-existent ID', async () => {
      const result = await adapter.findByID('users', 'non-existent')
      
      expect(result).toBeNull()
    })
    
    it('should handle empty collection', async () => {
      const result = await adapter.findByID('empty-collection', 'any-id')
      
      expect(result).toBeNull()
    })
  })
  
  describe('find', () => {
    beforeEach(async () => {
      await helper.seedData('users', mockUsers)
    })
    
    it('should find all records without query', async () => {
      const results = await adapter.find('users', {})
      
      expect(results).toHaveLength(mockUsers.length)
    })
    
    it('should filter by equals condition', async () => {
      const results = await adapter.find('users', {
        where: { status: { equals: 'active' } }
      })
      
      expect(results).toHaveLength(2)
      expect(results.every(u => u.status === 'active')).toBe(true)
    })
    
    it('should filter by contains condition', async () => {
      const results = await adapter.find('users', {
        where: { email: { contains: 'john' } }
      })
      
      expect(results).toHaveLength(1)
      expect(results[0].email).toBe('john@example.com')
    })
    
    it('should apply limit', async () => {
      const results = await adapter.find('users', {
        limit: 2
      })
      
      expect(results).toHaveLength(2)
    })
    
    it('should apply skip', async () => {
      const results = await adapter.find('users', {
        skip: 1,
        limit: 2
      })
      
      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('user-2')
    })
    
    it('should sort results', async () => {
      const results = await adapter.find('users', {
        sort: { createdAt: 'desc' }
      })
      
      expect(results[0].id).toBe('user-3')
      expect(results[2].id).toBe('user-1')
    })
    
    it('should handle complex queries', async () => {
      const results = await adapter.find('users', {
        where: {
          status: { equals: 'active' },
          email: { contains: '@example.com' }
        },
        sort: { name: 'asc' },
        limit: 1
      })
      
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Jane Smith')
    })
  })
  
  describe('update', () => {
    beforeEach(async () => {
      await helper.seedData('users', mockUsers)
    })
    
    it('should update existing record', async () => {
      const result = await adapter.update('users', 
        { id: 'user-1' },
        { name: 'John Updated' }
      )
      
      expect(result.name).toBe('John Updated')
      expect(result.email).toBe('john@example.com') // Unchanged
    })
    
    it('should update multiple records', async () => {
      const results = await adapter.update('users',
        { status: 'active' },
        { status: 'verified' }
      )
      
      expect(results).toHaveLength(2)
      expect(results.every(u => u.status === 'verified')).toBe(true)
    })
    
    it('should return empty array for no matches', async () => {
      const results = await adapter.update('users',
        { id: 'non-existent' },
        { name: 'Updated' }
      )
      
      expect(results).toHaveLength(0)
    })
    
    it('should handle nested field updates', async () => {
      await adapter.create('users', {
        id: 'user-nested',
        profile: { name: 'Test', age: 25 }
      })
      
      const result = await adapter.update('users',
        { id: 'user-nested' },
        { 'profile.age': 26 }
      )
      
      expect(result[0].profile.age).toBe(26)
      expect(result[0].profile.name).toBe('Test') // Unchanged
    })
  })
  
  describe('delete', () => {
    beforeEach(async () => {
      await helper.seedData('users', mockUsers)
    })
    
    it('should delete record by ID', async () => {
      const result = await adapter.delete('users', { id: 'user-1' })
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('user-1')
      
      const remaining = await adapter.find('users', {})
      expect(remaining).toHaveLength(2)
    })
    
    it('should delete multiple records', async () => {
      const results = await adapter.delete('users', { status: 'active' })
      
      expect(results).toHaveLength(2)
      
      const remaining = await adapter.find('users', {})
      expect(remaining).toHaveLength(1)
      expect(remaining[0].status).toBe('inactive')
    })
    
    it('should return empty array for no matches', async () => {
      const results = await adapter.delete('users', { id: 'non-existent' })
      
      expect(results).toHaveLength(0)
    })
  })
  
  describe('count', () => {
    beforeEach(async () => {
      await helper.seedData('users', mockUsers)
    })
    
    it('should count all records', async () => {
      const count = await adapter.count('users', {})
      
      expect(count).toBe(mockUsers.length)
    })
    
    it('should count with filter', async () => {
      const count = await adapter.count('users', {
        where: { status: { equals: 'active' } }
      })
      
      expect(count).toBe(2)
    })
    
    it('should return 0 for empty collection', async () => {
      const count = await adapter.count('empty-collection', {})
      
      expect(count).toBe(0)
    })
  })
})
```

### 2. Тестирование FileManager

```typescript
// tests/unit/managers/file-manager.test.ts
import { FileManager } from '../../../src/managers/FileManager'
import { createTempDir } from '../../setup'
import { promises as fs } from 'fs'
import path from 'path'

describe('FileManager', () => {
  let fileManager: FileManager
  let tempDir: string
  
  beforeEach(async () => {
    tempDir = await createTempDir()
    fileManager = new FileManager(tempDir)
  })
  
  describe('writeFile', () => {
    it('should write data to file', async () => {
      const data = { test: 'data' }
      await fileManager.writeFile('test.json', data)
      
      const filePath = path.join(tempDir, 'test.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const parsedData = JSON.parse(fileContent)
      
      expect(parsedData).toEqual(data)
    })
    
    it('should create directories if they do not exist', async () => {
      const data = { test: 'data' }
      await fileManager.writeFile('nested/deep/test.json', data)
      
      const filePath = path.join(tempDir, 'nested/deep/test.json')
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      
      expect(exists).toBe(true)
    })
    
    it('should handle special characters in filename', async () => {
      const data = { test: 'data' }
      const filename = 'test-file_with@special#chars.json'
      
      await fileManager.writeFile(filename, data)
      
      const filePath = path.join(tempDir, filename)
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      
      expect(exists).toBe(true)
    })
  })
  
  describe('readFile', () => {
    it('should read existing file', async () => {
      const data = { test: 'data' }
      await fileManager.writeFile('test.json', data)
      
      const result = await fileManager.readFile('test.json')
      
      expect(result).toEqual(data)
    })
    
    it('should return null for non-existent file', async () => {
      const result = await fileManager.readFile('non-existent.json')
      
      expect(result).toBeNull()
    })
    
    it('should handle corrupted JSON', async () => {
      const filePath = path.join(tempDir, 'corrupted.json')
      await fs.writeFile(filePath, 'invalid json content')
      
      await expect(fileManager.readFile('corrupted.json'))
        .rejects.toThrow('Failed to parse JSON')
    })
  })
  
  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      await fileManager.writeFile('test.json', { test: 'data' })
      
      const result = await fileManager.deleteFile('test.json')
      
      expect(result).toBe(true)
      
      const filePath = path.join(tempDir, 'test.json')
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      
      expect(exists).toBe(false)
    })
    
    it('should return false for non-existent file', async () => {
      const result = await fileManager.deleteFile('non-existent.json')
      
      expect(result).toBe(false)
    })
  })
  
  describe('listFiles', () => {
    it('should list all files in directory', async () => {
      await fileManager.writeFile('file1.json', { test: 1 })
      await fileManager.writeFile('file2.json', { test: 2 })
      await fileManager.writeFile('nested/file3.json', { test: 3 })
      
      const files = await fileManager.listFiles()
      
      expect(files).toContain('file1.json')
      expect(files).toContain('file2.json')
      expect(files).toContain('nested/file3.json')
    })
    
    it('should return empty array for empty directory', async () => {
      const files = await fileManager.listFiles()
      
      expect(files).toEqual([])
    })
  })
  
  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      await fileManager.writeFile('test.json', { test: 'data' })
      
      const exists = await fileManager.fileExists('test.json')
      
      expect(exists).toBe(true)
    })
    
    it('should return false for non-existent file', async () => {
      const exists = await fileManager.fileExists('non-existent.json')
      
      expect(exists).toBe(false)
    })
  })
})
```

### 3. Тестирование MemoryCache

```typescript
// tests/unit/managers/memory-cache.test.ts
import { MemoryCache } from '../../../src/managers/MemoryCache'

describe('MemoryCache', () => {
  let cache: MemoryCache
  
  beforeEach(() => {
    cache = new MemoryCache({ maxSize: 3, ttl: 1000 })
  })
  
  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      
      expect(cache.get('key1')).toBe('value1')
    })
    
    it('should return undefined for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeUndefined()
    })
    
    it('should handle complex objects', () => {
      const obj = { id: 1, name: 'test', nested: { value: 'nested' } }
      cache.set('object', obj)
      
      expect(cache.get('object')).toEqual(obj)
    })
  })
  
  describe('TTL (Time To Live)', () => {
    it('should expire items after TTL', async () => {
      const shortCache = new MemoryCache({ maxSize: 10, ttl: 50 })
      
      shortCache.set('key1', 'value1')
      expect(shortCache.get('key1')).toBe('value1')
      
      // Ждем истечения TTL
      await new Promise(resolve => setTimeout(resolve, 60))
      
      expect(shortCache.get('key1')).toBeUndefined()
    })
    
    it('should not expire items before TTL', async () => {
      cache.set('key1', 'value1')
      
      // Ждем меньше TTL
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(cache.get('key1')).toBe('value1')
    })
  })
  
  describe('LRU eviction', () => {
    it('should evict least recently used items when full', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      
      // Кэш полный, добавляем еще один элемент
      cache.set('key4', 'value4')
      
      // key1 должен быть вытеснен
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBe('value2')
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')
    })
    
    it('should update LRU order on access', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')
      
      // Обращаемся к key1, делая его недавно использованным
      cache.get('key1')
      
      // Добавляем новый элемент
      cache.set('key4', 'value4')
      
      // key2 должен быть вытеснен (не key1)
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBeUndefined()
      expect(cache.get('key3')).toBe('value3')
      expect(cache.get('key4')).toBe('value4')
    })
  })
  
  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('key1', 'value1')
      
      const deleted = cache.delete('key1')
      
      expect(deleted).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
    })
    
    it('should return false for non-existent keys', () => {
      const deleted = cache.delete('non-existent')
      
      expect(deleted).toBe(false)
    })
  })
  
  describe('clear', () => {
    it('should clear all items', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      
      cache.clear()
      
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
      expect(cache.size()).toBe(0)
    })
  })
  
  describe('size and has', () => {
    it('should track size correctly', () => {
      expect(cache.size()).toBe(0)
      
      cache.set('key1', 'value1')
      expect(cache.size()).toBe(1)
      
      cache.set('key2', 'value2')
      expect(cache.size()).toBe(2)
      
      cache.delete('key1')
      expect(cache.size()).toBe(1)
    })
    
    it('should check key existence', () => {
      cache.set('key1', 'value1')
      
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('non-existent')).toBe(false)
    })
  })
  
  describe('getStats', () => {
    it('should track hit and miss statistics', () => {
      cache.set('key1', 'value1')
      
      // Hits
      cache.get('key1')
      cache.get('key1')
      
      // Misses
      cache.get('non-existent')
      
      const stats = cache.getStats()
      
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.67, 2)
    })
  })
})
```

## Интеграционные тесты

### 1. CRUD операции

```typescript
// tests/integration/crud-operations.test.ts
import { TestAdapterHelper } from '../helpers/test-adapter'
import { mockUsers, mockPosts, generateMockUsers } from '../helpers/mock-data'

describe('CRUD Operations Integration', () => {
  let helper: TestAdapterHelper
  
  beforeEach(() => {
    helper = new TestAdapterHelper()
  })
  
  describe('Complex CRUD workflows', () => {
    it('should handle complete user lifecycle', async () => {
      const adapter = helper.getAdapter()
      
      // Create user
      const user = await adapter.create('users', {
        id: 'lifecycle-user',
        email: 'lifecycle@example.com',
        name: 'Lifecycle User',
        status: 'pending'
      })
      
      expect(user.status).toBe('pending')
      
      // Update user status
      const [updatedUser] = await adapter.update('users',
        { id: 'lifecycle-user' },
        { status: 'active', activatedAt: new Date().toISOString() }
      )
      
      expect(updatedUser.status).toBe('active')
      expect(updatedUser.activatedAt).toBeDefined()
      
      // Create user posts
      const post1 = await adapter.create('posts', {
        id: 'post-1',
        title: 'First Post',
        authorId: 'lifecycle-user',
        status: 'published'
      })
      
      const post2 = await adapter.create('posts', {
        id: 'post-2',
        title: 'Second Post',
        authorId: 'lifecycle-user',
        status: 'draft'
      })
      
      // Find user posts
      const userPosts = await adapter.find('posts', {
        where: { authorId: { equals: 'lifecycle-user' } }
      })
      
      expect(userPosts).toHaveLength(2)
      
      // Delete user and cascade delete posts
      await adapter.delete('posts', { authorId: 'lifecycle-user' })
      await adapter.delete('users', { id: 'lifecycle-user' })
      
      // Verify deletion
      const deletedUser = await adapter.findByID('users', 'lifecycle-user')
      const remainingPosts = await adapter.find('posts', {
        where: { authorId: { equals: 'lifecycle-user' } }
      })
      
      expect(deletedUser).toBeNull()
      expect(remainingPosts).toHaveLength(0)
    })
    
    it('should handle batch operations efficiently', async () => {
      const adapter = helper.getAdapter()
      const users = generateMockUsers(100)
      
      // Batch create
      const createPromises = users.map(user => adapter.create('users', user))
      const createdUsers = await Promise.all(createPromises)
      
      expect(createdUsers).toHaveLength(100)
      
      // Batch update
      const updatePromises = createdUsers
        .filter((_, index) => index % 2 === 0)
        .map(user => adapter.update('users', 
          { id: user.id }, 
          { status: 'premium' }
        ))
      
      await Promise.all(workers)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      const totalReads = concurrentReads * readsPerWorker
      
      console.log(`Completed ${totalReads} concurrent reads in ${duration.toFixed(2)}ms`)
      console.log(`Average: ${(duration / totalReads).toFixed(3)}ms per read`)
      
      // Performance assertion
      expect(duration).toBeLessThan(10000) // Should complete in under 10 seconds
      
      // Verify cache effectiveness
      const stats = adapter.getCacheStats()
      expect(stats.hitRate).toBeGreaterThan(0.8) // At least 80% cache hit rate
    }, 30000)
    
    it('should handle mixed workload efficiently', async () => {
      const adapter = helper.getAdapter()
      const users = generateMockUsers(1000)
      
      // Seed initial data
      await helper.seedData('users', users.slice(0, 500))
      
      const startTime = performance.now()
      
      // Mixed operations: 60% reads, 30% updates, 10% creates
      const operations = []
      
      // Reads (60%)
      for (let i = 0; i < 600; i++) {
        operations.push(async () => {
          const randomId = `user-${Math.floor(Math.random() * 500) + 1}`
          return adapter.findByID('users', randomId)
        })
      }
      
      // Updates (30%)
      for (let i = 0; i < 300; i++) {
        operations.push(async () => {
          const randomId = `user-${Math.floor(Math.random() * 500) + 1}`
          return adapter.update('users', 
            { id: randomId }, 
            { lastSeen: new Date().toISOString() }
          )
        })
      }
      
      // Creates (10%)
      for (let i = 0; i < 100; i++) {
        operations.push(async () => {
          const newUser = users[500 + i]
          return adapter.create('users', newUser)
        })
      }
      
      // Shuffle operations
      operations.sort(() => Math.random() - 0.5)
      
      // Execute in batches
      const batchSize = 50
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize)
        await Promise.all(batch.map(op => op()))
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.log(`Completed mixed workload (1000 ops) in ${duration.toFixed(2)}ms`)
      
      // Verify final state
      const finalCount = await adapter.count('users', {})
      expect(finalCount).toBe(600) // 500 initial + 100 created
      
      expect(duration).toBeLessThan(15000) // Should complete in under 15 seconds
    }, 30000)
  })
  
  describe('Memory usage', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const adapter = helper.getAdapter()
      
      const initialMemory = process.memoryUsage()
      
      // Create large dataset
      const users = generateMockUsers(5000)
      await helper.seedData('users', users)
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await adapter.find('users', {
          where: { status: { equals: 'active' } },
          limit: 10
        })
      }
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
      
      // Memory should not increase excessively (adjust based on requirements)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase
    })
  })
})
```

## Тесты безопасности

### 1. Шифрование

```typescript
// tests/security/encryption.test.ts
import { TestAdapterHelper } from '../helpers/test-adapter'
import { promises as fs } from 'fs'
import path from 'path'

describe('Encryption Security', () => {
  let helper: TestAdapterHelper
  
  beforeEach(() => {
    helper = new TestAdapterHelper({
      enableEncryption: true,
      encryptionKey: 'test-encryption-key-32-characters!'
    })
  })
  
  describe('Data encryption', () => {
    it('should encrypt data at rest', async () => {
      const adapter = helper.getAdapter()
      const sensitiveData = {
        id: 'sensitive-1',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        password: 'super-secret-password'
      }
      
      await adapter.create('sensitive', sensitiveData)
      
      // Read raw file to verify encryption
      const dataDir = (adapter as any).fileManager.dataDir
      const filePath = path.join(dataDir, 'sensitive', 'sensitive-1.json')
      const rawContent = await fs.readFile(filePath, 'utf-8')
      
      // Raw content should not contain sensitive data
      expect(rawContent).not.toContain('123-45-6789')
      expect(rawContent).not.toContain('4111-1111-1111-1111')
      expect(rawContent).not.toContain('super-secret-password')
      
      // But adapter should decrypt correctly
      const retrieved = await adapter.findByID('sensitive', 'sensitive-1')
      expect(retrieved.ssn).toBe('123-45-6789')
      expect(retrieved.creditCard).toBe('4111-1111-1111-1111')
      expect(retrieved.password).toBe('super-secret-password')
    })
    
    it('should fail with wrong encryption key', async () => {
      const adapter1 = helper.getAdapter()
      await adapter1.create('test', { id: 'test-1', data: 'secret' })
      
      // Create new adapter with different key
      const adapter2 = new TestAdapterHelper({
        enableEncryption: true,
        encryptionKey: 'different-key-32-characters!!!'
      }).getAdapter()
      
      // Should fail to decrypt
      await expect(adapter2.findByID('test', 'test-1'))
        .rejects.toThrow('Decryption failed')
    })
  })
})
```

### 2. Валидация входных данных

```typescript
// tests/security/input-validation.test.ts
import { TestAdapterHelper } from '../helpers/test-adapter'

describe('Input Validation Security', () => {
  let helper: TestAdapterHelper
  
  beforeEach(() => {
    helper = new TestAdapterHelper()
  })
  
  describe('SQL injection prevention', () => {
    it('should handle malicious query strings', async () => {
      const adapter = helper.getAdapter()
      
      // Create test data
      await adapter.create('users', {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User'
      })
      
      // Try SQL injection patterns
      const maliciousQueries = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; DELETE FROM users; --",
        "' UNION SELECT * FROM users --"
      ]
      
      for (const maliciousQuery of maliciousQueries) {
        const results = await adapter.find('users', {
          where: { email: { equals: maliciousQuery } }
        })
        
        // Should return empty results, not cause errors
        expect(results).toEqual([])
      }
      
      // Original data should still exist
      const user = await adapter.findByID('users', 'user-1')
      expect(user).not.toBeNull()
    })
  })
  
  describe('Path traversal prevention', () => {
    it('should prevent directory traversal in collection names', async () => {
      const adapter = helper.getAdapter()
      
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM'
      ]
      
      for (const maliciousPath of maliciousPaths) {
        await expect(adapter.create(maliciousPath, { id: 'test' }))
          .rejects.toThrow('Invalid collection name')
      }
    })
    
    it('should prevent directory traversal in record IDs', async () => {
      const adapter = helper.getAdapter()
      
      const maliciousIds = [
        '../../../sensitive-file',
        '..\\..\\..\\sensitive-file',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM'
      ]
      
      for (const maliciousId of maliciousIds) {
        await expect(adapter.create('users', { id: maliciousId }))
          .rejects.toThrow('Invalid ID format')
      }
    })
  })
})
```

## Мокирование и фикстуры

### 1. Тестовые фикстуры

```typescript
// tests/fixtures/blog-data.ts
export const blogFixtures = {
  users: [
    {
      id: 'admin-1',
      email: 'admin@blog.com',
      name: 'Blog Admin',
      role: 'admin',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'author-1',
      email: 'john@blog.com',
      name: 'John Author',
      role: 'author',
      status: 'active',
      createdAt: '2024-01-02T00:00:00.000Z'
    },
    {
      id: 'author-2',
      email: 'jane@blog.com',
      name: 'Jane Writer',
      role: 'author',
      status: 'active',
      createdAt: '2024-01-03T00:00:00.000Z'
    }
  ],
  
  categories: [
    {
      id: 'tech',
      name: 'Technology',
      slug: 'technology',
      description: 'Tech-related posts'
    },
    {
      id: 'lifestyle',
      name: 'Lifestyle',
      slug: 'lifestyle',
      description: 'Lifestyle posts'
    }
  ],
  
  posts: [
    {
      id: 'post-1',
      title: 'Introduction to JSON Database',
      slug: 'intro-json-database',
      content: 'This is a comprehensive guide...',
      excerpt: 'Learn about JSON databases',
      authorId: 'author-1',
      categoryId: 'tech',
      status: 'published',
      publishedAt: '2024-01-10T10:00:00.000Z',
      createdAt: '2024-01-10T09:00:00.000Z',
      updatedAt: '2024-01-10T10:00:00.000Z'
    },
    {
      id: 'post-2',
      title: 'Performance Optimization Tips',
      slug: 'performance-tips',
      content: 'Here are some tips for optimization...',
      excerpt: 'Optimize your applications',
      authorId: 'author-1',
      categoryId: 'tech',
      status: 'published',
      publishedAt: '2024-01-11T14:00:00.000Z',
      createdAt: '2024-01-11T13:00:00.000Z',
      updatedAt: '2024-01-11T14:00:00.000Z'
    },
    {
      id: 'post-3',
      title: 'Work-Life Balance',
      slug: 'work-life-balance',
      content: 'Maintaining balance is important...',
      excerpt: 'Tips for better work-life balance',
      authorId: 'author-2',
      categoryId: 'lifestyle',
      status: 'draft',
      createdAt: '2024-01-12T16:00:00.000Z',
      updatedAt: '2024-01-12T16:00:00.000Z'
    }
  ],
  
  comments: [
    {
      id: 'comment-1',
      postId: 'post-1',
      author: 'Reader 1',
      email: 'reader1@example.com',
      content: 'Great article!',
      status: 'approved',
      createdAt: '2024-01-10T12:00:00.000Z'
    },
    {
      id: 'comment-2',
      postId: 'post-1',
      author: 'Reader 2',
      email: 'reader2@example.com',
      content: 'Very informative, thanks!',
      status: 'approved',
      createdAt: '2024-01-10T15:00:00.000Z'
    }
  ]
}

export const loadBlogFixtures = async (adapter: any): Promise<void> => {
  // Load in dependency order
  for (const user of blogFixtures.users) {
    await adapter.create('users', user)
  }
  
  for (const category of blogFixtures.categories) {
    await adapter.create('categories', category)
  }
  
  for (const post of blogFixtures.posts) {
    await adapter.create('posts', post)
  }
  
  for (const comment of blogFixtures.comments) {
    await adapter.create('comments', comment)
  }
}
```

## Покрытие кода

### 1. Конфигурация покрытия

```javascript
// jest.coverage.config.js
module.exports = {
  ...require('./jest.config.js'),
  
  collectCoverage: true,
  coverageDirectory: 'coverage',
  
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'json-summary',
    'cobertura'
  ],
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts'
  ],
  
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/adapters/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/managers/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/',
    '/coverage/'
  ]
}
```

### 2. Скрипты для покрытия

```json
{
  "scripts": {
    "test:coverage": "jest --config jest.coverage.config.js",
    "test:coverage:watch": "jest --config jest.coverage.config.js --watch",
    "test:coverage:ci": "jest --config jest.coverage.config.js --ci --coverage --watchAll=false",
    "coverage:open": "open coverage/lcov-report/index.html",
    "coverage:check": "jest --config jest.coverage.config.js --passWithNoTests --coverage --coverageReporters=text-summary"
  }
}
```

## CI/CD интеграция

### 1. GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run coverage tests
      run: npm run test:coverage:ci
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Run performance tests
      run: npm run test:performance
      if: matrix.node-version == '18.x'
    
    - name: Run security tests
      run: npm run test:security
      if: matrix.node-version == '18.x'
```

## Лучшие практики

### 1. Организация тестов

- **Группировка**: Группируйте связанные тесты в `describe` блоки
- **Именование**: Используйте описательные имена тестов
- **Изоляция**: Каждый тест должен быть независимым
- **Очистка**: Всегда очищайте данные после тестов

### 2. Тестовые данные

- **Фикстуры**: Используйте фикстуры для сложных тестовых данных
- **Генераторы**: Создавайте генераторы для больших объемов данных
- **Реалистичность**: Используйте реалистичные тестовые данные

### 3. Производительность тестов

- **Параллелизация**: Запускайте тесты параллельно где возможно
- **Кэширование**: Используйте кэширование для ускорения тестов
- **Оптимизация**: Оптимизируйте медленные тесты

### 4. Отладка тестов

```typescript
// Полезные утилиты для отладки
export const debugTest = {
  logMemoryUsage: () => {
    const usage = process.memoryUsage()
    console.log('Memory usage:', {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`
    })
  },
  
  measureTime: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    console.log(`${name} took ${(end - start).toFixed(2)}ms`)
    return result
  },
  
  logAdapterStats: (adapter: any) => {
    const stats = adapter.getMetrics()
    console.log('Adapter stats:', stats)
  }
}
```

### 5. Непрерывная интеграция

- **Автоматизация**: Автоматизируйте запуск всех типов тестов
- **Отчеты**: Генерируйте подробные отчеты о тестировании
- **Уведомления**: Настройте уведомления о падающих тестах
- **Метрики**: Отслеживайте метрики качества кода

---

## Заключение

Это руководство предоставляет полную стратегию тестирования для **JSON Database Adapter**. Следуя этим практикам, вы обеспечите высокое качество и надежность вашего кода.

Для получения дополнительной информации см.:
- [API Reference](./API.md)
- [Performance Guide](./PERFORMANCE.md)
- [Security Guide](./SECURITY.md).all(updatePromises)
      
      // Verify updates
      const premiumUsers = await adapter.find('users', {
        where: { status: { equals: 'premium' } }
      })
      
      expect(premiumUsers).toHaveLength(50)
      
      // Batch delete
      const deletedUsers = await adapter.delete('users', {
        status: 'premium'
      })
      
      expect(deletedUsers).toHaveLength(50)
      
      // Verify remaining
      const remainingUsers = await adapter.find('users', {})
      expect(remainingUsers).toHaveLength(50)
    })
  })
  
  describe('Concurrent operations', () => {
    it('should handle concurrent reads safely', async () => {
      const adapter = helper.getAdapter()
      await helper.seedData('users', mockUsers)
      
      // Concurrent reads
      const readPromises = Array(10).fill(0).map(() => 
        adapter.find('users', { where: { status: { equals: 'active' } } })
      )
      
      const results = await Promise.all(readPromises)
      
      // All results should be identical
      results.forEach(result => {
        expect(result).toHaveLength(2)
        expect(result.every(u => u.status === 'active')).toBe(true)
      })
    })
    
    it('should handle concurrent writes safely', async () => {
      const adapter = helper.getAdapter()
      
      // Concurrent creates with different IDs
      const createPromises = Array(10).fill(0).map((_, index) => 
        adapter.create('users', {
          id: `concurrent-user-${index}`,
          email: `user${index}@example.com`,
          name: `User ${index}`,
          status: 'active'
        })
      )
      
      const results = await Promise.all(createPromises)
      
      expect(results).toHaveLength(10)
      
      // Verify all users were created
      const allUsers = await adapter.find('users', {})
      expect(allUsers).toHaveLength(10)
    })
    
    it('should handle mixed concurrent operations', async () => {
      const adapter = helper.getAdapter()
      await helper.seedData('users', mockUsers)
      
      // Mix of reads, updates, and creates
      const operations = [
        // Reads
        ...Array(5).fill(0).map(() => 
          adapter.find('users', {})
        ),
        // Updates
        ...Array(3).fill(0).map(() => 
          adapter.update('users', 
            { status: 'active' }, 
            { lastSeen: new Date().toISOString() }
          )
        ),
        // Creates
        ...Array(2).fill(0).map((_, index) => 
          adapter.create('users', {
            id: `new-user-${index}`,
            email: `new${index}@example.com`,
            name: `New User ${index}`,
            status: 'active'
          })
        )
      ]
      
      const results = await Promise.all(operations)
      
      // Verify final state
      const finalUsers = await adapter.find('users', {})
      expect(finalUsers).toHaveLength(5) // 3 original + 2 new
      
      const activeUsers = finalUsers.filter(u => u.status === 'active')
      expect(activeUsers.every(u => u.lastSeen)).toBe(true)
    })
  })
})
```

### 2. Кэширование

```typescript
// tests/integration/caching.test.ts
import { TestAdapterHelper } from '../helpers/test-adapter'
import { mockUsers } from '../helpers/mock-data'

describe('Caching Integration', () => {
  let helper: TestAdapterHelper
  
  beforeEach(() => {
    helper = new TestAdapterHelper({
      enableCache: true,
      cacheSize: 100,
      cacheTTL: 5000
    })
  })
  
  describe('Cache behavior', () => {
    it('should cache read operations', async () => {
      const adapter = helper.getAdapter()
      await helper.seedData('users', mockUsers)
      
      // First read - should hit database
      const start1 = Date.now()
      const result1 = await adapter.findByID('users', 'user-1')
      const time1 = Date.now() - start1
      
      // Second read - should hit cache
      const start2 = Date.now()
      const result2 = await adapter.findByID('users', 'user-1')
      const time2 = Date.now() - start2
      
      expect(result1).toEqual(result2)
      expect(time2).toBeLessThan(time1) // Cache should be faster
      
      // Verify cache stats
      const stats = adapter.getCacheStats()
      expect(stats.hits).toBeGreaterThan(0)
    })
    
    it('should invalidate cache on updates', async () => {
      const adapter = helper.getAdapter()
      await helper.seedData('users', mockUsers)
      
      // Read to populate cache
      const original = await adapter.findByID('users', 'user-1')
      expect(original.name).toBe('John Doe')
      
      // Update record
      await adapter.update('users', 
        { id: 'user-1' }, 
        { name: 'John Updated' }
      )
      
      // Read again - should get updated data
      const updated = await adapter.findByID('users', 'user-1')
      expect(updated.name).toBe('John Updated')
    })
    
    it('should invalidate cache on deletes', async () => {
      const adapter = helper.getAdapter()
      await helper.seedData('users', mockUsers)
      
      // Read to populate cache
      const user = await adapter.findByID('users', 'user-1')
      expect(user).not.toBeNull()
      
      // Delete record
      await adapter.delete('users', { id: 'user-1' })
      
      // Read again - should return null
      const deleted = await adapter.findByID('users', 'user-1')
      expect(deleted).toBeNull()
    })
    
    it('should handle cache TTL expiration', async () => {
      const shortCacheAdapter = new TestAdapterHelper({
        enableCache: true,
        cacheSize: 100,
        cacheTTL: 100 // 100ms TTL
      }).getAdapter()
      
      await shortCacheAdapter.create('users', mockUsers[0])
      
      // Read to populate cache
      const result1 = await shortCacheAdapter.findByID('users', 'user-1')
      expect(result1).not.toBeNull()
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Update record directly (bypassing cache)
      await shortCacheAdapter.update('users', 
        { id: 'user-1' }, 
        { name: 'Updated After TTL' }
      )
      
      // Read again - should get fresh data from database
      const result2 = await shortCacheAdapter.findByID('users', 'user-1')
      expect(result2.name).toBe('Updated After TTL')
    })
  })
  
  describe('Cache performance', () => {
    it('should improve read performance significantly', async () => {
      const adapter = helper.getAdapter()
      const users = Array(1000).fill(0).map((_, i) => ({
        id: `perf-user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        status: 'active'
      }))
      
      await helper.seedData('users', users)
      
      // Measure uncached reads
      const uncachedStart = Date.now()
      for (let i = 0; i < 100; i++) {
        await adapter.findByID('users', `perf-user-${i}`)
      }
      const uncachedTime = Date.now() - uncachedStart
      
      // Measure cached reads (same IDs)
      const cachedStart = Date.now()
      for (let i = 0; i < 100; i++) {
        await adapter.findByID('users', `perf-user-${i}`)
      }
      const cachedTime = Date.now() - cachedStart
      
      expect(cachedTime).toBeLessThan(uncachedTime * 0.5) // At least 50% faster
      
      const stats = adapter.getCacheStats()
      expect(stats.hitRate).toBeGreaterThan(0.5) // At least 50% hit rate
    })
  })
})
```

## E2E тесты

### 1. Интеграция с Payload CMS

```typescript
// tests/e2e/payload-integration.test.ts
import { JSONAdapter } from '../../src/index'
import { TestAdapterHelper } from '../helpers/test-adapter'

// Мок Payload CMS интерфейса
interface PayloadCollection {
  slug: string
  fields: any[]
}

interface PayloadRequest {
  collection: PayloadCollection
  data?: any
  where?: any
  sort?: any
  limit?: number
  page?: number
}

class MockPayloadCMS {
  private adapter: JSONAdapter
  
  constructor(adapter: JSONAdapter) {
    this.adapter = adapter
  }
  
  async create(req: PayloadRequest): Promise<any> {
    const { collection, data } = req
    
    // Добавляем метаданные Payload
    const enrichedData = {
      ...data,
      id: data.id || this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    return this.adapter.create(collection.slug, enrichedData)
  }
  
  async find(req: PayloadRequest): Promise<any> {
    const { collection, where, sort, limit, page } = req
    
    const query: any = {}
    
    if (where) query.where = where
    if (sort) query.sort = sort
    if (limit) query.limit = limit
    if (page && limit) query.skip = (page - 1) * limit
    
    const docs = await this.adapter.find(collection.slug, query)
    const totalDocs = await this.adapter.count(collection.slug, { where })
    
    return {
      docs,
      totalDocs,
      limit: limit || totalDocs,
      page: page || 1,
      totalPages: limit ? Math.ceil(totalDocs / limit) : 1,
      hasNextPage: page && limit ? (page * limit) < totalDocs : false,
      hasPrevPage: page ? page > 1 : false
    }
  }
  
  async update(req: PayloadRequest & { id: string, data: any }): Promise<any> {
    const { collection, id, data } = req
    
    const enrichedData = {
      ...data,
      updatedAt: new Date().toISOString()
    }
    
    const [result] = await this.adapter.update(collection.slug, { id }, enrichedData)
    return result
  }
  
  async delete(req: PayloadRequest & { id: string }): Promise<any> {
    const { collection, id } = req
    
    const [result] = await this.adapter.delete(collection.slug, { id })
    return result
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

describe('Payload CMS Integration', () => {
  let helper: TestAdapterHelper
  let payloadCMS: MockPayloadCMS
  
  const usersCollection: PayloadCollection = {
    slug: 'users',
    fields: [
      { name: 'email', type: 'email', required: true },
      { name: 'name', type: 'text', required: true },
      { name: 'role', type: 'select', options: ['admin', 'user'] }
    ]
  }
  
  const postsCollection: PayloadCollection = {
    slug: 'posts',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'richText' },
      { name: 'author', type: 'relationship', relationTo: 'users' },
      { name: 'status', type: 'select', options: ['draft', 'published'] }
    ]
  }
  
  beforeEach(() => {
    helper = new TestAdapterHelper()
    payloadCMS = new MockPayloadCMS(helper.getAdapter())
  })
  
  describe('Collection operations', () => {
    it('should create and retrieve documents', async () => {
      // Create user
      const user = await payloadCMS.create({
        collection: usersCollection,
        data: {
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin'
        }
      })
      
      expect(user.id).toBeDefined()
      expect(user.createdAt).toBeDefined()
      expect(user.updatedAt).toBeDefined()
      
      // Create post
      const post = await payloadCMS.create({
        collection: postsCollection,
        data: {
          title: 'Test Post',
          content: 'This is a test post',
          author: user.id,
          status: 'published'
        }
      })
      
      expect(post.author).toBe(user.id)
      
      // Find posts
      const postsResult = await payloadCMS.find({
        collection: postsCollection,
        where: { status: { equals: 'published' } }
      })
      
      expect(postsResult.docs).toHaveLength(1)
      expect(postsResult.totalDocs).toBe(1)
    })
    
    it('should handle pagination correctly', async () => {
      // Create multiple posts
      const posts = Array(25).fill(0).map((_, i) => ({
        title: `Post ${i + 1}`,
        content: `Content for post ${i + 1}`,
        status: 'published'
      }))
      
      for (const postData of posts) {
        await payloadCMS.create({
          collection: postsCollection,
          data: postData
        })
      }
      
      // Test pagination
      const page1 = await payloadCMS.find({
        collection: postsCollection,
        limit: 10,
        page: 1
      })
      
      expect(page1.docs).toHaveLength(10)
      expect(page1.totalDocs).toBe(25)
      expect(page1.totalPages).toBe(3)
      expect(page1.hasNextPage).toBe(true)
      expect(page1.hasPrevPage).toBe(false)
      
      const page2 = await payloadCMS.find({
        collection: postsCollection,
        limit: 10,
        page: 2
      })
      
      expect(page2.docs).toHaveLength(10)
      expect(page2.hasNextPage).toBe(true)
      expect(page2.hasPrevPage).toBe(true)
      
      const page3 = await payloadCMS.find({
        collection: postsCollection,
        limit: 10,
        page: 3
      })
      
      expect(page3.docs).toHaveLength(5)
      expect(page3.hasNextPage).toBe(false)
      expect(page3.hasPrevPage).toBe(true)
    })
    
    it('should handle relationships', async () => {
      // Create users
      const user1 = await payloadCMS.create({
        collection: usersCollection,
        data: {
          email: 'author1@example.com',
          name: 'Author 1',
          role: 'user'
        }
      })
      
      const user2 = await payloadCMS.create({
        collection: usersCollection,
        data: {
          email: 'author2@example.com',
          name: 'Author 2',
          role: 'user'
        }
      })
      
      // Create posts with relationships
      await payloadCMS.create({
        collection: postsCollection,
        data: {
          title: 'Post by Author 1',
          author: user1.id,
          status: 'published'
        }
      })
      
      await payloadCMS.create({
        collection: postsCollection,
        data: {
          title: 'Post by Author 2',
          author: user2.id,
          status: 'published'
        }
      })
      
      // Find posts by author
      const author1Posts = await payloadCMS.find({
        collection: postsCollection,
        where: { author: { equals: user1.id } }
      })
      
      expect(author1Posts.docs).toHaveLength(1)
      expect(author1Posts.docs[0].title).toBe('Post by Author 1')
    })
  })
  
  describe('Advanced queries', () => {
    beforeEach(async () => {
      // Seed test data
      const users = [
        { email: 'admin@example.com', name: 'Admin User', role: 'admin' },
        { email: 'user1@example.com', name: 'User 1', role: 'user' },
        { email: 'user2@example.com', name: 'User 2', role: 'user' }
      ]
      
      for (const userData of users) {
        await payloadCMS.create({
          collection: usersCollection,
          data: userData
        })
      }
    })
    
    it('should handle complex where conditions', async () => {
      const result = await payloadCMS.find({
        collection: usersCollection,
        where: {
          and: [
            { role: { equals: 'user' } },
            { email: { contains: 'user1' } }
          ]
        }
      })
      
      expect(result.docs).toHaveLength(1)
      expect(result.docs[0].email).toBe('user1@example.com')
    })
    
    it('should handle sorting', async () => {
      const result = await payloadCMS.find({
        collection: usersCollection,
        sort: { name: 'desc' }
      })
      
      expect(result.docs[0].name).toBe('User 2')
      expect(result.docs[2].name).toBe('Admin User')
    })
  })
  
  describe('Error handling', () => {
    it('should handle validation errors', async () => {
      await expect(payloadCMS.create({
        collection: usersCollection,
        data: {
          name: 'Test User'
          // Missing required email field
        }
      })).rejects.toThrow()
    })
    
    it('should handle not found errors', async () => {
      const result = await payloadCMS.update({
        collection: usersCollection,
        id: 'non-existent-id',
        data: { name: 'Updated Name' }
      })
      
      expect(result).toBeUndefined()
    })
  })
})
```

## Тесты производительности

### 1. Нагрузочное тестирование

```typescript
// tests/performance/load-testing.test.ts
import { TestAdapterHelper } from '../helpers/test-adapter'
import { generateMockUsers, generateMockPosts } from '../helpers/mock-data'
import { performance } from 'perf_hooks'

describe('Load Testing', () => {
  let helper: TestAdapterHelper
  
  beforeEach(() => {
    helper = new TestAdapterHelper({
      enableCache: true,
      cacheSize: 10000
    })
  })
  
  describe('High volume operations', () => {
    it('should handle large dataset creation', async () => {
      const adapter = helper.getAdapter()
      const users = generateMockUsers(10000)
      
      const startTime = performance.now()
      
      // Batch create in chunks
      const chunkSize = 100
      for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize)
        const promises = chunk.map(user => adapter.create('users', user))
        await Promise.all(promises)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      console.log(`Created 10,000 users in ${duration.toFixed(2)}ms`)
      console.log(`Average: ${(duration / 10000).toFixed(3)}ms per user`)
      
      // Verify all users were created
      const count = await adapter.count('users', {})
      expect(count).toBe(10000)
      
      // Performance assertion (adjust based on your requirements)
      expect(duration).toBeLessThan(30000) // Should complete in under 30 seconds
    }, 60000) // 60 second timeout
    
    it('should handle concurrent read load', async () => {
      const adapter = helper.getAdapter()
      const users = generateMockUsers(1000)
      
      // Seed data
      await helper.seedData('users', users)
      
      // Simulate concurrent reads
      const concurrentReads = 100
      const readsPerWorker = 50
      
      const startTime = performance.now()
      
      const workers = Array(concurrentReads).fill(0).map(async () => {
        for (let i = 0; i < readsPerWorker; i++) {
          const randomId = `user-${Math.floor(Math.random() * 1000) + 1}`
          await adapter.findByID('users', randomId)
        }
      })
      
      await Promise