import { inject, Injectable } from '@angular/core';
import type { z } from 'zod';

import type { AthleteProfileEntity } from '../../core/domain/schemas/athlete-profile.schema';
import {
  scheduledWorkoutSchema,
  type ScheduledWorkoutEntity,
} from '../../core/domain/schemas/scheduled-workout.schema';
import type {
  TrainingZone,
  TrainingZoneSetEntity,
} from '../../core/domain/schemas/training-zone-set.schema';
import {
  StepDurationType,
  StepKind,
  type IntervalStep,
} from '../../core/domain/schemas/workout-step.schema';
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
import {
  BlockTargetType,
  type TrainingSessionFormState,
  type TrainingSessionFormValue,
  type TrainingSessionTotals,
  type WorkoutBlockFormValue,
} from '../../core/models/training-session-form.model';
import { INTENSITY_METRIC_LABELS, SPORT_LABELS } from '../../core/models/workout-labels';
import { AthleteProfileRepository } from '../../core/repositories/athlete-profile.repository';
import { createId, nowIso } from '../../core/repositories/repository-utils';
import { ScheduledWorkoutRepository } from '../../core/repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../../core/repositories/training-zone-set.repository';

@Injectable({ providedIn: 'root' })
export class TrainingSessionFormFacade {
  private readonly workouts = inject(ScheduledWorkoutRepository);
  private readonly zoneSetsRepository = inject(TrainingZoneSetRepository);
  private readonly profiles = inject(AthleteProfileRepository);

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
        plannedDistanceKm: null,
        objective: '',
        description: '',
        notes: '',
        blocks: [],
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

    const intervals = workout.steps.filter(
      (step): step is IntervalStep => step.kind === StepKind.Interval,
    );

    if (intervals.length !== workout.steps.length) {
      throw new Error(
        'Este entrenamiento tiene repeticiones o ejercicios que este formulario todavía no puede editar.',
      );
    }

