import type { Sport, WorkoutCategory } from '../domain/workout.enums';

export interface WorkoutTemplateCardViewModel {
  id: string;
  title: string;
  sport: Sport;
  sportLabel: string;
  category: WorkoutCategory;
  categoryLabel: string;
  colorClass: string;
  durationLabel: string;
  distanceLabel: string;
  stepCountLabel: string;
  objective: string | null;
  isArchived: boolean;
}

export interface LibraryFilters {
  sport: Sport | null;
  category: WorkoutCategory | null;
  shouldIncludeArchived: boolean;
}
