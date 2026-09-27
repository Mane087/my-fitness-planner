import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { WeekStartsOn } from '../domain/calendar.enums';
import type { ScheduledWorkoutEntity } from '../domain/schemas/scheduled-workout.schema';
import { WorkoutStatus } from '../domain/workout.enums';
import type {
  CalendarDayViewModel,
  CalendarMonthSummaryViewModel,
  CalendarMonthViewModel,
  CalendarWorkoutCardViewModel,
  WeeklySummaryRowViewModel,
  WeeklySummaryViewModel,
} from '../models/calendar-view-models';
import {
  SPORT_LABELS,
  SPORT_MODALITY_LABELS,
  WORKOUT_CATEGORY_COLOR_CLASSES,
  WORKOUT_CATEGORY_LABELS,
  WORKOUT_STATUS_LABELS,
} from '../models/workout-labels';
import { AppSettingsRepository } from '../repositories/app-settings.repository';
import { AthleteProfileRepository } from '../repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { CalendarDateService } from './calendar-date.service';
import { WeeklySummaryService, type SummaryTotals } from './weekly-summary.service';

const MAX_VISIBLE_WORKOUTS_PER_DAY = 3;

@Injectable({ providedIn: 'root' })
export class CalendarFacade {
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);
  private readonly athleteProfileRepository = inject(AthleteProfileRepository);
  private readonly appSettingsRepository = inject(AppSettingsRepository);
  private readonly calendarDate = inject(CalendarDateService);
  private readonly weeklySummary = inject(WeeklySummaryService);
  private readonly router = inject(Router);

  async loadMonth(referenceDate: string): Promise<CalendarMonthViewModel> {
    const reference = this.calendarDate.parseDateOnly(referenceDate);
    const year = reference.getUTCFullYear();
    const month = reference.getUTCMonth() + 1;

    const [profile, weekStartsOn] = await Promise.all([
      this.athleteProfileRepository.getActiveProfile(),
      this.resolveWeekStartsOn(),
    ]);
    const userName = profile?.name?.trim() || 'Usuario';
    const { startDate, endDate } = this.calendarDate.getVisibleRange(year, month, weekStartsOn);
    const workouts = await this.scheduledWorkoutRepository.findByDateRange(startDate, endDate);
    const weeks = this.withWorkouts(
      this.calendarDate.buildMonthGrid(year, month, weekStartsOn),
      workouts,
    );

    return {
      year,
      month,
      monthLabel: this.calendarDate.formatMonthLabel(year, month),
      visibleStartDate: startDate,
      visibleEndDate: endDate,
      weekdays: this.calendarDate.getWeekdays(weekStartsOn),
      weeks,
      summary: this.buildSummary(workouts, year, month),
      userName,
    };
  }

  goToPreviousMonth(currentYear: number, currentMonth: number): Promise<CalendarMonthViewModel> {
    return this.loadMonth(
      this.calendarDate.formatDateOnly(new Date(Date.UTC(currentYear, currentMonth - 2, 1))),
    );
  }

  goToNextMonth(currentYear: number, currentMonth: number): Promise<CalendarMonthViewModel> {
    return this.loadMonth(
      this.calendarDate.formatDateOnly(new Date(Date.UTC(currentYear, currentMonth, 1))),
    );
  }

  goToCurrentMonth(): Promise<CalendarMonthViewModel> {
    return this.loadMonth(this.calendarDate.today());
  }

  async loadWeeklySummary(referenceDate: string): Promise<WeeklySummaryViewModel> {
    const summary = await this.weeklySummary.getWeeklySummary(
      referenceDate,
      await this.resolveWeekStartsOn(),
    );

    return {
      referenceDate,
      rangeLabel: `${this.calendarDate.formatShortDate(summary.startDate)} al ${this.calendarDate.formatShortDate(summary.endDate)}`,
      totals: this.toSummaryRow('total', 'Total', summary.totals),
      bySport: summary.bySport.map((row) =>
        this.toSummaryRow(row.sport, SPORT_LABELS[row.sport], row),
      ),
      byCategory: summary.byCategory.map((row) =>
        this.toSummaryRow(row.category, WORKOUT_CATEGORY_LABELS[row.category], row),
      ),
    };
  }

  /** Reference date moved by whole weeks, used by the weekly summary navigation. */
  shiftWeek(referenceDate: string, weeks: number): string {
    return this.calendarDate.shiftDate(referenceDate, weeks * 7);
  }

  today(): string {
    return this.calendarDate.today();
  }

  findWorkout(workoutId: string): Promise<ScheduledWorkoutEntity | null> {
    return this.scheduledWorkoutRepository.findById(workoutId);
  }

  createWorkoutForDate(date: string): void {
    void this.router.navigate(['/calendar', 'new'], { queryParams: { date } });
  }

  openWorkout(workoutId: string): void {
    void this.router.navigate(['/calendar', 'edit', workoutId]);
  }

  private withWorkouts(
    weeks: CalendarDayViewModel[][],
    workouts: ScheduledWorkoutEntity[],
  ): CalendarDayViewModel[][] {
    const workoutsByDate = new Map<string, CalendarWorkoutCardViewModel[]>();

    for (const workout of workouts) {
      const dayWorkouts = workoutsByDate.get(workout.scheduledDate) ?? [];
      dayWorkouts.push(this.toWorkoutCard(workout));
      workoutsByDate.set(workout.scheduledDate, dayWorkouts);
    }

    return weeks.map((week) =>
      week.map((day) => {
        const dayWorkouts = workoutsByDate.get(day.date) ?? [];
        return {
          ...day,
          workouts: dayWorkouts.slice(0, MAX_VISIBLE_WORKOUTS_PER_DAY),
          hiddenWorkoutCount: Math.max(dayWorkouts.length - MAX_VISIBLE_WORKOUTS_PER_DAY, 0),
        };
      }),
    );
  }

  private toWorkoutCard(workout: ScheduledWorkoutEntity): CalendarWorkoutCardViewModel {
    const sportLabel = SPORT_LABELS[workout.sport] ?? workout.sport;

    return {
      id: workout.id,
      title: workout.title?.trim() || 'Entrenamiento sin título',
      scheduledDate: workout.scheduledDate,
      sport: workout.sport,
      sportLabel: workout.modality
        ? `${sportLabel} ${SPORT_MODALITY_LABELS[workout.modality]}`
        : sportLabel,
      category: workout.category,
      categoryLabel: WORKOUT_CATEGORY_LABELS[workout.category] ?? workout.category,
      durationLabel: this.calendarDate.formatDuration(
        secondsToMinutes(workout.plannedDurationSeconds),
      ),
      distanceLabel: this.calendarDate.formatDistance(metersToKm(workout.plannedDistanceMeters)),
      colorClass: WORKOUT_CATEGORY_COLOR_CLASSES[workout.category],
      status: workout.status,
      statusLabel: WORKOUT_STATUS_LABELS[workout.status],
      actualDurationLabel:
        workout.status === WorkoutStatus.Completed
          ? this.calendarDate.formatDuration(
              secondsToMinutes(
                workout.completion?.durationSeconds ?? workout.plannedDurationSeconds,
              ),
            )
          : null,
    };
  }

  private toSummaryRow(
    key: string,
    label: string,
    totals: SummaryTotals,
  ): WeeklySummaryRowViewModel {
    return {
      key,
      label,
      sessionsLabel: `${totals.completedSessions} de ${totals.sessions}`,
      plannedDurationLabel: this.calendarDate.formatDuration(
        secondsToMinutes(totals.plannedSeconds),
      ),
      actualDurationLabel: this.calendarDate.formatDuration(secondsToMinutes(totals.actualSeconds)),
      plannedDistanceLabel: this.calendarDate.formatDistance(
        totals.plannedMeters > 0 ? totals.plannedMeters / 1000 : null,
      ),
      actualDistanceLabel: this.calendarDate.formatDistance(
        totals.actualMeters > 0 ? totals.actualMeters / 1000 : null,
      ),
      complianceLabel:
        totals.compliance === null ? '--' : `${Math.round(totals.compliance * 100)} %`,
    };
  }

  private async resolveWeekStartsOn(): Promise<WeekStartsOn> {
    const [profile, settings] = await Promise.all([
      this.athleteProfileRepository.getActiveProfile(),
      this.appSettingsRepository.getSettings(),
    ]);

    return profile?.weekStartsOn ?? settings?.weekStartsOn ?? WeekStartsOn.Monday;
  }

  private buildSummary(
    workouts: ScheduledWorkoutEntity[],
    year: number,
    month: number,
  ): CalendarMonthSummaryViewModel {
    const currentMonthWorkouts = workouts.filter((workout) =>
      this.calendarDate.isSameMonth(workout.scheduledDate, year, month),
    );
    const totalDurationMinutes = secondsToMinutes(
      currentMonthWorkouts.reduce((total, workout) => total + workout.plannedDurationSeconds, 0),
    );
    const workoutsWithDistance = currentMonthWorkouts.filter(
      (workout) => workout.plannedDistanceMeters !== undefined,
    );
    const totalDistanceKm = workoutsWithDistance.length
      ? metersToKm(
          workoutsWithDistance.reduce(
            (total, workout) => total + (workout.plannedDistanceMeters ?? 0),
            0,
          ),
        )
      : null;

    return {
      totalDurationMinutes,
      totalDurationLabel: this.calendarDate.formatDuration(totalDurationMinutes),
      totalDistanceKm,
      totalDistanceLabel: this.calendarDate.formatDistance(totalDistanceKm),
      totalWorkouts: currentMonthWorkouts.length,
    };
  }
}

function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function metersToKm(meters: number | undefined): number | null {
  return meters === undefined ? null : meters / 1000;
}
