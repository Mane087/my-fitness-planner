// ANGULAR IMPORTS
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
  TrainingZoneEntity,
  TrainingZoneSnapshot,
} from '../../core/domain/training-zone.model';
import { WorkoutBlockTargetType, WorkoutBlockType } from '../../core/domain/workout-block.model';
import type {
  TrainingSessionFormValue,
  TrainingSessionTotals,
  WorkoutBlockFormValue,
} from '../../core/interfaces/training-session-form.model';
import {
  IntensityMetric,
  WorkoutDiscipline,
  WorkoutType,
  type IntensityMetric as IntensityMetricType,
  type WorkoutDiscipline as WorkoutDisciplineType,
  type WorkoutType as WorkoutTypeValue,
} from '../../core/domain/workout.enums';

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
  blockType: FormControl<WorkoutBlockType>;
  durationMinutes: FormControl<number | null>;
  distanceKm: FormControl<number | null>;
  targetType: FormControl<WorkoutBlockTargetType>;
  trainingZoneId: FormControl<string | null>;
  trainingZoneSnapshot: FormControl<TrainingZoneSnapshot | null>;
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

const BLOCK_CHART_COLORS: Record<WorkoutBlockType, string> = {
  [WorkoutBlockType.WarmUp]: 'bg-amber-400',
  [WorkoutBlockType.Active]: 'bg-blue-600',
  [WorkoutBlockType.Recovery]: 'bg-emerald-500',
  [WorkoutBlockType.CoolDown]: 'bg-violet-500',
  [WorkoutBlockType.Free]: 'bg-slate-500',
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

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly mode = signal<'create' | 'edit'>('create');
  readonly profileAvailable = signal(false);
  readonly zones = signal<TrainingZoneEntity[]>([]);
  readonly errors = signal<string[]>([]);
  readonly loadError = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    title: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120),
    ]),
    scheduledDate: this.formBuilder.nonNullable.control('', Validators.required),
    discipline: this.formBuilder.control<WorkoutDisciplineType | null>(null, Validators.required),
    workoutType: this.formBuilder.control<WorkoutTypeValue | null>(null, Validators.required),
    intensityMetric: this.formBuilder.control<IntensityMetricType | null>(
      null,
      Validators.required,
    ),
    plannedDistanceKm: this.formBuilder.control<number | null>(null, Validators.min(0.1)),
    objective: this.formBuilder.nonNullable.control('', Validators.maxLength(250)),
    description: this.formBuilder.nonNullable.control('', Validators.maxLength(1000)),
    notes: this.formBuilder.nonNullable.control('', Validators.maxLength(1000)),
    blocks: this.formBuilder.array<BlockFormGroup>([]),
  });

  private readonly formChanges = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
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
      typeLabel:
        this.blockTypeOptions.find((option) => option.value === block.blockType)?.label ?? 'Bloque',
      colorClass: BLOCK_CHART_COLORS[block.blockType],
    }));
  });
  readonly selectedDateLabel = computed(() => {
    this.formChanges();
    return this.formatDate(this.form.controls.scheduledDate.value);
  });

  disciplineOptions = [
    { value: WorkoutDiscipline.Road, label: 'Ruta', icon: '/icons/road.svg' },
    { value: WorkoutDiscipline.Mtb, label: 'MTB', icon: '/icons/mountain.svg' },
    { value: WorkoutDiscipline.Indoor, label: 'Indoor', icon: '/icons/indoor.svg' },
  ];
  readonly workoutTypeOptions = [
    { value: WorkoutType.Recovery, label: 'Recuperación' },
    { value: WorkoutType.Base, label: 'Base' },
    { value: WorkoutType.Endurance, label: 'Resistencia' },
    { value: WorkoutType.Climbing, label: 'Subidas' },
    { value: WorkoutType.Tempo, label: 'Tempo' },
    { value: WorkoutType.Threshold, label: 'Umbral' },
    { value: WorkoutType.Vo2Max, label: 'VO2 máx.' },
    { value: WorkoutType.Technique, label: 'Técnica' },
    { value: WorkoutType.Free, label: 'Libre' },
  ] as const;
  readonly intensityOptions = [
    { value: IntensityMetric.HeartRate, label: 'Frecuencia cardíaca' },
    { value: IntensityMetric.Rpe, label: 'RPE' },
    { value: IntensityMetric.Mixed, label: 'Mixta' },
  ] as const;
  readonly blockTypeOptions = [
    { value: WorkoutBlockType.WarmUp, label: 'Calentamiento' },
    { value: WorkoutBlockType.Active, label: 'Trabajo principal' },
    { value: WorkoutBlockType.Recovery, label: 'Recuperación' },
    { value: WorkoutBlockType.CoolDown, label: 'Vuelta a la calma' },
    { value: WorkoutBlockType.Free, label: 'Bloque libre' },
  ] as const;
  readonly targetTypeOptions = [
    { value: WorkoutBlockTargetType.Time, label: 'Tiempo' },
    { value: WorkoutBlockTargetType.Distance, label: 'Distancia' },
  ] as const;
  typeAlert = signal<AlertType>('toast-success');
  showSuccessAlert = signal(false);
  readonly alertMessage = signal('');

  constructor() {
    void this.load();
  }

  get blocks(): FormArray<BlockFormGroup> {
    return this.form.controls.blocks;
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
    const errors = this.facade.validate(value, this.zones());
    this.errors.set(errors);

    if (this.form.invalid || errors.length > 0 || !this.profileAvailable()) {
      this.focusFirstInvalidControl();
      return;
    }

    this.saving.set(true);
    try {
      const workout = await this.facade.save(value, this.zones());
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
      this.zones.set(state.zones);
      this.patchForm(state.formValue);
    } catch (error) {
      this.loadError.set(
        error instanceof Error ? error.message : 'No se pudo cargar el entrenamiento.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private patchForm(value: TrainingSessionFormValue): void {
    this.form.patchValue({
      title: value.title,
      scheduledDate: value.scheduledDate,
      discipline: value.discipline,
      workoutType: value.workoutType,
      intensityMetric: value.intensityMetric,
      plannedDistanceKm: value.plannedDistanceKm,
      objective: value.objective,
      description: value.description,
      notes: value.notes,
    });
    this.blocks.clear();
    value.blocks.forEach((block) => this.blocks.push(this.createBlockGroup(block)));
    this.form.markAsPristine();
  }

  private createBlockGroup(value?: WorkoutBlockFormValue): BlockFormGroup {
    return this.formBuilder.group<BlockFormControls>(
      {
        id: this.formBuilder.nonNullable.control(value?.id ?? createId()),
        name: this.formBuilder.nonNullable.control(value?.name ?? '', Validators.required),
        blockType: this.formBuilder.nonNullable.control(
          value?.blockType ?? WorkoutBlockType.Active,
        ),
        durationMinutes: this.formBuilder.control<number | null>(value?.durationMinutes ?? null, [
          Validators.required,
          Validators.min(0.1),
        ]),
        distanceKm: this.formBuilder.control<number | null>(
          value?.distanceKm ?? null,
          Validators.min(0.1),
        ),
        targetType: this.formBuilder.nonNullable.control(
          value?.targetType ?? WorkoutBlockTargetType.Time,
        ),
        trainingZoneId: this.formBuilder.control<string | null>(value?.trainingZoneId ?? null),
        trainingZoneSnapshot: this.formBuilder.control<TrainingZoneSnapshot | null>(
          value?.trainingZoneSnapshot ?? null,
        ),
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
