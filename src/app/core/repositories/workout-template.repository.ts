import { inject, Injectable } from '@angular/core';

import {
  workoutTemplateSchema,
  type WorkoutTemplateEntity,
} from '../domain/schemas/workout-template.schema';
import type { Sport } from '../domain/workout.enums';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { createId, nowIso, parseEntity } from './repository-utils';

export interface WorkoutTemplateFilters {
  sport?: Sport | null;
  /** Archived templates are hidden unless requested. */
  shouldIncludeArchived?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkoutTemplateRepository {
  private readonly indexedDb = inject(IndexedDbService);

  findAll(): Promise<WorkoutTemplateEntity[]> {
    return this.indexedDb.getAll(IndexedDbStore.WorkoutTemplates);
  }

  // Booleans are not valid IndexedDB keys, so archived state is filtered in memory.
  async findAllActive(): Promise<WorkoutTemplateEntity[]> {
    const templates = await this.findAll();
    return templates.filter((template) => !template.isArchived);
  }

  async findAllArchived(): Promise<WorkoutTemplateEntity[]> {
    const templates = await this.findAll();
    return templates.filter((template) => template.isArchived);
  }

  /** Templates sorted by title. The sport uses the `by_sport` index; archived state is a boolean. */
  async findFiltered(filters: WorkoutTemplateFilters = {}): Promise<WorkoutTemplateEntity[]> {
    const templates = filters.sport ? await this.findBySport(filters.sport) : await this.findAll();

    return templates
      .filter((template) => filters.shouldIncludeArchived || !template.isArchived)
      .sort((left, right) => left.title.localeCompare(right.title, 'es'));
  }

  findBySport(sport: Sport): Promise<WorkoutTemplateEntity[]> {
    return this.indexedDb.getAllFromIndex(IndexedDbStore.WorkoutTemplates, 'by_sport', sport);
  }

  findById(id: string): Promise<WorkoutTemplateEntity | null> {
    return this.indexedDb.getById(IndexedDbStore.WorkoutTemplates, id);
  }

  async create(template: WorkoutTemplateEntity): Promise<WorkoutTemplateEntity> {
    const timestamp = nowIso();
    const nextTemplate = parseEntity(workoutTemplateSchema, 'Workout template', {
      ...template,
      id: template.id || createId(),
      isArchived: template.isArchived ?? false,
      createdAt: template.createdAt || timestamp,
      updatedAt: timestamp,
    });

    return this.indexedDb.add(IndexedDbStore.WorkoutTemplates, nextTemplate);
  }

  async update(template: WorkoutTemplateEntity): Promise<WorkoutTemplateEntity> {
    const nextTemplate = parseEntity(workoutTemplateSchema, 'Workout template', {
      ...template,
      updatedAt: nowIso(),
    });

    return this.indexedDb.put(IndexedDbStore.WorkoutTemplates, nextTemplate);
  }

  async archive(id: string): Promise<void> {
    await this.setArchived(id, true);
  }

  async restore(id: string): Promise<void> {
    await this.setArchived(id, false);
  }

  delete(id: string): Promise<void> {
    return this.indexedDb.delete(IndexedDbStore.WorkoutTemplates, id);
  }

  private async setArchived(id: string, isArchived: boolean): Promise<void> {
    const template = await this.findById(id);

    if (!template) {
      throw new Error('Workout template was not found.');
    }

    await this.indexedDb.put(IndexedDbStore.WorkoutTemplates, {
      ...template,
      isArchived,
      updatedAt: nowIso(),
    });
  }
}
