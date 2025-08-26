# Интеграция Payload JSON Database Adapter

Полное руководство по интеграции JSON Database Adapter с Payload CMS.

## 🚀 Быстрый старт

### Установка через NPM

```bash
npm install payload-db-json
```

### Использование CLI

```bash
# Глобальная установка CLI
npm install -g payload-db-json

# Создание нового проекта
payload-db-json init my-blog --template basic-blog

# Переход в проект и установка зависимостей
cd my-blog
npm install

# Запуск проекта
npm run dev
```

## 📋 Ручная интеграция

### 1. Установка зависимостей

```bash
npm install payload payload-db-json express
npm install -D @types/express typescript ts-node nodemon
```

### 2. Конфигурация Payload

Создайте файл `src/payload.config.ts`:

```typescript
import { buildConfig } from 'payload/config';
import { jsonAdapter } from 'payload-db-json';
import Users from './collections/Users';
import Posts from './collections/Posts';

export default buildConfig({
  // Конфигурация JSON адаптера
  db: jsonAdapter({
    dataDir: process.env.JSON_DB_DATA_DIR || './data',
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 300000, // 5 минут
    },
    performance: {
      enableCompression: true,
      batchSize: 50,
      maxConcurrentOperations: 10,
    },
    encryption: {
      enabled: process.env.NODE_ENV === 'production',
      key: process.env.JSON_DB_ENCRYPTION_KEY,
    },
  }),
  
  // Остальная конфигурация Payload
  admin: {
    user: Users.slug,
  },
  collections: [
    Users,
    Posts,
  ],
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, 'generated-schema.graphql'),
  },
});
```

### 3. Создание сервера

Создайте файл `src/server.ts`:

```typescript
import express from 'express';
import payload from 'payload';

const app = express();

const start = async (): Promise<void> => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET,
    express: app,
    onInit: async () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`);
    },
  });

  app.get('/', (_, res) => {
    res.redirect('/admin');
  });

  const port = process.env.PORT || 3000;
  app.listen(port, async () => {
    payload.logger.info(`Server started on port ${port}`);
  });
};

start();
```

### 4. Переменные окружения

Создайте файл `.env`:

```env
PAYLOAD_SECRET=your-secret-key-here
PORT=3000
JSON_DB_DATA_DIR=./data
JSON_DB_ENABLE_ENCRYPTION=false
JSON_DB_ENCRYPTION_KEY=your-32-character-key-here
```

### 5. Package.json скрипты

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development nodemon src/server.ts",
    "build": "tsc",
    "start": "cross-env NODE_ENV=production node dist/server.js",
    "generate:types": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts payload generate:types",
    "generate:graphQLSchema": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts payload generate:graphQLSchema"
  }
}
```

## 🛠️ CLI Команды

### Инициализация проекта

```bash
# Интерактивная инициализация
payload-db-json init

# С параметрами
payload-db-json init my-project --template basic-blog --dir ./my-project
```

### Управление данными

```bash
# Создание резервной копии
payload-db-json backup --output ./backup-2024-01-01

# Восстановление из резервной копии
payload-db-json restore --input ./backup-2024-01-01

# Валидация данных
payload-db-json validate --data-dir ./data --fix

# Статистика базы данных
payload-db-json stats --json

# Очистка кэша
payload-db-json clear-cache
```

### Миграция данных

```bash
# Миграция из MongoDB (планируется)
payload-db-json migrate --from mongodb --config ./migration.config.js

# Миграция из PostgreSQL (планируется)
payload-db-json migrate --from postgres --config ./migration.config.js
```

## 📁 Шаблоны проектов

### Базовый блог (`basic-blog`)
- Коллекции: Users, Posts, Categories, Media
- Роли: Admin, Editor, Author
- Функции: Публикация постов, управление категориями, загрузка медиа

### E-commerce (`ecommerce`) - Планируется
- Коллекции: Products, Orders, Customers, Categories
- Функции: Каталог товаров, корзина, заказы, платежи

### Портфолио (`portfolio`) - Планируется
- Коллекции: Projects, Skills, Testimonials
- Функции: Галерея проектов, навыки, отзывы

### Пустой проект (`blank`)
- Минимальная конфигурация
- Только базовая коллекция Users

## ⚙️ Конфигурация адаптера

### Полная конфигурация

```typescript
import { jsonAdapter } from 'payload-db-json';

const db = jsonAdapter({
  // Основные настройки
  dataDir: './data',                    // Директория для данных
  
  // Кэширование
  cache: {
    enabled: true,                      // Включить кэш
    maxSize: 100,                       // Максимум записей в кэше
    ttl: 300000,                        // Время жизни кэша (мс)
    strategy: 'lru',                    // Стратегия вытеснения
  },
  
  // Производительность
  performance: {
    enableCompression: true,            // Сжатие JSON файлов
    batchSize: 50,                      // Размер батча для операций
    maxConcurrentOperations: 10,        // Максимум параллельных операций
    enableBackup: true,                 // Автоматические резервные копии
    backupInterval: 3600000,            // Интервал резервного копирования (мс)
  },
  
  // Шифрование
  encryption: {
    enabled: false,                     // Включить шифрование
    algorithm: 'aes-256-gcm',          // Алгоритм шифрования
    key: process.env.ENCRYPTION_KEY,    // Ключ шифрования (32 символа)
  },
  
  // Логирование
  logging: {
    enabled: true,                      // Включить логирование
    level: 'info',                      // Уровень логирования
    file: './logs/database.log',        // Файл для логов
  },
});
```

