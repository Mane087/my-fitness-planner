import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';

import { readText, withOptional } from '../../components/workout-step-editor/step-input.utils';
import { DomainValidationError } from '../../core/domain/domain-validation.error';
import { createId } from '../../core/domain/entity-utils';
import type {
  TrainingZone,
  TrainingZoneSetEntity,
} from '../../core/domain/schemas/training-zone-set.schema';
import { IntensityMetric, type Sport, type ZoneMetric } from '../../core/domain/workout.enums';
import { INTENSITY_METRIC_LABELS, SPORT_LABELS } from '../../core/models/workout-labels';
import { formatZoneValue, parsePace } from '../../core/models/zone-format';
import { cloneValue } from '../../core/repositories/repository-utils';
import { TrainingZoneSetService } from '../../core/services/training-zone-set.service';
import { ModalComponent } from '../../layouts/modal/modal.component';

type PendingAction = 'regenerate' | 'delete';

const REFERENCE_LABELS: Record<ZoneMetric, string> = {
  [IntensityMetric.HeartRate]: 'FC máxima (ppm)',
  [IntensityMetric.Power]: 'FTP (W)',
  [IntensityMetric.Pace]: 'Ritmo umbral (min/km)',
};

const VALUE_UNITS: Record<ZoneMetric, string> = {
  [IntensityMetric.HeartRate]: 'ppm',
  [IntensityMetric.Power]: 'W',
  [IntensityMetric.Pace]: 'min/km',
};

const DEFAULT_ZONE_WIDTH = 10;

/**
 * Edits one zone set. Each zone is shown by intensity: it starts where the previous zone ends.
 * For pace the start is the slower value (`maxValue`) and the end the faster one (`minValue`).
 */
