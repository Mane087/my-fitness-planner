import type { IndexedDbMigrationContext, IndexedDbStoreDefinition } from '../indexed-db.types';

/**
 * Creates the store when it does not exist and adds every missing index.
 * Existing stores keep their records; existing indexes are left untouched.
 */
export function ensureStore(
  context: IndexedDbMigrationContext,
  definition: IndexedDbStoreDefinition,
): IDBObjectStore {
  const store = context.database.objectStoreNames.contains(definition.name)
    ? context.transaction.objectStore(definition.name)
    : context.database.createObjectStore(definition.name, { keyPath: definition.keyPath });

  for (const index of definition.indexes) {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, index.options);
    }
  }

  return store;
}

export function deleteStoreIfExists(context: IndexedDbMigrationContext, storeName: string): void {
  if (context.database.objectStoreNames.contains(storeName)) {
    context.database.deleteObjectStore(storeName);
  }
}

/**
 * Rewrites every record of a store inside the upgrade transaction.
 * Returning `null` from `transform` deletes the record.
 * Errors thrown by `transform` abort the whole upgrade transaction.
 */
export function transformRecords<OldRecord, NewRecord>(
  store: IDBObjectStore,
  transform: (record: OldRecord) => NewRecord | null,
): void {
  const request = store.openCursor();

  request.onsuccess = () => {
    const cursor = request.result;

    if (!cursor) {
      return;
    }

    const nextRecord = transform(cursor.value as OldRecord);

    if (nextRecord === null) {
      cursor.delete();
    } else {
      cursor.update(nextRecord);
    }

    cursor.continue();
  };
}
