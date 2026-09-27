import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { TrainingZoneSetEntity } from '../../src/app/core/domain/schemas/training-zone-set.schema';
import type {
  IntervalStep,
  RepeatStep,
  WorkoutStep,
} from '../../src/app/core/domain/schemas/workout-step.schema';
import { IntensityMetric, Sport } from '../../src/app/core/domain/workout.enums';
import { WorkoutStepEditorComponent } from '../../src/app/components/workout-step-editor/workout-step-editor.component';
import {
  cyclingDefinition,
  exercise,
  heartRateZoneSet,
  interval,
  repeat,
} from '../domain/fixtures';

@Component({
  imports: [WorkoutStepEditorComponent],
  template: `
    <app-workout-step-editor
      [(steps)]="steps"
      [sport]="sport()"
      [primaryMetric]="metric()"
      [zoneSet]="zoneSet()"
      [showErrors]="showErrors()"
    />
  `,
})
class EditorHostComponent {
  readonly steps = signal<WorkoutStep[]>([]);
  readonly sport = signal<Sport | null>(Sport.Cycling);
  readonly metric = signal<IntensityMetric | null>(IntensityMetric.HeartRate);
  readonly zoneSet = signal<TrainingZoneSetEntity | null>(heartRateZoneSet());
  readonly showErrors = signal(false);
}

