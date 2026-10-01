import { inject, Injectable } from '@angular/core';
import type { z } from 'zod';

import type { AthleteProfileEntity } from '../../core/domain/schemas/athlete-profile.schema';
import {
  scheduledWorkoutSchema,
  type ScheduledWorkoutEntity,
} from '../../core/domain/schemas/scheduled-workout.schema';
import type { TrainingZoneSetEntity } from '../../core/domain/schemas/training-zone-set.schema';
import type { WorkoutDefinition } from '../../core/domain/schemas/workout-definition.schema';
import {
  workoutTemplateSchema,
  type WorkoutTemplateEntity,
} from '../../core/domain/schemas/workout-template.schema';
import { StepKind, type WorkoutStep } from '../../core/domain/schemas/workout-step.schema';
import {
  IntensityMetric,
  SPORT_MODALITIES,
  Sport,
  supportsZoneMetric,
  WORKOUT_CATEGORIES_BY_SPORT,
  WorkoutCategory,
  WorkoutStatus,
  type SportModality,
} from '../../core/domain/workout.enums';
import type {
  TrainingSessionFormKind,
  TrainingSessionFormState,
  TrainingSessionFormValue,
  TrainingSessionTotals,
} from '../../core/models/training-session-form.model';
import { INTENSITY_METRIC_LABELS, SPORT_LABELS } from '../../core/models/workout-labels';
import { AthleteProfileRepository } from '../../core/repositories/athlete-profile.repository';
import { cloneValue, createId, nowIso } from '../../core/repositories/repository-utils';
import { ScheduledWorkoutRepository } from '../../core/repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../../core/repositories/training-zone-set.repository';
import { WorkoutTemplateRepository } from '../../core/repositories/workout-template.repository';
import { calculateWorkoutTotals } from '../../core/services/workout-structure.utils';

@Injectable({ providedIn: 'root' })
export class TrainingSessionFormFacade {
  private readonly workouts = inject(ScheduledWorkoutRepository);
  private readonly zoneSetsRepository = inject(TrainingZoneSetRepository);
  private readonly profiles = inject(AthleteProfileRepository);
  private readonly templates = inject(WorkoutTemplateRepository);

  /** Empty form; templates have no date, so they pass an empty one. */
  async loadCreateForm(date: string): Promise<TrainingSessionFormState> {
    const [profile, zoneSets] = await Promise.all([
      this.profiles.getActiveProfile(),
      this.zoneSetsRepository.findAll(),
    ]);
    const sport = profile?.preferredSport ?? Sport.Cycling;

    return {
      mode: 'create',
      selectedDate: date,
      profileAvailable: profile !== null,
      zoneSets,
      formValue: {
        title: '',
        scheduledDate: date,
        sport,
        modality: defaultModality(sport),
        category: defaultCategory(sport),
        primaryMetric: defaultMetric(sport, profile),
        estimatedDurationMinutes: null,
        plannedDistanceKm: null,
        objective: '',
        description: '',
        notes: '',
        steps: [],
      },
    };
  }

  async loadEditForm(workoutId: string): Promise<TrainingSessionFormState> {
    const [profile, zoneSets, workout] = await Promise.all([
      this.profiles.getActiveProfile(),
      this.zoneSetsRepository.findAll(),
      this.workouts.findById(workoutId),
    ]);

    if (!workout) {
      throw new Error('El entrenamiento no existe.');
    }

    return {
      mode: 'edit',
      selectedDate: workout.scheduledDate,
      profileAvailable: profile !== null,
      zoneSets,
      formValue: toFormValue(workout, workout.id, workout.scheduledDate),
    };
  }

  async loadEditTemplateForm(templateId: string): Promise<TrainingSessionFormState> {
    const [profile, zoneSets, template] = await Promise.all([
      this.profiles.getActiveProfile(),
      this.zoneSetsRepository.findAll(),
      this.templates.findById(templateId),
    ]);

    if (!template) {
      throw new Error('La plantilla no existe.');
    }

    return {
      mode: 'edit',
      selectedDate: '',
      profileAvailable: profile !== null,
      zoneSets,
      formValue: toFormValue(template, template.id, ''),
    };
  }

  /** Zone set used by the steps of a workout with the given sport and metric. */
  zoneSetFor(
    zoneSets: readonly TrainingZoneSetEntity[],
    sport: Sport | null,
    metric: IntensityMetric | null,
  ): TrainingZoneSetEntity | null {
    if (!sport || !metric || !supportsZoneMetric(sport, metric)) {
      return null;
    }

    return zoneSets.find((zoneSet) => zoneSet.sport === sport && zoneSet.metric === metric) ?? null;
  }

