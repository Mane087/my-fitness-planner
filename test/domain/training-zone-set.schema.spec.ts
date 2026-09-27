import { trainingZoneSetSchema } from '../../src/app/core/domain/schemas/training-zone-set.schema';
import {
  createDefaultZoneSet,
  createDefaultZones,
} from '../../src/app/core/domain/training-zone-set.defaults';
import { heartRateZoneSet } from './fixtures';

function messages(result: { error?: { issues: { message: string; path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) ?? [];
}

describe('trainingZoneSetSchema', () => {
  it('accepts an ordered, non-overlapping heart rate zone set', () => {
    expect(trainingZoneSetSchema.safeParse(heartRateZoneSet()).success).toBe(true);
  });

  it('rejects a metric that does not apply to the sport', () => {
    const result = trainingZoneSetSchema.safeParse(
      heartRateZoneSet({ sport: 'running', metric: 'power' }),
    );

    expect(messages(result)).toContain('metric: La métrica no aplica para este deporte.');
  });

  it('rejects zone sets for sports without zones', () => {
    expect(trainingZoneSetSchema.safeParse(heartRateZoneSet({ sport: 'mobility' })).success).toBe(
      false,
    );
  });

  it('rejects overlapping heart rate zones', () => {
    const zoneSet = heartRateZoneSet();
    zoneSet.zones[1]!.minValue = 110;

    expect(messages(trainingZoneSetSchema.safeParse(zoneSet))).toContain(
      'zones.1.minValue: Las zonas no pueden traslaparse y deben ir de menor a mayor intensidad.',
    );
  });

  it('rejects a zone whose min is not below its max', () => {
    const zoneSet = heartRateZoneSet();
    zoneSet.zones[0] = { ...zoneSet.zones[0]!, minValue: 120, maxValue: 116 };

    expect(messages(trainingZoneSetSchema.safeParse(zoneSet))).toContain(
      'zones.0.maxValue: El valor mínimo de la zona debe ser menor que el máximo.',
    );
  });

  it('rejects non consecutive sort orders and duplicated ids', () => {
    const zoneSet = heartRateZoneSet();
    zoneSet.zones[2] = { ...zoneSet.zones[2]!, id: 'z2', sortOrder: 5 };

    const result = messages(trainingZoneSetSchema.safeParse(zoneSet));

    expect(result).toContain('zones.2.sortOrder: El orden de las zonas debe ser consecutivo.');
    expect(result).toContain('zones.2.id: Los identificadores de zona deben ser únicos.');
  });

  it('accepts pace zones ordered from slowest to fastest (descending seconds per km)', () => {
    const paceSet = heartRateZoneSet({
      sport: 'running',
      metric: 'pace',
      referenceValue: 300,
      zones: [
        { id: 'p1', name: 'Z1', minValue: 387, maxValue: 480, sortOrder: 1 },
        { id: 'p2', name: 'Z2', minValue: 342, maxValue: 387, sortOrder: 2 },
        { id: 'p3', name: 'Z3', minValue: 318, maxValue: 342, sortOrder: 3 },
      ],
    });

    expect(trainingZoneSetSchema.safeParse(paceSet).success).toBe(true);
  });

  it('rejects pace zones that get slower as intensity grows', () => {
    const paceSet = heartRateZoneSet({
      sport: 'running',
      metric: 'pace',
      referenceValue: 300,
      zones: [
        { id: 'p1', name: 'Z1', minValue: 300, maxValue: 330, sortOrder: 1 },
        { id: 'p2', name: 'Z2', minValue: 330, maxValue: 360, sortOrder: 2 },
      ],
    });

    expect(trainingZoneSetSchema.safeParse(paceSet).success).toBe(false);
  });
});

describe('training zone set defaults', () => {
  it('creates 5 heart rate zones as percentages of max heart rate', () => {
    const zones = createDefaultZones('heart_rate', 200);

    expect(zones).toHaveLength(5);
    expect(zones.map((zone) => [zone.minValue, zone.maxValue])).toEqual([
      [100, 120],
      [120, 140],
      [140, 160],
      [160, 180],
      [180, 200],
    ]);
    expect(zones.map((zone) => zone.sortOrder)).toEqual([1, 2, 3, 4, 5]);
  });

  it('creates 7 power zones as percentages of FTP', () => {
    const zones = createDefaultZones('power', 200);

    expect(zones).toHaveLength(7);
    expect(zones[0]).toMatchObject({ minValue: 0, maxValue: 110 });
    expect(zones[3]).toMatchObject({ minValue: 180, maxValue: 210 });
    expect(zones[6]).toMatchObject({ minValue: 300, maxValue: 600 });
  });

  it('creates 5 pace zones where zone 1 is the slowest', () => {
    const zones = createDefaultZones('pace', 300);

    expect(zones).toHaveLength(5);
    expect(zones[0]).toMatchObject({ minValue: 387, maxValue: 480 });
    expect(zones[4]).toMatchObject({ minValue: 240, maxValue: 297 });
  });

  it.each([
    ['cycling', 'heart_rate', 193],
    ['cycling', 'power', 250],
    ['running', 'heart_rate', 190],
    ['running', 'pace', 285],
  ] as const)('creates a valid %s / %s zone set', (sport, metric, referenceValue) => {
    const zoneSet = createDefaultZoneSet(sport, metric, referenceValue);

    const result = trainingZoneSetSchema.safeParse(zoneSet);

    expect(result.success).toBe(true);
    expect(zoneSet.sport).toBe(sport);
    expect(zoneSet.metric).toBe(metric);
    expect(zoneSet.referenceValue).toBe(referenceValue);
  });
});
