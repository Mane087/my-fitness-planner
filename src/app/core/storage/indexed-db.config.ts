export const INDEXED_DB_NAME = 'cycling_training_planner_db';
export const INDEXED_DB_VERSION = 3;

export const IndexedDbStore = {
  AthleteProfiles: 'athlete_profiles',
  TrainingZoneSets: 'training_zone_sets',
  WorkoutTemplates: 'workout_templates',
  ScheduledWorkouts: 'scheduled_workouts',
  AppSettings: 'app_settings',
} as const;

export type IndexedDbStore = (typeof IndexedDbStore)[keyof typeof IndexedDbStore];
