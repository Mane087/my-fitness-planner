import { TestBed } from '@angular/core/testing';

import type { AthleteProfileEntity } from '../src/app/core/domain/schemas/athlete-profile.schema';
import type { ScheduledWorkoutEntity } from '../src/app/core/domain/schemas/scheduled-workout.schema';
import type { TrainingZoneSetEntity } from '../src/app/core/domain/schemas/training-zone-set.schema';
import type { WorkoutTemplateEntity } from '../src/app/core/domain/schemas/workout-template.schema';
import { IntensityMetric, Sport, WorkoutCategory } from '../src/app/core/domain/workout.enums';
import type { TrainingSessionFormValue } from '../src/app/core/models/training-session-form.model';
import { AthleteProfileRepository } from '../src/app/core/repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../src/app/core/repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../src/app/core/repositories/training-zone-set.repository';
import { WorkoutTemplateRepository } from '../src/app/core/repositories/workout-template.repository';
import { TrainingSessionFormFacade } from '../src/app/pages/training-session-form-page/training-session-form.facade';
import {
  cyclingDefinition,
  exercise,
  heartRateZoneSet,
  interval,
  repeat,
  scheduledWorkout,
  workoutTemplate,
} from './domain/fixtures';

describe('TrainingSessionFormFacade', () => {
  let facade: TrainingSessionFormFacade;
  let workoutRepo: jest.Mocked<Pick<ScheduledWorkoutRepository, 'findById' | 'create' | 'update'>>;
  let zoneSetRepo: jest.Mocked<Pick<TrainingZoneSetRepository, 'findAll'>>;
  let profileRepo: jest.Mocked<Pick<AthleteProfileRepository, 'getActiveProfile'>>;
  let templateRepo: jest.Mocked<Pick<WorkoutTemplateRepository, 'findById' | 'create' | 'update'>>;

  const mockZoneSets: TrainingZoneSetEntity[] = [heartRateZoneSet()];

  beforeEach(() => {
    workoutRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    zoneSetRepo = { findAll: jest.fn() };
    profileRepo = { getActiveProfile: jest.fn() };
    templateRepo = { findById: jest.fn(), create: jest.fn(), update: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        TrainingSessionFormFacade,
        { provide: ScheduledWorkoutRepository, useValue: workoutRepo },
        { provide: TrainingZoneSetRepository, useValue: zoneSetRepo },
        { provide: AthleteProfileRepository, useValue: profileRepo },
        { provide: WorkoutTemplateRepository, useValue: templateRepo },
      ],
    });

    facade = TestBed.inject(TrainingSessionFormFacade);
  });

  function buildValue(overrides: Partial<TrainingSessionFormValue> = {}): TrainingSessionFormValue {
    return {
      title: 'Entrenamiento de prueba',
      scheduledDate: '2026-07-25',
      sport: Sport.Cycling,
      modality: 'road',
      category: WorkoutCategory.Endurance,
      primaryMetric: IntensityMetric.HeartRate,
      estimatedDurationMinutes: null,
      plannedDistanceKm: null,
      objective: '',
      description: '',
      notes: '',
      steps: cyclingDefinition().steps,
      ...overrides,
    };
  }

  /* ───────── calculateTotals ───────── */

  describe('calculateTotals', () => {
    it('retorna ceros cuando no hay pasos', () => {
      expect(facade.calculateTotals([])).toEqual({
        durationMinutes: 0,
        distanceKm: null,
        stepCount: 0,
        isEstimated: false,
      });
    });

    it('multiplica la duración de las repeticiones', () => {
      // 900 s + 3 × (300 s + 120 s) + 600 s = 2760 s
      const result = facade.calculateTotals(cyclingDefinition().steps);

      expect(result.durationMinutes).toBe(46);
      expect(result.stepCount).toBe(4);
      expect(result.isEstimated).toBe(false);
    });

    it('suma la distancia de los pasos por distancia', () => {
      const steps = [
        interval('warm-up'),
        interval('long', { duration: { type: 'distance', meters: 5000 } }),
      ];

      expect(facade.calculateTotals(steps).distanceKm).toBe(5);
    });

    it('usa la duración estimada cuando es mayor que cero', () => {
      const result = facade.calculateTotals(cyclingDefinition().steps, 60);

      expect(result.durationMinutes).toBe(60);
      expect(result.isEstimated).toBe(true);
    });

    it('ignora una duración estimada de cero', () => {
      const result = facade.calculateTotals(cyclingDefinition().steps, 0);

      expect(result.durationMinutes).toBe(46);
      expect(result.isEstimated).toBe(false);
    });

    it('usa la distancia planificada solo cuando los pasos no tienen distancia', () => {
      const distanceSteps = [interval('long', { duration: { type: 'distance', meters: 5000 } })];

      expect(facade.calculateTotals(cyclingDefinition().steps, null, 30).distanceKm).toBe(30);
      expect(facade.calculateTotals(distanceSteps, null, 30).distanceKm).toBe(5);
    });
  });

  /* ───────── zoneSetFor ───────── */

  describe('zoneSetFor', () => {
    it('retorna el set del deporte y la métrica', () => {
      expect(facade.zoneSetFor(mockZoneSets, Sport.Cycling, IntensityMetric.HeartRate)).toBe(
        mockZoneSets[0],
      );
    });

    it('retorna null para RPE o para una métrica que no aplica al deporte', () => {
      expect(facade.zoneSetFor(mockZoneSets, Sport.Cycling, IntensityMetric.Rpe)).toBeNull();
      expect(facade.zoneSetFor(mockZoneSets, Sport.Cycling, IntensityMetric.Pace)).toBeNull();
    });

    it('retorna null cuando no existe un set para el deporte', () => {
      expect(facade.zoneSetFor(mockZoneSets, Sport.Running, IntensityMetric.HeartRate)).toBeNull();
    });
  });

  /* ───────── validate ───────── */

  describe('validate', () => {
    it('acepta un entrenamiento con repeticiones', () => {
      expect(facade.validate(buildValue(), mockZoneSets)).toEqual([]);
    });

    it('acepta intervalos sin objetivo de intensidad', () => {
      const steps = [interval('free', { target: undefined })];

      expect(facade.validate(buildValue({ steps }), mockZoneSets)).toEqual([]);
    });

    it('retorna error si no hay pasos', () => {
      const errors = facade.validate(buildValue({ steps: [] }), mockZoneSets);

      expect(errors).toContain('Agrega al menos un paso al entrenamiento.');
    });

    it('retorna error si el título está vacío o solo espacios', () => {
      const errors = facade.validate(buildValue({ title: '   ' }), mockZoneSets);

      expect(errors).toContain('El título del entrenamiento es requerido.');
    });

    it('retorna error si la fecha está vacía', () => {
      const errors = facade.validate(buildValue({ scheduledDate: '' }), mockZoneSets);

      expect(errors).toContain('La fecha es requerida.');
    });

    it('retorna error si falta deporte, categoría o métrica', () => {
      const errors = facade.validate(
        buildValue({ sport: null, category: null, primaryMetric: null }),
        mockZoneSets,
      );

      expect(errors).toEqual(
        expect.arrayContaining([
          'Selecciona un deporte.',
          'Selecciona la categoría del entrenamiento.',
          'Selecciona la métrica de intensidad.',
        ]),
      );
    });

    it('retorna error si la duración estimada no es mayor que cero', () => {
      const errors = facade.validate(buildValue({ estimatedDurationMinutes: 0 }), mockZoneSets);

      expect(errors).toContain('La duración estimada debe ser mayor que cero.');
    });

    it('valida que exista un set de zonas configurado para la métrica', () => {
      const errors = facade.validate(buildValue(), []);

      expect(errors).toContain('Configura tus zonas de frecuencia cardiaca antes de usarlas.');
    });

    it('valida que la métrica aplique al deporte seleccionado', () => {
      const errors = facade.validate(
        buildValue({ primaryMetric: IntensityMetric.Pace }),
        mockZoneSets,
      );

      expect(errors).toContain('Ritmo no aplica para Ciclismo.');
    });

    it('indica la posición del paso con error', () => {
      const steps = [interval('first'), interval('second', { name: '   ' })];

      const errors = facade.validate(buildValue({ steps }), mockZoneSets);

      expect(errors).toEqual(['Paso 2: El nombre del paso es requerido.']);
    });

    it('indica la posición del paso dentro de una repetición', () => {
      const steps = [
        repeat('main', {
          steps: [interval('work'), interval('rest', { duration: { type: 'time', seconds: 0 } })],
        }),
      ];

      const errors = facade.validate(buildValue({ steps }), mockZoneSets);

      expect(errors).toEqual(['Paso 1.2: La duración debe ser mayor que cero.']);
    });

    it('valida el número de repeticiones y el contenido del grupo', () => {
      const steps = [repeat('main', { repetitions: 1, steps: [] })];

      const errors = facade.validate(buildValue({ steps }), mockZoneSets);

      expect(errors).toEqual([
        'Paso 1: Una repetición debe ejecutarse al menos 2 veces.',
        'Paso 1: Una repetición debe contener al menos un paso.',
      ]);
    });

    it('valida series y repeticiones de los ejercicios', () => {
      const steps = [exercise('jumps', { sets: 0, reps: 0 })];

      const errors = facade.validate(
        buildValue({
          sport: Sport.Plyometrics,
          modality: null,
          category: WorkoutCategory.Power,
          primaryMetric: IntensityMetric.Rpe,
          steps,
        }),
        mockZoneSets,
      );

      expect(errors).toEqual([
        'Paso 1: Las series deben ser al menos 1.',
        'Paso 1: Las repeticiones deben ser al menos 1.',
      ]);
    });

    it('retorna errores sin duplicados', () => {
      const errors = facade.validate(buildValue({ title: '', sport: null }), mockZoneSets);

      expect(errors.length).toBe(new Set(errors).size);
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
      expect(state.formValue.estimatedDurationMinutes).toBeNull();
      expect(state.formValue.steps).toEqual([]);
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
    beforeEach(() => {
      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);
    });

    it('carga los pasos con repeticiones y ejercicios como copia', async () => {
      const steps = [...cyclingDefinition().steps, exercise('core')];
      const workout = scheduledWorkout({
        id: 'w-1',
        title: 'Entreno editado',
        steps,
        plannedDurationSeconds: 2760 + 4 * (8 * 3 + 90),
      });
      workoutRepo.findById.mockResolvedValue(workout);

      const state = await facade.loadEditForm('w-1');

      expect(state.mode).toBe('edit');
      expect(state.selectedDate).toBe('2026-09-28');
      expect(state.formValue.id).toBe('w-1');
      expect(state.formValue.title).toBe('Entreno editado');
      expect(state.formValue.steps).toEqual(steps);
      expect(state.formValue.steps).not.toBe(workout.steps);
      expect(state.formValue.estimatedDurationMinutes).toBeNull();
    });

    it('recupera la duración estimada cuando difiere de la calculada', async () => {
      workoutRepo.findById.mockResolvedValue(scheduledWorkout({ plannedDurationSeconds: 3600 }));

      const state = await facade.loadEditForm('workout-1');

      expect(state.formValue.estimatedDurationMinutes).toBe(60);
    });

    it('recupera la distancia planificada solo cuando los pasos no tienen distancia', async () => {
      workoutRepo.findById.mockResolvedValueOnce(
        scheduledWorkout({ plannedDistanceMeters: 30000 }),
      );
      workoutRepo.findById.mockResolvedValueOnce(
        scheduledWorkout({
          steps: [interval('long', { duration: { type: 'distance', meters: 5000 } })],
          plannedDurationSeconds: 1800,
          plannedDistanceMeters: 5000,
        }),
      );

      const withoutDistanceSteps = await facade.loadEditForm('workout-1');
      const withDistanceSteps = await facade.loadEditForm('workout-1');

      expect(withoutDistanceSteps.formValue.plannedDistanceKm).toBe(30);
      expect(withDistanceSteps.formValue.plannedDistanceKm).toBeNull();
    });

    it('lanza error si el workout no existe', async () => {
      workoutRepo.findById.mockResolvedValue(null);

      await expect(facade.loadEditForm('unknown')).rejects.toThrow('El entrenamiento no existe.');
    });
  });

  /* ───────── save ───────── */

  describe('save', () => {
    it('lanza error si la validación falla', async () => {
      await expect(facade.save(buildValue({ title: '', steps: [] }), mockZoneSets)).rejects.toThrow(
        'El título del entrenamiento es requerido.',
      );
      expect(workoutRepo.create).not.toHaveBeenCalled();
    });

    it('crea un workout con los pasos y los totales calculados', async () => {
      const value = buildValue({ objective: '  Umbral  ' });
      workoutRepo.create.mockImplementation(async (workout: ScheduledWorkoutEntity) => workout);

      const result = await facade.save(value, mockZoneSets);

      expect(result.title).toBe('Entrenamiento de prueba');
      expect(result.objective).toBe('Umbral');
      expect(result.steps).toEqual(value.steps);
      expect(result.steps).not.toBe(value.steps);
      expect(result.plannedDurationSeconds).toBe(2760);
      expect(result.plannedDistanceMeters).toBeUndefined();
      expect(result.status).toBe('planned');
      expect(workoutRepo.create).toHaveBeenCalledTimes(1);
      expect(workoutRepo.update).not.toHaveBeenCalled();
    });

    it('guarda la duración estimada y la distancia planificada', async () => {
      const value = buildValue({ estimatedDurationMinutes: 90, plannedDistanceKm: 42.5 });
      workoutRepo.create.mockImplementation(async (workout: ScheduledWorkoutEntity) => workout);

      const result = await facade.save(value, mockZoneSets);

      expect(result.plannedDurationSeconds).toBe(5400);
      expect(result.plannedDistanceMeters).toBe(42500);
    });

    it('actualiza un workout existente conservando id, createdAt, status, completion y sourceTemplateId', async () => {
      const existingWorkout = scheduledWorkout({
        id: 'existing-1',
        title: 'Original',
        status: 'completed',
        completion: { completedAt: '2026-07-25T12:00:00.000Z', durationSeconds: 1800 },
        sourceTemplateId: 'template-99',
        createdAt: '2026-07-24T10:00:00.000Z',
        updatedAt: '2026-07-24T10:00:00.000Z',
      });
      workoutRepo.findById.mockResolvedValue(existingWorkout);
      workoutRepo.update.mockImplementation(async (workout: ScheduledWorkoutEntity) => workout);

      const result = await facade.save(
        buildValue({ id: 'existing-1', title: 'Actualizado' }),
        mockZoneSets,
      );

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

  /* ───────── plantillas ───────── */

  describe('plantillas', () => {
    it('carga una plantilla sin fecha para editarla', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(buildProfile());
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);
      templateRepo.findById.mockResolvedValue(
        workoutTemplate({ id: 'tpl-1', title: 'Umbral 3x10', plannedDurationSeconds: 3600 }),
      );

      const state = await facade.loadEditTemplateForm('tpl-1');

      expect(state.mode).toBe('edit');
      expect(state.selectedDate).toBe('');
      expect(state.formValue).toMatchObject({
        id: 'tpl-1',
        title: 'Umbral 3x10',
        scheduledDate: '',
        estimatedDurationMinutes: 60,
      });
      expect(state.formValue.steps).toEqual(cyclingDefinition().steps);
    });

    it('lanza error si la plantilla no existe', async () => {
      profileRepo.getActiveProfile.mockResolvedValue(null);
      zoneSetRepo.findAll.mockResolvedValue(mockZoneSets);
      templateRepo.findById.mockResolvedValue(null);

      await expect(facade.loadEditTemplateForm('missing')).rejects.toThrow(
        'La plantilla no existe.',
      );
    });

    it('no exige fecha al validar una plantilla', () => {
      const value = buildValue({ scheduledDate: '' });

      expect(facade.validate(value, mockZoneSets, 'template')).toEqual([]);
      expect(facade.validate(value, mockZoneSets)).toContain('La fecha es requerida.');
    });

    it('crea una plantilla activa con la definición del formulario', async () => {
      templateRepo.create.mockImplementation(async (template: WorkoutTemplateEntity) => template);

      const template = await facade.saveTemplate(
        buildValue({ scheduledDate: '', objective: ' Umbral ' }),
        mockZoneSets,
      );

      expect(template).toMatchObject({
        title: 'Entrenamiento de prueba',
        objective: 'Umbral',
        isArchived: false,
        plannedDurationSeconds: 2760,
      });
      expect(template).not.toHaveProperty('scheduledDate');
      expect(template).not.toHaveProperty('status');
      expect(templateRepo.update).not.toHaveBeenCalled();
    });

    it('actualiza una plantilla conservando su estado de archivo y su fecha de creación', async () => {
      const existing = workoutTemplate({
        id: 'tpl-1',
        isArchived: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      templateRepo.findById.mockResolvedValue(existing);
      templateRepo.update.mockImplementation(async (template: WorkoutTemplateEntity) => template);

      const template = await facade.saveTemplate(
        buildValue({ id: 'tpl-1', scheduledDate: '', title: 'Renombrada' }),
        mockZoneSets,
      );

      expect(template).toMatchObject({
        id: 'tpl-1',
        title: 'Renombrada',
        isArchived: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(templateRepo.create).not.toHaveBeenCalled();
    });

    it('guarda un entrenamiento como plantilla nueva sin tocar el entrenamiento', async () => {
      templateRepo.create.mockImplementation(async (template: WorkoutTemplateEntity) => template);

      const template = await facade.saveAsTemplate(
        buildValue({ id: 'workout-1', scheduledDate: '2026-07-25' }),
        mockZoneSets,
      );

      expect(template.id).not.toBe('workout-1');
      expect(template.steps).toEqual(cyclingDefinition().steps);
      expect(templateRepo.findById).not.toHaveBeenCalled();
      expect(workoutRepo.update).not.toHaveBeenCalled();
      expect(workoutRepo.create).not.toHaveBeenCalled();
    });

    it('no guarda la plantilla cuando la validación falla', async () => {
      await expect(facade.saveAsTemplate(buildValue({ title: '' }), mockZoneSets)).rejects.toThrow(
        'El título del entrenamiento es requerido.',
      );
      expect(templateRepo.create).not.toHaveBeenCalled();
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
