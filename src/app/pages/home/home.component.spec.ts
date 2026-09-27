import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AthleteProfileRepository } from '../../core/repositories/athlete-profile.repository';
import { HomePageComponent } from './home.component';

describe('HomePageComponent', () => {
  let profiles: jest.Mocked<Pick<AthleteProfileRepository, 'hasConfiguredProfile'>>;
  let router: Router;

  beforeEach(() => {
    profiles = { hasConfiguredProfile: jest.fn() };

    TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [provideRouter([]), { provide: AthleteProfileRepository, useValue: profiles }],
    });

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  it('shows the Spanish hero', () => {
    const fixture = TestBed.createComponent(HomePageComponent);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Planifica tus entrenamientos');
  });

  it('sends a first-time user to the profile', async () => {
    profiles.hasConfiguredProfile.mockResolvedValue(false);

    await TestBed.createComponent(HomePageComponent).componentInstance.onNavigateToCalendar();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/profile');
  });

  it('sends a user with a saved profile to the calendar', async () => {
    profiles.hasConfiguredProfile.mockResolvedValue(true);

    await TestBed.createComponent(HomePageComponent).componentInstance.onNavigateToCalendar();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/calendar');
  });

  it('falls back to the profile when storage fails', async () => {
    profiles.hasConfiguredProfile.mockRejectedValue(new Error('storage unavailable'));

    await TestBed.createComponent(HomePageComponent).componentInstance.onNavigateToCalendar();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/profile');
  });
});
