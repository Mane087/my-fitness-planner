import { TestBed } from '@angular/core/testing';

import { AppSettingsRepository } from '../../src/app/core/repositories/app-settings.repository';
import { AthleteProfileRepository } from '../../src/app/core/repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../../src/app/core/repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../../src/app/core/repositories/training-zone-set.repository';
import { WorkoutTemplateRepository } from '../../src/app/core/repositories/workout-template.repository';
import { BackupImportError, BackupService } from '../../src/app/core/services/backup.service';
import { INDEXED_DB_VERSION, IndexedDbStore } from '../../src/app/core/storage/indexed-db.config';
import { heartRateZoneSet, scheduledWorkout, workoutTemplate } from '../domain/fixtures';
import { installFakeIndexedDb } from '../storage/fake-indexeddb.helpers';

describe('BackupService (fake-indexeddb)', () => {
  let backups: BackupService;
  let workouts: ScheduledWorkoutRepository;

  beforeEach(async () => {
    installFakeIndexedDb();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    backups = TestBed.inject(BackupService);
    workouts = TestBed.inject(ScheduledWorkoutRepository);

    await TestBed.inject(AppSettingsRepository).createDefaultSettings();
    await TestBed.inject(AthleteProfileRepository).createDefaultProfile();
    await TestBed.inject(TrainingZoneSetRepository).save(heartRateZoneSet());
    await TestBed.inject(WorkoutTemplateRepository).create(workoutTemplate());
    await workouts.create(scheduledWorkout({ id: 'ride', scheduledDate: '2026-09-28' }));
    await workouts.create(scheduledWorkout({ id: 'run', sport: 'running', modality: 'trail' }));
  });

  describe('createBackupFile', () => {
    it('exports every store with the schema version and a dated file name', async () => {
      const file = await backups.createBackupFile(new Date('2026-09-27T15:00:00'));
      const backup = JSON.parse(file.content);

      expect(file.fileName).toBe('my-fitness-planner-backup-2026-09-27.json');
      expect(file.mimeType).toBe('application/json');
      expect(backup.schemaVersion).toBe(INDEXED_DB_VERSION);
      expect(typeof backup.exportedAt).toBe('string');
      expect(Object.keys(backup.stores).sort()).toEqual(Object.values(IndexedDbStore).sort());
      expect(backup.stores[IndexedDbStore.ScheduledWorkouts]).toHaveLength(2);
      expect(backup.stores[IndexedDbStore.WorkoutTemplates]).toHaveLength(1);
      expect(backup.stores[IndexedDbStore.TrainingZoneSets]).toHaveLength(1);
      expect(backup.stores[IndexedDbStore.AthleteProfiles]).toHaveLength(1);
      expect(backup.stores[IndexedDbStore.AppSettings]).toHaveLength(1);
    });
  });

  describe('importBackup', () => {
    it('restores exactly the exported data after the database changed', async () => {
      const file = await backups.createBackupFile();
      await workouts.delete('ride');
      await workouts.create(scheduledWorkout({ id: 'extra', scheduledDate: '2026-10-10' }));

      const summary = await backups.importBackup(file.content);

      const restored = await workouts.findByDateRange('2026-01-01', '2026-12-31');
      expect(restored.map((workout) => workout.id).sort()).toEqual(['ride', 'run']);
      expect(summary).toEqual({
        scheduledWorkouts: 2,
        workoutTemplates: 1,
        trainingZoneSets: 1,
        athleteProfiles: 1,
      });
    });

    it('rejects content that is not JSON', async () => {
      const result = backups.importBackup('no es json');

      await expect(result).rejects.toBeInstanceOf(BackupImportError);
      await expect(result).rejects.toThrow('El archivo no es un JSON válido.');
    });

    it('rejects a backup from another schema version with a clear message', async () => {
      const file = await backups.createBackupFile();
      const oldBackup = { ...JSON.parse(file.content), schemaVersion: 1 };

      await expect(backups.importBackup(JSON.stringify(oldBackup))).rejects.toThrow(
        'El respaldo es de la versión 1 y esta aplicación solo acepta las versiones 2 y 3.',
      );
    });

    it('imports a version 2 backup whose settings have no theme', async () => {
      const file = await backups.createBackupFile();
      const backup = JSON.parse(file.content);
      backup.schemaVersion = 2;
      delete backup.stores[IndexedDbStore.AppSettings][0].theme;

      await backups.importBackup(JSON.stringify(backup));

      await expect(TestBed.inject(AppSettingsRepository).getSettings()).resolves.toMatchObject({
        theme: 'system',
      });
    });

    it('keeps the theme through export and import', async () => {
      const settings = TestBed.inject(AppSettingsRepository);
      await settings.update({ ...(await settings.getSettings()), theme: 'dark' });
      const file = await backups.createBackupFile();
      await settings.update({ ...(await settings.getSettings()), theme: 'light' });

      await backups.importBackup(file.content);

      await expect(settings.getSettings()).resolves.toMatchObject({ theme: 'dark' });
    });

    it('rejects a JSON that is not a backup', async () => {
      await expect(backups.importBackup(JSON.stringify({ hello: 'world' }))).rejects.toThrow(
        'El archivo no es un respaldo de MyFitnessPlanner.',
      );
    });

    it('rejects invalid records with the Spanish validation message and keeps current data', async () => {
      const file = await backups.createBackupFile();
      const backup = JSON.parse(file.content);
      backup.stores[IndexedDbStore.ScheduledWorkouts][0].title = '';

      await expect(backups.importBackup(JSON.stringify(backup))).rejects.toThrow(
        /El título del entrenamiento es requerido/,
      );
      await expect(workouts.findById('ride')).resolves.not.toBeNull();
    });

    it('is atomic: a failing write leaves the previous data untouched', async () => {
      const file = await backups.createBackupFile();
      const backup = JSON.parse(file.content);
      const [zoneSet] = backup.stores[IndexedDbStore.TrainingZoneSets];
      // Same sport and metric twice violates the unique index while writing.
      backup.stores[IndexedDbStore.TrainingZoneSets].push({ ...zoneSet, id: 'duplicated-set' });
      backup.stores[IndexedDbStore.ScheduledWorkouts] = [];

      await expect(backups.importBackup(JSON.stringify(backup))).rejects.toThrow(
        'No se pudo importar el respaldo. Tus datos actuales no se modificaron.',
      );

      const current = await workouts.findByDateRange('2026-01-01', '2026-12-31');
      expect(current.map((workout) => workout.id).sort()).toEqual(['ride', 'run']);
    });
  });
});
