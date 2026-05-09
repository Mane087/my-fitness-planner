import type { TrainingZoneSnapshot } from './training-zone.model';

export interface WorkoutBlockEntity {
  id: string;
  name: string;
  durationMinutes: number;
  targetZoneId?: string;
  targetZoneSnapshot?: TrainingZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  instructions?: string;
  sortOrder: number;
}
