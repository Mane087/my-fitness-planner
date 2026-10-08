import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import type { Options } from '../../../core/models/option';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

let nextSelectId = 0;

/** Field with the native `<select>` (keyboard and screen reader support come from the browser). */
@Component({
  selector: 'app-ui-select',
  imports: [UiIconComponent],
  templateUrl: './ui-select.component.html',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelectComponent), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSelectComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly options = input<readonly Options[]>([]);
  /** Option without value shown while nothing is selected. */
  readonly placeholder = input<string | null>(null);
  readonly errorMessage = input<string | null>(null);
  readonly selectId = input(`app-ui-select-${nextSelectId++}`);

  protected readonly value = signal('');
  protected readonly isDisabled = signal(false);

  protected get errorId(): string {
    return `${this.selectId()}-error`;
  }

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
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

  protected onSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
