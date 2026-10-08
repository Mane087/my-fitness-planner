import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import type { IconName } from '../ui-icon/icon-registry';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

/** Toggle chip used to filter lists. The selected state is announced with `aria-pressed`. */
@Component({
  selector: 'app-ui-chip',
  imports: [UiIconComponent],
  templateUrl: './ui-chip.component.html',
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiChipComponent {
  readonly icon = input<IconName | null>(null);
  readonly isSelected = model(false);

  protected toggle(): void {
    this.isSelected.update((isSelected) => !isSelected);
  }
}
