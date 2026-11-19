import { Chip, FormControl, MenuItem, Select, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import { periodLabel } from '../../schemas/plan';
import { SIGNAL_COLORS } from '../../schemas/planMonitoring';
import type { AtRiskFilter } from './atRiskRows';

interface AtRiskFilterBarProps {
  filter: AtRiskFilter;
  onFilterChange: (next: AtRiskFilter) => void;
  behindCount: number;
  aheadCount: number;
  allStoresCount: number;
  topSliceCount: number;
  asOfValue: string;
  asOfOptions: { year: number; month: number }[];
  onAsOfChange: (year: number, month: number) => void;
}

/** Shared Behind/Ahead chips + View / As-of controls for both At-risk panels. */
export function AtRiskFilterBar({
  filter,
  onFilterChange,
  behindCount,
  aheadCount,
  allStoresCount,
  topSliceCount,
  asOfValue,
  asOfOptions,
  onAsOfChange,
}: AtRiskFilterBarProps) {
  const t = useT();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={0.75}
      alignItems={{ sm: 'center' }}
      justifyContent="space-between"
      sx={{ flexShrink: 0 }}
      data-testid="atrisk-filter-bar"
    >
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
        <Chip
          size="small"
          clickable
          data-testid="atrisk-chip-behind"
          aria-pressed={filter === 'behind'}
          aria-label={t('planner.atRisk.behindChip', { count: behindCount })}
          label={t('planner.atRisk.behindChip', { count: behindCount })}
          onClick={() => onFilterChange('behind')}
          sx={{
            bgcolor: SIGNAL_COLORS.behind_plan,
            color: '#fff',
            height: 22,
            fontSize: '0.7rem',
            cursor: 'pointer',
            boxShadow:
              filter === 'behind'
                ? (theme) =>
                    `0 0 0 2px ${theme.palette.common.white}, 0 0 0 4px ${SIGNAL_COLORS.behind_plan}`
                : 'none',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
        <Chip
          size="small"
          clickable
          data-testid="atrisk-chip-ahead"
          aria-pressed={filter === 'ahead'}
          aria-label={t('planner.atRisk.aheadChip', { count: aheadCount })}
          label={t('planner.atRisk.aheadChip', { count: aheadCount })}
          onClick={() => onFilterChange('ahead')}
          sx={{
            bgcolor: SIGNAL_COLORS.ahead_of_plan,
            color: '#fff',
            height: 22,
            fontSize: '0.7rem',
            cursor: 'pointer',
            boxShadow:
              filter === 'ahead'
                ? (theme) =>
                    `0 0 0 2px ${theme.palette.common.white}, 0 0 0 4px ${SIGNAL_COLORS.ahead_of_plan}`
                : 'none',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        alignItems="flex-end"
        sx={{ pr: { xs: 0, sm: 1.5 }, minWidth: 0 }}
      >
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 188 }, flex: { sm: '1 1 11rem' } }}>
          <Typography
            component="label"
            htmlFor="atrisk-filter-select"
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.25, display: 'block', lineHeight: 1.2 }}
          >
            {t('planner.atRisk.filter')}
          </Typography>
          <Select
            id="atrisk-filter-select"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as AtRiskFilter)}
            inputProps={{ 'aria-label': t('planner.atRisk.filter') }}
            sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.75 } }}
          >
            <MenuItem value="behind" sx={{ fontSize: '0.75rem' }}>
              {t('planner.atRisk.behindOnly')} ({behindCount})
            </MenuItem>
            <MenuItem value="ahead" sx={{ fontSize: '0.75rem' }}>
              {t('planner.atRisk.aheadOnly')} ({aheadCount})
            </MenuItem>
            <MenuItem value="top_gainers" sx={{ fontSize: '0.75rem' }}>
              {t('planner.atRisk.topGainers')} ({topSliceCount})
            </MenuItem>
            <MenuItem value="top_laggards" sx={{ fontSize: '0.75rem' }}>
              {t('planner.atRisk.topLaggards')} ({topSliceCount})
            </MenuItem>
            <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>
              {t('planner.atRisk.all')} ({allStoresCount})
            </MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 112 } }}>
          <Typography
            component="label"
            htmlFor="atrisk-as-of-select"
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.25, display: 'block', lineHeight: 1.2 }}
          >
            {t('planner.atRisk.asOf')}
          </Typography>
          <Select
            id="atrisk-as-of-select"
            value={asOfValue}
            onChange={(event) => {
              const [y, m] = event.target.value.split('-').map(Number);
              onAsOfChange(y, m);
            }}
            inputProps={{ 'aria-label': t('planner.atRisk.asOf') }}
            sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.75 } }}
          >
            {asOfOptions.map((opt) => (
              <MenuItem
                key={periodLabel(opt.year, opt.month)}
                value={periodLabel(opt.year, opt.month)}
                sx={{ fontSize: '0.75rem' }}
              >
                {periodLabel(opt.year, opt.month)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  );
}
