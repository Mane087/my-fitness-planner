// ANGULAR IMPORTS
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { merge } from 'rxjs';

// IMPORT TYPES
import type { TrainingZoneSetEntity } from '../../core/domain/schemas/training-zone-set.schema';
import type { WorkoutStep } from '../../core/domain/schemas/workout-step.schema';
import {
  INTENSITY_METRICS,
  IntensityMetric,
  SPORT_MODALITIES,
  SPORTS,
  Sport,
  supportsZoneMetric,
  WORKOUT_CATEGORIES_BY_SPORT,
  type SportModality,
  type WorkoutCategory,
} from '../../core/domain/workout.enums';
import type {
  TrainingSessionFormKind,
  TrainingSessionFormValue,
} from '../../core/models/training-session-form.model';
import {
  INTENSITY_METRIC_LABELS,
  SPORT_LABELS,
  SPORT_MODALITY_LABELS,
  WORKOUT_CATEGORY_LABELS,
} from '../../core/models/workout-labels';
import type { Options } from '../../core/models/option';

// IMPORT UTILS
import { clearIncompatibleTargets } from '../../components/workout-step-editor/workout-step-operations';
import { TrainingSessionFormFacade } from './training-session-form.facade';

// IMPORT COMPONENTS
import { AlertComponent } from '../../components/alert/alert.component';
import { AlertType } from '../../core/models/alert';
import { InputFormComponent } from '../../components/input-form/input-form.component';
import { SelectComponent } from '../../components/select/select.component';
import { WorkoutStepEditorComponent } from '../../components/workout-step-editor/workout-step-editor.component';

const SPORT_ICONS: Partial<Record<Sport, string>> = {
  [Sport.Cycling]: '/icons/road.svg',
};

