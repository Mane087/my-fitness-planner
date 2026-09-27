import { z } from 'zod';

import { WORKOUT_STATUSES, WorkoutStatus } from '../workout.enums';
import { auditFieldsShape, dateOnlySchema, idSchema, isoDateTimeSchema } from './common.schema';
import { refineWorkoutDefinition, workoutDefinitionShape } from './workout-definition.schema';

export const workoutCompletionSchema = z.object({
  completedAt: isoDateTimeSchema,
  durationSeconds: z
    .number()
    .int()
    .positive('La duración real debe ser mayor que cero.')
    .optional(),
  distanceMeters: z
    .number()
    .int()
    .positive('La distancia real debe ser mayor que cero.')
    .optional(),
  rpe: z
    .number()
    .int()
    .min(1, 'El RPE debe estar entre 1 y 10.')
    .max(10, 'El RPE debe estar entre 1 y 10.')
    .optional(),
  feeling: z
    .number()
    .int()
    .min(1, 'La sensación debe estar entre 1 y 5.')
    .max(5, 'La sensación debe estar entre 1 y 5.')
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type WorkoutCompletion = z.infer<typeof workoutCompletionSchema>;

export const scheduledWorkoutSchema = z
  .object({
    ...workoutDefinitionShape,
    id: idSchema,
    scheduledDate: dateOnlySchema,
    status: z.enum(WORKOUT_STATUSES),
    sourceTemplateId: idSchema.optional(),
    completion: workoutCompletionSchema.optional(),
    ...auditFieldsShape,
  })
  .superRefine(refineWorkoutDefinition)
  .superRefine((workout, context) => {
    const isCompleted = workout.status === WorkoutStatus.Completed;
    const hasCompletion = workout.completion !== undefined;

    if (isCompleted && !hasCompletion) {
      context.addIssue({
        code: 'custom',
        message: 'Un entrenamiento completado debe tener datos de ejecución.',
        path: ['completion'],
      });
    }

    if (!isCompleted && hasCompletion) {
      context.addIssue({
        code: 'custom',
        message: 'Solo un entrenamiento completado puede tener datos de ejecución.',
        path: ['status'],
      });
    }
  });

export type ScheduledWorkoutEntity = z.infer<typeof scheduledWorkoutSchema>;
