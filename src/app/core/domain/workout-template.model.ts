import type { TrainingZoneSnapshot } from './training-zone.model';
import type { WorkoutBlockEntity } from './workout-block.model';
import type { WorkoutDiscipline, WorkoutType } from './workout.enums';

export interface WorkoutTemplateEntity {
  id: string;
  title: string;
  workoutType: WorkoutType;
  discipline: WorkoutDiscipline;
  estimatedDurationMinutes: number;
  targetZoneId?: string;
  targetZoneSnapshot?: TrainingZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  objective?: string;
  notes?: string;
  blocks: WorkoutBlockEntity[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
