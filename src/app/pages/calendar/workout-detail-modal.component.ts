import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { readNumber, readText } from '../../components/workout-step-editor/step-input.utils';
import { DomainValidationError } from '../../core/domain/domain-validation.error';
import {
  workoutCompletionSchema,
  type ScheduledWorkoutEntity,
} from '../../core/domain/schemas/scheduled-workout.schema';
import { WorkoutStatus } from '../../core/domain/workout.enums';
import type {
  WorkoutRelocation,
  WorkoutRelocationMode,
} from '../../core/models/calendar-view-models';
import {
  SPORT_LABELS,
  WORKOUT_CATEGORY_LABELS,
  WORKOUT_STATUS_LABELS,
} from '../../core/models/workout-labels';
import { CalendarDateService } from '../../core/services/calendar-date.service';
import {
  WorkoutCompletionService,
  type WorkoutCompletionInput,
} from '../../core/services/workout-completion.service';
import { ModalComponent } from '../../layouts/modal/modal.component';

type ModalView = 'detail' | 'confirm-future' | 'complete' | 'relocate';

interface CompletionDraft {
  durationMinutes: number | null;
  distanceKm: number | null;
  rpe: number | null;
  feeling: number | null;
  notes: string;
}

const completionInputSchema = workoutCompletionSchema.omit({ completedAt: true });

/**
 * Detail of a scheduled workout with its actions: complete, skip, reopen, edit, and move or copy
 * to another day. Moving and copying are emitted, so the calendar confirms and runs them.
 */
