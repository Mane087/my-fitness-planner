import { inject, Injectable } from '@angular/core';
import { AppSettingsRepository } from '../repositories/app-settings.repository';
import { SportProfileRepository } from '../repositories/sport-profile.repository';
import { TrainingZoneRepository } from '../repositories/training-zone.repository';
import { IndexedDbService } from '../storage/indexed-db.service';

@Injectable({ providedIn: 'root' })
export class LocalPersistenceService {
  private readonly indexedDb = inject(IndexedDbService);
  private readonly appSettingsRepository = inject(AppSettingsRepository);
  private readonly sportProfileRepository = inject(SportProfileRepository);
  private readonly trainingZoneRepository = inject(TrainingZoneRepository);

  async initialize(): Promise<void> {
    await this.indexedDb.initialize();
    await this.appSettingsRepository.createDefaultSettings();
    const profile = await this.sportProfileRepository.createDefaultProfile();
    await this.trainingZoneRepository.seedDefaultZonesIfEmpty(profile.maxHeartRate);
  }
}
