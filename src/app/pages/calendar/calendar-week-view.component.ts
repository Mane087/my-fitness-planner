import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';

import type {
  CalendarWeekViewModel,
  CalendarWorkoutCardViewModel,
  WorkoutRelocation,
} from '../../core/models/calendar-view-models';
import { WorkoutCardComponent } from './workout-card.component';

/**
 * Seven day columns with their workouts and daily totals. A workout dropped on another day is
 * moved, or copied when Ctrl or Alt is held on drop. Touch and keyboard users move and copy
 * from the workout detail, because native drag & drop only works with a mouse.
 */
@Component({
  selector: 'app-calendar-week-view',
  imports: [NgClass, WorkoutCardComponent],
  templateUrl: './calendar-week-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarWeekViewComponent {
  readonly week = input.required<CalendarWeekViewModel>();

  readonly opened = output<string>();
  readonly createRequested = output<string>();
  readonly relocated = output<WorkoutRelocation>();

  readonly draggedWorkout = signal<CalendarWorkoutCardViewModel | null>(null);
  readonly dropTargetDate = signal<string | null>(null);

  onDragStart(event: DragEvent, workout: CalendarWorkoutCardViewModel): void {
    this.draggedWorkout.set(workout);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
      // Firefox only starts the drag when the data transfer has data.
      event.dataTransfer.setData('text/plain', workout.id);
    }
  }

  onDragOver(event: DragEvent, date: string): void {
    if (!this.draggedWorkout()) return;

    // Cancelling dragover is what allows the drop on this day.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = isCopy(event) ? 'copy' : 'move';
    this.dropTargetDate.set(date);
  }

  onDrop(event: DragEvent, date: string): void {
    const workout = this.draggedWorkout();
    this.endDrag();
    if (!workout) return;

    event.preventDefault();
    const mode = isCopy(event) ? 'copy' : 'move';
    if (mode === 'move' && workout.scheduledDate === date) return;

    this.relocated.emit({ workout, targetDate: date, mode });
  }

  endDrag(): void {
    this.draggedWorkout.set(null);
    this.dropTargetDate.set(null);
  }
}

/** Ctrl (Windows, Linux) or Alt/Option (macOS) held while dragging copies instead of moving. */
function isCopy(event: DragEvent): boolean {
  return event.ctrlKey || event.altKey;
}
