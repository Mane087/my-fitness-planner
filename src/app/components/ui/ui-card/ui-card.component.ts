import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiCardSize = 'sm' | 'md';
export type UiCardElevation = 0 | 1 | 2 | 3 | 4;

const SIZE_CLASSES: Record<UiCardSize, string> = {
  sm: 'rounded-lg p-2.5',
  md: 'rounded-xl p-6',
};

const ELEVATION_CLASSES: Record<UiCardElevation, string> = {
  0: '',
  1: 'shadow-elevation-1',
  2: 'shadow-elevation-2',
  3: 'shadow-elevation-3',
  4: 'shadow-elevation-4',
};

/** Surface container. `md` is a section card (24 px padding); `sm` is a compact item card. */
@Component({
  selector: 'app-ui-card',
  template: '<ng-content />',
  host: { '[class]': 'classes()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiCardComponent {
  readonly size = input<UiCardSize>('md');
  readonly elevation = input<UiCardElevation>(1);

  protected readonly classes = computed(
    () =>
      `block bg-bg-surface text-text-primary ${SIZE_CLASSES[this.size()]} ${ELEVATION_CLASSES[this.elevation()]}`,
  );
}
