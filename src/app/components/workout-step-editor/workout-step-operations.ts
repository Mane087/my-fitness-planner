import type { TrainingZoneSetEntity } from '../../core/domain/schemas/training-zone-set.schema';
import {
  StepKind,
  type LeafStep,
  type RepeatStep,
  type WorkoutStep,
} from '../../core/domain/schemas/workout-step.schema';
import {
  IntensityMetric,
  type IntensityMetric as IntensityMetricType,
} from '../../core/domain/workout.enums';
import {
  createExerciseStep,
  createIntervalStep,
  createRepeatStep,
} from '../../core/services/workout-structure.utils';

/** Kinds that can be created. Repeat groups only exist at the top level. */
export type LeafStepKind = typeof StepKind.Interval | typeof StepKind.Exercise;
export type MoveDirection = -1 | 1;

// Pure, immutable operations on the step list: every function returns a new array
// and leaves the input untouched, so the editor can keep the list in a signal.

export function createLeafStep(kind: LeafStepKind): LeafStep {
  return kind === StepKind.Exercise ? createExerciseStep() : createIntervalStep();
}

export function addStep(
  steps: readonly WorkoutStep[],
  kind: LeafStepKind | typeof StepKind.Repeat,
): WorkoutStep[] {
  const step =
    kind === StepKind.Repeat
      ? createRepeatStep({ steps: [createIntervalStep()] })
      : createLeafStep(kind);

  return [...steps, step];
}

export function addStepToRepeat(
  steps: readonly WorkoutStep[],
  repeatId: string,
  kind: LeafStepKind,
): WorkoutStep[] {
  return steps.map((step) =>
    step.kind === StepKind.Repeat && step.id === repeatId
      ? { ...step, steps: [...step.steps, createLeafStep(kind)] }
      : step,
  );
}

/** Removes a step at any level. An emptied repeat group is kept so the user can refill it. */
export function removeStep(steps: readonly WorkoutStep[], stepId: string): WorkoutStep[] {
  return steps
    .filter((step) => step.id !== stepId)
    .map((step) =>
      step.kind === StepKind.Repeat
        ? { ...step, steps: step.steps.filter((child) => child.id !== stepId) }
        : step,
    );
}

/** Moves a step one position inside its own list (top level or repeat group). */
export function moveStep(
  steps: readonly WorkoutStep[],
  stepId: string,
  direction: MoveDirection,
): WorkoutStep[] {
  if (steps.some((step) => step.id === stepId)) {
    return moveInList(steps, stepId, direction);
  }

  return steps.map((step) =>
    step.kind === StepKind.Repeat && step.steps.some((child) => child.id === stepId)
      ? { ...step, steps: moveInList(step.steps, stepId, direction) }
      : step,
  );
}

/** Replaces the step with the same id at any level. The kind of a step never changes. */
export function replaceStep(
  steps: readonly WorkoutStep[],
  updated: LeafStep | RepeatStep,
): WorkoutStep[] {
  return steps.map((step) => {
    if (step.id === updated.id) {
      return updated;
    }

    if (step.kind === StepKind.Repeat && updated.kind !== StepKind.Repeat) {
      return {
        ...step,
        steps: step.steps.map((child) => (child.id === updated.id ? updated : child)),
      };
    }

    return step;
  });
}

/**
 * Drops zone targets that no longer belong to the workout zone set (for example after
 * changing the sport or the metric) and RPE targets on intervals when the metric is a zone.
 * Exercise RPE targets are always kept.
 */
export function clearIncompatibleTargets(
  steps: readonly WorkoutStep[],
  metric: IntensityMetricType | null,
  zoneSet: TrainingZoneSetEntity | null,
): WorkoutStep[] {
  const clearLeaf = (step: LeafStep): LeafStep => {
    const target = step.kind === StepKind.Interval ? step.target : undefined;

    if (!target) {
      return step;
    }

    const isCompatible =
      target.metric === IntensityMetric.Rpe
        ? metric === IntensityMetric.Rpe
        : zoneSet !== null &&
          target.metric === zoneSet.metric &&
          target.zoneSnapshot.zoneSetId === zoneSet.id &&
          zoneSet.zones.some((zone) => zone.id === target.zoneId);

    if (isCompatible) {
      return step;
    }

    const withoutTarget = { ...step };
    delete withoutTarget.target;
    return withoutTarget;
  };

  return steps.map((step) =>
    step.kind === StepKind.Repeat ? { ...step, steps: step.steps.map(clearLeaf) } : clearLeaf(step),
  );
}

function moveInList<Step extends { id: string }>(
  list: readonly Step[],
  stepId: string,
  direction: MoveDirection,
): Step[] {
  const index = list.findIndex((step) => step.id === stepId);
  const destination = index + direction;

  if (index < 0 || destination < 0 || destination >= list.length) {
    return [...list];
  }

  const next = [...list];
  const [step] = next.splice(index, 1);
  next.splice(destination, 0, step!);
  return next;
}
