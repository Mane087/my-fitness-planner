import {
  MIGRATIONS,
  migrateIndexedDb,
  runMigrations,
} from '../../src/app/core/storage/indexed-db.migrations';
import { INDEXED_DB_VERSION, IndexedDbStore } from '../../src/app/core/storage/indexed-db.config';
import type {
  IndexedDbMigration,
  IndexedDbMigrationContext,
} from '../../src/app/core/storage/indexed-db.types';
import {
  deleteStoreIfExists,
  ensureStore,
  transformRecords,
} from '../../src/app/core/storage/migrations/migration-utils';
import { V1_STORE_DEFINITIONS } from '../../src/app/core/storage/migrations/v1-initial-stores';
import { installFakeIndexedDb, openDatabase, readAll, writeAll } from './fake-indexeddb.helpers';

const DATABASE_NAME = 'migration_runner_test_db';

function createMigration(version: number, upgrade = jest.fn()): IndexedDbMigration {
  return { version, description: `migration ${version}`, upgrade };
}

function createContext(oldVersion: number, newVersion: number): IndexedDbMigrationContext {
  return {
    database: {} as IDBDatabase,
    transaction: {} as IDBTransaction,
    oldVersion,
    newVersion,
  };
}

describe('runMigrations', () => {
  it('runs every migration in order on a fresh database', () => {
    const calls: number[] = [];
    const migrations = [1, 2, 3].map((version) =>
      createMigration(
        version,
        jest.fn(() => {
          calls.push(version);
        }),
      ),
    );

    const applied = runMigrations(createContext(0, 3), migrations);

    expect(calls).toEqual([1, 2, 3]);
    expect(applied).toEqual([1, 2, 3]);
  });

  it('runs only the migrations newer than the installed version', () => {
    const migrations = [createMigration(1), createMigration(2), createMigration(3)];

    const applied = runMigrations(createContext(1, 3), migrations);

    expect(migrations[0]?.upgrade).not.toHaveBeenCalled();
    expect(migrations[1]?.upgrade).toHaveBeenCalledTimes(1);
    expect(migrations[2]?.upgrade).toHaveBeenCalledTimes(1);
    expect(applied).toEqual([2, 3]);
  });

  it('passes the upgrade context to each migration', () => {
    const migration = createMigration(1);
    const context = createContext(0, 1);

    runMigrations(context, [migration]);

    expect(migration.upgrade).toHaveBeenCalledWith(context);
  });

  it('rejects migrations that are not strictly ascending', () => {
    expect(() =>
      runMigrations(createContext(0, 2), [createMigration(2), createMigration(1)]),
    ).toThrow(/ascending/);
    expect(() =>
      runMigrations(createContext(0, 2), [createMigration(1), createMigration(1)]),
    ).toThrow(/ascending/);
  });

  it('rejects a target version without a matching migration', () => {
    expect(() => runMigrations(createContext(0, 2), [createMigration(1)])).toThrow(
      /no migration for version 2/i,
    );
  });

  it('stops at the first failing migration', () => {
    const failing = createMigration(
      1,
      jest.fn(() => {
        throw new Error('boom');
      }),
    );
    const next = createMigration(2);

    expect(() => runMigrations(createContext(0, 2), [failing, next])).toThrow('boom');
    expect(next.upgrade).not.toHaveBeenCalled();
  });
});

describe('MIGRATIONS', () => {
  it('ends at the configured database version', () => {
    expect(MIGRATIONS.at(-1)?.version).toBe(INDEXED_DB_VERSION);
  });
});

