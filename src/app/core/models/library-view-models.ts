import type { WorkoutStep } from '../domain/schemas/workout-step.schema';
import type { Sport, WorkoutCategory } from '../domain/workout.enums';

export interface WorkoutTemplateCardViewModel {
  id: string;
  title: string;
  sport: Sport;
  sportLabel: string;
  category: WorkoutCategory;
  categoryLabel: string;
  durationLabel: string;
  distanceLabel: string;
  stepCountLabel: string;
  /** Steps that the card profile draws. */
  steps: WorkoutStep[];
  /** Text shown instead of the profile for workouts made of exercises. */
  summaryText: string | null;
  objective: string | null;
  isArchived: boolean;
}

export interface LibraryFilters {
  sport: Sport | null;
  category: WorkoutCategory | null;
  shouldIncludeArchived: boolean;
}
