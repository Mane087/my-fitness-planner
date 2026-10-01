import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ModalComponent } from '../../src/app/layouts/modal/modal.component';

@Component({
  imports: [ModalComponent],
  template: `
    <app-modal
      [showModal]="isOpen()"
      labelledBy="modal-title"
      (dismissed)="dismissals = dismissals + 1"
    >
      <h3 id="modal-title">Título</h3>
      <button type="button">Acción</button>
    </app-modal>
  `,
})
class ModalHostComponent {
  readonly isOpen = signal(true);
  dismissals = 0;
}

describe('ModalComponent', () => {
  let fixture: ComponentFixture<ModalHostComponent>;
  let host: ModalHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  function pressEscape(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }

  it('muestra el diálogo con su título accesible', () => {
    const dialog = element.querySelector('[role="dialog"]');

    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('modal-title');
  });

  it('solicita cerrar con Escape', () => {
    pressEscape();

    expect(host.dismissals).toBe(1);
  });

  function backdrop(): HTMLElement {
    return element.querySelector('[data-testid="modal-backdrop"]') as HTMLElement;
  }

  function pressAndRelease(start: HTMLElement): void {
    start.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    backdrop().click();
  }

  it('solicita cerrar al hacer clic fuera del diálogo, no dentro', () => {
    (element.querySelector('[data-testid="modal-surface"] button') as HTMLButtonElement).click();
    expect(host.dismissals).toBe(0);

    pressAndRelease(backdrop());
    expect(host.dismissals).toBe(1);
  });

  it('no cierra cuando el clic empieza dentro del diálogo y termina fuera', () => {
    pressAndRelease(element.querySelector('[data-testid="modal-surface"]') as HTMLElement);

    expect(host.dismissals).toBe(0);
  });

  it('ignora Escape cuando el diálogo está cerrado', () => {
    host.isOpen.set(false);
    fixture.detectChanges();

    pressEscape();

    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(host.dismissals).toBe(0);
  });
});
