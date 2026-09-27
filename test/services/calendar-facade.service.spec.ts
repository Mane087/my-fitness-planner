import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import type { AppSettingsEntity } from '../../src/app/core/domain/app-settings.model';
import { CalendarDefaultView, TimeFormat } from '../../src/app/core/domain/app-settings.model';
import type { ScheduledWorkoutEntity } from '../../src/app/core/domain/scheduled-workout.model';
import {
  PreferredDiscipline,
  PreferredIntensityMetric,
  WeekStartsOn,
} from '../../src/app/core/domain/sport-profile.model';
import type { SportProfileEntity } from '../../src/app/core/domain/sport-profile.model';
import {
  IntensityMetric,
  WorkoutDiscipline,
  WorkoutStatus,
  WorkoutType,
} from '../../src/app/core/domain/workout.enums';
import { AppSettingsRepository } from '../../src/app/core/repositories/app-settings.repository';
import { ScheduledWorkoutRepository } from '../../src/app/core/repositories/scheduled-workout.repository';
import { SportProfileRepository } from '../../src/app/core/repositories/sport-profile.repository';
import { CalendarFacade } from '../../src/app/core/services/calendar-facade.service';

describe('CalendarFacade', () => {
  let facade: CalendarFacade;
  let scheduledWorkoutRepository: jest.Mocked<Pick<ScheduledWorkoutRepository, 'findByDateRange'>>;
  let sportProfileRepository: jest.Mocked<Pick<SportProfileRepository, 'getActiveProfile'>>;
  let appSettingsRepository: jest.Mocked<Pick<AppSettingsRepository, 'getSettings'>>;

  beforeEach(() => {
    scheduledWorkoutRepository = { findByDateRange: jest.fn() };
    sportProfileRepository = { getActiveProfile: jest.fn() };
    appSettingsRepository = { getSettings: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        CalendarFacade,
        provideRouter([]),
        { provide: ScheduledWorkoutRepository, useValue: scheduledWorkoutRepository },
        { provide: SportProfileRepository, useValue: sportProfileRepository },
        { provide: AppSettingsRepository, useValue: appSettingsRepository },
      ],
    });

    facade = TestBed.inject(CalendarFacade);
  });

  it('carga entrenamientos del rango visible y calcula resumen mensual', async () => {
    sportProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({ id: 'april', scheduledDate: '2026-04-30', estimatedDurationMinutes: 90 }),
      buildWorkout({
        id: 'may-a',
        scheduledDate: '2026-05-01',
        estimatedDurationMinutes: 60,
        plannedDistanceKm: 20,
      }),
      buildWorkout({
        id: 'may-b',
        scheduledDate: '2026-05-02',
        estimatedDurationMinutes: 70,
        plannedDistanceKm: 30,
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
    expect(viewModel.weeks.flat().find((day) => day.date === '2026-05-01')?.workouts[0].title).toBe(
      'Entrenamiento',
    );
  });

  it('usa usuario e inicio de semana por defecto sin perfil', async () => {
    sportProfileRepository.getActiveProfile.mockResolvedValue(null);
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([]);

    const viewModel = await facade.loadMonth('2026-05-15');

    expect(viewModel.userName).toBe('Usuario');
    expect(viewModel.weekdays[0]).toBe('Lunes');
    expect(viewModel.summary.totalDistanceLabel).toBe('-- km');
  });

  it('navega al mes anterior y siguiente', async () => {
    sportProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
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

  it('mapea etiquetas de disciplina y tipo a español', async () => {
    sportProfileRepository.getActiveProfile.mockResolvedValue(buildProfile());
    appSettingsRepository.getSettings.mockResolvedValue(buildSettings());
    scheduledWorkoutRepository.findByDateRange.mockResolvedValue([
      buildWorkout({
        id: 'w1',
        scheduledDate: '2026-05-01',
        discipline: WorkoutDiscipline.Mtb,
        workoutType: WorkoutType.Recovery,
      }),
      buildWorkout({
        id: 'w2',
        scheduledDate: '2026-05-02',
        discipline: WorkoutDiscipline.Road,
        workoutType: WorkoutType.Vo2Max,
      }),
    ]);

    const viewModel = await facade.loadMonth('2026-05-15');
    const may1 = viewModel.weeks.flat().find((day) => day.date === '2026-05-01');
    const may2 = viewModel.weeks.flat().find((day) => day.date === '2026-05-02');

    expect(may1?.workouts[0].disciplineLabel).toBe('MTB');
    expect(may1?.workouts[0].workoutTypeLabel).toBe('Recuperación');
    expect(may2?.workouts[0].disciplineLabel).toBe('Ruta');
    expect(may2?.workouts[0].workoutTypeLabel).toBe('VO2 Máx');
  });
});

function buildProfile(): SportProfileEntity {
  return {
    id: 'profile-1',
    name: 'Manuel',
    maxHeartRate: 190,
    preferredDiscipline: PreferredDiscipline.Road,
    preferredIntensityMetric: PreferredIntensityMetric.HeartRate,
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
  return {
    id: 'workout-1',
    title: 'Entrenamiento',
    scheduledDate: '2026-05-01',
    workoutType: WorkoutType.Base,
    discipline: WorkoutDiscipline.Road,
    intensityMetric: IntensityMetric.HeartRate,
    estimatedDurationMinutes: 60,
    status: WorkoutStatus.Planned,
    blocks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
