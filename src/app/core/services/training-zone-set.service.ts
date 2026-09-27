import { inject, Injectable } from '@angular/core';

import {
  editableTrainingZoneSetSchema,
  type TrainingZoneSetEntity,
} from '../domain/schemas/training-zone-set.schema';
import { StepKind, type WorkoutStep } from '../domain/schemas/workout-step.schema';
import {
  createDefaultZones,
  createDefaultZoneSet,
  DEFAULT_REFERENCE_VALUES,
} from '../domain/training-zone-set.defaults';
import { IntensityMetric, type Sport, type ZoneMetric } from '../domain/workout.enums';
import { AthleteProfileRepository } from '../repositories/athlete-profile.repository';
import { parseEntity } from '../repositories/repository-utils';
import { ScheduledWorkoutRepository } from '../repositories/scheduled-workout.repository';
import { TrainingZoneSetRepository } from '../repositories/training-zone-set.repository';
import { WorkoutTemplateRepository } from '../repositories/workout-template.repository';

const ENTITY_NAME = 'Training zone set';

@Injectable({ providedIn: 'root' })
export class TrainingZoneSetService {
  private readonly zoneSets = inject(TrainingZoneSetRepository);
  private readonly profiles = inject(AthleteProfileRepository);
  private readonly workouts = inject(ScheduledWorkoutRepository);
  private readonly templates = inject(WorkoutTemplateRepository);

  /**
   * Returns the set for the sport and metric, or creates it from the default table.
   * Without a reference value, heart rate uses the profile max HR and the other metrics a default.
   */
  async getOrSeed(
    sport: Sport,
    metric: ZoneMetric,
    referenceValue?: number,
  ): Promise<TrainingZoneSetEntity> {
    const existing = await this.zoneSets.findBySportAndMetric(sport, metric);

    if (existing) {
      return existing;
    }

    const reference = referenceValue ?? (await this.defaultReferenceValue(metric));
    return this.save(createDefaultZoneSet(sport, metric, reference));
  }

  /** Recreates the zones with the default percentages. Zone ids are kept by position. */
  async regenerateFromReference(
    setId: string,
    referenceValue: number,
  ): Promise<TrainingZoneSetEntity> {
    const current = await this.findExisting(setId);
    const zones = createDefaultZones(current.metric, referenceValue).map((zone, index) => ({
      ...zone,
      id: current.zones[index]?.id ?? zone.id,
    }));

    return this.save({ ...current, referenceValue, zones });
  }

  /** Validates the set with the editing rules (contiguous zones, realistic reference) and stores it. */
  async save(zoneSet: TrainingZoneSetEntity): Promise<TrainingZoneSetEntity> {
    return this.zoneSets.save(parseEntity(editableTrainingZoneSetSchema, ENTITY_NAME, zoneSet));
  }

  /** Deletes a set that no workout or template uses as a target. */
  async delete(setId: string): Promise<void> {
    await this.findExisting(setId);

    if (await this.isInUse(setId)) {
      throw new Error(
        'No puedes eliminar estas zonas porque hay entrenamientos o plantillas que las usan.',
      );
    }

    await this.zoneSets.delete(setId);
  }

  async isInUse(setId: string): Promise<boolean> {
    const [workouts, templates] = await Promise.all([
      this.workouts.findAll(),
      this.templates.findAll(),
    ]);

    return [...workouts, ...templates].some((definition) => usesZoneSet(definition.steps, setId));
  }

  private async findExisting(setId: string): Promise<TrainingZoneSetEntity> {
    const zoneSet = await this.zoneSets.findById(setId);

    if (!zoneSet) {
      throw new Error('Las zonas no existen.');
    }

    return zoneSet;
  }

  private async defaultReferenceValue(metric: ZoneMetric): Promise<number> {
    if (metric === IntensityMetric.HeartRate) {
      const profile = await this.profiles.getActiveProfile();
      return profile?.maxHeartRate ?? DEFAULT_REFERENCE_VALUES[metric];
    }

    return DEFAULT_REFERENCE_VALUES[metric];
  }
}

function usesZoneSet(steps: readonly WorkoutStep[], setId: string): boolean {
  return steps
    .flatMap((step) => (step.kind === StepKind.Repeat ? step.steps : [step]))
    .some(
      (step) =>
        step.kind === StepKind.Interval &&
        step.target !== undefined &&
        step.target.metric !== IntensityMetric.Rpe &&
        step.target.zoneSnapshot.zoneSetId === setId,
    );
}
