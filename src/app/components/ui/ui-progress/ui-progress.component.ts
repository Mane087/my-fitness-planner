import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiProgressTone = 'accent' | 'success';

/** Horizontal progress bar. The percentage is clamped to 0–100. */
@Component({
  selector: 'app-ui-progress',
  templateUrl: './ui-progress.component.html',
  host: {
    class: 'block h-1.5 w-full overflow-hidden rounded-full bg-border-strong',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'percent()',
    '[attr.aria-label]': 'ariaLabel()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiProgressComponent {
  /** Completed fraction as a percentage; values outside 0–100 are clamped. */
  readonly value = input.required<number>();
  readonly ariaLabel = input.required<string>();
  readonly tone = input<UiProgressTone>('accent');

  protected readonly percent = computed(() => {
    const value = this.value();
    return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : 0;
  });
  protected readonly fillClass = computed(() =>
    this.tone() === 'success' ? 'bg-status-success' : 'bg-accent-default',
  );
}
