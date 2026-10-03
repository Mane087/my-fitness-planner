import { inject, Injectable } from '@angular/core';

import type { WeekStartsOn } from '../domain/calendar.enums';
import type { ScheduledWorkoutEntity } from '../domain/schemas/scheduled-workout.schema';
import {
  SPORTS,
  WORKOUT_CATEGORIES,
  WorkoutStatus,
  type Sport,
  type WorkoutCategory,
} from '../domain/workout.enums';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { CalendarDateService } from './calendar-date.service';

export interface SummaryTotals {
  sessions: number;
  completedSessions: number;
  skippedSessions: number;
  plannedSeconds: number;
  actualSeconds: number;
  plannedMeters: number;
  actualMeters: number;
  /** Actual time divided by planned time, or null when nothing was planned. */
  compliance: number | null;
}

export interface SportSummary extends SummaryTotals {
  sport: Sport;
}

export interface CategorySummary extends SummaryTotals {
  category: WorkoutCategory;
}

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  totals: SummaryTotals;
  /** Only sports with sessions in the week, in the order of `SPORTS`. */
  bySport: SportSummary[];
  /** Only categories with sessions in the week, in the order of `WORKOUT_CATEGORIES`. */
  byCategory: CategorySummary[];
}

/**
 * Planned vs. actual totals of a week. Planned values include every scheduled workout, also the
 * skipped ones, so skipping lowers the compliance. Actual values come from completed workouts;
 * a completion without duration or distance counts the planned value.
 */
@Injectable({ providedIn: 'root' })
export class WeeklySummaryService {
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);
  private readonly calendarDate = inject(CalendarDateService);

  async getWeeklySummary(
    referenceDate: string,
    weekStartsOn: WeekStartsOn,
  ): Promise<WeeklySummary> {
    const { startDate, endDate } = this.calendarDate.getWeekRange(referenceDate, weekStartsOn);
    const workouts = await this.scheduledWorkoutRepository.findByDateRange(startDate, endDate);

    return {
      startDate,
      endDate,
      totals: summarize(workouts),
      bySport: SPORTS.map((sport) => ({
        sport,
        ...summarize(workouts.filter((workout) => workout.sport === sport)),
      })).filter((summary) => summary.sessions > 0),
      byCategory: WORKOUT_CATEGORIES.map((category) => ({
        category,
        ...summarize(workouts.filter((workout) => workout.category === category)),
      })).filter((summary) => summary.sessions > 0),
    };
  }
}

/** Totals of any group of workouts, with the planned vs. actual rules of the weekly summary. */
export function summarize(workouts: readonly ScheduledWorkoutEntity[]): SummaryTotals {
  const totals = workouts.reduce(
    (current, workout) => {
      const completion =
        workout.status === WorkoutStatus.Completed ? workout.completion : undefined;

      return {
        ...current,
        sessions: current.sessions + 1,
        completedSessions: current.completedSessions + (completion ? 1 : 0),
        skippedSessions:
          current.skippedSessions + (workout.status === WorkoutStatus.Skipped ? 1 : 0),
        plannedSeconds: current.plannedSeconds + workout.plannedDurationSeconds,
        plannedMeters: current.plannedMeters + (workout.plannedDistanceMeters ?? 0),
        actualSeconds:
          current.actualSeconds +
          (completion ? (completion.durationSeconds ?? workout.plannedDurationSeconds) : 0),
        actualMeters:
          current.actualMeters +
          (completion ? (completion.distanceMeters ?? workout.plannedDistanceMeters ?? 0) : 0),
      };
    },
    {
      sessions: 0,
      completedSessions: 0,
      skippedSessions: 0,
      plannedSeconds: 0,
      actualSeconds: 0,
      plannedMeters: 0,
      actualMeters: 0,
    },
  );

  return {
    ...totals,
    compliance: totals.plannedSeconds > 0 ? totals.actualSeconds / totals.plannedSeconds : null,
  };
}
