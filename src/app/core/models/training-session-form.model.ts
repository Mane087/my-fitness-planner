import type { TrainingZoneSetEntity } from '../domain/schemas/training-zone-set.schema';
import type { WorkoutStep } from '../domain/schemas/workout-step.schema';
import type {
  IntensityMetric,
  Sport,
  SportModality,
  WorkoutCategory,
} from '../domain/workout.enums';

/** Session form value. Header values use UI units (minutes, km); steps use domain units. */
export interface TrainingSessionFormValue {
  id?: string;
  title: string;
  scheduledDate: string;
  sport: Sport | null;
  modality: SportModality | null;
  category: WorkoutCategory | null;
  primaryMetric: IntensityMetric | null;
  /** Optional override of the calculated duration, for distance or open steps. */
  estimatedDurationMinutes: number | null;
  plannedDistanceKm: number | null;
  objective: string;
  description: string;
  notes: string;
  steps: WorkoutStep[];
}

export interface TrainingSessionTotals {
  durationMinutes: number;
  distanceKm: number | null;
  stepCount: number;
  /** True when the duration comes from the user estimate instead of the steps. */
  isEstimated: boolean;
}

export interface TrainingSessionFormState {
  mode: 'create' | 'edit';
  selectedDate: string;
  profileAvailable: boolean;
  zoneSets: TrainingZoneSetEntity[];
  formValue: TrainingSessionFormValue;
}
