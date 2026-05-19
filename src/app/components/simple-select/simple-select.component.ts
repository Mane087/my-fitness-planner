import { NgClass } from '@angular/common';
import { Component, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type SelectOptionValue = string | number | boolean | null;

export interface SimpleSelectOption {
  label: string;
  value: SelectOptionValue;
  disabled?: boolean;
}

@Component({
  selector: 'app-simple-select',
  imports: [NgClass],
  templateUrl: './simple-select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SimpleSelectComponent),
      multi: true,
    },
  ],
})
export class SimpleSelectComponent implements ControlValueAccessor {
  label = input.required<string>();
  options = input.required<SimpleSelectOption[]>();

  placeholder = input<string>('Selecciona una opción');
  selectId = input<string>('');
  showPlaceholder = input<boolean>(true);

  value: SelectOptionValue = '';
  isDisabled = false;

  private onChange: (value: SelectOptionValue) => void = () => {
    /* empty */
  };
  private onTouched: () => void = () => {
    /* empty */
  };

  writeValue(value: SelectOptionValue): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: SelectOptionValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  handleChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const selectedValue = this.parseValue(selectElement.value);

    this.value = selectedValue;
    this.onChange(selectedValue);
  }

  handleBlur(): void {
    this.onTouched();
  }

  private parseValue(value: string): SelectOptionValue {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    if (value === 'null') {
      return null;
    }

    const numericValue = Number(value);

    if (value.trim() !== '' && !Number.isNaN(numericValue)) {
      return numericValue;
    }

    return value;
  }

  stringifyValue(value: SelectOptionValue): string {
    return String(value ?? '');
  }
}
