import { JsonAdapterConfig } from '../types';

export const DEFAULT_CONFIG: Partial<JsonAdapterConfig> = {
  dataDir: './data',
  encryption: {
    enabled: false,
    algorithm: 'aes-256-gcm'
  },
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
  }
};