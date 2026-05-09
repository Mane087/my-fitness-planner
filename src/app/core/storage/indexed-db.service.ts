import { Injectable } from '@angular/core';
import { INDEXED_DB_NAME, INDEXED_DB_VERSION, type IndexedDbStore } from './indexed-db.config';
import { migrateIndexedDb } from './indexed-db.migrations';
import type { IndexedDbSchema } from './indexed-db.types';

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private database: IDBDatabase | null = null;

  initialize(): Promise<void> {
    return this.openDatabase().then(() => undefined);
  }

  getAll<StoreName extends IndexedDbStore>(
    storeName: StoreName,
  ): Promise<IndexedDbSchema[StoreName][]> {
    return this.requestFromStore(storeName, 'readonly', (store) => store.getAll());
  }

  getById<StoreName extends IndexedDbStore>(
    storeName: StoreName,
    id: string,
  ): Promise<IndexedDbSchema[StoreName] | null> {
    return this.requestFromStore(storeName, 'readonly', (store) => store.get(id)).then(
      (record) => record ?? null,
    );
  }

  getAllFromIndex<StoreName extends IndexedDbStore>(
    storeName: StoreName,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange,
  ): Promise<IndexedDbSchema[StoreName][]> {
    return this.requestFromStore(storeName, 'readonly', (store) =>
      store.index(indexName).getAll(query),
    );
  }

  getAllByIndexRange<StoreName extends IndexedDbStore>(
    storeName: StoreName,
    indexName: string,
    range: IDBKeyRange,
  ): Promise<IndexedDbSchema[StoreName][]> {
    return this.requestCursor(storeName, 'readonly', (store) =>
      store.index(indexName).openCursor(range),
    );
  }

  add<StoreName extends IndexedDbStore>(
    storeName: StoreName,
    value: IndexedDbSchema[StoreName],
  ): Promise<IndexedDbSchema[StoreName]> {
    return this.requestFromStore(storeName, 'readwrite', (store) => store.add(value)).then(
      () => value,
    );
  }

  put<StoreName extends IndexedDbStore>(
    storeName: StoreName,
    value: IndexedDbSchema[StoreName],
  ): Promise<IndexedDbSchema[StoreName]> {
    return this.requestFromStore(storeName, 'readwrite', (store) => store.put(value)).then(
      () => value,
    );
  }

  delete(storeName: IndexedDbStore, id: string): Promise<void> {
    return this.requestFromStore(storeName, 'readwrite', (store) => store.delete(id)).then(
      () => undefined,
    );
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) {
      return this.databasePromise;
    }

    if (!('indexedDB' in globalThis)) {
      return Promise.reject(
        new Error(
          'Local storage is unavailable. Your workouts cannot be saved in this browser session.',
        ),
      );
    }

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);
      let migrationError: Error | null = null;

      request.onupgradeneeded = (event) => {
        try {
          migrateIndexedDb(event);
        } catch (error) {
          migrationError = toStorageError(
            error,
            'Local storage migration failed. Your workouts cannot be saved right now.',
          );
          this.database = null;
          request.transaction?.abort();
          reject(migrationError);
        }
      };

      request.onsuccess = () => {
        if (migrationError) {
          request.result.close();
          this.database = null;
          reject(migrationError);
          return;
        }

        this.database = request.result;
        resolve(request.result);
      };
      request.onerror = () =>
        reject(
          toStorageError(
            request.error,
            'Local storage is unavailable. Your workouts cannot be saved in this browser session.',
          ),
        );
      request.onblocked = () =>
        reject(new Error('Local storage upgrade is blocked by another open application tab.'));
    }).catch((error: unknown) => {
      this.databasePromise = null;
      this.database = null;
      throw error;
    });

    return this.databasePromise;
  }

  private invalidateDatabase(database: IDBDatabase): void {
    if (this.database === database) {
      this.databasePromise = null;
      this.database = null;
    }

    database.close();
  }

  private async requestFromStore<StoreName extends IndexedDbStore, Result>(
    storeName: StoreName,
    mode: IDBTransactionMode,
    createRequest: (store: IDBObjectStore) => IDBRequest<Result>,
  ): Promise<Result> {
    const database = await this.openDatabase();

    return new Promise<Result>((resolve, reject) => {
      let result = undefined as Result;
      let request!: IDBRequest<Result>;
      const fail = (error: unknown, fallbackMessage: string) => {
        this.invalidateDatabase(database);
        reject(toStorageError(error, fallbackMessage));
      };

      let transaction: IDBTransaction;

      try {
        transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        request = createRequest(store);
      } catch (error) {
        fail(error, 'Local storage operation failed.');
        return;
      }

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => fail(request.error, 'Local storage operation failed.');
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => fail(transaction.error, 'Local storage transaction failed.');
      transaction.onabort = () =>
        fail(transaction.error, 'Local storage transaction was cancelled.');
    });
  }

  private async requestCursor<StoreName extends IndexedDbStore>(
    storeName: StoreName,
    mode: IDBTransactionMode,
    createRequest: (store: IDBObjectStore) => IDBRequest<IDBCursorWithValue | null>,
  ): Promise<IndexedDbSchema[StoreName][]> {
    const database = await this.openDatabase();

    return new Promise<IndexedDbSchema[StoreName][]>((resolve, reject) => {
      const results: IndexedDbSchema[StoreName][] = [];
      let request!: IDBRequest<IDBCursorWithValue | null>;
      const fail = (error: unknown, fallbackMessage: string) => {
        this.invalidateDatabase(database);
        reject(toStorageError(error, fallbackMessage));
      };

      let transaction: IDBTransaction;

      try {
        transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        request = createRequest(store);
      } catch (error) {
        fail(error, 'Local storage query failed.');
        return;
      }

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          return;
        }

        results.push(cursor.value as IndexedDbSchema[StoreName]);
        cursor.continue();
      };

      request.onerror = () => fail(request.error, 'Local storage query failed.');
      transaction.oncomplete = () => resolve(results);
      transaction.onerror = () => fail(transaction.error, 'Local storage transaction failed.');
      transaction.onabort = () =>
        fail(transaction.error, 'Local storage transaction was cancelled.');
    });
  }
}

function toStorageError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error && error.message) {
    return new Error(`${fallbackMessage} ${error.message}`);
  }

  return new Error(fallbackMessage);
}
