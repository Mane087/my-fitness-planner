import { Component, forwardRef, input, signal, ViewChild, ElementRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputType } from '../../core/types/input-type';

@Component({
  selector: 'app-input-form',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputFormComponent),
      multi: true,
    },
  ],
  templateUrl: './input-form.component.html',
})
export class InputFormComponent implements ControlValueAccessor {
  labelText = input('');
  inputType = input<InputType>('text');
  inputPlaceholder = input('');
  inputId = input('');
  filterInput = input(false);
  activateStep = input(false);
  activateMax = input(false);
  inputMaxValue = input(0);

  value = signal<string>('');
  disabled = signal(false);

  @ViewChild('input', { static: true })
  inputEl!: ElementRef<HTMLInputElement>;

  private onChange: (value: string) => void = () => {
    /* empty */
  };
  private onTouched: () => void = () => {
    /* empty */
  };

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
    this.disabled.set(isDisabled);
  }

  onInput(event: Event) {
    const el = event.target as HTMLInputElement;
    let value = el.value;

    if (this.filterInput() && this.inputType() !== 'number' && this.inputType() !== 'email') {
      value = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
      el.value = value;
    }

    this.value.set(value);
    this.onChange(value);
  }

  onBlur() {
    this.onTouched();
  }

  onKeyDown(event: KeyboardEvent) {
    if (
      this.inputType() === 'number' &&
      this.activateMax() &&
      event.target instanceof HTMLInputElement &&
      event.target.value.length >= this.inputMaxValue()
    ) {
      event.preventDefault();
    }
  }
}
