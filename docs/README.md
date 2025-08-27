#  JSON Database Adapter - Документация

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Установка](#установка)
- [Конфигурация](#конфигурация)
- [API Reference](#api-reference)
- [Примеры использования](#примеры-использования)
- [Производительность](#производительность)
- [Безопасность](#безопасность)
- [Развертывание](#развертывание)
- [Troubleshooting](#troubleshooting)

## Быстрый старт

### Автоматическая установка

```bash
npx create-payload-json-app my-project
cd my-project
npm run dev
```

### Ручная установка

```bash
npm install payload-db-json
```

```typescript
// payload.config.ts
import { buildConfig } from 'payload/config'
import { JSONAdapter } from 'payload-db-json'

export default buildConfig({
  db: JSONAdapter({
    dataDir: './data',
    encryption: {
      enabled: true,
      key: process.env.ENCRYPTION_KEY
    },
    caching: {
      enabled: true,
      ttl: 300000 // 5 минут
    }
  }),
  // остальная конфигурация...
})
```

## Установка

### Системные требования

- Node.js >= 16.0.0
- npm >= 7.0.0 или yarn >= 1.22.0
- Payload CMS >= 2.0.0 (поддерживается 3.x)
- Next.js >= 13.0.0 (рекомендуется 15.x)

### Установка пакета

```bash
# NPM
npm install payload-db-json

# Yarn
yarn add payload-db-json

# PNPM
pnpm add payload-db-json
```

## Конфигурация

### Базовая конфигурация

```typescript
import { JSONAdapter } from 'payload-db-json'

const adapter = JSONAdapter({
  dataDir: './data', // Папка для хранения данных
})
```

### Полная конфигурация

```typescript
const adapter = JSONAdapter({
  // Основные настройки
  dataDir: './data',
  
  // Шифрование
  encryption: {
    enabled: true,
    key: process.env.ENCRYPTION_KEY, // 32-символьный ключ
    algorithm: 'aes-256-gcm'
  },
  
  // Кэширование
  caching: {
    enabled: true,
    ttl: 300000, // TTL в миллисекундах
    maxSize: 1000, // Максимальное количество записей в кэше
    strategy: 'lru' // Стратегия вытеснения
  },
  
  // Индексирование
  indexing: {
    enabled: true,
    fields: ['id', 'slug', 'email'], // Поля для индексирования
    caseSensitive: false
  },
  
  // Производительность
  performance: {
    batchSize: 100, // Размер пакета для операций
    autoSave: true, // Автосохранение
    saveInterval: 5000, // Интервал автосохранения (мс)
    compression: true // Сжатие файлов
  },
  
  // Мониторинг
  monitoring: {
    enabled: true,
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
    metricsCollection: true
  }
})
```

## API Reference

### JSONAdapter

Основной класс адаптера для интеграции с Payload CMS.

#### Методы

##### `create(collection: string, data: any): Promise<any>`
Создает новую запись в коллекции.

```typescript
const result = await adapter.create('posts', {
  title: 'Новый пост',
  content: 'Содержимое поста',
  status: 'published'
})
```

##### `find(collection: string, query: QueryOptions): Promise<any[]>`
Ищет записи в коллекции по заданным критериям.

```typescript
const posts = await adapter.find('posts', {
  where: {
    status: { equals: 'published' }
  },
  limit: 10,
  sort: '-createdAt'
})
```

##### `findByID(collection: string, id: string): Promise<any>`
Находит запись по ID.

```typescript
const post = await adapter.findByID('posts', '123')
```

##### `update(collection: string, id: string, data: any): Promise<any>`
Обновляет существующую запись.

```typescript
const updated = await adapter.update('posts', '123', {
  title: 'Обновленный заголовок'
})
```

##### `delete(collection: string, id: string): Promise<boolean>`
Удаляет запись по ID.

```typescript
const deleted = await adapter.delete('posts', '123')
```

### FileManager

Класс для управления файловой системой.

#### Методы

##### `readCollection(name: string): Promise<any[]>`
Читает данные коллекции из файла.

##### `writeCollection(name: string, data: any[]): Promise<void>`
Записывает данные коллекции в файл.

##### `ensureDirectory(path: string): Promise<void>`
Создает директорию, если она не существует.

### MemoryCache

Класс для управления кэшем в памяти.

#### Методы

##### `get(key: string): any`
Получает значение из кэша.

##### `set(key: string, value: any, ttl?: number): void`
Устанавливает значение в кэш.

##### `delete(key: string): boolean`
Удаляет значение из кэша.

##### `clear(): void`
Очищает весь кэш.

## Примеры использования

### Базовый блог

```typescript
// collections/Posts.ts
import { CollectionConfig } from 'payload/types'

const Posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Черновик', value: 'draft' },
        { label: 'Опубликовано', value: 'published' },
      ],
      defaultValue: 'draft',
    },
  ],
}

export default Posts
```

### Интернет-магазин

```typescript
// collections/Products.ts
const Products: CollectionConfig = {
  slug: 'products',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
  ],
}
```

### Пользовательские запросы

```typescript
// Сложный поиск
const results = await payload.find({
  collection: 'posts',
  where: {
    and: [
      {
        status: {
          equals: 'published',
        },
      },
      {
        or: [
          {
            title: {
              contains: 'JavaScript',
            },
          },
          {
            content: {
              contains: 'React',
            },
          },
        ],
      },
    ],
  },
  sort: '-publishedAt',
  limit: 20,
})
```

## Производительность

### Оптимизация запросов

1. **Используйте индексы** для часто запрашиваемых полей:
```typescript
indexing: {
  enabled: true,
  fields: ['slug', 'email', 'status']
}
```

2. **Настройте кэширование** для повторяющихся запросов:
```typescript
caching: {
  enabled: true,
  ttl: 300000, // 5 минут
  maxSize: 1000
}
```

3. **Используйте пагинацию** для больших наборов данных:
```typescript
const posts = await payload.find({
  collection: 'posts',
  limit: 20,
  page: 1
})
```

### Мониторинг производительности

```typescript
// Включите мониторинг
monitoring: {
  enabled: true,
  logLevel: 'info',
  metricsCollection: true
}

// Получение метрик
const metrics = adapter.getMetrics()
console.log('Время выполнения запросов:', metrics.queryTime)
console.log('Использование кэша:', metrics.cacheHitRate)
```

## Безопасность

### Шифрование данных

```typescript
// Генерация ключа шифрования
npx payload-json generate-key

// Использование в конфигурации
encryption: {
  enabled: true,
  key: process.env.ENCRYPTION_KEY,
  algorithm: 'aes-256-gcm'
}
```

### Переменные окружения

```bash
# .env
ENCRYPTION_KEY=your-32-character-encryption-key-here
DATA_DIR=./data
CACHE_TTL=300000
```

### Права доступа к файлам

```bash
# Установка правильных прав доступа
chmod 700 ./data
chmod 600 ./data/*.json
```

## Развертывание

### Vercel

```javascript
// vercel.json
{
  "functions": {
    "pages/api/**/*.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "ENCRYPTION_KEY": "@encryption-key"
  }
}
```

### Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[plugins]]
  package = "@netlify/plugin-functions-core"
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'payload-app',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

## Troubleshooting

### Частые проблемы

#### Ошибка "Cannot read collection"

**Причина:** Файл коллекции не существует или поврежден.

**Решение:**
```bash
# Проверьте существование файла
ls -la ./data/

# Восстановите из резервной копии
cp ./data/backup/posts.json ./data/posts.json
```

#### Медленные запросы

**Причина:** Отсутствие индексов или большой размер коллекции.

**Решение:**
```typescript
// Добавьте индексы
indexing: {
  enabled: true,
  fields: ['frequently_queried_field']
}

// Используйте пагинацию
limit: 50,
page: 1
```

#### Ошибки шифрования

**Причина:** Неверный ключ шифрования или его отсутствие.

**Решение:**
```bash
# Сгенерируйте новый ключ
npx payload-json generate-key

# Установите в переменные окружения
export ENCRYPTION_KEY="your-generated-key"
```

### Логирование и отладка

```typescript
// Включите подробное логирование
monitoring: {
  enabled: true,
  logLevel: 'debug'
}

// Проверьте логи
tail -f ./logs/payload-json.log
```

### Резервное копирование

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ./backups/$DATE
cp -r ./data/* ./backups/$DATE/
echo "Backup created: ./backups/$DATE"
```

### Миграция данных

```typescript
// scripts/migrate.ts
import { JSONAdapter } from 'payload-db-json'

const migrate = async () => {
  const adapter = JSONAdapter({ dataDir: './data' })
  
  // Миграция структуры данных
  const posts = await adapter.find('posts', {})
  
  for (const post of posts) {
    if (!post.slug) {
      post.slug = post.title.toLowerCase().replace(/\s+/g, '-')
      await adapter.update('posts', post.id, post)
    }
  }
  
  console.log('Migration completed')
}

migrate().catch(console.error)
```

## Поддержка

- **GitHub Issues:** [payload-json-db/payload-db-json/issues](https://github.com/payload-json-db/payload-db-json/issues)
- **Discord:** [Payload CMS Community](https://discord.gg/payload)
- **Email:** support@payload-json-db.com
- **Документация:** [docs.payload-json-db.com](https://docs.payload-json-db.com)

---

*Последнее обновление: январь 2024*