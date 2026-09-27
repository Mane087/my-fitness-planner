import * as z from 'zod';
import { es } from 'zod/locales';

/**
 * Registers the Spanish locale for every Zod message.
 * Schemas add their own messages where the generic text is not clear enough for a form.
 * Call it once at bootstrap (main.ts) and in the test setup.
 * The locale is imported directly: `z.locales` would add every language to the bundle.
 */
export function configureZodSpanishMessages(): void {
  z.config(es());
}
