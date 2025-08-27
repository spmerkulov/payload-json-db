# Пошаговое руководство по внедрению JSON Database Adapter

**Версия:** 1.0  
**Дата:** Январь 2025  
**Целевая аудитория:** Senior Fullstack Developer  
**Время выполнения:** 2-4 часа  

---

## 🎯 Цель руководства

Данное руководство поможет разработчику быстро и правильно интегрировать JSON Database Adapter в новый или существующий проект PayloadCMS.

---

## 📋 Предварительные требования

### Системные требования
- Node.js 16+ или 18+
- npm 8+ или yarn 1.22+
- TypeScript 4.9+
- PayloadCMS 2.0+

### Знания и навыки
- Опыт работы с PayloadCMS
- Базовые знания TypeScript/JavaScript
- Понимание концепций баз данных
- Опыт работы с npm/yarn

---

## 🚀 Сценарий 1: Создание нового проекта

### Шаг 1: Установка через CLI (Рекомендуется)

```bash
# Глобальная установка CLI (опционально)
npm install -g payload-db-json

# Создание нового проекта
npx payload-db-json init my-payload-project --template=basic-blog

# Переход в директорию проекта
cd my-payload-project
```

**Ожидаемый результат:**
```
my-payload-project/
├── src/
│   ├── collections/
│   │   ├── Users.ts
│   │   └── Posts.ts
│   ├── payload.config.ts
│   └── server.ts
├── data/                 # Директория для JSON файлов
├── .env.example
├── package.json
└── tsconfig.json
```

### Шаг 2: Настройка окружения

```bash
# Копирование файла окружения
cp .env.example .env

# Редактирование .env файла
# Добавить необходимые переменные:
```

**.env файл:**
```env
# Payload Configuration
PAYLOAD_SECRET=your-secret-key-here
PAYLOAD_CONFIG_PATH=src/payload.config.ts

# JSON Database Configuration
JSON_DB_DATA_DIR=./data
JSON_DB_ENCRYPTION_KEY=your-32-character-encryption-key

# Development
NODE_ENV=development
PORT=3000
```

### Шаг 3: Установка зависимостей

```bash
# Установка всех зависимостей
npm install

# Или с yarn
yarn install
```

### Шаг 4: Запуск проекта

```bash
# Запуск в режиме разработки
npm run dev

# Или с yarn
yarn dev
```

**Проверка:**
- Откройте http://localhost:3000/admin
- Создайте первого пользователя
- Проверьте создание файлов в директории `./data/`

---

## 🔄 Сценарий 2: Интеграция в существующий проект

### Шаг 1: Установка адаптера

```bash
# Установка через npm
npm install payload-db-json

# Или через yarn
yarn add payload-db-json

# Или из GitHub (последняя версия)
npm install github:username/payload-db-json
```

### Шаг 2: Обновление конфигурации Payload

**Файл: `src/payload.config.ts`**
```typescript
import { buildConfig } from 'payload/config'
import { jsonAdapter } from 'payload-db-json'
import path from 'path'

// Импорт существующих коллекций
import Users from './collections/Users'
import Posts from './collections/Posts'
// ... другие коллекции

export default buildConfig({
  // Замена существующего адаптера на JSON
  db: jsonAdapter({
    dataDir: process.env.JSON_DB_DATA_DIR || './data',
    
    // Настройки кэширования
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 300000, // 5 минут
      autoSaveInterval: 30000 // 30 секунд
    },
    
    // Настройки производительности
    performance: {
      enableIndexing: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      compression: false,
      batchSize: 50
    },
    
    // Настройки шифрования (для продакшена)
    encryption: {
      enabled: process.env.NODE_ENV === 'production',
      key: process.env.JSON_DB_ENCRYPTION_KEY,
      algorithm: 'aes-256-gcm'
    },
    
    // Настройки бэкапов
    backup: {
      enabled: true,
      interval: 3600000, // 1 час
      retention: 168, // 7 дней
      path: './backups'
    }
  }),
  
  // Остальная конфигурация остается без изменений
  admin: {
    user: Users.slug,
  },
  
  collections: [
    Users,
    Posts,
    // ... другие коллекции
  ],
  
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, 'generated-schema.graphql'),
  },
})
```

### Шаг 3: Миграция данных (если необходимо)

**Из MongoDB:**
```bash
# Экспорт данных из MongoDB
payload-db-json export --from=mongodb --connection="mongodb://localhost:27017/mydb" --output=./migration-data.json

# Импорт данных в JSON адаптер
payload-db-json import --file=./migration-data.json --target=./data
```

