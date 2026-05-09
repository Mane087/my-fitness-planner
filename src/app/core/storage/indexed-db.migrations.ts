import { IndexedDbStore } from './indexed-db.config';
import type { IndexedDbStoreDefinition } from './indexed-db.types';

const STORE_DEFINITIONS: IndexedDbStoreDefinition[] = [
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

export function migrateIndexedDb(event: IDBVersionChangeEvent): void {
  const database = (event.target as IDBOpenDBRequest | null)?.result;

  if (!database) {
    throw new Error('Local storage migration failed. Database connection is unavailable.');
  }

  for (const definition of STORE_DEFINITIONS) {
    const store = database.objectStoreNames.contains(definition.name)
      ? (event.target as IDBOpenDBRequest).transaction?.objectStore(definition.name)
      : database.createObjectStore(definition.name, { keyPath: definition.keyPath });

    if (!store) {
      throw new Error(`Local storage migration failed while creating ${definition.name}.`);
    }

    for (const index of definition.indexes) {
      if (!store.indexNames.contains(index.name)) {
        store.createIndex(index.name, index.keyPath, index.options);
      }
    }
  }
}
