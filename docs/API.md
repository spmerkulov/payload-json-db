# API Reference

## JSONAdapter

Основной класс адаптера базы данных для Payload CMS.

### Конструктор

```typescript
const adapter = JSONAdapter(options: JSONAdapterOptions)
```

#### JSONAdapterOptions

```typescript
interface JSONAdapterOptions {
  dataDir: string
  encryption?: EncryptionOptions
  caching?: CachingOptions
  indexing?: IndexingOptions
  performance?: PerformanceOptions
  monitoring?: MonitoringOptions
}
```

### Основные методы

#### create(collection: string, data: any): Promise<any>

Создает новую запись в указанной коллекции.

**Параметры:**
- `collection` - название коллекции
- `data` - данные для создания записи

**Возвращает:** Promise с созданной записью

**Пример:**
```typescript
const post = await adapter.create('posts', {
  title: 'Новый пост',
  content: 'Содержимое поста',
  author: 'user123'
})
```

#### find(collection: string, query: QueryOptions): Promise<PaginatedDocs>

Выполняет поиск записей в коллекции.

**Параметры:**
- `collection` - название коллекции
- `query` - параметры запроса

**Возвращает:** Promise с результатами поиска

**Пример:**
```typescript
const results = await adapter.find('posts', {
  where: {
    status: { equals: 'published' },
    title: { contains: 'JavaScript' }
  },
  limit: 10,
  page: 1,
  sort: '-createdAt'
})
```

#### findByID(collection: string, id: string): Promise<any>

Находит запись по уникальному идентификатору.

**Параметры:**
- `collection` - название коллекции
- `id` - уникальный идентификатор записи

**Возвращает:** Promise с найденной записью или null

**Пример:**
```typescript
const post = await adapter.findByID('posts', '507f1f77bcf86cd799439011')
```

#### update(collection: string, id: string, data: any): Promise<any>

Обновляет существующую запись.

**Параметры:**
- `collection` - название коллекции
- `id` - уникальный идентификатор записи
- `data` - данные для обновления

**Возвращает:** Promise с обновленной записью

**Пример:**
```typescript
const updated = await adapter.update('posts', '507f1f77bcf86cd799439011', {
  title: 'Обновленный заголовок',
  updatedAt: new Date()
})
```

#### delete(collection: string, id: string): Promise<boolean>

Удаляет запись из коллекции.

**Параметры:**
- `collection` - название коллекции
- `id` - уникальный идентификатор записи

**Возвращает:** Promise с результатом операции (true/false)

**Пример:**
```typescript
const deleted = await adapter.delete('posts', '507f1f77bcf86cd799439011')
```

#### count(collection: string, query?: QueryOptions): Promise<number>

Возвращает количество записей в коллекции.

**Параметры:**
- `collection` - название коллекции
- `query` - опциональные параметры фильтрации

**Возвращает:** Promise с количеством записей

**Пример:**
```typescript
const total = await adapter.count('posts')
const published = await adapter.count('posts', {
  where: { status: { equals: 'published' } }
})
```

### Служебные методы

#### getMetrics(): AdapterMetrics

Возвращает метрики производительности адаптера.

**Возвращает:** Объект с метриками

```typescript
interface AdapterMetrics {
  queryTime: {
    average: number
    min: number
    max: number
  }
  cacheHitRate: number
  totalQueries: number
  collectionsCount: number
  dataSize: number
}
```

#### clearCache(): void

Очищает весь кэш адаптера.

**Пример:**
```typescript
adapter.clearCache()
```

#### backup(destination: string): Promise<void>

Создает резервную копию всех данных.

**Параметры:**
- `destination` - путь для сохранения резервной копии

**Пример:**
```typescript
await adapter.backup('./backups/backup-2024-01-15')
```

#### restore(source: string): Promise<void>

Восстанавливает данные из резервной копии.

**Параметры:**
- `source` - путь к резервной копии

**Пример:**
```typescript
await adapter.restore('./backups/backup-2024-01-15')
```

## QueryOptions

Интерфейс для параметров запросов.

```typescript
interface QueryOptions {
  where?: WhereCondition
  limit?: number
  page?: number
  sort?: string | string[]
  select?: string[]
  populate?: PopulateOptions[]
}
```

### WhereCondition

Условия для фильтрации данных.

```typescript
interface WhereCondition {
  [field: string]: {
    equals?: any
    not_equals?: any
    greater_than?: number | Date
    greater_than_equal?: number | Date
    less_than?: number | Date
    less_than_equal?: number | Date
    like?: string
    contains?: string
    in?: any[]
    not_in?: any[]
    exists?: boolean
  } | WhereCondition
  and?: WhereCondition[]
  or?: WhereCondition[]
}
```

