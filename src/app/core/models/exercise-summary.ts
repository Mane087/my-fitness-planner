import type { WorkoutStep } from '../domain/schemas/workout-step.schema';
import { calculateWorkoutTotals } from '../services/workout-structure.utils';

/** Duration as `1 min 30 s`, `2 min` or `45 s`. */
export function formatHoldDuration(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

/** Text of a workout made of exercises: how many there are and the time under tension. */
export function formatExerciseSummary(steps: readonly WorkoutStep[]): string {
  const { stepCount, timeUnderTensionSeconds } = calculateWorkoutTotals(steps);
  const exercises = stepCount === 1 ? '1 ejercicio' : `${stepCount} ejercicios`;

  return timeUnderTensionSeconds > 0
    ? `${exercises} · ${formatHoldDuration(timeUnderTensionSeconds)} bajo tensión`
    : exercises;
}
