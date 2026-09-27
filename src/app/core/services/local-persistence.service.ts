import { inject, Injectable } from '@angular/core';

import { IntensityMetric, resolveHeartRateZoneSport } from '../domain/workout.enums';
import { AppSettingsRepository } from '../repositories/app-settings.repository';
import { AthleteProfileRepository } from '../repositories/athlete-profile.repository';
import { TrainingZoneSetRepository } from '../repositories/training-zone-set.repository';
import { IndexedDbService } from '../storage/indexed-db.service';

@Injectable({ providedIn: 'root' })
export class LocalPersistenceService {
  private readonly indexedDb = inject(IndexedDbService);
  private readonly appSettingsRepository = inject(AppSettingsRepository);
  private readonly athleteProfileRepository = inject(AthleteProfileRepository);
  private readonly trainingZoneSetRepository = inject(TrainingZoneSetRepository);

  async initialize(): Promise<void> {
    await this.indexedDb.initialize();
    await this.appSettingsRepository.createDefaultSettings();
    const profile = await this.athleteProfileRepository.createDefaultProfile();
    await this.trainingZoneSetRepository.getOrSeed(
      resolveHeartRateZoneSport(profile.preferredSport),
      IntensityMetric.HeartRate,
      profile.maxHeartRate,
    );
  }
}
