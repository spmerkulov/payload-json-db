import { buildConfig } from 'payload/config';
import { jsonAdapter } from 'payload-db-json';
import path from 'path';

// Коллекции
import Users from './collections/Users';
import Posts from './collections/Posts';
import Media from './collections/Media';
import Categories from './collections/Categories';

export default buildConfig({
  // Основные настройки
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
  
  // Настройки админ панели
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '- JSON Blog',
      favicon: '/favicon.ico',
      ogImage: '/og-image.jpg',
    },
  },
  
  // Конфигурация JSON адаптера
  db: jsonAdapter({
    dataDir: path.resolve(__dirname, '../data'),
    
    // Настройки кэширования для разработки
    cache: {
      enabled: true,
      ttl: process.env.NODE_ENV === 'production' ? 300000 : 60000, // 5 мин / 1 мин
      maxSize: 1000,
      autoSaveInterval: process.env.NODE_ENV === 'production' ? 30000 : 10000 // 30 сек / 10 сек
    },
    
    // Настройки производительности
    performance: {
      enableIndexing: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      compression: process.env.NODE_ENV === 'production'
    },
    
    // Шифрование для продакшн
    encryption: {
      enabled: process.env.NODE_ENV === 'production' && !!process.env.ENCRYPTION_KEY,
      key: process.env.ENCRYPTION_KEY,
      algorithm: 'aes-256-gcm'
    }
  }),
  
  // Коллекции
  collections: [
    Users,
    Posts,
    Categories,
    Media,
  ],
  
  // Глобальные настройки
  globals: [
    {
      slug: 'settings',
      fields: [
        {
          name: 'siteName',
          type: 'text',
          required: true,
          defaultValue: 'My JSON Blog',
        },
        {
          name: 'description',
          type: 'textarea',
          defaultValue: 'A blog powered by Payload CMS and JSON Database Adapter',
        },
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'socialLinks',
          type: 'array',
          fields: [
            {
              name: 'platform',
              type: 'select',
              options: [
                { label: 'Twitter', value: 'twitter' },
                { label: 'Facebook', value: 'facebook' },
                { label: 'Instagram', value: 'instagram' },
                { label: 'LinkedIn', value: 'linkedin' },
                { label: 'GitHub', value: 'github' },
              ],
            },
            {
              name: 'url',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },
  ],
  
  // Настройки TypeScript
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  
  // Настройки GraphQL
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, 'generated-schema.graphql'),
  },
  
  // CORS настройки
  cors: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.PAYLOAD_PUBLIC_SERVER_URL,
  ].filter((url): url is string => Boolean(url)),

  // CSRF защита
  csrf: [
    'http://localhost:3000',
    'http://localhost:3001', 
    process.env.PAYLOAD_PUBLIC_SERVER_URL,
  ].filter((url): url is string => Boolean(url)),
  
  // Настройки загрузки файлов
  upload: {
    limits: {
      fileSize: 5000000, // 5MB
    },
  },
  
  // Настройки Express
  express: {
    json: {
      limit: 2097152, // 2MB в байтах
    },
    compression: {
      threshold: 1024,
    },
  },
  
  // Настройки рейт-лимитинга
  rateLimit: {
    max: 2000,
    trustProxy: true,
  },
  
  // Настройки фоновых задач
  jobs: {
    tasks: [],
  },
  
  // Настройки логирования
  debug: process.env.NODE_ENV === 'development',
  
  // Локализация
  localization: {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    fallback: true,
  },
});