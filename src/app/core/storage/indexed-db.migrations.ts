import type { IndexedDbMigration, IndexedDbMigrationContext } from './indexed-db.types';
import { v1InitialStoresMigration } from './migrations/v1-initial-stores';
import { v2StructuredWorkoutsMigration } from './migrations/v2-structured-workouts';

// Ordered by version. Append a new migration and bump INDEXED_DB_VERSION together.
export const MIGRATIONS: readonly IndexedDbMigration[] = [
  v1InitialStoresMigration,
  v2StructuredWorkoutsMigration,
];

export function migrateIndexedDb(
  event: IDBVersionChangeEvent,
  migrations: readonly IndexedDbMigration[] = MIGRATIONS,
): void {
  const request = event.target as IDBOpenDBRequest | null;
  const database = request?.result;
  const transaction = request?.transaction;

  if (!database || !transaction) {
    throw new Error('Local storage migration failed. Database connection is unavailable.');
  }

  runMigrations(
    {
      database,
      transaction,
      oldVersion: event.oldVersion,
      newVersion: event.newVersion ?? database.version,
    },
    migrations,
  );
}

/**
 * Runs, in order, every migration with `oldVersion < version <= newVersion`.
 * Returns the versions that were applied.
 */
export function runMigrations(
  context: IndexedDbMigrationContext,
  migrations: readonly IndexedDbMigration[],
): number[] {
  assertMigrationsAreOrdered(migrations);
  assertTargetVersionHasMigration(context.newVersion, migrations);

  const pendingMigrations = migrations.filter(
    (migration) =>
      migration.version > context.oldVersion && migration.version <= context.newVersion,
  );

  for (const migration of pendingMigrations) {
    migration.upgrade(context);
  }

  return pendingMigrations.map((migration) => migration.version);
}

function assertMigrationsAreOrdered(migrations: readonly IndexedDbMigration[]): void {
  for (const [index, migration] of migrations.entries()) {
    const previousVersion = migrations[index - 1]?.version ?? 0;

    if (!Number.isInteger(migration.version) || migration.version <= previousVersion) {
      throw new Error(
        `Local storage migrations must have strictly ascending integer versions (found ${migration.version} after ${previousVersion}).`,
      );
    }
  }
}

function assertTargetVersionHasMigration(
  newVersion: number,
  migrations: readonly IndexedDbMigration[],
): void {
  if (!migrations.some((migration) => migration.version === newVersion)) {
    throw new Error(
      `Local storage migration failed. There is no migration for version ${newVersion}.`,
    );
  }
}
