import { createId } from '../domain/entity-utils';
import {
  ExerciseMeasureType,
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
  /** Time spent holding positions (hold exercises, both sides when `perSide`). */
  timeUnderTensionSeconds: number;
}

/** Seconds assumed per repetition when estimating an exercise step. */
export const SECONDS_PER_REP = 3;

export function calculateWorkoutTotals(steps: readonly WorkoutStep[]): WorkoutTotals {
  let durationSeconds = 0;
  let distanceMeters = 0;
  let hasDistance = false;
  let stepCount = 0;
  let timeUnderTensionSeconds = 0;

  for (const step of steps) {
    if (step.kind === StepKind.Repeat) {
      const childTotals = calculateWorkoutTotals(step.steps);
      durationSeconds += childTotals.durationSeconds * step.repetitions;
      if (childTotals.distanceMeters !== null) {
        distanceMeters += childTotals.distanceMeters * step.repetitions;
        hasDistance = true;
      }
      stepCount += childTotals.stepCount;
      timeUnderTensionSeconds += childTotals.timeUnderTensionSeconds * step.repetitions;
      continue;
    }

    stepCount += 1;
    durationSeconds += estimateLeafStepSeconds(step);
    timeUnderTensionSeconds += holdSeconds(step);

    if (step.kind === StepKind.Interval && step.duration.type === StepDurationType.Distance) {
      distanceMeters += step.duration.meters;
      hasDistance = true;
    }
  }

  return {
    durationSeconds,
    distanceMeters: hasDistance ? distanceMeters : null,
    stepCount,
    timeUnderTensionSeconds,
  };
}

/** Sides worked in each set: both sides one after the other when the exercise is per side. */
export function sidesOf(step: ExerciseStep): number {
  return step.perSide ? 2 : 1;
}

/** Seconds spent holding a position: only hold exercises count, repetitions do not. */
export function holdSeconds(step: LeafStep): number {
  if (step.kind !== StepKind.Exercise || step.measure.type !== ExerciseMeasureType.Hold) return 0;
  return step.sets * step.measure.seconds * sidesOf(step);
}

/** Seconds of work of one set on one side: the hold time or reps × `SECONDS_PER_REP`. */
function setWorkSeconds(step: ExerciseStep): number {
  return step.measure.type === ExerciseMeasureType.Hold
    ? step.measure.seconds
    : step.measure.reps * SECONDS_PER_REP;
}

export function estimateLeafStepSeconds(step: LeafStep): number {
  if (step.kind === StepKind.Exercise) {
    return step.sets * (setWorkSeconds(step) * sidesOf(step) + (step.restSeconds ?? 0));
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
    measure: { type: ExerciseMeasureType.Reps, reps: 10 },
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
