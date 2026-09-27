import { createId } from '../../domain/entity-utils';
import type { IndexedDbMigration } from '../indexed-db.types';
import {
  deleteIndexIfExists,
  deleteStoreIfExists,
  ensureStore,
  readAllRecords,
  transformRecords,
} from './migration-utils';

// ---- Version 1 shapes (historical, kept local to this migration) ----

interface V1SportProfile {
  id: string;
  name: string;
  maxHeartRate: number;
  weightKg?: number;
  preferredDiscipline: 'road' | 'mtb' | 'indoor' | 'mixed';
  preferredIntensityMetric: 'heart_rate' | 'rpe' | 'mixed';
  weekStartsOn: 'monday' | 'sunday';
  createdAt: string;
  updatedAt: string;
}

interface V1TrainingZone {
  id: string;
  name: string;
  description?: string;
  minHeartRate: number;
  maxHeartRate: number;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface V1ZoneSnapshot {
  id: string;
  name: string;
  minHeartRate: number;
  maxHeartRate: number;
}

interface V1WorkoutBlock {
  id: string;
  name: string;
  blockType: 'warm_up' | 'active' | 'recovery' | 'cool_down' | 'free';
  targetType: 'time' | 'distance';
  durationMinutes: number;
  distanceKm?: number;
  targetZoneId?: string;
  targetZoneSnapshot?: V1ZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  instructions?: string;
  sortOrder: number;
}

interface V1WorkoutBase {
  id: string;
  title: string;
  workoutType: string;
  discipline: 'road' | 'mtb' | 'indoor' | 'strength' | 'mobility';
  estimatedDurationMinutes: number;
  objective?: string;
  notes?: string;
  blocks?: V1WorkoutBlock[];
  createdAt: string;
  updatedAt: string;
}

interface V1WorkoutTemplate extends V1WorkoutBase {
  archived: boolean;
}

interface V1ScheduledWorkout extends V1WorkoutBase {
  scheduledDate: string;
  intensityMetric?: 'heart_rate' | 'rpe' | 'mixed';
  plannedDistanceKm?: number;
  description?: string;
  status: 'planned' | 'completed' | 'skipped';
  sourceTemplateId?: string;
}

// ---- Version 2 shapes (kept local so the migration keeps working when the domain evolves) ----

type V2Sport = 'cycling' | 'running' | 'mobility' | 'plyometrics';
type V2Category =
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'threshold'
  | 'vo2max'
  | 'technique'
  | 'strength'
  | 'power'
  | 'mobility'
  | 'free';

interface V2ZoneSnapshot {
  zoneSetId: string;
  zoneId: string;
  name: string;
  metric: 'heart_rate';
  minValue: number;
  maxValue: number;
}

type V2Target =
  | { metric: 'heart_rate'; zoneId: string; zoneSnapshot: V2ZoneSnapshot }
  | { metric: 'rpe'; value: number };

interface V2IntervalStep {
  id: string;
  kind: 'interval';
  name: string;
  phase: 'warm_up' | 'active' | 'recovery' | 'rest' | 'cool_down';
  duration:
    | { type: 'time'; seconds: number }
    | { type: 'distance'; meters: number }
    | { type: 'open' };
  target?: V2Target;
  cadenceRpm?: { min: number; max: number };
  notes?: string;
}

interface V2Definition {
  title: string;
  sport: V2Sport;
  modality?: 'road' | 'mtb' | 'indoor';
  category: V2Category;
  primaryMetric: 'heart_rate' | 'rpe';
  steps: V2IntervalStep[];
  plannedDurationSeconds: number;
  plannedDistanceMeters?: number;
  objective?: string;
  description?: string;
  notes?: string;
}

interface V2ZoneSet {
  id: string;
  sport: 'cycling';
  metric: 'heart_rate';
  referenceValue: number;
  zones: {
    id: string;
    name: string;
    description?: string;
    minValue: number;
    maxValue: number;
    sortOrder: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

const LEGACY_STORES = {
  sportProfiles: 'sport_profiles',
  trainingZones: 'training_zones',
} as const;

const STORES = {
  athleteProfiles: 'athlete_profiles',
  trainingZoneSets: 'training_zone_sets',
  workoutTemplates: 'workout_templates',
  scheduledWorkouts: 'scheduled_workouts',
} as const;

const DEFAULT_MAX_HEART_RATE = 190;

export const v2StructuredWorkoutsMigration: IndexedDbMigration = {
  version: 2,
  description: 'Structured multi-sport workouts, zone sets per sport and metric, athlete profile.',
  upgrade(context) {
    const { transaction } = context;

    ensureStore(context, { name: STORES.athleteProfiles, keyPath: 'id', indexes: [] });
    ensureStore(context, {
      name: STORES.trainingZoneSets,
      keyPath: 'id',
      indexes: [
        { name: 'by_sport_and_metric', keyPath: ['sport', 'metric'], options: { unique: true } },
      ],
    });

    const templates = ensureStore(context, {
      name: STORES.workoutTemplates,
      keyPath: 'id',
      indexes: [
        { name: 'by_sport', keyPath: 'sport' },
        { name: 'by_title', keyPath: 'title' },
      ],
    });
    for (const index of ['by_archived', 'by_workout_type', 'by_discipline']) {
      deleteIndexIfExists(templates, index);
    }

    const workouts = ensureStore(context, {
      name: STORES.scheduledWorkouts,
      keyPath: 'id',
      indexes: [
        { name: 'by_scheduled_date', keyPath: 'scheduledDate' },
        { name: 'by_status', keyPath: 'status' },
        { name: 'by_sport', keyPath: 'sport' },
      ],
    });
    for (const index of [
      'by_workout_type',
      'by_discipline',
      'by_date_and_status',
      'by_date_and_type',
    ]) {
      deleteIndexIfExists(workouts, index);
    }

    readAllRecords<V1SportProfile>(
      transaction.objectStore(LEGACY_STORES.sportProfiles),
      (profiles) => {
        const maxHeartRate = profiles[0]?.maxHeartRate ?? DEFAULT_MAX_HEART_RATE;
        const athleteProfiles = transaction.objectStore(STORES.athleteProfiles);

        for (const profile of profiles) {
          athleteProfiles.put(convertProfile(profile));
        }

        readAllRecords<V1TrainingZone>(
          transaction.objectStore(LEGACY_STORES.trainingZones),
          (zones) => {
            const zoneSet = convertZones(zones, maxHeartRate);

            if (zoneSet) {
              transaction.objectStore(STORES.trainingZoneSets).put(zoneSet);
            }

            const zoneSetId = zoneSet?.id ?? createId();

            transformRecords<V1ScheduledWorkout, unknown>(
              transaction.objectStore(STORES.scheduledWorkouts),
              (workout) => convertScheduledWorkout(workout, zoneSetId),
            );
            transformRecords<V1WorkoutTemplate, unknown>(
              transaction.objectStore(STORES.workoutTemplates),
              (template) => convertTemplate(template, zoneSetId),
            );

            deleteStoreIfExists(context, LEGACY_STORES.sportProfiles);
            deleteStoreIfExists(context, LEGACY_STORES.trainingZones);
          },
        );
      },
    );
  },
};

function convertProfile(profile: V1SportProfile) {
  return {
    id: profile.id,
    name: profile.name,
    ...(profile.weightKg !== undefined ? { weightKg: profile.weightKg } : {}),
    maxHeartRate: profile.maxHeartRate,
    preferredSport: 'cycling' as const,
    preferredIntensityMetric:
      profile.preferredIntensityMetric === 'rpe' ? ('rpe' as const) : ('heart_rate' as const),
    weekStartsOn: profile.weekStartsOn,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function convertZones(zones: V1TrainingZone[], maxHeartRate: number): V2ZoneSet | null {
  if (zones.length === 0) {
    return null;
  }

  const sortedZones = [...zones].sort((left, right) => left.sortOrder - right.sortOrder);
  const timestamp = sortedZones[0]?.createdAt ?? new Date().toISOString();

  return {
    id: createId(),
    sport: 'cycling',
    metric: 'heart_rate',
    referenceValue: maxHeartRate,
    zones: sortedZones.map((zone, index) => ({
      id: zone.id,
      name: zone.name,
      ...(zone.description ? { description: zone.description } : {}),
      minValue: zone.minHeartRate,
      maxValue: zone.maxHeartRate,
      sortOrder: index + 1,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function convertScheduledWorkout(workout: V1ScheduledWorkout, zoneSetId: string) {
  return {
    id: workout.id,
    ...convertDefinition(workout, zoneSetId, workout.plannedDistanceKm, workout.description),
    scheduledDate: workout.scheduledDate,
    status: workout.status,
    ...(workout.sourceTemplateId ? { sourceTemplateId: workout.sourceTemplateId } : {}),
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
  };
}

function convertTemplate(template: V1WorkoutTemplate, zoneSetId: string) {
  return {
    id: template.id,
    ...convertDefinition(template, zoneSetId),
    isArchived: template.archived === true,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function convertDefinition(
  workout: V1WorkoutBase & { intensityMetric?: V1ScheduledWorkout['intensityMetric'] },
  zoneSetId: string,
  plannedDistanceKm?: number,
  description?: string,
): V2Definition {
  const sport = toSport(workout.discipline);
  const plannedDurationSeconds = Math.max(
    0,
    Math.round((workout.estimatedDurationMinutes ?? 0) * 60),
  );
  const steps = [...(workout.blocks ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((block) => convertBlock(block, zoneSetId));

  return {
    title: workout.title,
    sport,
    ...(sport === 'cycling' &&
    workout.discipline !== 'strength' &&
    workout.discipline !== 'mobility'
      ? { modality: workout.discipline }
      : {}),
    category: toCategory(sport, workout.workoutType),
    primaryMetric: workout.intensityMetric === 'rpe' ? 'rpe' : 'heart_rate',
    steps: steps.length > 0 ? steps : [createFallbackStep(plannedDurationSeconds)],
    plannedDurationSeconds,
    ...(plannedDistanceKm && plannedDistanceKm > 0
      ? { plannedDistanceMeters: Math.round(plannedDistanceKm * 1000) }
      : {}),
    ...(workout.objective ? { objective: workout.objective } : {}),
    ...(description ? { description } : {}),
    ...(workout.notes ? { notes: workout.notes } : {}),
  };
}

function convertBlock(block: V1WorkoutBlock, zoneSetId: string): V2IntervalStep {
  const hasDistance = block.targetType === 'distance' && (block.distanceKm ?? 0) > 0;
  const hasCadence = block.cadenceMin !== undefined || block.cadenceMax !== undefined;
  const cadenceMin = block.cadenceMin ?? block.cadenceMax ?? 0;
  const cadenceMax = block.cadenceMax ?? block.cadenceMin ?? 0;

  return {
    id: block.id,
    kind: 'interval',
    name: block.name,
    phase: block.blockType === 'free' ? 'active' : block.blockType,
    duration: hasDistance
      ? { type: 'distance', meters: Math.round((block.distanceKm ?? 0) * 1000) }
      : { type: 'time', seconds: Math.max(1, Math.round(block.durationMinutes * 60)) },
    ...(toTarget(block, zoneSetId) ?? {}),
    ...(hasCadence
      ? {
          cadenceRpm: {
            min: Math.min(cadenceMin, cadenceMax),
            max: Math.max(cadenceMin, cadenceMax),
          },
        }
      : {}),
    ...(block.instructions ? { notes: block.instructions } : {}),
  };
}

function toTarget(block: V1WorkoutBlock, zoneSetId: string): { target: V2Target } | null {
  const snapshot = block.targetZoneSnapshot;

  if (snapshot) {
    const zoneId = block.targetZoneId ?? snapshot.id;

    return {
      target: {
        metric: 'heart_rate',
        zoneId,
        zoneSnapshot: {
          zoneSetId,
          zoneId,
          name: snapshot.name,
          metric: 'heart_rate',
          minValue: snapshot.minHeartRate,
          maxValue: snapshot.maxHeartRate,
        },
      },
    };
  }

  if (block.targetRpe !== undefined) {
    return {
      target: { metric: 'rpe', value: Math.min(10, Math.max(1, Math.round(block.targetRpe))) },
    };
  }

  return null;
}

function createFallbackStep(plannedDurationSeconds: number): V2IntervalStep {
  return {
    id: createId(),
    kind: 'interval',
    name: 'Sesión',
    phase: 'active',
    duration:
      plannedDurationSeconds > 0
        ? { type: 'time', seconds: plannedDurationSeconds }
        : { type: 'open' },
  };
}

function toSport(discipline: V1WorkoutBase['discipline']): V2Sport {
  switch (discipline) {
    case 'mobility':
      return 'mobility';
    case 'strength':
      return 'plyometrics';
    default:
      return 'cycling';
  }
}

function toCategory(sport: V2Sport, workoutType: string): V2Category {
  switch (sport) {
    case 'mobility':
      return workoutType === 'recovery' || workoutType === 'free' ? workoutType : 'mobility';
    case 'plyometrics':
      return workoutType === 'technique' || workoutType === 'free' ? workoutType : 'power';
    default:
      return toEnduranceCategory(workoutType);
  }
}

function toEnduranceCategory(workoutType: string): V2Category {
  switch (workoutType) {
    case 'recovery':
    case 'tempo':
    case 'threshold':
    case 'vo2max':
    case 'technique':
    case 'free':
      return workoutType;
    default:
      // 'base', 'climbing', 'endurance' and unknown values
      return 'endurance';
  }
}
