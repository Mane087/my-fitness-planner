import { appSettingsSchema } from '../../src/app/core/domain/schemas/app-settings.schema';
import { athleteProfileSchema } from '../../src/app/core/domain/schemas/athlete-profile.schema';
import { TIMESTAMP } from './fixtures';

const profile = {
  id: 'profile-1',
  name: 'Ana',
  weightKg: 62.5,
  maxHeartRate: 190,
  preferredSport: 'running',
  preferredIntensityMetric: 'pace',
  weekStartsOn: 'monday',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

describe('athleteProfileSchema', () => {
  it('accepts a complete profile', () => {
    expect(athleteProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('accepts a profile without weight', () => {
    const withoutWeight: Partial<typeof profile> = { ...profile };
    delete withoutWeight.weightKg;

    expect(athleteProfileSchema.safeParse(withoutWeight).success).toBe(true);
  });

  it('rejects an empty name and an out of range max heart rate with Spanish messages', () => {
    const result = athleteProfileSchema.safeParse({ ...profile, name: ' ', maxHeartRate: 90 });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'El nombre es requerido.',
      'La frecuencia cardiaca máxima debe estar entre 100 y 250.',
    ]);
  });

  it('rejects an unknown sport', () => {
    expect(athleteProfileSchema.safeParse({ ...profile, preferredSport: 'swimming' }).success).toBe(
      false,
    );
  });
});

describe('appSettingsSchema', () => {
  it('accepts valid settings and rejects unknown enum values', () => {
    const settings = {
      id: 'settings',
      calendarDefaultView: 'month',
      weekStartsOn: 'sunday',
      timeFormat: '24h',
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    };

    expect(appSettingsSchema.safeParse(settings).success).toBe(true);
    expect(appSettingsSchema.safeParse({ ...settings, timeFormat: '48h' }).success).toBe(false);
  });
});
