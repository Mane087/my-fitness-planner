export const WorkoutType = {
  Recovery: 'recovery',
  Base: 'base',
  Endurance: 'endurance',
  Climbing: 'climbing',
  Tempo: 'tempo',
  Threshold: 'threshold',
  Vo2Max: 'vo2max',
  Technique: 'technique',
  Free: 'free',
} as const;

export type WorkoutType = (typeof WorkoutType)[keyof typeof WorkoutType];

export const WorkoutDiscipline = {
  Road: 'road',
  Mtb: 'mtb',
  Indoor: 'indoor',
  Strength: 'strength',
  Mobility: 'mobility',
} as const;

export type WorkoutDiscipline = (typeof WorkoutDiscipline)[keyof typeof WorkoutDiscipline];

export const WorkoutStatus = {
  Planned: 'planned',
  Completed: 'completed',
  Skipped: 'skipped',
} as const;

export type WorkoutStatus = (typeof WorkoutStatus)[keyof typeof WorkoutStatus];

export const WORKOUT_TYPES = Object.values(WorkoutType) as WorkoutType[];
export const WORKOUT_DISCIPLINES = Object.values(WorkoutDiscipline) as WorkoutDiscipline[];
export const WORKOUT_STATUSES = Object.values(WorkoutStatus) as WorkoutStatus[];
