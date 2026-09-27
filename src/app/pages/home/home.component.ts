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

  async onNavigateToCalendar(): Promise<void> {
    const profile = await this.athleteProfileRepository.getActiveProfile();
    await this.router.navigateByUrl(profile ? '/calendar' : '/profile');
  }
}
