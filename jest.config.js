module.exports = {
  // Указываем среду выполнения тестов
  testEnvironment: 'node',

  // Корневая директория для поиска тестов
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Паттерны для поиска тестовых файлов
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],

  // Трансформация TypeScript файлов
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Расширения файлов для модулей
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Настройки покрытия кода
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Файлы для анализа покрытия
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}'
  ],

  // Пороги покрытия кода (временно снижены для отладки)
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 50,
      lines: 45,
      statements: 45
    }
  },

  // Настройки для ts-jest
  preset: 'ts-jest',
  
  // Глобальные настройки
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },

  // Файлы для настройки тестовой среды
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Очистка моков между тестами
  clearMocks: true,
  restoreMocks: true,

  // Таймаут для тестов (в миллисекундах)
  testTimeout: 10000,

  // Подробный вывод результатов
  verbose: true,

  // Игнорируемые пути
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Модули для игнорирования при трансформации
  transformIgnorePatterns: [
    '/node_modules/(?!(some-es6-module)/)',
  ],

  // Алиасы для модулей
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Настройки для работы с ESM модулями
  extensionsToTreatAsEsm: ['.ts'],

  // Дополнительные настройки для Node.js
  testEnvironmentOptions: {
    node: {
      // Включаем экспериментальные возможности Node.js если нужно
    }
  }
};