import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { UiButtonComponent } from '../ui-button/ui-button.component';

let nextDialogId = 0;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog shell with title, close button, content and an optional footer
 * (`<div dialogFooter>`). Escape or a press and release on the backdrop request to close it:
 * the parent decides whether to close (e.g. it ignores the request while an action runs).
 * Focus moves into the dialog when it opens, stays inside while it is open, and returns to the
 * previous element when it closes.
 */
@Component({
  selector: 'app-ui-dialog',
  imports: [UiButtonComponent],
  templateUrl: './ui-dialog.component.html',
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(pointerdown)': 'onPointerDown($event)',
    '(click)': 'onClick($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiDialogComponent {
  readonly isOpen = input(false);
  readonly title = input.required<string>();
  readonly dismissed = output<void>();

  protected readonly titleId = `app-ui-dialog-title-${nextDialogId++}`;

  private readonly backdrop = viewChild<ElementRef<HTMLElement>>('backdrop');
  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');
  /** A press that starts inside the dialog and ends on the backdrop must not close it. */
  private isPressOnBackdrop = false;
  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    const document = inject(ElementRef).nativeElement.ownerDocument as Document;

    effect(() => {
      const surface = this.surface()?.nativeElement;

      if (this.isOpen() && surface) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        surface.focus();
      } else if (!this.isOpen()) {
        this.previouslyFocused?.focus();
        this.previouslyFocused = null;
      }
    });
  }

  protected onEscape(): void {
    if (this.isOpen()) {
      this.dismissed.emit();
    }
  }

  protected onPointerDown(event: Event): void {
    this.isPressOnBackdrop = this.isBackdrop(event.target);
  }

  protected onClick(event: Event): void {
    if (this.isPressOnBackdrop && this.isBackdrop(event.target)) {
      this.dismissed.emit();
    }

    this.isPressOnBackdrop = false;
  }

  /** Keeps Tab inside the dialog. */
  protected onKeydown(event: KeyboardEvent): void {
    const surface = this.surface()?.nativeElement;

    if (event.key !== 'Tab' || !surface) {
      return;
    }

    const focusable = Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = surface.ownerDocument.activeElement;

    if (!first || !last) {
      event.preventDefault();
      surface.focus();
    } else if (event.shiftKey && (active === first || active === surface)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private isBackdrop(target: EventTarget | null): boolean {
    const backdrop = this.backdrop()?.nativeElement;
    return backdrop !== undefined && target === backdrop;
  }
}
