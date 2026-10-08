import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import type { TrainingZoneSetEntity } from '../../core/domain/schemas/training-zone-set.schema';
import {
  StepDurationType,
  StepKind,
  type LeafStep,
  type RepeatStep,
  type WorkoutStep,
} from '../../core/domain/schemas/workout-step.schema';
import { Sport, type IntensityMetric } from '../../core/domain/workout.enums';
import { buildWorkoutProfile } from '../../core/models/workout-profile';
import {
  calculateWorkoutTotals,
  estimateLeafStepSeconds,
  flattenSteps,
  SECONDS_PER_REP,
} from '../../core/services/workout-structure.utils';
import { UiButtonComponent } from '../ui/ui-button/ui-button.component';
import { WorkoutProfileComponent } from '../workout-profile/workout-profile.component';
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

@Component({
  selector: 'app-workout-step-editor',
  imports: [
    IntervalStepRowComponent,
    ExerciseStepRowComponent,
    UiButtonComponent,
    WorkoutProfileComponent,
  ],
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
  /** Mobility and plyometrics are lists of exercises: they have no profile chart. */
  readonly isIntervalSport = computed(
    () => this.sport() !== Sport.Mobility && this.sport() !== Sport.Plyometrics,
  );
  readonly hasProfile = computed(
    () =>
      this.isIntervalSport() &&
      buildWorkoutProfile(this.steps(), this.sport() ?? undefined).length > 0,
  );
  readonly profileSport = computed(() => this.sport() ?? Sport.Running);
  readonly secondsPerRep = SECONDS_PER_REP;
  /** Step that the user selected in the profile or in the list, to highlight both. */
  readonly selectedStepId = signal<string | null>(null);
  private readonly document = inject(DOCUMENT);

  selectStep(stepId: string | null): void {
    this.selectedStepId.set(stepId);
  }

  /** A block of the profile selects its step and brings the row into view. */
  selectFromProfile(stepId: string | null): void {
    this.selectedStepId.set(stepId);
    this.document.getElementById(`step-row-${stepId}`)?.scrollIntoView?.({ block: 'nearest' });
  }

  repeatSeconds(group: RepeatStep): number {
    return (
      group.repetitions *
      group.steps.reduce((total, step) => total + estimateLeafStepSeconds(step), 0)
    );
  }

  changeRepetitions(group: RepeatStep, delta: number): void {
    this.update({ ...group, repetitions: Math.max(2, group.repetitions + delta) });
  }

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
