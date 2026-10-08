import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UiButtonComponent } from '../../../src/app/components/ui/ui-button/ui-button.component';

@Component({
  imports: [UiButtonComponent],
  template: `
    <app-ui-button
      [htmlType]="htmlType"
      [isDisabled]="isDisabled()"
      [isLoading]="isLoading()"
      [isIconOnly]="isIconOnly()"
      [ariaLabel]="ariaLabel()"
      [variant]="variant()"
      [kind]="kind()"
      [link]="link"
      icon="calendar"
      (pressed)="presses = presses + 1"
    >
      Save
    </app-ui-button>
  `,
})
class UiButtonHostComponent {
  htmlType: 'button' | 'submit' | 'reset' = 'submit';
  readonly isDisabled = signal(false);
  readonly isLoading = signal(false);
  readonly isIconOnly = signal(false);
  readonly ariaLabel = signal<string | null>(null);
  readonly variant = signal<'primary' | 'danger'>('primary');
  readonly kind = signal<'action' | 'link'>('action');
  link = '/plans';
  presses = 0;
}

describe('UiButtonComponent', () => {
  let fixture: ComponentFixture<UiButtonHostComponent>;
  let host: UiButtonHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(UiButtonHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders an action button with the requested HTML type and emits when clicked', () => {
    const button = element.querySelector('button') as HTMLButtonElement;

    expect(button.type).toBe('submit');
    button.click();
    expect(host.presses).toBe(1);
  });

  it('does not emit while disabled', () => {
    host.isDisabled.set(true);
    fixture.detectChanges();

    (element.querySelector('button') as HTMLButtonElement).click();

    expect(element.querySelector('button')?.disabled).toBe(true);
    expect(host.presses).toBe(0);
  });

  it('shows a busy spinner and prevents clicks while loading', () => {
    host.isLoading.set(true);
    fixture.detectChanges();

    const button = element.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('app-ui-icon svg path')?.getAttribute('d')).toBe(
      'M21 12a9 9 0 1 1-6.219-8.56',
    );
    button.click();
    expect(host.presses).toBe(0);
  });

  it('renders a router link when its kind is link', () => {
    host.kind.set('link');
    fixture.detectChanges();

    expect(element.querySelector('a')?.getAttribute('href')).toBe('/plans');
    expect(element.querySelector('button')).toBeNull();
  });

  it('uses ariaLabel and hides projected text for icon-only buttons', () => {
    host.isIconOnly.set(true);
    host.ariaLabel.set('Open calendar');
    fixture.detectChanges();

    const button = element.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Open calendar');
    expect(button.textContent?.trim()).toBe('');
  });

  it('applies distinct primary and danger variant classes', () => {
    const button = element.querySelector('button') as HTMLButtonElement;
    expect(button.classList).toContain('bg-accent-default');

    host.variant.set('danger');
    fixture.detectChanges();

    expect(button.classList).toContain('bg-status-danger');
  });
});
