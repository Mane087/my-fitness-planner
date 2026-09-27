import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DomainValidationError } from '../../src/app/core/domain/domain-validation.error';
import type { TrainingZoneSetEntity } from '../../src/app/core/domain/schemas/training-zone-set.schema';
import { IntensityMetric, Sport, type ZoneMetric } from '../../src/app/core/domain/workout.enums';
import { TrainingZoneSetService } from '../../src/app/core/services/training-zone-set.service';
import { ZoneSetEditorComponent } from '../../src/app/pages/profile-settings-page/zone-set-editor.component';
import { heartRateZoneSet } from '../domain/fixtures';

function paceZoneSet(): TrainingZoneSetEntity {
  return heartRateZoneSet({
    sport: 'running',
    metric: 'pace',
    referenceValue: 300,
    zones: [
      { id: 'z1', name: 'Z1', minValue: 387, maxValue: 480, sortOrder: 1 },
      { id: 'z2', name: 'Z2', minValue: 342, maxValue: 387, sortOrder: 2 },
      { id: 'z3', name: 'Z3', minValue: 318, maxValue: 342, sortOrder: 3 },
    ],
  });
}

@Component({
  imports: [ZoneSetEditorComponent],
  template: `
    <app-zone-set-editor
      [sport]="sport()"
      [metric]="metric()"
      [zoneSet]="zoneSet()"
      [suggestedReference]="suggestedReference()"
      (saved)="saved.push($event)"
      (deleted)="deleted.push($event)"
    />
  `,
})
class EditorHostComponent {
  readonly sport = signal<Sport>(Sport.Cycling);
  readonly metric = signal<ZoneMetric>(IntensityMetric.HeartRate);
  readonly zoneSet = signal<TrainingZoneSetEntity | null>(heartRateZoneSet());
  readonly suggestedReference = signal<number | null>(null);
  readonly saved: TrainingZoneSetEntity[] = [];
  readonly deleted: string[] = [];
}

