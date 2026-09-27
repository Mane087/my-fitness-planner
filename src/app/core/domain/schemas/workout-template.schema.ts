import { z } from 'zod';

import { auditFieldsShape, idSchema } from './common.schema';
import { refineWorkoutDefinition, workoutDefinitionShape } from './workout-definition.schema';

export const workoutTemplateSchema = z
  .object({
    ...workoutDefinitionShape,
    id: idSchema,
    isArchived: z.boolean(),
    ...auditFieldsShape,
  })
  .superRefine(refineWorkoutDefinition);

export type WorkoutTemplateEntity = z.infer<typeof workoutTemplateSchema>;
