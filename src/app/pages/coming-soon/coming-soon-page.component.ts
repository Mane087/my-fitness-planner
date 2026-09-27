import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Placeholder for routes whose feature is planned but not built yet. The title comes from route data. */
@Component({
  selector: 'app-coming-soon-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-[60svh] items-center justify-center px-4 py-16 text-slate-50">
      <div class="max-w-md text-center">
        <h1 class="mb-4 text-3xl font-bold">{{ title() }}</h1>
        <p class="mb-8 text-slate-400">Esta funcionalidad estará disponible próximamente.</p>
        <a
          routerLink="/calendar"
          class="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"
        >
          Volver al calendario
        </a>
      </div>
    </main>
  `,
})
export class ComingSoonPageComponent {
  readonly title = input('Funcionalidad no disponible');
}
