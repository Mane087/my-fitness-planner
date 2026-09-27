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
import { InputFormComponent } from '../../components/input-form/input-form.component';
import { WeekStartsOn } from '../../core/domain/calendar.enums';
import type { AthleteProfileEntity } from '../../core/domain/schemas/athlete-profile.schema';
import type {
  TrainingZone,
  TrainingZoneSetEntity,
} from '../../core/domain/schemas/training-zone-set.schema';
import { createDefaultZones } from '../../core/domain/training-zone-set.defaults';
import {
  INTENSITY_METRICS,
  IntensityMetric,
  resolveHeartRateZoneSport,
  SPORTS,
  type Sport,
} from '../../core/domain/workout.enums';
import { INTENSITY_METRIC_LABELS, SPORT_LABELS } from '../../core/models/workout-labels';
import { AthleteProfileRepository } from '../../core/repositories/athlete-profile.repository';
import { createId } from '../../core/repositories/repository-utils';
import { TrainingZoneSetRepository } from '../../core/repositories/training-zone-set.repository';
import { SelectComponent } from '../../components/select/select.component';
import { Options } from '../../core/types/option';
import { ActionButtonComponent } from '../../components/action_button/action_button.component';
import { ButtonComponent } from '../../components/button/button.component';
import { AlertComponent } from '../../components/alert/alert.component';
import { AlertType } from '../../core/types/alert';
import { RouterLink } from '@angular/router';

interface ZoneFormValue {
  id: string;
  name: string;
  minHeartRate: string;
  maxHeartRate: string;
  description: string;
}

interface ZoneFormControls {
  id: FormControl<string>;
  name: FormControl<string>;
  minHeartRate: FormControl<string>;
  maxHeartRate: FormControl<string>;
  description: FormControl<string>;
}

const MIN_HEART_RATE = 100;
const MAX_HEART_RATE = 250;

