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
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

// IMPORT TYPES
import type {
  TrainingZone,
  TrainingZoneSetEntity,
} from '../../core/domain/schemas/training-zone-set.schema';
import {
  INTENSITY_METRICS,
  IntensityMetric,
  SPORT_MODALITIES,
  SPORTS,
  Sport,
  STEP_PHASES,
  StepPhase,
  supportsZoneMetric,
  WORKOUT_CATEGORIES_BY_SPORT,
  type SportModality,
  type WorkoutCategory,
} from '../../core/domain/workout.enums';
import {
  BlockTargetType,
  type TrainingSessionFormValue,
  type TrainingSessionTotals,
  type WorkoutBlockFormValue,
} from '../../core/interfaces/training-session-form.model';
import {
  INTENSITY_METRIC_LABELS,
  SPORT_LABELS,
  SPORT_MODALITY_LABELS,
  STEP_DURATION_TYPE_LABELS,
  STEP_PHASE_LABELS,
  WORKOUT_CATEGORY_LABELS,
} from '../../core/models/workout-labels';
import type { Options } from '../../core/types/option';

// IMPORT UTILS
import { createId } from '../../core/repositories/repository-utils';
import { TrainingSessionFormFacade } from './training-session-form.facade';

// IMPORT COMPONENTS
import { AlertComponent } from '../../components/alert/alert.component';
import { AlertType } from '../../core/types/alert';
import { InputFormComponent } from '../../components/input-form/input-form.component';
import { SelectComponent } from '../../components/select/select.component';

// FORM CONTROLS
interface BlockFormControls {
  id: FormControl<string>;
  name: FormControl<string>;
  phase: FormControl<StepPhase>;
  targetType: FormControl<BlockTargetType>;
  durationMinutes: FormControl<number | null>;
  distanceKm: FormControl<number | null>;
  trainingZoneId: FormControl<string | null>;
  targetRpe: FormControl<number | null>;
  cadenceMin: FormControl<number | null>;
  cadenceMax: FormControl<number | null>;
  instructions: FormControl<string>;
  sortOrder: FormControl<number>;
}

type BlockFormGroup = FormGroup<BlockFormControls>;

interface ChartBlock {
  id: string;
  name: string;
  durationMinutes: number;
  percentage: number;
  typeLabel: string;
  colorClass: string;
}

const BLOCK_CHART_COLORS: Record<StepPhase, string> = {
  [StepPhase.WarmUp]: 'bg-amber-400',
  [StepPhase.Active]: 'bg-blue-600',
  [StepPhase.Recovery]: 'bg-emerald-500',
  [StepPhase.Rest]: 'bg-slate-500',
  [StepPhase.CoolDown]: 'bg-violet-500',
};

const SPORT_ICONS: Partial<Record<Sport, string>> = {
  [Sport.Cycling]: '/icons/road.svg',
};

const ZONE_UNITS: Record<IntensityMetric, string> = {
  [IntensityMetric.HeartRate]: 'ppm',
  [IntensityMetric.Power]: 'W',
  [IntensityMetric.Pace]: '/km',
  [IntensityMetric.Rpe]: '',
};

