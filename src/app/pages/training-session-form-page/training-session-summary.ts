import type { WorkoutStep } from '../../core/domain/schemas/workout-step.schema';
import { StepKind } from '../../core/domain/schemas/workout-step.schema';
import { Sport } from '../../core/domain/workout.enums';
import { sumSecondsByZone } from '../../core/models/workout-profile';
import { flattenSteps } from '../../core/services/workout-structure.utils';

export interface ZoneSummaryItem {
  zone: number;
  minutes: number;
  widthPercent: number;
}

export interface TrainingSessionSummary {
  zones: ZoneSummaryItem[];
  exerciseCount: number;
  totalSets: number;
  /** Repeat groups, which the exercise sports call circuits. */
  groupCount: number;
}

/** Time per zone for interval sports and exercise and set counts for the exercise sports. */
export function buildZoneSummary(
  steps: readonly WorkoutStep[],
  sport: Sport | null,
): TrainingSessionSummary {
  const secondsByZone = sumSecondsByZone(steps, sport ?? undefined);
  const totalSeconds = Array.from(secondsByZone.values()).reduce(
    (total, value) => total + value,
    0,
  );
  const zones = Array.from(secondsByZone.entries())
    .sort(([first], [second]) => first - second)
    .map(([zone, seconds]) => ({
      zone,
      minutes: Math.round(seconds / 60),
      widthPercent: totalSeconds === 0 ? 0 : (seconds / totalSeconds) * 100,
    }));
  const exercises = flattenSteps(steps).filter((step) => step.kind === StepKind.Exercise);

  return {
    zones,
    exerciseCount: exercises.length,
    totalSets: exercises.reduce((total, step) => total + step.sets, 0),
    groupCount: steps.filter((step) => step.kind === StepKind.Repeat).length,
  };
}
