import { inject, Injectable } from '@angular/core';

import { WeekStartsOn } from '../domain/calendar.enums';
import {
  athleteProfileSchema,
  type AthleteProfileEntity,
} from '../domain/schemas/athlete-profile.schema';
import { IntensityMetric, Sport } from '../domain/workout.enums';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { createId, nowIso, parseEntity } from './repository-utils';

export const DEFAULT_MAX_HEART_RATE = 190;

@Injectable({ providedIn: 'root' })
export class AthleteProfileRepository {
  private readonly indexedDb = inject(IndexedDbService);

  async getActiveProfile(): Promise<AthleteProfileEntity | null> {
    const profiles = await this.indexedDb.getAll(IndexedDbStore.AthleteProfiles);
    return profiles[0] ?? null;
  }

  /**
   * The default profile keeps `createdAt === updatedAt` until the user saves it for
   * the first time, because `save` always writes a new `updatedAt`.
   */
  async hasConfiguredProfile(): Promise<boolean> {
    const profile = await this.getActiveProfile();
    return profile !== null && profile.createdAt !== profile.updatedAt;
  }

  async createDefaultProfile(): Promise<AthleteProfileEntity> {
    const existing = await this.getActiveProfile();

    if (existing) {
      return existing;
    }

    const timestamp = nowIso();
    const profile: AthleteProfileEntity = {
      id: createId(),
      name: 'Atleta',
      maxHeartRate: DEFAULT_MAX_HEART_RATE,
      preferredSport: Sport.Cycling,
      preferredIntensityMetric: IntensityMetric.HeartRate,
      weekStartsOn: WeekStartsOn.Monday,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.indexedDb.add(IndexedDbStore.AthleteProfiles, profile);
  }

  async save(profile: AthleteProfileEntity): Promise<AthleteProfileEntity> {
    const timestamp = nowIso();
    const nextProfile = parseEntity(athleteProfileSchema, 'Athlete profile', {
      ...profile,
      id: profile.id || createId(),
      createdAt: profile.createdAt || timestamp,
      updatedAt: timestamp,
    });

    return this.indexedDb.put(IndexedDbStore.AthleteProfiles, nextProfile);
  }
}
