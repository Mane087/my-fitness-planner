import { Sport } from '../../src/app/core/domain/workout.enums';
import { buildZoneSummary } from '../../src/app/pages/training-session-form-page/training-session-summary';
import { exercise, heartRateSnapshot, heartRateTarget, interval, repeat } from '../domain/fixtures';

function timed(id: string, seconds: number, zoneNumber: number) {
  return interval(id, {
    duration: { type: 'time', seconds },
    target: heartRateTarget({
      zoneSnapshot: heartRateSnapshot({ name: `Z${zoneNumber} Zona` }),
    }),
  });
}

describe('buildZoneSummary', () => {
  it('adds the minutes of each zone and orders them from the lowest zone', () => {
    const summary = buildZoneSummary(
      [timed('a', 600, 4), repeat('r', { repetitions: 2, steps: [timed('b', 300, 1)] })],
      Sport.Cycling,
    );

    expect(summary.zones.map((item) => [item.zone, item.minutes])).toEqual([
      [1, 10],
      [4, 10],
    ]);
    expect(summary.zones.map((item) => item.widthPercent)).toEqual([50, 50]);
  });

  it('counts exercises, sets and groups for the exercise sports', () => {
    const summary = buildZoneSummary(
      [
        exercise('a', { sets: 3 }),
        repeat('circuit', { repetitions: 2, steps: [exercise('b', { sets: 1 })] }),
      ],
      Sport.Plyometrics,
    );

    expect(summary.exerciseCount).toBe(3);
    expect(summary.totalSets).toBe(5);
    expect(summary.groupCount).toBe(1);
    expect(summary.zones).toEqual([]);
  });
});
