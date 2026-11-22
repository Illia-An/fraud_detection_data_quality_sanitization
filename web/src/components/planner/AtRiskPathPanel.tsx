import { Box, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { MonitorSignal } from '../../schemas/planMonitoring';
import { SIGNAL_COLORS, SIGNAL_LABELS } from '../../schemas/planMonitoring';
import {
  type AtRiskMixSummary,
  buildAtRiskDonutSlices,
} from './atRiskDonut';
import type { AtRiskFilter } from './atRiskRows';

interface AtRiskPathPanelProps {
  summary: AtRiskMixSummary;
  /** Optional: clicking a slice/legend applies the matching exception filter. */
  onSelectFilter?: (filter: AtRiskFilter) => void;
}

function signalToFilter(signal: MonitorSignal): AtRiskFilter | null {
  if (signal === 'behind_plan') {
    return 'behind';
  }
  if (signal === 'ahead_of_plan') {
    return 'ahead';
  }
  if (signal === 'on_plan' || signal === 'insufficient_history') {
    return 'all';
  }
  return null;
}

/**
 * Store-mix donut (Behind / On plan / Ahead / No actual).
 * Sits beside the AI chat panel in the At-risk right column.
 */
export function AtRiskPathPanel({ summary, onSelectFilter }: AtRiskPathPanelProps) {
  const t = useT();
  const { slices, total } = buildAtRiskDonutSlices(summary);

  const legendRows: { signal: MonitorSignal; count: number }[] = [
    { signal: 'behind_plan', count: summary.behind },
    { signal: 'on_plan', count: summary.on_plan },
    { signal: 'ahead_of_plan', count: summary.ahead },
    { signal: 'insufficient_history', count: summary.insufficient },
  ];

  return (
    <Box
      data-testid="atrisk-path-panel"
      sx={{
        flex: '1 1 50%',
        minWidth: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ px: 1.25, py: 0.5, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
      >
        {t('planner.atRisk.panel.path')}
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems="center"
        justifyContent="center"
        sx={{ flex: 1, minHeight: 0, px: 1.5, py: 1.5, overflow: 'auto' }}
      >
        <Box
          data-testid="atrisk-mix-donut"
          sx={{
            position: 'relative',
            width: { xs: 160, md: 'min(200px, 55%)' },
            aspectRatio: '1 / 1',
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 200 200"
            width="100%"
            height="100%"
            role="img"
            aria-label={t('planner.atRisk.panel.path')}
          >
            {slices.length === 0 ? (
              <circle cx="100" cy="100" r="70" fill="none" stroke="#e0e0e0" strokeWidth="28" />
            ) : (
              slices.map((slice) => {
                const filter = signalToFilter(slice.signal);
                return (
                  <path
                    key={slice.signal}
                    d={slice.path}
                    fill={slice.color}
                    data-testid={`atrisk-donut-slice-${slice.signal}`}
                    style={{ cursor: onSelectFilter && filter ? 'pointer' : undefined }}
                    onClick={() => {
                      if (onSelectFilter && filter) {
                        onSelectFilter(filter);
                      }
                    }}
                  >
                    <title>
                      {SIGNAL_LABELS[slice.signal]}: {slice.count} (
                      {(slice.share * 100).toFixed(0)}%)
                    </title>
                  </path>
                );
              })
            )}
          </svg>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography
              data-testid="atrisk-donut-total"
              sx={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.1 }}
            >
              {total}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
              {t('planner.atRisk.donut.stores')}
            </Typography>
          </Box>
        </Box>

        <Stack spacing={0.75} sx={{ minWidth: 0, width: { xs: '100%', sm: 'auto' }, flex: 1 }}>
          {legendRows.map((row) => {
            const share = total > 0 ? row.count / total : 0;
            const filter = signalToFilter(row.signal);
            return (
              <Stack
                key={row.signal}
                direction="row"
                spacing={1}
                alignItems="center"
                data-testid={`atrisk-donut-legend-${row.signal}`}
                onClick={() => {
                  if (onSelectFilter && filter) {
                    onSelectFilter(filter);
                  }
                }}
                sx={{
                  cursor: onSelectFilter && filter ? 'pointer' : undefined,
                  borderRadius: 1,
                  px: 0.5,
                  py: 0.25,
                  '&:hover': onSelectFilter && filter ? { bgcolor: 'action.hover' } : undefined,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: SIGNAL_COLORS[row.signal],
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {SIGNAL_LABELS[row.signal]}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {row.count}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                >
                  {(share * 100).toFixed(0)}%
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
}
