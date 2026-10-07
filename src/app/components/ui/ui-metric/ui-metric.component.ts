import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiMetricSize = 'm' | 'l' | 'xl';

const VALUE_CLASSES: Record<UiMetricSize, string> = {
  m: 'text-metric-m',
  l: 'text-metric-l',
  xl: 'text-metric-xl',
};

/** Value in Barlow Condensed with an optional unit and an uppercase label below. */
@Component({
  selector: 'app-ui-metric',
  templateUrl: './ui-metric.component.html',
  host: { class: 'flex flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiMetricComponent {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly unit = input<string | null>(null);
  readonly size = input<UiMetricSize>('m');

  protected readonly valueClass = computed(() => VALUE_CLASSES[this.size()]);
}
