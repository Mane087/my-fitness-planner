import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ComingSoonPageComponent } from './coming-soon-page.component';

describe('ComingSoonPageComponent', () => {
  it('shows the title from the route data', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'library',
              component: ComingSoonPageComponent,
              data: { title: 'Biblioteca de entrenamientos' },
            },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/library');

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(
      'Biblioteca de entrenamientos',
    );
  });
});
