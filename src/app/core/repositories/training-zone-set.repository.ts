import { inject, Injectable } from '@angular/core';

import {
  trainingZoneSetSchema,
  type TrainingZoneSetEntity,
} from '../domain/schemas/training-zone-set.schema';
import type { Sport, ZoneMetric } from '../domain/workout.enums';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { createId, nowIso, parseEntity } from './repository-utils';

@Injectable({ providedIn: 'root' })
export class TrainingZoneSetRepository {
  private readonly indexedDb = inject(IndexedDbService);

  findAll(): Promise<TrainingZoneSetEntity[]> {
    return this.indexedDb.getAll(IndexedDbStore.TrainingZoneSets);
  }

  findById(id: string): Promise<TrainingZoneSetEntity | null> {
    return this.indexedDb.getById(IndexedDbStore.TrainingZoneSets, id);
  }

  async findBySportAndMetric(
    sport: Sport,
    metric: ZoneMetric,
  ): Promise<TrainingZoneSetEntity | null> {
    const zoneSets = await this.indexedDb.getAllFromIndex(
      IndexedDbStore.TrainingZoneSets,
      'by_sport_and_metric',
      [sport, metric],
    );

    return zoneSets[0] ?? null;
  }

  async findBySport(sport: Sport): Promise<TrainingZoneSetEntity[]> {
    const zoneSets = await this.findAll();
    return zoneSets.filter((zoneSet) => zoneSet.sport === sport);
  }

  async save(zoneSet: TrainingZoneSetEntity): Promise<TrainingZoneSetEntity> {
    const timestamp = nowIso();
    const nextZoneSet = parseEntity(trainingZoneSetSchema, 'Training zone set', {
      ...zoneSet,
      id: zoneSet.id || createId(),
      createdAt: zoneSet.createdAt || timestamp,
      updatedAt: timestamp,
    });

    return this.indexedDb.put(IndexedDbStore.TrainingZoneSets, nextZoneSet);
  }

  delete(id: string): Promise<void> {
    return this.indexedDb.delete(IndexedDbStore.TrainingZoneSets, id);
  }
}
