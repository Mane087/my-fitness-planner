import { inject, Injectable } from '@angular/core';

import {
  scheduledWorkoutSchema,
  type ScheduledWorkoutEntity,
} from '../domain/schemas/scheduled-workout.schema';
import { pickWorkoutDefinition } from '../domain/schemas/workout-definition.schema';
import { WorkoutStatus } from '../domain/workout.enums';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { assertDateOnly, cloneValue, createId, nowIso, parseEntity } from './repository-utils';

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

  async create(workout: ScheduledWorkoutEntity): Promise<ScheduledWorkoutEntity> {
    const timestamp = nowIso();
    const nextWorkout = parseEntity(scheduledWorkoutSchema, 'Scheduled workout', {
      ...workout,
      id: workout.id || createId(),
      status: workout.status ?? WorkoutStatus.Planned,
      createdAt: workout.createdAt || timestamp,
      updatedAt: timestamp,
    });

    return this.indexedDb.add(IndexedDbStore.ScheduledWorkouts, nextWorkout);
  }

  async update(workout: ScheduledWorkoutEntity): Promise<ScheduledWorkoutEntity> {
    const nextWorkout = parseEntity(scheduledWorkoutSchema, 'Scheduled workout', {
      ...workout,
      updatedAt: nowIso(),
    });

    return this.indexedDb.put(IndexedDbStore.ScheduledWorkouts, nextWorkout);
  }

  async move(id: string, scheduledDate: string): Promise<ScheduledWorkoutEntity> {
    assertDateOnly(scheduledDate);
    const workout = await this.findById(id);

    if (!workout) {
      throw new Error('Scheduled workout was not found.');
    }

    return this.indexedDb.put(IndexedDbStore.ScheduledWorkouts, {
      ...workout,
      scheduledDate,
      updatedAt: nowIso(),
    });
  }

  /** Copies the planned definition to another date. The copy starts as planned, without completion. */
  async copy(id: string, scheduledDate: string): Promise<ScheduledWorkoutEntity> {
    assertDateOnly(scheduledDate);
    const workout = await this.findById(id);

    if (!workout) {
      throw new Error('Scheduled workout was not found.');
    }

    const timestamp = nowIso();
    const copiedWorkout: ScheduledWorkoutEntity = {
      ...pickWorkoutDefinition(cloneValue(workout)),
      id: createId(),
      scheduledDate,
      status: WorkoutStatus.Planned,
      ...(workout.sourceTemplateId ? { sourceTemplateId: workout.sourceTemplateId } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.indexedDb.add(IndexedDbStore.ScheduledWorkouts, copiedWorkout);
  }

  delete(id: string): Promise<void> {
    return this.indexedDb.delete(IndexedDbStore.ScheduledWorkouts, id);
  }
}
