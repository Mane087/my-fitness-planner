import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Sport, WorkoutCategory, WorkoutStatus } from '../../src/app/core/domain/workout.enums';
import type {
  CalendarWeekViewModel,
  CalendarWorkoutCardViewModel,
  WorkoutRelocation,
} from '../../src/app/core/models/calendar-view-models';
import { CalendarWeekViewComponent } from '../../src/app/pages/calendar/calendar-week-view.component';

function buildWorkoutCard(
  overrides: Partial<CalendarWorkoutCardViewModel> = {},
): CalendarWorkoutCardViewModel {
  return {
    id: 'workout-1',
    title: 'Rodada larga',
    scheduledDate: '2026-05-11',
    sport: Sport.Cycling,
    sportLabel: 'Ciclismo',
    category: WorkoutCategory.Endurance,
    categoryLabel: 'Resistencia',
    durationLabel: '1 h',
    distanceLabel: '30 km',
    colorClass: 'border-orange-500',
    status: WorkoutStatus.Planned,
    statusLabel: 'Planeado',
    actualDurationLabel: null,
    actualDistanceLabel: null,
    hasPlannedDistance: true,
    steps: [],
    durationClock: '1:00',
    distanceKmLabel: '30',
    summaryText: null,
    dominantZone: null,
    ...overrides,
  };
}

function buildWeek(overrides: Partial<CalendarWeekViewModel> = {}): CalendarWeekViewModel {
  const dates = [
    '2026-05-11',
    '2026-05-12',
    '2026-05-13',
    '2026-05-14',
    '2026-05-15',
    '2026-05-16',
    '2026-05-17',
  ];

  return {
    startDate: dates[0],
    endDate: dates[6],
    rangeLabel: '11 may al 17 may',
    weekNumber: 20,
    longRangeLabel: '11 – 17 de mayo de 2026',
    summary: {
      duration: { actualLabel: '0:00', plannedLabel: '0:00', percent: 0 },
      distance: { actualLabel: '0', plannedLabel: '0', percent: 0 },
      completed: { done: 0, total: 0, percent: 0 },
      zones: [],
      zonesCaption: null,
    },
    userName: 'Manuel',
    days: dates.map((date, index) => ({
      date,
      weekdayLabel: `Día ${index}`,
      dateLabel: date,
      dayOfMonth: 11 + index,
      isToday: false,
      workouts: [],
      plannedClock: '',
      plannedLabel: '-- h',
      actualLabel: null,
    })),
    ...overrides,
  };
}

@Component({
  imports: [CalendarWeekViewComponent],
  template: `
    <app-calendar-week-view
      [week]="week()"
      (opened)="opened.push($event)"
      (createRequested)="createRequested.push($event)"
      (relocated)="relocated.push($event)"
    />
  `,
})
class WeekViewHostComponent {
  readonly week = signal<CalendarWeekViewModel>(buildWeek());
  readonly opened: string[] = [];
  readonly createRequested: string[] = [];
  readonly relocated: WorkoutRelocation[] = [];
}

