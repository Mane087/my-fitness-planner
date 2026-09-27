import { TestBed } from '@angular/core/testing';

import { WeekStartsOn } from '../../src/app/core/domain/calendar.enums';
import { ScheduledWorkoutRepository } from '../../src/app/core/repositories/scheduled-workout.repository';
import { WeeklySummaryService } from '../../src/app/core/services/weekly-summary.service';
import { scheduledWorkout } from '../domain/fixtures';
import { installFakeIndexedDb } from '../storage/fake-indexeddb.helpers';

const COMPLETED_AT = '2026-09-28T20:00:00.000Z';

describe('WeeklySummaryService (fake-indexeddb)', () => {
  let service: WeeklySummaryService;
  let workouts: ScheduledWorkoutRepository;

  beforeEach(async () => {
    installFakeIndexedDb();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WeeklySummaryService);
    workouts = TestBed.inject(ScheduledWorkoutRepository);

    // Week from Monday 2026-09-28 to Sunday 2026-10-04.
    await workouts.create(
      scheduledWorkout({
        id: 'ride-done',
        scheduledDate: '2026-09-28',
        plannedDurationSeconds: 3600,
        plannedDistanceMeters: 30000,
        status: 'completed',
        completion: { completedAt: COMPLETED_AT, durationSeconds: 3000, distanceMeters: 25000 },
      }),
    );
    await workouts.create(
      scheduledWorkout({
        id: 'ride-skipped',
        scheduledDate: '2026-09-30',
        category: 'endurance',
        plannedDurationSeconds: 5400,
        plannedDistanceMeters: 45000,
        status: 'skipped',
      }),
    );
    await workouts.create(
      scheduledWorkout({
        id: 'run-done-without-data',
        sport: 'running',
        modality: 'road',
        category: 'endurance',
        scheduledDate: '2026-10-04',
        plannedDurationSeconds: 1800,
        plannedDistanceMeters: 6000,
        status: 'completed',
        completion: { completedAt: COMPLETED_AT },
      }),
    );
    await workouts.create(
      scheduledWorkout({
        id: 'next-week',
        scheduledDate: '2026-10-05',
        plannedDurationSeconds: 900,
      }),
    );
  });

  it('compares planned and actual totals of the week', async () => {
    const summary = await service.getWeeklySummary('2026-10-01', WeekStartsOn.Monday);

    expect(summary.startDate).toBe('2026-09-28');
    expect(summary.endDate).toBe('2026-10-04');
    expect(summary.totals).toEqual({
      sessions: 3,
      completedSessions: 2,
      skippedSessions: 1,
      // Skipped workouts count as planned.
      plannedSeconds: 3600 + 5400 + 1800,
      // A completion without duration or distance counts the planned values.
      actualSeconds: 3000 + 1800,
      plannedMeters: 30000 + 45000 + 6000,
      actualMeters: 25000 + 6000,
      compliance: 4800 / 10800,
    });
  });

  it('groups the week by sport and by category, leaving out empty groups', async () => {
    const summary = await service.getWeeklySummary('2026-10-01', WeekStartsOn.Monday);

    expect(summary.bySport.map((row) => [row.sport, row.sessions, row.actualSeconds])).toEqual([
      ['cycling', 2, 3000],
      ['running', 1, 1800],
    ]);
    expect(summary.byCategory.map((row) => [row.category, row.sessions])).toEqual([
      ['endurance', 2],
      ['threshold', 1],
    ]);
    expect(summary.bySport[1]?.compliance).toBe(1);
  });

  it('uses the configured first day of the week', async () => {
    const summary = await service.getWeeklySummary('2026-10-04', WeekStartsOn.Sunday);

    expect(summary.startDate).toBe('2026-10-04');
    expect(summary.endDate).toBe('2026-10-10');
    expect(summary.totals.sessions).toBe(2);
    expect(summary.totals.plannedSeconds).toBe(1800 + 900);
  });

  it('returns null compliance for a week without workouts', async () => {
    const summary = await service.getWeeklySummary('2026-11-18', WeekStartsOn.Monday);

    expect(summary.totals.sessions).toBe(0);
    expect(summary.totals.compliance).toBeNull();
    expect(summary.bySport).toEqual([]);
  });
});
