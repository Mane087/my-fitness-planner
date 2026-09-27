import { inject, Injectable } from '@angular/core';

import type { ScheduledWorkoutEntity } from '../domain/schemas/scheduled-workout.schema';
import { pickWorkoutDefinition } from '../domain/schemas/workout-definition.schema';
import { WorkoutStatus } from '../domain/workout.enums';
import { cloneValue, createId, nowIso } from '../repositories/repository-utils';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { WorkoutTemplateRepository } from '../repositories/workout-template.repository';

@Injectable({ providedIn: 'root' })
export class WorkoutTemplateSchedulerService {
  private readonly workoutTemplateRepository = inject(WorkoutTemplateRepository);
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);

  /** Copies the template definition to a date. Later template edits do not affect the copy. */
  async scheduleTemplate(
    templateId: string,
    scheduledDate: string,
  ): Promise<ScheduledWorkoutEntity> {
    const template = await this.workoutTemplateRepository.findById(templateId);

    if (!template) {
      throw new Error('Workout template was not found.');
    }

    const timestamp = nowIso();

    return this.scheduledWorkoutRepository.create({
      ...pickWorkoutDefinition(cloneValue(template)),
      id: createId(),
      scheduledDate,
      status: WorkoutStatus.Planned,
      sourceTemplateId: template.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}
