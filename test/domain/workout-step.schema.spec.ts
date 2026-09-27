import {
  exerciseStepSchema,
  intervalStepSchema,
  repeatStepSchema,
  workoutStepSchema,
} from '../../src/app/core/domain/schemas/workout-step.schema';
import { exercise, heartRateSnapshot, interval, repeat } from './fixtures';

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe('intervalStepSchema', () => {
  it('accepts a time interval with a heart rate zone target and cadence', () => {
    const result = intervalStepSchema.safeParse(
      interval('a', { cadenceRpm: { min: 90, max: 95 } }),
    );

    expect(result.success).toBe(true);
  });

  it('accepts distance and open durations', () => {
    expect(
      intervalStepSchema.safeParse(interval('a', { duration: { type: 'distance', meters: 5000 } }))
        .success,
    ).toBe(true);
    expect(
      intervalStepSchema.safeParse(interval('a', { duration: { type: 'open' } })).success,
    ).toBe(true);
  });

  it('accepts an interval without target', () => {
    expect(intervalStepSchema.safeParse(interval('a', { target: undefined })).success).toBe(true);
  });

  it('rejects a time interval with zero seconds with a Spanish message', () => {
    const result = intervalStepSchema.safeParse(
      interval('a', { duration: { type: 'time', seconds: 0 } }),
    );

    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('La duración debe ser mayor que cero.');
  });

  it('rejects a distance interval with zero meters', () => {
    const result = intervalStepSchema.safeParse(
      interval('a', { duration: { type: 'distance', meters: 0 } }),
    );

    expect(firstMessage(result)).toBe('La distancia debe ser mayor que cero.');
  });

  it('rejects an empty name', () => {
    expect(firstMessage(intervalStepSchema.safeParse(interval('a', { name: '   ' })))).toBe(
      'El nombre del paso es requerido.',
    );
  });

  it('rejects a cadence range with min greater than max', () => {
    const result = intervalStepSchema.safeParse(
      interval('a', { cadenceRpm: { min: 100, max: 90 } }),
    );

    expect(firstMessage(result)).toBe('La cadencia mínima no puede ser mayor que la máxima.');
  });

  it('rejects a zone target whose snapshot metric differs from the target metric', () => {
    const result = intervalStepSchema.safeParse(
      interval('a', {
        target: {
          metric: 'heart_rate',
          zoneId: 'zone-z2',
          zoneSnapshot: heartRateSnapshot({ metric: 'power' }),
        },
      }),
    );

    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('La zona seleccionada no corresponde a la métrica del paso.');
  });

  it('rejects an RPE target outside 1-10', () => {
    const result = intervalStepSchema.safeParse(
      interval('a', { target: { metric: 'rpe', value: 11 } }),
    );

    expect(firstMessage(result)).toBe('El RPE debe estar entre 1 y 10.');
  });

  it('rejects an unknown phase', () => {
    const result = intervalStepSchema.safeParse({ ...interval('a'), phase: 'sprint' });

    expect(result.success).toBe(false);
  });
});

describe('exerciseStepSchema', () => {
  it('accepts sets, reps, load, rest and RPE', () => {
    expect(exerciseStepSchema.safeParse(exercise('a', { loadKg: 20 })).success).toBe(true);
  });

  it('rejects zero sets or reps', () => {
    expect(firstMessage(exerciseStepSchema.safeParse(exercise('a', { sets: 0 })))).toBe(
      'Las series deben ser al menos 1.',
    );
    expect(firstMessage(exerciseStepSchema.safeParse(exercise('a', { reps: 0 })))).toBe(
      'Las repeticiones deben ser al menos 1.',
    );
  });

  it('rejects a zone target on an exercise', () => {
    const result = exerciseStepSchema.safeParse({
      ...exercise('a'),
      target: { metric: 'heart_rate', zoneId: 'z', zoneSnapshot: heartRateSnapshot() },
    });

    expect(result.success).toBe(false);
  });
});

describe('repeatStepSchema', () => {
  it('accepts a group of intervals and exercises', () => {
    expect(
      repeatStepSchema.safeParse(repeat('r', { steps: [interval('a'), exercise('b')] })).success,
    ).toBe(true);
  });

  it('rejects fewer than two repetitions', () => {
    expect(firstMessage(repeatStepSchema.safeParse(repeat('r', { repetitions: 1 })))).toBe(
      'Una repetición debe ejecutarse al menos 2 veces.',
    );
  });

  it('rejects an empty group', () => {
    expect(firstMessage(repeatStepSchema.safeParse(repeat('r', { steps: [] })))).toBe(
      'Una repetición debe contener al menos un paso.',
    );
  });

  it('rejects a nested repeat group', () => {
    const result = repeatStepSchema.safeParse({ ...repeat('r'), steps: [repeat('inner')] });

    expect(result.success).toBe(false);
  });
});

describe('workoutStepSchema', () => {
  it('discriminates by kind', () => {
    expect(workoutStepSchema.safeParse(interval('a')).success).toBe(true);
    expect(workoutStepSchema.safeParse(exercise('b')).success).toBe(true);
    expect(workoutStepSchema.safeParse(repeat('c')).success).toBe(true);
    expect(workoutStepSchema.safeParse({ id: 'x', kind: 'unknown' }).success).toBe(false);
  });
});
