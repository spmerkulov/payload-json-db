import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Глобальная настройка тестовой среды
 */

// Увеличиваем таймаут для тестов с файловыми операциями
jest.setTimeout(30000);

// Глобальные переменные для тестов
declare global {
  var TEST_DATA_DIR: string;
  var TEST_TEMP_DIR: string;
  var TEST_COLLECTIONS: string[];
}

// Настройка временных директорий для тестов
beforeAll(async () => {
  // Создаем временную директорию для тестовых данных
  const tempDir = join(tmpdir(), 'payload-json-adapter-tests');
  global.TEST_DATA_DIR = join(tempDir, 'data');
  global.TEST_TEMP_DIR = join(tempDir, 'temp');
  
  // Создаем директории
  await fs.mkdir(global.TEST_DATA_DIR, { recursive: true });
  await fs.mkdir(global.TEST_TEMP_DIR, { recursive: true });
  
  // Список тестовых коллекций
  global.TEST_COLLECTIONS = ['users', 'posts', 'categories', 'settings'];
});

// Очистка после всех тестов
afterAll(async () => {
  try {
    // Удаляем временные файлы и директории
    await fs.rmdir(global.TEST_DATA_DIR, { recursive: true });
    await fs.rmdir(global.TEST_TEMP_DIR, { recursive: true });
  } catch (error) {
    // Игнорируем ошибки очистки
    console.warn('Failed to cleanup test directories:', error);
  }
});

// Очистка между тестами
afterEach(async () => {
  try {
    // Очищаем тестовые файлы данных
    const files = await fs.readdir(global.TEST_DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(join(global.TEST_DATA_DIR, file));
      }
    }
  } catch (error) {
    // Игнорируем ошибки если директория не существует
  }
});

// Утилиты для тестов
export const TestUtils = {
  /**
   * Создание тестовых данных
   */
  createTestRecord: (id?: string, overrides: Record<string, any> = {}) => {
    return {
      id: id || `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'Test Record',
      status: 'active',
      ...overrides
    };
  },

  /**
   * Создание множественных тестовых записей
   */
  createTestRecords: (count: number, baseData: Record<string, any> = {}) => {
    return Array.from({ length: count }, (_, index) => 
      TestUtils.createTestRecord(`test-${index}`, {
        ...baseData,
        name: `Test Record ${index}`,
        index
      })
    );
  },

  /**
   * Создание тестовой коллекции
   */
  createTestCollection: (name: string, recordCount = 5) => {
    return {
      metadata: {
        name,
        count: recordCount,
        lastModified: new Date(),
        version: 1,
        indexes: []
      },
      records: TestUtils.createTestRecords(recordCount)
    };
  },

  /**
   * Ожидание выполнения асинхронной операции
   */
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Генерация случайной строки
   */
  randomString: (length = 10) => {
    return Math.random().toString(36).substring(2, 2 + length);
  },

  /**
   * Генерация случайного числа в диапазоне
   */
  randomNumber: (min = 0, max = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Проверка существования файла
   */
  fileExists: async (filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Чтение JSON файла
   */
  readJsonFile: async (filePath: string) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  },

  /**
   * Запись JSON файла
   */
  writeJsonFile: async (filePath: string, data: any) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  },

  /**
   * Получение размера файла
   */
  getFileSize: async (filePath: string) => {
    const stats = await fs.stat(filePath);
    return stats.size;
  },

  /**
   * Создание временного файла
   */
  createTempFile: async (content: string, extension = '.json') => {
    const fileName = `temp-${Date.now()}-${TestUtils.randomString()}${extension}`;
    const filePath = join(global.TEST_TEMP_DIR, fileName);
    await fs.writeFile(filePath, content);
    return filePath;
  },

  /**
   * Очистка временных файлов
   */
  cleanupTempFiles: async () => {
    try {
      const files = await fs.readdir(global.TEST_TEMP_DIR);
      for (const file of files) {
        await fs.unlink(join(global.TEST_TEMP_DIR, file));
      }
    } catch (error) {
      // Игнорируем ошибки очистки
    }
  },

  /**
   * Создает временную директорию для тестов
   */
  createTempDir: async (prefix: string) => {
    const tempDir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  },

  /**
   * Очищает временную директорию
   */
  cleanupTempDir: async (dirPath: string) => {
    try {
      await fs.rmdir(dirPath, { recursive: true });
    } catch (error) {
      // Игнорируем ошибки очистки
    }
  },
};

// Экспорт для использования в тестах
export { global as testGlobals };

// Настройка консольных сообщений для тестов
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Подавляем некоторые предупреждения в тестах
console.error = (...args: any[]) => {
  const message = args[0];
  if (typeof message === 'string') {
    // Подавляем известные предупреждения
    if (message.includes('Warning: ') || message.includes('DeprecationWarning:')) {
      return;
    }
  }
  originalConsoleError.apply(console, args);
};

console.warn = (...args: any[]) => {
  const message = args[0];
  if (typeof message === 'string') {
    // Подавляем известные предупреждения
    if (message.includes('Warning: ') || message.includes('DeprecationWarning:')) {
      return;
    }
  }
  originalConsoleWarn.apply(console, args);
};

// Восстанавливаем оригинальные функции после тестов
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});