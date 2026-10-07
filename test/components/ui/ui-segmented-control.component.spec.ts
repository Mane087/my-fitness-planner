import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiSegmentedControlComponent } from '../../../src/app/components/ui/ui-segmented-control/ui-segmented-control.component';

@Component({
  imports: [ReactiveFormsModule, UiSegmentedControlComponent],
  template: `
    <app-ui-segmented-control
      ariaLabel="Workout type"
      [options]="options"
      [formControl]="control"
    />
  `,
})
class UiSegmentedControlHostComponent {
  readonly options = [
    { value: 'easy', label: 'Easy' },
    { value: 'tempo', label: 'Tempo' },
    { value: 'hard', label: 'Hard' },
  ];
  readonly control = new FormControl('easy');
}

describe('UiSegmentedControlComponent', () => {
  let fixture: ComponentFixture<UiSegmentedControlHostComponent>;
  let host: UiSegmentedControlHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiSegmentedControlHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  function radios(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  }

  it('renders an accessible radio group with one radio per option', () => {
    expect(element.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Workout type',
    );
    expect(radios()).toHaveLength(3);
    expect(radios()[0].getAttribute('aria-checked')).toBe('true');
  });

  it('updates its FormControl when a radio is clicked', () => {
    radios()[1].click();
    fixture.detectChanges();

    expect(host.control.value).toBe('tempo');
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
  });

  it('moves selection right and wraps around', () => {
    radios()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(host.control.value).toBe('easy');
    expect(document.activeElement).toBe(radios()[0]);
  });

  it('moves selection left and wraps around', () => {
    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(host.control.value).toBe('hard');
    expect(document.activeElement).toBe(radios()[2]);
  });

  it('keeps only the selected radio in the tab order', () => {
    host.control.setValue('tempo');
    fixture.detectChanges();

    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
  });
});
