import { createId } from '../domain/entity-utils';
import {
  StepDurationType,
  StepKind,
  type ExerciseStep,
  type IntervalStep,
  type LeafStep,
  type RepeatStep,
  type WorkoutStep,
} from '../domain/schemas/workout-step.schema';
import { StepPhase } from '../domain/workout.enums';

export interface WorkoutTotals {
  durationSeconds: number;
  distanceMeters: number | null;
  /** Steps authored by the user, without expanding repeat groups. */
  stepCount: number;
}

/** Seconds assumed per repetition when estimating an exercise step. */
export const SECONDS_PER_REP = 3;

export function calculateWorkoutTotals(steps: readonly WorkoutStep[]): WorkoutTotals {
  let durationSeconds = 0;
  let distanceMeters = 0;
  let hasDistance = false;
  let stepCount = 0;

  for (const step of steps) {
    if (step.kind === StepKind.Repeat) {
      const childTotals = calculateWorkoutTotals(step.steps);
      durationSeconds += childTotals.durationSeconds * step.repetitions;
      if (childTotals.distanceMeters !== null) {
        distanceMeters += childTotals.distanceMeters * step.repetitions;
        hasDistance = true;
      }
      stepCount += childTotals.stepCount;
      continue;
    }

    stepCount += 1;
    durationSeconds += estimateLeafStepSeconds(step);

    if (step.kind === StepKind.Interval && step.duration.type === StepDurationType.Distance) {
      distanceMeters += step.duration.meters;
      hasDistance = true;
    }
  }

  return { durationSeconds, distanceMeters: hasDistance ? distanceMeters : null, stepCount };
}

export function estimateLeafStepSeconds(step: LeafStep): number {
  if (step.kind === StepKind.Exercise) {
    return step.sets * (step.reps * SECONDS_PER_REP + (step.restSeconds ?? 0));
  }

  return step.duration.type === StepDurationType.Time ? step.duration.seconds : 0;
}

/** Expands repeat groups into the sequence of leaf steps as they would be executed. */
export function flattenSteps(steps: readonly WorkoutStep[]): LeafStep[] {
  return steps.flatMap((step) =>
    step.kind === StepKind.Repeat
      ? Array.from({ length: step.repetitions }, () => step.steps).flat()
      : [step],
  );
}

export { collectStepIds } from '../domain/schemas/workout-step.schema';

export function createIntervalStep(
  overrides: Partial<Omit<IntervalStep, 'kind'>> = {},
): IntervalStep {
  return {
    id: createId(),
    kind: StepKind.Interval,
    name: '',
    phase: StepPhase.Active,
    duration: { type: StepDurationType.Time, seconds: 600 },
    ...overrides,
  };
}

export function createExerciseStep(
  overrides: Partial<Omit<ExerciseStep, 'kind'>> = {},
): ExerciseStep {
  return {
    id: createId(),
    kind: StepKind.Exercise,
    name: '',
    sets: 3,
    reps: 10,
    restSeconds: 60,
    ...overrides,
  };
}

export function createRepeatStep(overrides: Partial<Omit<RepeatStep, 'kind'>> = {}): RepeatStep {
  return {
    id: createId(),
    kind: StepKind.Repeat,
    repetitions: 2,
    steps: [],
    ...overrides,
  };
}
