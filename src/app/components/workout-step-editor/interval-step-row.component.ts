import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { TrainingZoneSetEntity } from '../../core/domain/schemas/training-zone-set.schema';
import {
  StepDurationType,
  type CadenceRange,
  type IntervalStep,
  type StepDuration,
} from '../../core/domain/schemas/workout-step.schema';
import { IntensityMetric, STEP_PHASES, type StepPhase } from '../../core/domain/workout.enums';
import { STEP_DURATION_TYPE_LABELS, STEP_PHASE_LABELS } from '../../core/models/workout-labels';
import { resolveProfileZone } from '../../core/models/workout-profile';
import { formatZone } from '../../core/models/zone-format';
import { readNumber, readText, withOptional } from './step-input.utils';
import type { MoveDirection } from './workout-step-operations';
import { UiButtonComponent } from '../ui/ui-button/ui-button.component';

const DEFAULT_SECONDS = 600;
const DEFAULT_METERS = 1000;

@Component({
  selector: 'app-interval-step-row',
  imports: [RouterLink, UiButtonComponent],
  templateUrl: './interval-step-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntervalStepRowComponent {
  readonly step = input.required<IntervalStep>();
  /** Visible position, e.g. `3` or `2.1` inside a repeat group. */
  readonly position = input.required<string>();
  readonly metric = input<IntensityMetric | null>(null);
  readonly zoneSet = input<TrainingZoneSetEntity | null>(null);
  readonly isCycling = input(false);
  readonly errors = input<readonly string[]>([]);
  readonly canMoveUp = input(true);
  readonly canMoveDown = input(true);
  /** Highlights the row when the user selected this step in the profile or in the list. */
  readonly isSelected = input(false);

  readonly changed = output<IntervalStep>();
  readonly moved = output<MoveDirection>();
  readonly removed = output<void>();
  /** Emits when the user clicks or focuses the row, to sync the profile selection. */
  readonly selected = output<void>();

  readonly phaseOptions = STEP_PHASES.map((phase) => ({
    value: phase,
    label: STEP_PHASE_LABELS[phase],
  }));
  readonly durationTypeOptions = Object.values(StepDurationType).map((type) => ({
    value: type,
    label: STEP_DURATION_TYPE_LABELS[type],
  }));

  readonly idPrefix = computed(() => `step-${this.step().id}`);
  readonly isZoneMetric = computed(() => {
    const metric = this.metric();
    return metric !== null && metric !== IntensityMetric.Rpe && this.zoneSet() !== null;
  });
  readonly zone = computed(() => resolveProfileZone(this.step().target));
  readonly isRpeMetric = computed(() => this.metric() === IntensityMetric.Rpe);
  readonly needsZoneSet = computed(() => {
    const metric = this.metric();
    return metric !== null && metric !== IntensityMetric.Rpe && this.zoneSet() === null;
  });
  readonly timeParts = computed(() => {
    const duration = this.step().duration;
    const totalSeconds = duration.type === StepDurationType.Time ? duration.seconds : 0;
    return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
  });
  readonly distanceKm = computed(() => {
    const duration = this.step().duration;
    return duration.type === StepDurationType.Distance ? duration.meters / 1000 : null;
  });
  readonly selectedZoneId = computed(() => {
    const target = this.step().target;
    return target && target.metric !== IntensityMetric.Rpe ? target.zoneId : '';
  });
  readonly rpeValue = computed(() => {
    const target = this.step().target;
    return target?.metric === IntensityMetric.Rpe ? target.value : null;
  });
  readonly zoneOptions = computed(() => {
    const zoneSet = this.zoneSet();
    return zoneSet
      ? zoneSet.zones.map((zone) => ({ value: zone.id, label: formatZone(zone, zoneSet.metric) }))
      : [];
  });

  setName(event: Event): void {
    this.emit({ ...this.step(), name: readText(event) });
  }

  setPhase(event: Event): void {
    this.emit({ ...this.step(), phase: readText(event) as StepPhase });
  }

  setDurationType(event: Event): void {
    const type = readText(event) as StepDuration['type'];
    const duration: StepDuration =
      type === StepDurationType.Time
        ? { type, seconds: DEFAULT_SECONDS }
        : type === StepDurationType.Distance
          ? { type, meters: DEFAULT_METERS }
          : { type: StepDurationType.Open };

    this.emit({ ...this.step(), duration });
  }

  setMinutes(event: Event): void {
    const minutes = Math.max(0, Math.floor(readNumber(event) ?? 0));
    this.emitSeconds(minutes * 60 + this.timeParts().seconds);
  }

  setSeconds(event: Event): void {
    const seconds = Math.min(59, Math.max(0, Math.floor(readNumber(event) ?? 0)));
    this.emitSeconds(this.timeParts().minutes * 60 + seconds);
  }

  setDistanceKm(event: Event): void {
    const km = readNumber(event) ?? 0;
    this.emit({
      ...this.step(),
      duration: { type: StepDurationType.Distance, meters: Math.round(km * 1000) },
    });
  }

  setZone(event: Event): void {
    const zoneSet = this.zoneSet();
    const zone = zoneSet?.zones.find((candidate) => candidate.id === readText(event));

    this.emit(
      withOptional(
        this.step(),
        'target',
        zone && zoneSet
          ? {
              metric: zoneSet.metric,
              zoneId: zone.id,
              zoneSnapshot: {
                zoneSetId: zoneSet.id,
                zoneId: zone.id,
                name: zone.name,
                metric: zoneSet.metric,
                minValue: zone.minValue,
                maxValue: zone.maxValue,
              },
            }
          : undefined,
      ),
    );
  }

  setRpe(event: Event): void {
    const value = readNumber(event);
    this.emit(
      withOptional(
        this.step(),
        'target',
        value === null ? undefined : { metric: IntensityMetric.Rpe, value: Math.round(value) },
      ),
    );
  }

  setCadence(bound: keyof CadenceRange, event: Event): void {
    const value = readNumber(event);
    const current = this.step().cadenceRpm;
    const next = {
      min: current?.min ?? value ?? 0,
      max: current?.max ?? value ?? 0,
      [bound]: value,
    };
    const cadence =
      next.min === null || next.max === null
        ? undefined
        : { min: Math.round(next.min), max: Math.round(next.max) };

    this.emit(withOptional(this.step(), 'cadenceRpm', cadence));
  }

  setNotes(event: Event): void {
    const notes = readText(event);
    this.emit(withOptional(this.step(), 'notes', notes.trim() ? notes : undefined));
  }

  private emitSeconds(seconds: number): void {
    this.emit({ ...this.step(), duration: { type: StepDurationType.Time, seconds } });
  }

  private emit(step: IntervalStep): void {
    this.changed.emit(step);
  }
}
