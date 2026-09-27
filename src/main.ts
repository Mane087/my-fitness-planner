import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { configureZodSpanishMessages } from './app/core/domain/zod-error-map';

configureZodSpanishMessages();

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
