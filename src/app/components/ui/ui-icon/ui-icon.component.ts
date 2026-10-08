import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ICONS, type IconName, type IconShape } from './icon-registry';

/** Decorative inline icon. It inherits the text color, so tokens such as `text-text-accent` apply. */
@Component({
  selector: 'app-ui-icon',
  templateUrl: './ui-icon.component.html',
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiIconComponent {
  readonly name = input.required<IconName>();
  /** Width and height in px. */
  readonly size = input(16);

  protected readonly shapes = computed<readonly IconShape[]>(() => ICONS[this.name()]);
}
