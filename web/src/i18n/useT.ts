import { useCallback } from 'react';

import { en, type MessageKey } from './messages/en';
import { he } from './messages/he';
import { useLocaleStore } from './localeStore';
import type { Locale } from './types';

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en: en as Record<MessageKey, string>,
  he,
};

export type TranslateParams = Record<string, string | number>;

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: TranslateParams,
): string {
  const template = catalogs[locale][key] ?? catalogs.en[key] ?? key;
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    return value == null ? `{${name}}` : String(value);
  });
}

/** Hook: re-renders when locale changes. */
export function useT() {
  const locale = useLocaleStore((state) => state.locale);
  return useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );
}

/** Non-hook access (effects, pure helpers outside React tree). */
export function t(key: MessageKey, params?: TranslateParams): string {
  return translate(useLocaleStore.getState().locale, key, params);
}
