import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { CalendarDefaultView } from '../../core/domain/calendar.enums';
import type { ScheduledWorkoutEntity } from '../../core/domain/schemas/scheduled-workout.schema';
import { WorkoutStatus } from '../../core/domain/workout.enums';
import type {
  CalendarMonthViewModel,
  CalendarWeekViewModel,
  WeeklySummaryViewModel,
  WorkoutRelocation,
} from '../../core/models/calendar-view-models';
import { CalendarFacade } from '../../core/services/calendar-facade.service';
import { ButtonComponent } from '../../components/button/button.component';
import { ModalComponent } from '../../layouts/modal/modal.component';
import { CalendarWeekViewComponent } from './calendar-week-view.component';
import { WorkoutCardComponent } from './workout-card.component';
import { WorkoutDetailModalComponent } from './workout-detail-modal.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    NgClass,
    ButtonComponent,
    CalendarWeekViewComponent,
    ModalComponent,
    WorkoutCardComponent,
    WorkoutDetailModalComponent,
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPageComponent {
  private readonly calendarFacade = inject(CalendarFacade);
  private readonly route = inject(ActivatedRoute);

  readonly view = signal<CalendarDefaultView>(CalendarDefaultView.Month);
  readonly viewOptions = [
    { value: CalendarDefaultView.Month, label: 'Mes' },
    { value: CalendarDefaultView.Week, label: 'Semana' },
  ];
  readonly calendar = signal<CalendarMonthViewModel | null>(null);
  readonly week = signal<CalendarWeekViewModel | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly userName = computed(
    () => (this.view() === 'week' ? this.week() : this.calendar())?.userName ?? 'Usuario',
  );
  readonly currentMonth = computed(() => this.calendar());
  readonly successMessage = signal<string | null>(null);
  readonly weeklySummary = signal<WeeklySummaryViewModel | null>(null);
  readonly weeklySummaryError = signal<string | null>(null);
  readonly selectedWorkout = signal<ScheduledWorkoutEntity | null>(null);
  /** Move of a completed workout that waits for confirmation. */
  readonly pendingRelocation = signal<WorkoutRelocation | null>(null);
  readonly relocationError = signal<string | null>(null);
  readonly pendingRelocationDate = computed(() => {
    const relocation = this.pendingRelocation();
    return relocation ? this.calendarFacade.formatShortDate(relocation.targetDate) : '';
  });
  /** Day inside the week shown by the week view and the weekly summary. */
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
          : saved === 'scheduled'
            ? 'Plantilla programada correctamente.'
            : null,
    );
    void this.initialize(selectedDate);
  }

  /** Switches the view and stores it as the default one. */
  async setView(view: CalendarDefaultView): Promise<void> {
    if (view === this.view()) return;

    this.view.set(view);
    void this.calendarFacade.saveDefaultView(view).catch(() => undefined);

    if (view === CalendarDefaultView.Week) {
      await this.loadWeek();
    } else {
      // The month view opens on the month of the week that was shown.
      const reference = this.weekReference();
      await this.load(() => this.calendarFacade.loadMonth(reference));
    }
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

  async goToCurrentWeek(): Promise<void> {
    this.weekReference.set(this.calendarFacade.today());
    await Promise.all([this.loadWeek(), this.loadWeeklySummary()]);
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
    await this.refresh();
  }

  /** Moves or copies a workout. Moving a completed workout asks for confirmation first. */
  async requestRelocation(relocation: WorkoutRelocation): Promise<void> {
    this.selectedWorkout.set(null);
    this.relocationError.set(null);

    if (relocation.mode === 'move' && relocation.workout.status === WorkoutStatus.Completed) {
      this.pendingRelocation.set(relocation);
      return;
    }

    await this.relocate(relocation);
  }

  async confirmRelocation(): Promise<void> {
    const relocation = this.pendingRelocation();
    this.pendingRelocation.set(null);
    if (relocation) await this.relocate(relocation);
  }

  cancelRelocation(): void {
    this.pendingRelocation.set(null);
  }

  async goToPreviousWeek(): Promise<void> {
    await this.shiftWeek(-1);
  }

  async goToNextWeek(): Promise<void> {
    await this.shiftWeek(1);
  }

  private async initialize(selectedDate: string | null): Promise<void> {
    try {
      this.view.set(await this.calendarFacade.loadDefaultView());
    } catch {
      this.view.set(CalendarDefaultView.Month);
    }

    if (this.view() === CalendarDefaultView.Week) {
      await this.loadWeek();
      return;
    }

    await (selectedDate
      ? this.load(() => this.calendarFacade.loadMonth(selectedDate))
      : this.loadCurrentMonth());
  }

  private async shiftWeek(weeks: number): Promise<void> {
    this.weekReference.update((date) => this.calendarFacade.shiftWeek(date, weeks));
    await Promise.all([
      this.view() === CalendarDefaultView.Week ? this.loadWeek() : null,
      this.loadWeeklySummary(),
    ]);
  }

  private async relocate(relocation: WorkoutRelocation): Promise<void> {
    const { workout, targetDate, mode } = relocation;

    try {
      await (mode === 'move'
        ? this.calendarFacade.moveWorkout(workout.id, targetDate)
        : this.calendarFacade.copyWorkout(workout.id, targetDate));
      const date = this.calendarFacade.formatShortDate(targetDate);
      this.successMessage.set(
        mode === 'move'
          ? `Se movió "${workout.title}" al ${date}.`
          : `Se copió "${workout.title}" al ${date}.`,
      );
      await this.refresh();
    } catch {
      this.relocationError.set(
        mode === 'move'
          ? 'No se pudo mover el entrenamiento. Intenta nuevamente.'
          : 'No se pudo copiar el entrenamiento. Intenta nuevamente.',
      );
    }
  }

  private async loadWeeklySummary(): Promise<void> {
    this.weeklySummaryError.set(null);

    try {
      this.weeklySummary.set(await this.calendarFacade.loadWeeklySummary(this.weekReference()));
    } catch {
      this.weeklySummaryError.set('No se pudo cargar el resumen semanal.');
    }
  }

  /**
   * Reloads the visible view and the summary without the loading state, so an open detail is not
   * interrupted.
   */
  private async refresh(): Promise<void> {
    const current = this.calendar();

    await Promise.all([
      this.view() === CalendarDefaultView.Week
        ? this.reloadWeek()
        : current
          ? this.reloadMonth(`${current.year}-${String(current.month).padStart(2, '0')}-01`)
          : null,
      this.loadWeeklySummary(),
    ]);
  }

  private async reloadMonth(referenceDate: string): Promise<void> {
    try {
      this.calendar.set(await this.calendarFacade.loadMonth(referenceDate));
    } catch {
      this.errorMessage.set('No se pudo cargar el calendario. Intenta nuevamente.');
    }
  }

  private async reloadWeek(): Promise<void> {
    try {
      this.week.set(await this.calendarFacade.loadWeek(this.weekReference()));
    } catch {
      this.errorMessage.set('No se pudo cargar el calendario. Intenta nuevamente.');
    }
  }

  private async loadWeek(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    await this.reloadWeek();
    this.isLoading.set(false);
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
