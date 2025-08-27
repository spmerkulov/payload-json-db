import { JsonAdapterConfig, JsonDatabaseAdapter } from './types';
import { JsonAdapter } from './adapter';

/**
 * Создает новый экземпляр JSON адаптера для PayloadCMS
 * 
 * @param config - Конфигурация адаптера
 * @returns Настроенный адаптер базы данных
 */
export function jsonAdapter(config: JsonAdapterConfig): () => JsonDatabaseAdapter {
  return () => new JsonAdapter(config);
}

// Экспорт типов для использования в проектах
export * from './types';
export { JsonAdapter } from './adapter';
export { FileManager } from './storage/fileManager';
export { MemoryCache } from './storage/memoryCache';
export { AESEncryption } from './security/encryption';

// Экспорт утилит
export { generateUUID } from './utils/uuid';
export { validateConfig } from './utils/validation';

// Значения по умолчанию
export const DEFAULT_CONFIG: Partial<JsonAdapterConfig> = {
  dataDir: './data',
  cache: {
    enabled: true,
    ttl: 300000, // 5 минут
    maxSize: 1000,
    autoSaveInterval: 30000 // 30 секунд
  },
  performance: {
    enableIndexing: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    compression: false
  },
  encryption: {
    enabled: false,
    algorithm: 'aes-256-gcm'
  }
};