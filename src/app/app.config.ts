import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { LocalPersistenceService } from './core/services/local-persistence.service';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Opens IndexedDB, runs migrations and seeds default data before the first navigation.
    // A failure must not block the app: each page shows its own storage error.
    provideAppInitializer(async () => {
      // inject() only works before the first await.
      const localPersistence = inject(LocalPersistenceService);
      const theme = inject(ThemeService);

      try {
        await localPersistence.initialize();
      } catch (error: unknown) {
        console.error('Local storage initialization failed.', error);
        return;
      }

      await theme.initialize().catch((error: unknown) => {
        console.error('Theme initialization failed.', error);
      });
    }),
  ],
};