describe('ZoneSetEditorComponent', () => {
  let fixture: ComponentFixture<EditorHostComponent>;
  let host: EditorHostComponent;
  let element: HTMLElement;
  let service: jest.Mocked<
    Pick<TrainingZoneSetService, 'getOrSeed' | 'save' | 'delete' | 'regenerateFromReference'>
  >;

  beforeEach(async () => {
    service = {
      getOrSeed: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      regenerateFromReference: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: TrainingZoneSetService, useValue: service }],
    });
    fixture = TestBed.createComponent(EditorHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await render();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
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

  function fieldByLabel(label: string, root: ParentNode = element): HTMLInputElement {
    const match = root.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
    if (!match) throw new Error(`No existe el campo "${label}".`);
    return match;
  }

  async function change(label: string, value: string): Promise<void> {
    const input = fieldByLabel(label);
    input.value = value;
    input.dispatchEvent(new Event('change'));
    await render();
  }

  function referenceInput(): HTMLInputElement {
    const match = element.querySelector<HTMLInputElement>('input[id$="-reference"]');
    if (!match) throw new Error('No existe el input de referencia.');
    return match;
  }

  async function setReference(value: string): Promise<void> {
    const input = referenceInput();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await render();
  }

  function dialog(): HTMLElement {
    const match = element.querySelector<HTMLElement>('[role="dialog"]');
    if (!match) throw new Error('No hay diálogo abierto.');
    return match;
  }

  function alertText(): string {
    return element.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
  }

  it('renderiza una fila por zona con los límites de frecuencia cardiaca', () => {
    expect(fieldByLabel('Desde zona 1 (ppm)').value).toBe('97');
    expect(fieldByLabel('Hasta zona 1 (ppm)').value).toBe('116');
    expect(fieldByLabel('Desde zona 2 (ppm)').value).toBe('116');
    expect(fieldByLabel('Hasta zona 2 (ppm)').value).toBe('135');
  });

  it('habilita Guardar zonas al editar un límite y enlaza el límite de la zona siguiente', async () => {
    expect(button('Guardar zonas').disabled).toBe(true);

    await change('Hasta zona 1 (ppm)', '120');

    expect(button('Guardar zonas').disabled).toBe(false);
    expect(fieldByLabel('Desde zona 2 (ppm)').value).toBe('120');
  });

  it('guarda las zonas con los valores actualizados y el orden consecutivo', async () => {
    service.save.mockImplementation(async (zoneSet) => zoneSet);
    await change('Hasta zona 1 (ppm)', '120');

    await click('Guardar zonas');

    expect(service.save).toHaveBeenCalledTimes(1);
    const saved = service.save.mock.calls[0][0];
    expect(saved.zones[0]).toMatchObject({ maxValue: 120, sortOrder: 1 });
    expect(saved.zones[1]).toMatchObject({ minValue: 120, sortOrder: 2 });
    expect(saved.zones[2]).toMatchObject({ sortOrder: 3 });
    expect(host.saved).toEqual([saved]);
    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe('Zonas guardadas.');
  });

  describe('con métrica de ritmo', () => {
    beforeEach(async () => {
      host.sport.set(Sport.Running);
      host.metric.set(IntensityMetric.Pace);
      host.zoneSet.set(paceZoneSet());
      await render();
    });

    it('muestra el ritmo en formato m:ss', () => {
      expect(fieldByLabel('Desde zona 1 (min/km)').value).toBe('8:00');
      expect(fieldByLabel('Hasta zona 1 (min/km)').value).toBe('6:27');
    });

    it('actualiza el límite y enlaza la zona siguiente al capturar un ritmo válido', async () => {
      await change('Hasta zona 1 (min/km)', '6:15');

      expect(fieldByLabel('Hasta zona 1 (min/km)').value).toBe('6:15');
      expect(fieldByLabel('Desde zona 2 (min/km)').value).toBe('6:15');
    });

    it('rechaza un ritmo con formato inválido y no modifica la zona', async () => {
      await change('Hasta zona 1 (min/km)', '6.15');

      expect(alertText()).toBe('Usa el formato m:ss para el ritmo, por ejemplo 4:30.');
      // La zona 2 solo cambia cuando el valor capturado es válido: al seguir en "6:27"
      // confirmamos que el modelo no se tocó (el campo editado no se puede usar para
      // verificarlo: Angular no reescribe el DOM cuando el valor enlazado no cambia).
      expect(fieldByLabel('Desde zona 2 (min/km)').value).toBe('6:27');
    });
  });

  it('agrega una zona que empieza donde termina la última', async () => {
    await click('Agregar zona');

    expect(fieldByLabel('Desde zona 4 (ppm)').value).toBe('154');
    expect(fieldByLabel('Hasta zona 4 (ppm)').value).toBe('173');
  });

  it('elimina una zona y la siguiente toma su inicio; deshabilita el botón con una sola zona', async () => {
    await click('Eliminar zona 2');

    expect(element.querySelectorAll('[aria-label^="Desde zona"]')).toHaveLength(2);
    expect(fieldByLabel('Desde zona 2 (ppm)').value).toBe('116');
    expect(fieldByLabel('Hasta zona 2 (ppm)').value).toBe('154');

    await click('Eliminar zona 1');

    expect(element.querySelectorAll('[aria-label^="Desde zona"]')).toHaveLength(1);
    expect(button('Eliminar zona 1').disabled).toBe(true);
  });

  describe('sin zonas configuradas', () => {
    beforeEach(async () => {
      host.zoneSet.set(null);
      await render();
    });

    it('muestra el estado vacío y precarga la referencia sugerida', async () => {
      host.suggestedReference.set(185);
      await render();

      expect(element.textContent).toContain('Sin zonas configuradas');
      expect(button('Crear zonas')).not.toBeNull();
      expect(referenceInput().value).toBe('185');

      service.getOrSeed.mockImplementation(async () => heartRateZoneSet());
      await click('Crear zonas');

      expect(service.getOrSeed).toHaveBeenCalledWith('cycling', 'heart_rate', 185);
      expect(host.saved).toHaveLength(1);
    });

    it('no crea las zonas cuando la referencia está vacía', async () => {
      await click('Crear zonas');

      expect(alertText()).toContain('Captura la referencia');
      expect(service.getOrSeed).not.toHaveBeenCalled();
    });
  });

  it('recalcula las zonas desde la referencia tras confirmar en el diálogo', async () => {
    service.regenerateFromReference.mockImplementation(async () => heartRateZoneSet());

    await setReference('185');
    await click('Recalcular desde la referencia');
    expect(dialog()).not.toBeNull();

    await click('Recalcular zonas', dialog());

    expect(service.regenerateFromReference).toHaveBeenCalledWith('zone-set-hr', 185);
    expect(host.saved).toHaveLength(1);
  });

  it('cancela el recálculo sin llamar al servicio', async () => {
    await click('Recalcular desde la referencia');
    await click('Cancelar', dialog());

    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(service.regenerateFromReference).not.toHaveBeenCalled();
  });

  it('elimina las zonas al confirmar en el diálogo', async () => {
    service.delete.mockImplementation(async () => undefined);

    await click('Eliminar zonas');
    await click('Eliminar zonas', dialog());

    expect(service.delete).toHaveBeenCalledWith('zone-set-hr');
    expect(host.deleted).toEqual(['zone-set-hr']);
  });

  it('muestra el error cuando las zonas están en uso y no emite deleted', async () => {
    service.delete.mockImplementation(async () => {
      throw new Error(
        'No puedes eliminar estas zonas porque hay entrenamientos o plantillas que las usan.',
      );
    });

    await click('Eliminar zonas');
    await click('Eliminar zonas', dialog());

    expect(alertText()).toBe(
      'No puedes eliminar estas zonas porque hay entrenamientos o plantillas que las usan.',
    );
    expect(host.deleted).toEqual([]);
  });

  it('muestra el error de esquema con el número de zona visible', async () => {
    service.save.mockImplementation(async () => {
      throw new DomainValidationError('Training zone set', [
        {
          code: 'custom',
          message: 'Cada zona debe empezar donde termina la anterior.',
          path: ['zones', 1, 'minValue'],
          input: undefined,
        } as never,
      ]);
    });

    await change('Hasta zona 1 (ppm)', '120');
    await click('Guardar zonas');

    expect(alertText()).toBe('Zona 2: Cada zona debe empezar donde termina la anterior.');
  });
});
