import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LocaleDocumentEffects } from './LocaleDocumentEffects';
import LanguageToggle from './LanguageToggle';
import { LOCALE_STORAGE_KEY, useLocaleStore } from './index';

function renderToggle() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <LocaleDocumentEffects>
        <LanguageToggle />
      </LocaleDocumentEffects>
    </ThemeProvider>,
  );
}

describe('LanguageToggle + RTL document effects', () => {
  afterEach(() => {
    act(() => {
      useLocaleStore.getState().setLocale('en');
    });
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('sets html dir=rtl when Hebrew is selected', () => {
    renderToggle();

    expect(document.documentElement.dir).toBe('ltr');

    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'עברית' }));

    expect(useLocaleStore.getState().locale).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('he');
  });
});
