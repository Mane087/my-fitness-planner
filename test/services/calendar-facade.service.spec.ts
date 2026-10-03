import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import {
  CalendarDefaultView,
  TimeFormat,
  WeekStartsOn,
} from '../../src/app/core/domain/calendar.enums';
import type { AppSettingsEntity } from '../../src/app/core/domain/schemas/app-settings.schema';
import type { AthleteProfileEntity } from '../../src/app/core/domain/schemas/athlete-profile.schema';
import type { ScheduledWorkoutEntity } from '../../src/app/core/domain/schemas/scheduled-workout.schema';
import { IntensityMetric, Sport, WorkoutCategory } from '../../src/app/core/domain/workout.enums';
import { AppSettingsRepository } from '../../src/app/core/repositories/app-settings.repository';
import { AthleteProfileRepository } from '../../src/app/core/repositories/athlete-profile.repository';
import { ScheduledWorkoutRepository } from '../../src/app/core/repositories/scheduled-workout.repository';
import { CalendarFacade } from '../../src/app/core/services/calendar-facade.service';
import { TrainingCalendarService } from '../../src/app/core/services/training-calendar.service';
import { scheduledWorkout } from '../domain/fixtures';

describe('CalendarFacade', () => {
  let facade: CalendarFacade;
  let scheduledWorkoutRepository: jest.Mocked<Pick<ScheduledWorkoutRepository, 'findByDateRange'>>;
  let athleteProfileRepository: jest.Mocked<Pick<AthleteProfileRepository, 'getActiveProfile'>>;
  let appSettingsRepository: jest.Mocked<Pick<AppSettingsRepository, 'getSettings' | 'update'>>;
  let trainingCalendarService: jest.Mocked<
    Pick<TrainingCalendarService, 'moveWorkout' | 'copyWorkout'>
  >;

  beforeEach(() => {
    scheduledWorkoutRepository = { findByDateRange: jest.fn() };
    athleteProfileRepository = { getActiveProfile: jest.fn() };
    appSettingsRepository = { getSettings: jest.fn(), update: jest.fn() };
    trainingCalendarService = { moveWorkout: jest.fn(), copyWorkout: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        CalendarFacade,
        provideRouter([]),
        { provide: ScheduledWorkoutRepository, useValue: scheduledWorkoutRepository },
        { provide: AthleteProfileRepository, useValue: athleteProfileRepository },
        { provide: AppSettingsRepository, useValue: appSettingsRepository },
        { provide: TrainingCalendarService, useValue: trainingCalendarService },
      ],
    });

    facade = TestBed.inject(CalendarFacade);
  });

  it('carga entrenamientos del rango visible y calcula resumen mensual', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({
        id: 'april',
        scheduledDate: '2026-04-30',
        plannedDurationSeconds: 90 * 60,
      }),
      buildWorkout({
        id: 'may-a',
        scheduledDate: '2026-05-01',
        plannedDurationSeconds: 60 * 60,
        plannedDistanceMeters: 20_000,
      }),
      buildWorkout({
        id: 'may-b',
        scheduledDate: '2026-05-02',
        plannedDurationSeconds: 70 * 60,
        plannedDistanceMeters: 30_000,
      }),
    ]);

    const viewModel = await facade.loadMonth('2026-05-15');

    expect(scheduledWorkoutRepository.findByDateRange).toHaveBeenCalledTimes(1);
    expect(scheduledWorkoutRepository.findByDateRange).toHaveBeenCalledWith(
      '2026-04-27',
      '2026-06-07',
    );
    expect(viewModel.userName).toBe('Manuel');
    expect(viewModel.summary.totalDurationMinutes).toBe(130);
    expect(viewModel.summary.totalDurationLabel).toBe('2 h 10 min');
    expect(viewModel.summary.totalDistanceKm).toBe(50);
    expect(viewModel.summary.totalDistanceLabel).toBe('50 km');
    expect(viewModel.summary.totalWorkouts).toBe(2);

    const mayFirst = viewModel.weeks.flat().find((day) => day.date === '2026-05-01');
    expect(mayFirst?.workouts[0].title).toBe('Entrenamiento');
    expect(mayFirst?.workouts[0].durationLabel).toBe('1 h');
    expect(mayFirst?.workouts[0].distanceLabel).toBe('20 km');
  });

  it('usa usuario e inicio de semana por defecto sin perfil', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(null);
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([]);

    const viewModel = await facade.loadMonth('2026-05-15');

    expect(viewModel.userName).toBe('Usuario');
    expect(viewModel.weekdays[0]).toBe('Lunes');
    expect(viewModel.summary.totalDistanceLabel).toBe('-- km');
  });

  it('navega al mes anterior y siguiente', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([]);

    const previous = await facade.goToPreviousMonth(2026, 5);
    const next = await facade.goToNextMonth(2026, 5);

    expect(previous.month).toBe(4);
    expect(next.month).toBe(6);
  });

  it('createWorkoutForDate navega a la ruta de creación con la fecha', () => {
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    facade.createWorkoutForDate('2026-05-15');

    expect(router.navigate).toHaveBeenCalledWith(['/calendar', 'new'], {
      queryParams: { date: '2026-05-15' },
    });
  });

  it('openWorkout navega a la ruta de edición con el ID', () => {
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    facade.openWorkout('workout-123');

    expect(router.navigate).toHaveBeenCalledWith(['/calendar', 'edit', 'workout-123']);
  });

  it('mapea etiquetas de deporte y categoría a español', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({
        id: 'w1',
        scheduledDate: '2026-05-01',
        sport: Sport.Cycling,
        modality: 'mtb',
        category: WorkoutCategory.Recovery,
      }),
      buildWorkout({
        id: 'w2',
        scheduledDate: '2026-05-02',
        sport: Sport.Cycling,
        modality: 'road',
        category: WorkoutCategory.Vo2Max,
      }),
    ]);

    const viewModel = await facade.loadMonth('2026-05-15');
    const may1 = viewModel.weeks.flat().find((day) => day.date === '2026-05-01');
    const may2 = viewModel.weeks.flat().find((day) => day.date === '2026-05-02');

    expect(may1?.workouts[0].sportLabel).toBe('Ciclismo MTB');
    expect(may1?.workouts[0].categoryLabel).toBe('Recuperación');
    expect(may2?.workouts[0].sportLabel).toBe('Ciclismo Ruta');
    expect(may2?.workouts[0].categoryLabel).toBe('VO2 máx');
  });

  it('muestra el estado y el tiempo real de los entrenamientos completados', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({
        id: 'done',
        plannedDistanceMeters: 30000,
        status: 'completed',
        completion: {
          completedAt: '2026-05-01T18:00:00.000Z',
          durationSeconds: 50 * 60,
          distanceMeters: 27500,
        },
      }),
      buildWorkout({ id: 'skipped', status: 'skipped' }),
      buildWorkout({
        id: 'done-without-distance',
        status: 'completed',
        completion: { completedAt: '2026-05-01T18:00:00.000Z' },
      }),
    ]);

    const viewModel = await facade.loadMonth('2026-05-15');
    const [done, skipped, doneWithoutDistance] =
      viewModel.weeks.flat().find((day) => day.date === '2026-05-01')?.workouts ?? [];

    expect(done).toMatchObject({
      statusLabel: 'Completado',
      durationLabel: '1 h',
      actualDurationLabel: '50 min',
      distanceLabel: '30 km',
      actualDistanceLabel: '27.5 km',
      hasPlannedDistance: true,
    });
    expect(skipped).toMatchObject({
      statusLabel: 'Omitido',
      actualDurationLabel: null,
      actualDistanceLabel: null,
    });
    expect(doneWithoutDistance).toMatchObject({
      actualDurationLabel: '1 h',
      actualDistanceLabel: null,
      hasPlannedDistance: false,
    });
  });

  it('formatea el resumen semanal con el inicio de semana del perfil', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue({
      ...buildProfile(),
      weekStartsOn: WeekStartsOn.Sunday,
    });
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({
        id: 'done',
        scheduledDate: '2026-05-03',
        plannedDistanceMeters: 30000,
        status: 'completed',
        completion: { completedAt: '2026-05-03T18:00:00.000Z', durationSeconds: 45 * 60 },
      }),
      buildWorkout({ id: 'planned', scheduledDate: '2026-05-04', category: WorkoutCategory.Tempo }),
    ]);

    const summary = await facade.loadWeeklySummary('2026-05-06');

    // 2026-05-06 es miércoles; con inicio en domingo la semana va del 3 al 9 de mayo.
    expect(scheduledWorkoutRepository.findByDateRange).toHaveBeenCalledWith(
      '2026-05-03',
      '2026-05-09',
    );
    expect(summary.rangeLabel).toBe('3 may al 9 may');
    expect(summary.totals).toEqual({
      key: 'total',
      label: 'Total',
      sessionsLabel: '1 de 2',
      plannedDurationLabel: '2 h',
      actualDurationLabel: '45 min',
      plannedDistanceLabel: '30 km',
      actualDistanceLabel: '30 km',
      complianceLabel: '38 %',
    });
    expect(summary.bySport.map((row) => row.label)).toEqual(['Ciclismo']);
    expect(summary.byCategory.map((row) => row.label)).toEqual(['Resistencia', 'Tempo']);
  });

  it('desplaza la semana de referencia', () => {
    expect(facade.shiftWeek('2026-05-06', -1)).toBe('2026-04-29');
  });

  it('calcula el rango de la semana con inicio en lunes', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([]);

    const viewModel = await facade.loadWeek('2026-05-13');

    expect(scheduledWorkoutRepository.findByDateRange).toHaveBeenCalledWith(
      '2026-05-11',
      '2026-05-17',
    );
    expect(viewModel.startDate).toBe('2026-05-11');
    expect(viewModel.endDate).toBe('2026-05-17');
    expect(viewModel.rangeLabel).toBe('11 may al 17 may');
  });

  it('calcula el rango de la semana con inicio en domingo', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue({
      ...buildProfile(),
      weekStartsOn: WeekStartsOn.Sunday,
    });
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([]);

    const viewModel = await facade.loadWeek('2026-05-13');

    expect(scheduledWorkoutRepository.findByDateRange).toHaveBeenCalledWith(
      '2026-05-10',
      '2026-05-16',
    );
    expect(viewModel.startDate).toBe('2026-05-10');
    expect(viewModel.endDate).toBe('2026-05-16');
  });

  it('agrupa los entrenamientos de la semana por día, ordenados y con su etiqueta', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({ id: 'monday-a', scheduledDate: '2026-05-11' }),
      buildWorkout({ id: 'monday-b', scheduledDate: '2026-05-11' }),
      buildWorkout({ id: 'wednesday', scheduledDate: '2026-05-13' }),
    ]);

    const viewModel = await facade.loadWeek('2026-05-13');

    expect(viewModel.days.map((day) => day.date)).toEqual([
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
    ]);
    expect(viewModel.days.map((day) => day.weekdayLabel)).toEqual([
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ]);

    const monday = viewModel.days.find((day) => day.date === '2026-05-11');
    const wednesday = viewModel.days.find((day) => day.date === '2026-05-13');
    const tuesday = viewModel.days.find((day) => day.date === '2026-05-12');

    expect(monday?.workouts.map((workout) => workout.id)).toEqual(['monday-a', 'monday-b']);
    expect(wednesday?.workouts.map((workout) => workout.id)).toEqual(['wednesday']);
    expect(tuesday?.workouts).toEqual([]);
  });

  it('calcula las etiquetas de lo planeado y lo real por día, sin lo real cuando nada se completó', async () => {
    athleteProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({
        id: 'planned-only',
        scheduledDate: '2026-05-11',
        plannedDurationSeconds: 3600,
        plannedDistanceMeters: undefined,
      }),
      buildWorkout({
        id: 'completed',
        scheduledDate: '2026-05-12',
        plannedDurationSeconds: 3600,
        plannedDistanceMeters: 20000,
        status: 'completed',
        completion: {
          completedAt: '2026-05-12T18:00:00.000Z',
          durationSeconds: 3000,
          distanceMeters: 20000,
        },
      }),
    ]);

    const viewModel = await facade.loadWeek('2026-05-13');

    const plannedOnlyDay = viewModel.days.find((day) => day.date === '2026-05-11');
    const completedDay = viewModel.days.find((day) => day.date === '2026-05-12');
    const emptyDay = viewModel.days.find((day) => day.date === '2026-05-14');

    expect(plannedOnlyDay?.plannedLabel).toBe('1 h');
    expect(plannedOnlyDay?.actualLabel).toBeNull();
    expect(completedDay?.plannedLabel).toBe('1 h · 20 km');
    expect(completedDay?.actualLabel).toBe('50 min · 20 km');
    expect(emptyDay?.plannedLabel).toBe('-- h');
    expect(emptyDay?.actualLabel).toBeNull();
  });

  it('carga la vista por defecto guardada en los ajustes', async () => {
    appSettingsRepository.getSettings.mockResolvedValue(
      buildSettings({ calendarDefaultView: 'week' }),
    );

    expect(await facade.loadDefaultView()).toBe('week');
  });

  it('no actualiza los ajustes si la vista guardada no cambia', async () => {
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());

    await facade.saveDefaultView(CalendarDefaultView.Month);

    expect(appSettingsRepository.update).not.toHaveBeenCalled();
  });

  it('guarda la vista por defecto cuando cambia', async () => {
    const settings = buildSettings();
    appSettingsRepository.getSettings.mockResolvedValue(settings);

    await facade.saveDefaultView(CalendarDefaultView.Week);

    expect(appSettingsRepository.update).toHaveBeenCalledWith({
      ...settings,
      calendarDefaultView: 'week',
    });
  });

  it('delega moveWorkout en TrainingCalendarService', async () => {
    const moved = buildWorkout({ id: 'workout-1', scheduledDate: '2026-05-20' });
    trainingCalendarService.moveWorkout.mockResolvedValue(moved);

    const result = await facade.moveWorkout('workout-1', '2026-05-20');

    expect(trainingCalendarService.moveWorkout).toHaveBeenCalledWith('workout-1', '2026-05-20');
    expect(result).toBe(moved);
  });

  it('delega copyWorkout en TrainingCalendarService', async () => {
    const copy = buildWorkout({ id: 'workout-2', scheduledDate: '2026-05-20' });
    trainingCalendarService.copyWorkout.mockResolvedValue(copy);

    const result = await facade.copyWorkout('workout-1', '2026-05-20');

    expect(trainingCalendarService.copyWorkout).toHaveBeenCalledWith('workout-1', '2026-05-20');
    expect(result).toBe(copy);
  });
});

function buildProfile(): AthleteProfileEntity {
  return {
    id: 'profile-1',
    name: 'Manuel',
    maxHeartRate: 190,
    preferredSport: Sport.Cycling,
    preferredIntensityMetric: IntensityMetric.HeartRate,
    weekStartsOn: WeekStartsOn.Monday,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function buildSettings(overrides: Partial<AppSettingsEntity> = {}): AppSettingsEntity {
  return {
    id: 'settings-1',
    calendarDefaultView: CalendarDefaultView.Month,
    weekStartsOn: WeekStartsOn.Monday,
    timeFormat: TimeFormat.TwentyFourHour,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildWorkout(overrides: Partial<ScheduledWorkoutEntity> = {}): ScheduledWorkoutEntity {
  return scheduledWorkout({
    id: 'workout-1',
    title: 'Entrenamiento',
    scheduledDate: '2026-05-01',
    sport: Sport.Cycling,
    modality: 'road',
    category: WorkoutCategory.Endurance,
    primaryMetric: IntensityMetric.HeartRate,
    plannedDurationSeconds: 60 * 60,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });
}
