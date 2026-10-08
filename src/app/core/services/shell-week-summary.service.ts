import { inject, Injectable, signal } from '@angular/core';

import { AppSettingsRepository } from '../repositories/app-settings.repository';
import { CalendarDateService } from './calendar-date.service';
import { WeeklySummaryService } from './weekly-summary.service';

export interface ShellWeekSummary {
  /** Actual time as `h:mm`. */
  actualClock: string;
  /** Planned time as `h:mm`. */
  plannedClock: string;
  /** Actual time over planned time, 0 when nothing is planned. */
  progressPercent: number;
  sessions: number;
  completedSessions: number;
}

export function formatClock(totalSeconds: number): string {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Summary of the current week shown in the sidebar. Call `refresh` when the data may have changed. */
@Injectable({ providedIn: 'root' })
export class ShellWeekSummaryService {
  private readonly appSettingsRepository = inject(AppSettingsRepository);
  private readonly weeklySummary = inject(WeeklySummaryService);
  private readonly calendarDate = inject(CalendarDateService);

  private readonly summaryState = signal<ShellWeekSummary | null>(null);
  /** `null` until the first load and when loading fails: the sidebar then hides the summary. */
  readonly summary = this.summaryState.asReadonly();

  async refresh(): Promise<void> {
    try {
      const settings = await this.appSettingsRepository.getSettings();
      const { totals } = await this.weeklySummary.getWeeklySummary(
        this.calendarDate.today(),
        settings.weekStartsOn,
      );

      this.summaryState.set({
        actualClock: formatClock(totals.actualSeconds),
        plannedClock: formatClock(totals.plannedSeconds),
        progressPercent:
          totals.plannedSeconds > 0 ? (totals.actualSeconds / totals.plannedSeconds) * 100 : 0,
        sessions: totals.sessions,
        completedSessions: totals.completedSessions,
      });
    } catch (error) {
      console.error('Week summary could not be loaded.', error);
      this.summaryState.set(null);
    }
  }
}