@Component({
  selector: 'app-profile-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    InputFormComponent,
    ReactiveFormsModule,
    RouterLink,
    SelectComponent,
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
  private readonly athleteProfileRepository = inject(AthleteProfileRepository);
  private readonly trainingZoneSetRepository = inject(TrainingZoneSetRepository);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly alertMessage = signal('');
  readonly heartRateZoneSet = signal<TrainingZoneSetEntity | null>(null);
  readonly isDirty = signal(false);
  showSuccessAlert = signal(false);
  typeAlert = signal<AlertType>('toast-success');
  readonly weekStartOptions: Options[] = [
    {
      label: 'Lunes',
      value: 'monday',
    },
    {
      label: 'Domingo',
      value: 'sunday',
    },
  ];
  readonly intensityMetricOptions: Options[] = INTENSITY_METRICS.map((metric) => ({
    label: INTENSITY_METRIC_LABELS[metric],
    value: metric,
  }));
  readonly sportOptions: Options[] = SPORTS.map((sport) => ({
    label: SPORT_LABELS[sport],
    value: sport,
  }));

  readonly profileForm = this.fb.nonNullable.group({
    id: [''],
    name: ['', [Validators.required]],
    maxHeartRate: [
      '',
      [Validators.required, Validators.min(MIN_HEART_RATE), Validators.max(MAX_HEART_RATE)],
    ],
    weightKg: ['', [this.optionalNumberRangeValidator(30, 250)]],
    weekStartsOn: ['', [Validators.required]],
    preferredSport: ['', [Validators.required]],
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
      const profile = await this.athleteProfileRepository.createDefaultProfile();
      const zoneSet = await this.trainingZoneSetRepository.getOrSeed(
        resolveHeartRateZoneSport(profile.preferredSport),
        IntensityMetric.HeartRate,
        profile.maxHeartRate,
      );

      this.heartRateZoneSet.set(zoneSet);
      this.profileForm.reset({
        id: profile.id,
        name: profile.name,
        maxHeartRate: String(profile.maxHeartRate),
        weightKg: profile.weightKg ? String(profile.weightKg) : '',
        weekStartsOn: profile.weekStartsOn,
        preferredSport: profile.preferredSport,
        preferredIntensityMetric: profile.preferredIntensityMetric,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      });
      this.replaceZones(zoneSet.zones);
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
      const profile = await this.athleteProfileRepository.save(this.buildProfileEntity());
      const zoneSet = await this.trainingZoneSetRepository.save(this.buildZoneSet(profile));

      this.heartRateZoneSet.set(zoneSet);
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

  resetZonesToDefault(): void {
    const maxHeartRate = this.toNumber(this.profileForm.controls.maxHeartRate.value);

    if (maxHeartRate === null || maxHeartRate < MIN_HEART_RATE || maxHeartRate > MAX_HEART_RATE) {
      this.showSuccessAlert.set(true);
      this.typeAlert.set('toast-warning');
      this.alertMessage.set(
        `La FC máxima debe estar entre ${MIN_HEART_RATE} y ${MAX_HEART_RATE} ppm.`,
      );
      return;
    }

    this.replaceZones(createDefaultZones(IntensityMetric.HeartRate, maxHeartRate));
    this.zones.markAsDirty();
    this.isDirty.set(true);
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

    if (maxHeartRate === null || maxHeartRate < MIN_HEART_RATE || maxHeartRate > MAX_HEART_RATE) {
      return `La FC máxima debe estar entre ${MIN_HEART_RATE} y ${MAX_HEART_RATE} ppm.`;
    }

    if (weightKg !== null && (weightKg < 30 || weightKg > 250)) {
      return 'El peso debe estar entre 30 y 250 kg.';
    }

    if (!this.profileForm.controls.weekStartsOn.value) {
      return 'Selecciona el inicio de la semana.';
    }

    if (!this.profileForm.controls.preferredSport.value) {
      return 'Selecciona tu deporte principal.';
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

      if (minHeartRate >= maxHeartRate) {
        return 'El mínimo de la zona debe ser menor que el máximo.';
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

  private replaceZones(zones: readonly TrainingZone[]): void {
    this.zones.clear();

    for (const zone of zones) {
      this.zones.push(this.createZoneGroup(zone));
    }

    this.zonesForm.markAsPristine();
  }

  private createZoneGroup(zone?: TrainingZone): FormGroup<ZoneFormControls> {
    return this.fb.nonNullable.group({
      id: [zone?.id ?? createId()],
      name: [zone?.name ?? '', [Validators.required]],
      minHeartRate: [zone ? String(zone.minValue) : '', [Validators.required]],
      maxHeartRate: [zone ? String(zone.maxValue) : '', [Validators.required]],
      description: [zone?.description ?? ''],
    });
  }

  private buildProfileEntity(): AthleteProfileEntity {
    const value = this.profileForm.getRawValue();
    const weightKg = value.weightKg.trim() ? this.toNumber(value.weightKg) : undefined;

    return {
      id: value.id,
      name: value.name.trim(),
      maxHeartRate: this.toNumber(value.maxHeartRate) ?? 0,
      ...(weightKg ? { weightKg } : {}),
      preferredSport: value.preferredSport as Sport,
      preferredIntensityMetric: value.preferredIntensityMetric as IntensityMetric,
      weekStartsOn: value.weekStartsOn as WeekStartsOn,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  /** Zones are stored ordered by intensity (ascending heart rate) with consecutive sort order. */
  private buildZoneSet(profile: AthleteProfileEntity): TrainingZoneSetEntity {
    const zones = this.zones
      .getRawValue()
      .map((zone: ZoneFormValue) => ({
        id: zone.id,
        name: zone.name.trim(),
        ...(zone.description.trim() ? { description: zone.description.trim() } : {}),
        minValue: this.toNumber(zone.minHeartRate) ?? 0,
        maxValue: this.toNumber(zone.maxHeartRate) ?? 0,
      }))
      .sort((left, right) => left.minValue - right.minValue)
      .map((zone, index) => ({ ...zone, sortOrder: index + 1 }));
    const current = this.heartRateZoneSet();

    return {
      id: current?.id ?? createId(),
      sport: current?.sport ?? resolveHeartRateZoneSport(profile.preferredSport),
      metric: IntensityMetric.HeartRate,
      referenceValue: profile.maxHeartRate,
      zones,
      createdAt: current?.createdAt ?? '',
      updatedAt: current?.updatedAt ?? '',
    };
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
