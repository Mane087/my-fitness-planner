import { StepDurationType, StepKind } from '../domain/schemas/workout-step.schema';
import type { IntervalStep, WorkoutStep } from '../domain/schemas/workout-step.schema';
import { IntensityMetric, Sport } from '../domain/workout.enums';
import { flattenSteps } from '../services/workout-structure.utils';

/** One block of the read-only workout profile. Ratios are fractions of the full width or height. */
export interface WorkoutProfileBar {
  /** Distance from the left edge, from 0 to 1. */
  startRatio: number;
  /** Share of the workout time, from 0 to 1. */
  widthRatio: number;
  /** Intensity, from 0 to 1. */
  heightRatio: number;
  /** Zone number from 1 to 7, or null when the step has no intensity target. */
  zone: number | null;
}

/** Height of a step without intensity target. */
const NEUTRAL_HEIGHT_RATIO = 0.4;
const LOWEST_ZONE_HEIGHT_RATIO = 0.5;
const HEIGHT_RATIO_PER_ZONE = 0.1;
export const MAX_PROFILE_ZONE = 7;

/** Width weight of a step that has no time: distance steps and open steps. */
const OPEN_STEP_SECONDS = 300;
const SECONDS_PER_METER: Record<Sport, number> = {
  [Sport.Cycling]: 0.12,
  [Sport.Running]: 0.3,
  [Sport.Mobility]: 0.3,
  [Sport.Plyometrics]: 0.3,
};

/**
 * Blocks of the profile of a workout, in execution order (repeat groups are expanded). The width
 * of each block is proportional to the step time. A distance step has no time, so its width
 * uses an estimate from a typical speed of the sport, and an open step counts five minutes.
 * Exercise steps do not draw a profile: a workout with only exercises returns no blocks.
 */
export function buildWorkoutProfile(
  steps: readonly WorkoutStep[],
  sport: Sport = Sport.Running,
): WorkoutProfileBar[] {
  const intervals = flattenSteps(steps)
    .filter((step): step is IntervalStep => step.kind === StepKind.Interval)
    .map((step) => ({ seconds: estimateProfileSeconds(step.duration, sport), step }))
    .filter((item) => item.seconds > 0);
  const totalSeconds = intervals.reduce((total, item) => total + item.seconds, 0);

  if (totalSeconds === 0) return [];

  let elapsedSeconds = 0;

  return intervals.map(({ seconds, step }) => {
    const zone = resolveProfileZone(step.target);
    const bar: WorkoutProfileBar = {
      startRatio: elapsedSeconds / totalSeconds,
      widthRatio: seconds / totalSeconds,
      heightRatio: zone === null ? NEUTRAL_HEIGHT_RATIO : zoneHeightRatio(zone),
      zone,
    };
    elapsedSeconds += seconds;
    return bar;
  });
}

/** Zone totals in seconds, from the profile blocks. Blocks without zone are not counted. */
export function sumSecondsByZone(
  steps: readonly WorkoutStep[],
  sport: Sport = Sport.Running,
): Map<number, number> {
  const intervals = flattenSteps(steps).filter(
    (step): step is IntervalStep => step.kind === StepKind.Interval,
  );
  const secondsByZone = new Map<number, number>();

  for (const step of intervals) {
    const zone = resolveProfileZone(step.target);
    const seconds = estimateProfileSeconds(step.duration, sport);
    if (zone !== null && seconds > 0) {
      secondsByZone.set(zone, (secondsByZone.get(zone) ?? 0) + seconds);
    }
  }

  return secondsByZone;
}

export function zoneHeightRatio(zone: number): number {
  return Math.min(1, LOWEST_ZONE_HEIGHT_RATIO + HEIGHT_RATIO_PER_ZONE * (zone - 1));
}

/**
 * Zone number of a step target. Zone snapshots keep the zone name (`Z2 Resistencia`), which
 * starts with the number. An RPE target maps its 1–10 scale to the seven zones.
 */
export function resolveProfileZone(target: IntervalStep['target']): number | null {
  if (!target) return null;

  if (target.metric === IntensityMetric.Rpe) {
    return clampZone(Math.ceil(target.value * 0.7));
  }

  const match = /^Z(\d)/i.exec(target.zoneSnapshot.name.trim());
  return match ? clampZone(Number(match[1])) : null;
}

function estimateProfileSeconds(duration: IntervalStep['duration'], sport: Sport): number {
  switch (duration.type) {
    case StepDurationType.Time:
      return duration.seconds;
    case StepDurationType.Distance:
      return duration.meters * SECONDS_PER_METER[sport];
    default:
      return OPEN_STEP_SECONDS;
  }
}

function clampZone(zone: number): number {
  return Math.min(MAX_PROFILE_ZONE, Math.max(1, zone));
}
