import { IDBFactory as FakeIDBFactory, IDBKeyRange as FakeIDBKeyRange } from 'fake-indexeddb';

interface IndexedDbGlobals {
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
  structuredClone?: <T>(value: T) => T;
}

const globals = globalThis as IndexedDbGlobals;

// jsdom does not implement structuredClone and fake-indexeddb requires it.
// Records in this project are plain objects, arrays, primitives and dates.
function cloneForTests<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item: unknown) => cloneForTests(item)) as T;
  }

  const clone: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    clone[key] = cloneForTests(item);
  }
  return clone as T;
}

/**
 * Installs a fresh, isolated IndexedDB implementation on the global scope.
 * Call it in `beforeEach` so every test starts with an empty database factory.
 */
export function installFakeIndexedDb(): void {
  if (typeof globals.structuredClone !== 'function') {
    globals.structuredClone = cloneForTests;
  }

  globals.indexedDB = new FakeIDBFactory();
  globals.IDBKeyRange = FakeIDBKeyRange as unknown as typeof IDBKeyRange;
}

export function uninstallIndexedDb(): void {
  delete globals.indexedDB;
}

export function openDatabase(
  name: string,
  version: number,
  onUpgrade?: (event: IDBVersionChangeEvent) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = (event) => {
      try {
        onUpgrade?.(event);
      } catch (error) {
        request.transaction?.abort();
        reject(error);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('open failed'));
  });
}

export function readAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error('getAll failed'));
  });
}

export function writeAll(
  database: IDBDatabase,
  storeName: string,
  records: unknown[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    for (const record of records) {
      store.put(record);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('put failed'));
  });
}
