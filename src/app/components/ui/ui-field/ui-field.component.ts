import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import type { InputType } from '../../../core/models/input-type';
import type { IconName } from '../ui-icon/icon-registry';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

let nextFieldId = 0;

/**
 * Text or number field with label, optional leading icon and unit suffix, and an error message
 * under the control. Works with reactive forms and template-driven forms.
 */
@Component({
  selector: 'app-ui-field',
  imports: [UiIconComponent],
  templateUrl: './ui-field.component.html',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiFieldComponent), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiFieldComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly inputType = input<InputType>('text');
  readonly placeholder = input('');
  /** Unit shown at the end of the control, e.g. `m:s` or `rpm`. */
  readonly suffix = input<string | null>(null);
  readonly icon = input<IconName | null>(null);
  /** Shown under the field in red. Its presence marks the field as invalid. */
  readonly errorMessage = input<string | null>(null);
  readonly inputId = input(`app-ui-field-${nextFieldId++}`);
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly step = input<number | null>(null);
  readonly autocomplete = input<string | null>(null);

  protected readonly value = signal('');
  protected readonly isDisabled = signal(false);

  protected get errorId(): string {
    return `${this.inputId()}-error`;
  }

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | number | null): void {
    this.value.set(value === null ? '' : String(value));
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

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
