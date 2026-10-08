import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { WorkoutProfileComponent } from '../../src/app/components/workout-profile/workout-profile.component';
import type { WorkoutStep } from '../../src/app/core/domain/schemas/workout-step.schema';
import { heartRateSnapshot, heartRateTarget, interval } from '../domain/fixtures';

@Component({
  imports: [WorkoutProfileComponent],
  template:
    '<app-workout-profile [steps]="steps()" [label]="label()" [isDetailed]="isDetailed()" [(selectedStepId)]="selectedStepId" />',
})
class WorkoutProfileHostComponent {
  readonly steps = signal<WorkoutStep[]>([]);
  readonly label = signal<string | null>(null);
  readonly isDetailed = signal(false);
  readonly selectedStepId = signal<string | null>(null);
}

function zoned(id: string, seconds: number, zoneNumber: number): WorkoutStep {
  return interval(id, {
    duration: { type: 'time', seconds },
    target: heartRateTarget({
      zoneSnapshot: heartRateSnapshot({ name: `Z${zoneNumber} Zona` }),
    }),
  });
}

describe('WorkoutProfileComponent', () => {
  let fixture: ComponentFixture<WorkoutProfileHostComponent>;
  let host: WorkoutProfileHostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkoutProfileHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const rects = () => Array.from(element.querySelectorAll('rect'));

  it('draws nothing when the workout has no interval steps', () => {
    expect(element.querySelector('svg')).toBeNull();
  });

  it('draws one proportional rectangle per step colored by zone', () => {
    host.steps.set([zoned('a', 300, 1), zoned('b', 900, 4)]);
    fixture.detectChanges();

    expect(rects()).toHaveLength(2);
    expect(rects().map((rect) => rect.getAttribute('width'))).toEqual(['25', '75']);
    expect(rects().map((rect) => rect.getAttribute('x'))).toEqual(['0', '25']);
    expect(rects()[0].getAttribute('class')).toContain('fill-zone-z1');
    expect(rects()[1].getAttribute('class')).toContain('fill-zone-z4');
  });

  it('anchors the blocks to the bottom and makes higher zones taller', () => {
    host.steps.set([zoned('a', 300, 1), zoned('b', 300, 5)]);
    fixture.detectChanges();

    const [low, high] = rects().map((rect) => ({
      y: Number(rect.getAttribute('y')),
      height: Number(rect.getAttribute('height')),
    }));

    expect(low.y + low.height).toBeCloseTo(100);
    expect(high.y + high.height).toBeCloseTo(100);
    expect(high.height).toBeGreaterThan(low.height);
  });

  it('is decorative without a label and an image with one', () => {
    host.steps.set([zoned('a', 300, 2)]);
    fixture.detectChanges();
    const profile = element.querySelector('app-workout-profile') as HTMLElement;

    expect(profile.getAttribute('aria-hidden')).toBe('true');
    expect(profile.getAttribute('role')).toBeNull();

    host.label.set('Perfil del entrenamiento');
    fixture.detectChanges();

    expect(profile.getAttribute('role')).toBe('img');
    expect(profile.getAttribute('aria-label')).toBe('Perfil del entrenamiento');
    expect(profile.getAttribute('aria-hidden')).toBeNull();
  });

  describe('detailed mode', () => {
    beforeEach(() => {
      host.isDetailed.set(true);
      host.steps.set([zoned('a', 300, 1), zoned('b', 900, 4)]);
      fixture.detectChanges();
    });

    const blocks = () => Array.from(element.querySelectorAll<HTMLButtonElement>('button'));

    it('shows the zone axis and the time axis', () => {
      expect(element.textContent).toContain('Z1');
      expect(element.textContent).toContain('Z7');
      expect(element.textContent).toContain('0:00');
      expect(element.textContent).toContain('20:00');
    });

    it('selects a step when its block is clicked', () => {
      blocks()[1].click();
      fixture.detectChanges();

      expect(host.selectedStepId()).toBe('b');
      expect(blocks()[1].getAttribute('aria-pressed')).toBe('true');
      expect(blocks()[0].getAttribute('aria-pressed')).toBe('false');
    });

    it('marks the block of the selected step', () => {
      host.selectedStepId.set('a');
      fixture.detectChanges();

      expect(blocks()[0].getAttribute('aria-pressed')).toBe('true');
    });
  });
});
