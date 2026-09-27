import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import type { ScheduledWorkoutEntity } from '../domain/scheduled-workout.model';
import { WeekStartsOn } from '../domain/sport-profile.model';
import type { WorkoutDiscipline, WorkoutStatus, WorkoutType } from '../domain/workout.enums';
import { AppSettingsRepository } from '../repositories/app-settings.repository';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { SportProfileRepository } from '../repositories/sport-profile.repository';
import type {
  CalendarDayViewModel,
  CalendarMonthSummaryViewModel,
  CalendarMonthViewModel,
  CalendarWorkoutCardViewModel,
} from '../interfaces/calendar-view-models';
import { CalendarDateService } from './calendar-date.service';

const MAX_VISIBLE_WORKOUTS_PER_DAY = 3;

const WORKOUT_TYPE_COLORS: Record<WorkoutType, string> = {
  recovery: 'border-l-green-500',
  base: 'border-l-blue-500',
  endurance: 'border-l-indigo-500',
  climbing: 'border-l-orange-500',
  tempo: 'border-l-yellow-500',
  threshold: 'border-l-red-500',
  vo2max: 'border-l-purple-500',
  technique: 'border-l-cyan-500',
  free: 'border-l-gray-400',
};

const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  recovery: 'Recuperación',
  base: 'Base',
  endurance: 'Resistencia',
  climbing: 'Montaña',
  tempo: 'Tempo',
  threshold: 'Umbral',
  vo2max: 'VO2 Máx',
  technique: 'Técnica',
  free: 'Libre',
};

const DISCIPLINE_LABELS: Record<WorkoutDiscipline, string> = {
  road: 'Ruta',
  mtb: 'MTB',
  indoor: 'Indoor',
  strength: 'Fuerza',
  mobility: 'Movilidad',
};

@Injectable({ providedIn: 'root' })
export class CalendarFacade {
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);
  private readonly sportProfileRepository = inject(SportProfileRepository);
  private readonly appSettingsRepository = inject(AppSettingsRepository);
  private readonly calendarDate = inject(CalendarDateService);
  private readonly router = inject(Router);

  async loadMonth(referenceDate: string): Promise<CalendarMonthViewModel> {
    const reference = this.calendarDate.parseDateOnly(referenceDate);
    const year = reference.getUTCFullYear();
    const month = reference.getUTCMonth() + 1;

    const [profile, settings] = await Promise.all([
      this.sportProfileRepository.getActiveProfile(),
      this.appSettingsRepository.getSettings(),
    ]);
    const weekStartsOn = profile?.weekStartsOn ?? settings?.weekStartsOn ?? WeekStartsOn.Monday;
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
    return this.loadMonth(this.calendarDate.formatDateOnly(new Date()));
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
    return {
      id: workout.id,
      title: workout.title?.trim() || 'Entrenamiento sin título',
      scheduledDate: workout.scheduledDate,
      disciplineLabel: DISCIPLINE_LABELS[workout.discipline] ?? workout.discipline,
      workoutType: workout.workoutType,
      workoutTypeLabel: WORKOUT_TYPE_LABELS[workout.workoutType] ?? workout.workoutType,
      durationLabel: this.calendarDate.formatDuration(workout.estimatedDurationMinutes),
      distanceLabel: this.calendarDate.formatDistance(workout.plannedDistanceKm ?? null),
      colorClass: WORKOUT_TYPE_COLORS[workout.workoutType],
      status: workout.status as WorkoutStatus,
    };
  }

  private buildSummary(
    workouts: ScheduledWorkoutEntity[],
    year: number,
    month: number,
  ): CalendarMonthSummaryViewModel {
    const currentMonthWorkouts = workouts.filter((workout) =>
      this.calendarDate.isSameMonth(workout.scheduledDate, year, month),
    );
    const totalDurationMinutes = currentMonthWorkouts.reduce(
      (total, workout) => total + workout.estimatedDurationMinutes,
      0,
    );
    const workoutsWithDistance = currentMonthWorkouts.filter(
      (workout) => workout.plannedDistanceKm !== undefined && workout.plannedDistanceKm !== null,
    );
    const totalDistanceKm = workoutsWithDistance.length
      ? workoutsWithDistance.reduce((total, workout) => total + (workout.plannedDistanceKm ?? 0), 0)
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
