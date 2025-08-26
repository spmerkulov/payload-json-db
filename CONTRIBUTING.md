# Руководство для контрибьюторов

Спасибо за интерес к развитию Payload JSON Database Adapter! Мы ценим любой вклад в проект.

## 🚀 Быстрый старт

### Настройка окружения разработки

1. **Форк репозитория**
   ```bash
   # Форкните репозиторий на GitHub, затем клонируйте свой форк
   git clone https://github.com/your-username/payload-db-json.git
   cd payload-db-json
   ```

2. **Установка зависимостей**
   ```bash
   npm install
   ```

3. **Настройка окружения**
   ```bash
   cp .env.example .env
   # Отредактируйте .env файл при необходимости
   ```

4. **Запуск тестов**
   ```bash
   npm test
   ```

5. **Сборка проекта**
   ```bash
   npm run build
   ```

## 📋 Типы вкладов

Мы приветствуем следующие типы вкладов:

- 🐛 **Исправление багов**
- ✨ **Новые функции**
- 📚 **Улучшение документации**
- 🧪 **Добавление тестов**
- 🎨 **Улучшение кода**
- 🔧 **Инфраструктура и инструменты**

## 🔄 Процесс разработки

### 1. Создание Issue

Перед началом работы создайте или найдите существующий Issue:

- **Bug Report**: Используйте шаблон для описания бага
- **Feature Request**: Опишите предлагаемую функциональность
- **Documentation**: Укажите, какую документацию нужно улучшить

### 2. Создание ветки

```bash
# Создайте ветку от main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Или для исправления бага
git checkout -b fix/bug-description
```

### 3. Разработка

#### Структура проекта

```
src/
├── adapters/          # Основная логика адаптера
├── cache/             # Система кэширования
├── cli/               # CLI инструменты
├── encryption/        # Шифрование данных
├── file-manager/      # Управление файлами
├── types/             # TypeScript типы
├── utils/             # Утилиты
└── index.ts           # Главный экспорт

tests/                 # Тесты
examples/              # Примеры проектов
docs/                  # Документация
```

#### Стандарты кода

- **TypeScript**: Используйте строгую типизацию
- **ESLint**: Следуйте правилам линтера
- **Prettier**: Автоматическое форматирование
- **Комментарии**: JSDoc для публичных API

```typescript
/**
 * Создает новый экземпляр JSON адаптера
 * @param config - Конфигурация адаптера
 * @returns Экземпляр адаптера базы данных
 */
export function jsonAdapter(config: JsonAdapterConfig): DatabaseAdapter {
  // Реализация
}
```

### 4. Тестирование

#### Запуск тестов

```bash
# Все тесты
npm test

# Тесты с покрытием
npm run test:coverage

# Тесты в watch режиме
npm run test:watch

# Конкретный тест
npm test -- --testNamePattern="FileManager"
```

#### Написание тестов

- **Unit тесты**: Для каждого модуля
- **Integration тесты**: Для взаимодействия компонентов
- **E2E тесты**: Для CLI и полных сценариев

```typescript
// Пример unit теста
describe('FileManager', () => {
  let fileManager: FileManager;

  beforeEach(() => {
    fileManager = new FileManager({ dataDir: './test-data' });
  });

  it('should create collection file', async () => {
    const result = await fileManager.createCollection('users');
    expect(result).toBeTruthy();
  });
});
```

### 5. Документация

Обновите документацию при необходимости:

- **README.md**: Основная документация
- **API документация**: JSDoc комментарии
- **Примеры**: В папке `examples/`
- **Changelog**: Добавьте изменения

### 6. Коммиты

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Примеры коммитов
git commit -m "feat: add encryption support for data files"
git commit -m "fix: resolve memory leak in cache system"
git commit -m "docs: update installation guide"
git commit -m "test: add unit tests for FileManager"
git commit -m "refactor: improve error handling in adapter"
```

**Типы коммитов:**
- `feat`: Новая функциональность
- `fix`: Исправление бага
- `docs`: Изменения в документации
- `test`: Добавление или изменение тестов
- `refactor`: Рефакторинг кода
- `perf`: Улучшение производительности
- `chore`: Изменения в сборке или инструментах

### 7. Pull Request

#### Подготовка PR

```bash
# Убедитесь, что все тесты проходят
npm test
npm run lint
npm run build

# Обновите свою ветку
git checkout main
git pull origin main
git checkout your-branch
git rebase main