### Переменные окружения

```env
# Основные настройки
JSON_DB_DATA_DIR=./data
JSON_DB_ENABLE_CACHE=true
JSON_DB_CACHE_SIZE=100
JSON_DB_CACHE_TTL=300000

# Производительность
JSON_DB_ENABLE_COMPRESSION=true
JSON_DB_BATCH_SIZE=50
JSON_DB_MAX_CONCURRENT_OPS=10

# Шифрование
JSON_DB_ENABLE_ENCRYPTION=false
JSON_DB_ENCRYPTION_KEY=your-32-character-encryption-key

# Логирование
JSON_DB_LOG_LEVEL=info
JSON_DB_LOG_FILE=./logs/database.log
```

## 🔧 Расширенное использование

### Кастомные хуки

```typescript
// В конфигурации коллекции
export const Posts: CollectionConfig = {
  slug: 'posts',
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Автоматическая генерация slug
        if (operation === 'create' && !data.slug) {
          data.slug = data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        }
        return data;
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        // Логирование изменений
        console.log(`Post ${operation}: "${doc.title}" (${doc.id})`);
      },
    ],
  },
  // ... остальная конфигурация
};
```

### Кастомные валидаторы

```typescript
// Валидатор для уникальности slug
const validateUniqueSlug = async (value: string, { req }) => {
  const existing = await req.payload.find({
    collection: 'posts',
    where: {
      slug: {
        equals: value,
      },
    },
    limit: 1,
  });
  
  if (existing.totalDocs > 0) {
    throw new Error('Slug должен быть уникальным');
  }
  
  return true;
};

// Использование в поле
{
  name: 'slug',
  type: 'text',
  required: true,
  validate: validateUniqueSlug,
}
```

### Кастомные endpoints

```typescript
// В payload.config.ts
export default buildConfig({
  // ... остальная конфигурация
  
  endpoints: [
    {
      path: '/api/stats',
      method: 'get',
      handler: async (req, res) => {
        const stats = await req.payload.db.getStats();
        res.json(stats);
      },
    },
    {
      path: '/api/backup',
      method: 'post',
      handler: async (req, res) => {
        // Создание резервной копии
        const backupPath = await createBackup();
        res.json({ success: true, path: backupPath });
      },
    },
  ],
});
```

## 🚀 Развертывание

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Собираем проект
RUN npm run build

# Создаем директории для данных
RUN mkdir -p data uploads logs

# Устанавливаем права доступа
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  payload-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PAYLOAD_SECRET=${PAYLOAD_SECRET}
      - JSON_DB_DATA_DIR=/app/data
      - JSON_DB_ENABLE_ENCRYPTION=true
      - JSON_DB_ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - payload-app
    restart: unless-stopped
```

### Vercel

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ],
  "env": {
    "PAYLOAD_SECRET": "@payload-secret",
    "JSON_DB_DATA_DIR": "/tmp/data",
    "JSON_DB_ENABLE_ENCRYPTION": "true"
  }
}
```

## 🔍 Мониторинг и отладка

### Логирование

```typescript
// Включение подробного логирования
process.env.DEBUG = 'payload:*';

// Кастомный логгер
import { Logger } from 'payload/dist/utilities/logger';

const customLogger = {
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
  },
  warn: (message: string) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`);
  },
  error: (message: string) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
  },
};

// Использование в конфигурации
export default buildConfig({
  // ... остальная конфигурация
  logger: customLogger,
});
```

### Метрики производительности

```typescript
// Middleware для измерения времени выполнения
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  
  next();
});

// Получение статистики адаптера
app.get('/api/db-stats', async (req, res) => {
  const stats = await req.payload.db.getStats();
  res.json({
    ...stats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
```

### Health Check

```typescript
app.get('/health', async (req, res) => {
  try {
    // Проверка подключения к базе данных
    await req.payload.db.connect();
    
    // Проверка доступности файловой системы
    await fs.access('./data', fs.constants.R_OK | fs.constants.W_OK);
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
```

## 🔒 Безопасность

### Шифрование данных

```bash
# Генерация ключа шифрования
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### Права доступа к файлам

```bash
# Установка правильных прав доступа
chmod 750 data/
chmod 640 data/**/*.json
chmod 755 uploads/
```

### Переменные окружения в продакшене

```bash
# Использование секретов в Docker
docker run -d \
  --name payload-app \
  -e PAYLOAD_SECRET_FILE=/run/secrets/payload_secret \
  -e JSON_DB_ENCRYPTION_KEY_FILE=/run/secrets/encryption_key \
  -v payload_secret:/run/secrets/payload_secret:ro \
  -v encryption_key:/run/secrets/encryption_key:ro \
  payload-app
```

## 📚 Дополнительные ресурсы

- [Документация Payload CMS](https://payloadcms.com/docs)
- [Примеры проектов](./examples/)
- [API Reference](./docs/api.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Contributing](./CONTRIBUTING.md)

## 🤝 Поддержка

- 🐛 [Сообщить об ошибке](https://github.com/your-repo/issues)
- 💬 [Обсуждения](https://github.com/your-repo/discussions)
- 📧 [Email поддержка](mailto:support@example.com)
- 💬 [Discord сообщество](https://discord.gg/payload)

---

**Payload JSON Database Adapter** - простое, быстрое и надежное решение для хранения данных в Payload CMS.