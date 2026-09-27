export const Sport = {
  Cycling: 'cycling',
  Running: 'running',
  Mobility: 'mobility',
  Plyometrics: 'plyometrics',
} as const;

export type Sport = (typeof Sport)[keyof typeof Sport];

export const SPORTS: readonly Sport[] = Object.values(Sport);

export const CyclingModality = {
  Road: 'road',
  Mtb: 'mtb',
  Gravel: 'gravel',
  Indoor: 'indoor',
} as const;

export const RunningModality = {
  Road: 'road',
  Trail: 'trail',
  Track: 'track',
  Treadmill: 'treadmill',
} as const;

export type SportModality =
  | (typeof CyclingModality)[keyof typeof CyclingModality]
  | (typeof RunningModality)[keyof typeof RunningModality];

export const SPORT_MODALITIES: Record<Sport, readonly SportModality[]> = {
  cycling: Object.values(CyclingModality),
  running: Object.values(RunningModality),
  mobility: [],
  plyometrics: [],
};

export const SPORT_MODALITIES_ALL: readonly SportModality[] = [
  ...new Set(Object.values(SPORT_MODALITIES).flat()),
];

export const WorkoutCategory = {
  Recovery: 'recovery',
  Endurance: 'endurance',
  Tempo: 'tempo',
  Threshold: 'threshold',
  Vo2Max: 'vo2max',
  Technique: 'technique',
  Strength: 'strength',
  Power: 'power',
  Mobility: 'mobility',
  Free: 'free',
} as const;

export type WorkoutCategory = (typeof WorkoutCategory)[keyof typeof WorkoutCategory];

export const WORKOUT_CATEGORIES: readonly WorkoutCategory[] = Object.values(WorkoutCategory);

const ENDURANCE_CATEGORIES: readonly WorkoutCategory[] = [
  WorkoutCategory.Recovery,
  WorkoutCategory.Endurance,
  WorkoutCategory.Tempo,
  WorkoutCategory.Threshold,
  WorkoutCategory.Vo2Max,
  WorkoutCategory.Technique,
  WorkoutCategory.Free,
];

export const WORKOUT_CATEGORIES_BY_SPORT: Record<Sport, readonly WorkoutCategory[]> = {
  cycling: ENDURANCE_CATEGORIES,
  running: ENDURANCE_CATEGORIES,
  mobility: [WorkoutCategory.Mobility, WorkoutCategory.Recovery, WorkoutCategory.Free],
  plyometrics: [
    WorkoutCategory.Power,
    WorkoutCategory.Strength,
    WorkoutCategory.Technique,
    WorkoutCategory.Free,
  ],
};

export const IntensityMetric = {
  HeartRate: 'heart_rate',
  Power: 'power',
  Pace: 'pace',
  Rpe: 'rpe',
} as const;

export type IntensityMetric = (typeof IntensityMetric)[keyof typeof IntensityMetric];

export const INTENSITY_METRICS: readonly IntensityMetric[] = Object.values(IntensityMetric);

/** Metrics that are expressed as a zone from a TrainingZoneSet. RPE is a direct value. */
export type ZoneMetric = Exclude<IntensityMetric, typeof IntensityMetric.Rpe>;

export const ZONE_METRICS: readonly ZoneMetric[] = [
  IntensityMetric.HeartRate,
  IntensityMetric.Power,
  IntensityMetric.Pace,
];

export const ZONE_METRICS_BY_SPORT: Record<Sport, readonly ZoneMetric[]> = {
  cycling: [IntensityMetric.HeartRate, IntensityMetric.Power],
  running: [IntensityMetric.HeartRate, IntensityMetric.Pace],
  mobility: [],
  plyometrics: [],
};

export function supportsZoneMetric(sport: Sport, metric: IntensityMetric): metric is ZoneMetric {
  return (ZONE_METRICS_BY_SPORT[sport] as readonly IntensityMetric[]).includes(metric);
}

/**
 * Sport whose heart rate zone set is used for a profile. Sports without zones
 * (mobility, plyometrics) fall back to cycling.
 */
export function resolveHeartRateZoneSport(sport: Sport): Sport {
  return supportsZoneMetric(sport, IntensityMetric.HeartRate) ? sport : Sport.Cycling;
}

export const StepPhase = {
  WarmUp: 'warm_up',
  Active: 'active',
  Recovery: 'recovery',
  Rest: 'rest',
  CoolDown: 'cool_down',
} as const;

export type StepPhase = (typeof StepPhase)[keyof typeof StepPhase];

export const STEP_PHASES: readonly StepPhase[] = Object.values(StepPhase);

export const WorkoutStatus = {
  Planned: 'planned',
  Completed: 'completed',
  Skipped: 'skipped',
} as const;

export type WorkoutStatus = (typeof WorkoutStatus)[keyof typeof WorkoutStatus];

export const WORKOUT_STATUSES: readonly WorkoutStatus[] = Object.values(WorkoutStatus);