@Component({
  selector: 'app-training-session-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    InputFormComponent,
    SelectComponent,
    WorkoutStepEditorComponent,
  ],
  templateUrl: './training-session-form-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingSessionFormPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly facade = inject(TrainingSessionFormFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Route data `kind: 'template'` turns the form into the library template form. */
  readonly kind: TrainingSessionFormKind =
    this.route.snapshot.data['kind'] === 'template' ? 'template' : 'workout';
  readonly isTemplate = this.kind === 'template';
  readonly backLink = this.isTemplate
    ? { path: '/library', label: 'Volver a la biblioteca' }
    : { path: '/calendar', label: 'Volver al calendario' };

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly mode = signal<'create' | 'edit'>('create');
  readonly profileAvailable = signal(false);
  readonly zoneSets = signal<TrainingZoneSetEntity[]>([]);
  readonly steps = signal<WorkoutStep[]>([]);
  readonly errors = signal<string[]>([]);
  readonly loadError = signal<string | null>(null);
  /** Step errors are shown only after the first save attempt. */
  readonly hasTriedToSave = signal(false);
  readonly templateSavedMessage = signal('');
  private readonly savedSteps = signal<WorkoutStep[]>([]);

  readonly form = this.formBuilder.group({
    title: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120),
    ]),
    scheduledDate: this.formBuilder.nonNullable.control('', Validators.required),
    sport: this.formBuilder.control<Sport | null>(null, Validators.required),
    modality: this.formBuilder.control<SportModality | null>(null),
    category: this.formBuilder.control<WorkoutCategory | null>(null, Validators.required),
    primaryMetric: this.formBuilder.control<IntensityMetric | null>(null, Validators.required),
    estimatedDurationMinutes: this.formBuilder.control<number | null>(null, Validators.min(1)),
    plannedDistanceKm: this.formBuilder.control<number | null>(null, Validators.min(0.1)),
    objective: this.formBuilder.nonNullable.control('', Validators.maxLength(250)),
    description: this.formBuilder.nonNullable.control('', Validators.maxLength(1000)),
    notes: this.formBuilder.nonNullable.control('', Validators.maxLength(1000)),
  });

  private readonly formChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  readonly selectedSport = computed(() => {
    this.formChanges();
    return this.form.controls.sport.value;
  });
  readonly selectedMetric = computed(() => {
    this.formChanges();
    return this.form.controls.primaryMetric.value;
  });
  readonly zoneSet = computed(() =>
    this.facade.zoneSetFor(this.zoneSets(), this.selectedSport(), this.selectedMetric()),
  );

  readonly sportOptions: Options[] = SPORTS.map((sport) => ({
    value: sport,
    label: SPORT_LABELS[sport],
    ...(SPORT_ICONS[sport] ? { icon: SPORT_ICONS[sport] } : {}),
  }));
  readonly modalityOptions = computed(() => {
    const sport = this.selectedSport();
    return sport
      ? SPORT_MODALITIES[sport].map((modality) => ({
          value: modality,
          label: SPORT_MODALITY_LABELS[modality],
        }))
      : [];
  });
  readonly categoryOptions = computed(() => {
    const sport = this.selectedSport();
    return sport
      ? WORKOUT_CATEGORIES_BY_SPORT[sport].map((category) => ({
          value: category,
          label: WORKOUT_CATEGORY_LABELS[category],
        }))
      : [];
  });
  readonly metricOptions = computed(() => {
    const sport = this.selectedSport();
    return INTENSITY_METRICS.filter(
      (metric) =>
        metric === IntensityMetric.Rpe || (sport !== null && supportsZoneMetric(sport, metric)),
    ).map((metric) => ({ value: metric, label: INTENSITY_METRIC_LABELS[metric] }));
  });

  readonly totalsLabel = computed(() => {
    this.formChanges();
    const totals = this.facade.calculateTotals(
      this.steps(),
      this.form.controls.estimatedDurationMinutes.value,
      this.form.controls.plannedDistanceKm.value,
    );
    const duration = `${Math.round(totals.durationMinutes)} min${totals.isEstimated ? ' (estimado)' : ''}`;
    const distance =
      totals.distanceKm !== null ? ` · ${Math.round(totals.distanceKm * 10) / 10} km` : '';
    return `${duration}${distance}`;
  });
  readonly heading = computed(() => {
    const action = this.mode() === 'create' ? 'Crear' : 'Editar';
    return `${action} ${this.isTemplate ? 'plantilla' : 'entrenamiento'}`;
  });
  readonly selectedDateLabel = computed(() => {
    this.formChanges();
    return this.formatDate(this.form.controls.scheduledDate.value);
  });

  typeAlert = signal<AlertType>('toast-success');
  showSuccessAlert = signal(false);
  readonly alertMessage = signal('');

  constructor() {
    this.form.controls.sport.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sport) => this.alignWithSport(sport));
    merge(this.form.controls.sport.valueChanges, this.form.controls.primaryMetric.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dropIncompatibleTargets());
    if (this.isTemplate) {
      // Templates have no date; the control stays empty.
      this.form.controls.scheduledDate.clearValidators();
      this.form.controls.scheduledDate.updateValueAndValidity({ emitEvent: false });
    }
    void this.load();
  }

  closeSuccessAlert(value: boolean): void {
    this.showSuccessAlert.set(value);
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.hasTriedToSave.set(true);
    const value = this.toFormValue();
    if (!this.checkValid(value, this.kind)) return;

    const saved = this.mode() === 'create' ? 'created' : 'updated';
    this.saving.set(true);
    try {
      if (this.isTemplate) {
        await this.facade.saveTemplate(value, this.zoneSets());
        this.markSaved();
        await this.router.navigate(['/library'], { queryParams: { saved } });
      } else {
        const workout = await this.facade.save(value, this.zoneSets());
        this.markSaved();
        await this.router.navigate(['/calendar'], {
          queryParams: { date: workout.scheduledDate, saved },
        });
      }
    } catch {
      this.errors.set([
        `No se pudo guardar ${this.isTemplate ? 'la plantilla' : 'el entrenamiento'}. Intenta nuevamente.`,
      ]);
    } finally {
      this.saving.set(false);
    }
  }

  /** Saves the definition shown in the form as a new template; the workout itself is not saved. */
  async saveAsTemplate(): Promise<void> {
    this.form.markAllAsTouched();
    this.hasTriedToSave.set(true);
    this.templateSavedMessage.set('');
    const value = this.toFormValue();
    if (!this.checkValid(value, 'template')) return;

    this.saving.set(true);
    try {
      const template = await this.facade.saveAsTemplate(value, this.zoneSets());
      this.templateSavedMessage.set(`Se guardó la plantilla "${template.title}".`);
    } catch {
      this.errors.set(['No se pudo guardar la plantilla. Intenta nuevamente.']);
    } finally {
      this.saving.set(false);
    }
  }

  private checkValid(value: TrainingSessionFormValue, kind: TrainingSessionFormKind): boolean {
    const errors = this.facade.validate(value, this.zoneSets(), kind);
    this.errors.set(errors);

    if (this.form.invalid || errors.length > 0 || !this.profileAvailable()) {
      this.focusFirstInvalidControl();
      return false;
    }

    return true;
  }

  private markSaved(): void {
    this.form.markAsPristine();
    this.savedSteps.set(this.steps());
  }

  async cancel(): Promise<void> {
    if (this.form.dirty || this.steps() !== this.savedSteps()) {
      const confirmed = this.document.defaultView?.confirm(
        'Hay cambios sin guardar. ¿Deseas salir y descartarlos?',
      );
      if (!confirmed) return;
    }

    if (this.isTemplate) {
      await this.router.navigate(['/library']);
      return;
    }

    await this.router.navigate(['/calendar'], {
      queryParams: { date: this.form.controls.scheduledDate.value },
    });
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    const date = this.isTemplate
      ? ''
      : (this.route.snapshot.queryParamMap.get('date') ?? this.today());

    try {
      const state = id
        ? await (this.isTemplate
            ? this.facade.loadEditTemplateForm(id)
            : this.facade.loadEditForm(id))
        : await this.facade.loadCreateForm(date);
      this.mode.set(state.mode);
      this.profileAvailable.set(state.profileAvailable);
      this.zoneSets.set(state.zoneSets);
      this.patchForm(state.formValue);
    } catch (error) {
      this.loadError.set(
        error instanceof Error ? error.message : 'No se pudo cargar el entrenamiento.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** Clears modality, category and metric when they do not apply to the new sport. */
  private alignWithSport(sport: Sport | null): void {
    const { modality, category, primaryMetric } = this.form.controls;

    if (!sport) return;

    if (modality.value && !SPORT_MODALITIES[sport].includes(modality.value)) {
      modality.setValue(SPORT_MODALITIES[sport][0] ?? null);
    }
    if (!modality.value && SPORT_MODALITIES[sport].length > 0) {
      modality.setValue(SPORT_MODALITIES[sport][0] ?? null);
    }
    if (SPORT_MODALITIES[sport].length === 0) {
      modality.setValue(null);
    }
    if (category.value && !WORKOUT_CATEGORIES_BY_SPORT[sport].includes(category.value)) {
      category.setValue(WORKOUT_CATEGORIES_BY_SPORT[sport][0] ?? null);
    }
    if (
      primaryMetric.value &&
      primaryMetric.value !== IntensityMetric.Rpe &&
      !supportsZoneMetric(sport, primaryMetric.value)
    ) {
      primaryMetric.setValue(IntensityMetric.Rpe);
    }
  }

  /**
   * Removes step targets that no longer match the sport or metric. Reads the controls directly
   * because a control emits `valueChanges` before the form does.
   */
  private dropIncompatibleTargets(): void {
    const { sport, primaryMetric } = this.form.controls;
    const zoneSet = this.facade.zoneSetFor(this.zoneSets(), sport.value, primaryMetric.value);

    this.steps.update((steps) => clearIncompatibleTargets(steps, primaryMetric.value, zoneSet));
  }

  private patchForm(value: TrainingSessionFormValue): void {
    this.form.patchValue(
      {
        title: value.title,
        scheduledDate: value.scheduledDate,
        sport: value.sport,
        modality: value.modality,
        category: value.category,
        primaryMetric: value.primaryMetric,
        estimatedDurationMinutes: value.estimatedDurationMinutes,
        plannedDistanceKm: value.plannedDistanceKm,
        objective: value.objective,
        description: value.description,
        notes: value.notes,
      },
      { emitEvent: false },
    );
    this.steps.set(value.steps);
    this.savedSteps.set(value.steps);
    this.form.markAsPristine();
  }

  private toFormValue(): TrainingSessionFormValue {
    const workoutId = this.route.snapshot.paramMap.get('id');
    return {
      ...this.form.getRawValue(),
      ...(workoutId ? { id: workoutId } : {}),
      steps: this.steps(),
    };
  }

  private focusFirstInvalidControl(): void {
    this.document.defaultView?.setTimeout(() => {
      const control = this.document.querySelector<HTMLElement>(
        '[aria-invalid="true"], .ng-invalid',
      );
      control?.focus();
    });
  }

  private formatDate(date: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  }

  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
