import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-calendar',
  standalone: true,
  template: `
    <main class="calendar-placeholder">
      <h1>Calendar coming soon</h1>
      <p>Your training calendar and planner will be available here soon.</p>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #0f172a;
      color: #f8fafc;
    }

    .calendar-placeholder {
      display: grid;
      min-height: 100vh;
      place-content: center;
      gap: 1rem;
      padding: 2rem;
      text-align: center;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 5vw, 4rem);
    }

    p {
      margin: 0;
      color: #cbd5e1;
      font-size: 1.125rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPageComponent {}
