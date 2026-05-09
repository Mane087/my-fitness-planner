import { inject, Injectable } from '@angular/core';
import type { ScheduledWorkoutEntity } from '../domain/scheduled-workout.model';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';

@Injectable({ providedIn: 'root' })
export class TrainingCalendarService {
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);

  getWeekWorkouts(referenceDate: string): Promise<ScheduledWorkoutEntity[]> {
    const date = parseDateOnly(referenceDate);
    const day = date.getUTCDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    const startDate = addDays(date, -daysFromMonday);
    const endDate = addDays(startDate, 6);

    return this.scheduledWorkoutRepository.findByDateRange(
      formatDateOnly(startDate),
      formatDateOnly(endDate),
    );
  }

  getMonthWorkouts(year: number, month: number): Promise<ScheduledWorkoutEntity[]> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    return this.scheduledWorkoutRepository.findByDateRange(
      formatDateOnly(startDate),
      formatDateOnly(endDate),
    );
  }

  moveWorkout(workoutId: string, targetDate: string): Promise<ScheduledWorkoutEntity> {
    return this.scheduledWorkoutRepository.move(workoutId, targetDate);
  }

  copyWorkout(workoutId: string, targetDate: string): Promise<ScheduledWorkoutEntity> {
    return this.scheduledWorkoutRepository.copy(workoutId, targetDate);
  }
}

export function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}
