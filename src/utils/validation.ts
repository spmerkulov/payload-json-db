import { JsonAdapterConfig, JsonAdapterError, ErrorCodes } from '../types';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Валидирует конфигурацию JSON адаптера
 * @param config - Конфигурация для валидации
 * @throws JsonAdapterError при невалидной конфигурации
 */
export function validateConfig(config: JsonAdapterConfig): void {
  // Проверка обязательных полей
  if (!config.dataDir) {
    throw new JsonAdapterError(
      'dataDir is required in configuration',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // Валидация пути к данным
  validateDataDir(config.dataDir);

  // Валидация настроек кэша
  if (config.cache) {
    validateCacheConfig(config.cache);
  }

  // Валидация настроек шифрования
  if (config.encryption) {
    validateEncryptionConfig(config.encryption);
  }

  // Валидация настроек производительности
  if (config.performance) {
    validatePerformanceConfig(config.performance);
  }
}

/**
 * Валидирует путь к папке данных
 * @param dataDir - Путь к папке данных
 */
function validateDataDir(dataDir: string): void {
  const resolvedPath = resolve(dataDir);
  
  try {
    // Создаем папку если она не существует
    if (!existsSync(resolvedPath)) {
      mkdirSync(resolvedPath, { recursive: true });
    }
  } catch (error) {
    throw new JsonAdapterError(
      `Cannot create or access data directory: ${resolvedPath}`,
      ErrorCodes.FILE_SYSTEM_ERROR
    );
  }
}

/**
 * Валидирует настройки кэша
 * @param cacheConfig - Настройки кэша
 */
function validateCacheConfig(cacheConfig: NonNullable<JsonAdapterConfig['cache']>): void {
  if (cacheConfig.ttl <= 0) {
    throw new JsonAdapterError(
      'Cache TTL must be greater than 0',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  if (cacheConfig.maxSize <= 0) {
    throw new JsonAdapterError(
      'Cache maxSize must be greater than 0',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  if (cacheConfig.autoSaveInterval && cacheConfig.autoSaveInterval <= 0) {
    throw new JsonAdapterError(
      'Cache autoSaveInterval must be greater than 0',
      ErrorCodes.VALIDATION_ERROR
    );
  }
}

/**
 * Валидирует настройки шифрования
 * @param encryptionConfig - Настройки шифрования
 */
function validateEncryptionConfig(encryptionConfig: NonNullable<JsonAdapterConfig['encryption']>): void {
  if (encryptionConfig.enabled) {
    if (!encryptionConfig.key) {
      throw new JsonAdapterError(
        'Encryption key is required when encryption is enabled',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (encryptionConfig.key.length < 32) {
      throw new JsonAdapterError(
        'Encryption key must be at least 32 characters long',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const supportedAlgorithms = ['aes-256-gcm', 'aes-256-cbc'];
    if (encryptionConfig.algorithm && !supportedAlgorithms.includes(encryptionConfig.algorithm)) {
      throw new JsonAdapterError(
        `Unsupported encryption algorithm: ${encryptionConfig.algorithm}`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }
}

/**
 * Валидирует настройки производительности
 * @param performanceConfig - Настройки производительности
 */
function validatePerformanceConfig(performanceConfig: NonNullable<JsonAdapterConfig['performance']>): void {
  if (performanceConfig.maxFileSize <= 0) {
    throw new JsonAdapterError(
      'maxFileSize must be greater than 0',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // Предупреждение о слишком больших файлах
  const maxRecommendedSize = 50 * 1024 * 1024; // 50MB
  if (performanceConfig.maxFileSize > maxRecommendedSize) {
    console.warn(
      `Warning: maxFileSize (${performanceConfig.maxFileSize} bytes) exceeds recommended limit (${maxRecommendedSize} bytes). This may impact performance.`
    );
  }
}

/**
 * Валидирует имя коллекции
 * @param collectionName - Имя коллекции
 */
export function validateCollectionName(collectionName: string): void {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new JsonAdapterError(
      'Collection name must be a non-empty string',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // Проверка на недопустимые символы в имени файла
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(collectionName)) {
    throw new JsonAdapterError(
      'Collection name contains invalid characters',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // Проверка длины имени
  if (collectionName.length > 255) {
    throw new JsonAdapterError(
      'Collection name is too long (max 255 characters)',
      ErrorCodes.VALIDATION_ERROR
    );
  }
}

/**
 * Валидирует данные записи
 * @param data - Данные для валидации
 */
export function validateRecordData(data: any): void {
  if (!data || typeof data !== 'object') {
    throw new JsonAdapterError(
      'Record data must be an object',
      ErrorCodes.VALIDATION_ERROR
    );
  }

  // Проверка на циклические ссылки
  try {
    JSON.stringify(data);
  } catch (error) {
    throw new JsonAdapterError(
      'Record data contains circular references',
      ErrorCodes.VALIDATION_ERROR
    );
  }
}

/**
 * Валидирует параметры запроса
 * @param options - Параметры запроса
 */
export function validateQueryOptions(options: any): void {
  if (!options || typeof options !== 'object') {
    return; // Пустые опции допустимы
  }

  // Валидация limit
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit <= 0) {
      throw new JsonAdapterError(
        'Limit must be a positive integer',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (options.limit > 10000) {
      throw new JsonAdapterError(
        'Limit cannot exceed 10000 records',
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  // Валидация page
  if (options.page !== undefined) {
    if (!Number.isInteger(options.page) || options.page <= 0) {
      throw new JsonAdapterError(
        'Page must be a positive integer',
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  // Валидация sort
  if (options.sort) {
    if (typeof options.sort !== 'object') {
      throw new JsonAdapterError(
        'Sort must be an object',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    for (const [field, direction] of Object.entries(options.sort)) {
      if (direction !== 1 && direction !== -1) {
        throw new JsonAdapterError(
          `Invalid sort direction for field ${field}. Must be 1 or -1`,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }
  }
}