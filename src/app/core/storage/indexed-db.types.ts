import type { AppSettingsEntity } from '../domain/app-settings.model';
import type { ScheduledWorkoutEntity } from '../domain/scheduled-workout.model';
import type { SportProfileEntity } from '../domain/sport-profile.model';
import type { TrainingZoneEntity } from '../domain/training-zone.model';
import type { WorkoutTemplateEntity } from '../domain/workout-template.model';
import { IndexedDbStore } from './indexed-db.config';

export type { AppSettingsEntity } from '../domain/app-settings.model';
export type { ScheduledWorkoutEntity } from '../domain/scheduled-workout.model';
export type { SportProfileEntity } from '../domain/sport-profile.model';
export type { TrainingZoneEntity, TrainingZoneSnapshot } from '../domain/training-zone.model';
export type { WorkoutBlockEntity } from '../domain/workout-block.model';
export type { WorkoutTemplateEntity } from '../domain/workout-template.model';

export interface IndexedDbSchema {
  [IndexedDbStore.SportProfiles]: SportProfileEntity;
  [IndexedDbStore.TrainingZones]: TrainingZoneEntity;
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

export interface IndexedDbStoreDefinition {
  name: keyof IndexedDbSchema;
  keyPath: string;
  indexes: IndexedDbIndexDefinition[];
}