**Примеры использования:**

```typescript
// Простое условие
where: {
  status: { equals: 'published' }
}

// Множественные условия
where: {
  status: { equals: 'published' },
  createdAt: { greater_than: new Date('2024-01-01') }
}

// Логические операторы
where: {
  and: [
    { status: { equals: 'published' } },
    { 
      or: [
        { title: { contains: 'JavaScript' } },
        { tags: { in: ['js', 'react'] } }
      ]
    }
  ]
}
```

## FileManager

Класс для управления файловой системой.

### Методы

#### readCollection(name: string): Promise<any[]>

Читает данные коллекции из JSON файла.

#### writeCollection(name: string, data: any[]): Promise<void>

Записывает данные коллекции в JSON файл.

#### ensureDirectory(path: string): Promise<void>

Создает директорию, если она не существует.

#### getCollectionPath(name: string): string

Возвращает полный путь к файлу коллекции.

#### exists(path: string): Promise<boolean>

Проверяет существование файла или директории.

#### backup(source: string, destination: string): Promise<void>

Создает резервную копию файла или директории.

## MemoryCache

Класс для управления кэшем в памяти.

### Методы

#### get(key: string): any

Получает значение из кэша по ключу.

#### set(key: string, value: any, ttl?: number): void

Устанавливает значение в кэш с опциональным TTL.

#### delete(key: string): boolean

Удаляет значение из кэша по ключу.

#### clear(): void

Очищает весь кэш.

#### size(): number

Возвращает количество элементов в кэше.

#### keys(): string[]

Возвращает массив всех ключей в кэше.

#### has(key: string): boolean

Проверяет наличие ключа в кэше.

#### getStats(): CacheStats

Возвращает статистику использования кэша.

```typescript
interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  size: number
  maxSize: number
}
```

## Encryption

Модуль для шифрования данных.

### encrypt(data: string, key: string): string

Шифрует строку данных.

**Параметры:**
- `data` - данные для шифрования
- `key` - ключ шифрования (32 символа)

**Возвращает:** Зашифрованная строка

### decrypt(encryptedData: string, key: string): string

Расшифровывает данные.

**Параметры:**
- `encryptedData` - зашифрованные данные
- `key` - ключ шифрования

**Возвращает:** Расшифрованная строка

### generateKey(): string

Генерирует случайный ключ шифрования.

**Возвращает:** 32-символьный ключ

## Validation

Модуль для валидации данных.

### validateConfig(config: JSONAdapterOptions): ValidationResult

Валидирует конфигурацию адаптера.

### validateQuery(query: QueryOptions): ValidationResult

Валидирует параметры запроса.

### validateDocument(doc: any, schema?: any): ValidationResult

Валидирует документ по схеме.

```typescript
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

interface ValidationError {
  field: string
  message: string
  code: string
}
```

## События

Адаптер поддерживает систему событий для мониторинга операций.

### События адаптера

- `beforeCreate` - перед созданием записи
- `afterCreate` - после создания записи
- `beforeUpdate` - перед обновлением записи
- `afterUpdate` - после обновления записи
- `beforeDelete` - перед удалением записи
- `afterDelete` - после удаления записи
- `beforeFind` - перед поиском записей
- `afterFind` - после поиска записей

### Подписка на события

```typescript
adapter.on('afterCreate', (collection: string, doc: any) => {
  console.log(`Created document in ${collection}:`, doc.id)
})

adapter.on('beforeDelete', (collection: string, id: string) => {
  console.log(`Deleting document ${id} from ${collection}`)
})
```

## Ошибки

Адаптер использует специальные классы ошибок для различных ситуаций.

### JSONAdapterError

Базовый класс для всех ошибок адаптера.

### CollectionNotFoundError

Возникает при обращении к несуществующей коллекции.

### DocumentNotFoundError

Возникает при попытке найти несуществующий документ.

### ValidationError

Возникает при ошибках валидации данных.

### EncryptionError

Возникает при ошибках шифрования/расшифровки.

### FileSystemError

Возникает при ошибках файловой системы.

**Пример обработки ошибок:**

```typescript
try {
  const post = await adapter.findByID('posts', 'invalid-id')
} catch (error) {
  if (error instanceof DocumentNotFoundError) {
    console.log('Документ не найден')
  } else if (error instanceof JSONAdapterError) {
    console.log('Ошибка адаптера:', error.message)
  } else {
    console.log('Неизвестная ошибка:', error)
  }
}
```