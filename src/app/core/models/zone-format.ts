import type { TrainingZone } from '../domain/schemas/training-zone-set.schema';
import { IntensityMetric } from '../domain/workout.enums';

const ZONE_UNITS: Record<IntensityMetric, string> = {
  [IntensityMetric.HeartRate]: 'ppm',
  [IntensityMetric.Power]: 'W',
  [IntensityMetric.Pace]: '/km',
  [IntensityMetric.Rpe]: '',
};

/** Seconds per km as `m:ss`. */
export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = String(Math.round(secondsPerKm % 60)).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Zone label with its range, e.g. `Z2 Resistencia (116-135 ppm)` or `Z1 (6:27-8:00 /km)`. */
export function formatZone(zone: TrainingZone, metric: IntensityMetric): string {
  const format = (value: number) =>
    metric === IntensityMetric.Pace ? formatPace(value) : String(value);

  return `${zone.name} (${format(zone.minValue)}-${format(zone.maxValue)} ${ZONE_UNITS[metric]})`;
}
