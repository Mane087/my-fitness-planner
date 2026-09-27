import type { TrainingZoneSetEntity } from '../domain/schemas/training-zone-set.schema';
import type {
  IntensityMetric,
  Sport,
  SportModality,
  StepPhase,
  WorkoutCategory,
} from '../domain/workout.enums';

export const BlockTargetType = {
  Time: 'time',
  Distance: 'distance',
} as const;

export type BlockTargetType = (typeof BlockTargetType)[keyof typeof BlockTargetType];

/**
 * A block of the current session form. Each block is saved as an interval step.
 * Values use UI units (minutes, km); the facade converts them to seconds and meters.
 */
export interface WorkoutBlockFormValue {
  id: string;
  name: string;
  phase: StepPhase;
  targetType: BlockTargetType;
  /** Required for time blocks; an optional estimate for distance blocks. */
  durationMinutes: number | null;
  distanceKm: number | null;
  trainingZoneId: string | null;
  targetRpe: number | null;
  cadenceMin: number | null;
  cadenceMax: number | null;
  instructions: string;
  sortOrder: number;
}

export interface TrainingSessionFormValue {
  id?: string;
  title: string;
  scheduledDate: string;
  sport: Sport | null;
  modality: SportModality | null;
  category: WorkoutCategory | null;
  primaryMetric: IntensityMetric | null;
  plannedDistanceKm: number | null;
  objective: string;
  description: string;
  notes: string;
  blocks: WorkoutBlockFormValue[];
}

export interface TrainingSessionTotals {
  durationMinutes: number;
  distanceKm: number | null;
  blockCount: number;
}

export interface TrainingSessionFormState {
  mode: 'create' | 'edit';
  selectedDate: string;
  profileAvailable: boolean;
  zoneSets: TrainingZoneSetEntity[];
  formValue: TrainingSessionFormValue;
}
