# Руководство по миграции данных

## Содержание

- [Обзор миграций](#обзор-миграций)
- [Миграция с MongoDB](#миграция-с-mongodb)
- [Миграция с PostgreSQL](#миграция-с-postgresql)
- [Миграция с MySQL](#миграция-с-mysql)
- [Миграция между версиями адаптера](#миграция-между-версиями-адаптера)
- [Инструменты миграции](#инструменты-миграции)
- [Резервное копирование](#резервное-копирование)
- [Откат миграций](#откат-миграций)
- [Лучшие практики](#лучшие-практики)

## Обзор миграций

### Типы миграций

1. **Миграция с других баз данных** - перенос данных из MongoDB, PostgreSQL, MySQL
2. **Миграция между версиями** - обновление структуры данных при обновлении адаптера
3. **Миграция схемы** - изменение структуры коллекций
4. **Миграция данных** - трансформация существующих данных

### Общие принципы

- **Безопасность** - всегда создавайте резервные копии перед миграцией
- **Поэтапность** - выполняйте миграцию небольшими порциями
- **Валидация** - проверяйте целостность данных после миграции
- **Откат** - всегда имейте план отката

## Миграция с MongoDB

### Подготовка

1. **Установите необходимые зависимости:**

```bash
npm install mongodb @types/mongodb
```

2. **Создайте скрипт миграции:**

```typescript
// scripts/migrate-from-mongodb.ts
import { MongoClient } from 'mongodb'
import { JSONAdapter } from '../src/index'
import fs from 'fs/promises'
import path from 'path'

interface MigrationConfig {
  mongodb: {
    uri: string
    database: string
  }
  jsonAdapter: {
    dataDir: string
  }
  collections: string[]
  batchSize: number
}

class MongoToJSONMigrator {
  private mongoClient: MongoClient
  private jsonAdapter: JSONAdapter
  private config: MigrationConfig

  constructor(config: MigrationConfig) {
    this.config = config
    this.mongoClient = new MongoClient(config.mongodb.uri)
    this.jsonAdapter = new JSONAdapter({
      dataDir: config.jsonAdapter.dataDir
    })
  }

  async migrate(): Promise<void> {
    console.log('Начинаем миграцию с MongoDB...')
    
    try {
      await this.mongoClient.connect()
      const db = this.mongoClient.db(this.config.mongodb.database)
      
      for (const collectionName of this.config.collections) {
        await this.migrateCollection(db, collectionName)
      }
      
      console.log('Миграция завершена успешно!')
    } catch (error) {
      console.error('Ошибка миграции:', error)
      throw error
    } finally {
      await this.mongoClient.close()
    }
  }

  private async migrateCollection(db: any, collectionName: string): Promise<void> {
    console.log(`Мигрируем коллекцию: ${collectionName}`)
    
    const collection = db.collection(collectionName)
    const totalDocs = await collection.countDocuments()
    
    console.log(`Найдено документов: ${totalDocs}`)
    
    let processed = 0
    const cursor = collection.find({}).batchSize(this.config.batchSize)
    
    while (await cursor.hasNext()) {
      const batch: any[] = []
      
      // Собираем батч документов
      for (let i = 0; i < this.config.batchSize && await cursor.hasNext(); i++) {
        const doc = await cursor.next()
        if (doc) {
          // Трансформируем MongoDB документ в JSON формат
          const transformedDoc = this.transformDocument(doc)
          batch.push(transformedDoc)
        }
      }
      
      // Сохраняем батч в JSON адаптер
      await this.saveBatch(collectionName, batch)
      
      processed += batch.length
      console.log(`Обработано: ${processed}/${totalDocs} (${Math.round(processed/totalDocs*100)}%)`)
    }
  }

  private transformDocument(doc: any): any {
    // Преобразуем ObjectId в строку
    if (doc._id) {
      doc.id = doc._id.toString()
      delete doc._id
    }
    
    // Преобразуем даты
    Object.keys(doc).forEach(key => {
      if (doc[key] instanceof Date) {
        doc[key] = doc[key].toISOString()
      }
      
      // Рекурсивно обрабатываем вложенные объекты
      if (typeof doc[key] === 'object' && doc[key] !== null && !Array.isArray(doc[key])) {
        doc[key] = this.transformDocument(doc[key])
      }
      
      // Обрабатываем массивы
      if (Array.isArray(doc[key])) {
        doc[key] = doc[key].map((item: any) => 
          typeof item === 'object' && item !== null ? this.transformDocument(item) : item
        )
      }
    })
    
    return doc
  }

  private async saveBatch(collectionName: string, batch: any[]): Promise<void> {
    const filePath = path.join(this.config.jsonAdapter.dataDir, `${collectionName}.json`)
    
    // Читаем существующие данные
    let existingData: any[] = []
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      existingData = JSON.parse(fileContent)
    } catch (error) {
      // Файл не существует, создаем новый
      await fs.mkdir(path.dirname(filePath), { recursive: true })
    }
    
    // Добавляем новые данные
    existingData.push(...batch)
    
    // Сохраняем обновленные данные
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2))
  }
}

// Конфигурация миграции
const migrationConfig: MigrationConfig = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'payload'
  },
  jsonAdapter: {
    dataDir: './data'
  },
  collections: ['users', 'posts', 'media', 'pages'],
  batchSize: 100
}

// Запуск миграции
if (require.main === module) {
  const migrator = new MongoToJSONMigrator(migrationConfig)
  migrator.migrate().catch(console.error)
}

export { MongoToJSONMigrator }
```

### Запуск миграции

```bash
# Установка переменных окружения
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_DATABASE="payload"

# Запуск миграции
npx ts-node scripts/migrate-from-mongodb.ts
```

## Миграция с PostgreSQL

### Скрипт миграции

```typescript
// scripts/migrate-from-postgresql.ts
import { Client } from 'pg'
import { JSONAdapter } from '../src/index'
import fs from 'fs/promises'
import path from 'path'

interface PostgreSQLMigrationConfig {
  postgresql: {
    host: string
    port: number
    database: string
    username: string
    password: string
  }
  jsonAdapter: {
    dataDir: string
  }
  tables: Array<{
    name: string
    primaryKey: string
    columns?: string[]
  }>
  batchSize: number
}

class PostgreSQLToJSONMigrator {
  private pgClient: Client
  private config: PostgreSQLMigrationConfig

  constructor(config: PostgreSQLMigrationConfig) {
    this.config = config
    this.pgClient = new Client({
      host: config.postgresql.host,
      port: config.postgresql.port,
      database: config.postgresql.database,
      user: config.postgresql.username,
      password: config.postgresql.password
    })
  }

  async migrate(): Promise<void> {
    console.log('Начинаем миграцию с PostgreSQL...')
    
    try {
      await this.pgClient.connect()
      
      for (const table of this.config.tables) {
        await this.migrateTable(table)
      }
      
      console.log('Миграция завершена успешно!')
    } catch (error) {
      console.error('Ошибка миграции:', error)
      throw error
    } finally {
      await this.pgClient.end()
    }
  }

  private async migrateTable(table: { name: string; primaryKey: string; columns?: string[] }): Promise<void> {
    console.log(`Мигрируем таблицу: ${table.name}`)
    
    // Получаем общее количество записей
    const countResult = await this.pgClient.query(`SELECT COUNT(*) FROM ${table.name}`)
    const totalRows = parseInt(countResult.rows[0].count)
    
    console.log(`Найдено записей: ${totalRows}`)
    
    let processed = 0
    let offset = 0
    
    while (offset < totalRows) {
      // Получаем батч данных
      const columns = table.columns ? table.columns.join(', ') : '*'
      const query = `SELECT ${columns} FROM ${table.name} ORDER BY ${table.primaryKey} LIMIT $1 OFFSET $2`
      const result = await this.pgClient.query(query, [this.config.batchSize, offset])
      
      if (result.rows.length === 0) break
      
      // Трансформируем данные
      const transformedRows = result.rows.map(row => this.transformRow(row, table.primaryKey))
      
      // Сохраняем батч
      await this.saveBatch(table.name, transformedRows)
      
      processed += result.rows.length
      offset += this.config.batchSize
      
      console.log(`Обработано: ${processed}/${totalRows} (${Math.round(processed/totalRows*100)}%)`)
    }
  }

  private transformRow(row: any, primaryKey: string): any {
    // Переименовываем первичный ключ в 'id'
    if (row[primaryKey] && primaryKey !== 'id') {
      row.id = row[primaryKey]
      delete row[primaryKey]
    }
    
    // Преобразуем даты в ISO строки
    Object.keys(row).forEach(key => {
      if (row[key] instanceof Date) {
        row[key] = row[key].toISOString()
      }
      
      // Преобразуем JSON поля
      if (typeof row[key] === 'object' && row[key] !== null) {
        row[key] = JSON.parse(JSON.stringify(row[key]))
      }
    })
    
    return row
  }

  private async saveBatch(tableName: string, batch: any[]): Promise<void> {
    const filePath = path.join(this.config.jsonAdapter.dataDir, `${tableName}.json`)
    
    // Читаем существующие данные
    let existingData: any[] = []
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      existingData = JSON.parse(fileContent)
    } catch (error) {
      // Файл не существует, создаем новый
      await fs.mkdir(path.dirname(filePath), { recursive: true })
    }
    
    // Добавляем новые данные
    existingData.push(...batch)
    
    // Сохраняем обновленные данные
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2))
  }
}

// Конфигурация миграции
const migrationConfig: PostgreSQLMigrationConfig = {
  postgresql: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'payload',
    username: process.env.PG_USERNAME || 'postgres',
    password: process.env.PG_PASSWORD || ''
  },
  jsonAdapter: {
    dataDir: './data'
  },
  tables: [
    { name: 'users', primaryKey: 'id' },
    { name: 'posts', primaryKey: 'id' },
    { name: 'media', primaryKey: 'id' },
    { name: 'pages', primaryKey: 'id' }
  ],
  batchSize: 100
}

// Запуск миграции
if (require.main === module) {
  const migrator = new PostgreSQLToJSONMigrator(migrationConfig)
  migrator.migrate().catch(console.error)
}

export { PostgreSQLToJSONMigrator }
```

## Миграция с MySQL

### Скрипт миграции

```typescript
// scripts/migrate-from-mysql.ts
import mysql from 'mysql2/promise'
import { JSONAdapter } from '../src/index'
import fs from 'fs/promises'
import path from 'path'

interface MySQLMigrationConfig {
  mysql: {
    host: string
    port: number
    database: string
    user: string
    password: string
  }
  jsonAdapter: {
    dataDir: string
  }
  tables: Array<{
    name: string
    primaryKey: string
    columns?: string[]
  }>
  batchSize: number
}

class MySQLToJSONMigrator {
  private connection: mysql.Connection | null = null
  private config: MySQLMigrationConfig

  constructor(config: MySQLMigrationConfig) {
    this.config = config
  }

  async migrate(): Promise<void> {
    console.log('Начинаем миграцию с MySQL...')
    
    try {
      this.connection = await mysql.createConnection({
        host: this.config.mysql.host,
        port: this.config.mysql.port,
        database: this.config.mysql.database,
        user: this.config.mysql.user,
        password: this.config.mysql.password
      })
      
      for (const table of this.config.tables) {
        await this.migrateTable(table)
      }
      
      console.log('Миграция завершена успешно!')
    } catch (error) {
      console.error('Ошибка миграции:', error)
      throw error
    } finally {
      if (this.connection) {
        await this.connection.end()
      }
    }
  }

  private async migrateTable(table: { name: string; primaryKey: string; columns?: string[] }): Promise<void> {
    if (!this.connection) throw new Error('Нет соединения с базой данных')
    
    console.log(`Мигрируем таблицу: ${table.name}`)
    
    // Получаем общее количество записей
    const [countRows] = await this.connection.execute(`SELECT COUNT(*) as count FROM ${table.name}`)
    const totalRows = (countRows as any)[0].count
    
    console.log(`Найдено записей: ${totalRows}`)
    
    let processed = 0
    let offset = 0
    
    while (offset < totalRows) {
      // Получаем батч данных
      const columns = table.columns ? table.columns.join(', ') : '*'
      const query = `SELECT ${columns} FROM ${table.name} ORDER BY ${table.primaryKey} LIMIT ? OFFSET ?`
      const [rows] = await this.connection.execute(query, [this.config.batchSize, offset])
      
      const rowsArray = rows as any[]
      if (rowsArray.length === 0) break
      
      // Трансформируем данные
      const transformedRows = rowsArray.map(row => this.transformRow(row, table.primaryKey))
      
      // Сохраняем батч
      await this.saveBatch(table.name, transformedRows)
      
      processed += rowsArray.length
      offset += this.config.batchSize
      
      console.log(`Обработано: ${processed}/${totalRows} (${Math.round(processed/totalRows*100)}%)`)
    }
  }

  private transformRow(row: any, primaryKey: string): any {
    // Переименовываем первичный ключ в 'id'
    if (row[primaryKey] && primaryKey !== 'id') {
      row.id = row[primaryKey]
      delete row[primaryKey]
    }
    
    // Преобразуем даты в ISO строки
    Object.keys(row).forEach(key => {
      if (row[key] instanceof Date) {
        row[key] = row[key].toISOString()
      }
      
      // Преобразуем TINYINT(1) в boolean
      if (typeof row[key] === 'number' && (row[key] === 0 || row[key] === 1)) {
        // Проверяем, является ли это boolean полем по имени
        if (key.includes('is_') || key.includes('has_') || key.includes('enabled') || key.includes('active')) {
          row[key] = Boolean(row[key])
        }
      }
      
      // Преобразуем JSON поля
      if (typeof row[key] === 'string') {
        try {
          const parsed = JSON.parse(row[key])
          if (typeof parsed === 'object') {
            row[key] = parsed
          }
        } catch {
          // Не JSON строка, оставляем как есть
        }
      }
    })
    
    return row
  }

  private async saveBatch(tableName: string, batch: any[]): Promise<void> {
    const filePath = path.join(this.config.jsonAdapter.dataDir, `${tableName}.json`)
    
    // Читаем существующие данные
    let existingData: any[] = []
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      existingData = JSON.parse(fileContent)
    } catch (error) {
      // Файл не существует, создаем новый
      await fs.mkdir(path.dirname(filePath), { recursive: true })
    }
    
    // Добавляем новые данные
    existingData.push(...batch)
    
    // Сохраняем обновленные данные
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2))
  }
}

// Конфигурация миграции
const migrationConfig: MySQLMigrationConfig = {
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    database: process.env.MYSQL_DATABASE || 'payload',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || ''
  },
  jsonAdapter: {
    dataDir: './data'
  },
  tables: [
    { name: 'users', primaryKey: 'id' },
    { name: 'posts', primaryKey: 'id' },
    { name: 'media', primaryKey: 'id' },
    { name: 'pages', primaryKey: 'id' }
  ],
  batchSize: 100
}

// Запуск миграции
if (require.main === module) {
  const migrator = new MySQLToJSONMigrator(migrationConfig)
  migrator.migrate().catch(console.error)
}

export { MySQLToJSONMigrator }
```

## Миграция между версиями адаптера

### Система версионирования

```typescript
// src/migrations/index.ts
export interface Migration {
  version: string
  description: string
  up: (dataDir: string) => Promise<void>
  down: (dataDir: string) => Promise<void>
}

const migrations: Migration[] = [
  {
    version: '1.0.0',
    description: 'Добавление поля createdAt и updatedAt',
    up: async (dataDir: string) => {
      const collections = await fs.readdir(dataDir)
      
      for (const file of collections) {
        if (!file.endsWith('.json')) continue
        
        const filePath = path.join(dataDir, file)
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
        
        const updatedData = data.map((item: any) => ({
          ...item,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString()
        }))
        
        await fs.writeFile(filePath, JSON.stringify(updatedData, null, 2))
      }
    },
    down: async (dataDir: string) => {
      const collections = await fs.readdir(dataDir)
      
      for (const file of collections) {
        if (!file.endsWith('.json')) continue
        
        const filePath = path.join(dataDir, file)
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
        
        const updatedData = data.map((item: any) => {
          const { createdAt, updatedAt, ...rest } = item
          return rest
        })
        
        await fs.writeFile(filePath, JSON.stringify(updatedData, null, 2))
      }
    }
  },
  {
    version: '1.1.0',
    description: 'Добавление индексов для быстрого поиска',
    up: async (dataDir: string) => {
      const indexDir = path.join(dataDir, '_indexes')
      await fs.mkdir(indexDir, { recursive: true })
      
      // Создаем индексы для существующих коллекций
      const collections = await fs.readdir(dataDir)
      
      for (const file of collections) {
        if (!file.endsWith('.json') || file.startsWith('_')) continue
        
        const collectionName = file.replace('.json', '')
        const filePath = path.join(dataDir, file)
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
        
        // Создаем индекс по ID
        const idIndex: Record<string, number> = {}
        data.forEach((item: any, index: number) => {
          if (item.id) {
            idIndex[item.id] = index
          }
        })
        
        const indexPath = path.join(indexDir, `${collectionName}_id.json`)
        await fs.writeFile(indexPath, JSON.stringify(idIndex, null, 2))
      }
    },
    down: async (dataDir: string) => {
      const indexDir = path.join(dataDir, '_indexes')
      try {
        await fs.rm(indexDir, { recursive: true })
      } catch (error) {
        // Директория не существует
      }
    }
  }
]

export { migrations }
```

### Менеджер миграций

```typescript
// src/migrations/migrator.ts
import fs from 'fs/promises'
import path from 'path'
import { migrations, Migration } from './index'

interface MigrationRecord {
  version: string
  appliedAt: string
}

class MigrationManager {
  private dataDir: string
  private migrationFile: string

  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.migrationFile = path.join(dataDir, '_migrations.json')
  }

  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const content = await fs.readFile(this.migrationFile, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return []
    }
  }

  async recordMigration(version: string): Promise<void> {
    const applied = await this.getAppliedMigrations()
    applied.push({
      version,
      appliedAt: new Date().toISOString()
    })
    
    await fs.writeFile(this.migrationFile, JSON.stringify(applied, null, 2))
  }

  async removeMigrationRecord(version: string): Promise<void> {
    const applied = await this.getAppliedMigrations()
    const filtered = applied.filter(m => m.version !== version)
    
    await fs.writeFile(this.migrationFile, JSON.stringify(filtered, null, 2))
  }

  async migrate(): Promise<void> {
    console.log('Проверяем необходимость миграций...')
    
    const applied = await this.getAppliedMigrations()
    const appliedVersions = new Set(applied.map(m => m.version))
    
    const pendingMigrations = migrations.filter(m => !appliedVersions.has(m.version))
    
    if (pendingMigrations.length === 0) {
      console.log('Все миграции уже применены')
      return
    }
    
    console.log(`Найдено ${pendingMigrations.length} новых миграций`)
    
    for (const migration of pendingMigrations) {
      console.log(`Применяем миграцию ${migration.version}: ${migration.description}`)
      
      try {
        await migration.up(this.dataDir)
        await this.recordMigration(migration.version)
        console.log(`✓ Миграция ${migration.version} применена успешно`)
      } catch (error) {
        console.error(`✗ Ошибка применения миграции ${migration.version}:`, error)
        throw error
      }
    }
    
    console.log('Все миграции применены успешно!')
  }

  async rollback(targetVersion?: string): Promise<void> {
    console.log('Начинаем откат миграций...')
    
    const applied = await this.getAppliedMigrations()
    applied.sort((a, b) => b.version.localeCompare(a.version)) // Сортируем по убыванию
    
    for (const record of applied) {
      if (targetVersion && record.version === targetVersion) {
        break
      }
      
      const migration = migrations.find(m => m.version === record.version)
      if (!migration) {
        console.warn(`Миграция ${record.version} не найдена, пропускаем`)
        continue
      }
      
      console.log(`Откатываем миграцию ${migration.version}: ${migration.description}`)
      
      try {
        await migration.down(this.dataDir)
        await this.removeMigrationRecord(migration.version)
        console.log(`✓ Миграция ${migration.version} откачена успешно`)
      } catch (error) {
        console.error(`✗ Ошибка отката миграции ${migration.version}:`, error)
        throw error
      }
      
      if (targetVersion && record.version === targetVersion) {
        break
      }
    }
    
    console.log('Откат миграций завершен!')
  }
}

export { MigrationManager }
```

## Инструменты миграции

### CLI для миграций

```typescript
// src/cli/migrate.ts
import { Command } from 'commander'
import { MigrationManager } from '../migrations/migrator'
import { MongoToJSONMigrator } from '../../scripts/migrate-from-mongodb'
import { PostgreSQLToJSONMigrator } from '../../scripts/migrate-from-postgresql'
import { MySQLToJSONMigrator } from '../../scripts/migrate-from-mysql'

const program = new Command()

program
  .name('payload-json-migrate')
  .description('Инструменты миграции для Payload JSON DB')
  .version('1.0.0')

// Миграция версий
program
  .command('up')
  .description('Применить все ожидающие миграции')
  .option('-d, --data-dir <dir>', 'Директория с данными', './data')
  .action(async (options) => {
    const migrator = new MigrationManager(options.dataDir)
    await migrator.migrate()
  })

program
  .command('down')
  .description('Откатить миграции')
  .option('-d, --data-dir <dir>', 'Директория с данными', './data')
  .option('-t, --target <version>', 'Целевая версия для отката')
  .action(async (options) => {
    const migrator = new MigrationManager(options.dataDir)
    await migrator.rollback(options.target)
  })

// Миграция с других БД
program
  .command('from-mongodb')
  .description('Миграция с MongoDB')
  .requiredOption('-u, --uri <uri>', 'URI подключения к MongoDB')
  .requiredOption('-db, --database <name>', 'Имя базы данных')
  .option('-d, --data-dir <dir>', 'Директория для сохранения данных', './data')
  .option('-c, --collections <collections>', 'Коллекции для миграции (через запятую)')
  .option('-b, --batch-size <size>', 'Размер батча', '100')
  .action(async (options) => {
    const collections = options.collections ? options.collections.split(',') : ['users', 'posts', 'media']
    
    const migrator = new MongoToJSONMigrator({
      mongodb: {
        uri: options.uri,
        database: options.database
      },
      jsonAdapter: {
        dataDir: options.dataDir
      },
      collections,
      batchSize: parseInt(options.batchSize)
    })
    
    await migrator.migrate()
  })

program
  .command('from-postgresql')
  .description('Миграция с PostgreSQL')
  .requiredOption('-h, --host <host>', 'Хост PostgreSQL')
  .requiredOption('-p, --port <port>', 'Порт PostgreSQL')
  .requiredOption('-db, --database <name>', 'Имя базы данных')
  .requiredOption('-u, --username <username>', 'Имя пользователя')
  .requiredOption('-pw, --password <password>', 'Пароль')
  .option('-d, --data-dir <dir>', 'Директория для сохранения данных', './data')
  .option('-t, --tables <tables>', 'Таблицы для миграции (через запятую)')
  .option('-b, --batch-size <size>', 'Размер батча', '100')
  .action(async (options) => {
    const tables = options.tables 
      ? options.tables.split(',').map((t: string) => ({ name: t.trim(), primaryKey: 'id' }))
      : [{ name: 'users', primaryKey: 'id' }, { name: 'posts', primaryKey: 'id' }]
    
    const migrator = new PostgreSQLToJSONMigrator({
      postgresql: {
        host: options.host,
        port: parseInt(options.port),
        database: options.database,
        username: options.username,
        password: options.password
      },
      jsonAdapter: {
        dataDir: options.dataDir
      },
      tables,
      batchSize: parseInt(options.batchSize)
    })
    
    await migrator.migrate()
  })

program
  .command('from-mysql')
  .description('Миграция с MySQL')
  .requiredOption('-h, --host <host>', 'Хост MySQL')
  .requiredOption('-p, --port <port>', 'Порт MySQL')
  .requiredOption('-db, --database <name>', 'Имя базы данных')
  .requiredOption('-u, --user <user>', 'Имя пользователя')
  .requiredOption('-pw, --password <password>', 'Пароль')
  .option('-d, --data-dir <dir>', 'Директория для сохранения данных', './data')
  .option('-t, --tables <tables>', 'Таблицы для миграции (через запятую)')
  .option('-b, --batch-size <size>', 'Размер батча', '100')
  .action(async (options) => {
    const tables = options.tables 
      ? options.tables.split(',').map((t: string) => ({ name: t.trim(), primaryKey: 'id' }))
      : [{ name: 'users', primaryKey: 'id' }, { name: 'posts', primaryKey: 'id' }]
    
    const migrator = new MySQLToJSONMigrator({
      mysql: {
        host: options.host,
        port: parseInt(options.port),
        database: options.database,
        user: options.user,
        password: options.password
      },
      jsonAdapter: {
        dataDir: options.dataDir
      },
      tables,
      batchSize: parseInt(options.batchSize)
    })
    
    await migrator.migrate()
  })

// Валидация данных
program
  .command('validate')
  .description('Валидация целостности данных')
  .option('-d, --data-dir <dir>', 'Директория с данными', './data')
  .action(async (options) => {
    console.log('Проверяем целостность данных...')
    
    const files = await fs.readdir(options.dataDir)
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('_'))
    
    for (const file of jsonFiles) {
      const filePath = path.join(options.dataDir, file)
      
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content)
        
        if (!Array.isArray(data)) {
          console.error(`✗ ${file}: данные должны быть массивом`)
          continue
        }
        
        // Проверяем уникальность ID
        const ids = new Set()
        let duplicates = 0
        
        for (const item of data) {
          if (!item.id) {
            console.warn(`⚠ ${file}: найден элемент без ID`)
            continue
          }
          
          if (ids.has(item.id)) {
            duplicates++
          } else {
            ids.add(item.id)
          }
        }
        
        if (duplicates > 0) {
          console.error(`✗ ${file}: найдено ${duplicates} дублирующихся ID`)
        } else {
          console.log(`✓ ${file}: ${data.length} записей, все ID уникальны`)
        }
        
      } catch (error) {
        console.error(`✗ ${file}: ошибка парсинга JSON - ${error.message}`)
      }
    }
  })

program.parse()
```

## Резервное копирование

### Автоматическое резервное копирование перед миграцией

```typescript
// src/utils/backup.ts
import fs from 'fs/promises'
import path from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { createReadStream, createWriteStream } from 'fs'

class BackupManager {
  private dataDir: string
  private backupDir: string

  constructor(dataDir: string, backupDir?: string) {
    this.dataDir = dataDir
    this.backupDir = backupDir || path.join(dataDir, '..', 'backups')
  }

  async createBackup(name?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = name || `backup-${timestamp}`
    const backupPath = path.join(this.backupDir, `${backupName}.tar.gz`)
    
    console.log(`Создаем резервную копию: ${backupPath}`)
    
    // Создаем директорию для резервных копий
    await fs.mkdir(this.backupDir, { recursive: true })
    
    // Создаем архив
    const gzip = createGzip()
    const output = createWriteStream(backupPath)
    
    // Архивируем все JSON файлы
    const files = await fs.readdir(this.dataDir)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    
    const archiveData: Record<string, any> = {}
    
    for (const file of jsonFiles) {
      const filePath = path.join(this.dataDir, file)
      const content = await fs.readFile(filePath, 'utf-8')
      archiveData[file] = JSON.parse(content)
    }
    
    // Записываем архив
    const archiveContent = JSON.stringify(archiveData, null, 2)
    
    await pipeline(
      Buffer.from(archiveContent),
      gzip,
      output
    )
    
    console.log(`✓ Резервная копия создана: ${backupPath}`)
    return backupPath
  }

  async restoreBackup(backupPath: string): Promise<void> {
    console.log(`Восстанавливаем из резервной копии: ${backupPath}`)
    
    // Проверяем существование файла резервной копии
    try {
      await fs.access(backupPath)
    } catch (error) {
      throw new Error(`Файл резервной копии не найден: ${backupPath}`)
    }
    
    // Создаем резервную копию текущих данных
    await this.createBackup('before-restore')
    
    // Восстанавливаем данные
    // Здесь должна быть логика распаковки и восстановления
    // Для простоты предполагаем, что это JSON файл
    
    console.log(`✓ Данные восстановлены из: ${backupPath}`)
  }

  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupDir)
      return files.filter(f => f.endsWith('.tar.gz')).sort().reverse()
    } catch (error) {
      return []
    }
  }

  async cleanOldBackups(keepCount: number = 10): Promise<void> {
    const backups = await this.listBackups()
    
    if (backups.length <= keepCount) {
      return
    }
    
    const toDelete = backups.slice(keepCount)
    
    for (const backup of toDelete) {
      const backupPath = path.join(this.backupDir, backup)
      await fs.unlink(backupPath)
      console.log(`Удалена старая резервная копия: ${backup}`)
    }
  }
}

export { BackupManager }
```

## Лучшие практики

### 1. Планирование миграции

- **Анализ данных** - изучите структуру исходных данных
- **Тестирование** - протестируйте миграцию на копии данных
- **Поэтапность** - разбейте большую миграцию на этапы
- **Мониторинг** - следите за процессом миграции

### 2. Безопасность

- **Резервные копии** - всегда создавайте резервные копии
- **Валидация** - проверяйте целостность данных после миграции
- **Откат** - имейте план отката на случай проблем
- **Тестирование** - тестируйте на тестовых данных

### 3. Производительность

- **Батчи** - обрабатывайте данные порциями
- **Индексы** - используйте индексы для ускорения
- **Память** - следите за потреблением памяти
- **Параллелизм** - используйте параллельную обработку где возможно

### 4. Мониторинг

- **Логирование** - ведите подробные логи миграции
- **Прогресс** - показывайте прогресс выполнения
- **Ошибки** - обрабатывайте и логируйте ошибки
- **Метрики** - собирайте метрики производительности

### Пример полной миграции

```bash
#!/bin/bash
# Полный скрипт миграции

set -e  # Остановка при ошибке

echo "Начинаем миграцию с MongoDB на JSON DB"

# 1. Создание резервной копии текущих данных
echo "Создаем резервную копию..."
npx payload-json-migrate backup --name "before-mongodb-migration"

# 2. Миграция данных
echo "Мигрируем данные с MongoDB..."
npx payload-json-migrate from-mongodb \
  --uri "$MONGODB_URI" \
  --database "$MONGODB_DATABASE" \
  --collections "users,posts,media,pages" \
  --batch-size 100

# 3. Применение миграций версий
echo "Применяем миграции версий..."
npx payload-json-migrate up

# 4. Валидация данных
echo "Проверяем целостность данных..."
npx payload-json-migrate validate

# 5. Очистка старых резервных копий
echo "Очищаем старые резервные копии..."
npx payload-json-migrate cleanup-backups --keep 5

echo "Миграция завершена успешно!"
```

Это руководство поможет вам безопасно и эффективно мигрировать данные в JSON Database Adapter для Payload CMS.