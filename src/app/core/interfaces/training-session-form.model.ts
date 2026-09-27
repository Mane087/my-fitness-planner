import type { TrainingZoneEntity, TrainingZoneSnapshot } from '../domain/training-zone.model';
import type { WorkoutBlockTargetType, WorkoutBlockType } from '../domain/workout-block.model';
import type { IntensityMetric, WorkoutDiscipline, WorkoutType } from '../domain/workout.enums';

export interface WorkoutBlockFormValue {
  id: string;
  name: string;
  blockType: WorkoutBlockType;
  durationMinutes: number | null;
  distanceKm: number | null;
  targetType: WorkoutBlockTargetType;
  trainingZoneId: string | null;
  trainingZoneSnapshot: TrainingZoneSnapshot | null;
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
  discipline: WorkoutDiscipline | null;
  workoutType: WorkoutType | null;
  intensityMetric: IntensityMetric | null;
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
  zones: TrainingZoneEntity[];
  formValue: TrainingSessionFormValue;
}
