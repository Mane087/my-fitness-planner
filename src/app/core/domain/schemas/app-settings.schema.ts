import * as z from 'zod';

import {
  CALENDAR_DEFAULT_VIEWS,
  THEME_PREFERENCES,
  ThemePreference,
  TIME_FORMATS,
  WEEK_STARTS_ON_VALUES,
} from '../calendar.enums';
import { auditFieldsShape, idSchema } from './common.schema';

export const appSettingsSchema = z.object({
  id: idSchema,
  calendarDefaultView: z.enum(CALENDAR_DEFAULT_VIEWS),
  weekStartsOn: z.enum(WEEK_STARTS_ON_VALUES),
  timeFormat: z.enum(TIME_FORMATS),
  // Default keeps backups exported before the theme existed importable.
  theme: z.enum(THEME_PREFERENCES).default(ThemePreference.System),
  ...auditFieldsShape,
});

export type AppSettingsEntity = z.infer<typeof appSettingsSchema>;
