import { appSettingsSchema } from '../../src/app/core/domain/schemas/app-settings.schema';
import { IndexedDbStore } from '../../src/app/core/storage/indexed-db.config';
import { migrateIndexedDb } from '../../src/app/core/storage/indexed-db.migrations';
import { installFakeIndexedDb, openDatabase, readAll, writeAll } from './fake-indexeddb.helpers';

const DATABASE_NAME = 'v3_migration_test_db';
const TIMESTAMP = '2026-05-20T12:00:00.000Z';

// Settings exactly as the v2 application stored them.
const V2_SETTINGS = {
  id: 'settings-1',
  calendarDefaultView: 'week',
  weekStartsOn: 'sunday',
  timeFormat: '12h',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

async function createV2Database(settings: unknown[]): Promise<void> {
  const database = await openDatabase(DATABASE_NAME, 2, migrateIndexedDb);
  await writeAll(database, IndexedDbStore.AppSettings, settings);
  database.close();
}

describe('migration v3: theme setting', () => {
  beforeEach(() => {
    installFakeIndexedDb();
  });

  it('adds theme "system" to existing settings and keeps the other fields', async () => {
    await createV2Database([V2_SETTINGS]);

    const database = await openDatabase(DATABASE_NAME, 3, migrateIndexedDb);
    const settings = await readAll<Record<string, unknown>>(database, IndexedDbStore.AppSettings);
    database.close();

    expect(settings).toEqual([{ ...V2_SETTINGS, theme: 'system' }]);
    expect(appSettingsSchema.safeParse(settings[0]).success).toBe(true);
  });

  it('does not overwrite a theme that is already set', async () => {
    await createV2Database([{ ...V2_SETTINGS, theme: 'dark' }]);

    const database = await openDatabase(DATABASE_NAME, 3, migrateIndexedDb);
    const settings = await readAll<{ theme: string }>(database, IndexedDbStore.AppSettings);
    database.close();

    expect(settings[0]?.theme).toBe('dark');
  });

  it('upgrades a database without settings records', async () => {
    await createV2Database([]);

    const database = await openDatabase(DATABASE_NAME, 3, migrateIndexedDb);

    await expect(readAll(database, IndexedDbStore.AppSettings)).resolves.toEqual([]);
    database.close();
  });
});
