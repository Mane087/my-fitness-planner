import { inject, Injectable } from '@angular/core';

import { nowIso } from '../domain/entity-utils';
import type {
  ScheduledWorkoutEntity,
  WorkoutCompletion,
} from '../domain/schemas/scheduled-workout.schema';
import { WorkoutStatus } from '../domain/workout.enums';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';

/** Data the user records when completing a workout; the completion time is set by the service. */
export type WorkoutCompletionInput = Omit<WorkoutCompletion, 'completedAt'>;

/**
 * Status transitions of a scheduled workout. Only a completed workout keeps completion data,
 * so every transition writes `status` and `completion` together.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutCompletionService {
  private readonly workouts = inject(ScheduledWorkoutRepository);

  async complete(
    workoutId: string,
    input: WorkoutCompletionInput,
  ): Promise<ScheduledWorkoutEntity> {
    const workout = await this.findExisting(workoutId);

    return this.workouts.update({
      ...workout,
      status: WorkoutStatus.Completed,
      completion: { ...withoutEmptyNotes(input), completedAt: nowIso() },
    });
  }

  async skip(workoutId: string): Promise<ScheduledWorkoutEntity> {
    return this.workouts.update(
      withoutCompletion(await this.findExisting(workoutId), WorkoutStatus.Skipped),
    );
  }

  async reopen(workoutId: string): Promise<ScheduledWorkoutEntity> {
    return this.workouts.update(
      withoutCompletion(await this.findExisting(workoutId), WorkoutStatus.Planned),
    );
  }

  private async findExisting(workoutId: string): Promise<ScheduledWorkoutEntity> {
    const workout = await this.workouts.findById(workoutId);

    if (!workout) {
      throw new Error('El entrenamiento no existe.');
    }

    return workout;
  }
}

function withoutCompletion(
  workout: ScheduledWorkoutEntity,
  status: WorkoutStatus,
): ScheduledWorkoutEntity {
  const next = { ...workout, status };
  delete next.completion;
  return next;
}

function withoutEmptyNotes(input: WorkoutCompletionInput): WorkoutCompletionInput {
  const next = { ...input };
  if (!next.notes?.trim()) delete next.notes;
  return next;
}