describe('CalendarWeekViewComponent', () => {
  let fixture: ComponentFixture<WeekViewHostComponent>;
  let host: WeekViewHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WeekViewHostComponent] });
    fixture = TestBed.createComponent(WeekViewHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
  });

  function dayElement(date: string): HTMLElement {
    const found = element.querySelector<HTMLElement>(`[data-testid="week-day-${date}"]`);
    if (!found) throw new Error(`No existe el día ${date}.`);
    return found;
  }

  function workoutCardElement(date: string): HTMLElement {
    const found = dayElement(date).querySelector<HTMLElement>('app-workout-card');
    if (!found) throw new Error(`No existe un workout card en ${date}.`);
    return found;
  }

  function dragStart(date: string, init: MouseEventInit = {}): void {
    workoutCardElement(date).dispatchEvent(
      new MouseEvent('dragstart', { bubbles: true, cancelable: true, ...init }),
    );
  }

  function dragOver(date: string, init: MouseEventInit = {}): Event {
    const event = new MouseEvent('dragover', { bubbles: true, cancelable: true, ...init });
    dayElement(date).dispatchEvent(event);
    return event;
  }

  function drop(date: string, init: MouseEventInit = {}): void {
    dayElement(date).dispatchEvent(
      new MouseEvent('drop', { bubbles: true, cancelable: true, ...init }),
    );
  }

  it('emite relocated en modo mover al soltar un entrenamiento en otro día', () => {
    host.week.set(
      buildWeek({
        days: buildWeek().days.map((day, index) =>
          index === 0
            ? { ...day, workouts: [buildWorkoutCard({ id: 'w1', scheduledDate: day.date })] }
            : day,
        ),
      }),
    );
    fixture.detectChanges();

    dragStart('2026-05-11');
    drop('2026-05-12');
    fixture.detectChanges();

    expect(host.relocated).toEqual([
      {
        workout: expect.objectContaining({ id: 'w1' }),
        targetDate: '2026-05-12',
        mode: 'move',
      },
    ]);
  });

  it('emite relocated en modo copiar cuando se suelta con Ctrl', () => {
    host.week.set(
      buildWeek({
        days: buildWeek().days.map((day, index) =>
          index === 0
            ? { ...day, workouts: [buildWorkoutCard({ id: 'w1', scheduledDate: day.date })] }
            : day,
        ),
      }),
    );
    fixture.detectChanges();

    dragStart('2026-05-11');
    drop('2026-05-13', { ctrlKey: true });
    fixture.detectChanges();

    expect(host.relocated).toEqual([
      expect.objectContaining({ targetDate: '2026-05-13', mode: 'copy' }),
    ]);
  });

  it('emite relocated en modo copiar cuando se suelta con Alt', () => {
    host.week.set(
      buildWeek({
        days: buildWeek().days.map((day, index) =>
          index === 0
            ? { ...day, workouts: [buildWorkoutCard({ id: 'w1', scheduledDate: day.date })] }
            : day,
        ),
      }),
    );
    fixture.detectChanges();

    dragStart('2026-05-11');
    drop('2026-05-14', { altKey: true });
    fixture.detectChanges();

    expect(host.relocated).toEqual([
      expect.objectContaining({ targetDate: '2026-05-14', mode: 'copy' }),
    ]);
  });

  it('ignora el movimiento al soltar un entrenamiento en el mismo día', () => {
    host.week.set(
      buildWeek({
        days: buildWeek().days.map((day, index) =>
          index === 0
            ? { ...day, workouts: [buildWorkoutCard({ id: 'w1', scheduledDate: day.date })] }
            : day,
        ),
      }),
    );
    fixture.detectChanges();

    dragStart('2026-05-11');
    drop('2026-05-11');
    fixture.detectChanges();

    expect(host.relocated).toEqual([]);
  });

  it('no llama preventDefault en dragover cuando no hay un arrastre en curso', () => {
    fixture.detectChanges();

    const event = dragOver('2026-05-11');

    expect(event.defaultPrevented).toBe(false);
  });

  it('emite opened al abrir un entrenamiento', () => {
    host.week.set(
      buildWeek({
        days: buildWeek().days.map((day, index) =>
          index === 0
            ? { ...day, workouts: [buildWorkoutCard({ id: 'w1', scheduledDate: day.date })] }
            : day,
        ),
      }),
    );
    fixture.detectChanges();

    workoutCardElement('2026-05-11').querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    expect(host.opened).toEqual(['w1']);
  });

  it('emite createRequested al pedir crear un entrenamiento en un día', () => {
    fixture.detectChanges();

    const addButton = dayElement('2026-05-12').querySelector<HTMLButtonElement>(
      '[aria-label="Agregar entrenamiento el 2026-05-12"]',
    );
    addButton?.click();
    fixture.detectChanges();

    expect(host.createRequested).toEqual(['2026-05-12']);
  });

  it('muestra Descanso en los días sin entrenamientos', () => {
    fixture.detectChanges();

    expect(dayElement('2026-05-12').textContent).toContain('Descanso');
    expect(dayElement('2026-05-12').textContent).toContain('Sin entrenamientos');
  });

  it('muestra la zona de soltar con la ayuda para copiar sobre el día de destino', () => {
    host.week.set(
      buildWeek({
        days: buildWeek().days.map((day, index) =>
          index === 0
            ? { ...day, workouts: [buildWorkoutCard({ id: 'w1', scheduledDate: day.date })] }
            : day,
        ),
      }),
    );
    fixture.detectChanges();

    dragStart('2026-05-11');
    dragOver('2026-05-13');
    fixture.detectChanges();

    expect(dayElement('2026-05-13').textContent).toContain('Soltar para mover');
    expect(dayElement('2026-05-13').textContent).toContain('Mantén Alt para copiar');
    expect(dayElement('2026-05-12').textContent).not.toContain('Soltar para mover');
  });

  it('atenúa la tarjeta que se está arrastrando', () => {
    host.week.set(
      buildWeek({
        days: buildWeek().days.map((day, index) =>
          index === 0
            ? { ...day, workouts: [buildWorkoutCard({ id: 'w1', scheduledDate: day.date })] }
            : day,
        ),
      }),
    );
    fixture.detectChanges();

    dragStart('2026-05-11');
    fixture.detectChanges();

    expect(workoutCardElement('2026-05-11').querySelector('button')?.className).toContain(
      'opacity-40',
    );
  });
});

