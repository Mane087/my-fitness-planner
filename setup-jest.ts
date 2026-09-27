import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

import { configureZodSpanishMessages } from './src/app/core/domain/zod-error-map';

setupZoneTestEnv();
configureZodSpanishMessages();
