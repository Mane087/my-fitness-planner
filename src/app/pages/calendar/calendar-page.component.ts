import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import type { ScheduledWorkoutEntity } from '../../core/domain/schemas/scheduled-workout.schema';
import type {
  CalendarMonthViewModel,
  WeeklySummaryViewModel,
} from '../../core/models/calendar-view-models';
import { CalendarFacade } from '../../core/services/calendar-facade.service';
import { ButtonComponent } from '../../components/button/button.component';
import { WorkoutDetailModalComponent } from './workout-detail-modal.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [NgClass, ButtonComponent, WorkoutDetailModalComponent],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPageComponent {
  private readonly calendarFacade = inject(CalendarFacade);
  private readonly route = inject(ActivatedRoute);

  readonly calendar = signal<CalendarMonthViewModel | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly userName = computed(() => this.calendar()?.userName ?? 'Usuario');
  readonly currentMonth = computed(() => this.calendar());
  readonly successMessage = signal<string | null>(null);
  readonly weeklySummary = signal<WeeklySummaryViewModel | null>(null);
  readonly weeklySummaryError = signal<string | null>(null);
  readonly selectedWorkout = signal<ScheduledWorkoutEntity | null>(null);
  private readonly weekReference = signal('');

  constructor() {
    const selectedDate = this.route.snapshot.queryParamMap.get('date');
    this.weekReference.set(selectedDate ?? this.calendarFacade.today());
    void this.loadWeeklySummary();
    const saved = this.route.snapshot.queryParamMap.get('saved');
    this.successMessage.set(
      saved === 'created'
        ? 'Entrenamiento guardado correctamente.'
        : saved === 'updated'
          ? 'Entrenamiento actualizado correctamente.'
          : null,
    );
    void (selectedDate
      ? this.load(() => this.calendarFacade.loadMonth(selectedDate))
      : this.loadCurrentMonth());
  }

  async loadCurrentMonth(): Promise<void> {
    await this.load(() => this.calendarFacade.goToCurrentMonth());
  }

  async goToPreviousMonth(): Promise<void> {
    const current = this.calendar();

    if (!current) {
      return;
    }

    await this.load(() => this.calendarFacade.goToPreviousMonth(current.year, current.month));
  }

  async goToNextMonth(): Promise<void> {
    const current = this.calendar();

    if (!current) {
      return;
    }

    await this.load(() => this.calendarFacade.goToNextMonth(current.year, current.month));
  }

  createWorkoutForDate(date: string): void {
    this.calendarFacade.createWorkoutForDate(date);
  }

  async openWorkout(workoutId: string): Promise<void> {
    this.selectedWorkout.set(await this.calendarFacade.findWorkout(workoutId));
  }

  editWorkout(workoutId: string): void {
    this.calendarFacade.openWorkout(workoutId);
  }

  closeWorkout(): void {
    this.selectedWorkout.set(null);
  }

  /** Keeps the detail open with the new status and refreshes the grid and the summary. */
  async onWorkoutChanged(workout: ScheduledWorkoutEntity): Promise<void> {
    this.selectedWorkout.set(workout);
    const current = this.calendar();

    await Promise.all([
      current ? this.refresh(`${current.year}-${String(current.month).padStart(2, '0')}-01`) : null,
      this.loadWeeklySummary(),
    ]);
  }

  async goToPreviousWeek(): Promise<void> {
    this.weekReference.update((date) => this.calendarFacade.shiftWeek(date, -1));
    await this.loadWeeklySummary();
  }

  async goToNextWeek(): Promise<void> {
    this.weekReference.update((date) => this.calendarFacade.shiftWeek(date, 1));
    await this.loadWeeklySummary();
  }

  private async loadWeeklySummary(): Promise<void> {
    this.weeklySummaryError.set(null);

    try {
      this.weeklySummary.set(await this.calendarFacade.loadWeeklySummary(this.weekReference()));
    } catch {
      this.weeklySummaryError.set('No se pudo cargar el resumen semanal.');
    }
  }

  /** Reloads the month without the loading state, so the open detail is not interrupted. */
  private async refresh(referenceDate: string): Promise<void> {
    try {
      this.calendar.set(await this.calendarFacade.loadMonth(referenceDate));
    } catch {
      this.errorMessage.set('No se pudo cargar el calendario. Intenta nuevamente.');
    }
  }

  private async load(loader: () => Promise<CalendarMonthViewModel>): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.calendar.set(await loader());
    } catch {
      this.errorMessage.set('No se pudo cargar el calendario. Intenta nuevamente.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
