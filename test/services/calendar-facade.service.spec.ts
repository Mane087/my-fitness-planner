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
import { scheduledWorkout } from '../domain/fixtures';

describe('CalendarFacade', () => {
  let facade: CalendarFacade;
  let scheduledWorkoutRepository: jest.Mocked<Pick<ScheduledWorkoutRepository, 'findByDateRange'>>;
  let athleteProfileRepository: jest.Mocked<Pick<AthleteProfileRepository, 'getActiveProfile'>>;
  let appSettingsRepository: jest.Mocked<Pick<AppSettingsRepository, 'getSettings'>>;

  beforeEach(() => {
    scheduledWorkoutRepository = { findByDateRange: jest.fn() };
    athleteProfileRepository = { getActiveProfile: jest.fn() };
    appSettingsRepository = { getSettings: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        CalendarFacade,
        provideRouter([]),
        { provide: ScheduledWorkoutRepository, useValue: scheduledWorkoutRepository },
        { provide: AthleteProfileRepository, useValue: athleteProfileRepository },
        { provide: AppSettingsRepository, useValue: appSettingsRepository },
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

function buildSettings(): AppSettingsEntity {
  return {
    id: 'settings-1',
    calendarDefaultView: CalendarDefaultView.Month,
    weekStartsOn: WeekStartsOn.Monday,
    timeFormat: TimeFormat.TwentyFourHour,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
