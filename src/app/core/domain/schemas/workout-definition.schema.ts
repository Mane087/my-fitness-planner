import { z } from 'zod';

import {
  INTENSITY_METRICS,
  SPORT_MODALITIES,
  SPORT_MODALITIES_ALL,
  SPORTS,
  WORKOUT_CATEGORIES,
  WORKOUT_CATEGORIES_BY_SPORT,
} from '../workout.enums';
import { collectStepIds, workoutStepSchema } from './workout-step.schema';

/**
 * Shared by templates and scheduled workouts. Entities spread this shape and
 * call `refineWorkoutDefinition` from their own `superRefine`, because Zod
 * refinements are not carried over when extending an object schema.
 */
export const workoutDefinitionShape = {
  title: z.string().trim().min(1, 'El título del entrenamiento es requerido.').max(120),
  sport: z.enum(SPORTS, { error: 'Selecciona un deporte.' }),
  modality: z.enum(SPORT_MODALITIES_ALL).optional(),
  category: z.enum(WORKOUT_CATEGORIES, { error: 'Selecciona la categoría del entrenamiento.' }),
  primaryMetric: z.enum(INTENSITY_METRICS, { error: 'Selecciona la métrica de intensidad.' }),
  steps: z.array(workoutStepSchema).min(1, 'Agrega al menos un paso al entrenamiento.'),
  plannedDurationSeconds: z
    .number()
    .int()
    .nonnegative('La duración planeada no puede ser negativa.'),
  plannedDistanceMeters: z
    .number()
    .int()
    .positive('La distancia debe ser mayor que cero.')
    .optional(),
  objective: z.string().trim().max(250).optional(),
  description: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
};

const workoutDefinitionBaseSchema = z.object(workoutDefinitionShape);

export type WorkoutDefinition = z.infer<typeof workoutDefinitionBaseSchema>;

export function refineWorkoutDefinition(
  definition: WorkoutDefinition,
  context: z.RefinementCtx,
): void {
  if (!WORKOUT_CATEGORIES_BY_SPORT[definition.sport].includes(definition.category)) {
    context.addIssue({
      code: 'custom',
      message: 'La categoría no aplica para este deporte.',
      path: ['category'],
    });
  }

  const allowedModalities = SPORT_MODALITIES[definition.sport];

  if (definition.modality !== undefined && !allowedModalities.includes(definition.modality)) {
    context.addIssue({
      code: 'custom',
      message:
        allowedModalities.length === 0
          ? 'Este deporte no tiene modalidades.'
          : 'La modalidad no aplica para este deporte.',
      path: ['modality'],
    });
  }

  const seenIds = new Set<string>();

  for (const [index, id] of collectStepIds(definition.steps).entries()) {
    if (seenIds.has(id)) {
      context.addIssue({
        code: 'custom',
        message: 'Los identificadores de paso deben ser únicos.',
        path: ['steps', index],
      });
      return;
    }
    seenIds.add(id);
  }
}

export const workoutDefinitionSchema =
  workoutDefinitionBaseSchema.superRefine(refineWorkoutDefinition);
