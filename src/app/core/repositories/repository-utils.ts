import {
  WORKOUT_DISCIPLINES,
  WORKOUT_STATUSES,
  WORKOUT_TYPES,
  type WorkoutDiscipline,
  type WorkoutStatus,
  type WorkoutType,
} from '../domain/workout.enums';
import type { WorkoutBlockEntity } from '../domain/workout-block.model';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
let fallbackIdCounter = 0;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    const timestamp = Date.now();
    const performanceTimestamp = Math.floor(globalThis.performance?.now() ?? 0);
    fallbackIdCounter = (fallbackIdCounter + 1) & 0xffff;

    for (let index = 0; index < bytes.length; index += 1) {
      const shift = (index % 6) * 8;
      const timeByte = Math.floor(timestamp / 2 ** shift) & 0xff;
      const performanceByte = (performanceTimestamp >>> ((index % 4) * 8)) & 0xff;
      const counterByte = (fallbackIdCounter >>> ((index % 2) * 8)) & 0xff;
      const randomByte = Math.floor(Math.random() * 256);

      bytes[index] = (timeByte ^ performanceByte ^ counterByte ^ randomByte) & 0xff;
    }
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function assertDateOnly(date: string): void {
  if (!DATE_ONLY_PATTERN.test(date)) {
    throw new Error('Scheduled date must use YYYY-MM-DD format.');
  }
}

export function isWorkoutType(value: string): value is WorkoutType {
  return WORKOUT_TYPES.includes(value as WorkoutType);
}

export function isWorkoutDiscipline(value: string): value is WorkoutDiscipline {
  return WORKOUT_DISCIPLINES.includes(value as WorkoutDiscipline);
}

export function isWorkoutStatus(value: string): value is WorkoutStatus {
  return WORKOUT_STATUSES.includes(value as WorkoutStatus);
}

export function assertValidBlocks(blocks: WorkoutBlockEntity[]): void {
  for (const block of blocks) {
    if (block.durationMinutes <= 0) {
      throw new Error('Workout block duration must be greater than 0.');
    }

    if (!Number.isFinite(block.sortOrder)) {
      throw new Error('Workout block sort order is required.');
    }
  }
}

export function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value) as T;
  }

  try {
    const serializedValue = JSON.stringify(value);

    if (serializedValue === undefined) {
      throw new TypeError('JSON serialization produced undefined.');
    }

    return JSON.parse(serializedValue) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const ErrorConstructor = error instanceof TypeError ? TypeError : Error;

    throw Object.assign(
      new ErrorConstructor(
        `Value cannot be cloned without structuredClone support. ${errorMessage}`,
      ),
      { cause: error },
    );
  }
}
