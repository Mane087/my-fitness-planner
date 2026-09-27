import type { z } from 'zod';

/** Thrown by repositories when an entity does not satisfy its schema. */
export class DomainValidationError extends Error {
  readonly issues: readonly z.core.$ZodIssue[];

  constructor(entityName: string, issues: readonly z.core.$ZodIssue[]) {
    const details = issues
      .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
      .join(' ');

    super(`${entityName} is invalid. ${details}`);
    this.name = 'DomainValidationError';
    this.issues = issues;
  }
}
