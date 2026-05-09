import { inject, Injectable } from '@angular/core';
import type { TrainingZoneEntity } from '../domain/training-zone.model';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { createId, nowIso } from './repository-utils';

@Injectable({ providedIn: 'root' })
export class TrainingZoneRepository {
  private readonly indexedDb = inject(IndexedDbService);

  async findAll(): Promise<TrainingZoneEntity[]> {
    const zones = await this.indexedDb.getAllFromIndex(
      IndexedDbStore.TrainingZones,
      'by_sort_order',
    );
    return zones.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  findById(id: string): Promise<TrainingZoneEntity | null> {
    return this.indexedDb.getById(IndexedDbStore.TrainingZones, id);
  }

  async create(zone: TrainingZoneEntity): Promise<TrainingZoneEntity> {
    const timestamp = nowIso();
    const nextZone = {
      ...zone,
      id: zone.id || createId(),
      createdAt: zone.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await this.validate(nextZone);
    return this.indexedDb.add(IndexedDbStore.TrainingZones, nextZone);
  }

  async update(zone: TrainingZoneEntity): Promise<TrainingZoneEntity> {
    const nextZone = { ...zone, updatedAt: nowIso() };
    await this.validate(nextZone);
    return this.indexedDb.put(IndexedDbStore.TrainingZones, nextZone);
  }

  delete(id: string): Promise<void> {
    return this.indexedDb.delete(IndexedDbStore.TrainingZones, id);
  }

  async seedDefaultZonesIfEmpty(maxHeartRate: number): Promise<void> {
    const existing = await this.findAll();

    if (existing.length > 0) {
      return;
    }

    const timestamp = nowIso();
    const defaults = [
      ['Z1 Recovery', 'Easy recovery', 0.5, 0.6],
      ['Z2 Endurance', 'Aerobic base', 0.6, 0.7],
      ['Z3 Tempo', 'Moderate sustained work', 0.7, 0.8],
      ['Z4 Threshold', 'Hard sustained work', 0.8, 0.9],
      ['Z5 High Intensity', 'VO2 max / anaerobic efforts', 0.9, 1],
    ] as const;

    for (const [index, zone] of defaults.entries()) {
      const [name, description, minPercent, maxPercent] = zone;
      await this.indexedDb.add(IndexedDbStore.TrainingZones, {
        id: createId(),
        name,
        description,
        minHeartRate: Math.round(maxHeartRate * minPercent),
        maxHeartRate: Math.round(maxHeartRate * maxPercent),
        sortOrder: index + 1,
        isDefault: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  private async validate(zone: TrainingZoneEntity): Promise<void> {
    if (!zone.name.trim()) {
      throw new Error('Training zone name is required.');
    }

    if (zone.minHeartRate <= 0 || zone.maxHeartRate <= 0) {
      throw new Error('Training zone heart rates must be greater than 0.');
    }

    if (zone.minHeartRate > zone.maxHeartRate) {
      throw new Error(
        'Training zone minimum heart rate must be lower than or equal to maximum heart rate.',
      );
    }

    if (!Number.isFinite(zone.sortOrder)) {
      throw new Error('Training zone sort order is required.');
    }

    const zones = await this.findAll();
    const overlaps = zones.some(
      (current) =>
        current.id !== zone.id &&
        zone.minHeartRate < current.maxHeartRate &&
        zone.maxHeartRate > current.minHeartRate,
    );

    if (overlaps) {
      throw new Error('Training zones must not overlap.');
    }
  }
}
