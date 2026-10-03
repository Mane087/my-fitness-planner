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
    userName: 'Manuel',
    days: dates.map((date, index) => ({
      date,
      weekdayLabel: `Día ${index}`,
      dateLabel: date,
      isToday: false,
      workouts: [],
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
});
