import { TestBed } from '@angular/core/testing';

import { DomainValidationError } from '../../src/app/core/domain/domain-validation.error';
import { AppSettingsRepository } from '../../src/app/core/repositories/app-settings.repository';
import { AthleteProfileRepository } from '../../src/app/core/repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../../src/app/core/repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../../src/app/core/repositories/training-zone-set.repository';
import { WorkoutTemplateRepository } from '../../src/app/core/repositories/workout-template.repository';
import { LocalPersistenceService } from '../../src/app/core/services/local-persistence.service';
import { WorkoutTemplateSchedulerService } from '../../src/app/core/services/workout-template-scheduler.service';
import { heartRateZoneSet, interval, scheduledWorkout, workoutTemplate } from '../domain/fixtures';
import { installFakeIndexedDb } from '../storage/fake-indexeddb.helpers';

describe('repositories (fake-indexeddb)', () => {
  beforeEach(() => {
    installFakeIndexedDb();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  describe('ScheduledWorkoutRepository', () => {
    let repository: ScheduledWorkoutRepository;

    beforeEach(() => {
      repository = TestBed.inject(ScheduledWorkoutRepository);
    });

    it('creates a valid workout and finds it by date range', async () => {
      await repository.create(scheduledWorkout({ id: 'a', scheduledDate: '2026-09-29' }));
      await repository.create(scheduledWorkout({ id: 'b', scheduledDate: '2026-09-28' }));
      await repository.create(scheduledWorkout({ id: 'c', scheduledDate: '2026-10-10' }));

      const workouts = await repository.findByDateRange('2026-09-28', '2026-09-30');

      expect(workouts.map((workout) => workout.id)).toEqual(['b', 'a']);
    });

    it('rejects an invalid workout with a Spanish validation message and does not store it', async () => {
      const invalid = scheduledWorkout({ id: 'bad', title: '', steps: [] });

      await expect(repository.create(invalid)).rejects.toBeInstanceOf(DomainValidationError);
      await expect(repository.create(invalid)).rejects.toThrow(
        /El título del entrenamiento es requerido/,
      );
      await expect(repository.findById('bad')).resolves.toBeNull();
    });

    it('rejects an update that marks the workout completed without completion data', async () => {
      const stored = await repository.create(scheduledWorkout());

      await expect(repository.update({ ...stored, status: 'completed' })).rejects.toThrow(
        /datos de ejecución/,
      );
    });

    it('moves a workout to another date', async () => {
      await repository.create(scheduledWorkout({ id: 'a' }));

      const moved = await repository.move('a', '2026-10-01');

      expect(moved.scheduledDate).toBe('2026-10-01');
      await expect(repository.findByDate('2026-10-01')).resolves.toHaveLength(1);
    });

    it('copies the definition as a new planned workout without completion', async () => {
      await repository.create(
        scheduledWorkout({
          id: 'done',
          status: 'completed',
          completion: { completedAt: '2026-09-28T19:00:00.000Z', rpe: 7 },
          sourceTemplateId: 'template-1',
        }),
      );

      const copy = await repository.copy('done', '2026-10-05');

      expect(copy.id).not.toBe('done');
      expect(copy).toMatchObject({
        scheduledDate: '2026-10-05',
        status: 'planned',
        sourceTemplateId: 'template-1',
        steps: scheduledWorkout().steps,
      });
      expect(copy).not.toHaveProperty('completion');
    });
  });

  describe('WorkoutTemplateRepository', () => {
    it('filters archived templates and finds templates by sport', async () => {
      const repository = TestBed.inject(WorkoutTemplateRepository);
      await repository.create(workoutTemplate({ id: 'ride' }));
      await repository.create(
        workoutTemplate({ id: 'run', sport: 'running', modality: 'road', category: 'tempo' }),
      );
      await repository.archive('ride');

      await expect(repository.findAllActive()).resolves.toMatchObject([{ id: 'run' }]);
      await expect(repository.findAllArchived()).resolves.toMatchObject([{ id: 'ride' }]);
      await expect(repository.findBySport('running')).resolves.toMatchObject([{ id: 'run' }]);
    });
  });

  describe('TrainingZoneSetRepository', () => {
    it('rejects overlapping zones on save', async () => {
      const repository = TestBed.inject(TrainingZoneSetRepository);
      const zoneSet = heartRateZoneSet();
      zoneSet.zones[1] = { ...zoneSet.zones[1]!, minValue: 100 };

      await expect(repository.save(zoneSet)).rejects.toThrow(/traslaparse/);
    });
  });

  describe('WorkoutTemplateRepository.findFiltered', () => {
    beforeEach(async () => {
      const templates = TestBed.inject(WorkoutTemplateRepository);
      await templates.create(workoutTemplate({ id: 'ride', title: 'Umbral en ruta' }));
      await templates.create(
        workoutTemplate({ id: 'old-ride', title: 'Antigua rodada', isArchived: true }),
      );
      await templates.create(
        workoutTemplate({ id: 'run', title: 'Fartlek', sport: 'running', modality: 'trail' }),
      );
    });

    it('hides archived templates by default and sorts by title', async () => {
      const templates = await TestBed.inject(WorkoutTemplateRepository).findFiltered();

      expect(templates.map((template) => template.id)).toEqual(['run', 'ride']);
    });

    it('filters by sport and can include archived templates', async () => {
      const repository = TestBed.inject(WorkoutTemplateRepository);

      const cycling = await repository.findFiltered({ sport: 'cycling' });
      const cyclingWithArchived = await repository.findFiltered({
        sport: 'cycling',
        shouldIncludeArchived: true,
      });

      expect(cycling.map((template) => template.id)).toEqual(['ride']);
      expect(cyclingWithArchived.map((template) => template.id)).toEqual(['old-ride', 'ride']);
    });
  });

  describe('WorkoutTemplateSchedulerService', () => {
    it('schedules a copy of the template steps with the source template id', async () => {
      const templates = TestBed.inject(WorkoutTemplateRepository);
      const scheduler = TestBed.inject(WorkoutTemplateSchedulerService);
      const template = await templates.create(workoutTemplate({ id: 'template-1' }));

      const scheduled = await scheduler.scheduleTemplate('template-1', '2026-10-02');
      await templates.update({ ...template, title: 'Título cambiado' });

      expect(scheduled).toMatchObject({
        title: template.title,
        steps: template.steps,
        scheduledDate: '2026-10-02',
        status: 'planned',
        sourceTemplateId: 'template-1',
      });
      expect(scheduled).not.toHaveProperty('isArchived');
      const stored = await TestBed.inject(ScheduledWorkoutRepository).findById(scheduled.id);
      expect(stored?.title).toBe(template.title);
    });

    it('keeps scheduled workouts when the template steps change or it is archived', async () => {
      const templates = TestBed.inject(WorkoutTemplateRepository);
      const template = await templates.create(workoutTemplate({ id: 'template-1' }));
      const scheduled = await TestBed.inject(WorkoutTemplateSchedulerService).scheduleTemplate(
        'template-1',
        '2026-10-02',
      );

      await templates.update({ ...template, steps: [interval('only-step')] });
      await templates.archive('template-1');

      const stored = await TestBed.inject(ScheduledWorkoutRepository).findById(scheduled.id);
      expect(stored?.steps).toEqual(template.steps);
      expect(stored?.sourceTemplateId).toBe('template-1');
    });

    it('fails when the template does not exist', async () => {
      await expect(
        TestBed.inject(WorkoutTemplateSchedulerService).scheduleTemplate('missing', '2026-10-02'),
      ).rejects.toThrow('Workout template was not found.');
    });
  });

  describe('AthleteProfileRepository', () => {
    it('reports the default profile as not configured until it is saved', async () => {
      const profiles = TestBed.inject(AthleteProfileRepository);

      await expect(profiles.hasConfiguredProfile()).resolves.toBe(false);
      const profile = await profiles.createDefaultProfile();
      await expect(profiles.hasConfiguredProfile()).resolves.toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 2));
      await profiles.save({ ...profile, name: 'Ana' });

      await expect(profiles.hasConfiguredProfile()).resolves.toBe(true);
    });
  });

  describe('LocalPersistenceService', () => {
    it('seeds settings, profile and the heart rate zone set once', async () => {
      const persistence = TestBed.inject(LocalPersistenceService);

      await persistence.initialize();
      await persistence.initialize();

      const profile = await TestBed.inject(AthleteProfileRepository).getActiveProfile();
      const zoneSets = await TestBed.inject(TrainingZoneSetRepository).findAll();
      expect(profile).toMatchObject({ preferredSport: 'cycling', maxHeartRate: 190 });
      expect(zoneSets).toHaveLength(1);
      expect(zoneSets[0]).toMatchObject({
        sport: 'cycling',
        metric: 'heart_rate',
        referenceValue: 190,
      });
      await expect(TestBed.inject(AppSettingsRepository).getSettings()).resolves.toMatchObject({
        calendarDefaultView: 'month',
      });
    });

    it('seeds the cycling heart rate set when the preferred sport has no zones', async () => {
      const profiles = TestBed.inject(AthleteProfileRepository);
      const profile = await profiles.createDefaultProfile();
      await profiles.save({ ...profile, preferredSport: 'mobility' });

      await TestBed.inject(LocalPersistenceService).initialize();

      const zoneSets = await TestBed.inject(TrainingZoneSetRepository).findAll();
      expect(zoneSets).toMatchObject([{ sport: 'cycling', metric: 'heart_rate' }]);
    });
  });
});
