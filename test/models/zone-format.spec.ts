import {
  formatPace,
  formatZone,
  formatZoneValue,
  parsePace,
} from '../../src/app/core/models/zone-format';

describe('zone format', () => {
  describe('formatPace', () => {
    it('formats seconds per km as m:ss', () => {
      expect(formatPace(270)).toBe('4:30');
      expect(formatPace(305)).toBe('5:05');
      expect(formatPace(600)).toBe('10:00');
    });

    it('rounds to whole seconds without producing 60 seconds', () => {
      expect(formatPace(299.6)).toBe('5:00');
    });
  });

  describe('parsePace', () => {
    it('parses m:ss and mm:ss into seconds per km', () => {
      expect(parsePace('4:30')).toBe(270);
      expect(parsePace(' 04:05 ')).toBe(245);
      expect(parsePace('12:00')).toBe(720);
    });

    it.each(['', '4', '4:5', '4:60', '4.30', 'abc', '0:00', '123:00'])(
      'returns null for %p',
      (text) => {
        expect(parsePace(text)).toBeNull();
      },
    );

    it('round-trips with formatPace', () => {
      expect(parsePace(formatPace(387))).toBe(387);
    });
  });

  it('formats zone values and labels in the unit of the metric', () => {
    const zone = { id: 'z', name: 'Z4 Umbral', minValue: 267, maxValue: 286, sortOrder: 4 };

    expect(formatZoneValue(250, 'power')).toBe('250');
    expect(formatZone(zone, 'pace')).toBe('Z4 Umbral (4:27-4:46 /km)');
    expect(formatZone({ ...zone, minValue: 225, maxValue: 263 }, 'power')).toBe(
      'Z4 Umbral (225-263 W)',
    );
  });
});
