import { z } from 'zod';

import { WEEK_STARTS_ON_VALUES } from '../calendar.enums';
import { INTENSITY_METRICS, SPORTS } from '../workout.enums';
import { auditFieldsShape, idSchema } from './common.schema';

export const athleteProfileSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, 'El nombre es requerido.').max(80),
  weightKg: z.number().positive('El peso debe ser mayor que cero.').optional(),
  maxHeartRate: z
    .number()
    .int()
    .min(100, 'La frecuencia cardiaca máxima debe estar entre 100 y 250.')
    .max(250, 'La frecuencia cardiaca máxima debe estar entre 100 y 250.'),
  preferredSport: z.enum(SPORTS, { error: 'Selecciona un deporte.' }),
  preferredIntensityMetric: z.enum(INTENSITY_METRICS, {
    error: 'Selecciona la métrica de intensidad.',
  }),
  weekStartsOn: z.enum(WEEK_STARTS_ON_VALUES),
  ...auditFieldsShape,
});

export type AthleteProfileEntity = z.infer<typeof athleteProfileSchema>;
