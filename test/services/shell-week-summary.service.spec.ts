import { TestBed } from '@angular/core/testing';

import { AppSettingsRepository } from '../../src/app/core/repositories/app-settings.repository';
import { CalendarDateService } from '../../src/app/core/services/calendar-date.service';
import {
  formatClock,
  ShellWeekSummaryService,
} from '../../src/app/core/services/shell-week-summary.service';
import {
  WeeklySummaryService,
  type SummaryTotals,
} from '../../src/app/core/services/weekly-summary.service';

function totals(overrides: Partial<SummaryTotals>): SummaryTotals {
  return {
    sessions: 0,
    completedSessions: 0,
    skippedSessions: 0,
    plannedSeconds: 0,
    actualSeconds: 0,
    plannedMeters: 0,
    actualMeters: 0,
    compliance: null,
    ...overrides,
  };
}

describe('formatClock', () => {
  it('formats seconds as h:mm', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(6 * 3600 + 45 * 60)).toBe('6:45');
    expect(formatClock(3600 + 5 * 60)).toBe('1:05');
  });

  it('rounds to the nearest minute and never goes negative', () => {
    expect(formatClock(89)).toBe('0:01');
    expect(formatClock(-30)).toBe('0:00');
  });
});

describe('ShellWeekSummaryService', () => {
  const getSettings = jest.fn();
  const getWeeklySummary = jest.fn();

  function createService(): ShellWeekSummaryService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AppSettingsRepository, useValue: { getSettings } },
        { provide: WeeklySummaryService, useValue: { getWeeklySummary } },
        { provide: CalendarDateService, useValue: { today: () => '2026-09-29' } },
      ],
    });
    return TestBed.inject(ShellWeekSummaryService);
  }

  beforeEach(() => {
    getSettings.mockReset();
    getWeeklySummary.mockReset();
    getSettings.mockResolvedValue({ weekStartsOn: 'monday' });
  });

  it('has no summary until it is loaded', () => {
    expect(createService().summary()).toBeNull();
  });

  it('loads the current week with the configured first day', async () => {
    getWeeklySummary.mockResolvedValue({
      totals: totals({
        sessions: 6,
        completedSessions: 4,
        plannedSeconds: 8.5 * 3600,
        actualSeconds: 6.75 * 3600,
      }),
    });
    const service = createService();

    await service.refresh();

    expect(getWeeklySummary).toHaveBeenCalledWith('2026-09-29', 'monday');
    expect(service.summary()).toEqual({
      actualClock: '6:45',
      plannedClock: '8:30',
      progressPercent: expect.closeTo(79.41, 1),
      sessions: 6,
      completedSessions: 4,
    });
  });

  it('shows 0 % progress when nothing is planned', async () => {
    getWeeklySummary.mockResolvedValue({ totals: totals({}) });
    const service = createService();

    await service.refresh();

    expect(service.summary()?.progressPercent).toBe(0);
  });

  it('clears the summary and does not throw when loading fails', async () => {
    getWeeklySummary.mockResolvedValueOnce({ totals: totals({ sessions: 1 }) });
    const service = createService();
    await service.refresh();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getWeeklySummary.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.refresh()).resolves.toBeUndefined();

    expect(service.summary()).toBeNull();
  });
});