@Component({
  selector: 'app-training-session-form-page',
  imports: [ReactiveFormsModule, RouterLink, AlertComponent, InputFormComponent, SelectComponent],
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

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly mode = signal<'create' | 'edit'>('create');
  readonly profileAvailable = signal(false);
  readonly zoneSets = signal<TrainingZoneSetEntity[]>([]);
  readonly errors = signal<string[]>([]);
  readonly loadError = signal<string | null>(null);

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
    plannedDistanceKm: this.formBuilder.control<number | null>(null, Validators.min(0.1)),
    objective: this.formBuilder.nonNullable.control('', Validators.maxLength(250)),
    description: this.formBuilder.nonNullable.control('', Validators.maxLength(1000)),
    notes: this.formBuilder.nonNullable.control('', Validators.maxLength(1000)),
    blocks: this.formBuilder.array<BlockFormGroup>([]),
  });

  private readonly formChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private readonly selectedSport = computed(() => {
    this.formChanges();
    return this.form.controls.sport.value;
  });
  private readonly selectedMetric = computed(() => {
    this.formChanges();
    return this.form.controls.primaryMetric.value;
  });

  readonly zones = computed<TrainingZone[]>(() =>
    this.facade.zonesFor(this.zoneSets(), this.selectedSport(), this.selectedMetric()),
  );
  readonly isZoneMetric = computed(() => {
    const sport = this.selectedSport();
    const metric = this.selectedMetric();
    return sport !== null && metric !== null && supportsZoneMetric(sport, metric);
  });
  readonly isRpeMetric = computed(() => this.selectedMetric() === IntensityMetric.Rpe);
  readonly isCycling = computed(() => this.selectedSport() === Sport.Cycling);

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
  readonly phaseOptions = STEP_PHASES.map((phase) => ({
    value: phase,
    label: STEP_PHASE_LABELS[phase],
  }));
  readonly targetTypeOptions = [
    { value: BlockTargetType.Time, label: STEP_DURATION_TYPE_LABELS.time },
    { value: BlockTargetType.Distance, label: STEP_DURATION_TYPE_LABELS.distance },
  ] as const;

  readonly totals = computed(() => {
    this.formChanges();
    const blockTotals = this.facade.calculateTotals(this.blocks.getRawValue());
    const plannedKm = this.form.controls.plannedDistanceKm.value;
    return {
      ...blockTotals,
      distanceKm: blockTotals.distanceKm ?? plannedKm ?? null,
    } satisfies TrainingSessionTotals;
  });
  readonly chartBlocks = computed<ChartBlock[]>(() => {
    this.formChanges();
    const blocks = this.blocks.getRawValue().map((block, index) => ({
      ...block,
      name: block.name.trim() || `Bloque ${index + 1}`,
      durationMinutes:
        block.durationMinutes !== null && block.durationMinutes > 0 ? block.durationMinutes : 0,
    }));
    const totalDuration = blocks.reduce((total, block) => total + block.durationMinutes, 0);

    if (totalDuration === 0) return [];

    return blocks.map((block) => ({
      id: block.id,
      name: block.name,
      durationMinutes: block.durationMinutes,
      percentage: (block.durationMinutes / totalDuration) * 100,
      typeLabel: STEP_PHASE_LABELS[block.phase] ?? 'Bloque',
      colorClass: BLOCK_CHART_COLORS[block.phase],
    }));
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
    void this.load();
  }

  get blocks(): FormArray<BlockFormGroup> {
    return this.form.controls.blocks;
  }

  formatZone(zone: TrainingZone): string {
    const metric = this.selectedMetric() ?? IntensityMetric.HeartRate;
    const format = (value: number) =>
      metric === IntensityMetric.Pace ? formatPace(value) : String(value);

    return `${zone.name} (${format(zone.minValue)}-${format(zone.maxValue)} ${ZONE_UNITS[metric]})`;
  }

  closeSuccessAlert(value: boolean): void {
    this.showSuccessAlert.set(value);
  }

  addBlock(): void {
    this.blocks.push(this.createBlockGroup());
    this.form.markAsDirty();
  }

  removeBlock(index: number): void {
    this.blocks.removeAt(index);
    this.reorderBlocks();
  }

  moveBlock(index: number, direction: -1 | 1): void {
    const destination = index + direction;
    if (destination < 0 || destination >= this.blocks.length) return;

    const block = this.blocks.at(index);
    this.blocks.removeAt(index);
    this.blocks.insert(destination, block);
    this.reorderBlocks();
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    const value = this.toFormValue();
    const errors = this.facade.validate(value, this.zoneSets());
    this.errors.set(errors);

    if (this.form.invalid || errors.length > 0 || !this.profileAvailable()) {
      this.focusFirstInvalidControl();
      return;
    }

    this.saving.set(true);
    try {
      const workout = await this.facade.save(value, this.zoneSets());
      this.form.markAsPristine();
      await this.router.navigate(['/calendar'], {
        queryParams: {
          date: workout.scheduledDate,
          saved: this.mode() === 'create' ? 'created' : 'updated',
        },
      });
    } catch {
      this.errors.set(['No se pudo guardar el entrenamiento. Intenta nuevamente.']);
    } finally {
      this.saving.set(false);
    }
  }

  async cancel(): Promise<void> {
    if (this.form.dirty) {
      const confirmed = this.document.defaultView?.confirm(
        'Hay cambios sin guardar. ¿Deseas salir y descartarlos?',
      );
      if (!confirmed) return;
    }

    await this.router.navigate(['/calendar'], {
      queryParams: { date: this.form.controls.scheduledDate.value },
    });
  }

  private async load(): Promise<void> {
    const workoutId = this.route.snapshot.paramMap.get('id');
    const date = this.route.snapshot.queryParamMap.get('date') ?? this.today();

    try {
      const state = workoutId
        ? await this.facade.loadEditForm(workoutId)
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

  private patchForm(value: TrainingSessionFormValue): void {
    this.form.patchValue(
      {
        title: value.title,
        scheduledDate: value.scheduledDate,
        sport: value.sport,
        modality: value.modality,
        category: value.category,
        primaryMetric: value.primaryMetric,
        plannedDistanceKm: value.plannedDistanceKm,
        objective: value.objective,
        description: value.description,
        notes: value.notes,
      },
      { emitEvent: false },
    );
    this.blocks.clear();
    value.blocks.forEach((block) => this.blocks.push(this.createBlockGroup(block)));
    this.form.markAsPristine();
  }

  private createBlockGroup(value?: WorkoutBlockFormValue): BlockFormGroup {
    return this.formBuilder.group<BlockFormControls>(
      {
        id: this.formBuilder.nonNullable.control(value?.id ?? createId()),
        name: this.formBuilder.nonNullable.control(value?.name ?? '', Validators.required),
        phase: this.formBuilder.nonNullable.control(value?.phase ?? StepPhase.Active),
        targetType: this.formBuilder.nonNullable.control(value?.targetType ?? BlockTargetType.Time),
        durationMinutes: this.formBuilder.control<number | null>(
          value?.durationMinutes ?? null,
          Validators.min(0),
        ),
        distanceKm: this.formBuilder.control<number | null>(
          value?.distanceKm ?? null,
          Validators.min(0.1),
        ),
        trainingZoneId: this.formBuilder.control<string | null>(value?.trainingZoneId ?? null),
        targetRpe: this.formBuilder.control<number | null>(value?.targetRpe ?? null, [
          Validators.min(1),
          Validators.max(10),
        ]),
        cadenceMin: this.formBuilder.control<number | null>(
          value?.cadenceMin ?? null,
          Validators.min(1),
        ),
        cadenceMax: this.formBuilder.control<number | null>(
          value?.cadenceMax ?? null,
          Validators.min(1),
        ),
        instructions: this.formBuilder.nonNullable.control(value?.instructions ?? ''),
        sortOrder: this.formBuilder.nonNullable.control(value?.sortOrder ?? this.blocks.length + 1),
      },
      { validators: cadenceRangeValidator },
    );
  }

  private reorderBlocks(): void {
    this.blocks.controls.forEach((block, index) => block.controls.sortOrder.setValue(index + 1));
    this.form.markAsDirty();
  }

  private toFormValue(): TrainingSessionFormValue {
    const value = this.form.getRawValue();
    return {
      ...value,
      ...(this.route.snapshot.paramMap.get('id')
        ? { id: this.route.snapshot.paramMap.get('id') ?? undefined }
        : {}),
      blocks: value.blocks.map((block, index) => ({ ...block, sortOrder: index + 1 })),
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

function cadenceRangeValidator(control: AbstractControl): ValidationErrors | null {
  const min = control.get('cadenceMin')?.value;
  const max = control.get('cadenceMax')?.value;
  if (min !== null && max !== null && min > max) {
    return { cadenceRange: 'La cadencia mínima no puede ser mayor que la máxima.' };
  }
  return null;
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = String(Math.round(secondsPerKm % 60)).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
