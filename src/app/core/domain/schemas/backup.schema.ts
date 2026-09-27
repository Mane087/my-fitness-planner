import * as z from 'zod';

import { appSettingsSchema } from './app-settings.schema';
import { athleteProfileSchema } from './athlete-profile.schema';
import { isoDateTimeSchema } from './common.schema';
import { scheduledWorkoutSchema } from './scheduled-workout.schema';
import { trainingZoneSetSchema } from './training-zone-set.schema';
import { workoutTemplateSchema } from './workout-template.schema';

/** Schema version written by this application. Matches INDEXED_DB_VERSION. */
export const BACKUP_SCHEMA_VERSION = 2;

/** Only the version, so older or newer backups get a clear message before full validation. */
export const backupHeaderSchema = z.object({
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  stores: z.record(z.string(), z.unknown()),
});

// Store names are written literally: the file format must not change when a store is renamed.
export const backupSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: isoDateTimeSchema,
  stores: z.object({
    scheduled_workouts: z.array(scheduledWorkoutSchema),
    workout_templates: z.array(workoutTemplateSchema),
    training_zone_sets: z.array(trainingZoneSetSchema),
    athlete_profiles: z.array(athleteProfileSchema),
    app_settings: z.array(appSettingsSchema),
  }),
});

export type Backup = z.infer<typeof backupSchema>;
