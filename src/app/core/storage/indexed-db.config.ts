export const INDEXED_DB_NAME = 'cycling_training_planner_db';
export const INDEXED_DB_VERSION = 1;

export const IndexedDbStore = {
  SportProfiles: 'sport_profiles',
  TrainingZones: 'training_zones',
  WorkoutTemplates: 'workout_templates',
  ScheduledWorkouts: 'scheduled_workouts',
  AppSettings: 'app_settings',
} as const;

export type IndexedDbStore = (typeof IndexedDbStore)[keyof typeof IndexedDbStore];
