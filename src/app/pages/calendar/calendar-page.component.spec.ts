import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CalendarPageComponent } from './calendar-page.component';
import type {
  CalendarMonthViewModel,
  WeeklySummaryRowViewModel,
  WeeklySummaryViewModel,
} from '../../core/models/calendar-view-models';
import { CalendarFacade } from '../../core/services/calendar-facade.service';
import { WorkoutCompletionService } from '../../core/services/workout-completion.service';
import { scheduledWorkout } from '../../../../test/domain/fixtures';

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
      | 'loadWeeklySummary'
      | 'shiftWeek'
      | 'today'
      | 'findWorkout'
    >
  >;

  const buildSummaryRow = (
    overrides: Partial<WeeklySummaryRowViewModel> = {},
  ): WeeklySummaryRowViewModel => ({
    key: 'total',
    label: 'Total',
    sessionsLabel: '1 de 2',
    plannedDurationLabel: '1 h 30 min',
    actualDurationLabel: '50 min',
    plannedDistanceLabel: '30 km',
    actualDistanceLabel: '20 km',
    complianceLabel: '56 %',
    ...overrides,
  });

  const buildWeeklySummary = (referenceDate = '2026-05-13'): WeeklySummaryViewModel => ({
    referenceDate,
    rangeLabel: '11 may al 17 may',
    totals: buildSummaryRow(),
    bySport: [buildSummaryRow({ key: 'cycling', label: 'Ciclismo' })],
    byCategory: [],
  });

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
      loadWeeklySummary: jest.fn(),
      shiftWeek: jest.fn((date: string, weeks: number) => `${date}+${weeks}`),
      today: jest.fn(() => '2026-05-13'),
      findWorkout: jest.fn(),
    };
    facade.loadWeeklySummary.mockImplementation(async (date: string) => buildWeeklySummary(date));
    facade.loadMonth.mockResolvedValue(buildViewModel());
    facade.goToCurrentMonth.mockResolvedValue(buildViewModel());
    facade.goToPreviousMonth.mockResolvedValue(
      buildViewModel({ month: 4, monthLabel: 'ABRIL 2026' }),
    );
    facade.goToNextMonth.mockResolvedValue(buildViewModel({ month: 6, monthLabel: 'JUNIO 2026' }));

    await TestBed.configureTestingModule({
      imports: [CalendarPageComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarFacade, useValue: facade },
        { provide: WorkoutCompletionService, useValue: {} },
      ],
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

  it('abre el detalle del entrenamiento en un modal', async () => {
    facade.findWorkout.mockImplementation(async () => scheduledWorkout({ title: 'Rodada larga' }));

    await fixture.componentInstance.openWorkout('workout-1');
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(facade.findWorkout).toHaveBeenCalledWith('workout-1');
    expect(dialog.textContent).toContain('Rodada larga');
    expect(facade.openWorkout).not.toHaveBeenCalled();
  });

  it('navega a la edición desde el detalle', () => {
    fixture.componentInstance.editWorkout('workout-1');

    expect(facade.openWorkout).toHaveBeenCalledWith('workout-1');
  });

  it('muestra el resumen de la semana de hoy', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="weekly-summary"]',
    ) as HTMLElement;
    expect(facade.loadWeeklySummary).toHaveBeenCalledWith('2026-05-13');
    expect(summary.textContent).toContain('11 may al 17 may');
    expect(summary.querySelector('[data-testid="summary-cycling"]')?.textContent).toContain(
      'Ciclismo',
    );
    expect(summary.querySelector('[data-testid="summary-total"]')?.textContent).toContain('56 %');
  });

  it('cambia de semana con los botones del resumen', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance.goToNextWeek();
    await fixture.componentInstance.goToPreviousWeek();

    expect(facade.shiftWeek).toHaveBeenNthCalledWith(1, '2026-05-13', 1);
    expect(facade.loadWeeklySummary).toHaveBeenLastCalledWith('2026-05-13+1+-1');
  });

  it('recarga el mes y el resumen cuando cambia el estado de un entrenamiento', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    facade.loadMonth.mockClear();
    facade.loadWeeklySummary.mockClear();

    await fixture.componentInstance.onWorkoutChanged(scheduledWorkout({ status: 'skipped' }));

    expect(facade.loadMonth).toHaveBeenCalledWith('2026-05-01');
    expect(facade.loadWeeklySummary).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.selectedWorkout()?.status).toBe('skipped');
  });
});
