import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../components/button/button.component';
import { SportProfileRepository } from '../../core/repositories/sport-profile.repository';

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
  private readonly sportProfileRepository = inject(SportProfileRepository);

  async onNavigateToCalendar(): Promise<void> {
    const profile = await this.sportProfileRepository.getActiveProfile();
    await this.router.navigateByUrl(profile ? '/calendar' : '/profile');
  }
}
