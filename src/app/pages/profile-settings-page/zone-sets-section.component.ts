import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import type { TrainingZoneSetEntity } from '../../core/domain/schemas/training-zone-set.schema';
import {
  IntensityMetric,
  SPORTS,
  ZONE_METRICS_BY_SPORT,
  type Sport,
  type ZoneMetric,
} from '../../core/domain/workout.enums';
import { SPORT_LABELS } from '../../core/models/workout-labels';
import { TrainingZoneSetRepository } from '../../core/repositories/training-zone-set.repository';
import { ZoneSetEditorComponent } from './zone-set-editor.component';

interface ZoneSetSlot {
  sport: Sport;
  metric: ZoneMetric;
}

/** Zone sets for every sport and zone metric; sports without zone metrics use RPE only. */
@Component({
  selector: 'app-zone-sets-section',
  imports: [ZoneSetEditorComponent],
  templateUrl: './zone-sets-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoneSetsSectionComponent {
  private readonly zoneSetRepository = inject(TrainingZoneSetRepository);

  /** Suggested reference for heart rate sets that do not exist yet. */
  readonly profileMaxHeartRate = input<number | null>(null);

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly zoneSets = signal<TrainingZoneSetEntity[]>([]);

  readonly slots: ZoneSetSlot[] = SPORTS.flatMap((sport) =>
    ZONE_METRICS_BY_SPORT[sport].map((metric) => ({ sport, metric })),
  );
  readonly rpeOnlySportsLabel = SPORTS.filter((sport) => ZONE_METRICS_BY_SPORT[sport].length === 0)
    .map((sport) => SPORT_LABELS[sport])
    .join(' y ');

  private readonly zoneSetsBySlot = computed(
    () => new Map(this.zoneSets().map((zoneSet) => [slotKey(zoneSet), zoneSet])),
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');

    try {
      this.zoneSets.set(await this.zoneSetRepository.findAll());
    } catch {
      this.loadError.set('No se pudieron cargar las zonas de entrenamiento.');
    } finally {
      this.loading.set(false);
    }
  }

  zoneSetFor(slot: ZoneSetSlot): TrainingZoneSetEntity | null {
    return this.zoneSetsBySlot().get(slotKey(slot)) ?? null;
  }

  suggestedReference(slot: ZoneSetSlot): number | null {
    return slot.metric === IntensityMetric.HeartRate ? this.profileMaxHeartRate() : null;
  }

  replace(zoneSet: TrainingZoneSetEntity): void {
    this.zoneSets.update((zoneSets) => [
      ...zoneSets.filter((current) => current.id !== zoneSet.id),
      zoneSet,
    ]);
  }

  remove(zoneSetId: string): void {
    this.zoneSets.update((zoneSets) => zoneSets.filter((zoneSet) => zoneSet.id !== zoneSetId));
  }
}

function slotKey(slot: ZoneSetSlot): string {
  return `${slot.sport}:${slot.metric}`;
}
