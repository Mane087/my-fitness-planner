import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { UiIconComponent } from '../../components/ui/ui-icon/ui-icon.component';
import type {
  CalendarWeekDayViewModel,
  CalendarWeekViewModel,
  CalendarWorkoutCardViewModel,
  WorkoutRelocation,
} from '../../core/models/calendar-view-models';
import { injectMediaQuery } from '../../core/services/media-query';
import { WorkoutCardComponent } from './workout-card.component';

/** Static class names so Tailwind detects them. */
const ZONE_DOT_CLASSES: Record<number, string> = {
  1: 'bg-zone-z1',
  2: 'bg-zone-z2',
  3: 'bg-zone-z3',
  4: 'bg-zone-z4',
  5: 'bg-zone-z5',
  6: 'bg-zone-z6',
  7: 'bg-zone-z7',
};

/**
 * Seven day columns with their workouts and daily totals on wide screens, and a week strip with
 * the list of the selected day on phones. A workout dropped on another day is moved, or copied
 * when Ctrl or Alt is held on drop. Touch and keyboard users move and copy from the workout
 * detail, because native drag & drop only works with a mouse.
 */
@Component({
  selector: 'app-calendar-week-view',
  imports: [UiIconComponent, WorkoutCardComponent],
  templateUrl: './calendar-week-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarWeekViewComponent {
  readonly week = input.required<CalendarWeekViewModel>();

  readonly opened = output<string>();
  readonly createRequested = output<string>();
  readonly relocated = output<WorkoutRelocation>();

  /** Columns need about 130 px each; below this width the week is a strip with a day list. */
  protected readonly isWide = injectMediaQuery('(min-width: 1024px)', true);
  private readonly pickedDate = signal<string | null>(null);
  /** Day shown by the phone layout: the picked one, otherwise today, otherwise the first. */
  protected readonly selectedDay = computed<CalendarWeekDayViewModel>(() => {
    const { days } = this.week();
    return (
      days.find((day) => day.date === this.pickedDate()) ??
      days.find((day) => day.isToday) ??
      days[0]
    );
  });

  readonly draggedWorkout = signal<CalendarWorkoutCardViewModel | null>(null);
  readonly dropTargetDate = signal<string | null>(null);

  protected selectDay(date: string): void {
    this.pickedDate.set(date);
  }

  protected dotClass(zone: number | null): string {
    return zone === null ? 'bg-text-tertiary' : ZONE_DOT_CLASSES[zone];
  }

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
