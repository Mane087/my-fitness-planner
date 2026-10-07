import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink, type UrlTree } from '@angular/router';

import type { IconName } from '../ui-icon/icon-registry';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

export type UiButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
export type UiButtonSize = 'sm' | 'md' | 'lg';
type UiButtonKind = 'action' | 'link';
type HtmlButtonType = 'button' | 'submit' | 'reset';
type RouterLinkValue = string | readonly unknown[] | UrlTree | null | undefined;

const BASE_CLASSES =
  'inline-flex items-center justify-center font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-muted';

const VARIANT_CLASSES: Record<UiButtonVariant, string> = {
  primary: 'bg-accent-default text-text-on-accent shadow-elevation-1 hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-subtle',
  tertiary: 'text-text-accent hover:bg-accent-subtle',
  ghost: 'text-text-secondary hover:bg-bg-subtle',
  // Destructive actions are only offered inside confirmations.
  danger: 'bg-status-danger text-text-on-accent hover:opacity-90',
};

const DISABLED_CLASSES = 'bg-bg-subtle text-text-tertiary cursor-not-allowed shadow-none';

/** Padding for text buttons; icon-only buttons are square. */
const SIZE_CLASSES: Record<UiButtonSize, string> = {
  sm: 'gap-1.5 rounded-lg px-2.5 py-1.5 text-label',
  md: 'gap-1.5 rounded-lg px-3.5 py-2 text-body',
  lg: 'gap-2 rounded-lg px-5 py-3 text-h3',
};

const ICON_ONLY_SIZE_CLASSES: Record<UiButtonSize, string> = {
  sm: 'rounded-lg p-1.5',
  md: 'rounded-lg p-2',
  lg: 'rounded-lg p-3',
};

const ICON_SIZES: Record<UiButtonSize, number> = { sm: 14, md: 16, lg: 20 };

/**
 * Button of the design system. The label is the projected content; an icon-only button has no
 * content and needs `ariaLabel`. While `isLoading` the button is disabled and shows a spinner.
 */
@Component({
  selector: 'app-ui-button',
  imports: [NgTemplateOutlet, RouterLink, UiIconComponent],
  templateUrl: './ui-button.component.html',
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiButtonComponent {
  readonly variant = input<UiButtonVariant>('primary');
  readonly size = input<UiButtonSize>('md');
  readonly kind = input<UiButtonKind>('action');
  readonly link = input<RouterLinkValue>(null);
  readonly htmlType = input<HtmlButtonType>('button');
  readonly icon = input<IconName | null>(null);
  readonly isIconOnly = input(false);
  /** Accessible name; required for icon-only buttons. */
  readonly ariaLabel = input<string | null>(null);
  readonly title = input<string | null>(null);
  readonly isDisabled = input(false);
  readonly isLoading = input(false);

  readonly pressed = output<void>();

  protected readonly isInactive = computed(() => this.isDisabled() || this.isLoading());
  protected readonly iconSize = computed(() => ICON_SIZES[this.size()]);
  protected readonly visibleIcon = computed<IconName | null>(() =>
    this.isLoading() ? 'loader-circle' : this.icon(),
  );
  protected readonly classes = computed(() =>
    [
      BASE_CLASSES,
      this.isIconOnly() ? ICON_ONLY_SIZE_CLASSES[this.size()] : SIZE_CLASSES[this.size()],
      this.isInactive() ? DISABLED_CLASSES : VARIANT_CLASSES[this.variant()],
    ].join(' '),
  );

  protected onClick(): void {
    this.pressed.emit();
  }
}
