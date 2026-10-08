import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { CalendarDefaultView, WeekStartsOn } from '../domain/calendar.enums';
import type { ScheduledWorkoutEntity } from '../domain/schemas/scheduled-workout.schema';
import { WorkoutStatus } from '../domain/workout.enums';
import type {
  CalendarDayViewModel,
  CalendarMonthSummaryViewModel,
  CalendarMonthViewModel,
  CalendarWeekTotalViewModel,
  CalendarWeekViewModel,
  CalendarWorkoutCardViewModel,
  ProgressTotalViewModel,
  WeekHeaderSummaryViewModel,
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
import { buildWorkoutProfile, sumSecondsByZone } from '../models/workout-profile';
import { AppSettingsRepository } from '../repositories/app-settings.repository';
import { AthleteProfileRepository } from '../repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { CalendarDateService } from './calendar-date.service';
import { formatClock } from './shell-week-summary.service';
import { calculateWorkoutTotals } from './workout-structure.utils';
import { TrainingCalendarService } from './training-calendar.service';
import { summarize, WeeklySummaryService, type SummaryTotals } from './weekly-summary.service';

const MAX_VISIBLE_WORKOUTS_PER_DAY = 3;
/** Zones from this number on count as high intensity in the week summary. */
const HIGH_INTENSITY_FIRST_ZONE = 4;

@Injectable({ providedIn: 'root' })
export class CalendarFacade {
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);
  private readonly athleteProfileRepository = inject(AthleteProfileRepository);
  private readonly appSettingsRepository = inject(AppSettingsRepository);
  private readonly calendarDate = inject(CalendarDateService);
  private readonly weeklySummary = inject(WeeklySummaryService);
  private readonly trainingCalendar = inject(TrainingCalendarService);
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
      weekTotals: weeks.map((week) =>
        this.toWeekTotal(
          week[0].date,
          workouts.filter(
            (workout) =>
              workout.scheduledDate >= week[0].date && workout.scheduledDate <= week[6].date,
          ),
        ),
      ),
      weekNumbersLabel: this.formatWeekNumbers(weeks.map((week) => week[0].date)),
      summary: this.buildSummary(workouts, year, month),
      userName,
    };
  }

  /** Seven days of the week that contains the date, with every workout and the daily totals. */
  async loadWeek(referenceDate: string): Promise<CalendarWeekViewModel> {
    const [profile, weekStartsOn] = await Promise.all([
      this.athleteProfileRepository.getActiveProfile(),
      this.resolveWeekStartsOn(),
    ]);
    const { startDate, endDate } = this.calendarDate.getWeekRange(referenceDate, weekStartsOn);
    const workouts = await this.scheduledWorkoutRepository.findByDateRange(startDate, endDate);
    const today = this.calendarDate.today();

    return {
      startDate,
      endDate,
      rangeLabel: this.formatRange(startDate, endDate),
      weekNumber: this.calendarDate.getWeekNumberFromStart(startDate),
      longRangeLabel: this.calendarDate.formatLongRange(startDate, endDate),
      summary: this.toWeekHeaderSummary(workouts),
      days: this.calendarDate.getWeekdays(weekStartsOn).map((weekdayLabel, index) => {
        const date = this.calendarDate.shiftDate(startDate, index);
        const dayWorkouts = workouts.filter((workout) => workout.scheduledDate === date);
        const totals = summarize(dayWorkouts);

        return {
          date,
          weekdayLabel,
          dateLabel: this.calendarDate.formatShortDate(date),
          dayOfMonth: this.calendarDate.parseDateOnly(date).getUTCDate(),
          isToday: date === today,
          workouts: dayWorkouts.map((workout) => this.toWorkoutCard(workout)),
          plannedClock: dayWorkouts.length > 0 ? formatClock(totals.plannedSeconds) : '',
          plannedLabel: this.formatTotals(totals.plannedSeconds, totals.plannedMeters),
          actualLabel:
            totals.completedSessions > 0
              ? this.formatTotals(totals.actualSeconds, totals.actualMeters)
              : null,
        };
      }),
      userName: profile?.name?.trim() || 'Usuario',
    };
  }

  async loadDefaultView(): Promise<CalendarDefaultView> {
    const settings = await this.appSettingsRepository.getSettings();
    return settings?.calendarDefaultView ?? CalendarDefaultView.Month;
  }

  /** Stores the chosen view, so the calendar opens with it next time. */
  async saveDefaultView(view: CalendarDefaultView): Promise<void> {
    const settings = await this.appSettingsRepository.getSettings();

    if (settings.calendarDefaultView !== view) {
      await this.appSettingsRepository.update({ ...settings, calendarDefaultView: view });
    }
  }

  moveWorkout(workoutId: string, targetDate: string): Promise<ScheduledWorkoutEntity> {
    return this.trainingCalendar.moveWorkout(workoutId, targetDate);
  }

  /** The copy is a new planned workout without completion data. */
  copyWorkout(workoutId: string, targetDate: string): Promise<ScheduledWorkoutEntity> {
    return this.trainingCalendar.copyWorkout(workoutId, targetDate);
  }

  formatShortDate(date: string): string {
    return this.calendarDate.formatShortDate(date);
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
      rangeLabel: this.formatRange(summary.startDate, summary.endDate),
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
    const completion = workout.status === WorkoutStatus.Completed ? workout.completion : undefined;
    // A completion without its own values counts the planned ones, as the weekly summary does.
    const actualMeters = completion
      ? (completion.distanceMeters ?? workout.plannedDistanceMeters)
      : undefined;

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
      actualDurationLabel: completion
        ? this.calendarDate.formatDuration(
            secondsToMinutes(completion.durationSeconds ?? workout.plannedDurationSeconds),
          )
        : null,
      actualDistanceLabel:
        actualMeters !== undefined
          ? this.calendarDate.formatDistance(metersToKm(actualMeters))
          : null,
      hasPlannedDistance: workout.plannedDistanceMeters !== undefined,
      steps: workout.steps,
      durationClock: formatClock(workout.plannedDurationSeconds),
      distanceKmLabel:
        workout.plannedDistanceMeters === undefined
          ? null
          : formatKm(workout.plannedDistanceMeters),
      summaryText: this.toSummaryText(workout),
      dominantZone: dominantZone(workout),
    };
  }

  /** Workouts that cannot draw a profile show how many exercises they have. */
  private toSummaryText(workout: ScheduledWorkoutEntity): string | null {
    if (buildWorkoutProfile(workout.steps, workout.sport).length > 0) return null;

    const { stepCount } = calculateWorkoutTotals(workout.steps);
    return stepCount === 1 ? '1 ejercicio' : `${stepCount} ejercicios`;
  }

  private toProgress(
    actual: number,
    planned: number,
    format: (value: number) => string,
  ): ProgressTotalViewModel {
    return {
      actualLabel: format(actual),
      plannedLabel: format(planned),
      percent: planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0,
    };
  }

  private toWeekTotal(
    startDate: string,
    workouts: ScheduledWorkoutEntity[],
  ): CalendarWeekTotalViewModel {
    const totals = summarize(workouts);

    return {
      weekNumber: this.calendarDate.getWeekNumberFromStart(startDate),
      duration: this.toProgress(totals.actualSeconds, totals.plannedSeconds, formatClock),
      completedCount: totals.completedSessions,
      plannedCount: totals.sessions,
    };
  }

  private toWeekHeaderSummary(workouts: ScheduledWorkoutEntity[]): WeekHeaderSummaryViewModel {
    const totals = summarize(workouts);
    const secondsByZone = new Map<number, number>();

    for (const workout of workouts) {
      for (const [zone, seconds] of sumSecondsByZone(workout.steps, workout.sport)) {
        secondsByZone.set(zone, (secondsByZone.get(zone) ?? 0) + seconds);
      }
    }

    const zoneTotal = [...secondsByZone.values()].reduce((sum, seconds) => sum + seconds, 0);
    const zones = [...secondsByZone]
      .sort(([first], [second]) => first - second)
      .map(([zone, seconds]) => ({ zone, percent: (seconds / zoneTotal) * 100 }));
    const [top] = [...zones].sort((first, second) => second.percent - first.percent);
    const highIntensityPercent = zones
      .filter((share) => share.zone >= HIGH_INTENSITY_FIRST_ZONE)
      .reduce((sum, share) => sum + share.percent, 0);

    return {
      duration: this.toProgress(totals.actualSeconds, totals.plannedSeconds, formatClock),
      distance: this.toProgress(totals.actualMeters, totals.plannedMeters, formatKm),
      completed: {
        done: totals.completedSessions,
        total: totals.sessions,
        percent: totals.sessions > 0 ? (totals.completedSessions / totals.sessions) * 100 : 0,
      },
      zones,
      zonesCaption: top
        ? `Z${top.zone} domina la semana (${Math.round(top.percent)} %). Intensidad alta: ${Math.round(highIntensityPercent)} %.`
        : null,
    };
  }

  private formatWeekNumbers(weekStarts: string[]): string {
    const numbers = weekStarts.map((date) => this.calendarDate.getWeekNumberFromStart(date));
    return `Semanas ${numbers[0]} – ${numbers[numbers.length - 1]}`;
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

  private formatRange(startDate: string, endDate: string): string {
    return `${this.calendarDate.formatShortDate(startDate)} al ${this.calendarDate.formatShortDate(endDate)}`;
  }

  private formatTotals(seconds: number, meters: number): string {
    const duration = this.calendarDate.formatDuration(secondsToMinutes(seconds));
    return meters > 0
      ? `${duration} · ${this.calendarDate.formatDistance(meters / 1000)}`
      : duration;
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

/** Zone with the most planned time, or null when no step has a zone. */
function dominantZone(workout: ScheduledWorkoutEntity): number | null {
  const [top] = [...sumSecondsByZone(workout.steps, workout.sport)].sort(
    ([, first], [, second]) => second - first,
  );
  return top ? top[0] : null;
}

/** Kilometers without unit: whole numbers stay whole, otherwise one decimal. */
function formatKm(meters: number): string {
  const km = meters / 1000;
  return Number.isInteger(km) ? km.toFixed(0) : km.toFixed(1);
}

function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function metersToKm(meters: number | undefined): number | null {
  return meters === undefined ? null : meters / 1000;
}
