import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiZoneBadgeComponent } from '../../../src/app/components/ui/ui-zone-badge/ui-zone-badge.component';

@Component({
  imports: [UiZoneBadgeComponent],
  template: '<app-ui-zone-badge [zone]="zone()" [rpe]="rpe()" />',
})
class UiZoneBadgeHostComponent {
  readonly zone = signal<number | null>(3);
  readonly rpe = signal<number | null>(null);
}

describe('UiZoneBadgeComponent', () => {
  let fixture: ComponentFixture<UiZoneBadgeHostComponent>;
  let host: UiZoneBadgeHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiZoneBadgeHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows the zone label and dot', () => {
    const badge = element.querySelector('app-ui-zone-badge') as HTMLElement;

    expect(badge.textContent?.trim()).toBe('Z3');
    expect(badge.querySelector('[aria-hidden="true"]')?.classList).toContain('bg-zone-z3');
  });

  it('shows RPE without a dot', () => {
    host.zone.set(null);
    host.rpe.set(7);
    fixture.detectChanges();

    const badge = element.querySelector('app-ui-zone-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('RPE 7');
    expect(badge.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('prioritizes RPE when zone is also set', () => {
    host.rpe.set(7);
    fixture.detectChanges();

    expect(element.querySelector('app-ui-zone-badge')?.textContent?.trim()).toBe('RPE 7');
    expect(element.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
