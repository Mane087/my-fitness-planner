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

    expect(totals).toEqual({
      durationSeconds: 2760,
      distanceMeters: null,
      stepCount: 4,
      timeUnderTensionSeconds: 0,
    });
  });

  it('sums distance intervals without adding time', () => {
    const totals = calculateWorkoutTotals([
      interval('a', { duration: { type: 'distance', meters: 2000 } }),
      interval('b', { duration: { type: 'distance', meters: 5000 } }),
      interval('c', { duration: { type: 'time', seconds: 300 } }),
    ]);

    expect(totals).toEqual({
      durationSeconds: 300,
      distanceMeters: 7000,
      stepCount: 3,
      timeUnderTensionSeconds: 0,
    });
  });

  it('ignores open intervals in the totals', () => {
    const totals = calculateWorkoutTotals([
      interval('a', { duration: { type: 'open' } }),
      interval('b', { duration: { type: 'time', seconds: 300 } }),
    ]);

    expect(totals).toEqual({
      durationSeconds: 300,
      distanceMeters: null,
      stepCount: 2,
      timeUnderTensionSeconds: 0,
    });
  });

  it('estimates exercises as sets × (reps × 3 s + rest)', () => {
    const totals = calculateWorkoutTotals([
      exercise('box', { sets: 4, measure: { type: 'reps', reps: 8 }, restSeconds: 90 }),
      exercise('broad', { sets: 3, measure: { type: 'reps', reps: 6 }, restSeconds: 60 }),
      exercise('skater', { sets: 3, measure: { type: 'reps', reps: 12 }, restSeconds: 60 }),
    ]);

    expect(totals).toEqual({
      durationSeconds: 978,
      distanceMeters: null,
      stepCount: 3,
      timeUnderTensionSeconds: 0,
    });
  });

  it('treats a missing rest as zero seconds', () => {
    const totals = calculateWorkoutTotals([
      exercise('a', { sets: 2, measure: { type: 'reps', reps: 5 }, restSeconds: undefined }),
    ]);

    expect(totals.durationSeconds).toBe(30);
  });

  it('estimates hold exercises as sets × (hold seconds + rest)', () => {
    const totals = calculateWorkoutTotals([
      exercise('plank', { sets: 3, measure: { type: 'hold', seconds: 45 }, restSeconds: 30 }),
    ]);

    expect(totals.durationSeconds).toBe(225);
    expect(totals.timeUnderTensionSeconds).toBe(135);
  });

  it('doubles the work of a per-side exercise but not the rest', () => {
    const totals = calculateWorkoutTotals([
      exercise('side-plank', {
        sets: 3,
        measure: { type: 'hold', seconds: 30 },
        perSide: true,
        restSeconds: 20,
      }),
      exercise('lunge', {
        sets: 2,
        measure: { type: 'reps', reps: 10 },
        perSide: true,
        restSeconds: 30,
      }),
    ]);

    // 3 × (30 × 2 + 20) + 2 × (10 × 3 × 2 + 30)
    expect(totals.durationSeconds).toBe(240 + 180);
    expect(totals.timeUnderTensionSeconds).toBe(180);
  });

  it('does not count repetitions as time under tension', () => {
    const totals = calculateWorkoutTotals([exercise('squat', { sets: 3 })]);

    expect(totals.timeUnderTensionSeconds).toBe(0);
  });

  it('multiplies time under tension inside repeat groups', () => {
    const totals = calculateWorkoutTotals([
      repeat('circuit', {
        repetitions: 3,
        steps: [
          exercise('plank', { sets: 1, measure: { type: 'hold', seconds: 40 }, restSeconds: 0 }),
        ],
      }),
    ]);

    expect(totals.timeUnderTensionSeconds).toBe(120);
  });

  it('multiplies distance inside repeat groups', () => {
    const totals = calculateWorkoutTotals([
      repeat('r', {
        repetitions: 4,
        steps: [interval('w', { duration: { type: 'distance', meters: 400 } })],
      }),
    ]);

    expect(totals).toEqual({
      durationSeconds: 0,
      distanceMeters: 1600,
      stepCount: 1,
      timeUnderTensionSeconds: 0,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(calculateWorkoutTotals([])).toEqual({
      durationSeconds: 0,
      distanceMeters: null,
      stepCount: 0,
      timeUnderTensionSeconds: 0,
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
