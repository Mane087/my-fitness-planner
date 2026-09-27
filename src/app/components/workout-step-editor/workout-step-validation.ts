import {
  StepKind,
  workoutStepSchema,
  type WorkoutStep,
} from '../../core/domain/schemas/workout-step.schema';

/** Validation messages (Spanish, from the Zod schema) grouped by step id, at any level. */
export type StepErrors = ReadonlyMap<string, readonly string[]>;

export function collectStepErrors(steps: readonly WorkoutStep[]): StepErrors {
  const errors = new Map<string, string[]>();
  const add = (stepId: string, message: string) => {
    const messages = errors.get(stepId) ?? [];
    if (!messages.includes(message)) messages.push(message);
    errors.set(stepId, messages);
  };

  for (const step of steps) {
    const result = workoutStepSchema.safeParse(step);

    if (result.success) continue;

    for (const issue of result.error.issues) {
      const [field, childIndex] = issue.path;
      const child =
        step.kind === StepKind.Repeat && field === 'steps' && typeof childIndex === 'number'
          ? step.steps[childIndex]
          : undefined;

      add(child?.id ?? step.id, issue.message);
    }
  }

  return errors;
}
