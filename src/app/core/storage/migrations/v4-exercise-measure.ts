import { upgradeLegacyWorkout } from '../../domain/legacy-exercise-steps';
import type { IndexedDbMigration } from '../indexed-db.types';
import { transformRecords } from './migration-utils';

const WORKOUT_STORES = ['scheduled_workouts', 'workout_templates'];

export const v4ExerciseMeasureMigration: IndexedDbMigration = {
  version: 4,
  description: 'Stores the exercise measure as { type: "reps", reps } instead of a plain `reps`.',
  upgrade({ transaction }) {
    for (const storeName of WORKOUT_STORES) {
      transformRecords<unknown, unknown>(transaction.objectStore(storeName), upgradeLegacyWorkout);
    }
  },
};
