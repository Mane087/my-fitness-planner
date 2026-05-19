import { NgClass } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink, UrlTree } from '@angular/router';

type ButtonVariant = 'primary' | 'secondary';
type ButtonKind = 'action' | 'link';
type HtmlButtonType = 'button' | 'submit' | 'reset';
type RouterLinkValue = string | unknown[] | UrlTree | null | undefined;

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [NgClass, RouterLink],
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  label = input.required<string>();
  title = input.required<string>();

  disabled = input<boolean>();

  variant = input<ButtonVariant>('primary');
  kind = input<ButtonKind>('action');

  link = input<RouterLinkValue>(null);

  htmlType = input<HtmlButtonType>('button');

  pressed = output<void>();

  onClick(): void {
    this.pressed.emit();
  }

  get classes(): string {
    const baseClasses =
      'inline-flex min-h-11 items-center justify-center rounded-full px-7 py-3 text-base font-semibold text-secondary transition focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer';

    const variantClasses =
      this.variant() === 'primary'
        ? 'bg-primary hover:bg-primary-hover focus-visible:ring-primary-hover shadow-lg shadow-cyan-950/30'
        : 'border border-white/30 transition hover:bg-white/10 focus-visible:ring-white/30';

    return `${baseClasses} ${variantClasses}`;
  }
}
