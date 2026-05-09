import { inject, Injectable } from '@angular/core';
import {
  PreferredDiscipline,
  PreferredIntensityMetric,
  WeekStartsOn,
  type SportProfileEntity,
} from '../domain/sport-profile.model';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { createId, nowIso } from './repository-utils';

@Injectable({ providedIn: 'root' })
export class SportProfileRepository {
  private readonly indexedDb = inject(IndexedDbService);

  async getActiveProfile(): Promise<SportProfileEntity | null> {
    const profiles = await this.indexedDb.getAll(IndexedDbStore.SportProfiles);
    return profiles[0] ?? null;
  }

  async createDefaultProfile(): Promise<SportProfileEntity> {
    const existing = await this.getActiveProfile();

    if (existing) {
      return existing;
    }

    const timestamp = nowIso();
    return this.indexedDb.add(IndexedDbStore.SportProfiles, {
      id: createId(),
      name: 'Default Athlete',
      maxHeartRate: 193,
      preferredDiscipline: PreferredDiscipline.Mixed,
      preferredIntensityMetric: PreferredIntensityMetric.HeartRate,
      weekStartsOn: WeekStartsOn.Monday,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  save(profile: SportProfileEntity): Promise<SportProfileEntity> {
    this.validate(profile);
    const timestamp = nowIso();
    return this.indexedDb.put(IndexedDbStore.SportProfiles, {
      ...profile,
      id: profile.id || createId(),
      createdAt: profile.createdAt || timestamp,
      updatedAt: timestamp,
    });
  }

  update(profile: SportProfileEntity): Promise<SportProfileEntity> {
    this.validate(profile);
    return this.indexedDb.put(IndexedDbStore.SportProfiles, {
      ...profile,
      updatedAt: nowIso(),
    });
  }

  private validate(profile: SportProfileEntity): void {
    if (!profile.name.trim()) {
      throw new Error('Sport profile name is required.');
    }

    if (profile.maxHeartRate <= 0) {
      throw new Error('Sport profile max heart rate must be greater than 0.');
    }
  }
}
