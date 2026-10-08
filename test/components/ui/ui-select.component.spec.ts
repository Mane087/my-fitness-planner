import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiSelectComponent } from '../../../src/app/components/ui/ui-select/ui-select.component';

@Component({
  imports: [ReactiveFormsModule, UiSelectComponent],
  template: `
    <app-ui-select
      label="Sport"
      selectId="sport"
      placeholder="Choose a sport"
      [options]="options"
      [formControl]="control"
      [errorMessage]="errorMessage()"
    />
  `,
})
class UiSelectHostComponent {
  readonly control = new FormControl('run');
  readonly options = [
    { value: 'run', label: 'Run' },
    { value: 'bike', label: 'Bike' },
  ];
  readonly errorMessage = signal<string | null>(null);
}

describe('UiSelectComponent', () => {
  let fixture: ComponentFixture<UiSelectHostComponent>;
  let host: UiSelectHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiSelectHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('associates the label and renders the placeholder and options', () => {
    expect(element.querySelector('label')?.htmlFor).toBe('sport');
    expect(element.querySelectorAll('option')).toHaveLength(3);
    expect(element.querySelector('option')?.textContent?.trim()).toBe('Choose a sport');
  });

  it('writes and reports values through its FormControl', () => {
    const select = element.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('run');

    select.value = 'bike';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.control.value).toBe('bike');

    host.control.setValue('run');
    fixture.detectChanges();
    expect(select.value).toBe('run');
  });

  it('renders accessible error state', () => {
    host.errorMessage.set('Select a sport');
    fixture.detectChanges();

    const select = element.querySelector('select') as HTMLSelectElement;
    const error = element.querySelector('#sport-error') as HTMLElement;
    expect(error.textContent?.trim()).toBe('Select a sport');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe(error.id);
  });
});
