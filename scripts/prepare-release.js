#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * Скрипт подготовки к релизу
 * Проверяет готовность проекта к публикации на NPM
 */

class ReleasePreparation {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    switch (type) {
      case 'error':
        console.log(chalk.red(`[${timestamp}] ❌ ${message}`));
        break;
      case 'warning':
        console.log(chalk.yellow(`[${timestamp}] ⚠️  ${message}`));
        break;
      case 'success':
        console.log(chalk.green(`[${timestamp}] ✅ ${message}`));
        break;
      default:
        console.log(chalk.blue(`[${timestamp}] ℹ️  ${message}`));
    }
  }

  checkFile(filePath, required = true) {
    const fullPath = path.join(this.projectRoot, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      this.log(`Файл ${filePath} найден`, 'success');
      return true;
    } else {
      const message = `Файл ${filePath} не найден`;
      if (required) {
        this.errors.push(message);
        this.log(message, 'error');
      } else {
        this.warnings.push(message);
        this.log(message, 'warning');
      }
      return false;
    }
  }

  checkPackageJson() {
    this.log('Проверка package.json...');
    
    const packagePath = path.join(this.projectRoot, 'package.json');
    if (!this.checkFile('package.json')) {
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Проверка обязательных полей
      const requiredFields = ['name', 'version', 'description', 'main', 'types', 'author', 'license'];
      for (const field of requiredFields) {
        if (!packageJson[field]) {
          this.errors.push(`Отсутствует поле ${field} в package.json`);
          this.log(`Отсутствует поле ${field} в package.json`, 'error');
        }
      }

      // Проверка версии
      if (packageJson.version === '0.0.0' || packageJson.version === '1.0.0-dev') {
        this.warnings.push('Версия выглядит как development версия');
        this.log('Версия выглядит как development версия', 'warning');
      }

      // Проверка зависимостей
      if (!packageJson.peerDependencies || !packageJson.peerDependencies.payload) {
        this.errors.push('Отсутствует peerDependency на payload');
        this.log('Отсутствует peerDependency на payload', 'error');
      }

      // Проверка files
      if (!packageJson.files || !packageJson.files.includes('dist')) {
        this.errors.push('Поле files должно включать dist директорию');
        this.log('Поле files должно включать dist директорию', 'error');
      }

      this.log('Проверка package.json завершена', 'success');
      return true;
    } catch (error) {
      this.errors.push(`Ошибка чтения package.json: ${error.message}`);
      this.log(`Ошибка чтения package.json: ${error.message}`, 'error');
      return false;
    }
  }

  checkRequiredFiles() {
    this.log('Проверка обязательных файлов...');
    
    const requiredFiles = [
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'src/index.ts',
      'tsconfig.json'
    ];

    const optionalFiles = [
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'SECURITY.md',
      '.gitignore',
      '.github/workflows/ci.yml'
    ];

    requiredFiles.forEach(file => this.checkFile(file, true));
    optionalFiles.forEach(file => this.checkFile(file, false));
  }

  checkBuild() {
    this.log('Проверка сборки...');
    
    try {
      // Проверяем наличие dist директории
      const distPath = path.join(this.projectRoot, 'dist');
      if (!fs.existsSync(distPath)) {
        this.log('Директория dist не найдена, запускаем сборку...');
        execSync('npm run build', { cwd: this.projectRoot, stdio: 'inherit' });
      }

      // Проверяем основные файлы в dist
      const distFiles = [
        'dist/index.js',
        'dist/index.d.ts',
        'dist/cli/index.js'
      ];

      distFiles.forEach(file => this.checkFile(file, true));
      
      this.log('Проверка сборки завершена', 'success');
      return true;
    } catch (error) {
      this.errors.push(`Ошибка сборки: ${error.message}`);
      this.log(`Ошибка сборки: ${error.message}`, 'error');
      return false;
    }
  }

  checkTests() {
    this.log('Проверка тестов...');
    
    try {
      execSync('npm test', { cwd: this.projectRoot, stdio: 'pipe' });
      this.log('Все тесты прошли успешно', 'success');
      return true;
    } catch (error) {
      this.errors.push('Тесты не прошли');
      this.log('Тесты не прошли', 'error');
      return false;
    }
  }

  checkLinting() {
    this.log('Проверка линтинга...');
    
    try {
      execSync('npm run lint', { cwd: this.projectRoot, stdio: 'pipe' });
      this.log('Линтинг прошел успешно', 'success');
      return true;
    } catch (error) {
      this.warnings.push('Линтинг выявил проблемы');
      this.log('Линтинг выявил проблемы', 'warning');
      return false;
    }
  }

  checkGitStatus() {
    this.log('Проверка статуса Git...');
    
    try {
      const status = execSync('git status --porcelain', { cwd: this.projectRoot, encoding: 'utf8' });
      
      if (status.trim()) {
        this.warnings.push('Есть незакоммиченные изменения');
        this.log('Есть незакоммиченные изменения', 'warning');
        console.log(status);
        return false;
      } else {
        this.log('Рабочая директория чистая', 'success');
        return true;
      }
    } catch (error) {
      this.warnings.push('Не удалось проверить статус Git');
      this.log('Не удалось проверить статус Git', 'warning');
      return false;
    }
  }

  generateReleaseNotes() {
    this.log('Генерация release notes...');
    
    const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    const version = packageJson.version;
    
    const releaseNotes = `# Release ${version}

## 🚀 Новые возможности
- JSON Database Adapter для Payload CMS
- Шифрование данных AES-256-GCM
- Система кэширования с TTL
- CLI инструменты для управления
- Готовые шаблоны проектов
- TypeScript поддержка
- Serverless готовность

## 🔧 Технические улучшения
- Оптимизированная производительность
- Автоматическое сжатие данных
- Система мониторинга
- Comprehensive тестирование

## 📚 Документация
- Полная документация API
- Примеры использования
- Руководство по миграции
- Troubleshooting guide

## 🔒 Безопасность
- Шифрование файлов данных
- Валидация входных данных
- Аудит операций
- Безопасные настройки по умолчанию

---

Для полного списка изменений см. [CHANGELOG.md](./CHANGELOG.md)
`;

    const releaseNotesPath = path.join(this.projectRoot, 'RELEASE_NOTES.md');
    fs.writeFileSync(releaseNotesPath, releaseNotes);
    
    this.log(`Release notes созданы: ${releaseNotesPath}`, 'success');
  }

  async run() {
    console.log(chalk.bold.blue('🚀 Подготовка к релизу payload-db-json\n'));
    
    // Выполняем все проверки
    this.checkPackageJson();
    this.checkRequiredFiles();
    this.checkBuild();
    this.checkTests();
    this.checkLinting();
    this.checkGitStatus();
    
    // Генерируем release notes
    this.generateReleaseNotes();
    
    // Выводим результаты
    console.log('\n' + chalk.bold('📊 Результаты проверки:'));
    
    if (this.errors.length > 0) {
      console.log(chalk.red.bold('\n❌ Критические ошибки:'));
      this.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
    }
    
    if (this.warnings.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  Предупреждения:'));
      this.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
    }
    
    if (this.errors.length === 0) {
      console.log(chalk.green.bold('\n✅ Проект готов к публикации!'));
      console.log(chalk.blue('\n📋 Следующие шаги:'));
      console.log(chalk.blue('  1. npm login'));
      console.log(chalk.blue('  2. npm publish'));
      console.log(chalk.blue('  3. git tag v<version>'));
      console.log(chalk.blue('  4. git push --tags'));
      
      process.exit(0);
    } else {
      console.log(chalk.red.bold('\n❌ Исправьте ошибки перед публикацией'));
      process.exit(1);
    }
  }
}

// Запускаем проверку
if (require.main === module) {
  const preparation = new ReleasePreparation();
  preparation.run().catch(error => {
    console.error(chalk.red('Ошибка при подготовке к релизу:'), error);
    process.exit(1);
  });
}

module.exports = ReleasePreparation;