# Отправьте изменения
git push origin your-branch
```

#### Создание PR

1. Откройте PR на GitHub
2. Заполните шаблон PR
3. Свяжите с соответствующим Issue
4. Добавьте скриншоты при необходимости
5. Отметьте reviewers

#### Шаблон PR

```markdown
## Описание
Краткое описание изменений

## Тип изменений
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Тестирование
- [ ] Тесты проходят локально
- [ ] Добавлены новые тесты
- [ ] Обновлена документация

## Связанные Issues
Closes #123

## Скриншоты
(если применимо)
```

## 🧪 Тестирование

### Требования к тестам

- **Покрытие**: Минимум 80% для нового кода
- **Типы тестов**: Unit, Integration, E2E
- **Мокирование**: Используйте Jest mocks для внешних зависимостей

### Структура тестов

```
tests/
├── unit/              # Unit тесты
│   ├── adapters/
│   ├── cache/
│   └── utils/
├── integration/       # Integration тесты
│   ├── payload-cms/
│   └── cli/
└── e2e/              # E2E тесты
    ├── basic-blog/
    └── cli-commands/
```

### Примеры тестов

```typescript
// Unit тест
describe('JsonAdapter', () => {
  it('should initialize with default config', () => {
    const adapter = new JsonAdapter();
    expect(adapter.config.dataDir).toBe('./data');
  });
});

// Integration тест
describe('Payload CMS Integration', () => {
  it('should work with Payload collections', async () => {
    const payload = await getPayload({ config });
    const users = await payload.find({ collection: 'users' });
    expect(users.docs).toBeDefined();
  });
});
```

## 📚 Документация

### Стандарты документации

- **JSDoc**: Для всех публичных API
- **README**: Актуальные примеры использования
- **Типы**: Полная типизация TypeScript
- **Примеры**: Рабочие примеры в `examples/`

### Обновление документации

```bash
# Генерация API документации
npm run docs:generate

# Проверка ссылок в документации
npm run docs:check
```

## 🔍 Code Review

### Что проверяют reviewers

- **Функциональность**: Код работает как ожидается
- **Тесты**: Достаточное покрытие тестами
- **Производительность**: Нет регрессий производительности
- **Безопасность**: Нет уязвимостей
- **Стиль**: Соответствие стандартам кода
- **Документация**: Актуальная документация

### Процесс review

1. **Автоматические проверки**: CI/CD должны пройти
2. **Peer review**: Минимум один approve от maintainer
3. **Тестирование**: Ручное тестирование при необходимости
4. **Merge**: Squash and merge в main ветку

## 🚀 Release Process

### Версионирование

Используем [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: Новая функциональность (обратно совместимая)
- **PATCH**: Bug fixes

### Процесс релиза

1. **Подготовка**:
   ```bash
   npm run test
   npm run build
   npm run lint
   ```

2. **Обновление версии**:
   ```bash
   npm version patch|minor|major
   ```

3. **Обновление CHANGELOG.md**

4. **Создание GitHub Release**

5. **Публикация на NPM**:
   ```bash
   npm publish
   ```

## 🤝 Сообщество

### Каналы связи

- **GitHub Issues**: Баги и feature requests
- **GitHub Discussions**: Вопросы и обсуждения
- **Discord**: Быстрая помощь и общение
- **Email**: Приватные вопросы

### Кодекс поведения

Мы следуем [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

### Признание вклада

Все контрибьюторы упоминаются в:
- README.md
- CONTRIBUTORS.md
- GitHub Contributors
- Release notes

## ❓ Часто задаваемые вопросы

### Как начать контрибьютить?
1. Найдите Issue с меткой "good first issue"
2. Прочитайте это руководство
3. Настройте окружение разработки
4. Создайте PR с небольшим изменением

### Как предложить новую функцию?
1. Создайте Issue с описанием функции
2. Обсудите с maintainers
3. Получите одобрение
4. Реализуйте функцию

### Как сообщить о баге?
1. Проверьте, что баг еще не зарепорчен
2. Создайте Issue с подробным описанием
3. Приложите минимальный пример воспроизведения
4. Укажите версии ПО

### Нужна помощь?
- Создайте Discussion на GitHub
- Напишите в Discord канал
- Отправьте email maintainers

## 📝 Шаблоны

### Issue Templates

- **Bug Report**: `.github/ISSUE_TEMPLATE/bug_report.md`
- **Feature Request**: `.github/ISSUE_TEMPLATE/feature_request.md`
- **Documentation**: `.github/ISSUE_TEMPLATE/documentation.md`

### PR Template

- **Pull Request**: `.github/pull_request_template.md`

---

Спасибо за ваш вклад в развитие Payload JSON Database Adapter! 🎉