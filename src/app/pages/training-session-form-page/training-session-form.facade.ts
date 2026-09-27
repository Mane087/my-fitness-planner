import { inject, Injectable } from '@angular/core';

import type { ScheduledWorkoutEntity } from '../../core/domain/scheduled-workout.model';
import type { TrainingZoneEntity } from '../../core/domain/training-zone.model';
import { WorkoutBlockTargetType, WorkoutBlockType } from '../../core/domain/workout-block.model';
import {
  IntensityMetric,
  WorkoutDiscipline,
  WorkoutStatus,
  WorkoutType,
} from '../../core/domain/workout.enums';
import { createId, nowIso } from '../../core/repositories/repository-utils';
import { ScheduledWorkoutRepository } from '../../core/repositories/scheduled-workout.repository';
import { SportProfileRepository } from '../../core/repositories/sport-profile.repository';
import { TrainingZoneRepository } from '../../core/repositories/training-zone.repository';
import type {
  TrainingSessionFormState,
  TrainingSessionFormValue,
  TrainingSessionTotals,
  WorkoutBlockFormValue,
} from '../../core/interfaces/training-session-form.model';

@Injectable({ providedIn: 'root' })
export class TrainingSessionFormFacade {
  private readonly workouts = inject(ScheduledWorkoutRepository);
  private readonly zonesRepository = inject(TrainingZoneRepository);
  private readonly profiles = inject(SportProfileRepository);

  async loadCreateForm(date: string): Promise<TrainingSessionFormState> {
    const [profile, zones] = await Promise.all([
      this.profiles.getActiveProfile(),
      this.zonesRepository.findAll(),
    ]);
    const discipline =
      profile?.preferredDiscipline === 'mixed'
        ? WorkoutDiscipline.Road
        : profile?.preferredDiscipline;

    return {
      mode: 'create',
      selectedDate: date,
      profileAvailable: profile !== null,
      zones,
      formValue: {
        title: '',
        scheduledDate: date,
        discipline: discipline ?? null,
        workoutType: WorkoutType.Endurance,
        intensityMetric: profile?.preferredIntensityMetric ?? IntensityMetric.HeartRate,
        plannedDistanceKm: null,
        objective: '',
        description: '',
        notes: '',
        blocks: [],
      },
    };
  }

