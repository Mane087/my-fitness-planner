import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../components/button/button.component';
import { AthleteProfileRepository } from '../../core/repositories/athlete-profile.repository';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  private readonly router = inject(Router);
  private readonly athleteProfileRepository = inject(AthleteProfileRepository);

  /** First run: the user configures the profile before planning. */
  async onNavigateToCalendar(): Promise<void> {
    const hasConfiguredProfile = await this.athleteProfileRepository
      .hasConfiguredProfile()
      .catch(() => false);
    await this.router.navigateByUrl(hasConfiguredProfile ? '/calendar' : '/profile');
  }
}
