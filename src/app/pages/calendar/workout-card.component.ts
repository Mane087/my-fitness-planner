import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';

import type { CalendarWorkoutCardViewModel } from '../../core/models/calendar-view-models';

/** Workout card of the month and week views. Clicking it opens the workout detail. */
@Component({
  selector: 'app-workout-card',
  imports: [NgClass],
  templateUrl: './workout-card.component.html',
  styleUrl: './workout-card.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutCardComponent {
  readonly workout = input.required<CalendarWorkoutCardViewModel>();
  readonly opened = output<string>();
}
