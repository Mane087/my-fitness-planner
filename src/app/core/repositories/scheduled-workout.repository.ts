import { inject, Injectable } from '@angular/core';
import { WorkoutStatus } from '../domain/workout.enums';
import type { ScheduledWorkoutEntity } from '../domain/scheduled-workout.model';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import {
  assertDateOnly,
  assertValidBlocks,
  cloneValue,
  createId,
  isWorkoutDiscipline,
  isWorkoutStatus,
  isWorkoutType,
  nowIso,
} from './repository-utils';

@Injectable({ providedIn: 'root' })
export class ScheduledWorkoutRepository {
  private readonly indexedDb = inject(IndexedDbService);

  async findByDate(date: string): Promise<ScheduledWorkoutEntity[]> {
    assertDateOnly(date);
    return this.indexedDb.getAllFromIndex(
      IndexedDbStore.ScheduledWorkouts,
      'by_scheduled_date',
      date,
    );
  }

  async findByDateRange(startDate: string, endDate: string): Promise<ScheduledWorkoutEntity[]> {
    assertDateOnly(startDate);
    assertDateOnly(endDate);
    const range = IDBKeyRange.bound(startDate, endDate);
    const workouts = await this.indexedDb.getAllByIndexRange(
      IndexedDbStore.ScheduledWorkouts,
      'by_scheduled_date',
      range,
    );
    return workouts.sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
  }

  findById(id: string): Promise<ScheduledWorkoutEntity | null> {
    return this.indexedDb.getById(IndexedDbStore.ScheduledWorkouts, id);
  }

  create(workout: ScheduledWorkoutEntity): Promise<ScheduledWorkoutEntity> {
    const timestamp = nowIso();
    const nextWorkout = {
      ...workout,
      id: workout.id || createId(),
      blocks: workout.blocks ?? [],
      status: workout.status ?? WorkoutStatus.Planned,
      createdAt: workout.createdAt || timestamp,
      updatedAt: timestamp,
    };
    this.validate(nextWorkout);
    return this.indexedDb.add(IndexedDbStore.ScheduledWorkouts, nextWorkout);
  }

  update(workout: ScheduledWorkoutEntity): Promise<ScheduledWorkoutEntity> {
    const nextWorkout = { ...workout, blocks: workout.blocks ?? [], updatedAt: nowIso() };
    this.validate(nextWorkout);
    return this.indexedDb.put(IndexedDbStore.ScheduledWorkouts, nextWorkout);
  }

  async move(id: string, scheduledDate: string): Promise<ScheduledWorkoutEntity> {
    assertDateOnly(scheduledDate);
    const workout = await this.findById(id);

    if (!workout) {
      throw new Error('Scheduled workout was not found.');
    }

    const movedWorkout = { ...workout, scheduledDate, updatedAt: nowIso() };
    return this.indexedDb.put(IndexedDbStore.ScheduledWorkouts, movedWorkout);
  }

  async copy(id: string, scheduledDate: string): Promise<ScheduledWorkoutEntity> {
    assertDateOnly(scheduledDate);
    const workout = await this.findById(id);

    if (!workout) {
      throw new Error('Scheduled workout was not found.');
    }

    const timestamp = nowIso();
    const copiedWorkout: ScheduledWorkoutEntity = {
      ...cloneValue(workout),
      id: createId(),
      scheduledDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.indexedDb.add(IndexedDbStore.ScheduledWorkouts, copiedWorkout);
  }

  delete(id: string): Promise<void> {
    return this.indexedDb.delete(IndexedDbStore.ScheduledWorkouts, id);
  }

  private validate(workout: ScheduledWorkoutEntity): void {
    if (!workout.title.trim()) {
      throw new Error('Scheduled workout title is required.');
    }

    assertDateOnly(workout.scheduledDate);

    if (workout.estimatedDurationMinutes <= 0) {
      throw new Error('Scheduled workout duration must be greater than 0.');
    }

    if (!isWorkoutType(workout.workoutType)) {
      throw new Error('Scheduled workout type is invalid.');
    }

    if (!isWorkoutDiscipline(workout.discipline)) {
      throw new Error('Scheduled workout discipline is invalid.');
    }

    if (!isWorkoutStatus(workout.status)) {
      throw new Error('Scheduled workout status is invalid.');
    }

    assertValidBlocks(workout.blocks);
  }
}
