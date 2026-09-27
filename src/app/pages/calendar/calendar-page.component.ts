import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import type { CalendarMonthViewModel } from '../../core/models/calendar-view-models';
import { CalendarFacade } from '../../core/services/calendar-facade.service';
import { ButtonComponent } from '../../components/button/button.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [NgClass, ButtonComponent],
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

  constructor() {
    const selectedDate = this.route.snapshot.queryParamMap.get('date');
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

  openWorkout(workoutId: string): void {
    this.calendarFacade.openWorkout(workoutId);
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
