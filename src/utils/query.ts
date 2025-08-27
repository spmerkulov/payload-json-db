import {
  JsonRecord,
  QueryOptions,
  QueryResult,
  JsonAdapterError,
  ErrorCodes
} from '../types';
import { validateQueryOptions } from './validation';

/**
 * Утилиты для работы с запросами к данным
 */
export class QueryProcessor {
  /**
   * Поиск одной записи по условиям
   */
  static findOne<T extends JsonRecord>(
    records: T[],
    where: Record<string, any>
  ): T | null {
    for (const record of records) {
      if (this.matchesFilter(record, where)) {
        return record;
      }
    }
    return null;
  }

  /**
   * Обработка запроса с фильтрацией, сортировкой и пагинацией
   */
  static processQuery<T extends JsonRecord>(
    records: T[],
    options: QueryOptions
  ): QueryResult<T> {
    validateQueryOptions(options);

    let filteredRecords = [...records];

    // Применяем фильтры
    if (options.where) {
      filteredRecords = this.applyFilters(filteredRecords, options.where);
    }

    const totalFilteredDocs = filteredRecords.length;

    // Применяем сортировку
    if (options.sort) {
      filteredRecords = this.applySorting(filteredRecords, options.sort);
    }

    // Применяем пагинацию
    const { docs, pagination } = this.applyPagination(
      filteredRecords,
      options.limit,
      options.page
    );

    return {
      docs,
      totalDocs: totalFilteredDocs,
      limit: options.limit || totalFilteredDocs,
      page: options.page || 1,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
      nextPage: pagination.nextPage ?? null,
      prevPage: pagination.prevPage ?? null,
      pagingCounter: pagination.pagingCounter
    };
  }



  /**
   * Поиск записи по ID
   */
  static findById<T extends JsonRecord>(
    records: T[],
    id: string
  ): T | null {
    return records.find(record => record.id === id) || null;
  }

  /**
   * Применение фильтров к записям
   */
  private static applyFilters<T extends JsonRecord>(
    records: T[],
    where: Record<string, any>
  ): T[] {
    return records.filter(record => this.matchesFilter(record, where));
  }

