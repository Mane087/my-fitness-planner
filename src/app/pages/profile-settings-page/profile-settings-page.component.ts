import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ThemePreference, WeekStartsOn } from '../../core/domain/calendar.enums';
import { DomainValidationError } from '../../core/domain/domain-validation.error';
import type { AthleteProfileEntity } from '../../core/domain/schemas/athlete-profile.schema';
import {
  INTENSITY_METRICS,
  type IntensityMetric,
  SPORTS,
  type Sport,
} from '../../core/domain/workout.enums';
import { INTENSITY_METRIC_LABELS, SPORT_LABELS } from '../../core/models/workout-labels';
import { AthleteProfileRepository } from '../../core/repositories/athlete-profile.repository';
import { Options } from '../../core/models/option';
import { UiButtonComponent } from '../../components/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../components/ui/ui-card/ui-card.component';
import { UiFieldComponent } from '../../components/ui/ui-field/ui-field.component';
import { UiSegmentedControlComponent } from '../../components/ui/ui-segmented-control/ui-segmented-control.component';
import { UiSelectComponent } from '../../components/ui/ui-select/ui-select.component';
import { ThemeService } from '../../core/services/theme.service';
import { BackupSectionComponent } from './backup-section.component';
import { ZoneSetsSectionComponent } from './zone-sets-section.component';

const MIN_HEART_RATE = 100;
const MAX_HEART_RATE = 250;

@Component({
  selector: 'app-profile-settings-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    UiButtonComponent,
    UiCardComponent,
    UiFieldComponent,
    UiSegmentedControlComponent,
    UiSelectComponent,
    BackupSectionComponent,
    ZoneSetsSectionComponent,
  ],
  templateUrl: './profile-settings-page.component.html',
  styleUrl: './profile-settings-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly location = inject(Location);
  private readonly athleteProfileRepository = inject(AthleteProfileRepository);
  private readonly themeService = inject(ThemeService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly alertMessage = signal('');
  /** Last saved max HR, suggested as reference for new heart rate zone sets. */
  readonly savedMaxHeartRate = signal<number | null>(null);
  private readonly zoneSetsSection = viewChild(ZoneSetsSectionComponent);
  /** Tone of `alertMessage`: errors and warnings stay until the next save, success fades. */
  readonly messageTone = signal<'success' | 'warning' | 'danger'>('success');
  readonly themePreference = this.themeService.preference;
  readonly themeOptions: Options[] = [
    { value: ThemePreference.System, label: 'Sistema' },
    { value: ThemePreference.Light, label: 'Claro' },
    { value: ThemePreference.Dark, label: 'Oscuro' },
  ];
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

  constructor() {
    void this.loadProfileSettings();
  }

  async loadProfileSettings(): Promise<void> {
    this.loading.set(true);
    this.alertMessage.set('');

    try {
      const profile = await this.athleteProfileRepository.createDefaultProfile();

      this.savedMaxHeartRate.set(profile.maxHeartRate);
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
    } catch (error) {
      this.messageTone.set('danger');
      this.alertMessage.set(
        this.toErrorMessage(error, 'No se pudo cargar la configuración del perfil.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async setTheme(preference: string | null): Promise<void> {
    if (!preference) return;
    await this.themeService.setPreference(preference as ThemePreference);
  }

  cancel(): void {
    this.location.back();
  }

  /** Reloads the profile and the zone sets after a backup replaced the data. */
  onBackupImported(): void {
    void this.loadProfileSettings();
    void this.zoneSetsSection()?.load();
  }

  async saveProfile(): Promise<void> {
    this.alertMessage.set('');
    this.profileForm.markAllAsTouched();

    const validationMessage = this.validateProfile();

    if (validationMessage) {
      this.messageTone.set('warning');
      this.alertMessage.set(validationMessage);
      return;
    }

    this.saving.set(true);

    try {
      const profile = await this.athleteProfileRepository.save(this.buildProfileEntity());

      this.savedMaxHeartRate.set(profile.maxHeartRate);
      this.profileForm.patchValue({ updatedAt: profile.updatedAt });
      this.profileForm.markAsPristine();
      this.messageTone.set('success');
      this.alertMessage.set('Perfil guardado correctamente.');
      this.clearMessageLater();
    } catch (error) {
      this.alertMessage.set(
        this.toErrorMessage(error, 'No se pudo guardar la configuración del perfil.'),
      );
      this.messageTone.set('danger');
    } finally {
      this.saving.set(false);
    }
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

  private clearMessageLater(): void {
    setTimeout(() => {
      if (this.messageTone() === 'success') this.alertMessage.set('');
    }, 3000);
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

  private toErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof DomainValidationError && error.issues[0]) {
      return error.issues[0].message;
    }

    return fallbackMessage;
  }
}
