export const WeekStartsOn = {
  Monday: 'monday',
  Sunday: 'sunday',
} as const;

export type WeekStartsOn = (typeof WeekStartsOn)[keyof typeof WeekStartsOn];

export const WEEK_STARTS_ON_VALUES: readonly WeekStartsOn[] = Object.values(WeekStartsOn);

export const CalendarDefaultView = {
  Week: 'week',
  Month: 'month',
} as const;

export type CalendarDefaultView = (typeof CalendarDefaultView)[keyof typeof CalendarDefaultView];

export const CALENDAR_DEFAULT_VIEWS: readonly CalendarDefaultView[] =
  Object.values(CalendarDefaultView);

export const TimeFormat = {
  TwelveHour: '12h',
  TwentyFourHour: '24h',
} as const;

export type TimeFormat = (typeof TimeFormat)[keyof typeof TimeFormat];

export const TIME_FORMATS: readonly TimeFormat[] = Object.values(TimeFormat);
