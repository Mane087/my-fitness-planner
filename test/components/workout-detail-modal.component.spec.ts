import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { ScheduledWorkoutEntity } from '../../src/app/core/domain/schemas/scheduled-workout.schema';
import { CalendarDateService } from '../../src/app/core/services/calendar-date.service';
import { WorkoutCompletionService } from '../../src/app/core/services/workout-completion.service';
import { WorkoutDetailModalComponent } from '../../src/app/pages/calendar/workout-detail-modal.component';
import { scheduledWorkout } from '../domain/fixtures';

@Component({
  imports: [WorkoutDetailModalComponent],
  template: `
    <app-workout-detail-modal
      [workout]="workout()"
      (changed)="changed.push($event)"
      (edit)="edited.push($event)"
      (closed)="closedCount = closedCount + 1"
    />
  `,
})
class DetailHostComponent {
  readonly workout = signal<ScheduledWorkoutEntity | null>(null);
  readonly changed: ScheduledWorkoutEntity[] = [];
  readonly edited: string[] = [];
  closedCount = 0;
}

describe('WorkoutDetailModalComponent', () => {
  let fixture: ComponentFixture<DetailHostComponent>;
  let host: DetailHostComponent;
  let element: HTMLElement;
  let dateService: CalendarDateService;
  let completionService: {
    complete: jest.Mock;
    skip: jest.Mock;
    reopen: jest.Mock;
  };

  beforeEach(() => {
    completionService = {
      complete: jest.fn(),
      skip: jest.fn(),
      reopen: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: WorkoutCompletionService, useValue: completionService }],
    });

    fixture = TestBed.createComponent(DetailHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    dateService = TestBed.inject(CalendarDateService);
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function setToday(date: string): void {
    jest.spyOn(dateService, 'today').mockReturnValue(date);
  }

  function dialog(): HTMLElement | null {
    return element.querySelector('[role="dialog"]');
  }

  function testId(id: string): string {
    return element.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? '';
  }

  function alertText(): string {
    return element.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
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

  async function click(label: string): Promise<void> {
    button(label).click();
    await render();
  }

  function durationInput(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('#completion-duration')!;
  }

  function distanceInput(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('#completion-distance')!;
  }

  function rpeInput(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('#completion-rpe')!;
  }

  function notesInput(): HTMLTextAreaElement {
    return element.querySelector<HTMLTextAreaElement>('#completion-notes')!;
  }

  function feelingRadio(value: number): HTMLInputElement {
    return element.querySelectorAll<HTMLInputElement>('input[name="completion-feeling"]')[
      value - 1
    ];
  }

  async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await render();
  }

  async function chooseFeeling(value: number): Promise<void> {
    const radio = feelingRadio(value);
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    await render();
  }

  it('no renderiza el diálogo cuando no hay entrenamiento', async () => {
    await render();

    expect(dialog()).toBeNull();
  });

  it('muestra el título, lo planeado, el estado y los botones de un entrenamiento planeado', async () => {
    setToday('2026-10-01');
    host.workout.set(scheduledWorkout());
    await render();

    expect(dialog()).not.toBeNull();
    expect(element.querySelector('h3')?.textContent?.trim()).toBe('Rodada con intervalos');
    expect(testId('workout-status')).toBe('Planeado');
    expect(element.textContent).toContain('46 min');
    expect(button('Editar')).not.toBeNull();
    expect(button('Omitir')).not.toBeNull();
    expect(button('Completar')).not.toBeNull();
  });

  describe('cuando el entrenamiento ya pasó', () => {
    beforeEach(async () => {
      setToday('2026-10-01');
      host.workout.set(scheduledWorkout());
      await render();
    });

    it('abre el formulario de completar directamente y precarga la duración planeada', async () => {
      await click('Completar');

      expect(dialog()).not.toBeNull();
      expect(durationInput().value).toBe('46');
      expect(distanceInput().value).toBe('');
    });

    it('precarga la distancia real cuando hay distancia planeada', async () => {
      host.workout.set(scheduledWorkout({ plannedDistanceMeters: 20000 }));
      await render();

      await click('Completar');

      expect(distanceInput().value).toBe('20');
    });

    it('guarda el registro con los datos capturados y regresa al detalle', async () => {
      const saved = scheduledWorkout({ status: 'completed' });
      completionService.complete.mockImplementation(async () => saved);

      await click('Completar');
      await type(rpeInput(), '7');
      await chooseFeeling(4);
      await type(notesInput(), 'Buen ritmo');
      await click('Guardar registro');

      expect(completionService.complete).toHaveBeenCalledWith('workout-1', {
        durationSeconds: 2760,
        rpe: 7,
        feeling: 4,
        notes: 'Buen ritmo',
      });
      expect(host.changed).toEqual([saved]);
      expect(findButton('Guardar registro')).toBeNull();
      expect(button('Completar')).not.toBeNull();
    });

    it('valida que el RPE esté entre 1 y 10 y no llama a complete', async () => {
      await click('Completar');
      await type(rpeInput(), '11');

      await click('Guardar registro');

      expect(alertText()).toBe('El RPE debe estar entre 1 y 10.');
      expect(completionService.complete).not.toHaveBeenCalled();
    });

    it('quita el error del intento anterior al corregir un campo', async () => {
      await click('Completar');
      await type(rpeInput(), '11');
      await click('Guardar registro');

      await type(rpeInput(), '7');

      expect(alertText()).toBe('');
    });
  });

  describe('cuando el entrenamiento es futuro', () => {
    beforeEach(async () => {
      setToday('2026-09-27');
      host.workout.set(scheduledWorkout());
      await render();
    });

    it('pide confirmación antes de completar un entrenamiento futuro', async () => {
      await click('Completar');

      expect(element.querySelector('[role="note"]')).not.toBeNull();
      expect(findButton('Duración real (min)')).toBeNull();
    });

    it('cancela la confirmación y puede confirmarla después para abrir el formulario', async () => {
      await click('Completar');
      await click('Cancelar');

      expect(element.querySelector('[role="note"]')).toBeNull();
      expect(button('Completar')).not.toBeNull();

      await click('Completar');
      await click('Sí, registrar');

      expect(durationInput()).not.toBeNull();
    });
  });

  describe('cuando el entrenamiento está completado', () => {
    beforeEach(async () => {
      setToday('2026-10-01');
      host.workout.set(
        scheduledWorkout({
          status: 'completed',
          completion: {
            completedAt: '2026-09-28T10:00:00.000Z',
            durationSeconds: 3000,
            rpe: 8,
          },
        }),
      );
      await render();
    });

    it('muestra lo realizado, el botón Reabrir y precarga el formulario de actualización', async () => {
      expect(testId('workout-actual')).toContain('50 min');
      expect(button('Reabrir')).not.toBeNull();
      expect(findButton('Omitir')).toBeNull();

      completionService.reopen.mockImplementation(async () => scheduledWorkout());
      await click('Reabrir');

      expect(completionService.reopen).toHaveBeenCalledWith('workout-1');
      expect(host.changed).toHaveLength(1);
    });

    it('precarga el formulario de actualización con la duración y el RPE registrados', async () => {
      await click('Actualizar registro');

      expect(durationInput().value).toBe('50');
      expect(rpeInput().value).toBe('8');
    });
  });

  it('no pide confirmación al actualizar el registro de un entrenamiento completado futuro', async () => {
    setToday('2026-09-27');
    host.workout.set(
      scheduledWorkout({
        status: 'completed',
        completion: { completedAt: '2026-09-28T10:00:00.000Z', durationSeconds: 3000, rpe: 8 },
      }),
    );
    await render();

    await click('Actualizar registro');

    expect(element.querySelector('[role="note"]')).toBeNull();
    expect(durationInput()).not.toBeNull();
  });

  it('omite el entrenamiento y emite changed', async () => {
    setToday('2026-10-01');
    host.workout.set(scheduledWorkout());
    await render();
    const saved = scheduledWorkout({ status: 'skipped' });
    completionService.skip.mockImplementation(async () => saved);

    await click('Omitir');

    expect(completionService.skip).toHaveBeenCalledWith('workout-1');
    expect(host.changed).toEqual([saved]);
  });

  it('muestra el error cuando Omitir falla y no emite changed', async () => {
    setToday('2026-10-01');
    host.workout.set(scheduledWorkout());
    await render();
    completionService.skip.mockImplementation(async () => {
      throw new Error('El entrenamiento no existe.');
    });

    await click('Omitir');

    expect(alertText()).toBe('El entrenamiento no existe.');
    expect(host.changed).toEqual([]);
  });

  it('emite edit al hacer clic en Editar y closed al cerrar el detalle', async () => {
    setToday('2026-10-01');
    host.workout.set(scheduledWorkout());
    await render();

    await click('Editar');
    expect(host.edited).toEqual(['workout-1']);

    await click('Cerrar detalle');
    expect(host.closedCount).toBe(1);
  });
});