    return {
      mode: 'edit',
      selectedDate: workout.scheduledDate,
      profileAvailable: profile !== null,
      zoneSets,
      formValue: {
        id: workout.id,
        title: workout.title,
        scheduledDate: workout.scheduledDate,
        sport: workout.sport,
        modality: workout.modality ?? null,
        category: workout.category,
        primaryMetric: workout.primaryMetric,
        plannedDistanceKm:
          workout.plannedDistanceMeters !== undefined ? workout.plannedDistanceMeters / 1000 : null,
        objective: workout.objective ?? '',
        description: workout.description ?? '',
        notes: workout.notes ?? '',
        blocks: intervals.map((step, index) =>
          toBlockFormValue(step, index, workout.plannedDurationSeconds, intervals.length),
        ),
      },
    };
  }

  /** Zones available for the blocks of a workout with the given sport and metric. */
  zonesFor(
    zoneSets: readonly TrainingZoneSetEntity[],
    sport: Sport | null,
    metric: IntensityMetric | null,
  ): TrainingZone[] {
    return findZoneSet(zoneSets, sport, metric)?.zones ?? [];
  }

  calculateTotals(blocks: WorkoutBlockFormValue[]): TrainingSessionTotals {
    const durationMinutes = blocks.reduce(
      (total, block) => total + (block.durationMinutes ?? 0),
      0,
    );
    const distances = blocks.filter((block) => (block.distanceKm ?? 0) > 0);

    return {
      durationMinutes,
      distanceKm: distances.length
        ? distances.reduce((total, block) => total + (block.distanceKm ?? 0), 0)
        : null,
      blockCount: blocks.length,
    };
  }

  validate(value: TrainingSessionFormValue, zoneSets: readonly TrainingZoneSetEntity[]): string[] {
    const errors: string[] = [];

    if (!value.title.trim()) errors.push('El título del entrenamiento es requerido.');
    if (!value.scheduledDate) errors.push('La fecha es requerida.');
    if (!value.sport) errors.push('Selecciona un deporte.');
    if (!value.category) errors.push('Selecciona la categoría del entrenamiento.');
    if (!value.primaryMetric) errors.push('Selecciona la métrica de intensidad.');
    if (value.blocks.length === 0) errors.push('Agrega al menos un bloque de entrenamiento.');

    const zoneSet = findZoneSet(zoneSets, value.sport, value.primaryMetric);

    if (value.sport && value.primaryMetric && value.primaryMetric !== IntensityMetric.Rpe) {
      if (!supportsZoneMetric(value.sport, value.primaryMetric)) {
        errors.push(
          `${INTENSITY_METRIC_LABELS[value.primaryMetric]} no aplica para ${SPORT_LABELS[value.sport]}.`,
        );
      } else if (!zoneSet) {
        errors.push(
          `Configura tus zonas de ${INTENSITY_METRIC_LABELS[value.primaryMetric].toLowerCase()} antes de usarlas.`,
        );
      }
    }

    value.blocks.forEach((block, index) => {
      errors.push(...validateBlock(block, index, value.primaryMetric, zoneSet));
    });

    if (errors.length === 0) {
      const result = scheduledWorkoutSchema.safeParse(this.buildWorkout(value, zoneSets, null));

      if (!result.success) {
        errors.push(...result.error.issues.map(toFormMessage));
      }
    }

    return [...new Set(errors)];
  }

  async save(
    value: TrainingSessionFormValue,
    zoneSets: readonly TrainingZoneSetEntity[],
  ): Promise<ScheduledWorkoutEntity> {
    const errors = this.validate(value, zoneSets);

    if (errors.length > 0) {
      throw new Error(errors[0] ?? 'El formulario no es válido.');
    }

    const existing = value.id ? await this.workouts.findById(value.id) : null;
    const workout = this.buildWorkout(value, zoneSets, existing);

    return existing ? this.workouts.update(workout) : this.workouts.create(workout);
  }

  private buildWorkout(
    value: TrainingSessionFormValue,
    zoneSets: readonly TrainingZoneSetEntity[],
    existing: ScheduledWorkoutEntity | null,
  ): ScheduledWorkoutEntity {
    const zoneSet = findZoneSet(zoneSets, value.sport, value.primaryMetric);
    const totals = this.calculateTotals(value.blocks);
    const timestamp = nowIso();
    const sport = value.sport ?? Sport.Cycling;
    const plannedDistanceKm = totals.distanceKm ?? value.plannedDistanceKm;

    return {
      id: existing?.id ?? createId(),
      title: value.title.trim(),
      scheduledDate: value.scheduledDate,
      sport,
      ...(value.modality ? { modality: value.modality } : {}),
      category: value.category ?? WorkoutCategory.Free,
      primaryMetric: value.primaryMetric ?? IntensityMetric.Rpe,
      steps: value.blocks.map((block) =>
        toIntervalStep(block, value.primaryMetric, zoneSet, sport),
      ),
      plannedDurationSeconds: Math.round(totals.durationMinutes * 60),
      ...(plannedDistanceKm !== null && plannedDistanceKm > 0
        ? { plannedDistanceMeters: Math.round(plannedDistanceKm * 1000) }
        : {}),
      ...(value.objective.trim() ? { objective: value.objective.trim() } : {}),
      ...(value.description.trim() ? { description: value.description.trim() } : {}),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      status: existing?.status ?? WorkoutStatus.Planned,
      ...(existing?.completion ? { completion: existing.completion } : {}),
      ...(existing?.sourceTemplateId ? { sourceTemplateId: existing.sourceTemplateId } : {}),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  }
}

function findZoneSet(
  zoneSets: readonly TrainingZoneSetEntity[],
  sport: Sport | null,
  metric: IntensityMetric | null,
): TrainingZoneSetEntity | null {
  if (!sport || !metric || !supportsZoneMetric(sport, metric)) {
    return null;
  }

  return zoneSets.find((zoneSet) => zoneSet.sport === sport && zoneSet.metric === metric) ?? null;
}