@Component({
  selector: 'app-zone-set-editor',
  imports: [ModalComponent],
  templateUrl: './zone-set-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoneSetEditorComponent {
  private readonly zoneSetService = inject(TrainingZoneSetService);

  readonly sport = input.required<Sport>();
  readonly metric = input.required<ZoneMetric>();
  readonly zoneSet = input<TrainingZoneSetEntity | null>(null);
  /** Reference shown when the set does not exist yet, e.g. the max HR of the profile. */
  readonly suggestedReference = input<number | null>(null);

  readonly saved = output<TrainingZoneSetEntity>();
  readonly deleted = output<string>();

  readonly zones = linkedSignal(() => cloneValue(this.zoneSet()?.zones ?? []));
  readonly referenceText = linkedSignal(() => {
    const reference = this.zoneSet()?.referenceValue ?? this.suggestedReference();
    return reference === null ? '' : formatZoneValue(reference, this.metric());
  });
  readonly errors = signal<string[]>([]);
  readonly statusMessage = signal('');
  readonly isBusy = signal(false);
  readonly pendingAction = signal<PendingAction | null>(null);

  readonly idPrefix = computed(() => `zones-${this.sport()}-${this.metric()}`);
  readonly title = computed(
    () => `${SPORT_LABELS[this.sport()]} · ${INTENSITY_METRIC_LABELS[this.metric()]}`,
  );
  readonly referenceLabel = computed(() => REFERENCE_LABELS[this.metric()]);
  readonly unit = computed(() => VALUE_UNITS[this.metric()]);
  readonly isPace = computed(() => this.metric() === IntensityMetric.Pace);
  readonly hasChanges = computed(
    () => JSON.stringify(this.zones()) !== JSON.stringify(this.zoneSet()?.zones ?? []),
  );

  startOf(zone: TrainingZone): string {
    return formatZoneValue(this.isPace() ? zone.maxValue : zone.minValue, this.metric());
  }

  endOf(zone: TrainingZone): string {
    return formatZoneValue(this.isPace() ? zone.minValue : zone.maxValue, this.metric());
  }

  setName(index: number, event: Event): void {
    const name = readText(event);
    this.updateZone(index, (zone) => ({ ...zone, name }));
  }

  setDescription(index: number, event: Event): void {
    const description = readText(event);
    this.updateZone(index, (zone) =>
      withOptional(zone, 'description', description.trim() ? description : undefined),
    );
  }

  /** Sets where the zone starts; the previous zone now ends there. */
  setStart(index: number, event: Event): void {
    const value = this.readValue(event);
    if (value === null) return;

    this.zones.update((zones) =>
      zones.map((zone, position) => {
        if (position === index) return this.withStart(zone, value);
        if (position === index - 1) return this.withEnd(zone, value);
        return zone;
      }),
    );
  }

  /** Sets where the zone ends; the next zone now starts there. */
  setEnd(index: number, event: Event): void {
    const value = this.readValue(event);
    if (value === null) return;

    this.zones.update((zones) =>
      zones.map((zone, position) => {
        if (position === index) return this.withEnd(zone, value);
        if (position === index + 1) return this.withStart(zone, value);
        return zone;
      }),
    );
  }

  /** Adds a zone above the last one with the same width. */
  addZone(): void {
    this.zones.update((zones) => {
      const last = zones.at(-1);
      if (!last) return zones;

      const width = last.maxValue - last.minValue || DEFAULT_ZONE_WIDTH;
      const start = this.isPace() ? last.minValue : last.maxValue;
      const end = this.isPace() ? Math.max(1, start - width) : start + width;
      const zone: TrainingZone = {
        id: createId(),
        name: `Z${zones.length + 1}`,
        minValue: this.isPace() ? end : start,
        maxValue: this.isPace() ? start : end,
        sortOrder: zones.length + 1,
      };

      return [...zones, zone];
    });
  }

  /** Removes a zone; the next zone takes its start so the zones stay contiguous. */
  removeZone(index: number): void {
    this.zones.update((zones) => {
      const removed = zones[index];
      if (!removed || zones.length === 1) return zones;

      const start = this.isPace() ? removed.maxValue : removed.minValue;
      return zones
        .filter((_, position) => position !== index)
        .map((zone, position) => ({
          ...(position === index && index > 0 ? this.withStart(zone, start) : zone),
          sortOrder: position + 1,
        }));
    });
  }

  discardChanges(): void {
    this.zones.set(cloneValue(this.zoneSet()?.zones ?? []));
    this.errors.set([]);
    this.statusMessage.set('');
  }

  setReference(event: Event): void {
    this.referenceText.set(readText(event));
  }

  async create(): Promise<void> {
    const reference = this.parseReference();
    if (reference === null) return;

    await this.run('Zonas creadas.', async () => {
      this.saved.emit(await this.zoneSetService.getOrSeed(this.sport(), this.metric(), reference));
    });
  }

  async save(): Promise<void> {
    const zoneSet = this.zoneSet();
    if (!zoneSet) return;

    const zones = this.zones().map((zone, index) => ({ ...zone, sortOrder: index + 1 }));
    await this.run('Zonas guardadas.', async () => {
      this.saved.emit(await this.zoneSetService.save({ ...zoneSet, zones }));
    });
  }

  requestRegenerate(): void {
    if (this.parseReference() !== null) {
      this.pendingAction.set('regenerate');
    }
  }

  requestDelete(): void {
    this.errors.set([]);
    this.pendingAction.set('delete');
  }

  cancelPendingAction(): void {
    this.pendingAction.set(null);
  }

  async confirmPendingAction(): Promise<void> {
    const action = this.pendingAction();
    const zoneSet = this.zoneSet();
    this.pendingAction.set(null);
    if (!action || !zoneSet) return;

    if (action === 'delete') {
      await this.run('', async () => {
        await this.zoneSetService.delete(zoneSet.id);
        this.deleted.emit(zoneSet.id);
      });
      return;
    }

    const reference = this.parseReference();
    if (reference === null) return;

    await this.run('Zonas recalculadas.', async () => {
      this.saved.emit(await this.zoneSetService.regenerateFromReference(zoneSet.id, reference));
    });
  }

  private async run(successMessage: string, task: () => Promise<void>): Promise<void> {
    this.isBusy.set(true);
    this.errors.set([]);
    this.statusMessage.set('');

    try {
      await task();
      this.statusMessage.set(successMessage);
    } catch (error) {
      this.errors.set(toMessages(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  private parseReference(): number | null {
    const text = this.referenceText().trim();
    const reference = text ? this.parseValue(text) : null;

    if (reference === null) {
      this.errors.set([
        this.isPace()
          ? `Captura el ${this.referenceLabel().toLowerCase()} con el formato m:ss, por ejemplo 4:30.`
          : `Captura la referencia: ${this.referenceLabel()}.`,
      ]);
    }

    return reference;
  }

  private readValue(event: Event): number | null {
    const value = this.parseValue(readText(event));

    this.errors.set(
      value === null
        ? [
            this.isPace()
              ? 'Usa el formato m:ss para el ritmo, por ejemplo 4:30.'
              : 'Los límites de las zonas deben ser números enteros.',
          ]
        : [],
    );

    return value;
  }

  private parseValue(text: string): number | null {
    if (this.isPace()) return parsePace(text);

    const value = Number(text);
    return text.trim() !== '' && Number.isInteger(value) && value >= 0 ? value : null;
  }

  private withStart(zone: TrainingZone, value: number): TrainingZone {
    return this.isPace() ? { ...zone, maxValue: value } : { ...zone, minValue: value };
  }

  private withEnd(zone: TrainingZone, value: number): TrainingZone {
    return this.isPace() ? { ...zone, minValue: value } : { ...zone, maxValue: value };
  }

  private updateZone(index: number, update: (zone: TrainingZone) => TrainingZone): void {
    this.zones.update((zones) =>
      zones.map((zone, position) => (position === index ? update(zone) : zone)),
    );
  }
}

/** Schema issues on a zone are prefixed with its visible number: `Zona 2: …`. */
function toMessages(error: unknown): string[] {
  if (error instanceof DomainValidationError) {
    const messages = error.issues.map((issue) => {
      const [field, index] = issue.path;
      return field === 'zones' && typeof index === 'number'
        ? `Zona ${index + 1}: ${issue.message}`
        : issue.message;
    });
    return [...new Set(messages)];
  }

  return [error instanceof Error ? error.message : 'No se pudieron guardar las zonas.'];
}
