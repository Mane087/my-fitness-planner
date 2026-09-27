import { inject, Injectable } from '@angular/core';

import type { ScheduledWorkoutEntity } from '../domain/schemas/scheduled-workout.schema';
import {
  SPORTS,
  WORKOUT_CATEGORIES,
  WorkoutCategory,
  WorkoutStatus,
  type Sport,
} from '../domain/workout.enums';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { addDays, formatDateOnly, parseDateOnly } from './training-calendar.service';

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  totalSessions: number;
  totalDurationSeconds: number;
  restDays: number;
  sessionsByCategory: Record<WorkoutCategory, number>;
  durationByCategory: Record<WorkoutCategory, number>;
  sessionsBySport: Record<Sport, number>;
  durationBySport: Record<Sport, number>;
  intenseSessions: number;
}

const INTENSE_CATEGORIES: readonly WorkoutCategory[] = [
  WorkoutCategory.Threshold,
  WorkoutCategory.Vo2Max,
  WorkoutCategory.Power,
];

@Injectable({ providedIn: 'root' })
export class WeeklySummaryService {
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);

  async getWeeklySummary(referenceDate: string): Promise<WeeklySummary> {
    const weekRange = getWeekRange(referenceDate);
    const workouts = await this.scheduledWorkoutRepository.findByDateRange(
      weekRange.startDate,
      weekRange.endDate,
    );
    const countedWorkouts = workouts.filter((workout) => workout.status === WorkoutStatus.Planned);
    const sessionsByCategory = createRecord(WORKOUT_CATEGORIES);
    const durationByCategory = createRecord(WORKOUT_CATEGORIES);
    const sessionsBySport = createRecord(SPORTS);
    const durationBySport = createRecord(SPORTS);
    const activeDays = new Set(countedWorkouts.map((workout) => workout.scheduledDate));

    for (const workout of countedWorkouts) {
      sessionsByCategory[workout.category] += 1;
      durationByCategory[workout.category] += workout.plannedDurationSeconds;
      sessionsBySport[workout.sport] += 1;
      durationBySport[workout.sport] += workout.plannedDurationSeconds;
    }

    return {
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
      totalSessions: countedWorkouts.length,
      totalDurationSeconds: countedWorkouts.reduce(
        (total, workout) => total + workout.plannedDurationSeconds,
        0,
      ),
      restDays: 7 - activeDays.size,
      sessionsByCategory,
      durationByCategory,
      sessionsBySport,
      durationBySport,
      intenseSessions: countedWorkouts.filter(isIntenseWorkout).length,
    };
  }
}

function getWeekRange(referenceDate: string): { startDate: string; endDate: string } {
  const date = parseDateOnly(referenceDate);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const startDate = addDays(date, -daysFromMonday);
  const endDate = addDays(startDate, 6);

  return {
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
  };
}

function createRecord<Key extends string>(keys: readonly Key[]): Record<Key, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
}

function isIntenseWorkout(workout: ScheduledWorkoutEntity): boolean {
  return INTENSE_CATEGORIES.includes(workout.category);
}
