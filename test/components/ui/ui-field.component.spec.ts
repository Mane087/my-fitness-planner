import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiFieldComponent } from '../../../src/app/components/ui/ui-field/ui-field.component';

@Component({
  imports: [ReactiveFormsModule, UiFieldComponent],
  template: `
    <app-ui-field
      label="Pace"
      inputId="pace"
      [formControl]="control"
      [errorMessage]="errorMessage()"
      [suffix]="suffix()"
    />
  `,
})
class UiFieldHostComponent {
  readonly control = new FormControl('5:00');
  readonly errorMessage = signal<string | null>(null);
  readonly suffix = signal<string | null>(null);
}

describe('UiFieldComponent', () => {
  let fixture: ComponentFixture<UiFieldHostComponent>;
  let host: UiFieldHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiFieldHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('associates its label with the input', () => {
    expect(element.querySelector('label')?.htmlFor).toBe('pace');
    expect(element.querySelector('input')?.id).toBe('pace');
  });

  it('writes and reports values through its FormControl', () => {
    const input = element.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('5:00');

    input.value = '4:45';
    input.dispatchEvent(new Event('input'));
    expect(host.control.value).toBe('4:45');

    host.control.setValue('4:30');
    fixture.detectChanges();
    expect(input.value).toBe('4:30');
  });

  it('reflects the FormControl disabled state', () => {
    host.control.disable();
    fixture.detectChanges();

    expect((element.querySelector('input') as HTMLInputElement).disabled).toBe(true);
  });

  it('renders an accessible error message', () => {
    host.errorMessage.set('Required');
    fixture.detectChanges();

    const input = element.querySelector('input') as HTMLInputElement;
    const error = element.querySelector('#pace-error') as HTMLElement;
    expect(error.textContent?.trim()).toBe('Required');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('renders a suffix and no error markup when there is no error', () => {
    host.suffix.set('min/km');
    fixture.detectChanges();

    expect(element.textContent).toContain('min/km');
    expect(element.querySelector('#pace-error')).toBeNull();
  });
});
