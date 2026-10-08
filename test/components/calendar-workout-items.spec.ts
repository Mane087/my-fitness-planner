import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Sport, WorkoutCategory, WorkoutStatus } from '../../src/app/core/domain/workout.enums';
import type {
  CalendarWorkoutCardViewModel,
  WeekHeaderSummaryViewModel,
} from '../../src/app/core/models/calendar-view-models';
import { MonthWorkoutChipComponent } from '../../src/app/pages/calendar/month-workout-chip.component';
import { WeekSummaryComponent } from '../../src/app/pages/calendar/week-summary.component';
import { WorkoutCardComponent } from '../../src/app/pages/calendar/workout-card.component';
import { heartRateSnapshot, heartRateTarget, interval } from '../domain/fixtures';

function buildCard(
  overrides: Partial<CalendarWorkoutCardViewModel> = {},
): CalendarWorkoutCardViewModel {
  return {
    id: 'workout-1',
    title: 'Rodaje Z2',
    scheduledDate: '2026-05-05',
    sport: Sport.Cycling,
    sportLabel: 'Ciclismo',
    category: WorkoutCategory.Endurance,
    categoryLabel: 'Resistencia',
    durationLabel: '1 h 20 min',
    distanceLabel: '38 km',
    colorClass: 'border-l-indigo-500',
    status: WorkoutStatus.Planned,
    statusLabel: 'Planeado',
    actualDurationLabel: null,
    actualDistanceLabel: null,
    hasPlannedDistance: true,
    steps: [
      interval('a', {
        duration: { type: 'time', seconds: 600 },
        target: heartRateTarget({ zoneSnapshot: heartRateSnapshot({ name: 'Z2 Resistencia' }) }),
      }),
    ],
    durationClock: '1:20',
    distanceKmLabel: '38',
    summaryText: null,
    dominantZone: 2,
    ...overrides,
  };
}

@Component({
  imports: [WorkoutCardComponent, MonthWorkoutChipComponent],
  template: `
    <app-workout-card [workout]="workout()" [layout]="layout()" (opened)="opened.push($event)" />
    <app-month-workout-chip [workout]="workout()" (opened)="chipOpened.push($event)" />
  `,
})
class WorkoutItemsHostComponent {
  readonly workout = signal(buildCard());
  readonly layout = signal<'column' | 'day'>('column');
  readonly opened: string[] = [];
  readonly chipOpened: string[] = [];
}

describe('WorkoutCardComponent and MonthWorkoutChipComponent', () => {
  let fixture: ComponentFixture<WorkoutItemsHostComponent>;
  let host: WorkoutItemsHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkoutItemsHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const card = () => element.querySelector('app-workout-card button') as HTMLButtonElement;
  const chip = () => element.querySelector('app-month-workout-chip button') as HTMLButtonElement;

  it('shows category, title, profile, planned clock and distance', () => {
    expect(card().textContent).toContain('Resistencia');
    expect(card().textContent).toContain('Rodaje Z2');
    expect(card().textContent).toContain('1:20');
    expect(card().textContent).toContain('38 km');
    expect(card().querySelectorAll('app-workout-profile rect')).toHaveLength(1);
    expect(card().getAttribute('aria-label')).toBe('Rodaje Z2, Planeado');
  });

  it('shows the summary text instead of the profile for exercise workouts', () => {
    host.workout.set(buildCard({ steps: [], summaryText: '8 ejercicios', distanceKmLabel: null }));
    fixture.detectChanges();

    expect(card().textContent).toContain('8 ejercicios');
    expect(card().querySelector('app-workout-profile svg')).toBeNull();
    expect(card().textContent).not.toContain(' km');
  });

  it('marks a completed workout with a green left border, a check and the actual values', () => {
    host.workout.set(
      buildCard({
        status: WorkoutStatus.Completed,
        statusLabel: 'Completado',
        actualDurationLabel: '50 min',
        actualDistanceLabel: '25 km',
      }),
    );
    fixture.detectChanges();

    expect(card().className).toContain('border-l-status-success');
    expect(card().querySelector('app-ui-icon svg')).not.toBeNull();
    expect(card().textContent).toContain('Real: 50 min');
    expect(card().textContent).toContain('25 km');
    expect(chip().className).toContain('bg-status-success-subtle');
  });

  it('dims a skipped workout and shows its status', () => {
    host.workout.set(buildCard({ status: WorkoutStatus.Skipped, statusLabel: 'Omitido' }));
    fixture.detectChanges();

    expect(card().className).toContain('opacity-60');
    expect(card().textContent).toContain('Omitido');
    expect(chip().className).toContain('opacity-50');
  });

  it('emits the workout id when the card or the chip is clicked', () => {
    card().click();
    chip().click();

    expect(host.opened).toEqual(['workout-1']);
    expect(host.chipOpened).toEqual(['workout-1']);
  });

  it('uses a taller profile in the day layout', () => {
    host.layout.set('day');
    fixture.detectChanges();

    expect(element.querySelector('app-workout-profile')?.className).toContain('h-11');
  });

  it('shows title, planned clock and an accessible name in the month chip', () => {
    expect(chip().textContent).toContain('Rodaje Z2');
    expect(chip().textContent).toContain('1:20');
    expect(chip().getAttribute('aria-label')).toBe('Rodaje Z2, Planeado');
  });
});

@Component({
  imports: [WeekSummaryComponent],
  template: '<app-week-summary [summary]="summary()" />',
})
class WeekSummaryHostComponent {
  readonly summary = signal<WeekHeaderSummaryViewModel>({
    duration: { actualLabel: '1:40', plannedLabel: '8:05', percent: 21 },
    distance: { actualLabel: '38', plannedLabel: '192', percent: 20 },
    completed: { done: 2, total: 7, percent: 28.6 },
    zones: [
      { zone: 2, percent: 75 },
      { zone: 4, percent: 25 },
    ],
    zonesCaption: 'Z2 domina la semana (75 %). Intensidad alta: 25 %.',
  });
}

describe('WeekSummaryComponent', () => {
  it('shows planned against completed totals with progress and the zone distribution', () => {
    const fixture = TestBed.createComponent(WeekSummaryHostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('1:40');
    expect(element.textContent).toContain('/ 8:05 h');
    expect(element.textContent).toContain('/ 192 km');
    expect(element.textContent).toContain('/ 7');
    expect(
      Array.from(element.querySelectorAll('[role="progressbar"]')).map((bar) =>
        bar.getAttribute('aria-valuenow'),
      ),
    ).toEqual(['21', '20', '29']);

    const zoneBars = element.querySelectorAll('[data-testid="week-summary-zones"] span[title]');
    expect(Array.from(zoneBars).map((bar) => bar.getAttribute('title'))).toEqual(['Z2', 'Z4']);
    expect(element.textContent).toContain('Z2 domina la semana (75 %)');
  });

  it('hides the zone block when no step has a zone', () => {
    const fixture = TestBed.createComponent(WeekSummaryHostComponent);
    fixture.componentInstance.summary.update((summary) => ({
      ...summary,
      zones: [],
      zonesCaption: null,
    }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="week-summary-zones"]')).toBeNull();
  });
});