function validateBlock(
  block: WorkoutBlockFormValue,
  index: number,
  metric: IntensityMetric | null,
  zoneSet: TrainingZoneSetEntity | null,
): string[] {
  const prefix = `Bloque ${index + 1}:`;
  const errors: string[] = [];

  if (!block.name.trim()) errors.push(`${prefix} El nombre del bloque es requerido.`);

  if (block.targetType === BlockTargetType.Time) {
    if (block.durationMinutes === null) {
      errors.push(`${prefix} La duración del bloque es requerida.`);
    } else if (block.durationMinutes <= 0) {
      errors.push(`${prefix} La duración debe ser mayor que cero.`);
    }
  } else if (block.distanceKm === null) {
    errors.push(`${prefix} La distancia del bloque es requerida.`);
  }

  if (block.distanceKm !== null && block.distanceKm <= 0) {
    errors.push(`${prefix} La distancia debe ser mayor que cero.`);
  }
  if (block.durationMinutes !== null && block.durationMinutes < 0) {
    errors.push(`${prefix} La duración no puede ser negativa.`);
  }
  if (block.targetRpe !== null && (block.targetRpe < 1 || block.targetRpe > 10)) {
    errors.push(`${prefix} El RPE debe estar entre 1 y 10.`);
  }
  if ((block.cadenceMin ?? 0) < 0 || (block.cadenceMax ?? 0) < 0) {
    errors.push(`${prefix} La cadencia debe ser positiva.`);
  }
  if (
    block.cadenceMin !== null &&
    block.cadenceMax !== null &&
    block.cadenceMin > block.cadenceMax
  ) {
    errors.push(`${prefix} La cadencia mínima no puede ser mayor que la máxima.`);
  }

  if (metric === IntensityMetric.Rpe && block.targetRpe === null) {
    errors.push(`${prefix} Define un RPE objetivo.`);
  }

  if (zoneSet && !zoneSet.zones.some((zone) => zone.id === block.trainingZoneId)) {
    errors.push(`${prefix} Selecciona una zona de entrenamiento.`);
  }

  return errors;
}

function toIntervalStep(
  block: WorkoutBlockFormValue,
  metric: IntensityMetric | null,
  zoneSet: TrainingZoneSetEntity | null,
  sport: Sport,
): IntervalStep {
  const zone = zoneSet?.zones.find((candidate) => candidate.id === block.trainingZoneId);
  const hasCadence =
    sport === Sport.Cycling && (block.cadenceMin !== null || block.cadenceMax !== null);
  const cadenceMin = block.cadenceMin ?? block.cadenceMax ?? 0;
  const cadenceMax = block.cadenceMax ?? block.cadenceMin ?? 0;

  return {
    id: block.id || createId(),
    kind: StepKind.Interval,
    name: block.name.trim(),
    phase: block.phase,
    duration:
      block.targetType === BlockTargetType.Distance
        ? { type: StepDurationType.Distance, meters: Math.round((block.distanceKm ?? 0) * 1000) }
        : { type: StepDurationType.Time, seconds: Math.round((block.durationMinutes ?? 0) * 60) },
    ...(zone && zoneSet
      ? {
          target: {
            metric: zoneSet.metric,
            zoneId: zone.id,
            zoneSnapshot: {
              zoneSetId: zoneSet.id,
              zoneId: zone.id,
              name: zone.name,
              metric: zoneSet.metric,
              minValue: zone.minValue,
              maxValue: zone.maxValue,
            },
          },
        }
      : metric === IntensityMetric.Rpe && block.targetRpe !== null
        ? { target: { metric: IntensityMetric.Rpe, value: block.targetRpe } }
        : {}),
    ...(hasCadence ? { cadenceRpm: { min: cadenceMin, max: cadenceMax } } : {}),
    ...(block.instructions.trim() ? { notes: block.instructions.trim() } : {}),
  };
}

function toBlockFormValue(
  step: IntervalStep,
  index: number,
  plannedDurationSeconds: number,
  blockCount: number,
): WorkoutBlockFormValue {
  const isDistance = step.duration.type === StepDurationType.Distance;
  const zoneTarget = step.target && step.target.metric !== IntensityMetric.Rpe ? step.target : null;
  const rpeTarget = step.target?.metric === IntensityMetric.Rpe ? step.target : null;

  return {
    id: step.id,
    name: step.name,
    phase: step.phase,
    targetType: isDistance ? BlockTargetType.Distance : BlockTargetType.Time,
    durationMinutes:
      step.duration.type === StepDurationType.Time
        ? step.duration.seconds / 60
        : // A single distance block keeps the planned duration as its estimate.
          blockCount === 1 && plannedDurationSeconds > 0
          ? plannedDurationSeconds / 60
          : null,
    distanceKm:
      step.duration.type === StepDurationType.Distance ? step.duration.meters / 1000 : null,
    trainingZoneId: zoneTarget?.zoneId ?? null,
    targetRpe: rpeTarget?.value ?? null,
    cadenceMin: step.cadenceRpm?.min ?? null,
    cadenceMax: step.cadenceRpm?.max ?? null,
    instructions: step.notes ?? '',
    sortOrder: index + 1,
  };
}

function toFormMessage(issue: z.core.$ZodIssue): string {
  const [root, index] = issue.path;

  return root === 'steps' && typeof index === 'number'
    ? `Bloque ${index + 1}: ${issue.message}`
    : issue.message;
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