describe('WorkoutStepEditorComponent', () => {
  let fixture: ComponentFixture<EditorHostComponent>;
  let host: EditorHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(EditorHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await render();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function button(label: string, root: ParentNode = element): HTMLButtonElement {
    const match = Array.from(root.querySelectorAll('button')).find(
      (candidate) =>
        candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label,
    );
    if (!match) throw new Error(`No existe el botón "${label}".`);
    return match;
  }

  async function click(label: string, root?: ParentNode): Promise<void> {
    button(label, root).click();
    await render();
  }

  function legends(): string[] {
    return Array.from(element.querySelectorAll('legend')).map(
      (legend) => legend.textContent?.trim() ?? '',
    );
  }

  function field<T extends HTMLElement>(id: string): T | null {
    return element.querySelector<T>(`#${id}`);
  }

  async function setSteps(steps: WorkoutStep[]): Promise<void> {
    host.steps.set(steps);
    await render();
  }

  it('muestra el estado vacío sin pasos', () => {
    expect(element.textContent).toContain('Todavía no hay pasos.');
    expect(element.querySelector('[data-testid="steps-summary"]')?.textContent).toContain(
      '0 pasos · 0 min',
    );
  });

  it('agrega intervalos, ejercicios y repeticiones al final de la lista', async () => {
    await click('Agregar intervalo');
    await click('Agregar ejercicio');
    await click('Agregar repetición');

    expect(host.steps().map((step) => step.kind)).toEqual(['interval', 'exercise', 'repeat']);
    expect(legends()).toEqual([
      'Paso 1 · Intervalo',
      'Paso 2 · Ejercicio',
      'Paso 3 · Repetición',
      'Paso 3.1 · Intervalo',
    ]);
  });

  it('agrega pasos dentro de una repetición sin permitir otra repetición anidada', async () => {
    await setSteps([repeat('main')]);
    const group = element.querySelector('fieldset') as HTMLFieldSetElement;

    await click('+ Ejercicio en la repetición', group);

    const [updated] = host.steps() as RepeatStep[];
    expect(updated.steps.map((step) => step.kind)).toEqual(['interval', 'interval', 'exercise']);
    expect(legends()).toContain('Paso 1.3 · Ejercicio');
    expect(
      Array.from(group.querySelectorAll('button')).map((b) => b.textContent?.trim()),
    ).not.toContain('Agregar repetición');
  });

  it('actualiza el número de repeticiones del grupo', async () => {
    await setSteps([repeat('main')]);
    const input = field<HTMLInputElement>('repeat-main') as HTMLInputElement;

    input.value = '5';
    input.dispatchEvent(new Event('input'));
    await render();

    expect((host.steps()[0] as RepeatStep).repetitions).toBe(5);
    // 5 × (300 s + 120 s) = 35 min
    expect(element.querySelector('[data-testid="steps-summary"]')?.textContent).toContain(
      '2 pasos · 35 min',
    );
  });

  it('reordena los pasos y deshabilita los movimientos fuera de la lista', async () => {
    await setSteps([interval('first'), interval('second')]);

    expect(button('Subir paso 1').disabled).toBe(true);
    expect(button('Bajar paso 2').disabled).toBe(true);

    await click('Bajar paso 1');

    expect(host.steps().map((step) => step.id)).toEqual(['second', 'first']);
  });

  it('reordena los pasos dentro de una repetición', async () => {
    await setSteps([repeat('main')]);

    await click('Bajar paso 1.1');

    const [updated] = host.steps() as RepeatStep[];
    expect(updated.steps.map((step) => step.id)).toEqual(['main-rest', 'main-work']);
  });

  it('elimina pasos de la lista y de una repetición', async () => {
    await setSteps([interval('warm-up'), repeat('main')]);

    await click('Eliminar paso 2.1');
    await click('Eliminar paso 1');

    expect(host.steps()).toHaveLength(1);
    expect((host.steps()[0] as RepeatStep).steps.map((step) => step.id)).toEqual(['main-rest']);

    await click('Eliminar repetición 1');

    expect(host.steps()).toEqual([]);
  });

  it('calcula el resumen con las repeticiones del entrenamiento', async () => {
    await setSteps(cyclingDefinition().steps);

    expect(element.querySelector('[data-testid="steps-summary"]')?.textContent).toContain(
      '4 pasos · 46 min',
    );
    expect(element.querySelector('figure')).not.toBeNull();
  });

  it('avisa cuando hay pasos sin tiempo fijo', async () => {
    await setSteps([interval('long', { duration: { type: 'distance', meters: 5000 } })]);

    expect(element.querySelector('[role="note"]')?.textContent).toContain('duración estimada');
    expect(element.querySelector('[data-testid="steps-summary"]')?.textContent).toContain('5 km');
  });

  describe('objetivo de intensidad', () => {
    it('muestra las zonas del set y guarda el snapshot de la zona elegida', async () => {
      await setSteps([interval('work', { target: undefined })]);
      const select = field<HTMLSelectElement>('step-work-zone') as HTMLSelectElement;

      expect(Array.from(select.options).map((option) => option.value)).toEqual([
        '',
        'z1',
        'z2',
        'z3',
      ]);
      expect(field('step-work-rpe')).toBeNull();

      select.value = 'z3';
      select.dispatchEvent(new Event('change'));
      await render();

      expect((host.steps()[0] as IntervalStep).target).toEqual({
        metric: 'heart_rate',
        zoneId: 'z3',
        zoneSnapshot: {
          zoneSetId: 'zone-set-hr',
          zoneId: 'z3',
          name: 'Z3',
          metric: 'heart_rate',
          minValue: 135,
          maxValue: 154,
        },
      });
    });

    it('muestra un valor RPE cuando la métrica es RPE', async () => {
      host.metric.set(IntensityMetric.Rpe);
      host.zoneSet.set(null);
      await setSteps([interval('work', { target: undefined })]);
      const input = field<HTMLInputElement>('step-work-rpe') as HTMLInputElement;

      expect(field('step-work-zone')).toBeNull();

      input.value = '7';
      input.dispatchEvent(new Event('input'));
      await render();

      expect((host.steps()[0] as IntervalStep).target).toEqual({ metric: 'rpe', value: 7 });
    });

    it('enlaza al perfil cuando la métrica usa zonas y no hay un set configurado', async () => {
      host.zoneSet.set(null);
      await setSteps([interval('work', { target: undefined })]);

      const link = element.querySelector<HTMLAnchorElement>('a[href="/profile"]');
      expect(link?.textContent).toContain('Configúralas');
      expect(field('step-work-zone')).toBeNull();
    });

    it('muestra la cadencia solo en ciclismo', async () => {
      await setSteps([interval('work')]);
      expect(field('step-work-cadence-min')).not.toBeNull();

      host.sport.set(Sport.Running);
      await render();

      expect(field('step-work-cadence-min')).toBeNull();
    });
  });

  it('muestra los errores de cada paso solo cuando se solicitan', async () => {
    await setSteps([interval('work', { name: '' }), exercise('jumps', { sets: 0 })]);

    expect(element.querySelectorAll('[role="alert"]')).toHaveLength(0);

    host.showErrors.set(true);
    await render();

    const alerts = Array.from(element.querySelectorAll('[role="alert"]')).map(
      (alert) => alert.textContent?.trim() ?? '',
    );
    expect(alerts).toEqual([
      expect.stringContaining('El nombre del paso es requerido.'),
      expect.stringContaining('Las series deben ser al menos 1.'),
    ]);
  });
});
