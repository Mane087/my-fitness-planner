import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiIconComponent } from '../../../src/app/components/ui/ui-icon/ui-icon.component';

@Component({
  imports: [UiIconComponent],
  template: '<app-ui-icon name="calendar" [size]="24" />',
})
class UiIconHostComponent {}

describe('UiIconComponent', () => {
  let fixture: ComponentFixture<UiIconHostComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiIconHostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders the requested dimensions as a decorative icon', () => {
    const icon = element.querySelector('app-ui-icon') as HTMLElement;
    const svg = icon.querySelector('svg');

    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders one DOM shape for every calendar registry shape', () => {
    const svg = element.querySelector('svg') as SVGElement;

    expect(svg.querySelectorAll('path, rect, circle')).toHaveLength(4);
    expect(svg.querySelectorAll('path')).toHaveLength(3);
    expect(svg.querySelectorAll('rect')).toHaveLength(1);
  });
});
