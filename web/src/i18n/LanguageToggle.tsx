import TranslateIcon from '@mui/icons-material/Translate';
import IconButton, { type IconButtonOwnProps } from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';

import { useLocaleStore } from './localeStore';
import type { Locale } from './types';
import { useT } from './useT';

export default function LanguageToggle(props: IconButtonOwnProps) {
  const t = useT();
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handlePick = (next: Locale) => () => {
    setLocale(next);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={t('lang.aria')}>
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          disableRipple
          size="small"
          aria-label={t('lang.aria')}
          aria-controls={open ? 'language-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          {...props}
        >
          <TranslateIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        id="language-menu"
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            variant: 'outlined',
            elevation: 0,
            sx: { my: '4px' },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem selected={locale === 'en'} onClick={handlePick('en')}>
          {t('lang.switchToEn')}
        </MenuItem>
        <MenuItem selected={locale === 'he'} onClick={handlePick('he')}>
          {t('lang.switchToHe')}
        </MenuItem>
      </Menu>
    </>
  );
}
