import { TestBed } from '@angular/core/testing';

import { DomainValidationError } from '../../src/app/core/domain/domain-validation.error';
import { AthleteProfileRepository } from '../../src/app/core/repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../../src/app/core/repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../../src/app/core/repositories/training-zone-set.repository';
import { WorkoutTemplateRepository } from '../../src/app/core/repositories/workout-template.repository';
import { TrainingZoneSetService } from '../../src/app/core/services/training-zone-set.service';
import {
  heartRateZoneSet,
  interval,
  repeat,
  scheduledWorkout,
  workoutTemplate,
} from '../domain/fixtures';
import { installFakeIndexedDb } from '../storage/fake-indexeddb.helpers';

describe('TrainingZoneSetService (fake-indexeddb)', () => {
  let service: TrainingZoneSetService;
  let repository: TrainingZoneSetRepository;

  beforeEach(() => {
    installFakeIndexedDb();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrainingZoneSetService);
    repository = TestBed.inject(TrainingZoneSetRepository);
  });

  async function expectValidationMessage(
    promise: Promise<unknown>,
    message: string,
  ): Promise<void> {
    const error = await promise.then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(DomainValidationError);
    expect((error as DomainValidationError).issues.map((issue) => issue.message)).toContain(
      message,
    );
  }

  describe('getOrSeed', () => {
    it('creates the default set once and returns the stored one afterwards', async () => {
      const seeded = await service.getOrSeed('running', 'pace', 300);
      const again = await service.getOrSeed('running', 'pace', 280);

      expect(again.id).toBe(seeded.id);
      expect(again.referenceValue).toBe(300);
      expect(seeded.zones).toHaveLength(5);
      await expect(repository.findAll()).resolves.toHaveLength(1);
    });

    it('uses the profile max heart rate when no reference is given', async () => {
      const profiles = TestBed.inject(AthleteProfileRepository);
      const profile = await profiles.createDefaultProfile();
      await profiles.save({ ...profile, maxHeartRate: 200 });

      const zoneSet = await service.getOrSeed('running', 'heart_rate');

      expect(zoneSet.referenceValue).toBe(200);
      expect(zoneSet.zones.at(-1)?.maxValue).toBe(200);
    });

    it('uses the default FTP and threshold pace when no reference is given', async () => {
      const power = await service.getOrSeed('cycling', 'power');
      const pace = await service.getOrSeed('running', 'pace');

      expect(power.referenceValue).toBe(200);
      expect(power.zones).toHaveLength(7);
      expect(pace.referenceValue).toBe(300);
    });

    it('rejects a reference outside the accepted range', async () => {
      await expectValidationMessage(
        service.getOrSeed('cycling', 'power', 1000),
        'El FTP debe estar entre 50 y 600 W.',
      );
      await expect(repository.findAll()).resolves.toEqual([]);
    });
  });

  describe('regenerateFromReference', () => {
    it('recreates the zones from the new FTP and keeps the zone ids by position', async () => {
      const seeded = await service.getOrSeed('cycling', 'power', 200);

      const regenerated = await service.regenerateFromReference(seeded.id, 250);

      expect(regenerated.referenceValue).toBe(250);
      expect(regenerated.zones.map((zone) => zone.id)).toEqual(seeded.zones.map((zone) => zone.id));
      expect(regenerated.zones[3]).toMatchObject({
        name: 'Z4 Umbral',
        minValue: 225,
        maxValue: 263,
      });
      await expect(repository.findById(seeded.id)).resolves.toEqual(regenerated);
    });

    it('recreates pace zones from the threshold pace in seconds per km', async () => {
      const seeded = await service.getOrSeed('running', 'pace', 300);

      const regenerated = await service.regenerateFromReference(seeded.id, 270);

      // Z4 is 99% to 106% of 4:30/km.
      expect(regenerated.zones[3]).toMatchObject({ minValue: 267, maxValue: 286 });
    });

    it('rejects an unknown set', async () => {
      await expect(service.regenerateFromReference('missing', 250)).rejects.toThrow(
        'Las zonas no existen.',
      );
    });
  });

  describe('save', () => {
    it('rejects zones with a gap between them', async () => {
      const zoneSet = heartRateZoneSet();
      zoneSet.zones[1] = { ...zoneSet.zones[1]!, minValue: 117 };

      await expectValidationMessage(
        service.save(zoneSet),
        'Cada zona debe empezar donde termina la anterior.',
      );
    });

    it('rejects pace zones with a gap between them', async () => {
      const paceSet = heartRateZoneSet({
        sport: 'running',
        metric: 'pace',
        referenceValue: 300,
        zones: [
          { id: 'p1', name: 'Z1', minValue: 387, maxValue: 480, sortOrder: 1 },
          { id: 'p2', name: 'Z2', minValue: 342, maxValue: 380, sortOrder: 2 },
        ],
      });

      await expectValidationMessage(
        service.save(paceSet),
        'Cada zona debe empezar donde termina la anterior.',
      );
    });

    it('stores contiguous zones edited by the user', async () => {
      const zoneSet = heartRateZoneSet();
      zoneSet.zones[0] = { ...zoneSet.zones[0]!, maxValue: 120 };
      zoneSet.zones[1] = { ...zoneSet.zones[1]!, minValue: 120 };

      await service.save(zoneSet);

      await expect(repository.findById(zoneSet.id)).resolves.toMatchObject({
        zones: [{ maxValue: 120 }, { minValue: 120 }, {}],
      });
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await repository.save(heartRateZoneSet());
    });

    it('deletes a set that no workout or template uses', async () => {
      await TestBed.inject(ScheduledWorkoutRepository).create(
        scheduledWorkout({ steps: [interval('free', { target: undefined })] }),
      );

      await service.delete('zone-set-hr');

      await expect(repository.findById('zone-set-hr')).resolves.toBeNull();
    });

    it('rejects deleting a set used inside a repeat group of a scheduled workout', async () => {
      await TestBed.inject(ScheduledWorkoutRepository).create(
        scheduledWorkout({ steps: [repeat('main')] }),
      );

      await expect(service.delete('zone-set-hr')).rejects.toThrow(
        'No puedes eliminar estas zonas porque hay entrenamientos o plantillas que las usan.',
      );
      await expect(repository.findById('zone-set-hr')).resolves.not.toBeNull();
    });

    it('rejects deleting a set used by a template', async () => {
      await TestBed.inject(WorkoutTemplateRepository).create(workoutTemplate());

      await expect(service.isInUse('zone-set-hr')).resolves.toBe(true);
      await expect(service.delete('zone-set-hr')).rejects.toThrow(/plantillas que las usan/);
    });
  });
});
