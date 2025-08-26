#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { JsonAdapter } from '../adapter/JsonAdapter';
import { DEFAULT_CONFIG } from '../config/defaults';
import { JsonAdapterConfig } from '../types';

const program = new Command();

program
  .name('payload-db-json')
  .description('CLI для управления Payload JSON Database Adapter')
  .version('1.0.0');

// Команда инициализации
program
  .command('init')
  .description('Инициализация нового проекта с JSON адаптером')
  .option('-d, --dir <directory>', 'Директория проекта', '.')
  .option('-t, --template <template>', 'Шаблон проекта', 'basic')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Инициализация Payload проекта с JSON адаптером...'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Название проекта:',
        default: path.basename(process.cwd()),
      },
      {
        type: 'list',
        name: 'template',
        message: 'Выберите шаблон:',
        choices: [
          { name: 'Базовый блог', value: 'basic-blog' },
          { name: 'E-commerce', value: 'ecommerce' },
          { name: 'Портфолио', value: 'portfolio' },
          { name: 'Пустой проект', value: 'blank' },
        ],
        default: options.template,
      },
      {
        type: 'confirm',
        name: 'useEncryption',
        message: 'Включить шифрование данных?',
        default: false,
      },
      {
        type: 'input',
        name: 'dataDir',
        message: 'Директория для данных:',
        default: './data',
      },
    ]);

    await initializeProject(options.dir, answers);
  });

// Команда миграции
program
  .command('migrate')
  .description('Миграция данных из другой базы данных')
  .option('-f, --from <source>', 'Источник данных (mongodb, postgres, mysql)')
  .option('-c, --config <config>', 'Путь к конфигурационному файлу')
  .action(async (options) => {
    console.log(chalk.blue('📦 Запуск миграции данных...'));
    await runMigration(options);
  });

// Команда резервного копирования
program
  .command('backup')
  .description('Создание резервной копии данных')
  .option('-o, --output <path>', 'Путь для сохранения резервной копии')
  .option('-c, --compress', 'Сжать резервную копию')
  .action(async (options) => {
    console.log(chalk.blue('💾 Создание резервной копии...'));
    await createBackup(options);
  });

// Команда восстановления
program
  .command('restore')
  .description('Восстановление данных из резервной копии')
  .option('-i, --input <path>', 'Путь к резервной копии')
  .option('-f, --force', 'Принудительное восстановление')
  .action(async (options) => {
    console.log(chalk.blue('🔄 Восстановление данных...'));
    await restoreBackup(options);
  });

// Команда валидации
program
  .command('validate')
  .description('Валидация целостности данных')
  .option('-d, --data-dir <path>', 'Путь к директории данных', './data')
  .option('--fix', 'Автоматически исправить найденные проблемы')
  .action(async (options) => {
    console.log(chalk.blue('🔍 Валидация данных...'));
    await validateData(options);
  });

// Команда статистики
program
  .command('stats')
  .description('Показать статистику базы данных')
  .option('-d, --data-dir <path>', 'Путь к директории данных', './data')
  .option('-j, --json', 'Вывод в формате JSON')
  .action(async (options) => {
    await showStats(options);
  });

// Команда очистки кэша
program
  .command('clear-cache')
  .description('Очистка кэша адаптера')
  .option('-d, --data-dir <path>', 'Путь к директории данных', './data')
  .action(async (options) => {
    console.log(chalk.blue('🧹 Очистка кэша...'));
    await clearCache(options);
  });

// Функции реализации команд

async function initializeProject(dir: string, config: any) {
  try {
    const projectPath = path.resolve(dir);
    
    // Создаем структуру проекта
    await fs.ensureDir(projectPath);
    await fs.ensureDir(path.join(projectPath, 'src'));
    await fs.ensureDir(path.join(projectPath, config.dataDir));
    await fs.ensureDir(path.join(projectPath, 'uploads'));
    
    // Копируем шаблон
    const templatePath = path.join(__dirname, '../../examples', config.template);
    if (await fs.pathExists(templatePath)) {
      await fs.copy(templatePath, projectPath, {
        filter: (src) => !src.includes('node_modules') && !src.includes('.git'),
      });
    }
    
    // Создаем package.json
    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: `Payload CMS project with JSON Database Adapter`,
      main: 'dist/server.js',
      scripts: {
        dev: 'cross-env NODE_ENV=development nodemon src/server.ts',
        build: 'tsc',
        start: 'cross-env NODE_ENV=production node dist/server.js',
        'generate:types': 'cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts payload generate:types',
        'generate:graphQLSchema': 'cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts payload generate:graphQLSchema',
      },
      dependencies: {
        payload: '^2.0.0',
        'payload-db-json': '^1.0.0',
        express: '^4.18.0',
        'cross-env': '^7.0.3',
      },
      devDependencies: {
        '@types/express': '^4.17.0',
        '@types/node': '^20.0.0',
        nodemon: '^3.0.0',
        'ts-node': '^10.9.0',
        typescript: '^5.0.0',
      },
    };
    
    await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });
    
    // Создаем .env файл
    const envContent = `PAYLOAD_SECRET=${generateSecret()}
PORT=3000
JSON_DB_DATA_DIR=${config.dataDir}
JSON_DB_ENABLE_ENCRYPTION=${config.useEncryption}
${config.useEncryption ? `JSON_DB_ENCRYPTION_KEY=${generateEncryptionKey()}` : ''}`;
    
    await fs.writeFile(path.join(projectPath, '.env'), envContent);
    
    console.log(chalk.green('✅ Проект успешно инициализирован!'));
    console.log(chalk.yellow('📋 Следующие шаги:'));
    console.log(chalk.white('1. cd ' + config.projectName));
    console.log(chalk.white('2. npm install'));
    console.log(chalk.white('3. npm run dev'));
    
  } catch (error) {
    console.error(chalk.red('❌ Ошибка инициализации:'), error);
    process.exit(1);
  }
}

