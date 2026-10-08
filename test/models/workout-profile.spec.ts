import {
  buildWorkoutProfile,
  resolveProfileZone,
  sumSecondsByZone,
  zoneHeightRatio,
} from '../../src/app/core/models/workout-profile';
import { exercise, heartRateSnapshot, heartRateTarget, interval, repeat } from '../domain/fixtures';

function zoneTarget(zoneNumber: number) {
  return heartRateTarget({
    zoneId: `zone-z${zoneNumber}`,
    zoneSnapshot: heartRateSnapshot({ zoneId: `zone-z${zoneNumber}`, name: `Z${zoneNumber} Zona` }),
  });
}

function timed(id: string, seconds: number, zoneNumber: number | null) {
  return interval(id, {
    duration: { type: 'time', seconds },
    target: zoneNumber === null ? undefined : zoneTarget(zoneNumber),
  });
}

describe('buildWorkoutProfile', () => {
  it('sizes each block proportionally to its time', () => {
    const bars = buildWorkoutProfile([timed('a', 600, 1), timed('b', 1800, 2), timed('c', 600, 1)]);

    expect(bars.map((bar) => bar.widthRatio)).toEqual([0.2, 0.6, 0.2]);
    expect(bars.map((bar) => bar.startRatio)).toEqual([0, 0.2, 0.8]);
    expect(bars.reduce((total, bar) => total + bar.widthRatio, 0)).toBeCloseTo(1);
  });

  it('assigns the zone of each step target and taller blocks to higher zones', () => {
    const bars = buildWorkoutProfile([timed('a', 300, 1), timed('b', 300, 4), timed('c', 300, 2)]);

    expect(bars.map((bar) => bar.zone)).toEqual([1, 4, 2]);
    expect(bars[1].heightRatio).toBeGreaterThan(bars[2].heightRatio);
    expect(bars[2].heightRatio).toBeGreaterThan(bars[0].heightRatio);
  });

  it('expands repeat groups in execution order', () => {
    const bars = buildWorkoutProfile([
      repeat('r', {
        repetitions: 3,
        steps: [timed('work', 240, 4), timed('rest', 180, 1)],
      }),
    ]);

    expect(bars.map((bar) => bar.zone)).toEqual([4, 1, 4, 1, 4, 1]);
    expect(bars[0].widthRatio).toBeCloseTo(240 / 1260);
  });

  it('gives steps without target a neutral block and keeps their width', () => {
    const [bar] = buildWorkoutProfile([timed('a', 600, null)]);

    expect(bar.zone).toBeNull();
    expect(bar.widthRatio).toBe(1);
    expect(bar.heightRatio).toBeLessThan(zoneHeightRatio(1));
  });

  it('estimates the width of distance and open steps', () => {
    const bars = buildWorkoutProfile(
      [
        interval('d', { duration: { type: 'distance', meters: 1000 }, target: zoneTarget(3) }),
        interval('o', { duration: { type: 'open' }, target: zoneTarget(2) }),
      ],
      'cycling',
    );

    expect(bars).toHaveLength(2);
    // 1000 m at the cycling estimate (0.12 s/m) is 120 s, against 300 s for the open step.
    expect(bars[0].widthRatio).toBeCloseTo(120 / 420);
  });

  it('draws nothing for workouts without interval steps', () => {
    expect(buildWorkoutProfile([exercise('e1'), exercise('e2')])).toEqual([]);
  });

  it('ignores exercise steps mixed with intervals', () => {
    const bars = buildWorkoutProfile([timed('a', 600, 2), exercise('e1')]);

    expect(bars).toHaveLength(1);
  });
});

describe('resolveProfileZone', () => {
  it('reads the zone number from the zone snapshot name', () => {
    expect(resolveProfileZone(zoneTarget(5))).toBe(5);
  });

  it('maps an RPE target to the seven zones', () => {
    expect(resolveProfileZone({ metric: 'rpe', value: 1 })).toBe(1);
    expect(resolveProfileZone({ metric: 'rpe', value: 5 })).toBe(4);
    expect(resolveProfileZone({ metric: 'rpe', value: 10 })).toBe(7);
  });

  it('returns null without target or without a numbered zone name', () => {
    expect(resolveProfileZone(undefined)).toBeNull();
    expect(
      resolveProfileZone(
        heartRateTarget({ zoneSnapshot: heartRateSnapshot({ name: 'Umbral personalizado' }) }),
      ),
    ).toBeNull();
  });
});

describe('sumSecondsByZone', () => {
  it('adds the seconds of every expanded step per zone', () => {
    const seconds = sumSecondsByZone([
      timed('warm', 600, 1),
      repeat('r', { repetitions: 2, steps: [timed('work', 300, 4), timed('rest', 300, 1)] }),
    ]);

    expect(seconds.get(1)).toBe(1200);
    expect(seconds.get(4)).toBe(600);
    expect(seconds.size).toBe(2);
  });
});