describe('CalendarWeekViewComponent en teléfono', () => {
  let fixture: ComponentFixture<WeekViewHostComponent>;
  let host: WeekViewHostComponent;
  let element: HTMLElement;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Below 1024 px the week is a strip of days with the list of the selected day.
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    TestBed.configureTestingModule({ imports: [WeekViewHostComponent] });
    fixture = TestBed.createComponent(WeekViewHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function weekWithWorkouts(): CalendarWeekViewModel {
    return buildWeek({
      days: buildWeek().days.map((day, index) => {
        if (index === 0) {
          return {
            ...day,
            workouts: [
              buildWorkoutCard({ id: 'a', title: 'Primero', dominantZone: 2 }),
              buildWorkoutCard({ id: 'b', title: 'Segundo', dominantZone: null }),
            ],
          };
        }
        if (index === 2) {
          return { ...day, isToday: true, workouts: [buildWorkoutCard({ id: 'c', title: 'Hoy' })] };
        }
        return day;
      }),
    });
  }

  const stripButtons = () =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('[role="group"] button'));

  it('muestra una tira de siete días con un punto por entrenamiento', () => {
    host.week.set(weekWithWorkouts());
    fixture.detectChanges();

    expect(stripButtons()).toHaveLength(7);
    expect(stripButtons()[0].querySelectorAll('span.size-1\\.5')).toHaveLength(2);
    expect(element.querySelector('[data-testid^="week-day-"]')).not.toBeNull();
    expect(element.querySelectorAll('ol')).toHaveLength(0);
  });

  it('selecciona hoy por defecto y lista sus entrenamientos', () => {
    host.week.set(weekWithWorkouts());
    fixture.detectChanges();

    expect(stripButtons()[2].getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('[data-testid="week-day-2026-05-13"]')?.textContent).toContain(
      'Hoy',
    );
  });

  it('cambia la lista al elegir otro día', () => {
    host.week.set(weekWithWorkouts());
    fixture.detectChanges();

    stripButtons()[0].click();
    fixture.detectChanges();

    const list = element.querySelector('[data-testid="week-day-2026-05-11"]');
    expect(stripButtons()[0].getAttribute('aria-pressed')).toBe('true');
    expect(list?.textContent).toContain('Primero');
    expect(list?.textContent).toContain('Segundo');
    expect(list?.textContent).toContain('2 entrenamientos');
  });

  it('pide crear un entrenamiento para el día elegido', () => {
    fixture.detectChanges();

    stripButtons()[3].click();
    fixture.detectChanges();
    element
      .querySelector<HTMLButtonElement>('[aria-label="Agregar entrenamiento el 2026-05-14"]')
      ?.click();

    expect(host.createRequested).toEqual(['2026-05-14']);
  });

  it('abre un entrenamiento desde la lista del día', () => {
    host.week.set(weekWithWorkouts());
    fixture.detectChanges();

    element
      .querySelector<HTMLElement>('[data-testid="week-day-2026-05-13"] app-workout-card button')
      ?.click();

    expect(host.opened).toEqual(['c']);
  });
});
