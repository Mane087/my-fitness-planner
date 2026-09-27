import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavigationItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  readonly navigationItems: readonly NavigationItem[] = [
    { label: 'Calendario', path: '/calendar' },
    { label: 'Biblioteca', path: '/library' },
    { label: 'Perfil', path: '/profile' },
  ];
}
