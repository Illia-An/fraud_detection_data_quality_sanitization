import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import type { ProcessResponse } from '../../schemas/api';
import { PIPELINE_STEP_LABELS, sortPipelineSteps } from '../../schemas/api';
import type { FivePercentPlan } from '../../schemas/plan';
import { periodLabel } from '../../schemas/plan';
import {
  applyDraftLastMonthToTable,
  buildStorePlanActualDifferenceTable,
  lastEstimateIndex,
} from '../../schemas/planActualGap';
import type { PlanMonitoringInsights, StoreMonitorRow } from '../../schemas/planMonitoring';
import { SIGNAL_COLORS, SIGNAL_LABELS } from '../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';
import {
  clipSandboxScore,
  previewSandboxEvenSplit,
  sandboxScoreBounds,
  type SandboxEvenSplitPreview,
} from '../../schemas/sandboxPreview';
import { PlanActualLens } from './PlanActualLens';

const DRAWER_WIDTH_PX = 460;

interface StoreAuditDrawerProps {
  open: boolean;
  storeId: number;
  plan: FivePercentPlan;
  panel: SanitizedPanel;
  insights: PlanMonitoringInsights;
  processResult: ProcessResponse | null;
  maxMonthlyImprove: number;
  onClose: () => void;
}

function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

