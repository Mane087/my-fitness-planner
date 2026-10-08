import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { ExerciseStep } from '../../core/domain/schemas/workout-step.schema';
import { IntensityMetric } from '../../core/domain/workout.enums';
import { readNumber, readText, withOptional } from './step-input.utils';
import type { MoveDirection } from './workout-step-operations';
import { UiButtonComponent } from '../ui/ui-button/ui-button.component';

@Component({
  selector: 'app-exercise-step-row',
  imports: [UiButtonComponent],
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

  readonly idPrefix = computed(() => `step-${this.step().id}`);

  setName(event: Event): void {
    this.changed.emit({ ...this.step(), name: readText(event) });
  }

  /** Required counts keep 0 when cleared so the schema reports the missing value. */
  setCount(field: 'sets' | 'reps', event: Event): void {
    this.changed.emit({ ...this.step(), [field]: Math.floor(readNumber(event) ?? 0) });
  }

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
