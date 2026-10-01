import { inject, Injectable } from '@angular/core';

import type { ScheduledWorkoutEntity } from '../../core/domain/schemas/scheduled-workout.schema';
import type { WorkoutTemplateEntity } from '../../core/domain/schemas/workout-template.schema';
import type {
  LibraryFilters,
  WorkoutTemplateCardViewModel,
} from '../../core/models/library-view-models';
import {
  SPORT_LABELS,
  SPORT_MODALITY_LABELS,
  WORKOUT_CATEGORY_COLOR_CLASSES,
  WORKOUT_CATEGORY_LABELS,
} from '../../core/models/workout-labels';
import { WorkoutTemplateRepository } from '../../core/repositories/workout-template.repository';
import { CalendarDateService } from '../../core/services/calendar-date.service';
import { calculateWorkoutTotals } from '../../core/services/workout-structure.utils';
import { WorkoutTemplateSchedulerService } from '../../core/services/workout-template-scheduler.service';

@Injectable({ providedIn: 'root' })
export class LibraryFacade {
  private readonly templates = inject(WorkoutTemplateRepository);
  private readonly scheduler = inject(WorkoutTemplateSchedulerService);
  private readonly calendarDate = inject(CalendarDateService);

  async loadTemplates(filters: LibraryFilters): Promise<WorkoutTemplateCardViewModel[]> {
    const templates = await this.templates.findFiltered({
      sport: filters.sport,
      shouldIncludeArchived: filters.shouldIncludeArchived,
    });

    return templates
      .filter((template) => !filters.category || template.category === filters.category)
      .map((template) => this.toCard(template));
  }

  /** True when the library has at least one template, archived or not. */
  async hasTemplates(): Promise<boolean> {
    return (await this.templates.findAll()).length > 0;
  }

  archive(templateId: string): Promise<void> {
    return this.templates.archive(templateId);
  }

  restore(templateId: string): Promise<void> {
    return this.templates.restore(templateId);
  }

  /** Copies the template to the date; editing the template later does not change the copy. */
  schedule(templateId: string, scheduledDate: string): Promise<ScheduledWorkoutEntity> {
    return this.scheduler.scheduleTemplate(templateId, scheduledDate);
  }

  today(): string {
    return this.calendarDate.today();
  }

  private toCard(template: WorkoutTemplateEntity): WorkoutTemplateCardViewModel {
    const sportLabel = SPORT_LABELS[template.sport];
    const stepCount = calculateWorkoutTotals(template.steps).stepCount;

    return {
      id: template.id,
      title: template.title,
      sport: template.sport,
      sportLabel: template.modality
        ? `${sportLabel} ${SPORT_MODALITY_LABELS[template.modality]}`
        : sportLabel,
      category: template.category,
      categoryLabel: WORKOUT_CATEGORY_LABELS[template.category],
      colorClass: WORKOUT_CATEGORY_COLOR_CLASSES[template.category],
      durationLabel: this.calendarDate.formatDuration(
        Math.round(template.plannedDurationSeconds / 60),
      ),
      distanceLabel: this.calendarDate.formatDistance(
        template.plannedDistanceMeters !== undefined ? template.plannedDistanceMeters / 1000 : null,
      ),
      stepCountLabel: `${stepCount} ${stepCount === 1 ? 'paso' : 'pasos'}`,
      objective: template.objective ?? null,
      isArchived: template.isArchived,
    };
  }
}
