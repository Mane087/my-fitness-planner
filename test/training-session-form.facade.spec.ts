import { TestBed } from '@angular/core/testing';

import type { AthleteProfileEntity } from '../src/app/core/domain/schemas/athlete-profile.schema';
import type { ScheduledWorkoutEntity } from '../src/app/core/domain/schemas/scheduled-workout.schema';
import type { TrainingZoneSetEntity } from '../src/app/core/domain/schemas/training-zone-set.schema';
import type { IntervalStep } from '../src/app/core/domain/schemas/workout-step.schema';
import {
  IntensityMetric,
  Sport,
  StepPhase,
  WorkoutCategory,
} from '../src/app/core/domain/workout.enums';
import {
  BlockTargetType,
  type TrainingSessionFormValue,
  type WorkoutBlockFormValue,
} from '../src/app/core/interfaces/training-session-form.model';
import { AthleteProfileRepository } from '../src/app/core/repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../src/app/core/repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../src/app/core/repositories/training-zone-set.repository';
import { TrainingSessionFormFacade } from '../src/app/pages/training-session-form-page/training-session-form.facade';
import { heartRateZoneSet, repeat, scheduledWorkout } from './domain/fixtures';

describe('TrainingSessionFormFacade', () => {
  let facade: TrainingSessionFormFacade;
  let workoutRepo: jest.Mocked<Pick<ScheduledWorkoutRepository, 'findById' | 'create' | 'update'>>;
  let zoneSetRepo: jest.Mocked<Pick<TrainingZoneSetRepository, 'findAll'>>;
  let profileRepo: jest.Mocked<Pick<AthleteProfileRepository, 'getActiveProfile'>>;

  const mockZoneSets: TrainingZoneSetEntity[] = [heartRateZoneSet()];

  beforeEach(() => {
    workoutRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    zoneSetRepo = { findAll: jest.fn() };
    profileRepo = { getActiveProfile: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        TrainingSessionFormFacade,
        { provide: ScheduledWorkoutRepository, useValue: workoutRepo },
        { provide: TrainingZoneSetRepository, useValue: zoneSetRepo },
        { provide: AthleteProfileRepository, useValue: profileRepo },
      ],
    });

    facade = TestBed.inject(TrainingSessionFormFacade);
  });

  function buildBlock(overrides: Partial<WorkoutBlockFormValue> = {}): WorkoutBlockFormValue {
    return {
      id: 'b1',
      name: 'Bloque de prueba',
      phase: StepPhase.Active,
      targetType: BlockTargetType.Time,
      durationMinutes: 30,
      distanceKm: null,
      trainingZoneId: null,
      targetRpe: null,
      cadenceMin: null,
      cadenceMax: null,
      instructions: '',
      sortOrder: 1,
      ...overrides,
    };
  }

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
      const blocks = [
        buildBlock({ id: 'b1', name: 'Calentamiento', durationMinutes: 10, distanceKm: 2 }),
        buildBlock({
          id: 'b2',
          name: 'Intervalos',
          durationMinutes: 30,
          distanceKm: 8,
          targetType: BlockTargetType.Distance,
          sortOrder: 2,
        }),
      ];

      const result = facade.calculateTotals(blocks);

      expect(result).toEqual({ durationMinutes: 40, distanceKm: 10, blockCount: 2 });
    });

    it('retorna distanceKm null cuando ningún bloque tiene distancia positiva', () => {
      const blocks = [buildBlock({ durationMinutes: 20, distanceKm: null })];

      const result = facade.calculateTotals(blocks);

      expect(result.distanceKm).toBeNull();
    });

    it('ignora bloques con distanceKm === 0 en el cómputo de distancia total', () => {
      const blocks = [
        buildBlock({ id: 'b1', durationMinutes: 15, distanceKm: 0 }),
        buildBlock({
          id: 'b2',
          durationMinutes: 25,
          distanceKm: null,
          targetType: BlockTargetType.Distance,
          sortOrder: 2,
        }),
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
      sport: Sport.Cycling,
      modality: 'road',
      category: WorkoutCategory.Endurance,
      primaryMetric: IntensityMetric.HeartRate,
      plannedDistanceKm: null,
      objective: '',
      description: '',
      notes: '',
      blocks: [],
    };

    it('retorna error si no hay bloques', () => {
      const errors = facade.validate(validValue, mockZoneSets);

      expect(errors).toContain('Agrega al menos un bloque de entrenamiento.');
    });

    it('retorna error si el título está vacío o solo espacios', () => {
      const errors = facade.validate({ ...validValue, title: '   ' }, mockZoneSets);

      expect(errors).toContain('El título del entrenamiento es requerido.');
    });

    it('retorna error si la fecha está vacía', () => {
      const errors = facade.validate({ ...validValue, scheduledDate: '' }, mockZoneSets);

      expect(errors).toContain('La fecha es requerida.');
    });

    it('retorna error si sport es null', () => {
      const errors = facade.validate({ ...validValue, sport: null }, mockZoneSets);

      expect(errors).toContain('Selecciona un deporte.');
    });

    it('retorna error si category es null', () => {
      const errors = facade.validate({ ...validValue, category: null }, mockZoneSets);

      expect(errors).toContain('Selecciona la categoría del entrenamiento.');
    });

    it('retorna error si primaryMetric es null', () => {
      const errors = facade.validate({ ...validValue, primaryMetric: null }, mockZoneSets);

      expect(errors).toContain('Selecciona la métrica de intensidad.');
    });

    it('valida que el bloque tenga nombre', () => {
      const blocks = [buildBlock({ name: '   ', trainingZoneId: 'z2' })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: El nombre del bloque es requerido.');
    });

    it('valida duración requerida en bloque de tiempo', () => {
      const blocks = [buildBlock({ durationMinutes: null, trainingZoneId: 'z2' })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: La duración del bloque es requerida.');
    });

    it('valida que la duración del bloque de tiempo sea mayor que cero', () => {
      const blocks = [buildBlock({ durationMinutes: 0, trainingZoneId: 'z2' })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: La duración debe ser mayor que cero.');
    });

    it('valida distancia requerida cuando targetType es Distance', () => {
      const blocks = [
        buildBlock({
          targetType: BlockTargetType.Distance,
          distanceKm: null,
          trainingZoneId: 'z2',
        }),
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: La distancia del bloque es requerida.');
    });

    it('valida que la distancia del bloque sea mayor que cero', () => {
      const blocks = [
        buildBlock({ targetType: BlockTargetType.Distance, distanceKm: 0, trainingZoneId: 'z2' }),
      ];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: La distancia debe ser mayor que cero.');
    });

    it('valida RPE entre 1 y 10', () => {
      const blocks = [buildBlock({ targetRpe: 15, trainingZoneId: 'z2' })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: El RPE debe estar entre 1 y 10.');
    });

    it('valida cadencia positiva', () => {
      const blocks = [buildBlock({ cadenceMin: -5, trainingZoneId: 'z2' })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: La cadencia debe ser positiva.');
    });

    it('valida que cadencia mínima no supere la máxima', () => {
      const blocks = [buildBlock({ cadenceMin: 100, cadenceMax: 80, trainingZoneId: 'z2' })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: La cadencia mínima no puede ser mayor que la máxima.');
    });

    it('valida zona requerida cuando la métrica es heart_rate', () => {
      const blocks = [buildBlock({ trainingZoneId: null })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: Selecciona una zona de entrenamiento.');
    });

    it('valida que la zona seleccionada exista en el set correspondiente', () => {
      const blocks = [buildBlock({ trainingZoneId: 'zona-inexistente' })];

      const errors = facade.validate({ ...validValue, blocks }, mockZoneSets);

      expect(errors).toContain('Bloque 1: Selecciona una zona de entrenamiento.');
    });

    it('valida RPE requerido para métrica Rpe', () => {
      const blocks = [buildBlock({ targetRpe: null })];

      const errors = facade.validate(
        { ...validValue, primaryMetric: IntensityMetric.Rpe, blocks },
        mockZoneSets,
      );

      expect(errors).toContain('Bloque 1: Define un RPE objetivo.');
    });

    it('valida que exista un set de zonas configurado para la métrica', () => {
      const blocks = [buildBlock({ trainingZoneId: 'z2' })];

      const errors = facade.validate({ ...validValue, blocks }, []);

      expect(errors).toContain('Configura tus zonas de frecuencia cardiaca antes de usarlas.');
    });

    it('valida que la métrica aplique al deporte seleccionado', () => {
      const blocks = [buildBlock({ trainingZoneId: 'z2' })];

      const errors = facade.validate(
        { ...validValue, primaryMetric: IntensityMetric.Pace, blocks },
        mockZoneSets,
      );

      expect(errors).toContain('Ritmo no aplica para Ciclismo.');
    });

    it('retorna errores sin duplicados', () => {
      const errors = facade.validate({ ...validValue, title: '', sport: null }, mockZoneSets);

      const unique = new Set(errors);
      expect(errors.length).toBe(unique.size);
    });
  });

  /* ───────── loadCreateForm ───────── */

  describe('loadCreateForm', () => {
    it('usa las preferencias del perfil como valores por defecto', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(buildProfile());
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);

      const state = await facade.loadCreateForm('2026-07-25');

      expect(state.mode).toBe('create');
      expect(state.selectedDate).toBe('2026-07-25');
      expect(state.profileAvailable).toBe(true);
      expect(state.zoneSets).toEqual(mockZoneSets);
      expect(state.formValue.title).toBe('');
      expect(state.formValue.scheduledDate).toBe('2026-07-25');
      expect(state.formValue.sport).toBe(Sport.Running);
      expect(state.formValue.modality).toBe('road');
      expect(state.formValue.category).toBe(WorkoutCategory.Endurance);
      expect(state.formValue.primaryMetric).toBe(IntensityMetric.Pace);
      expect(state.formValue.blocks).toEqual([]);
    });

    it('usa la primera categoría disponible cuando el deporte no admite endurance', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(
        buildProfile({
          preferredSport: Sport.Mobility,
          preferredIntensityMetric: IntensityMetric.HeartRate,
        }),
      );
      zoneSetRepo.findAll.mockResolvedValue([]);

      const state = await facade.loadCreateForm('2026-07-25');

      expect(state.formValue.sport).toBe(Sport.Mobility);
      expect(state.formValue.modality).toBeNull();
      expect(state.formValue.category).toBe(WorkoutCategory.Mobility);
      expect(state.formValue.primaryMetric).toBe(IntensityMetric.Rpe);
    });

    it('retorna profileAvailable false y deporte por defecto cuando no hay perfil', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);

      const state = await facade.loadCreateForm('2026-07-25');

      expect(state.profileAvailable).toBe(false);
      expect(state.formValue.sport).toBe(Sport.Cycling);
      expect(state.formValue.category).toBe(WorkoutCategory.Endurance);
      expect(state.formValue.primaryMetric).toBe(IntensityMetric.HeartRate);
    });
  });

  /* ───────── loadEditForm ───────── */

  describe('loadEditForm', () => {
    it('mapea los pasos de intervalo a bloques del formulario', async () => {
      const steps: IntervalStep[] = [
        {
          id: 'warm-up',
          kind: 'interval',
          name: 'Calentamiento',
          phase: StepPhase.WarmUp,
          duration: { type: 'time', seconds: 900 },
        },
        {
          id: 'active-hr',
          kind: 'interval',
          name: 'Trabajo en zona',
          phase: StepPhase.Active,
          duration: { type: 'time', seconds: 1800 },
          target: {
            metric: 'heart_rate',
            zoneId: 'z2',
            zoneSnapshot: {
              zoneSetId: 'zone-set-hr',
              zoneId: 'z2',
              name: 'Z2',
              metric: 'heart_rate',
              minValue: 116,
              maxValue: 135,
            },
          },
          cadenceRpm: { min: 80, max: 90 },
          notes: 'Mantén cadencia alta',
        },
        {
          id: 'active-distance',
          kind: 'interval',
          name: 'Tramo largo',
          phase: StepPhase.Active,
          duration: { type: 'distance', meters: 5000 },
          target: { metric: 'rpe', value: 6 },
        },
      ];
      const mockWorkout: ScheduledWorkoutEntity = {
        id: 'w-1',
        title: 'Entreno editado',
        scheduledDate: '2026-07-26',
        sport: Sport.Cycling,
        modality: 'road',
        category: WorkoutCategory.Tempo,
        primaryMetric: IntensityMetric.HeartRate,
        steps,
        plannedDurationSeconds: 2700,
        status: 'planned',
        createdAt: '2026-07-25T12:00:00.000Z',
        updatedAt: '2026-07-25T12:00:00.000Z',
      };

      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);
      workoutRepo.findById.mockResolvedValue(mockWorkout);

      const state = await facade.loadEditForm('w-1');

      expect(state.mode).toBe('edit');
      expect(state.selectedDate).toBe('2026-07-26');
      expect(state.formValue.title).toBe('Entreno editado');
      expect(state.formValue.sport).toBe(Sport.Cycling);
      expect(state.formValue.blocks.length).toBe(3);

      const [warmUp, activeHr, activeDistance] = state.formValue.blocks;

      expect(warmUp.durationMinutes).toBe(15);
      expect(warmUp.distanceKm).toBeNull();
      expect(warmUp.trainingZoneId).toBeNull();
      expect(warmUp.instructions).toBe('');

      expect(activeHr.durationMinutes).toBe(30);
      expect(activeHr.trainingZoneId).toBe('z2');
      expect(activeHr.cadenceMin).toBe(80);
      expect(activeHr.cadenceMax).toBe(90);
      expect(activeHr.instructions).toBe('Mantén cadencia alta');

      expect(activeDistance.targetType).toBe(BlockTargetType.Distance);
      expect(activeDistance.distanceKm).toBe(5);
      // Not the single block of the workout, so no duration estimate is carried over.
      expect(activeDistance.durationMinutes).toBeNull();
      expect(activeDistance.targetRpe).toBe(6);
    });

    it('lanza error si el workout no existe', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);
      workoutRepo.findById.mockResolvedValue(null);

      await expect(facade.loadEditForm('unknown')).rejects.toThrow('El entrenamiento no existe.');
    });

    it('lanza error si el entrenamiento tiene repeticiones o ejercicios', async () => {
      const workoutWithRepeat = scheduledWorkout({ id: 'w-repeat', steps: [repeat('main')] });

      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);
      workoutRepo.findById.mockResolvedValue(workoutWithRepeat);

      await expect(facade.loadEditForm('w-repeat')).rejects.toThrow(
        'Este entrenamiento tiene repeticiones o ejercicios que este formulario todavía no puede editar.',
      );
    });
  });

  /* ───────── save ───────── */

  describe('save', () => {
    it('lanza error si la validación falla', async () => {
      const invalidValue: TrainingSessionFormValue = {
        title: '',
        scheduledDate: '',
        sport: null,
        modality: null,
        category: null,
        primaryMetric: null,
        plannedDistanceKm: null,
        objective: '',
        description: '',
        notes: '',
        blocks: [],
      };

      await expect(facade.save(invalidValue, mockZoneSets)).rejects.toThrow();
    });

    it('crea un nuevo workout con el snapshot de zona copiado del set', async () => {
      const value: TrainingSessionFormValue = {
        title: 'Entrenamiento válido',
        scheduledDate: '2026-07-25',
        sport: Sport.Cycling,
        modality: 'road',
        category: WorkoutCategory.Endurance,
        primaryMetric: IntensityMetric.HeartRate,
        plannedDistanceKm: null,
        objective: 'Test objetivo',
        description: '',
        notes: '',
        blocks: [
          buildBlock({
            name: 'Calentamiento',
            phase: StepPhase.WarmUp,
            durationMinutes: 15,
            trainingZoneId: 'z1',
            instructions: 'Suave',
          }),
        ],
      };

      workoutRepo.findById.mockResolvedValue(null);
      workoutRepo.create.mockImplementation(async (workout: ScheduledWorkoutEntity) => workout);

      const result = await facade.save(value, mockZoneSets);

      expect(result.title).toBe('Entrenamiento válido');
      expect(result.plannedDurationSeconds).toBe(15 * 60);
      expect(result.plannedDistanceMeters).toBeUndefined();
      expect(result.steps.length).toBe(1);

      const [step] = result.steps as IntervalStep[];
      expect(step.target).toEqual({
        metric: 'heart_rate',
        zoneId: 'z1',
        zoneSnapshot: {
          zoneSetId: 'zone-set-hr',
          zoneId: 'z1',
          name: 'Z1',
          metric: 'heart_rate',
          minValue: 97,
          maxValue: 116,
        },
      });
      expect(workoutRepo.create).toHaveBeenCalledTimes(1);
      expect(workoutRepo.update).not.toHaveBeenCalled();
    });

    it('actualiza un workout existente conservando id, createdAt, status, completion y sourceTemplateId', async () => {
      const value: TrainingSessionFormValue = {
        id: 'existing-1',
        title: 'Actualizado',
        scheduledDate: '2026-07-25',
        sport: Sport.Cycling,
        modality: 'road',
        category: WorkoutCategory.Endurance,
        primaryMetric: IntensityMetric.HeartRate,
        plannedDistanceKm: null,
        objective: '',
        description: '',
        notes: '',
        blocks: [buildBlock({ name: 'Bloque único', durationMinutes: 30, trainingZoneId: 'z1' })],
      };

      const existingWorkout = scheduledWorkout({
        id: 'existing-1',
        title: 'Original',
        modality: 'road',
        status: 'completed',
        completion: { completedAt: '2026-07-25T12:00:00.000Z', durationSeconds: 1800 },
        sourceTemplateId: 'template-99',
        createdAt: '2026-07-24T10:00:00.000Z',
        updatedAt: '2026-07-24T10:00:00.000Z',
      });

      workoutRepo.findById.mockResolvedValue(existingWorkout);
      workoutRepo.update.mockImplementation(async (workout: ScheduledWorkoutEntity) => workout);

      const result = await facade.save(value, mockZoneSets);

      expect(result.title).toBe('Actualizado');
      expect(result.id).toBe('existing-1');
      expect(result.createdAt).toBe('2026-07-24T10:00:00.000Z');
      expect(result.status).toBe('completed');
      expect(result.completion).toEqual(existingWorkout.completion);
      expect(result.sourceTemplateId).toBe('template-99');
      expect(workoutRepo.update).toHaveBeenCalledTimes(1);
      expect(workoutRepo.create).not.toHaveBeenCalled();
    });
  });
});

function buildProfile(overrides: Partial<AthleteProfileEntity> = {}): AthleteProfileEntity {
  return {
    id: 'p1',
    name: 'Deportista',
    maxHeartRate: 190,
    preferredSport: Sport.Running,
    preferredIntensityMetric: IntensityMetric.Pace,
    weekStartsOn: 'monday',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
