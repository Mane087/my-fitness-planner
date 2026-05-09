import { inject, Injectable } from '@angular/core';
import type { WorkoutTemplateEntity } from '../domain/workout-template.model';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import {
  assertValidBlocks,
  createId,
  isWorkoutDiscipline,
  isWorkoutType,
  nowIso,
} from './repository-utils';

@Injectable({ providedIn: 'root' })
export class WorkoutTemplateRepository {
  private readonly indexedDb = inject(IndexedDbService);

  async findAllActive(): Promise<WorkoutTemplateEntity[]> {
    return this.indexedDb.getAllFromIndex(
      IndexedDbStore.WorkoutTemplates,
      'by_archived',
      false as unknown as IDBValidKey,
    );
  }

  async findAllArchived(): Promise<WorkoutTemplateEntity[]> {
    return this.indexedDb.getAllFromIndex(
      IndexedDbStore.WorkoutTemplates,
      'by_archived',
      true as unknown as IDBValidKey,
    );
  }

  findById(id: string): Promise<WorkoutTemplateEntity | null> {
    return this.indexedDb.getById(IndexedDbStore.WorkoutTemplates, id);
  }

  create(template: WorkoutTemplateEntity): Promise<WorkoutTemplateEntity> {
    const timestamp = nowIso();
    const nextTemplate = {
      ...template,
      id: template.id || createId(),
      blocks: template.blocks ?? [],
      archived: template.archived ?? false,
      createdAt: template.createdAt || timestamp,
      updatedAt: timestamp,
    };
    this.validate(nextTemplate);
    return this.indexedDb.add(IndexedDbStore.WorkoutTemplates, nextTemplate);
  }

  update(template: WorkoutTemplateEntity): Promise<WorkoutTemplateEntity> {
    const nextTemplate = { ...template, blocks: template.blocks ?? [], updatedAt: nowIso() };
    this.validate(nextTemplate);
    return this.indexedDb.put(IndexedDbStore.WorkoutTemplates, nextTemplate);
  }

  async archive(id: string): Promise<void> {
    await this.setArchived(id, true);
  }

  async restore(id: string): Promise<void> {
    await this.setArchived(id, false);
  }

  private async setArchived(id: string, archived: boolean): Promise<void> {
    const template = await this.findById(id);

    if (!template) {
      throw new Error('Workout template was not found.');
    }

    await this.indexedDb.put(IndexedDbStore.WorkoutTemplates, {
      ...template,
      archived,
      updatedAt: nowIso(),
    });
  }

  private validate(template: WorkoutTemplateEntity): void {
    if (!template.title.trim()) {
      throw new Error('Workout template title is required.');
    }

    if (template.estimatedDurationMinutes <= 0) {
      throw new Error('Workout template duration must be greater than 0.');
    }

    if (!isWorkoutType(template.workoutType)) {
      throw new Error('Workout template type is invalid.');
    }

    if (!isWorkoutDiscipline(template.discipline)) {
      throw new Error('Workout template discipline is invalid.');
    }

    assertValidBlocks(template.blocks);
  }
}
