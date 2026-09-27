import type { AppSettingsEntity } from '../domain/schemas/app-settings.schema';
import type { AthleteProfileEntity } from '../domain/schemas/athlete-profile.schema';
import type { ScheduledWorkoutEntity } from '../domain/schemas/scheduled-workout.schema';
import type { TrainingZoneSetEntity } from '../domain/schemas/training-zone-set.schema';
import type { WorkoutTemplateEntity } from '../domain/schemas/workout-template.schema';
import { IndexedDbStore } from './indexed-db.config';

export interface IndexedDbSchema {
  [IndexedDbStore.AthleteProfiles]: AthleteProfileEntity;
  [IndexedDbStore.TrainingZoneSets]: TrainingZoneSetEntity;
  [IndexedDbStore.WorkoutTemplates]: WorkoutTemplateEntity;
  [IndexedDbStore.ScheduledWorkouts]: ScheduledWorkoutEntity;
  [IndexedDbStore.AppSettings]: AppSettingsEntity;
}

export type IndexedDbEntity = IndexedDbSchema[keyof IndexedDbSchema];

export interface IndexedDbIndexDefinition {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
}

// Store names are plain strings: migrations describe historical schemas that may
// reference stores no longer present in IndexedDbSchema.
export interface IndexedDbStoreDefinition {
  name: string;
  keyPath: string;
  indexes: IndexedDbIndexDefinition[];
}

export interface IndexedDbMigrationContext {
  database: IDBDatabase;
  transaction: IDBTransaction;
  oldVersion: number;
  newVersion: number;
}

export interface IndexedDbMigration {
  version: number;
  description: string;
  upgrade(context: IndexedDbMigrationContext): void;
}
