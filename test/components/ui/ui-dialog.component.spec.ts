import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiDialogComponent } from '../../../src/app/components/ui/ui-dialog/ui-dialog.component';

@Component({
  imports: [UiDialogComponent],
  template: `
    <app-ui-dialog
      [isOpen]="isOpen()"
      title="Delete workout"
      (dismissed)="dismissals = dismissals + 1"
    >
      <button type="button">Content action</button>
      <div dialogFooter><button type="button">Confirm</button></div>
    </app-ui-dialog>
  `,
})
class UiDialogHostComponent {
  readonly isOpen = signal(false);
  dismissals = 0;
}

describe('UiDialogComponent', () => {
  let fixture: ComponentFixture<UiDialogHostComponent>;
  let host: UiDialogHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiDialogHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  function openDialog(): void {
    host.isOpen.set(true);
    fixture.detectChanges();
  }

  function surface(): HTMLElement {
    return element.querySelector('[data-testid="dialog-surface"]') as HTMLElement;
  }

  function backdrop(): HTMLElement {
    return element.querySelector('[data-testid="dialog-backdrop"]') as HTMLElement;
  }

  function dismissWithBackdrop(start: HTMLElement): void {
    start.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    backdrop().dispatchEvent(new Event('click', { bubbles: true }));
  }

  it('renders nothing while closed', () => {
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders an accessible modal dialog when open', () => {
    openDialog();

    const dialog = surface();
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(titleId).not.toBeNull();
    expect(element.querySelector(`#${titleId}`)?.textContent?.trim()).toBe('Delete workout');
  });

  it('emits dismissed with Escape only while open', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.dismissals).toBe(0);

    openDialog();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.dismissals).toBe(1);
  });

  it('emits dismissed when the close button is clicked', () => {
    openDialog();

    (element.querySelector('[aria-label="Cerrar"]') as HTMLButtonElement).click();

    expect(host.dismissals).toBe(1);
  });

  it('dismisses only when the pointer press and click both occur on the backdrop', () => {
    openDialog();
    dismissWithBackdrop(backdrop());
    expect(host.dismissals).toBe(1);

    dismissWithBackdrop(surface());
    expect(host.dismissals).toBe(1);
  });

  it('projects the dialog footer content', () => {
    openDialog();

    expect(element.querySelector('footer')?.textContent?.trim()).toBe('Confirm');
  });

  it('wraps Tab navigation between the first and last focusable elements', () => {
    openDialog();
    const focusable = surface().querySelectorAll<HTMLButtonElement>('button');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(last);
  });
});
