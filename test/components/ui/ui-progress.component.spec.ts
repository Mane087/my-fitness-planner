import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiProgressComponent } from '../../../src/app/components/ui/ui-progress/ui-progress.component';

@Component({
  imports: [UiProgressComponent],
  template: '<app-ui-progress [value]="value()" ariaLabel="Completion" [tone]="tone()" />',
})
class UiProgressHostComponent {
  readonly value = signal(45);
  readonly tone = signal<'accent' | 'success'>('accent');
}

describe('UiProgressComponent', () => {
  let fixture: ComponentFixture<UiProgressHostComponent>;
  let host: UiProgressHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiProgressHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  function progress(): HTMLElement {
    return element.querySelector('[role="progressbar"]') as HTMLElement;
  }

  it('renders an accessible progress value and percentage width', () => {
    expect(progress().getAttribute('aria-valuenow')).toBe('45');
    expect(progress().firstElementChild?.getAttribute('style')).toContain('width: 45%');
  });

  it('clamps values below zero and above one hundred', () => {
    host.value.set(-5);
    fixture.detectChanges();
    expect(progress().getAttribute('aria-valuenow')).toBe('0');

    host.value.set(101);
    fixture.detectChanges();
    expect(progress().getAttribute('aria-valuenow')).toBe('100');
  });

  it('converts NaN to zero', () => {
    host.value.set(Number.NaN);
    fixture.detectChanges();

    expect(progress().getAttribute('aria-valuenow')).toBe('0');
  });

  it('applies the success tone to the fill', () => {
    host.tone.set('success');
    fixture.detectChanges();

    expect(progress().firstElementChild?.classList).toContain('bg-status-success');
  });
});
