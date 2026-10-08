import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { UiIconComponent } from '../../components/ui/ui-icon/ui-icon.component';
import { WorkoutProfileComponent } from '../../components/workout-profile/workout-profile.component';
import { WorkoutStatus } from '../../core/domain/workout.enums';
import type { CalendarWorkoutCardViewModel } from '../../core/models/calendar-view-models';
import { SPORT_ICONS } from './workout-icons';

/**
 * Workout card of the week view. The status sets its style: completed has a green left border
 * and a check, skipped is dimmed. Clicking it opens the workout detail. The `day` layout is the
 * larger card of the phone day list.
 */
@Component({
  selector: 'app-workout-card',
  imports: [UiIconComponent, WorkoutProfileComponent],
  templateUrl: './workout-card.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutCardComponent {
  readonly workout = input.required<CalendarWorkoutCardViewModel>();
  readonly layout = input<'column' | 'day'>('column');
  readonly isDragging = input(false);
  readonly opened = output<string>();

  protected readonly sportIcon = computed(() => SPORT_ICONS[this.workout().sport]);
  protected readonly isCompleted = computed(
    () => this.workout().status === WorkoutStatus.Completed,
  );
  protected readonly isSkipped = computed(() => this.workout().status === WorkoutStatus.Skipped);
  protected readonly classes = computed(() => {
    const spacing = this.layout() === 'day' ? 'gap-2.5 p-4' : 'gap-1.5 p-2.5';
    const status = this.isCompleted()
      ? 'border-l-4 border-l-status-success'
      : 'border-l-4 border-l-transparent';
    const state = this.isSkipped() ? 'opacity-60' : '';
    const drag = this.isDragging() ? 'border-dashed border-border-strong opacity-40' : '';

    return [
      'flex w-full flex-col rounded-lg bg-bg-surface text-left shadow-elevation-1 transition-shadow',
      'cursor-pointer hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-muted',
      spacing,
      status,
      state,
      drag,
    ].join(' ');
  });
  protected readonly profileClass = computed(() =>
    this.layout() === 'day' ? 'h-11 w-full' : 'h-7 w-full',
  );
}
