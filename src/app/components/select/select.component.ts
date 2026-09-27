import { Component, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Options } from '../../core/models/option';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-select',
  imports: [NgClass],
  templateUrl: './select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  options = input<Options[]>([]);
  defaultOption = input<string>('');
  titleSelect = input<string>('');
  label = input<string>('');
  simple = input<boolean>(false);
  simpleClass = input<string>('');
  selection = output<string>();
  isOpen = signal<boolean>(false);
  disabled = signal<boolean>(false);
  currentSelection = signal<Options | null>(null);

  private onChange?: (value: string) => void;
  private onTouched?: () => void;

  toggleDropdown(): void {
    this.isOpen.update((value) => !value);
  }

  selectOption(option: Options): void {
    this.currentSelection.set(option);
    this.selection.emit(option.value);
    this.onChange?.(option.value);
    this.onTouched?.();
    this.isOpen.set(false);
  }

  close() {
    this.isOpen.set(false);
  }

  writeValue(value: string): void {
    const option = this.options().find((opt) => opt.value === value) ?? null;
    this.currentSelection.set(option);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
