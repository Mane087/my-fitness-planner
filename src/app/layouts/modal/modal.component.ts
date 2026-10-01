import { Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * Accessible dialog. Escape closes it from the keyboard; a press and release on the backdrop
 * closes it with the pointer. Pointer events are handled on the host because the backdrop is
 * not an interactive control: its keyboard equivalent is Escape.
 */
@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(pointerdown)': 'onPointerDown($event)',
    '(click)': 'onClick($event)',
  },
})
export class ModalComponent {
  showModal = input<boolean>(false);
  /** Id of the element that names the dialog (usually its heading). */
  labelledBy = input<string | null>(null);
  /**
   * The user asked to close the dialog with Escape or a click outside it. The parent decides
   * whether to close, e.g. it ignores the request while an action is running.
   */
  readonly dismissed = output<void>();

  private readonly backdrop = viewChild<ElementRef<HTMLElement>>('backdrop');
  /**
   * A click that starts inside the dialog and ends on the backdrop (e.g. selecting text) is
   * reported on the backdrop, so the press must also start there.
   */
  private isPressOnBackdrop = false;

  onEscape(): void {
    if (this.showModal()) this.dismissed.emit();
  }

  onPointerDown(event: Event): void {
    this.isPressOnBackdrop = this.isBackdrop(event.target);
  }

  onClick(event: Event): void {
    if (this.isPressOnBackdrop && this.isBackdrop(event.target)) this.dismissed.emit();
    this.isPressOnBackdrop = false;
  }

  private isBackdrop(target: EventTarget | null): boolean {
    const backdrop = this.backdrop()?.nativeElement;
    return backdrop !== undefined && target === backdrop;
  }
}
