import { inject, Injectable } from '@angular/core';
import type { ScheduledWorkoutEntity } from '../domain/scheduled-workout.model';
import {
  WorkoutStatus,
  WorkoutType,
  WORKOUT_DISCIPLINES,
  WORKOUT_TYPES,
  type WorkoutDiscipline as WorkoutDisciplineType,
  type WorkoutType as WorkoutTypeType,
} from '../domain/workout.enums';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { addDays, formatDateOnly, parseDateOnly } from './training-calendar.service';

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  totalSessions: number;
  totalDurationMinutes: number;
  restDays: number;
  sessionsByType: Record<WorkoutTypeType, number>;
  durationByType: Record<WorkoutTypeType, number>;
  sessionsByDiscipline: Record<WorkoutDisciplineType, number>;
  durationByDiscipline: Record<WorkoutDisciplineType, number>;
  intenseSessions: number;
}

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
    const sessionsByType = createWorkoutTypeRecord();
    const durationByType = createWorkoutTypeRecord();
    const sessionsByDiscipline = createWorkoutDisciplineRecord();
    const durationByDiscipline = createWorkoutDisciplineRecord();
    const activeDays = new Set(countedWorkouts.map((workout) => workout.scheduledDate));

    for (const workout of countedWorkouts) {
      sessionsByType[workout.workoutType] += 1;
      durationByType[workout.workoutType] += workout.estimatedDurationMinutes;
      sessionsByDiscipline[workout.discipline] += 1;
      durationByDiscipline[workout.discipline] += workout.estimatedDurationMinutes;
    }

    return {
      startDate: weekRange.startDate,
      endDate: weekRange.endDate,
      totalSessions: countedWorkouts.length,
      totalDurationMinutes: countedWorkouts.reduce(
        (total, workout) => total + workout.estimatedDurationMinutes,
        0,
      ),
      restDays: 7 - activeDays.size,
      sessionsByType,
      durationByType,
      sessionsByDiscipline,
      durationByDiscipline,
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

function createWorkoutTypeRecord(): Record<WorkoutTypeType, number> {
  return WORKOUT_TYPES.reduce(
    (record, type) => ({ ...record, [type]: 0 }),
    {} as Record<WorkoutTypeType, number>,
  );
}

function createWorkoutDisciplineRecord(): Record<WorkoutDisciplineType, number> {
  return WORKOUT_DISCIPLINES.reduce(
    (record, discipline) => ({ ...record, [discipline]: 0 }),
    {} as Record<WorkoutDisciplineType, number>,
  );
}

function isIntenseWorkout(workout: ScheduledWorkoutEntity): boolean {
  if (isIntenseWorkoutType(workout.workoutType)) {
    return true;
  }

  const zoneName = workout.targetZoneSnapshot?.name.toLowerCase() ?? '';
  return (
    zoneName.includes('z4') ||
    zoneName.includes('z5') ||
    zoneName.includes('threshold') ||
    zoneName.includes('high intensity')
  );
}

function isIntenseWorkoutType(workoutType: WorkoutTypeType): boolean {
  return workoutType === WorkoutType.Threshold || workoutType === WorkoutType.Vo2Max;
}
