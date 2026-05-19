import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { InputFormComponent } from '../../../../components/input-form/input-form.component';
import {
  PreferredDiscipline,
  PreferredIntensityMetric,
  WeekStartsOn,
  type SportProfileEntity,
} from '../../../../core/domain/sport-profile.model';
import type { TrainingZoneEntity } from '../../../../core/domain/training-zone.model';
import { SportProfileRepository } from '../../../../core/repositories/sport-profile.repository';
import { createId, nowIso } from '../../../../core/repositories/repository-utils';
import { TrainingZoneRepository } from '../../../../core/repositories/training-zone.repository';
import {
  SimpleSelectComponent,
  SimpleSelectOption,
} from '../../../../components/simple-select/simple-select.component';
import { ActionButtonComponent } from '../../../../components/action_button/action_button.component';
import { ButtonComponent } from '../../../../components/button/button.component';
import { AlertComponent } from '../../../../components/alert/alert.component';
import { AlertType } from '../../../../core/types/alert';
import { RouterLink } from '@angular/router';

const DEFAULT_ZONE_PERCENTAGES = [
  {
    name: 'Zona 1',
    minPercent: 0.5,
    maxPercent: 0.6,
    description: 'Zona baja de recuperación',
  },
  {
    name: 'Zona 2',
    minPercent: 0.6,
    maxPercent: 0.7,
    description: 'Resistencia aeróbica base',
  },
  {
    name: 'Zona 3',
    minPercent: 0.7,
    maxPercent: 0.8,
    description: 'Tempo o intensidad moderada',
  },
  {
    name: 'Zona 4',
    minPercent: 0.8,
    maxPercent: 0.9,
    description: 'Umbral o intensidad alta sostenida',
  },
  {
    name: 'Zona 5',
    minPercent: 0.9,
    maxPercent: 1,
    description: 'Alta intensidad',
  },
] as const;

