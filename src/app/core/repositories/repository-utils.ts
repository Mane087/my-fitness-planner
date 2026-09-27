import type { z } from 'zod';

import { DomainValidationError } from '../domain/domain-validation.error';

export { cloneValue, createId, nowIso } from '../domain/entity-utils';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateOnly(date: string): void {
  if (!DATE_ONLY_PATTERN.test(date)) {
    throw new Error('Scheduled date must use YYYY-MM-DD format.');
  }
}

/** Validates an entity before it is written and returns the parsed (normalized) value. */
export function parseEntity<Schema extends z.ZodType>(
  schema: Schema,
  entityName: string,
  value: unknown,
): z.output<Schema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new DomainValidationError(entityName, result.error.issues);
  }

  return result.data;
}
