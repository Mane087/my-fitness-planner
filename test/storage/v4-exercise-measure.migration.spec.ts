import { workoutTemplateSchema } from '../../src/app/core/domain/schemas/workout-template.schema';
import { IndexedDbStore } from '../../src/app/core/storage/indexed-db.config';
import { migrateIndexedDb } from '../../src/app/core/storage/indexed-db.migrations';
import { workoutTemplate } from '../domain/fixtures';
import { installFakeIndexedDb, openDatabase, readAll, writeAll } from './fake-indexeddb.helpers';

const DATABASE_NAME = 'v4_migration_test_db';

// Exercises exactly as the v3 application stored them: `reps` directly on the step.
const LEGACY_EXERCISE = {
  id: 'jumps',
  kind: 'exercise',
  name: 'Saltos al cajón',
  sets: 4,
  reps: 6,
  restSeconds: 90,
  target: { metric: 'rpe', value: 8 },
};

function legacyTemplate(steps: unknown[]) {
  const definition: Record<string, unknown> = workoutTemplate({
    sport: 'plyometrics',
    modality: undefined,
    category: 'power',
    primaryMetric: 'rpe',
  });
  delete definition['steps'];
  return { ...definition, steps };
}

async function createV3Database(templates: unknown[], workouts: unknown[] = []): Promise<void> {
  const database = await openDatabase(DATABASE_NAME, 3, migrateIndexedDb);
  await writeAll(database, IndexedDbStore.WorkoutTemplates, templates);
  await writeAll(database, IndexedDbStore.ScheduledWorkouts, workouts);
  database.close();
}

describe('migration v4: exercise measure', () => {
  beforeEach(() => {
    installFakeIndexedDb();
  });

  it('turns the reps of an exercise into a reps measure and keeps the other fields', async () => {
    await createV3Database([legacyTemplate([LEGACY_EXERCISE])]);

    const database = await openDatabase(DATABASE_NAME, 4, migrateIndexedDb);
    const [template] = await readAll<{ steps: Record<string, unknown>[] }>(
      database,
      IndexedDbStore.WorkoutTemplates,
    );
    database.close();

    const rest: Record<string, unknown> = { ...LEGACY_EXERCISE };
    delete rest['reps'];
    expect(template?.steps).toEqual([{ ...rest, measure: { type: 'reps', reps: 6 } }]);
    expect(workoutTemplateSchema.safeParse(template).success).toBe(true);
  });

  it('upgrades the exercises inside repeat groups and the scheduled workouts', async () => {
    const steps = [
      { id: 'warm', kind: 'exercise', name: 'Skipping', sets: 1, reps: 20 },
      { id: 'circuit', kind: 'repeat', repetitions: 3, steps: [LEGACY_EXERCISE] },
    ];
    await createV3Database(
      [],
      [{ ...legacyTemplate(steps), id: 'w1', scheduledDate: '2026-10-05' }],
    );

    const database = await openDatabase(DATABASE_NAME, 4, migrateIndexedDb);
    const [workout] = await readAll<{
      steps: { steps?: { measure: unknown }[]; measure?: unknown }[];
    }>(database, IndexedDbStore.ScheduledWorkouts);
    database.close();

    expect(workout?.steps[0]?.measure).toEqual({ type: 'reps', reps: 20 });
    expect(workout?.steps[1]?.steps?.[0]?.measure).toEqual({ type: 'reps', reps: 6 });
  });

  it('leaves interval steps and already upgraded exercises untouched', async () => {
    const upgraded = { ...LEGACY_EXERCISE, measure: { type: 'hold', seconds: 30 } } as Record<
      string,
      unknown
    >;
    delete upgraded['reps'];
    const interval = { id: 'i', kind: 'interval', name: 'Z2', phase: 'active' };
    await createV3Database([legacyTemplate([interval, upgraded])]);

    const database = await openDatabase(DATABASE_NAME, 4, migrateIndexedDb);
    const [template] = await readAll<{ steps: unknown[] }>(
      database,
      IndexedDbStore.WorkoutTemplates,
    );
    database.close();

    expect(template?.steps).toEqual([interval, upgraded]);
  });

  it('upgrades a database without workouts', async () => {
    await createV3Database([]);

    const database = await openDatabase(DATABASE_NAME, 4, migrateIndexedDb);

    await expect(readAll(database, IndexedDbStore.WorkoutTemplates)).resolves.toEqual([]);
    database.close();
  });
});
