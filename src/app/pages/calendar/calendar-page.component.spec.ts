import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CalendarPageComponent } from './calendar-page.component';
import type { CalendarMonthViewModel } from '../../core/interfaces/calendar-view-models';
import { CalendarFacade } from '../../core/services/calendar-facade.service';

describe('CalendarPageComponent', () => {
  let fixture: ComponentFixture<CalendarPageComponent>;
  let facade: jest.Mocked<
    Pick<
      CalendarFacade,
      | 'loadMonth'
      | 'goToPreviousMonth'
      | 'goToNextMonth'
      | 'goToCurrentMonth'
      | 'createWorkoutForDate'
      | 'openWorkout'
    >
  >;

  const buildViewModel = (
    overrides: Partial<CalendarMonthViewModel> = {},
  ): CalendarMonthViewModel => ({
    year: 2026,
    month: 5,
    monthLabel: 'MAYO 2026',
    visibleStartDate: '2026-04-27',
    visibleEndDate: '2026-06-07',
    weekdays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    weeks: [],
    summary: {
      totalDurationMinutes: 0,
      totalDurationLabel: '-- h',
      totalDistanceKm: null,
      totalDistanceLabel: '-- km',
      totalWorkouts: 0,
    },
    userName: 'Usuario',
    ...overrides,
  });

  beforeEach(async () => {
    facade = {
      loadMonth: jest.fn(),
      goToPreviousMonth: jest.fn(),
      goToNextMonth: jest.fn(),
      goToCurrentMonth: jest.fn(),
      createWorkoutForDate: jest.fn(),
      openWorkout: jest.fn(),
    };
    facade.loadMonth.mockResolvedValue(buildViewModel());
    facade.goToCurrentMonth.mockResolvedValue(buildViewModel());
    facade.goToPreviousMonth.mockResolvedValue(
      buildViewModel({ month: 4, monthLabel: 'ABRIL 2026' }),
    );
    facade.goToNextMonth.mockResolvedValue(buildViewModel({ month: 6, monthLabel: 'JUNIO 2026' }));

    await TestBed.configureTestingModule({
      imports: [CalendarPageComponent],
      providers: [provideRouter([]), { provide: CalendarFacade, useValue: facade }],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPageComponent);
  });

  it('crea la página del calendario', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra estado de carga inicial', () => {
    facade.goToCurrentMonth.mockReturnValue(new Promise(() => undefined));
    fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando calendario');
  });

  it('oculta loading y renderiza calendario tras la carga', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('MAYO 2026');
  });

  it('muestra mensaje de error cuando falla la carga', async () => {
    facade.goToCurrentMonth.mockRejectedValue(new Error('Fail'));
    fixture = TestBed.createComponent(CalendarPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar');
  });

  it('navega al mes anterior al hacer clic en anterior', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const previousButton = fixture.nativeElement.querySelector('[aria-label="Mes anterior"]');
    previousButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(facade.goToPreviousMonth).toHaveBeenCalled();
  });

  it('navega al mes siguiente al hacer clic en siguiente', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nextButton = fixture.nativeElement.querySelector('[aria-label="Mes siguiente"]');
    nextButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(facade.goToNextMonth).toHaveBeenCalled();
  });

  it('navega al mes actual al hacer clic en Hoy', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const todayButton = Array.from(buttons).find(
      (button): button is HTMLButtonElement =>
        button instanceof HTMLButtonElement && button.textContent?.includes('Hoy') === true,
    );

    expect(todayButton).toBeTruthy();
    todayButton?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(facade.goToCurrentMonth).toHaveBeenCalledTimes(2);
  });

  it('delega createWorkoutForDate al facade', () => {
    fixture.componentInstance.createWorkoutForDate('2026-05-15');

    expect(facade.createWorkoutForDate).toHaveBeenCalledWith('2026-05-15');
  });

  it('delega openWorkout al facade', () => {
    fixture.componentInstance.openWorkout('workout-1');

    expect(facade.openWorkout).toHaveBeenCalledWith('workout-1');
  });
});
