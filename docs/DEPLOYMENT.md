# Руководство по развертыванию

## Содержание

- [Общие принципы](#общие-принципы)
- [Vercel](#vercel)
- [Netlify](#netlify)
- [Docker](#docker)
- [VPS/Dedicated Server](#vpsdedicated-server)
- [AWS](#aws)
- [Google Cloud Platform](#google-cloud-platform)
- [Heroku](#heroku)
- [Railway](#railway)
- [Render](#render)
- [Безопасность](#безопасность)
- [Мониторинг](#мониторинг)
- [Резервное копирование](#резервное-копирование)

## Общие принципы

### Переменные окружения

Перед развертыванием убедитесь, что настроены все необходимые переменные окружения:

```bash
# .env.production
NODE_ENV=production
PAYLOAD_SECRET=your-super-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key
DATA_DIR=./data
CACHE_TTL=300000
PORT=3000

# Опциональные
LOG_LEVEL=info
ENABLE_COMPRESSION=true
ENABLE_MONITORING=true
```

### Подготовка к продакшену

```bash
# Установка зависимостей
npm ci --only=production

# Сборка проекта
npm run build

# Проверка готовности
npm run prepare-release
```

### Структура файлов для продакшена

```
project/
├── dist/                 # Собранные файлы
├── data/                 # База данных (должна быть в .gitignore)
├── uploads/              # Загруженные файлы
├── logs/                 # Логи приложения
├── backups/              # Резервные копии
├── package.json
├── .env.production
└── ecosystem.config.js   # Для PM2
```

## Vercel

### Настройка проекта

1. **Создайте `vercel.json`:**

```json
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
  "functions": {
    "dist/server.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

2. **Настройте переменные окружения в Vercel Dashboard:**

```bash
# Через CLI
vercel env add PAYLOAD_SECRET
vercel env add ENCRYPTION_KEY
vercel env add DATA_DIR

# Или через веб-интерфейс
# https://vercel.com/your-username/your-project/settings/environment-variables
```

3. **Создайте скрипт сборки:**

```json
{
  "scripts": {
    "build": "npm run build:payload && npm run build:server",
    "build:payload": "payload build",
    "build:server": "tsc",
    "vercel-build": "npm run build"
  }
}
```

4. **Развертывание:**

```bash
# Установка Vercel CLI
npm i -g vercel

# Первое развертывание
vercel

# Последующие развертывания
vercel --prod
```

### Особенности для Vercel

- **Serverless функции** имеют ограничение по времени выполнения (30 сек)
- **Файловая система** доступна только для чтения в `/tmp`
- **Данные** должны храниться во внешнем хранилище или базе данных

```typescript
// Конфигурация для Vercel
const adapter = JSONAdapter({
  dataDir: process.env.VERCEL ? '/tmp/data' : './data',
  caching: {
    enabled: true,
    ttl: 60000 // Короткий TTL для serverless
  },
  performance: {
    autoSave: false, // Отключить автосохранение
    saveInterval: 0
  }
})
```

## Netlify

### Настройка проекта

1. **Создайте `netlify.toml`:**

```toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "9"

[functions]
  node_bundler = "esbuild"

[[plugins]]
  package = "@netlify/plugin-functions-core"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. **Создайте функцию API:**

```typescript
// netlify/functions/api.ts
import { Handler } from '@netlify/functions'
import payload from 'payload'

const handler: Handler = async (event, context) => {
  // Инициализация Payload только при первом запросе
  if (!payload.isInitialized) {
    await payload.init({
      secret: process.env.PAYLOAD_SECRET!,
      local: true
    })
  }

  // Обработка запросов
  const { path, httpMethod, body, headers } = event
  
  try {
    // Ваша логика API
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Success' })
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

export { handler }
```

3. **Развертывание:**

```bash
# Установка Netlify CLI
npm i -g netlify-cli

# Логин
netlify login

# Развертывание
netlify deploy --prod
```

## Docker

### Dockerfile

```dockerfile
# Многоэтапная сборка
FROM node:18-alpine AS builder

WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./
COPY tsconfig.json ./

# Установка зависимостей
RUN npm ci --only=production && npm cache clean --force

# Копирование исходного кода
COPY src/ ./src/

# Сборка приложения
RUN npm run build

# Продакшен образ
FROM node:18-alpine AS production

# Создание пользователя без root прав
RUN addgroup -g 1001 -S nodejs
RUN adduser -S payload -u 1001

WORKDIR /app

# Установка только продакшен зависимостей
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Копирование собранного приложения
COPY --from=builder /app/dist ./dist
COPY --chown=payload:nodejs --from=builder /app/dist ./dist

# Создание необходимых директорий
RUN mkdir -p data uploads logs backups
RUN chown -R payload:nodejs data uploads logs backups

# Переключение на пользователя без root прав
USER payload

# Открытие порта
EXPOSE 3000

# Проверка здоровья
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js

# Запуск приложения
CMD ["node", "dist/server.js"]
```

### docker-compose.yml

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
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - DATA_DIR=/app/data
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./logs:/app/logs
      - ./backups:/app/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "dist/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

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

volumes:
  data:
  uploads:
  logs:
  backups:
```

### Развертывание с Docker

```bash
# Сборка образа
docker build -t payload-json-app .

# Запуск контейнера
docker run -d \
  --name payload-app \
  -p 3000:3000 \
  -e PAYLOAD_SECRET="your-secret" \
  -e ENCRYPTION_KEY="your-key" \
  -v $(pwd)/data:/app/data \
  payload-json-app

# Или с docker-compose
docker-compose up -d
```

## VPS/Dedicated Server

### Настройка сервера (Ubuntu/Debian)

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2
npm install -g pm2

# Установка Nginx
sudo apt install nginx -y

# Настройка файрвола
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Конфигурация PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'payload-json-app',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
}
```

### Конфигурация Nginx

```nginx
# /etc/nginx/sites-available/payload-app
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    location /uploads {
        alias /var/www/payload-app/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Развертывание на VPS

```bash
# Клонирование репозитория
git clone https://github.com/your-username/your-payload-app.git
cd your-payload-app

# Установка зависимостей
npm ci --only=production

# Сборка приложения
npm run build

# Настройка переменных окружения
cp .env.example .env.production
nano .env.production

# Запуск с PM2
pm2 start ecosystem.config.js --env production

# Сохранение конфигурации PM2
pm2 save
pm2 startup

# Настройка Nginx
sudo ln -s /etc/nginx/sites-available/payload-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Настройка SSL с Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## AWS

### EC2 развертывание

```bash
# Создание EC2 инстанса
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.micro \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --subnet-id subnet-xxxxxxxxx

# Подключение к инстансу
ssh -i your-key.pem ec2-user@your-ec2-ip

# Установка зависимостей (Amazon Linux 2)
sudo yum update -y
sudo yum install -y nodejs npm git

# Развертывание приложения
git clone https://github.com/your-username/your-payload-app.git
cd your-payload-app
npm ci --only=production
npm run build

# Настройка PM2
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 startup
pm2 save
```

### ECS развертывание

```json
{
  "family": "payload-json-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "payload-app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/payload-json-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "PAYLOAD_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:payload-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/payload-json-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Безопасность

### Основные принципы

1. **Шифрование данных:**

```typescript
const adapter = JSONAdapter({
  dataDir: './data',
  encryption: {
    enabled: true,
    key: process.env.ENCRYPTION_KEY, // 32-символьный ключ
    algorithm: 'aes-256-gcm'
  }
})
```

2. **Безопасные заголовки:**

```typescript
// middleware/security.ts
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))
```

3. **Ограничение скорости запросов:**

```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов
  message: 'Слишком много запросов с этого IP'
})

app.use('/api/', limiter)
```

4. **Валидация входных данных:**

```typescript
import Joi from 'joi'

const validatePost = (data: any) => {
  const schema = Joi.object({
    title: Joi.string().min(1).max(100).required(),
    content: Joi.string().min(1).required(),
    status: Joi.string().valid('draft', 'published').required()
  })
  
  return schema.validate(data)
}
```

### Права доступа к файлам

```bash
# Установка правильных прав доступа
chmod 700 ./data
chmod 600 ./data/*.json
chmod 600 .env.production

# Создание пользователя для приложения
sudo useradd -r -s /bin/false payload
sudo chown -R payload:payload /var/www/payload-app
```

## Мониторинг

### Логирование

```typescript
// utils/logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})

export default logger
```

### Метрики производительности

```typescript
// middleware/metrics.ts
import { Request, Response, NextFunction } from 'express'

interface Metrics {
  requests: number
  errors: number
  responseTime: number[]
}

const metrics: Metrics = {
  requests: 0,
  errors: 0,
  responseTime: []
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    metrics.requests++
    metrics.responseTime.push(duration)
    
    if (res.statusCode >= 400) {
      metrics.errors++
    }
    
    // Очистка старых метрик (оставляем последние 1000)
    if (metrics.responseTime.length > 1000) {
      metrics.responseTime = metrics.responseTime.slice(-1000)
    }
  })
  
  next()
}

export const getMetrics = () => {
  const avgResponseTime = metrics.responseTime.length > 0
    ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length
    : 0
    
  return {
    ...metrics,
    avgResponseTime,
    errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0
  }
}
```

### Health Check

```typescript
// routes/health.ts
import { Router } from 'express'
import { getMetrics } from '../middleware/metrics'

const router = Router()

router.get('/health', async (req, res) => {
  try {
    // Проверка доступности базы данных
    const dbCheck = await payload.find({
      collection: 'users',
      limit: 1
    })
    
    // Проверка файловой системы
    const fs = require('fs')
    const dataDir = process.env.DATA_DIR || './data'
    const canWrite = fs.existsSync(dataDir)
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbCheck ? 'connected' : 'disconnected',
      filesystem: canWrite ? 'writable' : 'readonly',
      metrics: getMetrics()
    }
    
    res.json(health)
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

export default router
```

## Резервное копирование

### Автоматическое резервное копирование

```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"
DATA_DIR="./data"
UPLOADS_DIR="./uploads"

# Создание директории для резервной копии
mkdir -p "$BACKUP_DIR"

# Копирование данных
cp -r "$DATA_DIR" "$BACKUP_DIR/data"
cp -r "$UPLOADS_DIR" "$BACKUP_DIR/uploads"

# Создание архива
tar -czf "$BACKUP_DIR.tar.gz" -C "$BACKUP_DIR" .

# Удаление временной директории
rm -rf "$BACKUP_DIR"

# Удаление старых резервных копий (старше 30 дней)
find ./backups -name "*.tar.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR.tar.gz"
```

### Настройка cron для автоматического резервного копирования

```bash
# Редактирование crontab
crontab -e

# Добавление задачи (каждый день в 2:00)
0 2 * * * /path/to/your/app/scripts/backup.sh >> /path/to/your/app/logs/backup.log 2>&1
```

### Восстановление из резервной копии

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Остановка приложения
pm2 stop payload-json-app

# Создание резервной копии текущих данных
./scripts/backup.sh

# Восстановление данных
tar -xzf "$BACKUP_FILE" -C ./

# Запуск приложения
pm2 start payload-json-app

echo "Restore completed from: $BACKUP_FILE"
```

Это руководство покрывает основные сценарии развертывания JSON Database Adapter с Payload CMS на различных платформах, включая настройку безопасности, мониторинга и резервного копирования.