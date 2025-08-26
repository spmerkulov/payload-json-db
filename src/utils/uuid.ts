import { v4 as uuidv4 } from 'uuid';

/**
 * Генерирует новый UUID v4
 * @returns Строка UUID
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Проверяет, является ли строка валидным UUID
 * @param uuid - Строка для проверки
 * @returns true, если строка является валидным UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Генерирует короткий ID (первые 8 символов UUID)
 * @returns Короткий ID
 */
export function generateShortId(): string {
  return generateUUID().substring(0, 8);
}