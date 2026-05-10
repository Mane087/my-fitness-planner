import { Routes } from '@angular/router';

import { CalendarPageComponent } from './pages/calendar/calendar.component';
import { HomePageComponent } from './pages/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
  },
  {
    path: 'calendar',
    component: CalendarPageComponent,
  },
];
