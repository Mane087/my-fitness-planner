import { z } from 'zod';

import { CALENDAR_DEFAULT_VIEWS, TIME_FORMATS, WEEK_STARTS_ON_VALUES } from '../calendar.enums';
import { auditFieldsShape, idSchema } from './common.schema';

export const appSettingsSchema = z.object({
  id: idSchema,
  calendarDefaultView: z.enum(CALENDAR_DEFAULT_VIEWS),
  weekStartsOn: z.enum(WEEK_STARTS_ON_VALUES),
  timeFormat: z.enum(TIME_FORMATS),
  ...auditFieldsShape,
});

export type AppSettingsEntity = z.infer<typeof appSettingsSchema>;