  calculateTotals(
    steps: readonly WorkoutStep[],
    estimatedDurationMinutes: number | null = null,
    plannedDistanceKm: number | null = null,
  ): TrainingSessionTotals {
    const totals = calculateWorkoutTotals(steps);
    const isEstimated = estimatedDurationMinutes !== null && estimatedDurationMinutes > 0;

    return {
      durationMinutes: isEstimated ? estimatedDurationMinutes : totals.durationSeconds / 60,
      distanceKm: totals.distanceMeters !== null ? totals.distanceMeters / 1000 : plannedDistanceKm,
      stepCount: totals.stepCount,
      isEstimated,
    };
  }

  validate(
    value: TrainingSessionFormValue,
    zoneSets: readonly TrainingZoneSetEntity[],
    kind: TrainingSessionFormKind = 'workout',
  ): string[] {
    const errors: string[] = [];

    if (!value.title.trim()) errors.push('El título del entrenamiento es requerido.');
    if (kind === 'workout' && !value.scheduledDate) errors.push('La fecha es requerida.');
    if (!value.sport) errors.push('Selecciona un deporte.');
    if (!value.category) errors.push('Selecciona la categoría del entrenamiento.');
    if (!value.primaryMetric) errors.push('Selecciona la métrica de intensidad.');
    if (value.steps.length === 0) errors.push('Agrega al menos un paso al entrenamiento.');
    if (value.estimatedDurationMinutes !== null && value.estimatedDurationMinutes <= 0) {
      errors.push('La duración estimada debe ser mayor que cero.');
    }

    if (value.sport && value.primaryMetric && value.primaryMetric !== IntensityMetric.Rpe) {
      if (!supportsZoneMetric(value.sport, value.primaryMetric)) {
        errors.push(
          `${INTENSITY_METRIC_LABELS[value.primaryMetric]} no aplica para ${SPORT_LABELS[value.sport]}.`,
        );
      } else if (!this.zoneSetFor(zoneSets, value.sport, value.primaryMetric)) {
        errors.push(
          `Configura tus zonas de ${INTENSITY_METRIC_LABELS[value.primaryMetric].toLowerCase()} antes de usarlas.`,
        );
      }
    }

    if (errors.length === 0) {
      const result =
        kind === 'workout'
          ? scheduledWorkoutSchema.safeParse(this.buildWorkout(value, null))
          : workoutTemplateSchema.safeParse(this.buildTemplate(value, null));

      if (!result.success) {
        errors.push(...result.error.issues.map((issue) => toFormMessage(issue, value.steps)));
      }
    }

    return [...new Set(errors)];
  }

  async save(
    value: TrainingSessionFormValue,
    zoneSets: readonly TrainingZoneSetEntity[],
  ): Promise<ScheduledWorkoutEntity> {
    this.assertValid(value, zoneSets, 'workout');

    const existing = value.id ? await this.workouts.findById(value.id) : null;
    const workout = this.buildWorkout(value, existing);

    return existing ? this.workouts.update(workout) : this.workouts.create(workout);
  }

  async saveTemplate(
    value: TrainingSessionFormValue,
    zoneSets: readonly TrainingZoneSetEntity[],
  ): Promise<WorkoutTemplateEntity> {
    this.assertValid(value, zoneSets, 'template');

    const existing = value.id ? await this.templates.findById(value.id) : null;
    const template = this.buildTemplate(value, existing);

    return existing ? this.templates.update(template) : this.templates.create(template);
  }

  /** Copies the definition shown in the form to a new template, without date or status. */
  saveAsTemplate(
    value: TrainingSessionFormValue,
    zoneSets: readonly TrainingZoneSetEntity[],
  ): Promise<WorkoutTemplateEntity> {
    const definition = { ...value };
    delete definition.id;

    return this.saveTemplate(definition, zoneSets);
  }

  private assertValid(
    value: TrainingSessionFormValue,
    zoneSets: readonly TrainingZoneSetEntity[],
    kind: TrainingSessionFormKind,
  ): void {
    const errors = this.validate(value, zoneSets, kind);

    if (errors.length > 0) {
      throw new Error(errors[0] ?? 'El formulario no es válido.');
    }
  }

