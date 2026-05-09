import { inject, Injectable } from '@angular/core';
import {
  CalendarDefaultView,
  TimeFormat,
  type AppSettingsEntity,
} from '../domain/app-settings.model';
import { WeekStartsOn } from '../domain/sport-profile.model';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { createId, nowIso } from './repository-utils';

@Injectable({ providedIn: 'root' })
export class AppSettingsRepository {
  private readonly indexedDb = inject(IndexedDbService);

  async getSettings(): Promise<AppSettingsEntity> {
    const settings = await this.indexedDb.getAll(IndexedDbStore.AppSettings);
    return settings[0] ?? this.createDefaultSettings();
  }

  update(settings: AppSettingsEntity): Promise<AppSettingsEntity> {
    const nextSettings = { ...settings, updatedAt: nowIso() };
    return this.indexedDb.put(IndexedDbStore.AppSettings, nextSettings);
  }

  async createDefaultSettings(): Promise<AppSettingsEntity> {
    const existing = await this.indexedDb.getAll(IndexedDbStore.AppSettings);

    if (existing[0]) {
      return existing[0];
    }

    const timestamp = nowIso();
    return this.indexedDb.add(IndexedDbStore.AppSettings, {
      id: createId(),
      calendarDefaultView: CalendarDefaultView.Week,
      weekStartsOn: WeekStartsOn.Monday,
      timeFormat: TimeFormat.TwentyFourHour,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}
