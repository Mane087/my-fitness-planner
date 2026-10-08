import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { UiProgressComponent } from '../../components/ui/ui-progress/ui-progress.component';
import type { WeekHeaderSummaryViewModel } from '../../core/models/calendar-view-models';

/** Static class names so Tailwind detects them. */
const ZONE_BAR_CLASSES: Record<number, string> = {
  1: 'bg-zone-z1',
  2: 'bg-zone-z2',
  3: 'bg-zone-z3',
  4: 'bg-zone-z4',
  5: 'bg-zone-z5',
  6: 'bg-zone-z6',
  7: 'bg-zone-z7',
};

/**
 * Planned against completed totals of the week and the planned time per zone. Phones show the
 * duration in the page subtitle instead.
 */
@Component({
  selector: 'app-week-summary',
  imports: [UiProgressComponent],
  templateUrl: './week-summary.component.html',
  host: {
    class:
      'hidden flex-col gap-4 rounded-xl bg-bg-surface p-4 shadow-elevation-1 sm:flex sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-10 sm:px-6',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekSummaryComponent {
  readonly summary = input.required<WeekHeaderSummaryViewModel>();

  protected readonly zoneBars = computed(() =>
    this.summary().zones.map((share) => ({
      ...share,
      label: `Z${share.zone}`,
      barClass: ZONE_BAR_CLASSES[share.zone],
    })),
  );
}