interface ZoneFormValue {
  id: string;
  name: string;
  minHeartRate: string;
  maxHeartRate: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ZoneFormControls {
  id: FormControl<string>;
  name: FormControl<string>;
  minHeartRate: FormControl<string>;
  maxHeartRate: FormControl<string>;
  description: FormControl<string>;
  isDefault: FormControl<boolean>;
  createdAt: FormControl<string>;
  updatedAt: FormControl<string>;
}

@Component({
  selector: 'app-profile-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    InputFormComponent,
    ReactiveFormsModule,
    RouterLink,
    SimpleSelectComponent,
    ActionButtonComponent,
    ButtonComponent,
    AlertComponent,
  ],
  templateUrl: './profile-settings-page.component.html',
  styleUrl: './profile-settings-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly location = inject(Location);
  private readonly sportProfileRepository = inject(SportProfileRepository);
  private readonly trainingZoneRepository = inject(TrainingZoneRepository);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly alertMessage = signal('');
  readonly originalZoneIds = signal<string[]>([]);
  readonly isDirty = signal(false);
  showSuccessAlert = signal(false);
  typeAlert = signal<AlertType>('toast-success');
  readonly weekStartOptions: SimpleSelectOption[] = [
    {
      label: 'Lunes',
      value: 'monday',
    },
    {
      label: 'Domingo',
      value: 'sunday',
    },
  ];
  readonly intesityMetricOptions: SimpleSelectOption[] = [
    {
      label: 'Frecuencia cardiaca',
      value: 'heartRate',
    },
    {
      label: 'RPE',
      value: 'rpe',
    },
    {
      label: 'Mixta',
      value: 'mixed',
    },
  ];

  readonly profileForm = this.fb.nonNullable.group({
    id: [''],
    name: ['', [Validators.required]],
    maxHeartRate: ['', [Validators.required, Validators.min(100), Validators.max(230)]],
    weightKg: ['', [this.optionalNumberRangeValidator(30, 250)]],
    weekStartsOn: ['', [Validators.required]],
    preferredIntensityMetric: ['', [Validators.required]],
    createdAt: [''],
    updatedAt: [''],
  });

  readonly zonesForm = this.fb.nonNullable.group({
    zones: this.fb.array<FormGroup<ZoneFormControls>>([]),
  });

  readonly zones = this.zonesForm.controls.zones;

  readonly hasChanges = computed(
    () => this.isDirty() || this.profileForm.dirty || this.zonesForm.dirty,
  );

  constructor() {
    void this.loadProfileSettings();
  }

  async loadProfileSettings(): Promise<void> {
    this.loading.set(true);
    this.alertMessage.set('');

    try {
      const profile = await this.sportProfileRepository.createDefaultProfile();
      const storedZones = await this.trainingZoneRepository.findAll();
      const zones =
        storedZones.length > 0 ? storedZones : this.createDefaultZones(profile.maxHeartRate);

      this.originalZoneIds.set(storedZones.map((zone) => zone.id));
      this.profileForm.reset({
        id: profile.id,
        name: profile.name,
        maxHeartRate: String(profile.maxHeartRate),
        weightKg: profile.weightKg ? String(profile.weightKg) : '',
        weekStartsOn: profile.weekStartsOn,
        preferredIntensityMetric: profile.preferredIntensityMetric,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      });
      this.replaceZones(zones);
      this.isDirty.set(false);
    } catch (error) {
      this.alertMessage.set(this.toErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  addZone(): void {
    this.zones.push(this.createZoneGroup());
    this.zones.markAsDirty();
    this.isDirty.set(true);
  }

  deleteZone(index: number): void {
    this.zones.removeAt(index);
    this.zones.markAsDirty();
    this.isDirty.set(true);
  }

  cancel(): void {
    console.log('back');
    this.location.back();
  }

  async saveProfileAndZones(): Promise<void> {
    this.alertMessage.set('');
    this.profileForm.markAllAsTouched();
    this.zonesForm.markAllAsTouched();

    const validationMessage = this.validateProfile() || this.validateZones();

    if (validationMessage) {
      this.showSuccessAlert.set(true);
      this.typeAlert.set('toast-warning');
      this.alertMessage.set(validationMessage);
      return;
    }

    this.saving.set(true);

    try {
      const profile = await this.sportProfileRepository.save(this.buildProfileEntity());
      const zones = this.buildZoneEntities();

      for (const zoneId of this.originalZoneIds()) {
        await this.trainingZoneRepository.delete(zoneId);
      }

      for (const zone of zones) {
        await this.trainingZoneRepository.create(zone);
      }

      this.originalZoneIds.set(zones.map((zone) => zone.id));
      this.profileForm.patchValue({ updatedAt: profile.updatedAt });
      this.profileForm.markAsPristine();
      this.zonesForm.markAsPristine();
      this.isDirty.set(false);
      this.showSuccessAlert.set(true);
      this.typeAlert.set('toast-success');
      this.alertMessage.set('Perfil guardado correctamente.');
    } catch (error) {
      this.alertMessage.set(this.toErrorMessage(error));
      this.typeAlert.set('toast-danger');
    } finally {
      this.saving.set(false);
      setTimeout(() => {
        this.showSuccessAlert.set(false);
      }, 3000);
    }
  }

  createDefaultZones(maxHeartRate: number): TrainingZoneEntity[] {
    const timestamp = nowIso();

    return DEFAULT_ZONE_PERCENTAGES.map((zone, index) => ({
      id: createId(),
      name: zone.name,
      description: zone.description,
      minHeartRate: Math.round(maxHeartRate * zone.minPercent),
      maxHeartRate: Math.round(maxHeartRate * zone.maxPercent),
      sortOrder: index + 1,
      isDefault: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }

  validateProfile(): string {
    const name = this.profileForm.controls.name.value.trim();
    const maxHeartRate = this.toNumber(this.profileForm.controls.maxHeartRate.value);
    const weightKg = this.profileForm.controls.weightKg.value.trim()
      ? this.toNumber(this.profileForm.controls.weightKg.value)
      : null;

    if (!name) {
      return 'El nombre de usuario es requerido.';
    }

    if (this.profileForm.controls.maxHeartRate.value.trim() === '') {
      return 'La FC máxima es requerida.';
    }

    if (maxHeartRate === null || maxHeartRate < 100 || maxHeartRate > 230) {
      return 'La FC máxima debe estar entre 100 y 230 ppm.';
    }

    if (weightKg !== null && (weightKg < 30 || weightKg > 250)) {
      return 'El peso debe estar entre 30 y 250 kg.';
    }

    if (!this.profileForm.controls.weekStartsOn.value) {
      return 'Selecciona el inicio de la semana.';
    }

    if (!this.profileForm.controls.preferredIntensityMetric.value) {
      return 'Selecciona la métrica de entrenamiento.';
    }

    return '';
  }

  validateZones(): string {
    const maxProfileHeartRate = this.toNumber(this.profileForm.controls.maxHeartRate.value) ?? 0;
    const zones = this.zones.getRawValue();

    if (zones.length === 0) {
      return 'Debes configurar al menos una zona de entrenamiento.';
    }

    for (const zone of zones) {
      const minHeartRate = this.toNumber(zone.minHeartRate);
      const maxHeartRate = this.toNumber(zone.maxHeartRate);

      if (!zone.name.trim()) {
        return 'El nombre de la zona es requerido.';
      }

      if (zone.minHeartRate.trim() === '' || minHeartRate === null) {
        return 'El mínimo/máximo de la zona es requerido.';
      }

      if (zone.maxHeartRate.trim() === '' || maxHeartRate === null) {
        return 'El mínimo/máximo de la zona es requerido.';
      }

      if (minHeartRate > maxHeartRate) {
        return 'El mínimo no puede ser mayor que el máximo.';
      }

      if (maxHeartRate > maxProfileHeartRate) {
        return 'El máximo de la zona no puede superar la FC máxima del perfil.';
      }
    }

    const sortedZones = zones
      .map((zone) => ({
        minHeartRate: this.toNumber(zone.minHeartRate) ?? 0,
        maxHeartRate: this.toNumber(zone.maxHeartRate) ?? 0,
      }))
      .sort((left, right) => left.minHeartRate - right.minHeartRate);

    for (let index = 1; index < sortedZones.length; index += 1) {
      const previousZone = sortedZones[index - 1];
      const currentZone = sortedZones[index];

      if (currentZone.minHeartRate < previousZone.maxHeartRate) {
        return 'Las zonas de entrenamiento no deben traslaparse.';
      }
    }

    return '';
  }

  trackZone(index: number): string {
    return this.zones.at(index).controls.id.value;
  }

  closeSuccessAlert(value: boolean): void {
    this.showSuccessAlert.set(value);
  }

  private replaceZones(zones: TrainingZoneEntity[]): void {
    this.zones.clear();

    for (const zone of zones) {
      this.zones.push(this.createZoneGroup(zone));
    }

    this.zonesForm.markAsPristine();
  }

  private createZoneGroup(zone?: TrainingZoneEntity): FormGroup<ZoneFormControls> {
    const timestamp = nowIso();

    return this.fb.nonNullable.group({
      id: [zone?.id ?? createId()],
      name: [zone?.name ?? '', [Validators.required]],
      minHeartRate: [zone ? String(zone.minHeartRate) : '', [Validators.required]],
      maxHeartRate: [zone ? String(zone.maxHeartRate) : '', [Validators.required]],
      description: [zone?.description ?? ''],
      isDefault: [zone?.isDefault ?? false],
      createdAt: [zone?.createdAt ?? timestamp],
      updatedAt: [zone?.updatedAt ?? timestamp],
    });
  }

  private buildProfileEntity(): SportProfileEntity {
    const value = this.profileForm.getRawValue();
    const weightKg = value.weightKg.trim() ? this.toNumber(value.weightKg) : undefined;

    return {
      id: value.id,
      name: value.name.trim(),
      maxHeartRate: this.toNumber(value.maxHeartRate) ?? 0,
      ...(weightKg ? { weightKg } : {}),
      preferredDiscipline: PreferredDiscipline.Mixed,
      preferredIntensityMetric: value.preferredIntensityMetric as PreferredIntensityMetric,
      weekStartsOn: value.weekStartsOn as WeekStartsOn,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  private buildZoneEntities(): TrainingZoneEntity[] {
    return this.zones.getRawValue().map((zone: ZoneFormValue, index: number) => ({
      id: zone.id,
      name: zone.name.trim(),
      description: zone.description.trim(),
      minHeartRate: this.toNumber(zone.minHeartRate) ?? 0,
      maxHeartRate: this.toNumber(zone.maxHeartRate) ?? 0,
      sortOrder: index + 1,
      isDefault: zone.isDefault,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
    }));
  }

  private optionalNumberRangeValidator(min: number, max: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();

      if (!value) {
        return null;
      }

      const numberValue = Number(value);

      if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
        return { range: true };
      }

      return null;
    };
  }

  private toNumber(value: string): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'No se pudo guardar la configuración del perfil.';
  }
}
