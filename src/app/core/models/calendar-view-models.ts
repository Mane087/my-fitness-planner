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
  statusLabel: string;
  /** Actual duration, only for completed workouts. */
  actualDurationLabel: string | null;
  /** Actual distance, only for completed workouts with a recorded or planned distance. */
  actualDistanceLabel: string | null;
  hasPlannedDistance: boolean;
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

export interface WeeklySummaryRowViewModel {
  key: string;
  label: string;
  /** Completed sessions of the planned ones, e.g. `2 de 3`. */
  sessionsLabel: string;
  plannedDurationLabel: string;
  actualDurationLabel: string;
  plannedDistanceLabel: string;
  actualDistanceLabel: string;
  complianceLabel: string;
}

export interface WeeklySummaryViewModel {
  referenceDate: string;
  rangeLabel: string;
  totals: WeeklySummaryRowViewModel;
  bySport: WeeklySummaryRowViewModel[];
  byCategory: WeeklySummaryRowViewModel[];
}