  /**
   * Проверка соответствия записи фильтру
   */
  private static matchesFilter(
    record: JsonRecord,
    filter: Record<string, any>
  ): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (!this.matchesFieldFilter(record, key, value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Проверка соответствия поля фильтру
   */
  private static matchesFieldFilter(
    record: JsonRecord,
    fieldPath: string,
    filterValue: any
  ): boolean {
    const recordValue = this.getNestedValue(record, fieldPath);

    // Обработка операторов MongoDB-стиля
    if (typeof filterValue === 'object' && filterValue !== null && !Array.isArray(filterValue)) {
      return this.applyOperators(recordValue, filterValue);
    }

    // Простое сравнение
    return this.compareValues(recordValue, filterValue);
  }

  /**
   * Применение операторов фильтрации
   */
  private static applyOperators(recordValue: any, operators: Record<string, any>): boolean {
    for (const [operator, operatorValue] of Object.entries(operators)) {
      switch (operator) {
        case '$eq':
          if (!this.compareValues(recordValue, operatorValue)) return false;
          break;
        case '$ne':
          if (this.compareValues(recordValue, operatorValue)) return false;
          break;
        case '$gt':
          if (recordValue <= operatorValue) return false;
          break;
        case '$gte':
          if (recordValue < operatorValue) return false;
          break;
        case '$lt':
          if (recordValue >= operatorValue) return false;
          break;
        case '$lte':
          if (recordValue > operatorValue) return false;
          break;
        case '$in':
          if (!Array.isArray(operatorValue) || !operatorValue.includes(recordValue)) return false;
          break;
        case '$nin':
          if (!Array.isArray(operatorValue) || operatorValue.includes(recordValue)) return false;
          break;
        case '$exists':
          const exists = recordValue !== undefined && recordValue !== null;
          if (exists !== operatorValue) return false;
          break;
        case '$regex':
          if (typeof recordValue !== 'string') return false;
          const regex = new RegExp(operatorValue, operators['$options'] || '');
          if (!regex.test(recordValue)) return false;
          break;
        case '$size':
          if (!Array.isArray(recordValue) || recordValue.length !== operatorValue) return false;
          break;
        case '$all':
          if (!Array.isArray(recordValue) || !Array.isArray(operatorValue)) return false;
          if (!operatorValue.every(val => recordValue.includes(val))) return false;
          break;
        case '$elemMatch':
          if (!Array.isArray(recordValue)) return false;
          if (!recordValue.some(item => this.matchesFilter(item, operatorValue))) return false;
          break;
        default:
          throw new JsonAdapterError(
            `Unsupported query operator: ${operator}`,
            ErrorCodes.VALIDATION_ERROR
          );
      }
    }
    return true;
  }

  /**
   * Сравнение значений
   */
  private static compareValues(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((val, index) => this.compareValues(val, b[index]));
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      return keysA.length === keysB.length && 
             keysA.every(key => this.compareValues(a[key], b[key]));
    }
    
    return false;
  }

  /**
   * Получение вложенного значения по пути
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Применение сортировки
   */
  private static applySorting<T extends JsonRecord>(
    records: T[],
    sort: Record<string, 1 | -1 | 'asc' | 'desc'>
  ): T[] {
    return records.sort((a, b) => {
      for (const [field, direction] of Object.entries(sort)) {
        const aValue = this.getNestedValue(a, field);
        const bValue = this.getNestedValue(b, field);
        
        const comparison = this.compareForSort(aValue, bValue);
        
        if (comparison !== 0) {
          const isDescending = direction === -1 || direction === 'desc';
          return isDescending ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Сравнение значений для сортировки
   */
  private static compareForSort(a: any, b: any): number {
    // Обработка null и undefined
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    // Обработка разных типов
    const typeA = typeof a;
    const typeB = typeof b;
    
    if (typeA !== typeB) {
      return typeA < typeB ? -1 : 1;
    }

    // Сравнение одинаковых типов
    if (typeA === 'string') {
      return a.localeCompare(b);
    }
    
    if (typeA === 'number' || typeA === 'boolean') {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }
    
    // Для объектов и массивов сравниваем строковое представление
    const strA = JSON.stringify(a);
    const strB = JSON.stringify(b);
    return strA.localeCompare(strB);
  }

  /**
   * Применение пагинации
   */
  private static applyPagination<T>(
    records: T[],
    limit?: number,
    page?: number
  ): {
    docs: T[];
    pagination: {
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
      nextPage: number | null;
      prevPage: number | null;
      pagingCounter: number;
    };
  } {
    const totalDocs = records.length;
    
    if (!limit || limit <= 0) {
      return {
        docs: records,
        pagination: {
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          nextPage: null,
          prevPage: null,
          pagingCounter: 1
        }
      };
    }

    const currentPage = Math.max(1, page || 1);
    const totalPages = Math.ceil(totalDocs / limit);
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalDocs);
    
    const docs = records.slice(startIndex, endIndex);
    
    return {
      docs,
      pagination: {
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null,
        pagingCounter: startIndex + 1
      }
    };
  }
}

/**
 * Утилиты для создания индексов в памяти
 */
export class IndexManager {
  private indexes = new Map<string, Map<any, string[]>>();

  /**
   * Создание индекса для поля
   */
  createIndex<T extends JsonRecord>(records: T[], fieldPath: string): void {
    const index = new Map<any, string[]>();
    
    for (const record of records) {
      const value = QueryProcessor['getNestedValue'](record, fieldPath);
      const key = this.normalizeIndexKey(value);
      
      if (!index.has(key)) {
        index.set(key, []);
      }
      
      index.get(key)!.push(record.id);
    }
    
    this.indexes.set(fieldPath, index);
  }

  /**
   * Поиск по индексу
   */
  findByIndex(fieldPath: string, value: any): string[] {
    const index = this.indexes.get(fieldPath);
    if (!index) {
      return [];
    }
    
    const key = this.normalizeIndexKey(value);
    return index.get(key) || [];
  }

  /**
   * Обновление индекса при изменении записи
   */
  updateIndex(
    fieldPath: string,
    recordId: string,
    oldValue: any,
    newValue: any
  ): void {
    const index = this.indexes.get(fieldPath);
    if (!index) {
      return;
    }
    
    // Удаляем из старого значения
    if (oldValue !== undefined) {
      const oldKey = this.normalizeIndexKey(oldValue);
      const oldIds = index.get(oldKey);
      if (oldIds) {
        const filteredIds = oldIds.filter(id => id !== recordId);
        if (filteredIds.length === 0) {
          index.delete(oldKey);
        } else {
          index.set(oldKey, filteredIds);
        }
      }
    }
    
    // Добавляем к новому значению
    if (newValue !== undefined) {
      const newKey = this.normalizeIndexKey(newValue);
      if (!index.has(newKey)) {
        index.set(newKey, []);
      }
      index.get(newKey)!.push(recordId);
    }
  }

  /**
   * Удаление записи из всех индексов
   */
  removeFromIndexes(recordId: string): void {
    for (const [_fieldPath, index] of this.indexes.entries()) {
      for (const [key, ids] of index.entries()) {
        const filteredIds = ids.filter(id => id !== recordId);
        if (filteredIds.length === 0) {
          index.delete(key);
        } else {
          index.set(key, filteredIds);
        }
      }
    }
  }

  /**
   * Очистка всех индексов
   */
  clearIndexes(): void {
    this.indexes.clear();
  }

  /**
   * Получение информации об индексах
   */
  getIndexInfo(): Record<string, { keyCount: number; totalRecords: number }> {
    const info: Record<string, { keyCount: number; totalRecords: number }> = {};
    
    for (const [fieldPath, index] of this.indexes.entries()) {
      let totalRecords = 0;
      for (const ids of index.values()) {
        totalRecords += ids.length;
      }
      
      info[fieldPath] = {
        keyCount: index.size,
        totalRecords
      };
    }
    
    return info;
  }

  private normalizeIndexKey(value: any): string {
    if (value === null || value === undefined) {
      return '__NULL__';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }
}