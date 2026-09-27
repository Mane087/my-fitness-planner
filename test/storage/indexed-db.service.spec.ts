import { IDBKeyRange as FakeIDBKeyRange } from 'fake-indexeddb';

import type { AppSettingsEntity } from '../../src/app/core/domain/app-settings.model';
import { CalendarDefaultView, TimeFormat } from '../../src/app/core/domain/app-settings.model';
import { WeekStartsOn } from '../../src/app/core/domain/sport-profile.model';
import type { TrainingZoneEntity } from '../../src/app/core/domain/training-zone.model';
import { INDEXED_DB_NAME, IndexedDbStore } from '../../src/app/core/storage/indexed-db.config';
import { IndexedDbService } from '../../src/app/core/storage/indexed-db.service';
import { V1_STORE_DEFINITIONS } from '../../src/app/core/storage/migrations/v1-initial-stores';
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

function createZone(id: string, sortOrder: number): TrainingZoneEntity {
  return {
    id,
    name: `Zone ${sortOrder}`,
    minHeartRate: 100 + sortOrder * 10,
    maxHeartRate: 110 + sortOrder * 10,
    sortOrder,
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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

    const database = await openDatabase(INDEXED_DB_NAME, 1);
    for (const definition of V1_STORE_DEFINITIONS) {
      expect(database.objectStoreNames.contains(definition.name)).toBe(true);
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
    await service.add(IndexedDbStore.TrainingZones, createZone('z1', 1));
    await service.add(IndexedDbStore.TrainingZones, createZone('z2', 2));

    const zones = await service.getAllFromIndex(IndexedDbStore.TrainingZones, 'by_sort_order', 2);

    expect(zones.map((zone) => zone.id)).toEqual(['z2']);
  });

  it('getAllByIndexRange returns records inside the range ordered by the index', async () => {
    await service.add(IndexedDbStore.TrainingZones, createZone('z3', 3));
    await service.add(IndexedDbStore.TrainingZones, createZone('z1', 1));
    await service.add(IndexedDbStore.TrainingZones, createZone('z2', 2));

    const zones = await service.getAllByIndexRange(
      IndexedDbStore.TrainingZones,
      'by_sort_order',
      FakeIDBKeyRange.bound(1, 2) as unknown as IDBKeyRange,
    );

    expect(zones.map((zone) => zone.id)).toEqual(['z1', 'z2']);
  });

  it('recovers after a failed operation by reopening the database', async () => {
    await service.initialize();

    await expect(
      service.getAllFromIndex(IndexedDbStore.AppSettings, 'missing_index'),
    ).rejects.toThrow(/Local storage/);

    await expect(service.add(IndexedDbStore.AppSettings, createSettings())).resolves.toBeDefined();
  });
});
