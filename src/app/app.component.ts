import { Component } from '@angular/core';

import { AppShellComponent } from './layouts/app-shell/app-shell.component';

@Component({
  selector: 'app-root',
  imports: [AppShellComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'my-fitness-planner';
}