@Component({
  selector: 'app-workout-detail-modal',
  imports: [ModalComponent],
  templateUrl: './workout-detail-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutDetailModalComponent {
  private readonly completionService = inject(WorkoutCompletionService);
  private readonly calendarDate = inject(CalendarDateService);

  readonly workout = input<ScheduledWorkoutEntity | null>(null);

  /** Emits the workout after a status change so the calendar can refresh. */
  readonly changed = output<ScheduledWorkoutEntity>();
  readonly edit = output<string>();
  readonly closed = output<void>();
  readonly relocated = output<WorkoutRelocation>();

  readonly view = signal<ModalView>('detail');
  readonly draft = signal<CompletionDraft>(emptyDraft());
  readonly errors = signal<string[]>([]);
  readonly isBusy = signal(false);
  readonly relocationMode = signal<WorkoutRelocationMode>('move');
  readonly relocationDate = signal('');

  readonly feelingOptions = [1, 2, 3, 4, 5];

  readonly statusLabel = computed(() => {
    const workout = this.workout();
    return workout ? WORKOUT_STATUS_LABELS[workout.status] : '';
  });
  readonly subtitle = computed(() => {
    const workout = this.workout();
    return workout
      ? `${SPORT_LABELS[workout.sport]} · ${WORKOUT_CATEGORY_LABELS[workout.category]} · ${this.calendarDate.formatShortDate(workout.scheduledDate)}`
      : '';
  });
  readonly plannedLabel = computed(() => {
    const workout = this.workout();
    return workout
      ? this.durationAndDistance(workout.plannedDurationSeconds, workout.plannedDistanceMeters)
      : '';
  });
  readonly actualLabel = computed(() => {
    const completion = this.workout()?.completion;
    return completion
      ? this.durationAndDistance(completion.durationSeconds, completion.distanceMeters)
      : '';
  });
  readonly isPlanned = computed(() => this.workout()?.status === WorkoutStatus.Planned);
  readonly isCompleted = computed(() => this.workout()?.status === WorkoutStatus.Completed);
  readonly isFuture = computed(() => {
    const workout = this.workout();
    return workout !== null && workout.scheduledDate > this.calendarDate.today();
  });

  /** Opens the completion form, after a confirmation when the workout is in the future. */
  startCompletion(): void {
    this.errors.set([]);

    if (this.isFuture() && !this.isCompleted()) {
      this.view.set('confirm-future');
      return;
    }

    this.openCompletionForm();
  }

  openCompletionForm(): void {
    const workout = this.workout();
    if (!workout) return;

    const completion = workout.completion;
    const durationSeconds = completion?.durationSeconds ?? workout.plannedDurationSeconds;
    const distanceMeters = completion?.distanceMeters ?? workout.plannedDistanceMeters;

    this.draft.set({
      durationMinutes: durationSeconds > 0 ? Math.round(durationSeconds / 60) : null,
      distanceKm: distanceMeters !== undefined ? distanceMeters / 1000 : null,
      rpe: completion?.rpe ?? null,
      feeling: completion?.feeling ?? null,
      notes: completion?.notes ?? '',
    });
    this.view.set('complete');
  }

  backToDetail(): void {
    this.errors.set([]);
    this.view.set('detail');
  }

  setNumber(field: 'durationMinutes' | 'distanceKm' | 'rpe', event: Event): void {
    this.updateDraft({ [field]: readNumber(event) });
  }

  setFeeling(feeling: number): void {
    this.updateDraft({ feeling });
  }

  setNotes(event: Event): void {
    this.updateDraft({ notes: readText(event) });
  }

  async saveCompletion(): Promise<void> {
    const workout = this.workout();
    if (!workout) return;

    const input = toCompletionInput(this.draft());
    const result = completionInputSchema.safeParse(input);

    if (!result.success) {
      this.errors.set([...new Set(result.error.issues.map((issue) => issue.message))]);
      return;
    }

    await this.run(() => this.completionService.complete(workout.id, input));
  }

  async skip(): Promise<void> {
    const workout = this.workout();
    if (workout) await this.run(() => this.completionService.skip(workout.id));
  }

  async reopen(): Promise<void> {
    const workout = this.workout();
    if (workout) await this.run(() => this.completionService.reopen(workout.id));
  }

  startRelocation(mode: WorkoutRelocationMode): void {
    const workout = this.workout();
    if (!workout) return;

    this.errors.set([]);
    this.relocationMode.set(mode);
    this.relocationDate.set(workout.scheduledDate);
    this.view.set('relocate');
  }

  setRelocationDate(event: Event): void {
    this.relocationDate.set(readText(event));
    this.errors.set([]);
  }

  confirmRelocation(): void {
    const workout = this.workout();
    if (!workout) return;

    const targetDate = this.relocationDate();
    const mode = this.relocationMode();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      this.errors.set(['Selecciona la fecha.']);
      return;
    }

    if (mode === 'move' && targetDate === workout.scheduledDate) {
      this.errors.set(['Selecciona una fecha distinta a la actual.']);
      return;
    }

    this.view.set('detail');
    this.relocated.emit({
      workout: {
        id: workout.id,
        title: workout.title,
        status: workout.status,
        scheduledDate: workout.scheduledDate,
      },
      targetDate,
      mode,
    });
  }

  requestEdit(): void {
    const workout = this.workout();
    if (workout) this.edit.emit(workout.id);
  }

  /** Escape or a click outside closes the detail, except while a status change is saving. */
  dismiss(): void {
    if (!this.isBusy()) this.close();
  }

  close(): void {
    this.view.set('detail');
    this.errors.set([]);
    this.closed.emit();
  }

  /** Errors belong to the last save attempt, so editing a field clears them. */
  private updateDraft(change: Partial<CompletionDraft>): void {
    this.draft.update((draft) => ({ ...draft, ...change }));
    this.errors.set([]);
  }

  private async run(task: () => Promise<ScheduledWorkoutEntity>): Promise<void> {
    this.isBusy.set(true);
    this.errors.set([]);

    try {
      this.changed.emit(await task());
      this.view.set('detail');
    } catch (error) {
      this.errors.set([
        error instanceof DomainValidationError && error.issues[0]
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : 'No se pudo actualizar el entrenamiento.',
      ]);
    } finally {
      this.isBusy.set(false);
    }
  }

  private durationAndDistance(seconds: number | undefined, meters: number | undefined): string {
    const duration = this.calendarDate.formatDuration(Math.round((seconds ?? 0) / 60));
    return meters === undefined
      ? duration
      : `${duration} · ${this.calendarDate.formatDistance(meters / 1000)}`;
  }
}

function emptyDraft(): CompletionDraft {
  return { durationMinutes: null, distanceKm: null, rpe: null, feeling: null, notes: '' };
}

/** Converts the form units (minutes, km) to domain units and leaves out empty fields. */
function toCompletionInput(draft: CompletionDraft): WorkoutCompletionInput {
  return {
    ...(draft.durationMinutes !== null
      ? { durationSeconds: Math.round(draft.durationMinutes * 60) }
      : {}),
    ...(draft.distanceKm !== null ? { distanceMeters: Math.round(draft.distanceKm * 1000) } : {}),
    ...(draft.rpe !== null ? { rpe: draft.rpe } : {}),
    ...(draft.feeling !== null ? { feeling: draft.feeling } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
  };
}
