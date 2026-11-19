import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { RefObject } from 'react';

import { useT } from '../../i18n';
import { momIsDeterioration, type MetricDirection } from '../../schemas/metricScore';
import { SIGNAL_COLORS } from '../../schemas/planMonitoring';
import { FIGMA_EXCEPTION_ROW_HEIGHT_PX } from './figmaPlannerLayout';
import {
  type AtRiskRow,
  atRiskCellSx,
  atRiskHeadSx,
  atRiskStoreHeadSx,
  formatGap,
  formatScore,
  formatVolume,
} from './atRiskRows';

const COL_COUNT = 7;

interface AtRiskExceptionPanelProps {
  rows: AtRiskRow[];
  unit: string;
  direction: MetricDirection;
  onInspect: (storeId: number) => void;
  inspectOnboardingId: string;
  unreachableStoreIds?: ReadonlySet<number>;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
}

/**
 * 60% panel — as-of triage: who is off-plan right now and by how much.
 * Store · Volume · Fact · Plan · Gap · MoM · Inspect.
 */
export function AtRiskExceptionPanel({
  rows,
  unit,
  direction,
  onInspect,
  inspectOnboardingId,
  unreachableStoreIds,
  scrollRef,
  onScroll,
}: AtRiskExceptionPanelProps) {
  const t = useT();

  return (
    <Box
      data-testid="atrisk-exception-panel"
      sx={{
        flex: { xs: '1 1 auto', md: '1 1 50%' },
        minWidth: 0,
        width: { xs: '100%', md: 'auto' },
        maxWidth: { xs: '100%', md: '50%' },
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
        {t('planner.atRisk.panel.exception')}
      </Typography>
      <Box
        ref={scrollRef}
        onScroll={onScroll}
        sx={{ flex: 1, minHeight: 0, overflow: 'auto', scrollbarGutter: 'stable' }}
      >
        <Table size="small" stickyHeader sx={{ '& .MuiTableCell-root': atRiskCellSx }}>
          <TableHead>
            <TableRow>
              <TableCell sx={atRiskStoreHeadSx}>{t('planner.atRisk.col.store')}</TableCell>
              <TableCell align="right" sx={atRiskHeadSx}>
                {t('planner.atRisk.col.volume')}
              </TableCell>
              <TableCell align="right" sx={atRiskHeadSx}>
                {t('planner.atRisk.col.actual')}
              </TableCell>
              <TableCell align="right" sx={atRiskHeadSx}>
                {t('planner.atRisk.col.target')}
              </TableCell>
              <TableCell sx={atRiskHeadSx}>
                {unit === 'min' ? t('ttsPlanner.atRisk.col.gap') : t('planner.atRisk.col.gap')}
              </TableCell>
              <TableCell align="right" sx={atRiskHeadSx}>
                {unit === 'min' ? t('ttsPlanner.atRisk.col.mom') : t('planner.atRisk.col.mom')}
              </TableCell>
              <TableCell
                align="right"
                sx={atRiskHeadSx}
                {...(rows.length === 0 ? { 'data-onboarding': inspectOnboardingId } : {})}
              >
                {t('planner.atRisk.col.action')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COL_COUNT}>
                  <Typography variant="caption" color="text.secondary">
                    {t('planner.atRisk.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIndex) => {
                const negativeGap = row.gapPp != null && row.gapPp < 0;
                const momWorse = momIsDeterioration(row.momPp, direction);
                return (
                  <TableRow
                    key={row.storeId}
                    hover
                    sx={{
                      height: FIGMA_EXCEPTION_ROW_HEIGHT_PX,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => onInspect(row.storeId)}
                  >
                    <TableCell sx={{ ...atRiskCellSx, fontFamily: 'inherit', textAlign: 'left' }}>
                      <Stack spacing={0.15}>
                        <Typography
                          component="span"
                          sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2 }}
                        >
                          {t('planner.atRisk.storeId', { id: row.storeId })}
                        </Typography>
                        <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap>
                          <Chip
                            size="small"
                            label={row.status}
                            sx={{
                              bgcolor: SIGNAL_COLORS[row.signal],
                              color: '#fff',
                              height: 16,
                              fontSize: '0.65rem',
                              alignSelf: 'flex-start',
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                          {unreachableStoreIds?.has(row.storeId) ? (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              label={t('planner.atRisk.mayMiss')}
                              data-testid={`atrisk-may-miss-${row.storeId}`}
                              sx={{
                                height: 16,
                                fontSize: '0.65rem',
                                alignSelf: 'flex-start',
                                '& .MuiChip-label': { px: 0.5 },
                              }}
                            />
                          ) : null}
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatVolume(row.volume)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatScore(row.actual, unit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatScore(row.targetAtAsOf, unit)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={formatGap(row.gapPp, unit)}
                        sx={{
                          height: 18,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          '& .MuiChip-label': { px: 0.6 },
                          ...(negativeGap
                            ? { bgcolor: 'error.light', color: 'error.dark' }
                            : row.gapPp != null && row.gapPp > 0
                              ? { bgcolor: 'success.light', color: 'success.dark' }
                              : {}),
                        }}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        color: momWorse ? 'warning.main' : undefined,
                        fontWeight: momWorse ? 600 : undefined,
                      }}
                    >
                      {formatGap(row.momPp, unit)}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="text"
                        color="primary"
                        endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                        onClick={() => onInspect(row.storeId)}
                        {...(rowIndex === 0 ? { 'data-onboarding': inspectOnboardingId } : {})}
                        sx={{
                          fontWeight: 600,
                          textTransform: 'none',
                          fontSize: '0.7rem',
                          py: 0.25,
                          minHeight: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {t('planner.atRisk.inspect')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
