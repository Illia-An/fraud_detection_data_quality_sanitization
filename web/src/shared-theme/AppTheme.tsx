import { useMemo, type ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import { useLocaleStore } from '../i18n/localeStore';
import { directionForLocale } from '../i18n/types';
import { colorSchemes, shadows, shape, typography } from './themePrimitives';

interface AppThemeProps {
  children: ReactNode;
}

export default function AppTheme({ children }: AppThemeProps) {
  const locale = useLocaleStore((state) => state.locale);
  const direction = directionForLocale(locale);

  const theme = useMemo(
    () =>
      createTheme({
        cssVariables: {
          colorSchemeSelector: 'data-mui-color-scheme',
          cssVarPrefix: 'template',
        },
        direction,
        colorSchemes,
        typography,
        shadows,
        shape,
      }),
    [direction],
  );

  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
