/**
 * Exercise steps written before isometrics stored `reps` directly. They now keep a `measure`.
 * These functions upgrade stored data (IndexedDB records and imported backups) to the new shape.
 * They work on unknown data because the data has not been validated yet, and they are idempotent.
 */

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function upgradeStep(step: unknown): unknown {
  if (!isRecord(step)) return step;

  if (step['kind'] === 'repeat') {
    return { ...step, steps: upgradeLegacyExerciseSteps(step['steps']) };
  }

  if (step['kind'] === 'exercise' && step['measure'] === undefined && 'reps' in step) {
    const { reps, ...rest } = step;
    return { ...rest, measure: { type: 'reps', reps } };
  }

  return step;
}

/** Steps with every legacy exercise converted to `{ measure: { type: 'reps', reps } }`. */
export function upgradeLegacyExerciseSteps(steps: unknown): unknown {
  return Array.isArray(steps) ? steps.map(upgradeStep) : steps;
}

/** A scheduled workout or template with its steps upgraded. */
export function upgradeLegacyWorkout(workout: unknown): unknown {
  return isRecord(workout) && 'steps' in workout
    ? { ...workout, steps: upgradeLegacyExerciseSteps(workout['steps']) }
    : workout;
}

const WORKOUT_STORE_NAMES = ['scheduled_workouts', 'workout_templates'] as const;

/** A parsed backup file with the workouts of both workout stores upgraded. */
export function upgradeLegacyBackup(backup: unknown): unknown {
  if (!isRecord(backup) || !isRecord(backup['stores'])) return backup;

  const stores: UnknownRecord = { ...backup['stores'] };

  for (const name of WORKOUT_STORE_NAMES) {
    const records = stores[name];
    if (Array.isArray(records)) stores[name] = records.map(upgradeLegacyWorkout);
  }

  return { ...backup, stores };
}
