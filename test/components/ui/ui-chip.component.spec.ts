import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiChipComponent } from '../../../src/app/components/ui/ui-chip/ui-chip.component';

@Component({
  imports: [UiChipComponent],
  template: '<app-ui-chip [(isSelected)]="isSelected" [icon]="icon()">Filters</app-ui-chip>',
})
class UiChipHostComponent {
  isSelected = false;
  readonly icon = signal<'calendar' | null>(null);
}

describe('UiChipComponent', () => {
  let fixture: ComponentFixture<UiChipHostComponent>;
  let host: UiChipHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiChipHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('exposes its unselected state with aria-pressed', () => {
    expect(element.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles its two-way selected state when clicked', () => {
    (element.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.isSelected).toBe(true);
    expect(element.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the requested icon', () => {
    host.icon.set('calendar');
    fixture.detectChanges();

    expect(element.querySelector('app-ui-icon svg')).not.toBeNull();
  });
});