  async loadEditForm(workoutId: string): Promise<TrainingSessionFormState> {
    const [profile, zones, workout] = await Promise.all([
      this.profiles.getActiveProfile(),
      this.zonesRepository.findAll(),
      this.workouts.findById(workoutId),
    ]);

    if (!workout) {
      throw new Error('El entrenamiento no existe.');
    }

    return {
      mode: 'edit',
      selectedDate: workout.scheduledDate,
      profileAvailable: profile !== null,
      zones,
      formValue: {
        id: workout.id,
        title: workout.title,
        scheduledDate: workout.scheduledDate,
        discipline: workout.discipline,
        workoutType: workout.workoutType,
        intensityMetric: workout.intensityMetric ?? IntensityMetric.HeartRate,
        plannedDistanceKm: workout.plannedDistanceKm ?? null,
        objective: workout.objective ?? '',
        description: workout.description ?? '',
        notes: workout.notes ?? '',
        blocks: [...workout.blocks]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((block, index) => ({
            id: block.id,
            name: block.name,
            blockType: block.blockType ?? WorkoutBlockType.Active,
            durationMinutes: block.durationMinutes,
            distanceKm: block.distanceKm ?? null,
            targetType: block.targetType ?? WorkoutBlockTargetType.Time,
            trainingZoneId: block.targetZoneId ?? null,
            trainingZoneSnapshot: block.targetZoneSnapshot ?? null,
            targetRpe: block.targetRpe ?? null,
            cadenceMin: block.cadenceMin ?? null,
            cadenceMax: block.cadenceMax ?? null,
            instructions: block.instructions ?? '',
            sortOrder: index + 1,
          })),
      },
    };
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

  validate(value: TrainingSessionFormValue, zones: TrainingZoneEntity[]): string[] {
    const errors: string[] = [];
    const zoneIds = new Set(zones.map((zone) => zone.id));
    const blockIds = new Set<string>();

    if (!value.title.trim()) errors.push('El título del entrenamiento es requerido.');
    if (!value.scheduledDate) errors.push('La fecha es requerida.');
    if (!value.discipline) errors.push('Selecciona una disciplina.');
    if (!value.workoutType) errors.push('Selecciona el tipo de entrenamiento.');
    if (!value.intensityMetric) errors.push('Selecciona la métrica de intensidad.');
    if (value.blocks.length === 0) errors.push('Agrega al menos un bloque de entrenamiento.');

    value.blocks.forEach((block, index) => {
      if (!block.name.trim())
        errors.push(`Bloque ${index + 1}: El nombre del bloque es requerido.`);
      if (!block.durationMinutes) {
        errors.push(`Bloque ${index + 1}: La duración del bloque es requerida.`);
      } else if (block.durationMinutes <= 0) {
        errors.push(`Bloque ${index + 1}: La duración debe ser mayor que cero.`);
      }
      if (block.targetType === WorkoutBlockTargetType.Distance && !block.distanceKm) {
        errors.push(`Bloque ${index + 1}: La distancia del bloque es requerida.`);
      }
      if (block.distanceKm !== null && block.distanceKm <= 0) {
        errors.push(`Bloque ${index + 1}: La distancia debe ser mayor que cero.`);
      }
      if (block.targetRpe !== null && (block.targetRpe < 1 || block.targetRpe > 10)) {
        errors.push(`Bloque ${index + 1}: El RPE debe estar entre 1 y 10.`);
      }
      if ((block.cadenceMin ?? 0) < 0 || (block.cadenceMax ?? 0) < 0) {
        errors.push(`Bloque ${index + 1}: La cadencia debe ser positiva.`);
      }
      if (
        block.cadenceMin !== null &&
        block.cadenceMax !== null &&
        block.cadenceMin > block.cadenceMax
      ) {
        errors.push(`Bloque ${index + 1}: La cadencia mínima no puede ser mayor que la máxima.`);
      }

      const validZone = block.trainingZoneId !== null && zoneIds.has(block.trainingZoneId);
      if (value.intensityMetric === IntensityMetric.HeartRate && !validZone) {
        errors.push(`Bloque ${index + 1}: Selecciona una zona de entrenamiento.`);
      }
      if (value.intensityMetric === IntensityMetric.Rpe && block.targetRpe === null) {
        errors.push(`Bloque ${index + 1}: Define un RPE objetivo.`);
      }
      if (
        value.intensityMetric === IntensityMetric.Mixed &&
        !validZone &&
        block.targetRpe === null
      ) {
        errors.push(`Bloque ${index + 1}: Selecciona una zona o define un RPE.`);
      }
      if (blockIds.has(block.id)) errors.push('Los identificadores de bloque deben ser únicos.');
      blockIds.add(block.id);
    });

    if (this.calculateTotals(value.blocks).durationMinutes <= 0 && value.blocks.length > 0) {
      errors.push('La duración total debe ser mayor que cero.');
    }
    if (value.intensityMetric === IntensityMetric.HeartRate && zones.length === 0) {
      errors.push('Configura tus zonas de entrenamiento antes de usar frecuencia cardíaca.');
    }

    return [...new Set(errors)];
  }

  async save(
    value: TrainingSessionFormValue,
    zones: TrainingZoneEntity[],
  ): Promise<ScheduledWorkoutEntity> {
    const errors = this.validate(value, zones);
    if (errors.length > 0 || !value.discipline || !value.workoutType || !value.intensityMetric) {
      throw new Error(errors[0] ?? 'El formulario no es válido.');
    }

    // Narrowed after the guard above — guaranteed non-null here
    const discipline: WorkoutDiscipline = value.discipline;
    const workoutType: WorkoutType = value.workoutType;
    const intensityMetric: IntensityMetric = value.intensityMetric;

    const existing = value.id ? await this.workouts.findById(value.id) : null;
    const timestamp = nowIso();
    const normalizedBlocks = value.blocks.map((block, index) => {
      const zone = zones.find((candidate) => candidate.id === block.trainingZoneId);
      return {
        id: block.id || createId(),
        name: block.name.trim(),
        blockType: block.blockType,
        targetType: block.targetType,
        durationMinutes: block.durationMinutes ?? 0,
        ...(block.distanceKm !== null ? { distanceKm: block.distanceKm } : {}),
        ...(zone
          ? {
              targetZoneId: zone.id,
              targetZoneSnapshot: {
                id: zone.id,
                name: zone.name,
                minHeartRate: zone.minHeartRate,
                maxHeartRate: zone.maxHeartRate,
              },
            }
          : {}),
        ...(block.targetRpe !== null ? { targetRpe: block.targetRpe } : {}),
        ...(block.cadenceMin !== null ? { cadenceMin: block.cadenceMin } : {}),
        ...(block.cadenceMax !== null ? { cadenceMax: block.cadenceMax } : {}),
        ...(block.instructions.trim() ? { instructions: block.instructions.trim() } : {}),
        sortOrder: index + 1,
      };
    });
    const totals = this.calculateTotals(value.blocks);
    const workout: ScheduledWorkoutEntity = {
      id: existing?.id ?? createId(),
      title: value.title.trim(),
      scheduledDate: value.scheduledDate,
      workoutType,
      discipline,
      intensityMetric,
      estimatedDurationMinutes: totals.durationMinutes,
      ...(totals.distanceKm !== null
        ? { plannedDistanceKm: totals.distanceKm }
        : value.plannedDistanceKm !== null
          ? { plannedDistanceKm: value.plannedDistanceKm }
          : {}),
      ...(value.objective.trim() ? { objective: value.objective.trim() } : {}),
      ...(value.description.trim() ? { description: value.description.trim() } : {}),
      ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
      status: existing?.status ?? WorkoutStatus.Planned,
      blocks: normalizedBlocks,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    return existing ? this.workouts.update(workout) : this.workouts.create(workout);
  }
}
