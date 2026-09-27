import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AppShellComponent } from './app-shell.component';

@Component({ selector: 'app-test-page', template: '<p>contenido</p>' })
class TestPageComponent {}

describe('AppShellComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([
          { path: 'calendar', component: TestPageComponent },
          { path: 'library', component: TestPageComponent },
          { path: 'profile', component: TestPageComponent },
        ]),
      ],
    });
  });

  function navigationLinks(root: HTMLElement): HTMLAnchorElement[] {
    return Array.from(root.querySelectorAll<HTMLAnchorElement>('nav a'));
  }

  it('shows the main navigation in Spanish', async () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const links = navigationLinks(fixture.nativeElement);

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Calendario',
      'Biblioteca',
      'Perfil',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/calendar',
      '/library',
      '/profile',
    ]);
  });

  it('marks the active route with aria-current', async () => {
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(AppShellComponent);

    await harness.navigateByUrl('/profile');
    fixture.detectChanges();
    await fixture.whenStable();

    const activeLinks = navigationLinks(fixture.nativeElement).filter(
      (link) => link.getAttribute('aria-current') === 'page',
    );
    expect(activeLinks.map((link) => link.textContent?.trim())).toEqual(['Perfil']);
  });
});
