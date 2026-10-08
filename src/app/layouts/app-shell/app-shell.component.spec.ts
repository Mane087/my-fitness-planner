import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  ShellWeekSummaryService,
  type ShellWeekSummary,
} from '../../core/services/shell-week-summary.service';
import { AppShellComponent } from './app-shell.component';

@Component({ selector: 'app-test-page', template: '<p>contenido</p>' })
class TestPageComponent {}

const WEEK_SUMMARY: ShellWeekSummary = {
  actualClock: '6:45',
  plannedClock: '8:30',
  progressPercent: 79,
  sessions: 6,
  completedSessions: 4,
};

describe('AppShellComponent', () => {
  const summary = signal<ShellWeekSummary | null>(WEEK_SUMMARY);
  const refresh = jest.fn<Promise<void>, []>();

  beforeEach(() => {
    summary.set(WEEK_SUMMARY);
    refresh.mockReset();
    refresh.mockResolvedValue();

    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        { provide: ShellWeekSummaryService, useValue: { summary, refresh } },
        provideRouter([
          { path: '', component: TestPageComponent },
          { path: 'calendar', component: TestPageComponent },
          { path: 'calendar/new', component: TestPageComponent },
          { path: 'library', component: TestPageComponent },
          { path: 'profile', component: TestPageComponent },
        ]),
      ],
    });
  });

  async function render(url: string) {
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(AppShellComponent);

    await harness.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    return { fixture, harness, root };
  }

  function navigationLinks(root: HTMLElement): HTMLAnchorElement[] {
    return Array.from(
      root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Navegación principal"] a'),
    );
  }

  it('shows the main navigation in Spanish', async () => {
    const { root } = await render('/library');

    const links = navigationLinks(root);

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Calendario',
      'Biblioteca',
      'Perfil y zonas',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/calendar',
      '/library',
      '/profile',
    ]);
  });

  it('marks the active route with aria-current', async () => {
    const { root } = await render('/profile');

    const activeLinks = navigationLinks(root).filter(
      (link) => link.getAttribute('aria-current') === 'page',
    );
    expect(activeLinks.map((link) => link.textContent?.trim())).toEqual(['Perfil y zonas']);
  });

  it('shows the full sidebar with the week summary outside the calendar', async () => {
    const { root } = await render('/library');

    expect(root.querySelector('aside')?.className).toContain('sm:w-58');
    expect(root.textContent).toContain('MyFitnessPlanner');
    const weekSummary = root.querySelector('[data-testid="sidebar-week-summary"]');
    expect(weekSummary?.textContent).toContain('6:45');
    expect(weekSummary?.textContent).toContain('/ 8:30 h');
    expect(weekSummary?.textContent).toContain('4 de 6 entrenamientos');
    expect(weekSummary?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '79',
    );
  });

  it('collapses into an icon rail on the calendar and keeps the accessible names', async () => {
    const { root } = await render('/calendar?date=2026-09-29');

    expect(root.querySelector('aside')?.className).toContain('sm:w-18');
    expect(root.querySelector('[data-testid="sidebar-week-summary"]')).toBeNull();
    expect(root.querySelector('a[routerLink="/"], aside > a')?.getAttribute('aria-label')).toBe(
      'MyFitnessPlanner, inicio',
    );
    expect(navigationLinks(root).map((link) => link.textContent?.trim())).toEqual([
      'Calendario',
      'Biblioteca',
      'Perfil y zonas',
    ]);
  });

  it('uses the full sidebar in the calendar form pages', async () => {
    const { root } = await render('/calendar/new');

    expect(root.querySelector('aside')?.className).toContain('sm:w-58');
  });

  it('hides the week summary when it is not available', async () => {
    summary.set(null);

    const { root } = await render('/library');

    expect(root.querySelector('[data-testid="sidebar-week-summary"]')).toBeNull();
  });

  it('reloads the week summary on every navigation', async () => {
    const { harness, fixture } = await render('/library');
    const callsAfterFirstRender = refresh.mock.calls.length;

    await harness.navigateByUrl('/profile');
    fixture.detectChanges();

    expect(callsAfterFirstRender).toBeGreaterThan(0);
    expect(refresh.mock.calls.length).toBeGreaterThan(callsAfterFirstRender);
  });
});
