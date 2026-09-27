import { z } from 'zod';

/**
 * Registers the Spanish locale for every Zod message.
 * Schemas add their own messages where the generic text is not clear enough for a form.
 * Call it once at bootstrap (main.ts) and in the test setup.
 */
export function configureZodSpanishMessages(): void {
  z.config(z.locales.es());
}
