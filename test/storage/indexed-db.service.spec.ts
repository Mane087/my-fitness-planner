import { IDBKeyRange as FakeIDBKeyRange } from 'fake-indexeddb';

import {
  CalendarDefaultView,
  TimeFormat,
  WeekStartsOn,
} from '../../src/app/core/domain/calendar.enums';
import type { AppSettingsEntity } from '../../src/app/core/domain/schemas/app-settings.schema';
import {
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  IndexedDbStore,
} from '../../src/app/core/storage/indexed-db.config';
import { IndexedDbService } from '../../src/app/core/storage/indexed-db.service';
import { scheduledWorkout } from '../domain/fixtures';
import { installFakeIndexedDb, openDatabase, uninstallIndexedDb } from './fake-indexeddb.helpers';

function createSettings(overrides: Partial<AppSettingsEntity> = {}): AppSettingsEntity {
  return {
    id: 'settings',
    calendarDefaultView: CalendarDefaultView.Month,
    weekStartsOn: WeekStartsOn.Monday,
    timeFormat: TimeFormat.TwentyFourHour,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('IndexedDbService', () => {
  let service: IndexedDbService;

  beforeEach(() => {
    installFakeIndexedDb();
    service = new IndexedDbService();
  });

  it('initialize creates every configured store', async () => {
    await service.initialize();

    const database = await openDatabase(INDEXED_DB_NAME, INDEXED_DB_VERSION);
    for (const storeName of Object.values(IndexedDbStore)) {
      expect(database.objectStoreNames.contains(storeName)).toBe(true);
    }
    database.close();
  });

  it('rejects when IndexedDB is not available in the environment', async () => {
    uninstallIndexedDb();
    service = new IndexedDbService();

    await expect(service.initialize()).rejects.toThrow(/Local storage is unavailable/);
  });

  it('add stores a record and getById returns it', async () => {
    const settings = createSettings();

    await expect(service.add(IndexedDbStore.AppSettings, settings)).resolves.toEqual(settings);
    await expect(service.getById(IndexedDbStore.AppSettings, settings.id)).resolves.toEqual(
      settings,
    );
  });

  it('getById returns null for an unknown id', async () => {
    await expect(service.getById(IndexedDbStore.AppSettings, 'missing')).resolves.toBeNull();
  });

  it('add rejects a duplicated key and keeps the original record', async () => {
    const original = createSettings({ timeFormat: TimeFormat.TwelveHour });
    await service.add(IndexedDbStore.AppSettings, original);

    await expect(service.add(IndexedDbStore.AppSettings, createSettings())).rejects.toThrow(
      /Local storage/,
    );
    await expect(service.getById(IndexedDbStore.AppSettings, original.id)).resolves.toEqual(
      original,
    );
  });

  it('put replaces an existing record', async () => {
    await service.add(IndexedDbStore.AppSettings, createSettings());
    const updated = createSettings({ calendarDefaultView: CalendarDefaultView.Week });

    await service.put(IndexedDbStore.AppSettings, updated);

    await expect(service.getById(IndexedDbStore.AppSettings, updated.id)).resolves.toEqual(updated);
  });

  it('delete removes a record and getAll reflects it', async () => {
    await service.add(IndexedDbStore.AppSettings, createSettings({ id: 'a' }));
    await service.add(IndexedDbStore.AppSettings, createSettings({ id: 'b' }));

    await service.delete(IndexedDbStore.AppSettings, 'a');

    const remaining = await service.getAll(IndexedDbStore.AppSettings);
    expect(remaining.map((record) => record.id)).toEqual(['b']);
  });

  it('getAllFromIndex returns records matching the index key', async () => {
    await service.add(IndexedDbStore.ScheduledWorkouts, scheduledWorkout({ id: 'ride' }));
    await service.add(
      IndexedDbStore.ScheduledWorkouts,
      scheduledWorkout({ id: 'run', sport: 'running', modality: 'trail' }),
    );

    const runs = await service.getAllFromIndex(
      IndexedDbStore.ScheduledWorkouts,
      'by_sport',
      'running',
    );

    expect(runs.map((workout) => workout.id)).toEqual(['run']);
  });

  it('getAllByIndexRange returns records inside the range ordered by the index', async () => {
    await service.add(
      IndexedDbStore.ScheduledWorkouts,
      scheduledWorkout({ id: 'late', scheduledDate: '2026-10-03' }),
    );
    await service.add(
      IndexedDbStore.ScheduledWorkouts,
      scheduledWorkout({ id: 'early', scheduledDate: '2026-09-28' }),
    );
    await service.add(
      IndexedDbStore.ScheduledWorkouts,
      scheduledWorkout({ id: 'middle', scheduledDate: '2026-09-30' }),
    );

    const workouts = await service.getAllByIndexRange(
      IndexedDbStore.ScheduledWorkouts,
      'by_scheduled_date',
      FakeIDBKeyRange.bound('2026-09-28', '2026-09-30') as unknown as IDBKeyRange,
    );

    expect(workouts.map((workout) => workout.id)).toEqual(['early', 'middle']);
  });

  it('recovers after a failed operation by reopening the database', async () => {
    await service.initialize();

    await expect(
      service.getAllFromIndex(IndexedDbStore.AppSettings, 'missing_index'),
    ).rejects.toThrow(/Local storage/);

    await expect(service.add(IndexedDbStore.AppSettings, createSettings())).resolves.toBeDefined();
  });
});
