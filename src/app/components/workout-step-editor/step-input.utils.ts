/** Numeric value of an input event, or null when the field is empty or not a number. */
export function readNumber(event: Event): number | null {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  return Number.isFinite(value) ? value : null;
}

export function readText(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}

/** Copy of `source` with `key` set, or without `key` when the value is undefined. */
export function withOptional<Source extends object, Key extends keyof Source>(
  source: Source,
  key: Key,
  value: Source[Key] | undefined,
): Source {
  const next = { ...source };

  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }

  return next;
}
