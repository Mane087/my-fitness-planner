import { IndexedDbStore } from '../indexed-db.config';
import type { IndexedDbMigration, IndexedDbStoreDefinition } from '../indexed-db.types';
import { ensureStore } from './migration-utils';

// Historical definition of schema version 1. Do not edit when the domain changes:
// add a new migration instead so existing databases upgrade step by step.
export const V1_STORE_DEFINITIONS: readonly IndexedDbStoreDefinition[] = [
  {
    name: IndexedDbStore.SportProfiles,
    keyPath: 'id',
    indexes: [{ name: 'by_name', keyPath: 'name' }],
  },
  {
    name: IndexedDbStore.TrainingZones,
    keyPath: 'id',
    indexes: [
      { name: 'by_sort_order', keyPath: 'sortOrder' },
      { name: 'by_name', keyPath: 'name' },
    ],
  },
  {
    name: IndexedDbStore.WorkoutTemplates,
    keyPath: 'id',
    indexes: [
      { name: 'by_archived', keyPath: 'archived' },
      { name: 'by_workout_type', keyPath: 'workoutType' },
      { name: 'by_discipline', keyPath: 'discipline' },
      { name: 'by_title', keyPath: 'title' },
    ],
  },
  {
    name: IndexedDbStore.ScheduledWorkouts,
    keyPath: 'id',
    indexes: [
      { name: 'by_scheduled_date', keyPath: 'scheduledDate' },
      { name: 'by_status', keyPath: 'status' },
      { name: 'by_workout_type', keyPath: 'workoutType' },
      { name: 'by_discipline', keyPath: 'discipline' },
      { name: 'by_date_and_status', keyPath: ['scheduledDate', 'status'] },
      { name: 'by_date_and_type', keyPath: ['scheduledDate', 'workoutType'] },
    ],
  },
  {
    name: IndexedDbStore.AppSettings,
    keyPath: 'id',
    indexes: [],
  },
];

export const v1InitialStoresMigration: IndexedDbMigration = {
  version: 1,
  description: 'Create the initial stores and indexes.',
  upgrade(context) {
    for (const definition of V1_STORE_DEFINITIONS) {
      ensureStore(context, definition);
    }
  },
};
