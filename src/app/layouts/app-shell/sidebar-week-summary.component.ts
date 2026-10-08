import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ShellWeekSummaryService } from '../../core/services/shell-week-summary.service';
import { UiProgressComponent } from '../../components/ui/ui-progress/ui-progress.component';

/** Compact summary of the current week for the sidebar. */
@Component({
  selector: 'app-sidebar-week-summary',
  imports: [UiProgressComponent],
  templateUrl: './sidebar-week-summary.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarWeekSummaryComponent {
  protected readonly summary = inject(ShellWeekSummaryService).summary;
}
