import type { Sport, WorkoutCategory, WorkoutStatus } from '../domain/workout.enums';

export interface CalendarWorkoutCardViewModel {
  id: string;
  title: string;
  scheduledDate: string;
  sport: Sport;
  sportLabel: string;
  category: WorkoutCategory;
  categoryLabel: string;
  durationLabel: string;
  distanceLabel: string;
  colorClass: string;
  status: WorkoutStatus;
}

export interface CalendarDayViewModel {
  date: string;
  dayOfMonth: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  isPast: boolean;
  workouts: CalendarWorkoutCardViewModel[];
  hiddenWorkoutCount: number;
}

export interface CalendarMonthSummaryViewModel {
  totalDurationMinutes: number;
  totalDurationLabel: string;
  totalDistanceKm: number | null;
  totalDistanceLabel: string;
  totalWorkouts: number;
}

export interface CalendarMonthViewModel {
  year: number;
  month: number;
  monthLabel: string;
  visibleStartDate: string;
  visibleEndDate: string;
  weekdays: string[];
  weeks: CalendarDayViewModel[][];
  summary: CalendarMonthSummaryViewModel;
  userName: string;
}
