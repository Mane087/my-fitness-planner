import { Routes } from '@angular/router';

import { HomePageComponent } from './pages/home/home.component';

// The home page is the entry point; the other pages load on demand to keep the initial bundle small.
export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    title: 'MyFitnessPlanner',
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./pages/calendar/calendar-page.component').then(
        (module) => module.CalendarPageComponent,
      ),
    title: 'Calendario · MyFitnessPlanner',
  },
  {
    path: 'calendar/new',
    loadComponent: () =>
      import('./pages/training-session-form-page/training-session-form-page.component').then(
        (module) => module.TrainingSessionFormPageComponent,
      ),
    title: 'Nuevo entrenamiento · MyFitnessPlanner',
  },
  {
    path: 'calendar/edit/:id',
    loadComponent: () =>
      import('./pages/training-session-form-page/training-session-form-page.component').then(
        (module) => module.TrainingSessionFormPageComponent,
      ),
    title: 'Editar entrenamiento · MyFitnessPlanner',
  },
  {
    path: 'library',
    loadComponent: () =>
      import('./pages/library/library-page.component').then(
        (module) => module.LibraryPageComponent,
      ),
    title: 'Biblioteca · MyFitnessPlanner',
  },
  {
    path: 'library/new',
    loadComponent: () =>
      import('./pages/training-session-form-page/training-session-form-page.component').then(
        (module) => module.TrainingSessionFormPageComponent,
      ),
    data: { kind: 'template' },
    title: 'Nueva plantilla · MyFitnessPlanner',
  },
  {
    path: 'library/edit/:id',
    loadComponent: () =>
      import('./pages/training-session-form-page/training-session-form-page.component').then(
        (module) => module.TrainingSessionFormPageComponent,
      ),
    data: { kind: 'template' },
    title: 'Editar plantilla · MyFitnessPlanner',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile-settings-page/profile-settings-page.component').then(
        (module) => module.ProfileSettingsPageComponent,
      ),
    title: 'Perfil · MyFitnessPlanner',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
