import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { UiIconComponent } from '../../components/ui/ui-icon/ui-icon.component';
import { WorkoutStatus } from '../../core/domain/workout.enums';
import type { CalendarWorkoutCardViewModel } from '../../core/models/calendar-view-models';
import { SPORT_ICONS } from './workout-icons';

/** Compact workout of the month grid: sport icon, title and planned time. */
@Component({
  selector: 'app-month-workout-chip',
  imports: [UiIconComponent],
  templateUrl: './month-workout-chip.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthWorkoutChipComponent {
  readonly workout = input.required<CalendarWorkoutCardViewModel>();
  readonly opened = output<string>();

  protected readonly sportIcon = computed(() => SPORT_ICONS[this.workout().sport]);
  protected readonly classes = computed(() => {
    const status = this.workout().status;
    const tone =
      status === WorkoutStatus.Completed
        ? 'bg-status-success-subtle'
        : 'border border-border-default bg-bg-surface';

    return [
      'text-label flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-text-primary',
      'cursor-pointer hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-muted',
      tone,
      status === WorkoutStatus.Skipped ? 'opacity-50' : '',
    ].join(' ');
  });
}
