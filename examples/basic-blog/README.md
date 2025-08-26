# Payload CMS с JSON Database Adapter - Пример блога

Этот пример демонстрирует интеграцию Payload CMS с JSON Database Adapter для создания простого блога.

## Возможности

- 📝 **Управление постами** - создание, редактирование и публикация статей
- 👥 **Система пользователей** - авторы, редакторы и администраторы
- 📂 **Категории и теги** - организация контента
- 🖼️ **Медиа-менеджер** - загрузка и управление изображениями
- 🔒 **Контроль доступа** - роли и права пользователей
- 🚀 **JSON хранилище** - быстрое и простое хранение данных
- 🔐 **Опциональное шифрование** - защита данных

## Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

Скопируйте файл переменных окружения:

```bash
cp .env.example .env
```

Отредактируйте `.env` файл:

```env
PAYLOAD_SECRET=your-unique-secret-key-here
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-secure-password
```

### 3. Запуск проекта

```bash
# Режим разработки
npm run dev

# Или сборка и запуск
npm run build
npm start
```

### 4. Доступ к админ-панели

Откройте браузер и перейдите по адресу:
```
http://localhost:3000/admin
```

Войдите используя данные из `.env` файла.

## Структура проекта

```
src/
├── collections/          # Коллекции Payload CMS
│   ├── Users.ts         # Пользователи и роли
│   ├── Posts.ts         # Статьи блога
│   ├── Categories.ts    # Категории
│   └── Media.ts         # Медиа файлы
├── payload.config.ts    # Конфигурация Payload CMS
└── server.ts           # Express сервер

data/                   # JSON база данных
├── users/             # Данные пользователей
├── posts/             # Данные постов
├── categories/        # Данные категорий
└── media/             # Метаданные медиа файлов

uploads/               # Загруженные файлы
```

## Конфигурация JSON Adapter

В файле `src/payload.config.ts` настроен JSON Database Adapter:

```typescript
import { jsonAdapter } from 'payload-db-json';

export default buildConfig({
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
  // ... остальная конфигурация
});
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|-------------|
| `PAYLOAD_SECRET` | Секретный ключ для Payload CMS | - |
| `PORT` | Порт сервера | `3000` |
| `JSON_DB_DATA_DIR` | Директория для JSON файлов | `./data` |
| `JSON_DB_ENABLE_ENCRYPTION` | Включить шифрование | `false` |
| `JSON_DB_ENCRYPTION_KEY` | Ключ шифрования (32 символа) | - |
| `ADMIN_EMAIL` | Email администратора | - |
| `ADMIN_PASSWORD` | Пароль администратора | - |

## Роли пользователей

### Admin (Администратор)
- Полный доступ ко всем функциям
- Управление пользователями
- Удаление любого контента

### Editor (Редактор)
- Создание и редактирование всех постов
- Управление категориями
- Загрузка медиа файлов

### Author (Автор)
- Создание и редактирование своих постов
- Загрузка медиа файлов
- Просмотр статистики своих постов

## API Endpoints

Payload CMS автоматически создает REST API:

```
GET    /api/posts          # Получить все посты
GET    /api/posts/:id      # Получить пост по ID
POST   /api/posts          # Создать новый пост
PUT    /api/posts/:id      # Обновить пост
DELETE /api/posts/:id      # Удалить пост

GET    /api/categories     # Получить все категории
GET    /api/users          # Получить всех пользователей
GET    /api/media          # Получить все медиа файлы
```

## GraphQL

Payload CMS также предоставляет GraphQL API:

```
POST /api/graphql
```

Пример запроса:

```graphql
query {
  Posts {
    docs {
      id
      title
      slug
      content
      author {
        firstName
        lastName
      }
      category {
        name
      }
    }
  }
}
```

## Производительность

### Кэширование
- Автоматическое кэширование часто используемых данных
- TTL кэша: 5 минут
- Максимальный размер кэша: 100 записей

### Оптимизация
- Сжатие JSON файлов
- Батчевые операции (до 50 записей)
- Ограничение параллельных операций (до 10)

## Безопасность

### Шифрование данных
В продакшене рекомендуется включить шифрование:

```env
JSON_DB_ENABLE_ENCRYPTION=true
JSON_DB_ENCRYPTION_KEY=your-32-character-encryption-key-here
```

### Контроль доступа
- Роли и права пользователей
- Защита API endpoints
- Валидация данных

## Мониторинг

### Логирование
Все операции логируются:

```bash
# Просмотр логов
npm run logs

# Уровень логирования
LOG_LEVEL=debug npm run dev
```

### Статистика
Доступна статистика использования:

```javascript
// В коде приложения
const stats = await payload.db.getStats();
console.log('Database stats:', stats);
```

## Резервное копирование

### Автоматическое
JSON файлы автоматически создают резервные копии при изменениях.

### Ручное
```bash
# Создать резервную копию
cp -r data data-backup-$(date +%Y%m%d)

# Восстановить из резервной копии
cp -r data-backup-20240101 data
```

## Развертывание

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

### Vercel/Netlify
JSON Database Adapter поддерживает serverless окружения.

## Миграция данных

### Из MongoDB
```bash
# Экспорт из MongoDB
mongoexport --db blog --collection posts --out posts.json

# Импорт в JSON DB
node scripts/import-from-mongo.js
```

### Из PostgreSQL
```bash
# Экспорт из PostgreSQL
pg_dump --table=posts --data-only --format=custom blog > posts.dump

# Импорт в JSON DB
node scripts/import-from-postgres.js
```

## Устранение неполадок

### Частые проблемы

1. **Ошибка доступа к файлам**
   ```bash
   # Проверьте права доступа
   chmod -R 755 data/
   chmod -R 755 uploads/
   ```

2. **Проблемы с кэшем**
   ```bash
   # Очистите кэш
   rm -rf data/.cache
   ```

3. **Ошибки шифрования**
   ```bash
   # Проверьте длину ключа (должен быть 32 символа)
   echo $JSON_DB_ENCRYPTION_KEY | wc -c
   ```

### Отладка

```bash
# Включить подробное логирование
DEBUG=payload:* npm run dev

# Проверить состояние базы данных
node scripts/check-db-health.js
```

## Поддержка

- 📖 [Документация Payload CMS](https://payloadcms.com/docs)
- 🐛 [Сообщить об ошибке](https://github.com/your-repo/issues)
- 💬 [Обсуждения](https://github.com/your-repo/discussions)

## Лицензия

MIT License - см. файл [LICENSE](../../LICENSE)