/** V4.2 Component F — store audit + A-full ephemeral sandbox (lens · table · pool). */
export function StoreAuditDrawer({
  open,
  storeId,
  plan,
  panel,
  insights,
  processResult,
  maxMonthlyImprove,
  onClose,
}: StoreAuditDrawerProps) {
  const projection = plan.projections.find((p) => p.store_id === storeId);
  const monitorRow: StoreMonitorRow | undefined = insights.stores.find(
    (s) => s.store_id === storeId,
  );
  const periods = plan.chain_trajectory;
  const lastIdx = periods.length - 1;
  const lastPeriod = periods[lastIdx];
  const originalLast =
    projection?.months.find((m) => m.year === lastPeriod?.year && m.month === lastPeriod?.month)
      ?.score ?? null;
  const previous =
    lastIdx > 0
      ? projection?.months.find(
          (m) =>
            m.year === periods[lastIdx - 1].year && m.month === periods[lastIdx - 1].month,
        )?.score ?? null
      : null;

  const bounds =
    originalLast == null
      ? { min: 0, max: 100 }
      : sandboxScoreBounds(previous, originalLast, maxMonthlyImprove);

  const history = useMemo(() => {
    return panel.rows
      .filter((row) => row.store_id === storeId)
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .slice(-12);
  }, [panel.rows, storeId]);

  const steps = processResult ? sortPipelineSteps(processResult.steps) : [];
  const echo = panel.echo_config;

  const [inputValue, setInputValue] = useState(
    originalLast == null ? '' : originalLast.toFixed(1),
  );
  const [appliedDraft, setAppliedDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SandboxEvenSplitPreview | null>(null);

  useEffect(() => {
    if (open && originalLast != null) {
      setInputValue(originalLast.toFixed(1));
      setAppliedDraft(null);
      setPreview(null);
      setError(null);
    }
  }, [open, storeId, originalLast]);

  const baseTable = useMemo(
    () => buildStorePlanActualDifferenceTable(plan, storeId, panel, insights, monitorRow),
    [plan, storeId, panel, insights, monitorRow],
  );

  const displayTable = useMemo(() => {
    if (!baseTable) return null;
    return applyDraftLastMonthToTable(baseTable, appliedDraft, plan.direction);
  }, [baseTable, appliedDraft, plan.direction]);

  const editableCol = displayTable ? lastEstimateIndex(displayTable) : -1;

  const handleRecalculate = () => {
    if (originalLast == null || projection == null || !lastPeriod) {
      return;
    }
    const parsed = Number(inputValue);
    if (Number.isNaN(parsed)) {
      setError('Enter a valid number.');
      return;
    }
    if (parsed < bounds.min - 1e-9 || parsed > bounds.max + 1e-9) {
      setError(
        `Value out of range. Enter a value between ${bounds.min.toFixed(1)} and ${bounds.max.toFixed(1)}.`,
      );
      return;
    }
    const draft = clipSandboxScore(parsed, bounds);
    setError(null);
    setAppliedDraft(draft);
    const others = insights.stores
      .filter((row) => row.store_id !== storeId)
      .map((row) => {
        const last =
          plan.projections
            .find((p) => p.store_id === row.store_id)
            ?.months.find((m) => m.year === lastPeriod.year && m.month === lastPeriod.month)
            ?.score ?? row.planned ?? 0;
        return { store_id: row.store_id, last, signal: row.signal };
      });
    setPreview(
      previewSandboxEvenSplit({
        selectedStoreId: storeId,
        selectedSignal: monitorRow?.signal ?? 'on_plan',
        originalLast,
        proposedLast: draft,
        previousScore: previous,
        others,
        maxMonthlyImprove,
      }),
    );
  };

  const handleReset = () => {
    if (originalLast == null) return;
    setInputValue(originalLast.toFixed(1));
    setAppliedDraft(null);
    setPreview(null);
    setError(null);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: DRAWER_WIDTH_PX },
          maxWidth: '100%',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="h6" sx={{ flex: 1 }}>
            Store {storeId}
          </Typography>
          {monitorRow && (
            <Chip
              size="small"
              label={SIGNAL_LABELS[monitorRow.signal]}
              sx={{ bgcolor: SIGNAL_COLORS[monitorRow.signal], color: '#fff' }}
            />
          )}
          <IconButton aria-label="Close" onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={2}>
            <Alert severity="info">
              Draft what-if only — does not mutate the accepted plan, Export CSV, or DB.
            </Alert>

            <PlanActualLens
              plan={plan}
              storeId={storeId}
              panel={panel}
              insights={insights}
              draftLast={appliedDraft}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Estimate vs actual
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Edit last-month estimate (in range), then Recalculate. Out-of-range values are
                rejected.
              </Typography>
              {originalLast == null || !displayTable ? (
                <Typography variant="body2" color="text.secondary">
                  No projection for this store.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  <Box
                    sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell />
                          {displayTable.columns.map((col, index) => (
                            <TableCell
                              key={col.label}
                              align="center"
                              sx={{
                                fontWeight: index === editableCol || col.isAsOf ? 700 : 400,
                              }}
                            >
                              {col.label}
                              {col.isAsOf ? ' · as of' : ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>estimate</TableCell>
                          {displayTable.columns.map((col, index) => {
                            const score = displayTable.estimate[index];
                            const isLast = index === editableCol;
                            return (
                              <TableCell key={`e-${col.label}`} align="center">
                                {isLast ? (
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    error={Boolean(error)}
                                    inputProps={{
                                      min: bounds.min,
                                      max: bounds.max,
                                      step: 0.1,
                                      'aria-label': `Last month estimate (${col.label})`,
                                      style: { width: 72, textAlign: 'center' },
                                    }}
                                  />
                                ) : score == null ? (
                                  '—'
                                ) : (
                                  score.toFixed(1)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>actual</TableCell>
                          {displayTable.columns.map((col, index) => {
                            const actual = displayTable.actual[index];
                            return (
                              <TableCell key={`a-${col.label}`} align="center">
                                {actual == null ? '—' : actual.toFixed(1)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>difference</TableCell>
                          {displayTable.columns.map((col, index) => {
                            const diff = displayTable.difference[index];
                            return (
                              <TableCell key={`d-${col.label}`} align="center">
                                {diff == null ? '—' : formatSigned(diff, 1)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Box>
                  {error && (
                    <Typography color="error" variant="caption">
                      {error}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Allowed {bounds.min.toFixed(1)}–{bounds.max.toFixed(1)}
                    {lastPeriod
                      ? ` · last ${periodLabel(lastPeriod.year, lastPeriod.month)}`
                      : ''}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={handleRecalculate}>
                      Recalculate
                    </Button>
                    {appliedDraft != null && (
                      <Button variant="text" onClick={handleReset}>
                        Reset draft
                      </Button>
                    )}
                  </Stack>
                </Stack>
              )}
            </Box>

            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Taken
                </Typography>
                <Typography variant="h6">
                  {preview ? formatSigned(preview.taken) : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Distributed
                </Typography>
                <Typography variant="h6">
                  {preview ? preview.distributed.toFixed(2) : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Leftover
                </Typography>
                <Typography variant="h6">
                  {preview ? preview.leftover.toFixed(2) : '—'}
                </Typography>
              </Box>
            </Stack>

            {preview && preview.pool.length > 0 && (
              <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ p: 1, pb: 0 }}>
                  Counterpart pool (even split)
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Store</TableCell>
                      <TableCell>Signal</TableCell>
                      <TableCell align="right">Original</TableCell>
                      <TableCell align="right">Draft</TableCell>
                      <TableCell align="right">Δ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{storeId}</TableCell>
                      <TableCell>selected</TableCell>
                      <TableCell align="right">{preview.original.toFixed(1)}</TableCell>
                      <TableCell align="right">{preview.draft.toFixed(1)}</TableCell>
                      <TableCell align="right">{formatSigned(preview.taken)}</TableCell>
                    </TableRow>
                    {preview.pool.map((row) => (
                      <TableRow key={row.store_id}>
                        <TableCell>{row.store_id}</TableCell>
                        <TableCell>
                          {row.signal === 'selected'
                            ? 'selected'
                            : SIGNAL_LABELS[row.signal as keyof typeof SIGNAL_LABELS]}
                        </TableCell>
                        <TableCell align="right">{row.original.toFixed(1)}</TableCell>
                        <TableCell align="right">{row.draft.toFixed(1)}</TableCell>
                        <TableCell align="right">{formatSigned(row.applied_delta)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Cleansed history (up to 12 months)
              </Typography>
              <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell>
                      <TableCell align="right">5%</TableCell>
                      <TableCell align="right">Volume</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="caption" color="text.secondary">
                            No panel rows for this store.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((row) => (
                        <TableRow key={periodLabel(row.year, row.month)}>
                          <TableCell>{periodLabel(row.year, row.month)}</TableCell>
                          <TableCell align="right">{row.five_percent.toFixed(1)}</TableCell>
                          <TableCell align="right">{row.survey_volume}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Rule audit (network sanitization)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Tier toggles from last Sanitization run (not store-specific drop logs).
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="caption">
                  Tier2 freq ≥ {echo.tier2_freq_threshold}
                  {echo.tier2_freq_enabled ? '' : ' (off)'}
                </Typography>
                <Typography variant="caption">
                  Tier3 always-5{' '}
                  {echo.tier3_always_five_enabled
                    ? `min n ${echo.tier3_always_five_min_n}`
                    : 'off'}
                </Typography>
                <Typography variant="caption">
                  Tier4 store×month {echo.tier4_enabled ? 'on' : 'off'}
                </Typography>
                {steps.map((step) => (
                  <Typography key={step.step_name} variant="caption" color="text.secondary">
                    {PIPELINE_STEP_LABELS[step.step_name]} · drop {step.rows_dropped} ·{' '}
                    {step.top_box_pct.toFixed(1)}%
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button fullWidth variant="contained" onClick={onClose}>
            Close
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
