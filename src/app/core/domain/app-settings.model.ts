import type { WeekStartsOn } from './sport-profile.model';

export const CalendarDefaultView = {
  Week: 'week',
  Month: 'month',
} as const;

export type CalendarDefaultView = (typeof CalendarDefaultView)[keyof typeof CalendarDefaultView];

export const TimeFormat = {
  TwelveHour: '12h',
  TwentyFourHour: '24h',
} as const;

export type TimeFormat = (typeof TimeFormat)[keyof typeof TimeFormat];

export interface AppSettingsEntity {
  id: string;
  calendarDefaultView: CalendarDefaultView;
  weekStartsOn: WeekStartsOn;
  timeFormat: TimeFormat;
  createdAt: string;
  updatedAt: string;
}
