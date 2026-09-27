import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import type { TrainingZoneSetEntity } from '../../core/domain/schemas/training-zone-set.schema';
import {
  StepDurationType,
  StepKind,
  type LeafStep,
  type RepeatStep,
  type WorkoutStep,
} from '../../core/domain/schemas/workout-step.schema';
import { Sport, StepPhase, type IntensityMetric } from '../../core/domain/workout.enums';
import { STEP_PHASE_LABELS } from '../../core/models/workout-labels';
import {
  calculateWorkoutTotals,
  estimateLeafStepSeconds,
  flattenSteps,
} from '../../core/services/workout-structure.utils';
import { ExerciseStepRowComponent } from './exercise-step-row.component';
import { IntervalStepRowComponent } from './interval-step-row.component';
import { readNumber } from './step-input.utils';
import {
  addStep,
  addStepToRepeat,
  moveStep,
  removeStep,
  replaceStep,
  type LeafStepKind,
  type MoveDirection,
} from './workout-step-operations';
import { collectStepErrors } from './workout-step-validation';

interface ChartSegment {
  key: string;
  label: string;
  minutes: number;
  percentage: number;
  colorClass: string;
}

const PHASE_COLORS: Record<StepPhase, string> = {
  [StepPhase.WarmUp]: 'bg-amber-400',
  [StepPhase.Active]: 'bg-blue-600',
  [StepPhase.Recovery]: 'bg-emerald-500',
  [StepPhase.Rest]: 'bg-slate-400',
  [StepPhase.CoolDown]: 'bg-violet-500',
};
const EXERCISE_COLOR = 'bg-orange-500';

@Component({
  selector: 'app-workout-step-editor',
  imports: [IntervalStepRowComponent, ExerciseStepRowComponent],
  templateUrl: './workout-step-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutStepEditorComponent {
  readonly steps = model.required<WorkoutStep[]>();
  readonly sport = input<Sport | null>(null);
  readonly primaryMetric = input<IntensityMetric | null>(null);
  /** Zone set that matches the sport and metric, or null when the metric has no zones. */
  readonly zoneSet = input<TrainingZoneSetEntity | null>(null);
  /** When true, every step shows its validation errors (e.g. after a save attempt). */
  readonly showErrors = input(false);

  readonly isCycling = computed(() => this.sport() === Sport.Cycling);
  readonly errors = computed(() => collectStepErrors(this.steps()));
  readonly totals = computed(() => calculateWorkoutTotals(this.steps()));
  readonly hasUntimedSteps = computed(() =>
    flattenSteps(this.steps()).some(
      (step) => step.kind === StepKind.Interval && step.duration.type !== StepDurationType.Time,
    ),
  );
  readonly chartSegments = computed<ChartSegment[]>(() => {
    const segments = flattenSteps(this.steps()).map((step, index) => ({
      key: `${step.id}-${index}`,
      label: step.name.trim() || (step.kind === StepKind.Exercise ? 'Ejercicio' : 'Intervalo'),
      seconds: estimateLeafStepSeconds(step),
      colorClass: step.kind === StepKind.Exercise ? EXERCISE_COLOR : PHASE_COLORS[step.phase],
    }));
    const totalSeconds = segments.reduce((total, segment) => total + segment.seconds, 0);

    return totalSeconds === 0
      ? []
      : segments
          .filter((segment) => segment.seconds > 0)
          .map((segment) => ({
            key: segment.key,
            label: segment.label,
            minutes: Math.round((segment.seconds / 60) * 10) / 10,
            percentage: (segment.seconds / totalSeconds) * 100,
            colorClass: segment.colorClass,
          }));
  });
  readonly phaseLegend = Object.values(StepPhase).map((phase) => ({
    label: STEP_PHASE_LABELS[phase],
    colorClass: PHASE_COLORS[phase],
  }));

  errorsFor(stepId: string): readonly string[] {
    return this.showErrors() ? (this.errors().get(stepId) ?? []) : [];
  }

  add(kind: LeafStepKind | typeof StepKind.Repeat): void {
    this.steps.update((steps) => addStep(steps, kind));
  }

  addToRepeat(repeatId: string, kind: LeafStepKind): void {
    this.steps.update((steps) => addStepToRepeat(steps, repeatId, kind));
  }

  update(step: LeafStep | RepeatStep): void {
    this.steps.update((steps) => replaceStep(steps, step));
  }

  move(stepId: string, direction: MoveDirection): void {
    this.steps.update((steps) => moveStep(steps, stepId, direction));
  }

  remove(stepId: string): void {
    this.steps.update((steps) => removeStep(steps, stepId));
  }

  setRepetitions(group: RepeatStep, event: Event): void {
    this.update({ ...group, repetitions: Math.floor(readNumber(event) ?? 0) });
  }

  formatMinutes(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
  }

  formatKm(meters: number | null): string {
    return meters === null ? '' : ` · ${Math.round(meters / 100) / 10} km`;
  }
}
