import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import type { WorkoutTemplateCardViewModel } from '../../src/app/core/models/library-view-models';
import { LibraryFacade } from '../../src/app/pages/library/library.facade';
import { LibraryPageComponent } from '../../src/app/pages/library/library-page.component';
import { scheduledWorkout } from '../domain/fixtures';

function template(
  overrides: Partial<WorkoutTemplateCardViewModel> = {},
): WorkoutTemplateCardViewModel {
  return {
    id: 'template-1',
    title: 'Series de umbral',
    sport: 'cycling',
    sportLabel: 'Ciclismo Ruta',
    category: 'threshold',
    categoryLabel: 'Umbral',
    colorClass: 'border-l-red-500',
    durationLabel: '46 min',
    distanceLabel: '-- km',
    stepCountLabel: '4 pasos',
    objective: null,
    isArchived: false,
    ...overrides,
  };
}

describe('LibraryPageComponent', () => {
  let fixture: ComponentFixture<LibraryPageComponent>;
  let element: HTMLElement;
  let facade: {
    loadTemplates: jest.Mock;
    hasTemplates: jest.Mock;
    archive: jest.Mock;
    restore: jest.Mock;
    schedule: jest.Mock;
    today: jest.Mock;
  };

  /**
   * The component loads its templates in its constructor, so the initial `loadTemplates`/
   * `hasTemplates` results must be set here, before the fixture (and the component) is created.
   */
  function configure(
    options: {
      saved?: string;
      hasTemplates?: boolean;
      templates?: WorkoutTemplateCardViewModel[];
      loadTemplatesThrows?: boolean;
    } = {},
  ): void {
    facade = {
      loadTemplates: jest.fn().mockImplementation(async () => {
        if (options.loadTemplatesThrows) throw new Error('x');
        return options.templates ?? [];
      }),
      hasTemplates: jest.fn().mockImplementation(async () => options.hasTemplates ?? false),
      archive: jest.fn().mockImplementation(async () => undefined),
      restore: jest.fn().mockImplementation(async () => undefined),
      schedule: jest.fn().mockImplementation(async () => scheduledWorkout()),
      today: jest.fn().mockImplementation(() => '2026-09-30'),
    };

    TestBed.configureTestingModule({
      imports: [LibraryPageComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: facade },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(options.saved ? { saved: options.saved } : {}),
            },
          },
        },
      ],
    });

    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(LibraryPageComponent);
    element = fixture.nativeElement;
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const match = Array.from(element.querySelectorAll('button')).find(
      (candidate) =>
        candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label,
    );
    if (!match) throw new Error(`No existe el botón "${label}".`);
    return match;
  }

  function findButton(label: string): HTMLButtonElement | null {
    return (
      Array.from(element.querySelectorAll('button')).find(
        (candidate) =>
          candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label,
      ) ?? null
    );
  }

  function link(label: string): HTMLAnchorElement {
    const match = Array.from(element.querySelectorAll('a')).find(
      (candidate) =>
        candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label,
    );
    if (!match) throw new Error(`No existe el enlace "${label}".`);
    return match;
  }

  async function click(label: string): Promise<void> {
    button(label).click();
    await render();
  }

  function statusText(): string {
    return element.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  }

  function alertText(): string {
    return element.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
  }

  function dialog(): HTMLElement | null {
    return element.querySelector('[role="dialog"]');
  }

  /**
   * The dialog's own "Programar" button shares its label with the card's "Programar <title>"
   * button (whose visible text is also just "Programar"), so the lookup must be scoped to the
   * dialog.
   */
  async function clickInDialog(label: string): Promise<void> {
    const scope = dialog();
    if (!scope) throw new Error('No hay diálogo abierto.');
    const match = Array.from(scope.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!match) throw new Error(`No existe el botón "${label}" en el diálogo.`);
    match.click();
    await render();
  }

  function dateInput(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('#schedule-date')!;
  }

  async function selectValue(id: string, value: string): Promise<void> {
    const select = element.querySelector<HTMLSelectElement>(`#${id}`)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await render();
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('muestra el estado vacío y el enlace para crear la primera plantilla', async () => {
    configure();
    await render();

    expect(element.textContent).toContain('Todavía no tienes plantillas');
    expect(link('Crear la primera plantilla').getAttribute('href')).toBe('/library/new');
    expect(element.querySelector('[role="search"]')).toBeNull();
  });

  it('carga las plantillas sin filtros y renderiza una tarjeta por plantilla', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    await render();

    expect(facade.loadTemplates).toHaveBeenCalledWith({
      sport: null,
      category: null,
      shouldIncludeArchived: false,
    });
    expect(element.querySelectorAll('article')).toHaveLength(1);
    expect(element.textContent).toContain('Series de umbral');
    expect(element.textContent).toContain('Ciclismo Ruta · Umbral');
    expect(element.textContent).toContain('46 min · -- km · 4 pasos');
    expect(button('Programar Series de umbral')).not.toBeNull();
    expect(link('Editar Series de umbral')).not.toBeNull();
    expect(link('Editar Series de umbral').getAttribute('href')).toBe('/library/edit/template-1');
    expect(button('Archivar Series de umbral')).not.toBeNull();
  });

  it('muestra el mensaje de filtros vacíos cuando la biblioteca tiene plantillas pero el filtro no arroja resultados', async () => {
    configure({ hasTemplates: true, templates: [] });
    await render();

    expect(element.textContent).toContain('No hay plantillas con estos filtros.');
  });

  it('recarga con el deporte seleccionado al cambiar el select de Deporte', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    await render();

    await selectValue('library-sport', 'running');

    expect(facade.loadTemplates).toHaveBeenLastCalledWith({
      sport: 'running',
      category: null,
      shouldIncludeArchived: false,
    });
  });

  it('reinicia la categoría cuando el nuevo deporte no la incluye', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    await render();

    await selectValue('library-category', 'technique');
    await selectValue('library-sport', 'mobility');

    expect(facade.loadTemplates).toHaveBeenLastCalledWith({
      sport: 'mobility',
      category: null,
      shouldIncludeArchived: false,
    });
  });

  it('recarga incluyendo archivadas al marcar "Mostrar archivadas"', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    await render();

    const checkbox = element.querySelector<HTMLInputElement>('#library-archived')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await render();

    expect(facade.loadTemplates).toHaveBeenLastCalledWith({
      sport: null,
      category: null,
      shouldIncludeArchived: true,
    });
  });

  it('muestra una plantilla archivada sin botón Programar y la restaura', async () => {
    configure({ hasTemplates: true, templates: [template({ isArchived: true })] });
    await render();

    expect(element.textContent).toContain('Archivada');
    expect(findButton('Programar Series de umbral')).toBeNull();

    await click('Restaurar Series de umbral');

    expect(facade.restore).toHaveBeenCalledWith('template-1');
    expect(statusText()).toBe('Se restauró "Series de umbral".');
  });

  it('archiva una plantilla y muestra el aviso sobre los entrenamientos ya programados', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    await render();

    await click('Archivar Series de umbral');

    expect(facade.archive).toHaveBeenCalledWith('template-1');
    expect(statusText()).toBe(
      'Se archivó "Series de umbral". Los entrenamientos ya programados no cambian.',
    );
  });

  it('abre el diálogo de programar con la fecha de hoy precargada y programa la plantilla', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    facade.schedule.mockImplementation(async () =>
      scheduledWorkout({ scheduledDate: '2026-10-05' }),
    );
    await render();

    await click('Programar Series de umbral');

    expect(dialog()).not.toBeNull();
    expect(dateInput().value).toBe('2026-09-30');

    dateInput().value = '2026-10-05';
    dateInput().dispatchEvent(new Event('input'));
    await render();
    await clickInDialog('Programar');

    expect(facade.schedule).toHaveBeenCalledWith('template-1', '2026-10-05');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/calendar'], {
      queryParams: { date: '2026-10-05', saved: 'scheduled' },
    });
  });

  it('muestra un error y no llama a schedule cuando la fecha está vacía', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    await render();

    await click('Programar Series de umbral');
    dateInput().value = '';
    dateInput().dispatchEvent(new Event('input'));
    await render();
    await clickInDialog('Programar');

    expect(alertText()).toBe('Selecciona la fecha del entrenamiento.');
    expect(facade.schedule).not.toHaveBeenCalled();
  });

  it('muestra un error cuando schedule falla y mantiene el diálogo abierto', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    facade.schedule.mockImplementation(async () => {
      throw new Error('x');
    });
    await render();

    await click('Programar Series de umbral');
    await clickInDialog('Programar');

    expect(alertText()).toBe('No se pudo programar la plantilla. Intenta nuevamente.');
    expect(dialog()).not.toBeNull();
  });

  it('cierra el diálogo de programar con Cancelar', async () => {
    configure({ hasTemplates: true, templates: [template()] });
    await render();

    await click('Programar Series de umbral');
    await click('Cancelar');

    expect(dialog()).toBeNull();
  });

  it('muestra el mensaje de guardado correctamente cuando el query param saved es created', async () => {
    configure({ saved: 'created' });
    await render();

    expect(statusText()).toBe('Plantilla guardada correctamente.');
  });

  it('muestra un error cuando loadTemplates falla', async () => {
    configure({ loadTemplatesThrows: true });
    await render();

    expect(alertText()).toBe('No se pudo cargar la biblioteca. Intenta nuevamente.');
  });
});
