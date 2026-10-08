import type { WorkoutStep } from '../domain/schemas/workout-step.schema';
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
  /** Steps that the read-only profile draws. */
  steps: WorkoutStep[];
  /** Planned duration as `h:mm`, e.g. `1:20`. */
  durationClock: string;
  /** Planned distance without unit, e.g. `38`; null when the workout has none. */
  distanceKmLabel: string | null;
  /** Text for workouts without profile, e.g. `8 ejercicios`; null when the profile is drawn. */
  summaryText: string | null;
  /** Zone with the most time in the workout, used by the phone week strip. */
  dominantZone: number | null;
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

/** Planned against completed totals, shared by the week summary and the month week column. */
export interface ProgressTotalViewModel {
  /** Completed amount, formatted without unit. */
  actualLabel: string;
  plannedLabel: string;
  /** Completed share of the planned amount, from 0 to 100. */
  percent: number;
}

export interface CalendarWeekTotalViewModel {
  weekNumber: number;
  duration: ProgressTotalViewModel;
  completedCount: number;
  plannedCount: number;
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
  /** Totals of each row of `weeks`, in the same order. */
  weekTotals: CalendarWeekTotalViewModel[];
  /** Week numbers shown under the title, e.g. `Semanas 18 – 22`. */
  weekNumbersLabel: string;
  summary: CalendarMonthSummaryViewModel;
  userName: string;
}

export interface CalendarWeekDayViewModel {
  date: string;
  weekdayLabel: string;
  /** Short date, e.g. `13 may`. */
  dateLabel: string;
  dayOfMonth: number;
  isToday: boolean;
  /** Every workout of the day; the week view has no per-day limit. */
  workouts: CalendarWorkoutCardViewModel[];
  /** Planned duration of the day as `h:mm`; empty for a day without workouts. */
  plannedClock: string;
  plannedLabel: string;
  /** Actual duration and distance, only when the day has completed workouts. */
  actualLabel: string | null;
}

export interface WeekZoneShareViewModel {
  zone: number;
  /** Share of the planned zone time, from 0 to 100. */
  percent: number;
}

export interface WeekHeaderSummaryViewModel {
  duration: ProgressTotalViewModel;
  distance: ProgressTotalViewModel;
  completed: { done: number; total: number; percent: number };
  /** Planned time per zone, in zone order; empty when no step has a zone. */
  zones: WeekZoneShareViewModel[];
  /** Dominant zone and high intensity share; null when there are no zones. */
  zonesCaption: string | null;
}

export interface CalendarWeekViewModel {
  startDate: string;
  endDate: string;
  rangeLabel: string;
  weekNumber: number;
  /** Range for the header, e.g. `4 – 10 de mayo de 2026`. */
  longRangeLabel: string;
  summary: WeekHeaderSummaryViewModel;
  days: CalendarWeekDayViewModel[];
  userName: string;
}

export type WorkoutRelocationMode = 'move' | 'copy';

/** A request to move or copy a workout to another day, from drag & drop or the detail actions. */
export interface WorkoutRelocation {
  workout: Pick<CalendarWorkoutCardViewModel, 'id' | 'title' | 'status' | 'scheduledDate'>;
  targetDate: string;
  mode: WorkoutRelocationMode;
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
