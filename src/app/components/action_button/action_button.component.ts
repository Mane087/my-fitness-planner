import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-action-button',
  standalone: true,
  imports: [],
  templateUrl: './action_button.component.html',
})
export class ActionButtonComponent {
  label = input.required<string>();
  title = input.required<string>();
  icon = input.required<string>();
  pressed = output<void>();

  onClick(): void {
    this.pressed.emit();
  }
}
