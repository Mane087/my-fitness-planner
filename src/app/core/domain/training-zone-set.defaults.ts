import { createId, nowIso } from './entity-utils';
import type { TrainingZone, TrainingZoneSetEntity } from './schemas/training-zone-set.schema';
import { IntensityMetric, type Sport, type ZoneMetric } from './workout.enums';

interface ZonePercentageDefinition {
  name: string;
  description: string;
  minPercent: number;
  maxPercent: number;
}

// Percentages of maximum heart rate.
const HEART_RATE_ZONES: readonly ZonePercentageDefinition[] = [
  { name: 'Z1 Recuperación', description: 'Esfuerzo muy ligero', minPercent: 0.5, maxPercent: 0.6 },
  { name: 'Z2 Resistencia', description: 'Base aeróbica', minPercent: 0.6, maxPercent: 0.7 },
  {
    name: 'Z3 Tempo',
    description: 'Esfuerzo moderado sostenido',
    minPercent: 0.7,
    maxPercent: 0.8,
  },
  { name: 'Z4 Umbral', description: 'Esfuerzo duro sostenido', minPercent: 0.8, maxPercent: 0.9 },
  { name: 'Z5 VO2 máx', description: 'Esfuerzos máximos', minPercent: 0.9, maxPercent: 1 },
];

// Percentages of functional threshold power (Coggan).
const POWER_ZONES: readonly ZonePercentageDefinition[] = [
  {
    name: 'Z1 Recuperación activa',
    description: 'Pedaleo muy suave',
    minPercent: 0,
    maxPercent: 0.55,
  },
  { name: 'Z2 Resistencia', description: 'Base aeróbica', minPercent: 0.55, maxPercent: 0.75 },
  {
    name: 'Z3 Tempo',
    description: 'Esfuerzo moderado sostenido',
    minPercent: 0.75,
    maxPercent: 0.9,
  },
  { name: 'Z4 Umbral', description: 'Alrededor del FTP', minPercent: 0.9, maxPercent: 1.05 },
  {
    name: 'Z5 VO2 máx',
    description: 'Intervalos de 3 a 8 minutos',
    minPercent: 1.05,
    maxPercent: 1.2,
  },
  {
    name: 'Z6 Capacidad anaeróbica',
    description: 'Esfuerzos de 30 s a 3 min',
    minPercent: 1.2,
    maxPercent: 1.5,
  },
  { name: 'Z7 Potencia neuromuscular', description: 'Sprints', minPercent: 1.5, maxPercent: 3 },
];

// Percentages of threshold pace in seconds per km: a higher percentage is a slower pace.
// Ordered from lowest to highest intensity, so bounds decrease.
const PACE_ZONES: readonly ZonePercentageDefinition[] = [
  { name: 'Z1 Trote suave', description: 'Recuperación', minPercent: 1.29, maxPercent: 1.6 },
  { name: 'Z2 Resistencia', description: 'Rodaje aeróbico', minPercent: 1.14, maxPercent: 1.29 },
  { name: 'Z3 Tempo', description: 'Ritmo cómodo-duro', minPercent: 1.06, maxPercent: 1.14 },
  {
    name: 'Z4 Umbral',
    description: 'Alrededor del ritmo umbral',
    minPercent: 0.99,
    maxPercent: 1.06,
  },
  {
    name: 'Z5 Intervalos',
    description: 'Ritmo de VO2 máx y más rápido',
    minPercent: 0.8,
    maxPercent: 0.99,
  },
];

const DEFAULT_ZONES_BY_METRIC: Record<ZoneMetric, readonly ZonePercentageDefinition[]> = {
  [IntensityMetric.HeartRate]: HEART_RATE_ZONES,
  [IntensityMetric.Power]: POWER_ZONES,
  [IntensityMetric.Pace]: PACE_ZONES,
};

export function createDefaultZones(metric: ZoneMetric, referenceValue: number): TrainingZone[] {
  return DEFAULT_ZONES_BY_METRIC[metric].map((definition, index) => {
    const zone: TrainingZone = {
      id: createId(),
      name: definition.name,
      description: definition.description,
      minValue: Math.round(referenceValue * definition.minPercent),
      maxValue: Math.round(referenceValue * definition.maxPercent),
      sortOrder: index + 1,
    };

    return zone;
  });
}

export function createDefaultZoneSet(
  sport: Sport,
  metric: ZoneMetric,
  referenceValue: number,
): TrainingZoneSetEntity {
  const timestamp = nowIso();

  return {
    id: createId(),
    sport,
    metric,
    referenceValue,
    zones: createDefaultZones(metric, referenceValue),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