**Из PostgreSQL:**
```bash
# Экспорт данных из PostgreSQL
payload-db-json export --from=postgres --connection="postgresql://user:password@localhost:5432/mydb" --output=./migration-data.json

# Импорт данных
payload-db-json import --file=./migration-data.json --target=./data
```

### Шаг 4: Обновление переменных окружения

**Добавить в .env:**
```env
# JSON Database Configuration
JSON_DB_DATA_DIR=./data
JSON_DB_ENCRYPTION_KEY=your-32-character-encryption-key

# Удалить или закомментировать старые настройки БД
# DATABASE_URI=mongodb://localhost:27017/mydb
# POSTGRES_URL=postgresql://user:password@localhost:5432/mydb
```

### Шаг 5: Тестирование миграции

```bash
# Запуск тестов
npm run test

# Запуск проекта
npm run dev

# Проверка работоспособности
curl http://localhost:3000/api/users
```

---

## 🛠️ Сценарий 3: Разработка и кастомизация

### Шаг 1: Клонирование репозитория

```bash
# Клонирование исходного кода
git clone https://github.com/username/payload-db-json.git
cd payload-db-json

# Установка зависимостей
npm install

# Сборка проекта
npm run build
```

### Шаг 2: Создание локальной ссылки

```bash
# В директории payload-db-json
npm link

# В директории вашего проекта
npm link payload-db-json
```

### Шаг 3: Кастомизация адаптера

**Создание расширенного адаптера:**
```typescript
// src/custom-json-adapter.ts
import { JsonAdapter, JsonAdapterConfig } from 'payload-db-json'

export class CustomJsonAdapter extends JsonAdapter {
  constructor(config: JsonAdapterConfig) {
    super({
      ...config,
      // Кастомные настройки
      performance: {
        ...config.performance,
        enableCustomIndexing: true,
        customCacheStrategy: 'advanced'
      }
    })
  }
  
  // Переопределение методов
  async create(collection: string, data: any): Promise<any> {
    // Кастомная логика перед созданием
    console.log(`Creating record in ${collection}:`, data)
    
    // Вызов родительского метода
    const result = await super.create(collection, data)
    
    // Кастомная логика после создания
    this.emit('recordCreated', { collection, data: result })
    
    return result
  }
}

// Экспорт кастомного адаптера
export function customJsonAdapter(config: JsonAdapterConfig) {
  return () => new CustomJsonAdapter(config)
}
```

**Использование кастомного адаптера:**
```typescript
// payload.config.ts
import { customJsonAdapter } from './src/custom-json-adapter'

export default buildConfig({
  db: customJsonAdapter({
    dataDir: './data',
    // ... другие настройки
  }),
  // ... остальная конфигурация
})
```

---

## 🔧 Настройка для различных окружений

### Разработка (Development)

```typescript
// payload.config.ts
const isDev = process.env.NODE_ENV === 'development'

export default buildConfig({
  db: jsonAdapter({
    dataDir: './data',
    cache: {
      enabled: true,
      maxSize: 50, // Меньший размер для разработки
      ttl: 60000 // 1 минута
    },
    encryption: {
      enabled: false // Отключено для удобства разработки
    },
    performance: {
      enableIndexing: isDev, // Включено для тестирования
      compression: false
    }
  })
})
```

### Тестирование (Testing)

```typescript
// payload.config.test.ts
export default buildConfig({
  db: jsonAdapter({
    dataDir: './test-data',
    cache: {
      enabled: false // Отключено для предсказуемости тестов
    },
    encryption: {
      enabled: false
    },
    performance: {
      enableIndexing: false,
      compression: false
    }
  })
})
```

### Продакшн (Production)

```typescript
// payload.config.ts
export default buildConfig({
  db: jsonAdapter({
    dataDir: process.env.JSON_DB_DATA_DIR || '/app/data',
    cache: {
      enabled: true,
      maxSize: 1000,
      ttl: 600000 // 10 минут
    },
    encryption: {
      enabled: true,
      key: process.env.JSON_DB_ENCRYPTION_KEY,
      algorithm: 'aes-256-gcm'
    },
    performance: {
      enableIndexing: true,
      compression: true,
      maxFileSize: 50 * 1024 * 1024 // 50MB
    },
    backup: {
      enabled: true,
      interval: 3600000, // 1 час
      retention: 168 // 7 дней
    }
  })
})
```

---

## 🚀 Деплой на различные платформы

