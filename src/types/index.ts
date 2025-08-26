import { DatabaseAdapter, PayloadRequest } from 'payload/types';

/**
 * Конфигурация JSON адаптера
 */
export interface JsonAdapterConfig {
  /** Путь к папке с данными */
  dataDir: string;
  
  /** Настройки шифрования */
  encryption?: {
    enabled: boolean;
    key?: string;
    algorithm?: string;
  };
  
  /** Настройки кэширования */
  cache?: {
    /** Время жизни кэша в миллисекундах */
    ttl: number;
    /** Максимальное количество записей в кэше */
    maxSize: number;
    /** Интервал автосохранения в миллисекундах */
    autoSaveInterval?: number;
  };
  
  /** Настройки производительности */
  performance?: {
    /** Максимальный размер файла в байтах */
    maxFileSize: number;
    /** Включить сжатие JSON */
    compression: boolean;
  };
}

/**
 * Запись в коллекции
 */
export interface JsonRecord {
  id: string;
  [key: string]: any;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Метаданные коллекции
 */
export interface CollectionMetadata {
  name: string;
  count: number;
  lastModified: Date;
  version: number;
  indexes: string[];
}

/**
 * Данные коллекции
 */
export interface CollectionData {
  metadata: CollectionMetadata;
  records: JsonRecord[];
}

/**
 * Параметры запроса
 */
export interface QueryOptions {
  where?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  page?: number;
  populate?: string[];
}

/**
 * Результат запроса
 */
export interface QueryResult<T = JsonRecord> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage?: number;
  prevPage?: number;
}

/**
 * Операции с кэшем
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Интерфейс кэша
 */
export interface Cache {
  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, data: T, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
}

/**
 * Интерфейс файлового менеджера
 */
export interface FileManager {
  readCollection(collectionName: string): Promise<CollectionData>;
  writeCollection(collectionName: string, data: CollectionData): Promise<void>;
  deleteCollection(collectionName: string): Promise<void>;
  collectionExists(collectionName: string): Promise<boolean>;
  listCollections(): Promise<string[]>;
  backup(collectionName?: string): Promise<string>;
  restore(backupPath: string): Promise<void>;
}

/**
 * Интерфейс системы шифрования
 */
export interface Encryption {
  encrypt(data: string): string;
  decrypt(encryptedData: string): string;
  isEnabled(): boolean;
}

/**
 * Статистика адаптера
 */
export interface AdapterStats {
  collections: number;
  totalRecords: number;
  cacheHitRate: number;
  averageQueryTime: number;
  memoryUsage: {
    cache: number;
    total: number;
  };
}

/**
 * События адаптера
 */
export interface AdapterEvents {
  'collection:created': (collectionName: string) => void;
  'collection:updated': (collectionName: string, recordId: string) => void;
  'collection:deleted': (collectionName: string) => void;
  'record:created': (collectionName: string, record: JsonRecord) => void;
  'record:updated': (collectionName: string, record: JsonRecord) => void;
  'record:deleted': (collectionName: string, recordId: string) => void;
  'cache:hit': (key: string) => void;
  'cache:miss': (key: string) => void;
  'error': (error: Error) => void;
}

/**
 * Основной интерфейс JSON адаптера
 */
export interface JsonDatabaseAdapter extends DatabaseAdapter {
  config: JsonAdapterConfig;
  fileManager: FileManager;
  cache: Cache;
  encryption?: Encryption;
  
  // Статистика и мониторинг
  getStats(): Promise<AdapterStats>;
  
  // Управление кэшем
  clearCache(collectionName?: string): Promise<void>;
  
  // Резервное копирование
  backup(collectionName?: string): Promise<string>;
  restore(backupPath: string): Promise<void>;
  
  // Миграции
  migrate(fromAdapter: DatabaseAdapter): Promise<void>;
  
  // События
  on<K extends keyof AdapterEvents>(event: K, listener: AdapterEvents[K]): void;
  off<K extends keyof AdapterEvents>(event: K, listener: AdapterEvents[K]): void;
  emit<K extends keyof AdapterEvents>(event: K, ...args: Parameters<AdapterEvents[K]>): void;
}

/**
 * Ошибки адаптера
 */
export class JsonAdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public collection?: string,
    public recordId?: string
  ) {
    super(message);
    this.name = 'JsonAdapterError';
  }
}

/**
 * Коды ошибок
 */
export enum ErrorCodes {
  COLLECTION_NOT_FOUND = 'COLLECTION_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  INVALID_QUERY = 'INVALID_QUERY',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MIGRATION_ERROR = 'MIGRATION_ERROR'
}