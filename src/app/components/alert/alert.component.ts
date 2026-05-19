import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { AlertType } from '../../core/types/alert';
import { AlertConfig } from '../../core/interfaces/alert';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.component.html',
})
export class AlertComponent {
  private alertConfig: Record<AlertType, AlertConfig> = {
    'toast-success': {
      container: 'bg-green-200',
      iconClass: 'text-green-600 bg-green-200',
      iconLabel: 'Check icon',
      svgPath:
        'M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z',
    },
    'toast-danger': {
      container: 'bg-red-400',
      iconClass: 'text-red-500 bg-red-100',
      iconLabel: 'Error icon',
      svgPath:
        'M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 11.793a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 0 1 1.414 1.414L11.414 10l2.293 2.293Z',
    },
    'toast-warning': {
      container: 'bg-orange-300',
      iconClass: 'text-orange-500 bg-orange-100',
      iconLabel: 'Warning icon',
      svgPath:
        'M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z',
    },
  };

  typeAlert = input.required<AlertType>();
  alertMessage = input.required<string>();
  showAlert = output<boolean>();

  config = computed(() => this.alertConfig[this.typeAlert()]);

  dismissAlert() {
    this.showAlert.emit(false);
  }
}
