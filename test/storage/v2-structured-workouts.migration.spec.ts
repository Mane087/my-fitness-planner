import { athleteProfileSchema } from '../../src/app/core/domain/schemas/athlete-profile.schema';
import { scheduledWorkoutSchema } from '../../src/app/core/domain/schemas/scheduled-workout.schema';
import { trainingZoneSetSchema } from '../../src/app/core/domain/schemas/training-zone-set.schema';
import { workoutTemplateSchema } from '../../src/app/core/domain/schemas/workout-template.schema';
import { IndexedDbStore } from '../../src/app/core/storage/indexed-db.config';
import { migrateIndexedDb } from '../../src/app/core/storage/indexed-db.migrations';
import { installFakeIndexedDb, openDatabase, readAll, writeAll } from './fake-indexeddb.helpers';

const DATABASE_NAME = 'v2_migration_test_db';
const CREATED_AT = '2026-05-20T12:00:00.000Z';

// Records exactly as the v1 application stored them.
const V1_PROFILE = {
  id: 'profile-1',
  name: 'Mane',
  maxHeartRate: 193,
  weightKg: 70,
  preferredDiscipline: 'mixed',
  preferredIntensityMetric: 'heart_rate',
  weekStartsOn: 'monday',
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const V1_ZONES = [
  {
    id: 'z2',
    name: 'Z2 Endurance',
    description: 'Aerobic base',
    minHeartRate: 116,
    maxHeartRate: 135,
    sortOrder: 2,
    isDefault: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  },
  {
    id: 'z1',
    name: 'Z1 Recovery',
    description: 'Easy recovery',
    minHeartRate: 97,
    maxHeartRate: 116,
    sortOrder: 1,
    isDefault: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  },
];

const V1_WORKOUT = {
  id: 'workout-1',
  title: 'Rodada Z2',
  scheduledDate: '2026-05-25',
  workoutType: 'climbing',
  discipline: 'mtb',
  intensityMetric: 'mixed',
  estimatedDurationMinutes: 75,
  plannedDistanceKm: 32.5,
  targetZoneId: 'z2',
  targetRpe: 6,
  cadenceMin: 80,
  objective: 'Base aeróbica',
  description: 'Terreno ondulado',
  notes: 'Llevar dos botellas',
  status: 'planned',
  blocks: [
    {
      id: 'b2',
      name: 'Bloque principal',
      blockType: 'active',
      targetType: 'distance',
      durationMinutes: 60,
      distanceKm: 30,
      targetZoneId: 'z2',
      targetZoneSnapshot: { id: 'z2', name: 'Z2 Endurance', minHeartRate: 116, maxHeartRate: 135 },
      cadenceMin: 85,
      cadenceMax: 95,
      instructions: 'Mantener cadencia',
      sortOrder: 2,
    },
    {
      id: 'b1',
      name: 'Calentamiento',
      blockType: 'warm_up',
      targetType: 'time',
      durationMinutes: 15,
      targetRpe: 3,
      sortOrder: 1,
    },
  ],
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const V1_STRENGTH_WORKOUT = {
  id: 'workout-2',
  title: 'Saltos',
  scheduledDate: '2026-05-26',
  workoutType: 'base',
  discipline: 'strength',
  intensityMetric: 'rpe',
  estimatedDurationMinutes: 30,
  status: 'completed',
  blocks: [],
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const V1_TEMPLATE = {
  id: 'template-1',
  title: 'Movilidad de cadera',
  workoutType: 'free',
  discipline: 'mobility',
  estimatedDurationMinutes: 20,
  blocks: [
    {
      id: 't1',
      name: 'Flujo',
      blockType: 'free',
      targetType: 'time',
      durationMinutes: 20,
      sortOrder: 1,
    },
  ],
  archived: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

async function createV1Database(records: {
  profiles?: unknown[];
  zones?: unknown[];
  workouts?: unknown[];
  templates?: unknown[];
}): Promise<void> {
  const database = await openDatabase(DATABASE_NAME, 1, migrateIndexedDb);
  await writeAll(database, 'sport_profiles', records.profiles ?? []);
  await writeAll(database, 'training_zones', records.zones ?? []);
  await writeAll(database, 'scheduled_workouts', records.workouts ?? []);
  await writeAll(database, 'workout_templates', records.templates ?? []);
  database.close();
}

async function upgradeToV2(): Promise<IDBDatabase> {
  return openDatabase(DATABASE_NAME, 2, migrateIndexedDb);
}

describe('migration v2: structured workouts', () => {
  beforeEach(() => {
    installFakeIndexedDb();
  });

  it('replaces the legacy stores and indexes', async () => {
    await createV1Database({});

    const database = await upgradeToV2();

    expect([...database.objectStoreNames].sort()).toEqual(Object.values(IndexedDbStore).sort());
    const workouts = database
      .transaction(IndexedDbStore.ScheduledWorkouts)
      .objectStore(IndexedDbStore.ScheduledWorkouts);
    expect([...workouts.indexNames].sort()).toEqual(['by_scheduled_date', 'by_sport', 'by_status']);
    const templates = database
      .transaction(IndexedDbStore.WorkoutTemplates)
      .objectStore(IndexedDbStore.WorkoutTemplates);
    expect([...templates.indexNames].sort()).toEqual(['by_sport', 'by_title']);
    const zoneSets = database
      .transaction(IndexedDbStore.TrainingZoneSets)
      .objectStore(IndexedDbStore.TrainingZoneSets);
    expect(zoneSets.index('by_sport_and_metric').unique).toBe(true);
    database.close();
  });

  it('converts the sport profile into a valid athlete profile', async () => {
    await createV1Database({ profiles: [V1_PROFILE] });

    const database = await upgradeToV2();
    const [profile] = await readAll(database, IndexedDbStore.AthleteProfiles);

    expect(profile).toEqual({
      id: 'profile-1',
      name: 'Mane',
      weightKg: 70,
      maxHeartRate: 193,
      preferredSport: 'cycling',
      preferredIntensityMetric: 'heart_rate',
      weekStartsOn: 'monday',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    expect(athleteProfileSchema.safeParse(profile).success).toBe(true);
    database.close();
  });

  it('groups the heart rate zones into a cycling zone set ordered by sortOrder', async () => {
    await createV1Database({ profiles: [V1_PROFILE], zones: V1_ZONES });

    const database = await upgradeToV2();
    const zoneSets = await readAll<{ zones: { id: string }[] }>(
      database,
      IndexedDbStore.TrainingZoneSets,
    );

    expect(zoneSets).toHaveLength(1);
    expect(zoneSets[0]).toMatchObject({
      sport: 'cycling',
      metric: 'heart_rate',
      referenceValue: 193,
    });
    expect(zoneSets[0]?.zones).toEqual([
      {
        id: 'z1',
        name: 'Z1 Recovery',
        description: 'Easy recovery',
        minValue: 97,
        maxValue: 116,
        sortOrder: 1,
      },
      {
        id: 'z2',
        name: 'Z2 Endurance',
        description: 'Aerobic base',
        minValue: 116,
        maxValue: 135,
        sortOrder: 2,
      },
    ]);
    expect(trainingZoneSetSchema.safeParse(zoneSets[0]).success).toBe(true);
    database.close();
  });

  it('converts blocks into interval steps with targets, cadence and units in seconds and meters', async () => {
    await createV1Database({ profiles: [V1_PROFILE], zones: V1_ZONES, workouts: [V1_WORKOUT] });

    const database = await upgradeToV2();
    const [zoneSet] = await readAll<{ id: string }>(database, IndexedDbStore.TrainingZoneSets);
    const [workout] = await readAll(database, IndexedDbStore.ScheduledWorkouts);

    expect(workout).toEqual({
      id: 'workout-1',
      title: 'Rodada Z2',
      sport: 'cycling',
      modality: 'mtb',
      category: 'endurance',
      primaryMetric: 'heart_rate',
      steps: [
        {
          id: 'b1',
          kind: 'interval',
          name: 'Calentamiento',
          phase: 'warm_up',
          duration: { type: 'time', seconds: 900 },
          target: { metric: 'rpe', value: 3 },
        },
        {
          id: 'b2',
          kind: 'interval',
          name: 'Bloque principal',
          phase: 'active',
          duration: { type: 'distance', meters: 30000 },
          target: {
            metric: 'heart_rate',
            zoneId: 'z2',
            zoneSnapshot: {
              zoneSetId: zoneSet?.id,
              zoneId: 'z2',
              name: 'Z2 Endurance',
              metric: 'heart_rate',
              minValue: 116,
              maxValue: 135,
            },
          },
          cadenceRpm: { min: 85, max: 95 },
          notes: 'Mantener cadencia',
        },
      ],
      plannedDurationSeconds: 4500,
      plannedDistanceMeters: 32500,
      objective: 'Base aeróbica',
      description: 'Terreno ondulado',
      notes: 'Llevar dos botellas',
      scheduledDate: '2026-05-25',
      status: 'planned',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    expect(scheduledWorkoutSchema.safeParse(workout).success).toBe(true);
    database.close();
  });

  it('maps strength workouts to plyometrics and creates a step when there were no blocks', async () => {
    await createV1Database({ workouts: [V1_STRENGTH_WORKOUT] });

    const database = await upgradeToV2();
    const [workout] = await readAll<Record<string, unknown>>(
      database,
      IndexedDbStore.ScheduledWorkouts,
    );

    expect(workout).toMatchObject({
      sport: 'plyometrics',
      category: 'power',
      primaryMetric: 'rpe',
      plannedDurationSeconds: 1800,
      steps: [
        {
          kind: 'interval',
          name: 'Sesión',
          phase: 'active',
          duration: { type: 'time', seconds: 1800 },
        },
      ],
    });
    expect(workout).not.toHaveProperty('modality');
    database.close();
  });

  it('converts templates keeping the archived flag as isArchived', async () => {
    await createV1Database({ templates: [V1_TEMPLATE] });

    const database = await upgradeToV2();
    const [template] = await readAll<Record<string, unknown>>(
      database,
      IndexedDbStore.WorkoutTemplates,
    );

    expect(template).toMatchObject({
      sport: 'mobility',
      category: 'free',
      isArchived: true,
      plannedDurationSeconds: 1200,
      steps: [{ id: 't1', phase: 'active', duration: { type: 'time', seconds: 1200 } }],
    });
    expect(template).not.toHaveProperty('archived');
    expect(template).not.toHaveProperty('discipline');
    expect(workoutTemplateSchema.safeParse(template).success).toBe(true);
    database.close();
  });

  it('does not create a zone set when there were no zones', async () => {
    await createV1Database({ profiles: [V1_PROFILE] });

    const database = await upgradeToV2();

    await expect(readAll(database, IndexedDbStore.TrainingZoneSets)).resolves.toEqual([]);
    database.close();
  });
});
