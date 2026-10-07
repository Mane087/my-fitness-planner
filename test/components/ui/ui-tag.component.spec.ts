import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { UiTagComponent } from '../../../src/app/components/ui/ui-tag/ui-tag.component';

@Component({
  imports: [UiTagComponent],
  template: '<app-ui-tag tone="success">Completed</app-ui-tag>',
})
class UiTagHostComponent {}

describe('UiTagComponent', () => {
  let fixture: ComponentFixture<UiTagHostComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(UiTagHostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('applies success tone classes', () => {
    expect(element.querySelector('app-ui-tag')?.classList).toContain('text-status-success');
  });

  it('projects its content', () => {
    expect(element.querySelector('app-ui-tag')?.textContent?.trim()).toBe('Completed');
  });
});