async function runMigration(options: any) {
  // Реализация миграции данных
  console.log(chalk.yellow('⚠️  Функция миграции будет реализована в следующих версиях'));
}

async function createBackup(options: any) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = options.output || `./backup-${timestamp}`;
    
    await fs.ensureDir(backupPath);
    await fs.copy('./data', path.join(backupPath, 'data'));
    await fs.copy('./uploads', path.join(backupPath, 'uploads'));
    
    if (options.compress) {
      // Реализация сжатия
      console.log(chalk.yellow('⚠️  Сжатие будет реализовано в следующих версиях'));
    }
    
    console.log(chalk.green(`✅ Резервная копия создана: ${backupPath}`));
  } catch (error) {
    console.error(chalk.red('❌ Ошибка создания резервной копии:'), error);
  }
}

async function restoreBackup(options: any) {
  try {
    if (!options.input) {
      console.error(chalk.red('❌ Укажите путь к резервной копии'));
      return;
    }
    
    if (!options.force) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Это действие перезапишет текущие данные. Продолжить?',
          default: false,
        },
      ]);
      
      if (!confirm.proceed) {
        console.log(chalk.yellow('Операция отменена'));
        return;
      }
    }
    
    await fs.remove('./data');
    await fs.remove('./uploads');
    
    await fs.copy(path.join(options.input, 'data'), './data');
    await fs.copy(path.join(options.input, 'uploads'), './uploads');
    
    console.log(chalk.green('✅ Данные успешно восстановлены'));
  } catch (error) {
    console.error(chalk.red('❌ Ошибка восстановления:'), error);
  }
}

async function validateData(options: any) {
  try {
    const config: JsonAdapterConfig = {
      ...DEFAULT_CONFIG,
      dataDir: options.dataDir,
    };
    
    const adapter = new JsonAdapter(config);
    await adapter.connect();
    
    // Проверяем целостность данных
    const collections = await fs.readdir(options.dataDir);
    let issues = 0;
    
    for (const collection of collections) {
      const collectionPath = path.join(options.dataDir, collection);
      const stat = await fs.stat(collectionPath);
      
      if (stat.isDirectory()) {
        console.log(chalk.blue(`Проверка коллекции: ${collection}`));
        
        try {
          const files = await fs.readdir(collectionPath);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const filePath = path.join(collectionPath, file);
              const content = await fs.readJson(filePath);
              
              // Базовая валидация JSON
              if (!content.id) {
                console.log(chalk.red(`  ❌ Отсутствует ID в файле: ${file}`));
                issues++;
                
                if (options.fix) {
                  content.id = path.basename(file, '.json');
                  await fs.writeJson(filePath, content, { spaces: 2 });
                  console.log(chalk.green(`  ✅ Исправлено: добавлен ID`));
                }
              }
            }
          }
        } catch (error) {
          console.log(chalk.red(`  ❌ Ошибка чтения коллекции: ${error}`));
          issues++;
        }
      }
    }
    
    if (issues === 0) {
      console.log(chalk.green('✅ Данные валидны, проблем не найдено'));
    } else {
      console.log(chalk.yellow(`⚠️  Найдено проблем: ${issues}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Ошибка валидации:'), error);
  }
}

async function showStats(options: any) {
  try {
    const config: JsonAdapterConfig = {
      ...DEFAULT_CONFIG,
      dataDir: options.dataDir,
    };
    
    const adapter = new JsonAdapter(config);
    await adapter.connect();
    
    const stats = await adapter.getStats();
    
    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(chalk.blue('📊 Статистика базы данных:'));
      console.log(chalk.white(`Коллекций: ${stats.collections}`));
      console.log(chalk.white(`Документов: ${stats.documents}`));
      console.log(chalk.white(`Размер данных: ${formatBytes(stats.dataSize)}`));
      console.log(chalk.white(`Кэш попаданий: ${stats.cacheHits}`));
      console.log(chalk.white(`Кэш промахов: ${stats.cacheMisses}`));
      console.log(chalk.white(`Последнее изменение: ${stats.lastModified}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Ошибка получения статистики:'), error);
  }
}

async function clearCache(options: any) {
  try {
    const cachePath = path.join(options.dataDir, '.cache');
    
    if (await fs.pathExists(cachePath)) {
      await fs.remove(cachePath);
      console.log(chalk.green('✅ Кэш очищен'));
    } else {
      console.log(chalk.yellow('⚠️  Кэш не найден'));
    }
  } catch (error) {
    console.error(chalk.red('❌ Ошибка очистки кэша:'), error);
  }
}

// Утилиты

function generateSecret(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

function generateEncryptionKey(): string {
  return require('crypto').randomBytes(16).toString('hex');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

program.parse();

export default program;