  private buildTemplate(
    value: TrainingSessionFormValue,
    existing: WorkoutTemplateEntity | null,
  ): WorkoutTemplateEntity {
    const timestamp = nowIso();

    return {
      ...this.buildDefinition(value),
      id: existing?.id ?? createId(),
      isArchived: existing?.isArchived ?? false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  private buildWorkout(
    value: TrainingSessionFormValue,
    existing: ScheduledWorkoutEntity | null,
  ): ScheduledWorkoutEntity {
    const timestamp = nowIso();

    return {
      ...this.buildDefinition(value),
      id: existing?.id ?? createId(),
      scheduledDate: value.scheduledDate,
      status: existing?.status ?? WorkoutStatus.Planned,
      ...(existing?.completion ? { completion: existing.completion } : {}),
      ...(existing?.sourceTemplateId ? { sourceTemplateId: existing.sourceTemplateId } : {}),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  }

  /** The part shared by scheduled workouts and templates. Totals are stored in domain units. */
  private buildDefinition(value: TrainingSessionFormValue): WorkoutDefinition {
    const totals = this.calculateTotals(
      value.steps,
      value.estimatedDurationMinutes,
      value.plannedDistanceKm,
    );

    return {
      title: value.title.trim(),
      sport: value.sport ?? Sport.Cycling,
      ...(value.modality ? { modality: value.modality } : {}),
      category: value.category ?? WorkoutCategory.Free,
      primaryMetric: value.primaryMetric ?? IntensityMetric.Rpe,
      steps: cloneValue(value.steps),
      plannedDurationSeconds: Math.round(totals.durationMinutes * 60),
      ...(totals.distanceKm !== null && totals.distanceKm > 0
        ? { plannedDistanceMeters: Math.round(totals.distanceKm * 1000) }
        : {}),
      ...(value.objective.trim() ? { objective: value.objective.trim() } : {}),
      ...(value.description.trim() ? { description: value.description.trim() } : {}),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
    };
  }
}

/** Form value of a stored definition. A stored duration that differs from the steps is an estimate. */
function toFormValue(
  definition: WorkoutDefinition,
  id: string,
  scheduledDate: string,
): TrainingSessionFormValue {
  const calculated = calculateWorkoutTotals(definition.steps);

  return {
    id,
    title: definition.title,
    scheduledDate,
    sport: definition.sport,
    modality: definition.modality ?? null,
    category: definition.category,
    primaryMetric: definition.primaryMetric,
    estimatedDurationMinutes:
      definition.plannedDurationSeconds !== calculated.durationSeconds
        ? definition.plannedDurationSeconds / 60
        : null,
    plannedDistanceKm:
      calculated.distanceMeters === null && definition.plannedDistanceMeters !== undefined
        ? definition.plannedDistanceMeters / 1000
        : null,
    objective: definition.objective ?? '',
    description: definition.description ?? '',
    notes: definition.notes ?? '',
    steps: cloneValue(definition.steps),
  };
}

/** Prefixes step issues with their visible position: `Paso 2:` or `Paso 2.1:` in a repeat group. */
function toFormMessage(issue: z.core.$ZodIssue, steps: readonly WorkoutStep[]): string {
  const [root, index, childField, childIndex] = issue.path;

  if (root !== 'steps' || typeof index !== 'number') {
    return issue.message;
  }

  const isRepeatChild =
    steps[index]?.kind === StepKind.Repeat &&
    childField === 'steps' &&
    typeof childIndex === 'number';

  return isRepeatChild
    ? `Paso ${index + 1}.${childIndex + 1}: ${issue.message}`
    : `Paso ${index + 1}: ${issue.message}`;
}

function defaultModality(sport: Sport): SportModality | null {
  return SPORT_MODALITIES[sport][0] ?? null;
}

function defaultCategory(sport: Sport): WorkoutCategory {
  const categories = WORKOUT_CATEGORIES_BY_SPORT[sport];
  return categories.includes(WorkoutCategory.Endurance)
    ? WorkoutCategory.Endurance
    : (categories[0] ?? WorkoutCategory.Free);
}

function defaultMetric(sport: Sport, profile: AthleteProfileEntity | null): IntensityMetric {
  const preferred = profile?.preferredIntensityMetric ?? IntensityMetric.HeartRate;

  if (preferred === IntensityMetric.Rpe || supportsZoneMetric(sport, preferred)) {
    return preferred;
  }

  return supportsZoneMetric(sport, IntensityMetric.HeartRate)
    ? IntensityMetric.HeartRate
    : IntensityMetric.Rpe;
}
