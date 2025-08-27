import { EventEmitter } from 'events';
import {
  Cache,
  CacheEntry,
  CollectionData
} from '../types';
import { validateCollectionName } from '../utils/validation';

/**
 * Кэш в памяти с поддержкой TTL и автосохранения
 */
export class MemoryCache extends EventEmitter implements Cache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;
  private maxSize: number;
  private autoSaveInterval: number;
  private cleanupInterval?: NodeJS.Timeout;
  private autoSaveTimer?: NodeJS.Timeout;
  private isDirty = new Set<string>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    writes: 0
  };

  constructor(options: {
    ttl?: number;
    maxSize?: number;
    autoSaveInterval?: number;
  } = {}) {
    super();
    
    this.ttl = options.ttl || 300000; // 5 минут по умолчанию
    this.maxSize = options.maxSize || 100; // 100 коллекций по умолчанию
    this.autoSaveInterval = options.autoSaveInterval || 30000; // 30 секунд по умолчанию
    
    this.startCleanupTimer();
    this.startAutoSaveTimer();
  }

  /**
   * Получение данных из кэша
   */
  get(collectionName: string): CollectionData | null {
    validateCollectionName(collectionName);
    
    const entry = this.cache.get(collectionName);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Проверка TTL
    if (this.isExpired(entry)) {
      this.cache.delete(collectionName);
      this.isDirty.delete(collectionName);
      this.stats.misses++;
      this.emit('cache:expired', collectionName);
      return null;
    }

    // Обновляем время последнего доступа
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    return entry.data;
  }

  /**
   * Сохранение данных в кэш
   */
  set(collectionName: string, data: CollectionData, markDirty = true): void {
    validateCollectionName(collectionName);
    
    // Проверка лимита размера кэша
    if (this.cache.size >= this.maxSize && !this.cache.has(collectionName)) {
      this.evictLeastRecentlyUsed();
    }

    const now = Date.now();
    const entry: CacheEntry = {
      data: this.deepClone(data),
      timestamp: now,
      lastAccessed: now,
      ttl: this.ttl
    };

    this.cache.set(collectionName, entry);
    
    if (markDirty) {
      this.isDirty.add(collectionName);
    }
    
    this.stats.writes++;
    this.emit('cache:set', collectionName, data.records.length);
  }

  /**
   * Удаление из кэша
   */
  delete(collectionName: string): boolean {
    validateCollectionName(collectionName);
    
    const deleted = this.cache.delete(collectionName);
    this.isDirty.delete(collectionName);
    
    if (deleted) {
      this.emit('cache:deleted', collectionName);
    }
    
    return deleted;
  }

  /**
   * Проверка наличия в кэше
   */
  has(collectionName: string): boolean {
    validateCollectionName(collectionName);
    
    const entry = this.cache.get(collectionName);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(collectionName);
      this.isDirty.delete(collectionName);
      return false;
    }

    return true;
  }

  /**
   * Очистка всего кэша
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.isDirty.clear();
    this.emit('cache:cleared', size);
  }

  /**
   * Получение размера кэша
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Получение списка "грязных" коллекций
   */
  getDirtyCollections(): string[] {
    return Array.from(this.isDirty);
  }

  /**
   * Отметка коллекции как сохраненной
   */
  markClean(collectionName: string): void {
    validateCollectionName(collectionName);
    
    const entry = this.cache.get(collectionName);
    if (entry) {
      // Запись помечена как чистая
    }
    
    this.isDirty.delete(collectionName);
    this.emit('cache:cleaned', collectionName);
  }

  /**
   * Отметка коллекции как измененной
   */
  markDirty(collectionName: string): void {
    validateCollectionName(collectionName);
    
    const entry = this.cache.get(collectionName);
    if (entry) {
      // Запись помечена как грязная
      this.isDirty.add(collectionName);
      this.emit('cache:dirtied', collectionName);
    }
  }

  /**
   * Получение статистики кэша
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    writes: number;
    hitRate: number;
    dirtyCount: number;
  } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      writes: this.stats.writes,
      hitRate: Math.round(hitRate * 100) / 100,
      dirtyCount: this.isDirty.size
    };
  }

  /**
   * Принудительная очистка просроченных записей
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [collectionName, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now)) {
        this.cache.delete(collectionName);
        this.isDirty.delete(collectionName);
        cleaned++;
        this.emit('cache:expired', collectionName);
      }
    }
    
    if (cleaned > 0) {
      this.emit('cache:cleanup', cleaned);
    }
    
    return cleaned;
  }

  /**
   * Получение информации о коллекции в кэше
   */
  getCollectionInfo(collectionName: string): {
    exists: boolean;
    dirty: boolean;
    recordCount: number;
    lastAccessed: Date | null;
    age: number;
  } | null {
    validateCollectionName(collectionName);
    
    const entry = this.cache.get(collectionName);
    
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(collectionName);
      this.isDirty.delete(collectionName);
      return null;
    }

    return {
      exists: true,
      dirty: this.isDirty.has(collectionName),
      recordCount: entry.data.records.length,
      lastAccessed: new Date(entry.lastAccessed),
      age: Date.now() - entry.timestamp
    };
  }

  /**
   * Обновление TTL для коллекции
   */
  touch(collectionName: string): boolean {
    validateCollectionName(collectionName);
    
    const entry = this.cache.get(collectionName);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(collectionName);
      this.isDirty.delete(collectionName);
      return false;
    }

    entry.lastAccessed = Date.now();
    entry.timestamp = Date.now();
    
    return true;
  }

  /**
   * Остановка всех таймеров
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      // Таймер очистки остановлен
    }
    
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.clear();
    this.emit('cache:destroyed');
  }

  // Приватные методы

  private isExpired(entry: CacheEntry, now = Date.now()): boolean {
    return (now - entry.timestamp) > this.ttl;
  }

  private evictLeastRecentlyUsed(): void {
    let oldestTime = Date.now();
    let oldestKey = '';
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.isDirty.delete(oldestKey);
      this.stats.evictions++;
      this.emit('cache:evicted', oldestKey);
    }
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }
    
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }

  private startCleanupTimer(): void {
    // Очистка просроченных записей каждые 60 секунд
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private startAutoSaveTimer(): void {
    // Эмиссия события для автосохранения
    this.autoSaveTimer = setInterval(() => {
      const dirtyCollections = this.getDirtyCollections();
      if (dirtyCollections.length > 0) {
        this.emit('cache:autoSave', dirtyCollections);
      }
    }, this.autoSaveInterval);
  }
}