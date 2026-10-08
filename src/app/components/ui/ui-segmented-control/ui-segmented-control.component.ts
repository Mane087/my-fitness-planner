import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import type { Options } from '../../../core/models/option';

/**
 * Exclusive choice between a few options (2–4). Implemented as a radio group: arrow keys move
 * the selection and only the selected segment is in the tab order.
 */
@Component({
  selector: 'app-ui-segmented-control',
  templateUrl: './ui-segmented-control.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSegmentedControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSegmentedControlComponent implements ControlValueAccessor {
  readonly options = input.required<readonly Options[]>();
  /** Accessible name of the group. */
  readonly ariaLabel = input.required<string>();
  readonly value = model<string | null>(null);

  protected readonly isDisabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected isSelected(option: Options): boolean {
    return option.value === this.value();
  }

  /** The selected segment, or the first one when nothing is selected, receives the tab stop. */
  protected hasTabStop(option: Options, index: number): boolean {
    const hasSelection = this.options().some((candidate) => this.isSelected(candidate));
    return hasSelection ? this.isSelected(option) : index === 0;
  }

  protected select(option: Options): void {
    if (this.isDisabled()) {
      return;
    }

    this.value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const options = this.options();
    const step = this.getStep(event.key);

    if (step === 0 || options.length === 0) {
      return;
    }

    event.preventDefault();
    const nextIndex = (index + step + options.length) % options.length;
    const next = options[nextIndex];

    if (next) {
      this.select(next);
      const radios = (
        event.currentTarget as HTMLElement
      ).parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
      radios?.[nextIndex]?.focus();
    }
  }

  private getStep(key: string): number {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return 1;
      case 'ArrowLeft':
      case 'ArrowUp':
        return -1;
      default:
        return 0;
    }
  }
}
