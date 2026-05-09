export const PreferredDiscipline = {
  Road: 'road',
  Mtb: 'mtb',
  Indoor: 'indoor',
  Mixed: 'mixed',
} as const;

export type PreferredDiscipline = (typeof PreferredDiscipline)[keyof typeof PreferredDiscipline];

export const PreferredIntensityMetric = {
  HeartRate: 'heart_rate',
  Rpe: 'rpe',
  Mixed: 'mixed',
} as const;

export type PreferredIntensityMetric =
  (typeof PreferredIntensityMetric)[keyof typeof PreferredIntensityMetric];

export const WeekStartsOn = {
  Monday: 'monday',
  Sunday: 'sunday',
} as const;

export type WeekStartsOn = (typeof WeekStartsOn)[keyof typeof WeekStartsOn];

export interface SportProfileEntity {
  id: string;
  name: string;
  maxHeartRate: number;
  weightKg?: number;
  preferredDiscipline: PreferredDiscipline;
  preferredIntensityMetric: PreferredIntensityMetric;
  weekStartsOn: WeekStartsOn;
  createdAt: string;
  updatedAt: string;
}
