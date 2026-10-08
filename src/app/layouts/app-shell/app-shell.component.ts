import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import type { IconName } from '../../components/ui/ui-icon/icon-registry';
import { UiIconComponent } from '../../components/ui/ui-icon/ui-icon.component';
import { ShellWeekSummaryService } from '../../core/services/shell-week-summary.service';
import { SidebarWeekSummaryComponent } from './sidebar-week-summary.component';

interface NavigationItem {
  label: string;
  path: string;
  icon: IconName;
}

/** The calendar needs the width, so it collapses the sidebar into an icon rail. */
const RAIL_PATHS: readonly string[] = ['/calendar'];

/**
 * App layout with one navigation in three presentations: a sidebar (232 px) on wide screens,
 * an icon rail (72 px) on the calendar, and a bottom bar under 640 px.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    UiIconComponent,
    SidebarWeekSummaryComponent,
  ],
  templateUrl: './app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly weekSummary = inject(ShellWeekSummaryService);

  readonly navigationItems: readonly NavigationItem[] = [
    { label: 'Calendario', path: '/calendar', icon: 'calendar' },
    { label: 'Biblioteca', path: '/library', icon: 'layers' },
    { label: 'Perfil y zonas', path: '/profile', icon: 'user' },
  ];

  // Before the first navigation ends the router still reports '/', so the browser location gives
  // the real starting path and avoids showing the sidebar for a moment on the calendar.
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.location.path() },
  );

  protected readonly isRail = computed(() => {
    const path = this.currentUrl().split(/[?#]/)[0] ?? '';
    return RAIL_PATHS.includes(path);
  });

  constructor() {
    // Workouts change while the user navigates, so the summary is reloaded on every navigation.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        void this.weekSummary.refresh();
      });
  }
}
