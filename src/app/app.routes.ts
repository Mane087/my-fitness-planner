import { Routes } from '@angular/router';

import { CalendarPageComponent } from './pages/calendar/calendar-page.component';
import { HomePageComponent } from './pages/home/home.component';
import { ProfileSettingsPageComponent } from './pages/profile-settings-page/profile-settings-page.component';

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
    path: 'profile',
    component: ProfileSettingsPageComponent,
  },
];
