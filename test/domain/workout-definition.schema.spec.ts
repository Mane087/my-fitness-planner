import { scheduledWorkoutSchema } from '../../src/app/core/domain/schemas/scheduled-workout.schema';
import { workoutDefinitionSchema } from '../../src/app/core/domain/schemas/workout-definition.schema';
import {
  workoutTemplateSchema,
  type WorkoutTemplateEntity,
} from '../../src/app/core/domain/schemas/workout-template.schema';
import {
  cyclingDefinition,
  exercise,
  interval,
  scheduledWorkout,
  workoutTemplate,
} from './fixtures';

function messages(result: { error?: { issues: { message: string; path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) ?? [];
}

describe('workoutDefinitionSchema', () => {
  it('accepts the cycling example with a repeat group', () => {
    expect(workoutDefinitionSchema.safeParse(cyclingDefinition()).success).toBe(true);
  });

  it('accepts a plyometrics workout made of exercises without modality', () => {
    const definition = cyclingDefinition({
      title: 'Pliometría inferior',
      sport: 'plyometrics',
      modality: undefined,
      category: 'power',
      primaryMetric: 'rpe',
      steps: [exercise('box-jump'), exercise('broad-jump')],
      plannedDurationSeconds: 690,
    });

    expect(workoutDefinitionSchema.safeParse(definition).success).toBe(true);
  });

  it('rejects an empty title with a Spanish message', () => {
    const result = workoutDefinitionSchema.safeParse(cyclingDefinition({ title: '' }));

    expect(messages(result)).toContain('title: El título del entrenamiento es requerido.');
  });

  it('rejects a workout without steps', () => {
    const result = workoutDefinitionSchema.safeParse(cyclingDefinition({ steps: [] }));

    expect(messages(result)).toContain('steps: Agrega al menos un paso al entrenamiento.');
  });

  it('rejects a category that does not apply to the sport', () => {
    const result = workoutDefinitionSchema.safeParse(
      cyclingDefinition({ sport: 'mobility', modality: undefined, category: 'threshold' }),
    );

    expect(messages(result)).toContain('category: La categoría no aplica para este deporte.');
  });

  it('rejects a modality that belongs to another sport', () => {
    const result = workoutDefinitionSchema.safeParse(cyclingDefinition({ modality: 'trail' }));

    expect(messages(result)).toContain('modality: La modalidad no aplica para este deporte.');
  });

  it('rejects a modality for sports without modalities', () => {
    const result = workoutDefinitionSchema.safeParse(
      cyclingDefinition({ sport: 'plyometrics', category: 'power', modality: 'road' }),
    );

    expect(messages(result)).toContain('modality: Este deporte no tiene modalidades.');
  });

  it('rejects duplicated step ids, including ids inside repeat groups', () => {
    const result = workoutDefinitionSchema.safeParse(
      cyclingDefinition({ steps: [interval('dup'), interval('dup')] }),
    );

    expect(messages(result)).toContain('steps.1: Los identificadores de paso deben ser únicos.');
  });

  it('rejects a negative planned duration', () => {
    const result = workoutDefinitionSchema.safeParse(
      cyclingDefinition({ plannedDurationSeconds: -1 }),
    );

    expect(messages(result)).toContain(
      'plannedDurationSeconds: La duración planeada no puede ser negativa.',
    );
  });
});

describe('workoutTemplateSchema', () => {
  it('accepts a template and applies the definition rules', () => {
    expect(workoutTemplateSchema.safeParse(workoutTemplate()).success).toBe(true);
    expect(
      workoutTemplateSchema.safeParse(workoutTemplate({ sport: 'running', category: 'mobility' }))
        .success,
    ).toBe(false);
  });

  it('requires isArchived and audit fields', () => {
    const withoutFlag: Partial<WorkoutTemplateEntity> = workoutTemplate();
    delete withoutFlag.isArchived;

    expect(workoutTemplateSchema.safeParse(withoutFlag).success).toBe(false);
  });
});

describe('scheduledWorkoutSchema', () => {
  it('accepts a planned workout without completion', () => {
    expect(scheduledWorkoutSchema.safeParse(scheduledWorkout()).success).toBe(true);
  });

  it('accepts a completed workout with completion data', () => {
    const result = scheduledWorkoutSchema.safeParse(
      scheduledWorkout({
        status: 'completed',
        completion: {
          completedAt: '2026-09-28T18:30:00.000Z',
          durationSeconds: 2700,
          distanceMeters: 40000,
          rpe: 7,
          feeling: 4,
          notes: 'Buenas sensaciones',
        },
      }),
    );

    expect(result.success).toBe(true);
  });

  it('rejects a completed workout without completion', () => {
    const result = scheduledWorkoutSchema.safeParse(scheduledWorkout({ status: 'completed' }));

    expect(messages(result)).toContain(
      'completion: Un entrenamiento completado debe tener datos de ejecución.',
    );
  });

  it('rejects completion data on a planned or skipped workout', () => {
    const completion = { completedAt: '2026-09-28T18:30:00.000Z' };

    expect(
      messages(
        scheduledWorkoutSchema.safeParse(scheduledWorkout({ status: 'planned', completion })),
      ),
    ).toContain('status: Solo un entrenamiento completado puede tener datos de ejecución.');
    expect(
      scheduledWorkoutSchema.safeParse(scheduledWorkout({ status: 'skipped', completion })).success,
    ).toBe(false);
  });

  it('rejects a scheduled date that is not YYYY-MM-DD', () => {
    const result = scheduledWorkoutSchema.safeParse(
      scheduledWorkout({ scheduledDate: '28/09/2026' }),
    );

    expect(messages(result)).toContain('scheduledDate: La fecha debe usar el formato YYYY-MM-DD.');
  });

  it('rejects an RPE or feeling outside range in completion', () => {
    const result = scheduledWorkoutSchema.safeParse(
      scheduledWorkout({
        status: 'completed',
        completion: { completedAt: '2026-09-28T18:30:00.000Z', rpe: 0, feeling: 6 },
      }),
    );

    expect(messages(result)).toEqual(
      expect.arrayContaining([
        'completion.rpe: El RPE debe estar entre 1 y 10.',
        'completion.feeling: La sensación debe estar entre 1 y 5.',
      ]),
    );
  });
});
