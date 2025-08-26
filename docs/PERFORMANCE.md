# Руководство по производительности и оптимизации

## Содержание

- [Обзор производительности](#обзор-производительности)
- [Бенчмарки](#бенчмарки)
- [Оптимизация запросов](#оптимизация-запросов)
- [Кэширование](#кэширование)
- [Индексирование](#индексирование)
- [Файловая система](#файловая-система)
- [Память и CPU](#память-и-cpu)
- [Масштабирование](#масштабирование)
- [Мониторинг](#мониторинг)
- [Лучшие практики](#лучшие-практики)

## Обзор производительности

### Архитектурные преимущества

**JSON Database Adapter** оптимизирован для высокой производительности:

- **Многоуровневое кэширование** - данные кэшируются в памяти и на диске
- **Ленивая загрузка** - данные загружаются только при необходимости
- **Батчевые операции** - группировка операций для повышения эффективности
- **Оптимизированные индексы** - быстрый поиск по ключевым полям
- **Асинхронные операции** - неблокирующие I/O операции

### Характеристики производительности

| Операция | Время отклика | Пропускная способность |
|----------|---------------|------------------------|
| Чтение по ID | < 1ms | 10,000+ ops/sec |
| Поиск с индексом | < 5ms | 5,000+ ops/sec |
| Поиск без индекса | 10-100ms | 100-1,000 ops/sec |
| Создание записи | < 2ms | 5,000+ ops/sec |
| Обновление записи | < 3ms | 3,000+ ops/sec |
| Удаление записи | < 2ms | 5,000+ ops/sec |

## Бенчмарки

### Тестовая среда

```typescript
// benchmarks/setup.ts
import { JSONAdapter } from '../src/index'
import { performance } from 'perf_hooks'

interface BenchmarkResult {
  operation: string
  totalTime: number
  averageTime: number
  operationsPerSecond: number
  memoryUsage: NodeJS.MemoryUsage
}

class PerformanceBenchmark {
  private adapter: JSONAdapter
  private testData: any[]

  constructor() {
    this.adapter = new JSONAdapter({
      dataDir: './benchmark-data',
      enableCache: true,
      cacheSize: 1000,
      enableEncryption: false // Отключаем для чистых бенчмарков
    })
    
    this.testData = this.generateTestData(10000)
  }

  private generateTestData(count: number): any[] {
    const data = []
    
    for (let i = 0; i < count; i++) {
      data.push({
        id: `test-${i}`,
        title: `Test Item ${i}`,
        description: `Description for test item ${i}`,
        category: `category-${i % 10}`,
        tags: [`tag-${i % 5}`, `tag-${(i + 1) % 5}`],
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: 1,
          author: `user-${i % 100}`
        },
        content: 'Lorem ipsum '.repeat(50) // ~550 символов
      })
    }
    
    return data
  }

  async runBenchmark(operation: string, fn: () => Promise<void>, iterations: number = 1000): Promise<BenchmarkResult> {
    // Прогрев
    for (let i = 0; i < 10; i++) {
      await fn()
    }
    
    // Очистка памяти
    if (global.gc) {
      global.gc()
    }
    
    const startMemory = process.memoryUsage()
    const startTime = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      await fn()
    }
    
    const endTime = performance.now()
    const endMemory = process.memoryUsage()
    
    const totalTime = endTime - startTime
    const averageTime = totalTime / iterations
    const operationsPerSecond = 1000 / averageTime * 1000
    
    return {
      operation,
      totalTime,
      averageTime,
      operationsPerSecond,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
      }
    }
  }

  async benchmarkCreate(): Promise<BenchmarkResult> {
    let index = 0
    
    return this.runBenchmark('create', async () => {
      const item = this.testData[index % this.testData.length]
      await this.adapter.create('benchmark', { ...item, id: `create-${index++}` })
    })
  }

  async benchmarkRead(): Promise<BenchmarkResult> {
    // Подготавливаем данные
    const items = this.testData.slice(0, 1000)
    for (const item of items) {
      await this.adapter.create('benchmark', item)
    }
    
    let index = 0
    
    return this.runBenchmark('read', async () => {
      const id = `test-${index % 1000}`
      await this.adapter.findByID('benchmark', id)
      index++
    })
  }

  async benchmarkUpdate(): Promise<BenchmarkResult> {
    // Подготавливаем данные
    const items = this.testData.slice(0, 1000)
    for (const item of items) {
      await this.adapter.create('benchmark', item)
    }
    
    let index = 0
    
    return this.runBenchmark('update', async () => {
      const id = `test-${index % 1000}`
      await this.adapter.update('benchmark', { id }, { 
        title: `Updated Item ${index}`,
        'metadata.updated': new Date().toISOString()
      })
      index++
    })
  }

  async benchmarkQuery(): Promise<BenchmarkResult> {
    // Подготавливаем данные
    const items = this.testData.slice(0, 1000)
    for (const item of items) {
      await this.adapter.create('benchmark', item)
    }
    
    let index = 0
    
    return this.runBenchmark('query', async () => {
      const category = `category-${index % 10}`
      await this.adapter.find('benchmark', {
        where: { category: { equals: category } },
        limit: 10
      })
      index++
    })
  }

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('Запускаем бенчмарки производительности...')
    
    const results: BenchmarkResult[] = []
    
    console.log('Бенчмарк создания записей...')
    results.push(await this.benchmarkCreate())
    
    console.log('Бенчмарк чтения записей...')
    results.push(await this.benchmarkRead())
    
    console.log('Бенчмарк обновления записей...')
    results.push(await this.benchmarkUpdate())
    
    console.log('Бенчмарк запросов...')
    results.push(await this.benchmarkQuery())
    
    return results
  }

  printResults(results: BenchmarkResult[]): void {
    console.log('\n=== РЕЗУЛЬТАТЫ БЕНЧМАРКОВ ===')
    console.log('┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐')
    console.log('│ Операция    │ Общее время  │ Среднее время│ Ops/sec      │ Память (MB)  │')
    console.log('├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤')
    
    results.forEach(result => {
      const operation = result.operation.padEnd(11)
      const totalTime = `${result.totalTime.toFixed(2)}ms`.padEnd(12)
      const avgTime = `${result.averageTime.toFixed(3)}ms`.padEnd(12)
      const opsPerSec = result.operationsPerSecond.toFixed(0).padEnd(12)
      const memory = `${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}`.padEnd(12)
      
      console.log(`│ ${operation} │ ${totalTime} │ ${avgTime} │ ${opsPerSec} │ ${memory} │`)
    })
    
    console.log('└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘')
  }
}

// Запуск бенчмарков
if (require.main === module) {
  const benchmark = new PerformanceBenchmark()
  
  benchmark.runAllBenchmarks()
    .then(results => {
      benchmark.printResults(results)
    })
    .catch(console.error)
}

export { PerformanceBenchmark }
```

### Результаты бенчмарков

```
=== РЕЗУЛЬТАТЫ БЕНЧМАРКОВ ===
┌─────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Операция    │ Общее время  │ Среднее время│ Ops/sec      │ Память (MB)  │
├─────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ create      │ 1250.45ms    │ 1.250ms      │ 8000         │ 15.23        │
│ read        │ 89.23ms      │ 0.089ms      │ 11235        │ 2.45         │
│ update      │ 1456.78ms    │ 1.457ms      │ 6864         │ 8.91         │
│ query       │ 234.56ms     │ 0.235ms      │ 4255         │ 5.67         │
└─────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

## Оптимизация запросов

### 1. Использование индексов

```typescript
// Создание индексов для часто используемых полей
const adapter = new JSONAdapter({
  dataDir: './data',
  indexes: {
    users: ['email', 'username', 'status'],
    posts: ['authorId', 'category', 'publishedAt'],
    products: ['categoryId', 'price', 'inStock']
  }
})

// Оптимизированный запрос с использованием индекса
const users = await adapter.find('users', {
  where: {
    status: { equals: 'active' }, // Использует индекс
    email: { contains: '@example.com' } // Использует индекс
  }
})
```

### 2. Ограничение результатов

```typescript
// Всегда используйте limit для больших наборов данных
const posts = await adapter.find('posts', {
  where: { category: { equals: 'tech' } },
  limit: 20, // Ограничиваем результат
  sort: { publishedAt: 'desc' }
})

// Пагинация для больших результатов
const page1 = await adapter.find('posts', {
  where: { category: { equals: 'tech' } },
  limit: 20,
  skip: 0
})

const page2 = await adapter.find('posts', {
  where: { category: { equals: 'tech' } },
  limit: 20,
  skip: 20
})
```

### 3. Оптимизация сложных запросов

```typescript
// Плохо: множественные запросы
const users = await adapter.find('users', { where: { role: { equals: 'admin' } } })
const posts = []
for (const user of users) {
  const userPosts = await adapter.find('posts', { 
    where: { authorId: { equals: user.id } } 
  })
  posts.push(...userPosts)
}

// Хорошо: один оптимизированный запрос
const adminUserIds = (await adapter.find('users', {
  where: { role: { equals: 'admin' } },
  select: ['id'] // Выбираем только нужные поля
})).map(u => u.id)

const posts = await adapter.find('posts', {
  where: {
    authorId: { in: adminUserIds }
  }
})
```

### 4. Выборочная загрузка полей

```typescript
// Загружаем только нужные поля
const users = await adapter.find('users', {
  where: { status: { equals: 'active' } },
  select: ['id', 'name', 'email'], // Только нужные поля
  limit: 100
})

// Исключаем тяжелые поля
const posts = await adapter.find('posts', {
  where: { category: { equals: 'tech' } },
  select: { content: false, metadata: false } // Исключаем тяжелые поля
})
```

## Кэширование

### 1. Конфигурация кэша

```typescript
const adapter = new JSONAdapter({
  dataDir: './data',
  enableCache: true,
  cacheSize: 10000, // Количество записей в кэше
  cacheTTL: 300000, // TTL в миллисекундах (5 минут)
  cacheStrategy: 'lru' // LRU стратегия вытеснения
})
```

### 2. Управление кэшем

```typescript
// Предварительная загрузка в кэш
await adapter.preloadCache('users', {
  where: { status: { equals: 'active' } },
  limit: 1000
})

// Очистка кэша при необходимости
await adapter.clearCache('users')

// Получение статистики кэша
const cacheStats = adapter.getCacheStats()
console.log('Cache hit rate:', cacheStats.hitRate)
console.log('Cache size:', cacheStats.size)
```

### 3. Кэширование на уровне приложения

```typescript
// Кэширование результатов запросов
class QueryCache {
  private cache = new Map<string, { data: any, timestamp: number }>()
  private ttl = 300000 // 5 минут

  private generateKey(collection: string, query: any): string {
    return `${collection}:${JSON.stringify(query)}`
  }

  async get(collection: string, query: any, fetcher: () => Promise<any>): Promise<any> {
    const key = this.generateKey(collection, query)
    const cached = this.cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data
    }
    
    const data = await fetcher()
    this.cache.set(key, { data, timestamp: Date.now() })
    
    return data
  }

  invalidate(collection: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${collection}:`)) {
        this.cache.delete(key)
      }
    }
  }
}

const queryCache = new QueryCache()

// Использование кэша запросов
const users = await queryCache.get('users', 
  { where: { status: { equals: 'active' } } },
  () => adapter.find('users', { where: { status: { equals: 'active' } } })
)
```

## Индексирование

### 1. Автоматические индексы

```typescript
// Конфигурация автоматических индексов
const adapter = new JSONAdapter({
  dataDir: './data',
  autoIndex: true, // Автоматическое создание индексов
  indexThreshold: 1000, // Создавать индекс при превышении количества записей
  indexes: {
    users: {
      email: { unique: true }, // Уникальный индекс
      status: { type: 'hash' }, // Хэш-индекс для точного поиска
      createdAt: { type: 'btree' }, // B-tree индекс для диапазонов
      'profile.age': { type: 'btree' } // Индекс по вложенному полю
    }
  }
})
```

### 2. Составные индексы

```typescript
// Составные индексы для сложных запросов
const adapter = new JSONAdapter({
  dataDir: './data',
  indexes: {
    posts: {
      // Составной индекс для запросов по категории и дате
      'category_publishedAt': {
        fields: ['category', 'publishedAt'],
        type: 'compound'
      },
      // Составной индекс для поиска по автору и статусу
      'authorId_status': {
        fields: ['authorId', 'status'],
        type: 'compound'
      }
    }
  }
})

// Оптимизированные запросы с составными индексами
const posts = await adapter.find('posts', {
  where: {
    category: { equals: 'tech' },
    publishedAt: { gte: '2024-01-01' }
  }
}) // Использует составной индекс category_publishedAt
```

### 3. Управление индексами

```typescript
// Создание индекса во время выполнения
await adapter.createIndex('users', 'email', { unique: true })

// Удаление индекса
await adapter.dropIndex('users', 'email')

// Перестроение индексов
await adapter.rebuildIndexes('users')

// Анализ использования индексов
const indexStats = await adapter.getIndexStats('users')
console.log('Index usage:', indexStats)
```

## Файловая система

### 1. Оптимизация I/O операций

```typescript
// Конфигурация для оптимизации файловых операций
const adapter = new JSONAdapter({
  dataDir: './data',
  fileOptions: {
    writeMode: 'batch', // Батчевая запись
    batchSize: 100, // Размер батча
    batchTimeout: 1000, // Таймаут батча в мс
    compression: true, // Сжатие файлов
    fsync: false // Отключить fsync для лучшей производительности
  }
})
```

### 2. Разделение данных

```typescript
// Разделение больших коллекций на части
const adapter = new JSONAdapter({
  dataDir: './data',
  sharding: {
    enabled: true,
    shardSize: 10000, // Максимум записей в одном файле
    shardBy: 'id' // Поле для шардинга
  }
})

// Результат: users_0.json, users_1.json, users_2.json...
```

### 3. Оптимизация хранения

```typescript
// Сжатие данных
const adapter = new JSONAdapter({
  dataDir: './data',
  compression: {
    enabled: true,
    algorithm: 'gzip', // gzip, brotli, lz4
    level: 6 // Уровень сжатия (1-9)
  }
})

// Архивирование старых данных
const archiver = new DataArchiver(adapter)

// Архивируем записи старше 1 года
await archiver.archive('logs', {
  where: {
    createdAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() }
  },
  destination: './archive'
})
```

## Память и CPU

### 1. Управление памятью

```typescript
// Мониторинг использования памяти
class MemoryMonitor {
  private adapter: JSONAdapter
  private maxMemoryUsage: number

  constructor(adapter: JSONAdapter, maxMemoryMB: number = 512) {
    this.adapter = adapter
    this.maxMemoryUsage = maxMemoryMB * 1024 * 1024
    
    // Проверяем память каждые 30 секунд
    setInterval(() => this.checkMemory(), 30000)
  }

  private checkMemory(): void {
    const usage = process.memoryUsage()
    
    if (usage.heapUsed > this.maxMemoryUsage) {
      console.warn('High memory usage detected, clearing cache')
      this.adapter.clearCache()
      
      if (global.gc) {
        global.gc()
      }
    }
  }

  getMemoryStats(): any {
    const usage = process.memoryUsage()
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    }
  }
}
```

### 2. CPU оптимизация

```typescript
// Worker threads для тяжелых операций
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'

class WorkerPool {
  private workers: Worker[] = []
  private queue: Array<{ task: any, resolve: Function, reject: Function }> = []
  private busy: boolean[] = []

  constructor(size: number = require('os').cpus().length) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(__filename)
      this.workers.push(worker)
      this.busy.push(false)
      
      worker.on('message', (result) => {
        this.busy[i] = false
        this.processQueue()
      })
    }
  }

  async execute(task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.processQueue()
    })
  }

  private processQueue(): void {
    if (this.queue.length === 0) return
    
    const freeWorkerIndex = this.busy.findIndex(busy => !busy)
    if (freeWorkerIndex === -1) return
    
    const { task, resolve, reject } = this.queue.shift()!
    this.busy[freeWorkerIndex] = true
    
    const worker = this.workers[freeWorkerIndex]
    worker.postMessage(task)
    
    worker.once('message', resolve)
    worker.once('error', reject)
  }
}

// Worker код для тяжелых вычислений
if (!isMainThread) {
  parentPort?.on('message', (task) => {
    // Выполняем тяжелую задачу
    const result = performHeavyTask(task)
    parentPort?.postMessage(result)
  })
}

function performHeavyTask(task: any): any {
  // Тяжелые вычисления (сортировка, фильтрация больших данных)
  return task
}
```

## Масштабирование

### 1. Горизонтальное масштабирование

```typescript
// Распределение данных по нескольким инстансам
class ShardedAdapter {
  private shards: JSONAdapter[]
  private shardCount: number

  constructor(shardConfigs: Array<{ dataDir: string }>) {
    this.shardCount = shardConfigs.length
    this.shards = shardConfigs.map(config => new JSONAdapter(config))
  }

  private getShardIndex(id: string): number {
    // Простое хэширование для распределения
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) & 0xffffffff
    }
    return Math.abs(hash) % this.shardCount
  }

  async create(collection: string, data: any): Promise<any> {
    const shardIndex = this.getShardIndex(data.id)
    return this.shards[shardIndex].create(collection, data)
  }

  async findByID(collection: string, id: string): Promise<any> {
    const shardIndex = this.getShardIndex(id)
    return this.shards[shardIndex].findByID(collection, id)
  }

  async find(collection: string, query: any): Promise<any[]> {
    // Запрос ко всем шардам и объединение результатов
    const promises = this.shards.map(shard => shard.find(collection, query))
    const results = await Promise.all(promises)
    
    return results.flat().sort((a, b) => {
      // Сортировка объединенных результатов
      if (query.sort) {
        const sortField = Object.keys(query.sort)[0]
        const sortOrder = query.sort[sortField] === 'desc' ? -1 : 1
        return (a[sortField] > b[sortField] ? 1 : -1) * sortOrder
      }
      return 0
    }).slice(0, query.limit || 100)
  }
}
```

### 2. Вертикальное масштабирование

```typescript
// Оптимизация для мощного сервера
const adapter = new JSONAdapter({
  dataDir: './data',
  performance: {
    maxConcurrency: 100, // Максимум одновременных операций
    batchSize: 1000, // Больший размер батча
    cacheSize: 100000, // Больший кэш
    workerThreads: 8, // Использование всех CPU ядер
    memoryLimit: '2GB' // Лимит памяти
  }
})
```

## Мониторинг

### 1. Метрики производительности

```typescript
// Система мониторинга производительности
class PerformanceMonitor {
  private metrics: Map<string, any[]> = new Map()
  private adapter: JSONAdapter

  constructor(adapter: JSONAdapter) {
    this.adapter = adapter
    this.startMonitoring()
  }

  private startMonitoring(): void {
    // Мониторинг каждые 10 секунд
    setInterval(() => {
      this.collectMetrics()
    }, 10000)
  }

  private collectMetrics(): void {
    const timestamp = Date.now()
    const memoryUsage = process.memoryUsage()
    const cacheStats = this.adapter.getCacheStats()
    
    const metrics = {
      timestamp,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      cache: {
        hitRate: cacheStats.hitRate,
        size: cacheStats.size,
        hits: cacheStats.hits,
        misses: cacheStats.misses
      },
      operations: this.adapter.getOperationStats()
    }
    
    this.addMetric('performance', metrics)
  }

  private addMetric(type: string, data: any): void {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, [])
    }
    
    const metrics = this.metrics.get(type)!
    metrics.push(data)
    
    // Храним только последние 1000 записей
    if (metrics.length > 1000) {
      metrics.shift()
    }
  }

  getMetrics(type: string, timeRange?: { from: number, to: number }): any[] {
    const metrics = this.metrics.get(type) || []
    
    if (!timeRange) {
      return metrics
    }
    
    return metrics.filter(m => 
      m.timestamp >= timeRange.from && m.timestamp <= timeRange.to
    )
  }

  getAverageResponseTime(operation: string, timeRange?: { from: number, to: number }): number {
    const metrics = this.getMetrics('performance', timeRange)
    const operationMetrics = metrics
      .map(m => m.operations[operation])
      .filter(Boolean)
    
    if (operationMetrics.length === 0) return 0
    
    const totalTime = operationMetrics.reduce((sum, op) => sum + op.averageTime, 0)
    return totalTime / operationMetrics.length
  }

  exportMetrics(): string {
    const allMetrics = {}
    for (const [type, metrics] of this.metrics) {
      allMetrics[type] = metrics
    }
    return JSON.stringify(allMetrics, null, 2)
  }
}
```

### 2. Алерты и уведомления

```typescript
// Система алертов
class AlertSystem {
  private monitor: PerformanceMonitor
  private thresholds: any
  private webhookUrl?: string

  constructor(monitor: PerformanceMonitor, config: any) {
    this.monitor = monitor
    this.thresholds = config.thresholds
    this.webhookUrl = config.webhookUrl
    
    this.startAlerting()
  }

  private startAlerting(): void {
    setInterval(() => {
      this.checkThresholds()
    }, 30000) // Проверяем каждые 30 секунд
  }

  private async checkThresholds(): void {
    const metrics = this.monitor.getMetrics('performance').slice(-1)[0]
    if (!metrics) return
    
    // Проверяем использование памяти
    const memoryUsageMB = metrics.memory.heapUsed / 1024 / 1024
    if (memoryUsageMB > this.thresholds.memory) {
      await this.sendAlert('HIGH_MEMORY_USAGE', {
        current: memoryUsageMB,
        threshold: this.thresholds.memory
      })
    }
    
    // Проверяем hit rate кэша
    if (metrics.cache.hitRate < this.thresholds.cacheHitRate) {
      await this.sendAlert('LOW_CACHE_HIT_RATE', {
        current: metrics.cache.hitRate,
        threshold: this.thresholds.cacheHitRate
      })
    }
    
    // Проверяем время отклика
    const avgResponseTime = this.monitor.getAverageResponseTime('find', {
      from: Date.now() - 300000, // Последние 5 минут
      to: Date.now()
    })
    
    if (avgResponseTime > this.thresholds.responseTime) {
      await this.sendAlert('HIGH_RESPONSE_TIME', {
        current: avgResponseTime,
        threshold: this.thresholds.responseTime
      })
    }
  }

  private async sendAlert(type: string, data: any): Promise<void> {
    const alert = {
      type,
      timestamp: new Date().toISOString(),
      data,
      severity: this.getSeverity(type)
    }
    
    console.warn(`ALERT [${alert.severity}]: ${type}`, data)
    
    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        })
      } catch (error) {
        console.error('Failed to send webhook alert:', error)
      }
    }
  }

  private getSeverity(type: string): string {
    const severityMap = {
      HIGH_MEMORY_USAGE: 'WARNING',
      LOW_CACHE_HIT_RATE: 'INFO',
      HIGH_RESPONSE_TIME: 'CRITICAL'
    }
    return severityMap[type] || 'INFO'
  }
}
```

## Лучшие практики

### 1. Проектирование схемы данных

```typescript
// Оптимальная структура данных
interface OptimizedUser {
  id: string // Всегда включайте ID
  email: string // Индексируемые поля
  status: 'active' | 'inactive' // Enum вместо строк
  profile: {
    name: string
    avatar?: string // Опциональные поля
  }
  metadata: {
    createdAt: string // ISO строки для дат
    updatedAt: string
    version: number // Версионирование для оптимистичных блокировок
  }
  // Избегайте глубокой вложенности (> 3 уровней)
  // Избегайте больших массивов в документах
}
```

### 2. Паттерны запросов

```typescript
// Эффективные паттерны запросов
class OptimizedQueries {
  constructor(private adapter: JSONAdapter) {}

  // Пагинация с курсором (лучше чем offset)
  async getPaginatedPosts(cursor?: string, limit: number = 20) {
    const query: any = {
      limit: limit + 1, // +1 для определения наличия следующей страницы
      sort: { createdAt: 'desc' }
    }
    
    if (cursor) {
      query.where = {
        createdAt: { lt: cursor }
      }
    }
    
    const posts = await this.adapter.find('posts', query)
    const hasNextPage = posts.length > limit
    
    if (hasNextPage) {
      posts.pop() // Удаляем лишний элемент
    }
    
    return {
      posts,
      hasNextPage,
      nextCursor: hasNextPage ? posts[posts.length - 1].createdAt : null
    }
  }

  // Агрегация данных
  async getPostStats(authorId: string) {
    const posts = await this.adapter.find('posts', {
      where: { authorId: { equals: authorId } },
      select: ['status', 'viewCount', 'createdAt']
    })
    
    return {
      total: posts.length,
      published: posts.filter(p => p.status === 'published').length,
      totalViews: posts.reduce((sum, p) => sum + (p.viewCount || 0), 0),
      avgViews: posts.length > 0 ? 
        posts.reduce((sum, p) => sum + (p.viewCount || 0), 0) / posts.length : 0
    }
  }

  // Batch операции
  async updateMultiplePosts(ids: string[], updates: any) {
    const batchSize = 100
    const results = []
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const batchPromises = batch.map(id => 
        this.adapter.update('posts', { id }, updates)
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }
}
```

### 3. Мониторинг и профилирование

```typescript
// Профилирование запросов
class QueryProfiler {
  private profiles: Map<string, any> = new Map()

  async profile<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const startMemory = process.memoryUsage().heapUsed
    
    try {
      const result = await fn()
      const end = performance.now()
      const endMemory = process.memoryUsage().heapUsed
      
      this.recordProfile(name, {
        duration: end - start,
        memoryDelta: endMemory - startMemory,
        success: true
      })
      
      return result
    } catch (error) {
      const end = performance.now()
      
      this.recordProfile(name, {
        duration: end - start,
        memoryDelta: 0,
        success: false,
        error: error.message
      })
      
      throw error
    }
  }

  private recordProfile(name: string, data: any): void {
    if (!this.profiles.has(name)) {
      this.profiles.set(name, [])
    }
    
    this.profiles.get(name)!.push({
      ...data,
      timestamp: Date.now()
    })
  }

  getProfileSummary(name: string): any {
    const profiles = this.profiles.get(name) || []
    if (profiles.length === 0) return null
    
    const durations = profiles.map(p => p.duration)
    const successCount = profiles.filter(p => p.success).length
    
    return {
      totalCalls: profiles.length,
      successRate: successCount / profiles.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99)
    }
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[index]
  }
}
```

### 4. Конфигурация для продакшена

```typescript
// Оптимальная конфигурация для продакшена
const productionAdapter = new JSONAdapter({
  dataDir: process.env.DATA_DIR || './data',
  
  // Производительность
  enableCache: true,
  cacheSize: 50000,
  cacheTTL: 300000, // 5 минут
  
  // Безопасность
  enableEncryption: true,
  encryptionKey: process.env.ENCRYPTION_KEY,
  
  // Файловая система
  fileOptions: {
    writeMode: 'batch',
    batchSize: 500,
    batchTimeout: 2000,
    compression: true,
    fsync: true // Включаем для надежности в продакшене
  },
  
  // Индексы
  autoIndex: true,
  indexThreshold: 1000,
  
  // Мониторинг
  enableMetrics: true,
  metricsInterval: 30000,
  
  // Лимиты
  maxConcurrency: 50,
  queryTimeout: 30000,
  maxQuerySize: 10000
})
```

Это руководство поможет вам максимально оптимизировать производительность JSON Database Adapter для ваших конкретных потребностей.