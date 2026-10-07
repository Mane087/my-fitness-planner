import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiCardComponent } from '../../../src/app/components/ui/ui-card/ui-card.component';

@Component({
  imports: [UiCardComponent],
  template: '<app-ui-card [size]="size()" [elevation]="elevation">Card content</app-ui-card>',
})
class UiCardHostComponent {
  readonly size = signal<'sm' | 'md'>('md');
  elevation: 0 | 1 | 2 | 3 | 4 = 3;
}

describe('UiCardComponent', () => {
  let fixture: ComponentFixture<UiCardHostComponent>;
  let host: UiCardHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiCardHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('applies medium size and elevation classes', () => {
    const card = element.querySelector('app-ui-card') as HTMLElement;
    expect(card.classList).toContain('rounded-xl');
    expect(card.classList).toContain('p-6');
    expect(card.classList).toContain('shadow-elevation-3');
  });

  it('applies compact size classes', () => {
    host.size.set('sm');
    fixture.detectChanges();

    const card = element.querySelector('app-ui-card') as HTMLElement;
    expect(card.classList).toContain('rounded-lg');
    expect(card.classList).toContain('p-2.5');
  });
});
