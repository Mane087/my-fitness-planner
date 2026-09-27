import type { TrainingZoneSnapshot } from './training-zone.model';
import type { WorkoutBlockEntity } from './workout-block.model';
import type {
  IntensityMetric,
  WorkoutDiscipline,
  WorkoutStatus,
  WorkoutType,
} from './workout.enums';

export interface ScheduledWorkoutEntity {
  id: string;
  title: string;
  scheduledDate: string;
  workoutType: WorkoutType;
  discipline: WorkoutDiscipline;
  intensityMetric: IntensityMetric;
  estimatedDurationMinutes: number;
  plannedDistanceKm?: number;
  targetZoneId?: string;
  targetZoneSnapshot?: TrainingZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  objective?: string;
  description?: string;
  notes?: string;
  status: WorkoutStatus;
  blocks: WorkoutBlockEntity[];
  sourceTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}
