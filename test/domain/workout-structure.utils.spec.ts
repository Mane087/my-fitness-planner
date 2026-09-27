import { workoutStepSchema } from '../../src/app/core/domain/schemas/workout-step.schema';
import {
  calculateWorkoutTotals,
  collectStepIds,
  createExerciseStep,
  createIntervalStep,
  createRepeatStep,
  flattenSteps,
} from '../../src/app/core/services/workout-structure.utils';
import { cyclingDefinition, exercise, interval, repeat } from './fixtures';

describe('calculateWorkoutTotals', () => {
  it('sums time intervals and multiplies repeat groups', () => {
    const totals = calculateWorkoutTotals(cyclingDefinition().steps);

    expect(totals).toEqual({ durationSeconds: 2760, distanceMeters: null, stepCount: 4 });
  });

  it('sums distance intervals without adding time', () => {
    const totals = calculateWorkoutTotals([
      interval('a', { duration: { type: 'distance', meters: 2000 } }),
      interval('b', { duration: { type: 'distance', meters: 5000 } }),
      interval('c', { duration: { type: 'time', seconds: 300 } }),
    ]);

    expect(totals).toEqual({ durationSeconds: 300, distanceMeters: 7000, stepCount: 3 });
  });

  it('ignores open intervals in the totals', () => {
    const totals = calculateWorkoutTotals([
      interval('a', { duration: { type: 'open' } }),
      interval('b', { duration: { type: 'time', seconds: 300 } }),
    ]);

    expect(totals).toEqual({ durationSeconds: 300, distanceMeters: null, stepCount: 2 });
  });

  it('estimates exercises as sets × (reps × 3 s + rest)', () => {
    const totals = calculateWorkoutTotals([
      exercise('box', { sets: 4, reps: 8, restSeconds: 90 }),
      exercise('broad', { sets: 3, reps: 6, restSeconds: 60 }),
      exercise('skater', { sets: 3, reps: 12, restSeconds: 60 }),
    ]);

    expect(totals).toEqual({ durationSeconds: 978, distanceMeters: null, stepCount: 3 });
  });

  it('treats a missing rest as zero seconds', () => {
    const totals = calculateWorkoutTotals([
      exercise('a', { sets: 2, reps: 5, restSeconds: undefined }),
    ]);

    expect(totals.durationSeconds).toBe(30);
  });

  it('multiplies distance inside repeat groups', () => {
    const totals = calculateWorkoutTotals([
      repeat('r', {
        repetitions: 4,
        steps: [interval('w', { duration: { type: 'distance', meters: 400 } })],
      }),
    ]);

    expect(totals).toEqual({ durationSeconds: 0, distanceMeters: 1600, stepCount: 1 });
  });

  it('returns zeros for an empty list', () => {
    expect(calculateWorkoutTotals([])).toEqual({
      durationSeconds: 0,
      distanceMeters: null,
      stepCount: 0,
    });
  });
});

describe('flattenSteps', () => {
  it('expands repeat groups in execution order', () => {
    const flat = flattenSteps([interval('a'), repeat('r', { repetitions: 2 }), interval('z')]);

    expect(flat.map((step) => step.id)).toEqual(['a', 'r-work', 'r-rest', 'r-work', 'r-rest', 'z']);
  });
});

describe('collectStepIds', () => {
  it('includes the repeat group id and its children', () => {
    expect(collectStepIds([interval('a'), repeat('r')])).toEqual(['a', 'r', 'r-work', 'r-rest']);
  });
});

describe('step factories', () => {
  it('create steps that satisfy the schema once they have a name', () => {
    const steps = [
      createIntervalStep({ name: 'Calentamiento' }),
      createExerciseStep({ name: 'Sentadilla' }),
      createRepeatStep({ steps: [createIntervalStep({ name: 'Trabajo' })] }),
    ];

    for (const step of steps) {
      expect(workoutStepSchema.safeParse(step).success).toBe(true);
    }
  });

  it('generate unique ids', () => {
    const ids = new Set([
      createIntervalStep().id,
      createIntervalStep().id,
      createExerciseStep().id,
    ]);

    expect(ids.size).toBe(3);
  });
});
