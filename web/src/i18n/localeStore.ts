import { create } from 'zustand';

import {
  directionForLocale,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from './types';

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) {
      return raw;
    }
  } catch {
    // ignore storage errors (private mode / blocked)
  }
  return 'en';
}

function persistLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: readStoredLocale(),
  setLocale: (locale) => {
    persistLocale(locale);
    set({ locale });
  },
  toggleLocale: () => {
    const next: Locale = get().locale === 'en' ? 'he' : 'en';
    persistLocale(next);
    set({ locale: next });
  },
}));

export function getLocaleDirection(locale: Locale = useLocaleStore.getState().locale): 'ltr' | 'rtl' {
  return directionForLocale(locale);
}