describe('migrateIndexedDb (fake-indexeddb)', () => {
  beforeEach(() => {
    installFakeIndexedDb();
  });

  it('creates the v1 stores and indexes on a fresh database', async () => {
    const database = await openDatabase(DATABASE_NAME, INDEXED_DB_VERSION, migrateIndexedDb);

    for (const definition of V1_STORE_DEFINITIONS) {
      expect(database.objectStoreNames.contains(definition.name)).toBe(true);
      const store = database.transaction(definition.name).objectStore(definition.name);
      expect(store.keyPath).toBe(definition.keyPath);
      for (const index of definition.indexes) {
        expect(store.indexNames.contains(index.name)).toBe(true);
      }
    }

    expect(database.objectStoreNames).toHaveLength(Object.values(IndexedDbStore).length);
    database.close();
  });

  it('keeps existing data when reopening at the same version', async () => {
    const record = { id: 'settings', calendarDefaultView: 'month' };
    const first = await openDatabase(DATABASE_NAME, INDEXED_DB_VERSION, migrateIndexedDb);
    await writeAll(first, IndexedDbStore.AppSettings, [record]);
    first.close();

    const upgrade = jest.fn(migrateIndexedDb);
    const second = await openDatabase(DATABASE_NAME, INDEXED_DB_VERSION, upgrade);

    expect(upgrade).not.toHaveBeenCalled();
    await expect(readAll(second, IndexedDbStore.AppSettings)).resolves.toEqual([record]);
    second.close();
  });

  it('applies only the pending migrations when upgrading an existing database', async () => {
    const first = await openDatabase(DATABASE_NAME, 1, migrateIndexedDb);
    first.close();

    const v1Upgrade = jest.fn(MIGRATIONS[0]!.upgrade);
    const migrations: IndexedDbMigration[] = [
      { ...MIGRATIONS[0]!, upgrade: v1Upgrade },
      {
        version: 2,
        description: 'add archive store',
        upgrade: (context) => ensureStore(context, { name: 'archive', keyPath: 'id', indexes: [] }),
      },
    ];

    const second = await openDatabase(DATABASE_NAME, 2, (event) =>
      migrateIndexedDb(event, migrations),
    );

    expect(v1Upgrade).not.toHaveBeenCalled();
    expect(second.version).toBe(2);
    expect(second.objectStoreNames.contains('archive')).toBe(true);
    second.close();
  });

  it('leaves the database at the previous version when a migration throws', async () => {
    const first = await openDatabase(DATABASE_NAME, 1, migrateIndexedDb);
    await writeAll(first, IndexedDbStore.AppSettings, [{ id: 'settings' }]);
    first.close();

    const migrations: IndexedDbMigration[] = [
      MIGRATIONS[0]!,
      {
        version: 2,
        description: 'broken',
        upgrade: () => {
          throw new Error('broken migration');
        },
      },
    ];

    await expect(
      openDatabase(DATABASE_NAME, 2, (event) => migrateIndexedDb(event, migrations)),
    ).rejects.toThrow('broken migration');

    const reopened = await openDatabase(DATABASE_NAME, 1);
    expect(reopened.version).toBe(1);
    await expect(readAll(reopened, IndexedDbStore.AppSettings)).resolves.toEqual([
      { id: 'settings' },
    ]);
    reopened.close();
  });
});

describe('migration utils (fake-indexeddb)', () => {
  beforeEach(() => {
    installFakeIndexedDb();
  });

  it('ensureStore adds missing indexes to an existing store without recreating it', async () => {
    const first = await openDatabase(DATABASE_NAME, 1, (event) =>
      runUpgrade(event, (context) =>
        ensureStore(context, { name: 'items', keyPath: 'id', indexes: [] }),
      ),
    );
    await writeAll(first, 'items', [{ id: 'a', group: 'x' }]);
    first.close();

    const second = await openDatabase(DATABASE_NAME, 2, (event) =>
      runUpgrade(event, (context) =>
        ensureStore(context, {
          name: 'items',
          keyPath: 'id',
          indexes: [{ name: 'by_group', keyPath: 'group' }],
        }),
      ),
    );

    const store = second.transaction('items').objectStore('items');
    expect(store.indexNames.contains('by_group')).toBe(true);
    await expect(readAll(second, 'items')).resolves.toEqual([{ id: 'a', group: 'x' }]);
    second.close();
  });

  it('deleteStoreIfExists removes a store and ignores missing ones', async () => {
    const first = await openDatabase(DATABASE_NAME, 1, (event) =>
      runUpgrade(event, (context) =>
        ensureStore(context, { name: 'legacy', keyPath: 'id', indexes: [] }),
      ),
    );
    first.close();

    const second = await openDatabase(DATABASE_NAME, 2, (event) =>
      runUpgrade(event, (context) => {
        deleteStoreIfExists(context, 'legacy');
        deleteStoreIfExists(context, 'never_existed');
      }),
    );

    expect(second.objectStoreNames.contains('legacy')).toBe(false);
    second.close();
  });

  it('transformRecords rewrites every record and deletes the ones mapped to null', async () => {
    const first = await openDatabase(DATABASE_NAME, 1, (event) =>
      runUpgrade(event, (context) =>
        ensureStore(context, { name: 'items', keyPath: 'id', indexes: [] }),
      ),
    );
    await writeAll(first, 'items', [
      { id: 'a', minutes: 10 },
      { id: 'b', minutes: 20 },
      { id: 'c', minutes: 0 },
    ]);
    first.close();

    const second = await openDatabase(DATABASE_NAME, 2, (event) =>
      runUpgrade(event, (context) => {
        const store = context.transaction.objectStore('items');
        transformRecords<{ id: string; minutes: number }, { id: string; seconds: number }>(
          store,
          (record) => (record.minutes > 0 ? { id: record.id, seconds: record.minutes * 60 } : null),
        );
      }),
    );

    await expect(readAll(second, 'items')).resolves.toEqual([
      { id: 'a', seconds: 600 },
      { id: 'b', seconds: 1200 },
    ]);
    second.close();
  });
});

function runUpgrade(
  event: IDBVersionChangeEvent,
  upgrade: (context: IndexedDbMigrationContext) => void,
): void {
  const request = event.target as IDBOpenDBRequest;

  upgrade({
    database: request.result,
    transaction: request.transaction!,
    oldVersion: event.oldVersion,
    newVersion: event.newVersion ?? request.result.version,
  });
}
