import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

import { ThemePreference } from '../domain/calendar.enums';
import { AppSettingsRepository } from '../repositories/app-settings.repository';

export type ResolvedTheme = Exclude<ThemePreference, typeof ThemePreference.System>;

/** Mirror of the preference read synchronously by the inline script in index.html. */
export const THEME_STORAGE_KEY = 'theme-preference';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference, isSystemDark: boolean): ResolvedTheme {
  if (preference === ThemePreference.System) {
    return isSystemDark ? ThemePreference.Dark : ThemePreference.Light;
  }

  return preference;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly appSettingsRepository = inject(AppSettingsRepository);

  private readonly preferenceState = signal<ThemePreference>(ThemePreference.System);
  private readonly resolvedThemeState = signal<ResolvedTheme>(ThemePreference.Light);
  private readonly darkSchemeQuery = this.document.defaultView?.matchMedia?.(DARK_SCHEME_QUERY);

  readonly preference = this.preferenceState.asReadonly();
  readonly resolvedTheme = this.resolvedThemeState.asReadonly();

  constructor() {
    this.darkSchemeQuery?.addEventListener('change', () => {
      this.applyTheme();
    });
  }

  /** Loads the saved preference and applies it. Requires the database to be initialized. */
  async initialize(): Promise<void> {
    const settings = await this.appSettingsRepository.getSettings();
    this.setPreferenceState(settings.theme);
  }

  async setPreference(preference: ThemePreference): Promise<void> {
    const settings = await this.appSettingsRepository.getSettings();
    await this.appSettingsRepository.update({ ...settings, theme: preference });
    this.setPreferenceState(preference);
  }

  private setPreferenceState(preference: ThemePreference): void {
    this.preferenceState.set(preference);
    this.persistPreference(preference);
    this.applyTheme();
  }

  private applyTheme(): void {
    const theme = resolveTheme(this.preferenceState(), this.darkSchemeQuery?.matches ?? false);

    this.resolvedThemeState.set(theme);
    this.document.documentElement.setAttribute('data-theme', theme);
  }

  private persistPreference(preference: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage can be blocked; the IndexedDB setting remains the source of truth.
    }
  }
}
