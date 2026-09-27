import { inject, Injectable } from '@angular/core';

import { CalendarDefaultView, TimeFormat, WeekStartsOn } from '../domain/calendar.enums';
import { appSettingsSchema, type AppSettingsEntity } from '../domain/schemas/app-settings.schema';
import { IndexedDbStore } from '../storage/indexed-db.config';
import { IndexedDbService } from '../storage/indexed-db.service';
import { createId, nowIso, parseEntity } from './repository-utils';

@Injectable({ providedIn: 'root' })
export class AppSettingsRepository {
  private readonly indexedDb = inject(IndexedDbService);

  async getSettings(): Promise<AppSettingsEntity> {
    const settings = await this.indexedDb.getAll(IndexedDbStore.AppSettings);
    return settings[0] ?? this.createDefaultSettings();
  }

  async update(settings: AppSettingsEntity): Promise<AppSettingsEntity> {
    const nextSettings = parseEntity(appSettingsSchema, 'App settings', {
      ...settings,
      updatedAt: nowIso(),
    });

    return this.indexedDb.put(IndexedDbStore.AppSettings, nextSettings);
  }

  async createDefaultSettings(): Promise<AppSettingsEntity> {
    const existing = await this.indexedDb.getAll(IndexedDbStore.AppSettings);

    if (existing[0]) {
      return existing[0];
    }

    const timestamp = nowIso();
    const settings: AppSettingsEntity = {
      id: createId(),
      calendarDefaultView: CalendarDefaultView.Month,
      weekStartsOn: WeekStartsOn.Monday,
      timeFormat: TimeFormat.TwentyFourHour,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.indexedDb.add(IndexedDbStore.AppSettings, settings);
  }
}
