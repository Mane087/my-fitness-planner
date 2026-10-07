import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiTagTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<UiTagTone, string> = {
  neutral: 'bg-bg-subtle text-text-secondary',
  accent: 'bg-accent-subtle text-text-accent',
  success: 'bg-status-success-subtle text-status-success',
  warning: 'bg-status-warning-subtle text-status-warning',
  danger: 'bg-status-danger-subtle text-status-danger',
};

/** Non-interactive label. The meaning must also be in the text, never only in the color. */
@Component({
  selector: 'app-ui-tag',
  template: '<ng-content />',
  host: { '[class]': 'classes()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiTagComponent {
  readonly tone = input<UiTagTone>('neutral');

  protected readonly classes = computed(
    () => `inline-flex items-center rounded-md px-1.5 py-1 text-label ${TONE_CLASSES[this.tone()]}`,
  );
}
