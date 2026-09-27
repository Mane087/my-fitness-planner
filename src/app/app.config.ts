import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { LocalPersistenceService } from './core/services/local-persistence.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Opens IndexedDB, runs migrations and seeds default data before the first navigation.
    // A failure must not block the app: each page shows its own storage error.
    provideAppInitializer(() =>
      inject(LocalPersistenceService)
        .initialize()
        .catch((error: unknown) => {
          console.error('Local storage initialization failed.', error);
        }),
    ),
  ],
};
