import type { TrainingZoneSnapshot } from './training-zone.model';
import type { WorkoutBlockEntity } from './workout-block.model';
import type { WorkoutDiscipline, WorkoutStatus, WorkoutType } from './workout.enums';

export interface ScheduledWorkoutEntity {
  id: string;
  title: string;
  scheduledDate: string;
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
  status: WorkoutStatus;
  blocks: WorkoutBlockEntity[];
  sourceTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}
