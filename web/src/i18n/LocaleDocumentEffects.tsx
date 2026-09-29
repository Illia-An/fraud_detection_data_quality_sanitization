import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { useEffect, useMemo, type ReactNode } from 'react';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

import { useLocaleStore } from './localeStore';
import { directionForLocale } from './types';

const ltrCache = createCache({ key: 'muiltr' });
const rtlCache = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

interface LocaleDocumentEffectsProps {
  children: ReactNode;
}

/** Syncs html lang/dir and Emotion RTL cache with the active locale. */
export function LocaleDocumentEffects({ children }: LocaleDocumentEffectsProps) {
  const locale = useLocaleStore((state) => state.locale);
  const direction = directionForLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale === 'he' ? 'he' : 'en';
    document.documentElement.dir = direction;
  }, [locale, direction]);

  const cache = useMemo(() => (direction === 'rtl' ? rtlCache : ltrCache), [direction]);

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
