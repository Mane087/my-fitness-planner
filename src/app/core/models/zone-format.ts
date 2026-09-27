import type { TrainingZone } from '../domain/schemas/training-zone-set.schema';
import { IntensityMetric } from '../domain/workout.enums';

export const ZONE_UNITS: Record<IntensityMetric, string> = {
  [IntensityMetric.HeartRate]: 'ppm',
  [IntensityMetric.Power]: 'W',
  [IntensityMetric.Pace]: '/km',
  [IntensityMetric.Rpe]: '',
};

/** Seconds per km as `m:ss`. */
export function formatPace(secondsPerKm: number): string {
  const totalSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** Parses `m:ss` or `mm:ss` into seconds per km. Returns null when the text is not a valid pace. */
export function parsePace(text: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim());

  if (!match) {
    return null;
  }

  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

/** Zone value in the unit the user reads: `m:ss` for pace, the plain number otherwise. */
export function formatZoneValue(value: number, metric: IntensityMetric): string {
  return metric === IntensityMetric.Pace ? formatPace(value) : String(value);
}

/** Zone label with its range, e.g. `Z2 Resistencia (116-135 ppm)` or `Z1 (6:27-8:00 /km)`. */
export function formatZone(zone: TrainingZone, metric: IntensityMetric): string {
  return `${zone.name} (${formatZoneValue(zone.minValue, metric)}-${formatZoneValue(zone.maxValue, metric)} ${ZONE_UNITS[metric]})`;
}
