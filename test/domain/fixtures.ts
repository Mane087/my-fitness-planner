import type { ScheduledWorkoutEntity } from '../../src/app/core/domain/schemas/scheduled-workout.schema';
import type {
  TrainingZoneSetEntity,
  TrainingZoneSnapshot,
} from '../../src/app/core/domain/schemas/training-zone-set.schema';
import type { WorkoutDefinition } from '../../src/app/core/domain/schemas/workout-definition.schema';
import type {
  ExerciseStep,
  IntervalStep,
  RepeatStep,
  ZoneTarget,
} from '../../src/app/core/domain/schemas/workout-step.schema';
import type { WorkoutTemplateEntity } from '../../src/app/core/domain/schemas/workout-template.schema';

export const TIMESTAMP = '2026-09-27T10:00:00.000Z';

export function heartRateSnapshot(
  overrides: Partial<TrainingZoneSnapshot> = {},
): TrainingZoneSnapshot {
  return {
    zoneSetId: 'zone-set-hr',
    zoneId: 'zone-z2',
    name: 'Z2 Resistencia',
    metric: 'heart_rate',
    minValue: 116,
    maxValue: 135,
    ...overrides,
  };
}

export function heartRateTarget(overrides: Partial<ZoneTarget> = {}): ZoneTarget {
  return {
    metric: 'heart_rate',
    zoneId: 'zone-z2',
    zoneSnapshot: heartRateSnapshot(),
    ...overrides,
  };
}

export function interval(id: string, overrides: Partial<IntervalStep> = {}): IntervalStep {
  return {
    id,
    kind: 'interval',
    name: `Intervalo ${id}`,
    phase: 'active',
    duration: { type: 'time', seconds: 300 },
    target: heartRateTarget(),
    ...overrides,
  };
}

export function exercise(id: string, overrides: Partial<ExerciseStep> = {}): ExerciseStep {
  return {
    id,
    kind: 'exercise',
    name: `Ejercicio ${id}`,
    sets: 4,
    reps: 8,
    restSeconds: 90,
    target: { metric: 'rpe', value: 8 },
    ...overrides,
  };
}

export function repeat(id: string, overrides: Partial<RepeatStep> = {}): RepeatStep {
  return {
    id,
    kind: 'repeat',
    repetitions: 3,
    steps: [
      interval(`${id}-work`),
      interval(`${id}-rest`, { phase: 'recovery', duration: { type: 'time', seconds: 120 } }),
    ],
    ...overrides,
  };
}

export function cyclingDefinition(overrides: Partial<WorkoutDefinition> = {}): WorkoutDefinition {
  return {
    title: 'Rodada con intervalos',
    sport: 'cycling',
    modality: 'road',
    category: 'threshold',
    primaryMetric: 'heart_rate',
    steps: [
      interval('warm-up', { phase: 'warm_up', duration: { type: 'time', seconds: 900 } }),
      repeat('main'),
      interval('cool-down', { phase: 'cool_down', duration: { type: 'time', seconds: 600 } }),
    ],
    plannedDurationSeconds: 2760,
    ...overrides,
  };
}

export function scheduledWorkout(
  overrides: Partial<ScheduledWorkoutEntity> = {},
): ScheduledWorkoutEntity {
  return {
    ...cyclingDefinition(),
    id: 'workout-1',
    scheduledDate: '2026-09-28',
    status: 'planned',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function workoutTemplate(
  overrides: Partial<WorkoutTemplateEntity> = {},
): WorkoutTemplateEntity {
  return {
    ...cyclingDefinition(),
    id: 'template-1',
    isArchived: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function heartRateZoneSet(
  overrides: Partial<TrainingZoneSetEntity> = {},
): TrainingZoneSetEntity {
  return {
    id: 'zone-set-hr',
    sport: 'cycling',
    metric: 'heart_rate',
    referenceValue: 193,
    zones: [
      { id: 'z1', name: 'Z1', minValue: 97, maxValue: 116, sortOrder: 1 },
      { id: 'z2', name: 'Z2', minValue: 116, maxValue: 135, sortOrder: 2 },
      { id: 'z3', name: 'Z3', minValue: 135, maxValue: 154, sortOrder: 3 },
    ],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}
