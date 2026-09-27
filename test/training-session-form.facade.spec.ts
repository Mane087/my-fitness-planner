import { TestBed } from '@angular/core/testing';

import {
  IntensityMetric,
  WorkoutDiscipline,
  WorkoutType,
} from '../src/app/core/domain/workout.enums';
import {
  WorkoutBlockTargetType,
  WorkoutBlockType,
} from '../src/app/core/domain/workout-block.model';
import type { TrainingZoneEntity } from '../src/app/core/domain/training-zone.model';
import type { ScheduledWorkoutEntity } from '../src/app/core/domain/scheduled-workout.model';
import { ScheduledWorkoutRepository } from '../src/app/core/repositories/scheduled-workout.repository';
import { SportProfileRepository } from '../src/app/core/repositories/sport-profile.repository';
import { TrainingZoneRepository } from '../src/app/core/repositories/training-zone.repository';
import type {
  TrainingSessionFormValue,
  WorkoutBlockFormValue,
} from '../src/app/core/interfaces/training-session-form.model';
import { TrainingSessionFormFacade } from '../src/app/pages/training-session-form-page/training-session-form.facade';

describe('TrainingSessionFormFacade', () => {
  let facade: TrainingSessionFormFacade;
  let workoutRepo: jest.Mocked<Pick<ScheduledWorkoutRepository, 'findById' | 'create' | 'update'>>;
  let zoneRepo: jest.Mocked<Pick<TrainingZoneRepository, 'findAll'>>;
  let profileRepo: jest.Mocked<Pick<SportProfileRepository, 'getActiveProfile'>>;

  const mockZones: TrainingZoneEntity[] = [
    {
      id: 'zone-1',
      name: 'Z1 Recovery',
      minHeartRate: 96,
      maxHeartRate: 115,
      sortOrder: 1,
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'zone-2',
      name: 'Z2 Endurance',
      minHeartRate: 116,
      maxHeartRate: 135,
      sortOrder: 2,
      isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    workoutRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    zoneRepo = { findAll: jest.fn() };
    profileRepo = { getActiveProfile: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        TrainingSessionFormFacade,
        { provide: ScheduledWorkoutRepository, useValue: workoutRepo },
        { provide: TrainingZoneRepository, useValue: zoneRepo },
        { provide: SportProfileRepository, useValue: profileRepo },
      ],
    });

    facade = TestBed.inject(TrainingSessionFormFacade);
  });

  /* ───────── calculateTotals ───────── */

  describe('calculateTotals', () => {
    it('retorna ceros cuando el array está vacío', () => {
      const result = facade.calculateTotals([]);

      expect(result).toEqual({
        durationMinutes: 0,
        distanceKm: null,
        blockCount: 0,
      });
    });

    it('suma duración y distancia de los bloques', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Calentamiento',
          blockType: WorkoutBlockType.WarmUp,
          durationMinutes: 10,
          distanceKm: 2,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
        {
          id: 'b2',
          name: 'Intervalos',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: 8,
          targetType: WorkoutBlockTargetType.Distance,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 2,
        },
      ];

      const result = facade.calculateTotals(blocks);

      expect(result).toEqual({ durationMinutes: 40, distanceKm: 10, blockCount: 2 });
    });

    it('retorna distanceKm null cuando ningún bloque tiene distancia positiva', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Bloque sin distancia',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 20,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const result = facade.calculateTotals(blocks);

      expect(result.distanceKm).toBeNull();
    });

    it('ignora bloques con distanceKm === 0 en el cómputo de distancia total', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Recovery',
          blockType: WorkoutBlockType.Recovery,
          durationMinutes: 15,
          distanceKm: 0,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
        {
          id: 'b2',
          name: 'Trabajo',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 25,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Distance,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 2,
        },
      ];

      const result = facade.calculateTotals(blocks);

      expect(result.distanceKm).toBeNull();
    });
  });

  /* ───────── validate ───────── */

  describe('validate', () => {
    const validValue: TrainingSessionFormValue = {
      title: 'Entrenamiento de prueba',
      scheduledDate: '2026-07-25',
      discipline: WorkoutDiscipline.Road,
      workoutType: WorkoutType.Endurance,
      intensityMetric: IntensityMetric.HeartRate,
      plannedDistanceKm: null,
      objective: '',
      description: '',
      notes: '',
      blocks: [],
    };

    it('retorna error si no hay bloques', () => {
      const errors = facade.validate(validValue, mockZones);

      expect(errors).toContain('Agrega al menos un bloque de entrenamiento.');
    });

    it('retorna error si el título está vacío o solo espacios', () => {
      const errors = facade.validate({ ...validValue, title: '   ' }, mockZones);

      expect(errors).toContain('El título del entrenamiento es requerido.');
    });

    it('retorna error si la fecha está vacía', () => {
      const errors = facade.validate({ ...validValue, scheduledDate: '' }, mockZones);

      expect(errors).toContain('La fecha es requerida.');
    });

    it('retorna error si discipline es null', () => {
      const errors = facade.validate({ ...validValue, discipline: null }, mockZones);

      expect(errors).toContain('Selecciona una disciplina.');
    });

    it('retorna error si workoutType es null', () => {
      const errors = facade.validate({ ...validValue, workoutType: null }, mockZones);

      expect(errors).toContain('Selecciona el tipo de entrenamiento.');
    });

    it('retorna error si intensityMetric es null', () => {
      const errors = facade.validate({ ...validValue, intensityMetric: null }, mockZones);

      expect(errors).toContain('Selecciona la métrica de intensidad.');
    });

    it('valida que el bloque tenga nombre', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: '   ',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: El nombre del bloque es requerido.');
    });

    it('valida duración requerida del bloque', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: null,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: La duración del bloque es requerida.');
    });

    it('valida que la duración del bloque sea requerida cuando es 0', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 0,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: La duración del bloque es requerida.');
    });

    it('valida distancia requerida cuando targetType es Distance', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Distance,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: La distancia del bloque es requerida.');
    });

    it('valida que la distancia del bloque sea positiva', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: 0,
          targetType: WorkoutBlockTargetType.Distance,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: La distancia debe ser mayor que cero.');
    });

    it('valida RPE entre 1 y 10', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: 15,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: El RPE debe estar entre 1 y 10.');
    });

    it('valida cadencia positiva', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: -5,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: La cadencia debe ser positiva.');
    });

    it('valida que cadencia mínima no supere la máxima', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: 100,
          cadenceMax: 80,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors).toContain('Bloque 1: La cadencia mínima no puede ser mayor que la máxima.');
    });

    it('no valida cadencia si solo un valor está presente', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: 80,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZones);

      expect(errors.filter((e) => e.includes('cadencia'))).toEqual([]);
    });

    it('valida zona requerida para HeartRate', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate(
        { ...validValue, intensityMetric: IntensityMetric.HeartRate, blocks },
        mockZones,
      );

      expect(errors).toContain('Bloque 1: Selecciona una zona de entrenamiento.');
    });

    it('valida RPE requerido para métrica Rpe', () => {
      const blocks: WorkoutBlockFormValue[] = [
        {
          id: 'b1',
          name: 'Test',
          blockType: WorkoutBlockType.Active,
          durationMinutes: 30,
          distanceKm: null,
          targetType: WorkoutBlockTargetType.Time,
          trainingZoneId: null,
          trainingZoneSnapshot: null,
          targetRpe: null,
          cadenceMin: null,
          cadenceMax: null,
          instructions: '',
          sortOrder: 1,
        },
      ];

      const errors = facade.validate(
        { ...validValue, intensityMetric: IntensityMetric.Rpe, blocks },
        mockZones,
      );

      expect(errors).toContain('Bloque 1: Define un RPE objetivo.');
    });

    it('retorna errores sin duplicados', () => {
      const errors = facade.validate({ ...validValue, title: '', discipline: null }, mockZones);

      const unique = new Set(errors);
      expect(errors.length).toBe(unique.size);
    });
  });

  /* ───────── loadCreateForm ───────── */

  describe('loadCreateForm', () => {
    it('carga perfil y zonas y retorna estado create', async () => {
      profileRepo.getActiveProfile.mockResolvedValue({
        id: 'p1',
        name: 'Deportista',
        maxHeartRate: 190,
        preferredDiscipline: 'mixed' as const,
        preferredIntensityMetric: 'heart_rate' as const,
        weekStartsOn: 'monday' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      zoneRepo.findAll.mockResolvedValue(mockZones);

      const state = await facade.loadCreateForm('2026-07-25');

      expect(state.mode).toBe('create');
      expect(state.selectedDate).toBe('2026-07-25');
      expect(state.profileAvailable).toBe(true);
      expect(state.zones).toEqual(mockZones);
      expect(state.formValue.title).toBe('');
      expect(state.formValue.scheduledDate).toBe('2026-07-25');
      expect(state.formValue.discipline).toBe(WorkoutDiscipline.Road);
      expect(state.formValue.workoutType).toBe(WorkoutType.Endurance);
      expect(state.formValue.intensityMetric).toBe(IntensityMetric.HeartRate);
      expect(state.formValue.blocks).toEqual([]);
    });

    it('retorna profileAvailable false cuando no hay perfil', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneRepo.findAll.mockResolvedValue(mockZones);

      const state = await facade.loadCreateForm('2026-07-25');

      expect(state.profileAvailable).toBe(false);
      expect(state.formValue.discipline).toBeNull();
    });
  });

  /* ───────── loadEditForm ───────── */

  describe('loadEditForm', () => {
    it('carga workout, perfil y zonas, y retorna estado edit', async () => {
      const mockWorkout: ScheduledWorkoutEntity = {
        id: 'w-1',
        title: 'Entreno editado',
        scheduledDate: '2026-07-26',
        discipline: WorkoutDiscipline.Mtb,
        workoutType: WorkoutType.Tempo,
        intensityMetric: IntensityMetric.Rpe,
        estimatedDurationMinutes: 60,
        status: 'planned' as const,
        blocks: [
          {
            id: 'b1',
            name: 'Calentamiento',
            blockType: WorkoutBlockType.WarmUp,
            targetType: WorkoutBlockTargetType.Time,
            durationMinutes: 15,
            sortOrder: 1,
          },
          {
            id: 'b2',
            name: 'Trabajo',
            blockType: WorkoutBlockType.Active,
            targetType: WorkoutBlockTargetType.Time,
            durationMinutes: 45,
            targetRpe: 7,
            sortOrder: 2,
          },
        ],
        createdAt: '2026-07-25T12:00:00.000Z',
        updatedAt: '2026-07-25T12:00:00.000Z',
      };

      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneRepo.findAll.mockResolvedValue(mockZones);
      workoutRepo.findById.mockResolvedValue(mockWorkout);

      const state = await facade.loadEditForm('w-1');

      expect(state.mode).toBe('edit');
      expect(state.selectedDate).toBe('2026-07-26');
      expect(state.formValue.title).toBe('Entreno editado');
      expect(state.formValue.discipline).toBe(WorkoutDiscipline.Mtb);
      expect(state.formValue.blocks.length).toBe(2);
      expect(state.formValue.blocks[1].targetRpe).toBe(7);
    });

    it('lanza error si el workout no existe', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneRepo.findAll.mockResolvedValue(mockZones);
      workoutRepo.findById.mockResolvedValue(null);

      await expect(facade.loadEditForm('unknown')).rejects.toThrow('El entrenamiento no existe.');
    });
  });

  /* ───────── save ───────── */

  describe('save', () => {
    it('lanza error si la validación falla', async () => {
      const invalidValue: TrainingSessionFormValue = {
        title: '',
        scheduledDate: '',
        discipline: null,
        workoutType: null,
        intensityMetric: null,
        plannedDistanceKm: null,
        objective: '',
        description: '',
        notes: '',
        blocks: [],
      };

      await expect(facade.save(invalidValue, mockZones)).rejects.toThrow();
    });

    it('crea un nuevo workout cuando el formulario es válido', async () => {
      const value: TrainingSessionFormValue = {
        title: 'Entrenamiento válido',
        scheduledDate: '2026-07-25',
        discipline: WorkoutDiscipline.Road,
        workoutType: WorkoutType.Endurance,
        intensityMetric: IntensityMetric.HeartRate,
        plannedDistanceKm: null,
        objective: 'Test objetivo',
        description: '',
        notes: '',
        blocks: [
          {
            id: 'b1',
            name: 'Calentamiento',
            blockType: WorkoutBlockType.WarmUp,
            durationMinutes: 15,
            distanceKm: null,
            targetType: WorkoutBlockTargetType.Time,
            trainingZoneId: 'zone-1',
            trainingZoneSnapshot: null,
            targetRpe: null,
            cadenceMin: null,
            cadenceMax: null,
            instructions: 'Suave',
            sortOrder: 1,
          },
        ],
      };

      workoutRepo.findById.mockResolvedValue(null);
      workoutRepo.create.mockImplementation(async (workout: ScheduledWorkoutEntity) => workout);

      const result = await facade.save(value, mockZones);

      expect(result.title).toBe('Entrenamiento válido');
      expect(result.estimatedDurationMinutes).toBe(15);
      expect(result.blocks.length).toBe(1);
      expect(workoutRepo.create).toHaveBeenCalledTimes(1);
      expect(workoutRepo.update).not.toHaveBeenCalled();
    });

    it('actualiza un workout existente cuando tiene id', async () => {
      const value: TrainingSessionFormValue = {
        id: 'existing-1',
        title: 'Actualizado',
        scheduledDate: '2026-07-25',
        discipline: WorkoutDiscipline.Road,
        workoutType: WorkoutType.Endurance,
        intensityMetric: IntensityMetric.HeartRate,
        plannedDistanceKm: null,
        objective: '',
        description: '',
        notes: '',
        blocks: [
          {
            id: 'b1',
            name: 'Bloque único',
            blockType: WorkoutBlockType.Active,
            durationMinutes: 30,
            distanceKm: null,
            targetType: WorkoutBlockTargetType.Time,
            trainingZoneId: 'zone-1',
            trainingZoneSnapshot: null,
            targetRpe: null,
            cadenceMin: null,
            cadenceMax: null,
            instructions: '',
            sortOrder: 1,
          },
        ],
      };

      const existingWorkout: ScheduledWorkoutEntity = {
        id: 'existing-1',
        title: 'Original',
        scheduledDate: '2026-07-25',
        discipline: WorkoutDiscipline.Road,
        workoutType: WorkoutType.Endurance,
        intensityMetric: IntensityMetric.HeartRate,
        estimatedDurationMinutes: 30,
        status: 'planned' as const,
        blocks: [],
        createdAt: '2026-07-24T10:00:00.000Z',
        updatedAt: '2026-07-24T10:00:00.000Z',
      };

      workoutRepo.findById.mockResolvedValue(existingWorkout);
      workoutRepo.update.mockImplementation(async (workout: ScheduledWorkoutEntity) => workout);

      const result = await facade.save(value, mockZones);

      expect(result.title).toBe('Actualizado');
      expect(workoutRepo.update).toHaveBeenCalledTimes(1);
      expect(workoutRepo.create).not.toHaveBeenCalled();
    });
  });
});
