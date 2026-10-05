import type { IndexedDbMigration } from '../indexed-db.types';
import { transformRecords } from './migration-utils';

const APP_SETTINGS_STORE = 'app_settings';

export const v3ThemeSettingMigration: IndexedDbMigration = {
  version: 3,
  description: 'Adds the theme preference to app settings.',
  upgrade({ transaction }) {
    transformRecords<Record<string, unknown>, Record<string, unknown>>(
      transaction.objectStore(APP_SETTINGS_STORE),
      (settings) => ({ ...settings, theme: settings['theme'] ?? 'system' }),
    );
  },
};
