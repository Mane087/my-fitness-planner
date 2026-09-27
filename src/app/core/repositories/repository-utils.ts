import {
  WORKOUT_DISCIPLINES,
  WORKOUT_STATUSES,
  WORKOUT_TYPES,
  INTENSITY_METRICS,
  type IntensityMetric,
  type WorkoutDiscipline,
  type WorkoutStatus,
  type WorkoutType,
} from '../domain/workout.enums';
import { WorkoutBlockTargetType } from '../domain/workout-block.model';
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

export function isIntensityMetric(value: string): value is IntensityMetric {
  return INTENSITY_METRICS.includes(value as IntensityMetric);
}

export function assertValidBlocks(blocks: WorkoutBlockEntity[]): void {
  const ids = new Set<string>();

  for (const [index, block] of blocks.entries()) {
    if (!block.name.trim()) {
      throw new Error('Workout block name is required.');
    }

    if (block.durationMinutes <= 0) {
      throw new Error('Workout block duration must be greater than 0.');
    }

    if (block.sortOrder !== index + 1) {
      throw new Error('Workout block sort order must be sequential.');
    }

    if (ids.has(block.id)) {
      throw new Error('Workout block IDs must be unique.');
    }
    ids.add(block.id);

    if (
      block.targetType === WorkoutBlockTargetType.Distance &&
      (!block.distanceKm || block.distanceKm <= 0)
    ) {
      throw new Error('Distance-based workout blocks require a distance greater than 0.');
    }

    if (block.targetRpe !== undefined && (block.targetRpe < 1 || block.targetRpe > 10)) {
      throw new Error('Workout block RPE must be between 1 and 10.');
    }

    if (
      block.cadenceMin !== undefined &&
      block.cadenceMax !== undefined &&
      block.cadenceMin > block.cadenceMax
    ) {
      throw new Error('Workout block minimum cadence cannot exceed maximum cadence.');
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
