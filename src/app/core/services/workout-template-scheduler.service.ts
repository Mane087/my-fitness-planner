import { inject, Injectable } from '@angular/core';
import type { ScheduledWorkoutEntity } from '../domain/scheduled-workout.model';
import { WorkoutStatus } from '../domain/workout.enums';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { cloneValue, createId, nowIso } from '../repositories/repository-utils';
import { WorkoutTemplateRepository } from '../repositories/workout-template.repository';

@Injectable({ providedIn: 'root' })
export class WorkoutTemplateSchedulerService {
  private readonly workoutTemplateRepository = inject(WorkoutTemplateRepository);
  private readonly scheduledWorkoutRepository = inject(ScheduledWorkoutRepository);

  async scheduleTemplate(
    templateId: string,
    scheduledDate: string,
  ): Promise<ScheduledWorkoutEntity> {
    const template = await this.workoutTemplateRepository.findById(templateId);

    if (!template) {
      throw new Error('Workout template was not found.');
    }

    const timestamp = nowIso();
    const scheduledWorkout: ScheduledWorkoutEntity = {
      id: createId(),
      title: template.title,
      scheduledDate,
      workoutType: template.workoutType,
      discipline: template.discipline,
      estimatedDurationMinutes: template.estimatedDurationMinutes,
      status: WorkoutStatus.Planned,
      blocks: cloneValue(template.blocks),
      sourceTemplateId: template.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (template.targetZoneId !== undefined) {
      scheduledWorkout.targetZoneId = template.targetZoneId;
    }

    if (template.targetZoneSnapshot !== undefined) {
      scheduledWorkout.targetZoneSnapshot = cloneValue(template.targetZoneSnapshot);
    }

    if (template.targetRpe !== undefined) {
      scheduledWorkout.targetRpe = template.targetRpe;
    }

    if (template.cadenceMin !== undefined) {
      scheduledWorkout.cadenceMin = template.cadenceMin;
    }

    if (template.cadenceMax !== undefined) {
      scheduledWorkout.cadenceMax = template.cadenceMax;
    }

    if (template.objective !== undefined) {
      scheduledWorkout.objective = template.objective;
    }

    if (template.notes !== undefined) {
      scheduledWorkout.notes = template.notes;
    }

    return this.scheduledWorkoutRepository.create(scheduledWorkout);
  }
}
