# Payload JSON Database Adapter

[![npm version](https://img.shields.io/npm/v/payload-db-json.svg)](https://www.npmjs.com/package/payload-db-json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Payload CMS](https://img.shields.io/badge/Payload%20CMS-Compatible-green.svg)](https://payloadcms.com/)

Легковесный JSON-адаптер базы данных для Payload CMS, идеальный для разработки, прототипирования и небольших проектов.

## ✨ Особенности

- 🚀 **Быстрая установка** - готов к работе за минуты
- 💾 **Файловое хранение** - данные в читаемом JSON формате
- 🔒 **Безопасность** - опциональное AES-256 шифрование
- ⚡ **Производительность** - встроенное кэширование и оптимизация
- 🛠️ **CLI инструменты** - автоматизация задач разработки
- 📦 **Готовые шаблоны** - быстрый старт с примерами проектов
- 🔧 **TypeScript** - полная типизация из коробки
- 🌐 **Serverless Ready** - идеально для Vercel, Netlify и других платформ

## 🚀 Быстрый старт

### Установка через CLI (рекомендуется)

```bash
# Создание нового проекта
npx payload-db-json init my-blog
cd my-blog
npm run dev
```

### Ручная установка

```bash
npm install payload-db-json
# или
yarn add payload-db-json
```

### Базовая настройка

```typescript
// payload.config.ts
import { buildConfig } from 'payload/config'
import { jsonAdapter } from 'payload-db-json'

export default buildConfig({
  db: jsonAdapter({
    dataDir: './data',
    cache: {
      enabled: true,
      ttl: 300000 // 5 минут
    },
    encryption: {
      enabled: process.env.NODE_ENV === 'production',
      key: process.env.ENCRYPTION_KEY
    }
  }),
  // ... остальная конфигурация
})
```

## 📚 Документация

- [📖 Полное руководство по установке](./roadmap-project/TD-Payload-Integration.md)
- [⚙️ Конфигурация адаптера](./src/types/index.ts)
- [🛠️ CLI команды](./src/cli/index.ts)
- [🔧 API Reference](./docs/api.md)
- [🚀 Деплой и продакшн](./roadmap-project/TD-Payload-Integration.md#деплой-в-продакшн)

## 🎯 Примеры проектов

### Базовый блог
```bash
npx payload-db-json init my-blog --template=basic-blog
```

**Включает:**
- 👥 Управление пользователями с ролями
- 📝 Система постов с категориями и тегами
- 🖼️ Загрузка и управление медиа
- 🔍 SEO оптимизация
- 📊 Аналитика и статистика

### E-commerce (планируется)
```bash
npx payload-db-json init my-shop --template=ecommerce
```

### Портфолио (планируется)
```bash
npx payload-db-json init my-portfolio --template=portfolio
```

## 🛠️ CLI команды

```bash
# Инициализация проекта
payload-db-json init <project-name> [--template=<template>]

# Управление данными
payload-db-json migrate --from=<source> --to=<target>
payload-db-json backup --output=<path>
payload-db-json restore --input=<path>

# Утилиты
payload-db-json validate --data-dir=<path>
payload-db-json stats --data-dir=<path>
payload-db-json clear-cache --data-dir=<path>
```

## ⚙️ Конфигурация

### Базовые настройки

```typescript
interface JsonAdapterConfig {
  dataDir: string                    // Директория для данных
  cache?: CacheConfig                // Настройки кэширования
  performance?: PerformanceConfig    // Оптимизация производительности
  encryption?: EncryptionConfig      // Шифрование данных
  logging?: LoggingConfig           // Логирование
}
```

### Продвинутые настройки

```typescript
// Кэширование
cache: {
  enabled: true,
  ttl: 300000,        // TTL в миллисекундах
  maxSize: 100,       // Максимальный размер кэша
  strategy: 'lru'     // Стратегия вытеснения
}

// Производительность
performance: {
  batchSize: 100,           // Размер батча для операций
  indexing: true,           // Индексирование для быстрого поиска
  compression: true,        // Сжатие JSON файлов
  autoSave: true,          // Автосохранение изменений
  autoSaveInterval: 5000   // Интервал автосохранения (мс)
}

// Шифрование
encryption: {
  enabled: true,
  key: process.env.ENCRYPTION_KEY,  // 32-байтовый ключ
  algorithm: 'aes-256-gcm'          // Алгоритм шифрования
}
```

## 🔒 Безопасность

### Шифрование данных
```bash
# Генерация ключа шифрования
payload-db-json generate-key

# Установка в переменные окружения
echo "ENCRYPTION_KEY=your-generated-key" >> .env
```

### Права доступа к файлам
```bash
# Установка правильных прав на директорию данных
chmod 700 ./data
chmod 600 ./data/*.json
```

## 📊 Производительность

### Рекомендации по оптимизации

- **Кэширование**: Включите кэш для часто запрашиваемых данных
- **Индексирование**: Используйте индексы для больших коллекций
- **Сжатие**: Включите сжатие для экономии места
- **Батчинг**: Используйте батч-операции для массовых изменений

### Ограничения

- **Размер данных**: Рекомендуется до 10MB на коллекцию
- **Конкурентность**: Ограниченная поддержка параллельных записей
- **Транзакции**: Базовая поддержка транзакций

## 🚀 Деплой

### Vercel
```json
// vercel.json
{
  "functions": {
    "src/server.ts": {
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
  functions = "dist/functions"

[build.environment]
  NODE_ENV = "production"
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

## 🤝 Поддерживаемые версии

- **Payload CMS**: ^2.0.0 || ^3.0.0
- **Next.js**: ^13.0.0 || ^14.0.0 || ^15.0.0
- **Node.js**: >=16.0.0
- **TypeScript**: ^4.5.0

## 🐛 Troubleshooting

### Частые проблемы

**Ошибка: "Cannot find data directory"**
```bash
# Создайте директорию данных
mkdir -p ./data
```

**Ошибка: "Encryption key required"**
```bash
# Сгенерируйте и установите ключ
payload-db-json generate-key
```

**Медленная работа**
```typescript
// Включите кэширование и индексирование
db: jsonAdapter({
  cache: { enabled: true },
  performance: { indexing: true }
})
```

## 🤝 Участие в разработке

Мы приветствуем вклад в развитие проекта! Пожалуйста, ознакомьтесь с [руководством для контрибьюторов](./CONTRIBUTING.md).

### Разработка

```bash
# Клонирование репозитория
git clone https://github.com/username/payload-db-json.git
cd payload-db-json

# Установка зависимостей
npm install

# Запуск тестов
npm test

# Сборка проекта
npm run build

# Запуск в режиме разработки
npm run dev
```

## 📝 Changelog

Все значимые изменения документируются в [CHANGELOG.md](./CHANGELOG.md).

## 📄 Лицензия

MIT License - см. [LICENSE](./LICENSE) файл для деталей.

## 🙏 Благодарности

- Команде [Payload CMS](https://payloadcms.com/) за отличную CMS
- Сообществу разработчиков за обратную связь и предложения
- Всем контрибьюторам проекта

## 📞 Поддержка

- 🐛 [GitHub Issues](https://github.com/username/payload-db-json/issues) - для багов и feature requests
- 💬 [GitHub Discussions](https://github.com/username/payload-db-json/discussions) - для вопросов и обсуждений
- 📧 Email: support@payload-db-json.com
- 💬 [Discord](https://discord.gg/payloadcms) - канал #json-adapter

---

<p align="center">
  Сделано с ❤️ для сообщества Payload CMS
</p>