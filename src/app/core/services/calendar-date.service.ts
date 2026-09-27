import { Injectable } from '@angular/core';

import { WeekStartsOn, type WeekStartsOn as WeekStartsOnType } from '../domain/calendar.enums';
import { CalendarDayViewModel } from '../interfaces/calendar-view-models';

const WEEKDAYS_MONDAY_FIRST = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

@Injectable({ providedIn: 'root' })
export class CalendarDateService {
  buildMonthGrid(
    year: number,
    month: number,
    weekStartsOn: WeekStartsOnType,
  ): CalendarDayViewModel[][] {
    const { startDate } = this.getVisibleRange(year, month, weekStartsOn);
    const start = this.parseDateOnly(startDate);
    const weeks: CalendarDayViewModel[][] = [];

    for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
      const week: CalendarDayViewModel[] = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = this.addDays(start, weekIndex * 7 + dayIndex);
        const dateOnly = this.formatDateOnly(date);

        week.push({
          date: dateOnly,
          dayOfMonth: date.getUTCDate(),
          isToday: this.isToday(dateOnly),
          isCurrentMonth: this.isSameMonth(dateOnly, year, month),
          isPast: dateOnly < this.formatDateOnly(new Date()),
          workouts: [],
          hiddenWorkoutCount: 0,
        });
      }

      weeks.push(week);
    }

    return weeks;
  }

  getVisibleRange(
    year: number,
    month: number,
    weekStartsOn: WeekStartsOnType,
  ): { startDate: string; endDate: string } {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0));
    const weekOffset = this.getWeekOffset(firstDay.getUTCDay(), weekStartsOn);
    const start = this.addDays(firstDay, -weekOffset);
    const end = this.addDays(start, 41);

    if (end < lastDay) {
      return { startDate: this.formatDateOnly(start), endDate: this.formatDateOnly(lastDay) };
    }

    return { startDate: this.formatDateOnly(start), endDate: this.formatDateOnly(end) };
  }

  getWeekdays(weekStartsOn: WeekStartsOnType): string[] {
    if (weekStartsOn === WeekStartsOn.Sunday) {
      return ['Domingo', ...WEEKDAYS_MONDAY_FIRST.slice(0, 6)];
    }

    return [...WEEKDAYS_MONDAY_FIRST];
  }

  formatMonthLabel(year: number, month: number): string {
    const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)))
      .toLocaleUpperCase('es-ES');

    return `${monthLabel} ${year}`;
  }

  isToday(date: string): boolean {
    return date === this.formatDateOnly(new Date());
  }

  isSameMonth(date: string, year: number, month: number): boolean {
    const parsedDate = this.parseDateOnly(date);
    return parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() + 1 === month;
  }

  formatDuration(totalMinutes: number): string {
    if (totalMinutes <= 0) {
      return '-- h';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }

    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
  }

  formatDistance(totalKm: number | null): string {
    if (totalKm === null) {
      return '-- km';
    }

    return `${Number.isInteger(totalKm) ? totalKm.toFixed(0) : totalKm.toFixed(1)} km`;
  }

  formatDateOnly(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  parseDateOnly(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  private addDays(date: Date, days: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
  }

  private getWeekOffset(dayOfWeek: number, weekStartsOn: WeekStartsOnType): number {
    if (weekStartsOn === WeekStartsOn.Sunday) {
      return dayOfWeek;
    }

    return (dayOfWeek + 6) % 7;
  }
}
