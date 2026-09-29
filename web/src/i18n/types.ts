export type Locale = 'en' | 'he';

export const LOCALES: readonly Locale[] = ['en', 'he'] as const;

export const LOCALE_STORAGE_KEY = 'fraud-guard-locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'he';
}

export function directionForLocale(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
