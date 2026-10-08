import { TestBed } from '@angular/core/testing';

import { ThemePreference } from '../../src/app/core/domain/calendar.enums';
import { AppSettingsRepository } from '../../src/app/core/repositories/app-settings.repository';
import {
  resolveTheme,
  THEME_STORAGE_KEY,
  ThemeService,
} from '../../src/app/core/services/theme.service';
import { installFakeIndexedDb } from '../storage/fake-indexeddb.helpers';

describe('resolveTheme', () => {
  it('follows the system scheme when the preference is system', () => {
    expect(resolveTheme(ThemePreference.System, true)).toBe('dark');
    expect(resolveTheme(ThemePreference.System, false)).toBe('light');
  });

  it('ignores the system scheme when the preference is explicit', () => {
    expect(resolveTheme(ThemePreference.Light, true)).toBe('light');
    expect(resolveTheme(ThemePreference.Dark, false)).toBe('dark');
  });
});

describe('ThemeService', () => {
  type ChangeListener = () => void;
  let isSystemDark: boolean;
  let changeListeners: ChangeListener[];

  function mockSystemScheme(): void {
    changeListeners = [];
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn(() => ({
        get matches() {
          return isSystemDark;
        },
        addEventListener: (_type: string, listener: ChangeListener) => {
          changeListeners.push(listener);
        },
      })),
    });
  }

  function createService(): ThemeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  beforeEach(async () => {
    installFakeIndexedDb();
    isSystemDark = false;
    mockSystemScheme();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies the system scheme when the saved preference is system', async () => {
    isSystemDark = true;
    const service = createService();
    await TestBed.inject(AppSettingsRepository).createDefaultSettings();

    await service.initialize();

    expect(service.preference()).toBe('system');
    expect(service.resolvedTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('updates data-theme when the system scheme changes while the preference is system', async () => {
    const service = createService();
    await TestBed.inject(AppSettingsRepository).createDefaultSettings();
    await service.initialize();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    isSystemDark = true;
    changeListeners.forEach((listener) => listener());

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('keeps an explicit preference when the system scheme changes', async () => {
    const service = createService();
    await TestBed.inject(AppSettingsRepository).createDefaultSettings();
    await service.setPreference(ThemePreference.Light);

    isSystemDark = true;
    changeListeners.forEach((listener) => listener());

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('saves the preference in app settings and in the pre-paint storage key', async () => {
    const service = createService();
    const settings = TestBed.inject(AppSettingsRepository);
    await settings.createDefaultSettings();

    await service.setPreference(ThemePreference.Dark);

    await expect(settings.getSettings()).resolves.toMatchObject({ theme: 'dark' });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores the saved preference after a reload', async () => {
    const first = createService();
    await TestBed.inject(AppSettingsRepository).createDefaultSettings();
    await first.setPreference(ThemePreference.Dark);
    document.documentElement.removeAttribute('data-theme');

    const second = TestBed.inject(ThemeService);
    await second.initialize();

    expect(second.preference()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
