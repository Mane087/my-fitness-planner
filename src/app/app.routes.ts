import { Routes } from '@angular/router';

import { CalendarPageComponent } from './pages/calendar/calendar-page.component';
import { ComingSoonPageComponent } from './pages/coming-soon/coming-soon-page.component';
import { HomePageComponent } from './pages/home/home.component';
import { ProfileSettingsPageComponent } from './pages/profile-settings-page/profile-settings-page.component';
import { TrainingSessionFormPageComponent } from './pages/training-session-form-page/training-session-form-page.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    title: 'MyFitnessPlanner',
  },
  {
    path: 'calendar',
    component: CalendarPageComponent,
    title: 'Calendario · MyFitnessPlanner',
  },
  {
    path: 'calendar/new',
    component: TrainingSessionFormPageComponent,
    title: 'Nuevo entrenamiento · MyFitnessPlanner',
  },
  {
    path: 'calendar/edit/:id',
    component: TrainingSessionFormPageComponent,
    title: 'Editar entrenamiento · MyFitnessPlanner',
  },
  {
    path: 'library',
    component: ComingSoonPageComponent,
    data: { title: 'Biblioteca de entrenamientos' },
    title: 'Biblioteca · MyFitnessPlanner',
  },
  {
    path: 'profile',
    component: ProfileSettingsPageComponent,
    title: 'Perfil · MyFitnessPlanner',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
