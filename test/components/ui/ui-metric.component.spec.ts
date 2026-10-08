import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiMetricComponent } from '../../../src/app/components/ui/ui-metric/ui-metric.component';

@Component({
  imports: [UiMetricComponent],
  template: '<app-ui-metric value="42" unit="km" label="Distance" size="xl" />',
})
class UiMetricHostComponent {}

describe('UiMetricComponent', () => {
  let fixture: ComponentFixture<UiMetricHostComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiMetricHostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows value, unit, and label', () => {
    const metric = element.querySelector('app-ui-metric') as HTMLElement;

    expect(metric.querySelector('.font-metric')?.textContent?.trim()).toBe('42');
    expect(metric.textContent).toContain('km');
    expect(metric.querySelector('.uppercase')?.textContent?.trim()).toBe('Distance');
  });

  it('applies the selected metric size class', () => {
    expect(element.querySelector('.font-metric')?.classList).toContain('text-metric-xl');
  });
});
