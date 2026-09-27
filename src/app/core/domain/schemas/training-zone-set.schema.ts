import * as z from 'zod';

import {
  IntensityMetric,
  SPORTS,
  ZONE_METRICS,
  ZONE_METRICS_BY_SPORT,
  type ZoneMetric,
} from '../workout.enums';
import { auditFieldsShape, idSchema } from './common.schema';

export const zoneMetricSchema = z.enum(ZONE_METRICS);

export const trainingZoneSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1, 'El nombre de la zona es requerido.').max(60),
    description: z.string().trim().max(250).optional(),
    minValue: z.number().nonnegative('El valor mínimo no puede ser negativo.'),
    maxValue: z.number().positive('El valor máximo debe ser mayor que cero.'),
    sortOrder: z.number().int().positive(),
  })
  .refine((zone) => zone.minValue < zone.maxValue, {
    message: 'El valor mínimo de la zona debe ser menor que el máximo.',
    path: ['maxValue'],
  });

export type TrainingZone = z.infer<typeof trainingZoneSchema>;

export const trainingZoneSnapshotSchema = z.object({
  zoneSetId: idSchema,
  zoneId: idSchema,
  name: z.string().trim().min(1),
  metric: zoneMetricSchema,
  minValue: z.number().nonnegative(),
  maxValue: z.number().positive(),
});

export type TrainingZoneSnapshot = z.infer<typeof trainingZoneSnapshotSchema>;

export const trainingZoneSetSchema = z
  .object({
    id: idSchema,
    sport: z.enum(SPORTS),
    metric: zoneMetricSchema,
    referenceValue: z.number().positive('El valor de referencia debe ser mayor que cero.'),
    zones: z.array(trainingZoneSchema).min(1, 'Agrega al menos una zona.'),
    ...auditFieldsShape,
  })
  .superRefine((zoneSet, context) => {
    if (!ZONE_METRICS_BY_SPORT[zoneSet.sport].includes(zoneSet.metric)) {
      context.addIssue({
        code: 'custom',
        message: 'La métrica no aplica para este deporte.',
        path: ['metric'],
      });
    }

    const ids = new Set<string>();

    zoneSet.zones.forEach((zone, index) => {
      if (zone.sortOrder !== index + 1) {
        context.addIssue({
          code: 'custom',
          message: 'El orden de las zonas debe ser consecutivo.',
          path: ['zones', index, 'sortOrder'],
        });
      }

      if (ids.has(zone.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Los identificadores de zona deben ser únicos.',
          path: ['zones', index, 'id'],
        });
      }
      ids.add(zone.id);

      const previousZone = zoneSet.zones[index - 1];

      if (previousZone && zonesOverlap(zoneSet.metric, previousZone, zone)) {
        context.addIssue({
          code: 'custom',
          message: 'Las zonas no pueden traslaparse y deben ir de menor a mayor intensidad.',
          path: ['zones', index, 'minValue'],
        });
      }
    });
  });

export type TrainingZoneSetEntity = z.infer<typeof trainingZoneSetSchema>;

/** Accepted reference values when the user configures a set. Pace goes from 2:00 to 15:00 per km. */
export const REFERENCE_VALUE_LIMITS: Record<ZoneMetric, { min: number; max: number }> = {
  [IntensityMetric.HeartRate]: { min: 100, max: 250 },
  [IntensityMetric.Power]: { min: 50, max: 600 },
  [IntensityMetric.Pace]: { min: 120, max: 900 },
};

const REFERENCE_VALUE_MESSAGES: Record<ZoneMetric, string> = {
  [IntensityMetric.HeartRate]: 'La FC máxima debe estar entre 100 y 250 ppm.',
  [IntensityMetric.Power]: 'El FTP debe estar entre 50 y 600 W.',
  [IntensityMetric.Pace]: 'El ritmo umbral debe estar entre 2:00 y 15:00 min/km.',
};

/**
 * Stricter rules for sets the user edits: the reference value must be realistic and every zone
 * starts where the previous one ends. Stored sets keep the base schema, so migrated data and
 * backups with gaps between zones still load.
 */
export const editableTrainingZoneSetSchema = trainingZoneSetSchema.superRefine(
  (zoneSet, context) => {
    const limits = REFERENCE_VALUE_LIMITS[zoneSet.metric];

    if (zoneSet.referenceValue < limits.min || zoneSet.referenceValue > limits.max) {
      context.addIssue({
        code: 'custom',
        message: REFERENCE_VALUE_MESSAGES[zoneSet.metric],
        path: ['referenceValue'],
      });
    }

    zoneSet.zones.forEach((zone, index) => {
      const previousZone = zoneSet.zones[index - 1];

      if (previousZone && !zonesAreContiguous(zoneSet.metric, previousZone, zone)) {
        context.addIssue({
          code: 'custom',
          message: 'Cada zona debe empezar donde termina la anterior.',
          path: ['zones', index, 'minValue'],
        });
      }
    });
  },
);

/**
 * Zones are ordered by intensity. Heart rate and power grow with intensity;
 * pace (seconds per km) decreases with intensity, so its bounds go down.
 */
function zonesOverlap(metric: ZoneMetric, previous: TrainingZone, current: TrainingZone): boolean {
  if (metric === IntensityMetric.Pace) {
    return current.maxValue > previous.minValue;
  }

  return current.minValue < previous.maxValue;
}

function zonesAreContiguous(
  metric: ZoneMetric,
  previous: TrainingZone,
  current: TrainingZone,
): boolean {
  return metric === IntensityMetric.Pace
    ? current.maxValue === previous.minValue
    : current.minValue === previous.maxValue;
}
