import { inject, Injectable } from '@angular/core';

import { IntensityMetric, resolveHeartRateZoneSport } from '../domain/workout.enums';
import { AppSettingsRepository } from '../repositories/app-settings.repository';
import { AthleteProfileRepository } from '../repositories/athlete-profile.repository';
import { IndexedDbService } from '../storage/indexed-db.service';
import { TrainingZoneSetService } from './training-zone-set.service';

@Injectable({ providedIn: 'root' })
export class LocalPersistenceService {
  private readonly indexedDb = inject(IndexedDbService);
  private readonly appSettingsRepository = inject(AppSettingsRepository);
  private readonly athleteProfileRepository = inject(AthleteProfileRepository);
  private readonly trainingZoneSetService = inject(TrainingZoneSetService);

  async initialize(): Promise<void> {
    await this.indexedDb.initialize();
    await this.appSettingsRepository.createDefaultSettings();
    const profile = await this.athleteProfileRepository.createDefaultProfile();
    await this.trainingZoneSetService.getOrSeed(
      resolveHeartRateZoneSport(profile.preferredSport),
      IntensityMetric.HeartRate,
      profile.maxHeartRate,
    );
  }
}
