import type { TrainingZoneSnapshot } from './training-zone.model';

export const WorkoutBlockType = {
  WarmUp: 'warm_up',
  Active: 'active',
  Recovery: 'recovery',
  CoolDown: 'cool_down',
  Free: 'free',
} as const;

export type WorkoutBlockType = (typeof WorkoutBlockType)[keyof typeof WorkoutBlockType];

export const WorkoutBlockTargetType = {
  Time: 'time',
  Distance: 'distance',
} as const;

export type WorkoutBlockTargetType =
  (typeof WorkoutBlockTargetType)[keyof typeof WorkoutBlockTargetType];

export interface WorkoutBlockEntity {
  id: string;
  name: string;
  blockType: WorkoutBlockType;
  targetType: WorkoutBlockTargetType;
  durationMinutes: number;
  distanceKm?: number;
  targetZoneId?: string;
  targetZoneSnapshot?: TrainingZoneSnapshot;
  targetRpe?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  instructions?: string;
  sortOrder: number;
}
