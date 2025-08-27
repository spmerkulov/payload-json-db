import { createCipher, createDecipher, randomBytes, createHash } from 'crypto';
import {
  Encryption,
  JsonAdapterError,
  ErrorCodes
} from '../types';

/**
 * AES шифрование для защиты данных в JSON файлах
 */
export class AESEncryption implements Encryption {
  private algorithm: string;
  private key: Buffer;
  private keyHash: string;

  constructor(encryptionKey: string, algorithm = 'aes-256-cbc') {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new JsonAdapterError(
        'Encryption key must be at least 32 characters long',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    this.algorithm = algorithm;
    this.key = this.deriveKey(encryptionKey);
    this.keyHash = this.generateKeyHash(encryptionKey);
  }

  /**
   * Шифрование данных
   */
  encrypt(data: string): string {
    try {
      // Генерируем случайный IV (Initialization Vector)
      const iv = randomBytes(16);
      
      // Создаем шифр
      const cipher = createCipher(this.algorithm, this.key);
      
      // Шифруем данные
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Объединяем IV и зашифрованные данные
      const result = {
        iv: iv.toString('hex'),
        data: encrypted,
        algorithm: this.algorithm,
        keyHash: this.keyHash,
        timestamp: Date.now()
      };
      
      return JSON.stringify(result);
      
    } catch (error) {
      throw new JsonAdapterError(
        `Encryption failed: ${(error as Error).message}`,
        ErrorCodes.ENCRYPTION_ERROR
      );
    }
  }

  /**
   * Расшифровка данных
   */
  decrypt(encryptedData: string): string {
    try {
      const parsed = JSON.parse(encryptedData);
      
      // Проверяем структуру зашифрованных данных
      if (!parsed.iv || !parsed.data || !parsed.algorithm) {
        throw new Error('Invalid encrypted data structure');
      }
      
      // Проверяем совместимость ключа
      if (parsed.keyHash && parsed.keyHash !== this.keyHash) {
        throw new Error('Invalid encryption key');
      }
      
      // Проверяем совместимость алгоритма
      if (parsed.algorithm !== this.algorithm) {
        throw new Error(`Algorithm mismatch: expected ${this.algorithm}, got ${parsed.algorithm}`);
      }
      
      // Создаем дешифратор
      const decipher = createDecipher(this.algorithm, this.key);
      
      // Расшифровываем данные
      let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      throw new JsonAdapterError(
        `Decryption failed: ${(error as Error).message}`,
        ErrorCodes.ENCRYPTION_ERROR
      );
    }
  }

  /**
   * Проверка, являются ли данные зашифрованными
   */
  isEncrypted(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return !!(parsed.iv && parsed.data && parsed.algorithm);
    } catch {
      return false;
    }
  }

  /**
   * Проверка, включено ли шифрование
   */
  isEnabled(): boolean {
    return true;
  }

  /**
   * Получение информации о шифровании
   */
  getEncryptionInfo(): {
    algorithm: string;
    keyHash: string;
    keyLength: number;
  } {
    return {
      algorithm: this.algorithm,
      keyHash: this.keyHash,
      keyLength: this.key.length
    };
  }

  /**
   * Смена ключа шифрования
   */
  changeKey(newEncryptionKey: string): void {
    if (!newEncryptionKey || newEncryptionKey.length < 32) {
      throw new JsonAdapterError(
        'New encryption key must be at least 32 characters long',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    this.key = this.deriveKey(newEncryptionKey);
    this.keyHash = this.generateKeyHash(newEncryptionKey);
  }

  /**
   * Повторное шифрование данных с новым ключом
   */
  reencrypt(encryptedData: string, oldKey: string): string {
    // Создаем временный экземпляр с старым ключом
    const oldEncryption = new AESEncryption(oldKey, this.algorithm);
    
    // Расшифровываем старым ключом
    const decryptedData = oldEncryption.decrypt(encryptedData);
    
    // Шифруем новым ключом
    return this.encrypt(decryptedData);
  }

  /**
   * Проверка целостности зашифрованных данных
   */
  verifyIntegrity(encryptedData: string): boolean {
    try {
      const parsed = JSON.parse(encryptedData);
      
      // Базовые проверки структуры
      if (!parsed.iv || !parsed.data || !parsed.algorithm) {
        return false;
      }
      
      // Проверка длины IV
      if (Buffer.from(parsed.iv, 'hex').length !== 16) {
        return false;
      }
      
      // Проверка формата зашифрованных данных
      if (!/^[0-9a-f]+$/i.test(parsed.data)) {
        return false;
      }
      
      // Проверка временной метки (если есть)
      if (parsed.timestamp && (typeof parsed.timestamp !== 'number' || parsed.timestamp <= 0)) {
        return false;
      }
      
      return true;
      
    } catch {
      return false;
    }
  }

  /**
   * Генерация случайного ключа шифрования
   */
  static generateKey(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Проверка силы ключа
   */
  static validateKeyStrength(key: string): {
    isValid: boolean;
    score: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let score = 0;
    
    // Проверка длины
    if (key.length < 32) {
      recommendations.push('Key should be at least 32 characters long');
    } else {
      score += 25;
    }
    
    // Проверка на наличие цифр
    if (/\d/.test(key)) {
      score += 15;
    } else {
      recommendations.push('Key should contain numbers');
    }
    
    // Проверка на наличие букв в верхнем регистре
    if (/[A-Z]/.test(key)) {
      score += 15;
    } else {
      recommendations.push('Key should contain uppercase letters');
    }
    
    // Проверка на наличие букв в нижнем регистре
    if (/[a-z]/.test(key)) {
      score += 15;
    } else {
      recommendations.push('Key should contain lowercase letters');
    }
    
    // Проверка на наличие специальных символов
    if (/[^A-Za-z0-9]/.test(key)) {
      score += 20;
    } else {
      recommendations.push('Key should contain special characters');
    }
    
    // Проверка на повторяющиеся символы
    const uniqueChars = new Set(key).size;
    const uniqueRatio = uniqueChars / key.length;
    if (uniqueRatio > 0.7) {
      score += 10;
    } else {
      recommendations.push('Key should have more unique characters');
    }
    
    return {
      isValid: score >= 70,
      score,
      recommendations
    };
  }

  // Приватные методы

  private deriveKey(password: string): Buffer {
    // Используем SHA-256 для создания ключа фиксированной длины
    return createHash('sha256').update(password).digest();
  }

  private generateKeyHash(key: string): string {
    // Создаем хэш ключа для проверки совместимости
    return createHash('sha256').update(key).digest('hex').substring(0, 16);
  }
}

/**
 * Утилиты для работы с шифрованием
 */
export class EncryptionUtils {
  /**
   * Безопасное сравнение строк (защита от timing attacks)
   */
  static safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Генерация соли для хэширования
   */
  static generateSalt(length = 16): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Хэширование с солью
   */
  static hashWithSalt(data: string, salt: string): string {
    return createHash('sha256').update(data + salt).digest('hex');
  }

  /**
   * Проверка доступности криптографических функций
   */
  static checkCryptoSupport(): {
    available: boolean;
    algorithms: string[];
    error?: string;
  } {
    try {
      const crypto = require('crypto');
      const algorithms = crypto.getCiphers();
      
      return {
        available: true,
        algorithms
      };
    } catch (error) {
      return {
        available: false,
        algorithms: [],
        error: (error as Error).message
      };
    }
  }
}