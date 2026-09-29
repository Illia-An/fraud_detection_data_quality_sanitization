import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LOCALE_STORAGE_KEY,
  translate,
  useLocaleStore,
  useT,
} from './index';

describe('i18n locale', () => {
  afterEach(() => {
    act(() => {
      useLocaleStore.getState().setLocale('en');
    });
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('defaults to English copy', () => {
    expect(translate('en', 'nav.sanitization')).toBe('Sanitization');
    expect(translate('en', 'sanitization.run')).toBe('Run Scenario');
  });

  it('switches to Hebrew and interpolates params', () => {
    expect(translate('he', 'nav.sanitization')).toBe('סניטציה');
    expect(translate('he', 'kpi.baselineStore', { id: 42 })).toBe('סניף 42 בסיס 5%');
  });

  it('persists locale in localStorage and updates via useT', () => {
    const { result, rerender } = renderHook(() => useT());
    expect(result.current('nav.planner')).toBe('Planner');

    act(() => {
      useLocaleStore.getState().setLocale('he');
    });
    rerender();

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('he');
    expect(result.current('nav.planner')).toBe('מתכנן');
  });
});
