import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import type { WorkoutStep } from '../../core/domain/schemas/workout-step.schema';
import { Sport } from '../../core/domain/workout.enums';
import { buildWorkoutProfile, zoneHeightRatio } from '../../core/models/workout-profile';

/** Static class names so Tailwind detects them. */
const ZONE_FILL_CLASSES: Record<number, string> = {
  1: 'fill-zone-z1',
  2: 'fill-zone-z2',
  3: 'fill-zone-z3',
  4: 'fill-zone-z4',
  5: 'fill-zone-z5',
  6: 'fill-zone-z6',
  7: 'fill-zone-z7',
};
const NEUTRAL_FILL_CLASS = 'fill-border-strong';

/** Height of the viewBox; the SVG stretches to the height that the host gets from its parent. */
const VIEW_BOX_SIZE = 100;

/** Zones labeled on the vertical axis of the detailed profile. */
const AXIS_ZONES = [1, 3, 5, 7];
const TIME_TICK_COUNT = 4;

/**
 * Read-only profile of a workout: one block per interval step, as wide as its time and as tall as
 * its intensity, colored by zone. It draws nothing for a workout without interval steps. The
 * parent sets the size, e.g. `class="h-7 w-full"`. In detailed mode it also shows the axes, the
 * name of each block and lets the user select a block, which the parent keeps in `selectedStepId`.
 */
@Component({
  selector: 'app-workout-profile',
  templateUrl: './workout-profile.component.html',
  host: {
    class: 'block',
    '[attr.role]': "label() ? 'img' : null",
    '[attr.aria-label]': 'label()',
    '[attr.aria-hidden]': "label() ? null : 'true'",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutProfileComponent {
  readonly steps = input.required<readonly WorkoutStep[]>();
  readonly sport = input<Sport>(Sport.Running);
  /** Accessible name. Without it the profile is decorative, because the card already has a name. */
  readonly label = input<string | null>(null);
  /** Shows axes, block names and selectable blocks. The parent gives it a height. */
  readonly isDetailed = input(false);
  /** Step that the user selected in the profile or in the step list. */
  readonly selectedStepId = model<string | null>(null);

  protected readonly viewBoxSize = VIEW_BOX_SIZE;
  protected readonly bars = computed(() =>
    buildWorkoutProfile(this.steps(), this.sport()).map((bar) => {
      const height = bar.heightRatio * VIEW_BOX_SIZE;
      return {
        x: bar.startRatio * VIEW_BOX_SIZE,
        y: VIEW_BOX_SIZE - height,
        width: bar.widthRatio * VIEW_BOX_SIZE,
        height,
        fillClass: bar.zone === null ? NEUTRAL_FILL_CLASS : ZONE_FILL_CLASSES[bar.zone],
        zone: bar.zone,
        stepId: bar.stepId,
        label: bar.stepName.trim(),
        seconds: bar.seconds,
        startRatio: bar.startRatio,
        widthRatio: bar.widthRatio,
      };
    }),
  );
  protected readonly axisZones = AXIS_ZONES.map((zone) => ({
    zone,
    bottomPercent: zoneHeightRatio(zone) * 100,
  }));
  protected readonly timeTicks = computed(() => {
    const totalSeconds = this.bars().reduce((total, bar) => total + bar.seconds, 0);
    return Array.from({ length: TIME_TICK_COUNT + 1 }, (_, index) => ({
      leftPercent: (index / TIME_TICK_COUNT) * 100,
      label: formatClock((totalSeconds * index) / TIME_TICK_COUNT),
    }));
  });

  protected select(stepId: string): void {
    this.selectedStepId.set(stepId);
  }
}

function formatClock(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
