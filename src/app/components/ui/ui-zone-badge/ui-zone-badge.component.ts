import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Static class names so Tailwind detects them. */
const ZONE_DOT_CLASSES: Record<number, string> = {
  1: 'bg-zone-z1',
  2: 'bg-zone-z2',
  3: 'bg-zone-z3',
  4: 'bg-zone-z4',
  5: 'bg-zone-z5',
  6: 'bg-zone-z6',
  7: 'bg-zone-z7',
};

/** Badge for a training zone (`Z1`–`Z7`) or an RPE target (`RPE 7`). */
@Component({
  selector: 'app-ui-zone-badge',
  templateUrl: './ui-zone-badge.component.html',
  host: {
    class:
      'inline-flex items-center gap-1.5 rounded-full bg-bg-subtle px-2 py-0.5 text-label text-text-primary',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiZoneBadgeComponent {
  /** Zone number from 1 to 7. Ignored when `rpe` is set. */
  readonly zone = input<number | null>(null);
  readonly rpe = input<number | null>(null);

  protected readonly text = computed(() => {
    const rpe = this.rpe();
    return rpe === null ? `Z${this.zone() ?? ''}` : `RPE ${rpe}`;
  });
  protected readonly dotClass = computed(() => {
    const zone = this.zone();
    return this.rpe() === null && zone !== null ? (ZONE_DOT_CLASSES[zone] ?? null) : null;
  });
}
