import { Component, input } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  showModal = input<boolean>(false);
  /** Id of the element that names the dialog (usually its heading). */
  labelledBy = input<string | null>(null);
}
