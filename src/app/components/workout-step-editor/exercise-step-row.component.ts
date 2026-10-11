import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  ExerciseMeasureType,
  type ExerciseStep,
} from '../../core/domain/schemas/workout-step.schema';
import { IntensityMetric } from '../../core/domain/workout.enums';
import { formatHoldDuration } from '../../core/models/exercise-summary';
import { holdSeconds as calculateHoldSeconds } from '../../core/services/workout-structure.utils';
import { UiSegmentedControlComponent } from '../ui/ui-segmented-control/ui-segmented-control.component';
import { readNumber, readText, withOptional } from './step-input.utils';
import type { MoveDirection } from './workout-step-operations';
import { UiButtonComponent } from '../ui/ui-button/ui-button.component';

const DEFAULT_REPS = 10;
const DEFAULT_HOLD_SECONDS = 30;

@Component({
  selector: 'app-exercise-step-row',
  imports: [UiButtonComponent, UiSegmentedControlComponent],
  templateUrl: './exercise-step-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseStepRowComponent {
  readonly step = input.required<ExerciseStep>();
  /** Visible position, e.g. `3` or `2.1` inside a repeat group. */
  readonly position = input.required<string>();
  readonly errors = input<readonly string[]>([]);
  readonly canMoveUp = input(true);
  readonly canMoveDown = input(true);
  /** Highlights the row when the user selected this step in the profile or in the list. */
  readonly isSelected = input(false);

  readonly changed = output<ExerciseStep>();
  readonly moved = output<MoveDirection>();
  readonly removed = output<void>();
  /** Emits when the user clicks or focuses the row, to sync the profile selection. */
  readonly selected = output<void>();

  readonly measureOptions = [
    { value: ExerciseMeasureType.Reps, label: 'Repeticiones' },
    { value: ExerciseMeasureType.Hold, label: 'Tiempo de sostén' },
  ];
  readonly sideOptions = [
    { value: 'both', label: 'Ambos' },
    { value: 'per-side', label: 'Por lado' },
  ];

  readonly idPrefix = computed(() => `step-${this.step().id}`);
  readonly reps = computed(() => {
    const measure = this.step().measure;
    return measure.type === ExerciseMeasureType.Reps ? measure.reps : null;
  });
  readonly holdSeconds = computed(() => {
    const measure = this.step().measure;
    return measure.type === ExerciseMeasureType.Hold ? measure.seconds : null;
  });
  readonly timeUnderTensionSeconds = computed(() => calculateHoldSeconds(this.step()));

  setName(event: Event): void {
    this.changed.emit({ ...this.step(), name: readText(event) });
  }

  /** Required counts keep 0 when cleared so the schema reports the missing value. */
  setCount(event: Event): void {
    this.changed.emit({ ...this.step(), sets: Math.floor(readNumber(event) ?? 0) });
  }

  /** Switching the measure starts from a usual value: 10 reps or a 30 s hold. */
  setMeasureType(type: string | null): void {
    if (type === this.step().measure.type) return;
    this.changed.emit({
      ...this.step(),
      measure:
        type === ExerciseMeasureType.Hold
          ? { type: ExerciseMeasureType.Hold, seconds: DEFAULT_HOLD_SECONDS }
          : { type: ExerciseMeasureType.Reps, reps: DEFAULT_REPS },
    });
  }

  /** Reps or hold seconds, depending on the measure. Cleared keeps 0 so the schema reports it. */
  setMeasureValue(event: Event): void {
    const value = Math.floor(readNumber(event) ?? 0);
    const measure = this.step().measure;
    this.changed.emit({
      ...this.step(),
      measure:
        measure.type === ExerciseMeasureType.Hold
          ? { type: ExerciseMeasureType.Hold, seconds: value }
          : { type: ExerciseMeasureType.Reps, reps: value },
    });
  }

  setSides(value: string | null): void {
    this.changed.emit(
      withOptional(this.step(), 'perSide', value === 'per-side' ? true : undefined),
    );
  }

  readonly formatDuration = formatHoldDuration;

  setLoad(event: Event): void {
    this.changed.emit(withOptional(this.step(), 'loadKg', readNumber(event) ?? undefined));
  }

  setRest(event: Event): void {
    const rest = readNumber(event);
    this.changed.emit(
      withOptional(this.step(), 'restSeconds', rest === null ? undefined : Math.floor(rest)),
    );
  }

  setRpe(event: Event): void {
    const value = readNumber(event);
    this.changed.emit(
      withOptional(
        this.step(),
        'target',
        value === null ? undefined : { metric: IntensityMetric.Rpe, value: Math.round(value) },
      ),
    );
  }

  setNotes(event: Event): void {
    const notes = readText(event);
    this.changed.emit(withOptional(this.step(), 'notes', notes.trim() ? notes : undefined));
  }
}
