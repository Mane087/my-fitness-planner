import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { readText } from '../../components/workout-step-editor/step-input.utils';
import {
  SPORTS,
  WORKOUT_CATEGORIES,
  WORKOUT_CATEGORIES_BY_SPORT,
  type Sport,
  type WorkoutCategory,
} from '../../core/domain/workout.enums';
import type {
  LibraryFilters,
  WorkoutTemplateCardViewModel,
} from '../../core/models/library-view-models';
import { SPORT_LABELS, WORKOUT_CATEGORY_LABELS } from '../../core/models/workout-labels';
import { ModalComponent } from '../../layouts/modal/modal.component';
import { LibraryFacade } from './library.facade';

const SAVED_MESSAGES: Record<string, string> = {
  created: 'Plantilla guardada correctamente.',
  updated: 'Plantilla actualizada correctamente.',
};

@Component({
  selector: 'app-library-page',
  imports: [NgClass, RouterLink, ModalComponent],
  templateUrl: './library-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPageComponent {
  private readonly facade = inject(LibraryFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(
    SAVED_MESSAGES[this.route.snapshot.queryParamMap.get('saved') ?? ''] ?? null,
  );
  readonly templates = signal<WorkoutTemplateCardViewModel[]>([]);
  /** False when the library is empty, so the page shows the first-template call to action. */
  readonly hasTemplates = signal(false);
  readonly filters = signal<LibraryFilters>({
    sport: null,
    category: null,
    shouldIncludeArchived: false,
  });

  readonly scheduling = signal<WorkoutTemplateCardViewModel | null>(null);
  readonly scheduleDate = signal('');
  readonly scheduleError = signal<string | null>(null);
  readonly isScheduling = signal(false);

  readonly sportOptions = SPORTS.map((sport) => ({ value: sport, label: SPORT_LABELS[sport] }));
  readonly categoryOptions = computed(() => {
    const sport = this.filters().sport;
    return (sport ? WORKOUT_CATEGORIES_BY_SPORT[sport] : WORKOUT_CATEGORIES).map((category) => ({
      value: category,
      label: WORKOUT_CATEGORY_LABELS[category],
    }));
  });

  constructor() {
    void this.load();
  }

  async setSport(event: Event): Promise<void> {
    const sport = (readText(event) || null) as Sport | null;
    this.filters.update((filters) => ({
      ...filters,
      sport,
      // A category that the new sport does not use would leave the list empty.
      category:
        sport && filters.category && !WORKOUT_CATEGORIES_BY_SPORT[sport].includes(filters.category)
          ? null
          : filters.category,
    }));
    await this.load();
  }

  async setCategory(event: Event): Promise<void> {
    const category = (readText(event) || null) as WorkoutCategory | null;
    this.filters.update((filters) => ({ ...filters, category }));
    await this.load();
  }

  async setShowArchived(event: Event): Promise<void> {
    const shouldIncludeArchived = (event.target as HTMLInputElement).checked;
    this.filters.update((filters) => ({ ...filters, shouldIncludeArchived }));
    await this.load();
  }

  async archive(template: WorkoutTemplateCardViewModel): Promise<void> {
    await this.runAction(
      () => this.facade.archive(template.id),
      `Se archivó "${template.title}". Los entrenamientos ya programados no cambian.`,
    );
  }

  async restore(template: WorkoutTemplateCardViewModel): Promise<void> {
    await this.runAction(
      () => this.facade.restore(template.id),
      `Se restauró "${template.title}".`,
    );
  }

  openSchedule(template: WorkoutTemplateCardViewModel): void {
    this.scheduleDate.set(this.facade.today());
    this.scheduleError.set(null);
    this.scheduling.set(template);
  }

  setScheduleDate(event: Event): void {
    this.scheduleDate.set(readText(event));
    this.scheduleError.set(null);
  }

  closeSchedule(): void {
    if (!this.isScheduling()) this.scheduling.set(null);
  }

  async confirmSchedule(): Promise<void> {
    const template = this.scheduling();
    const date = this.scheduleDate();
    if (!template) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      this.scheduleError.set('Selecciona la fecha del entrenamiento.');
      return;
    }

    this.isScheduling.set(true);
    try {
      const workout = await this.facade.schedule(template.id, date);
      await this.router.navigate(['/calendar'], {
        queryParams: { date: workout.scheduledDate, saved: 'scheduled' },
      });
    } catch {
      this.scheduleError.set('No se pudo programar la plantilla. Intenta nuevamente.');
    } finally {
      this.isScheduling.set(false);
    }
  }

  private async runAction(action: () => Promise<void>, successMessage: string): Promise<void> {
    try {
      await action();
      this.statusMessage.set(successMessage);
      await this.load();
    } catch {
      this.errorMessage.set('No se pudo actualizar la plantilla. Intenta nuevamente.');
    }
  }

  private async load(): Promise<void> {
    this.errorMessage.set(null);

    try {
      const [templates, hasTemplates] = await Promise.all([
        this.facade.loadTemplates(this.filters()),
        this.facade.hasTemplates(),
      ]);
      this.templates.set(templates);
      this.hasTemplates.set(hasTemplates);
    } catch {
      this.errorMessage.set('No se pudo cargar la biblioteca. Intenta nuevamente.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
