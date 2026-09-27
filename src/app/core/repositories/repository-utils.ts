export { cloneValue, createId, nowIso } from '../domain/entity-utils';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateOnly(date: string): void {
  if (!DATE_ONLY_PATTERN.test(date)) {
    throw new Error('Scheduled date must use YYYY-MM-DD format.');
  }
}
