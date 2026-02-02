/**
 * ID generation utilities
 * Centralizes ID generation logic (currently using UUIDs)
 */

import { randomUUID } from 'crypto';

/**
 * Generate a new UUID v4
 * In the future, this could be swapped for ULIDs or other ID schemes
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Validate UUID format
 */
export function isValidId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