### Vercel

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.ts"
    }
  ],
  "env": {
    "JSON_DB_DATA_DIR": "/tmp/data",
    "JSON_DB_ENCRYPTION_KEY": "@json-db-encryption-key"
  }
}
```

### Netlify

**netlify.toml:**
```toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "dist"

[build.environment]
  JSON_DB_DATA_DIR = "/tmp/data"
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/payload"
  status = 200
```

### Docker

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Копирование package.json и установка зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Сборка проекта
RUN npm run build

# Создание директории для данных
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Экспорт порта
EXPOSE 3000

# Запуск приложения
CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  payload-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JSON_DB_DATA_DIR=/app/data
      - JSON_DB_ENCRYPTION_KEY=${JSON_DB_ENCRYPTION_KEY}
      - PAYLOAD_SECRET=${PAYLOAD_SECRET}
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
    restart: unless-stopped
```

---

## 🔍 Мониторинг и отладка

### Логирование

```typescript
// Настройка логирования
import { jsonAdapter } from 'payload-db-json'

export default buildConfig({
  db: jsonAdapter({
    dataDir: './data',
    logging: {
      enabled: true,
      level: 'info', // 'debug', 'info', 'warn', 'error'
      file: './logs/database.log'
    }
  })
})
```

### Метрики производительности

```typescript
// Получение статистики
const adapter = jsonAdapter({ dataDir: './data' })()

// В вашем коде
setInterval(async () => {
  const stats = await adapter.getStats()
  console.log('Database Stats:', {
    queryCount: stats.queryCount,
    avgQueryTime: stats.totalQueryTime / stats.queryCount,
    cacheHitRate: stats.cacheHits / (stats.cacheHits + stats.cacheMisses),
    memoryUsage: process.memoryUsage()
  })
}, 60000) // Каждую минуту
```

### Мониторинг файловой системы

```typescript
// Мониторинг размера данных
import fs from 'fs'
import path from 'path'

function getDirectorySize(dirPath: string): number {
  let totalSize = 0
  const files = fs.readdirSync(dirPath)
  
  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const stats = fs.statSync(filePath)
    
    if (stats.isDirectory()) {
      totalSize += getDirectorySize(filePath)
    } else {
      totalSize += stats.size
    }
  }
  
  return totalSize
}

// Использование
const dataSize = getDirectorySize('./data')
console.log(`Data directory size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`)
```

---

## ✅ Чек-лист завершения

### Базовая интеграция
- [ ] Адаптер установлен и настроен
- [ ] Проект запускается без ошибок
- [ ] Создание записей работает корректно
- [ ] Чтение записей работает корректно
- [ ] Обновление записей работает корректно
- [ ] Удаление записей работает корректно

### Конфигурация
- [ ] Переменные окружения настроены
- [ ] Кэширование настроено (если требуется)
- [ ] Шифрование настроено (для продакшена)
- [ ] Бэкапы настроены (для продакшена)

### Тестирование
- [ ] Юнит-тесты проходят
- [ ] Интеграционные тесты проходят
- [ ] Производительность соответствует требованиям
- [ ] Нагрузочное тестирование выполнено

### Деплой
- [ ] Конфигурация для целевой платформы готова
- [ ] Переменные окружения настроены на сервере
- [ ] Мониторинг и логирование настроены
- [ ] Бэкапы и восстановление протестированы

---

## 🆘 Решение проблем

### Частые ошибки

**1. Ошибка: "Cannot find module 'payload-db-json'"**
```bash
# Решение: Переустановка пакета
npm uninstall payload-db-json
npm install payload-db-json
```

**2. Ошибка: "Permission denied" при записи файлов**
```bash
# Решение: Проверка прав доступа
chmod 755 ./data
sudo chown -R $USER:$USER ./data
```

**3. Ошибка: "Encryption key must be 32 characters"**
```bash
# Решение: Генерация правильного ключа
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**4. Медленная работа с большими файлами**
```typescript
// Решение: Настройка производительности
db: jsonAdapter({
  performance: {
    maxFileSize: 5 * 1024 * 1024, // Уменьшить до 5MB
    compression: true,
    batchSize: 25 // Уменьшить размер батча
  }
})
```

### Контакты для поддержки

- **GitHub Issues:** https://github.com/username/payload-db-json/issues
- **Документация:** https://github.com/username/payload-db-json/docs
- **Примеры:** https://github.com/username/payload-db-json/examples

---

## 📚 Дополнительные ресурсы

- [Официальная документация PayloadCMS](https://payloadcms.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [JSON Database Design Patterns](https://github.com/username/payload-db-json/docs/patterns.md)

---

**Успешной интеграции! 🚀**