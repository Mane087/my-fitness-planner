import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, Routes } from '@angular/router';

import { TrainingSessionFormPageComponent } from './pages/training-session-form-page/training-session-form-page.component';
import { CalendarPageComponent } from './pages/calendar/calendar-page.component';
import { HomePageComponent } from './pages/home/home.component';
import { ProfileSettingsPageComponent } from './pages/profile-settings-page/profile-settings-page.component';

@Component({
  selector: 'app-placeholder',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-slate-900 text-slate-50">
      <div class="text-center">
        <h1 class="mb-4 text-3xl font-bold">{{ title }}</h1>
        <p class="mb-8 text-slate-400">Esta funcionalidad estará disponible próximamente.</p>
        <a
          routerLink="/calendar"
          class="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Volver al calendario
        </a>
      </div>
    </main>
  `,
})
export class PlaceholderComponent {
  readonly title = 'Funcionalidad no disponible';
}

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
  },
  {
    path: 'calendar',
    component: CalendarPageComponent,
  },
  {
    path: 'calendar/new',
    component: TrainingSessionFormPageComponent,
  },
  {
    path: 'calendar/edit/:id',
    component: TrainingSessionFormPageComponent,
  },
  {
    path: 'profile',
    component: ProfileSettingsPageComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
