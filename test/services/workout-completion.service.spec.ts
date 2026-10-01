import { TestBed } from '@angular/core/testing';

import { DomainValidationError } from '../../src/app/core/domain/domain-validation.error';
import { ScheduledWorkoutRepository } from '../../src/app/core/repositories/scheduled-workout.repository';
import { WorkoutCompletionService } from '../../src/app/core/services/workout-completion.service';
import { scheduledWorkout } from '../domain/fixtures';
import { installFakeIndexedDb } from '../storage/fake-indexeddb.helpers';

describe('WorkoutCompletionService (fake-indexeddb)', () => {
  let service: WorkoutCompletionService;
  let workouts: ScheduledWorkoutRepository;

  beforeEach(async () => {
    installFakeIndexedDb();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkoutCompletionService);
    workouts = TestBed.inject(ScheduledWorkoutRepository);
    await workouts.create(scheduledWorkout({ id: 'ride' }));
  });

  it('completes a workout with the recorded data and the completion time', async () => {
    const completed = await service.complete('ride', {
      durationSeconds: 3000,
      distanceMeters: 25000,
      rpe: 7,
      feeling: 4,
      notes: 'Piernas pesadas',
    });

    expect(completed.status).toBe('completed');
    expect(completed.completion).toMatchObject({
      durationSeconds: 3000,
      distanceMeters: 25000,
      rpe: 7,
      feeling: 4,
      notes: 'Piernas pesadas',
    });
    expect(Number.isNaN(Date.parse(completed.completion?.completedAt ?? ''))).toBe(false);
    await expect(workouts.findById('ride')).resolves.toEqual(completed);
  });

  it('does not store empty notes', async () => {
    const completed = await service.complete('ride', { notes: '   ' });

    expect(completed.completion).not.toHaveProperty('notes');
  });

  it('rejects invalid completion data and keeps the workout planned', async () => {
    const error = await service.complete('ride', { rpe: 11 }).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(DomainValidationError);
    expect((error as DomainValidationError).issues[0]?.message).toBe(
      'El RPE debe estar entre 1 y 10.',
    );
    await expect(workouts.findById('ride')).resolves.toMatchObject({ status: 'planned' });
  });

  it('skips a completed workout and removes its completion data', async () => {
    await service.complete('ride', { durationSeconds: 3000 });

    const skipped = await service.skip('ride');

    expect(skipped.status).toBe('skipped');
    expect(skipped).not.toHaveProperty('completion');
  });

  it('reopens a completed or skipped workout as planned', async () => {
    await service.complete('ride', { durationSeconds: 3000 });
    const reopened = await service.reopen('ride');

    await service.skip('ride');
    const reopenedAfterSkip = await service.reopen('ride');

    expect(reopened.status).toBe('planned');
    expect(reopened).not.toHaveProperty('completion');
    expect(reopenedAfterSkip.status).toBe('planned');
  });

  it('rejects an unknown workout', async () => {
    await expect(service.skip('missing')).rejects.toThrow('El entrenamiento no existe.');
  });
});
