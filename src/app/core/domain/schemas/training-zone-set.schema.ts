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
