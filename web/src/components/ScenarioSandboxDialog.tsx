import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useEffect, useState } from 'react';

import type { FivePercentPlan } from '../schemas/plan';
import { periodLabel } from '../schemas/plan';
import type { PlanMonitoringInsights, StoreMonitorRow } from '../schemas/planMonitoring';
import { SIGNAL_COLORS, SIGNAL_LABELS } from '../schemas/planMonitoring';
import type { SanitizedPanel } from '../schemas/sanitizedPanel';
import {
  clipSandboxScore,
  previewSandboxEvenSplit,
  sandboxScoreBounds,
  type SandboxEvenSplitPreview,
} from '../schemas/sandboxPreview';

interface ScenarioSandboxDialogProps {
  open: boolean;
  storeId: number;
  plan: FivePercentPlan;
  panel: SanitizedPanel;
  insights: PlanMonitoringInsights;
  maxMonthlyImprove: number;
  onClose: () => void;
}

function panelActual(
  panel: SanitizedPanel,
  storeId: number,
  year: number,
  month: number,
): number | null {
  const row = panel.rows.find(
    (r) => r.store_id === storeId && r.year === year && r.month === month,
  );
  return row?.five_percent ?? null;
}

export function ScenarioSandboxDialog({
  open,
  storeId,
  plan,
  panel,
  insights,
  maxMonthlyImprove,
  onClose,
}: ScenarioSandboxDialogProps) {
  const projection = plan.projections.find((p) => p.store_id === storeId);
  const monitorRow: StoreMonitorRow | undefined = insights.stores.find(
    (s) => s.store_id === storeId,
  );
  const periods = plan.chain_trajectory;
  const lastIdx = periods.length - 1;
  const lastPeriod = periods[lastIdx];
  const originalLast =
    projection?.months.find((m) => m.year === lastPeriod.year && m.month === lastPeriod.month)
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

  const [inputValue, setInputValue] = useState<string>(
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

  const displayLast = appliedDraft ?? originalLast;

  const handleRecalculate = () => {
    if (originalLast == null || projection == null) {
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
        return {
          store_id: row.store_id,
          last,
          signal: row.signal,
        };
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
    if (originalLast == null) {
      return;
    }
    setInputValue(originalLast.toFixed(1));
    setAppliedDraft(null);
    setPreview(null);
    setError(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Typography component="span" variant="h6" sx={{ flex: 1 }}>
          Sandbox scenario · Store {storeId}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Draft what-if only — does not mutate the plan on this page, Export CSV, or any database.
          Close or Reset draft to discard sandbox edits.
        </Alert>

        {!projection || originalLast == null ? (
          <Typography>No plan projection for this store.</Typography>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Estimate vs actual
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Edit last-month estimate (in range), then Recalculate. Out-of-range values are
                rejected.
              </Typography>
              <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      {periods.map((period) => (
                        <TableCell
                          key={periodLabel(period.year, period.month)}
                          align="center"
                          sx={{
                            fontWeight:
                              period.year === lastPeriod.year &&
                              period.month === lastPeriod.month
                                ? 700
                                : 400,
                          }}
                        >
                          {periodLabel(period.year, period.month)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>estimate</TableCell>
                      {periods.map((period, index) => {
                        const score = projection.months.find(
                          (m) => m.year === period.year && m.month === period.month,
                        )?.score;
                        const isLast = index === lastIdx;
                        return (
                          <TableCell key={`e-${periodLabel(period.year, period.month)}`} align="center">
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
                      {periods.map((period) => {
                        const actual = panelActual(panel, storeId, period.year, period.month);
                        return (
                          <TableCell key={`a-${periodLabel(period.year, period.month)}`} align="center">
                            {actual == null ? '—' : actual.toFixed(1)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>difference</TableCell>
                      {periods.map((period, index) => {
                        const estimate =
                          index === lastIdx
                            ? displayLast
                            : projection.months.find(
                                (m) => m.year === period.year && m.month === period.month,
                              )?.score;
                        const actual = panelActual(panel, storeId, period.year, period.month);
                        const diff =
                          estimate == null || actual == null ? null : actual - estimate;
                        return (
                          <TableCell key={`d-${periodLabel(period.year, period.month)}`} align="center">
                            {diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
              {error && (
                <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
                  {error}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <Button variant="outlined" onClick={handleRecalculate}>
                  Recalculate
                </Button>
                {appliedDraft != null && (
                  <Button variant="text" onClick={handleReset}>
                    Reset draft
                  </Button>
                )}
              </Stack>
            </Box>

            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Taken
                </Typography>
                <Typography variant="h6">
                  {preview ? `${preview.taken > 0 ? '+' : ''}${preview.taken.toFixed(2)}` : '—'}
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
              {monitorRow && (
                <Chip
                  size="small"
                  label={SIGNAL_LABELS[monitorRow.signal]}
                  sx={{ bgcolor: SIGNAL_COLORS[monitorRow.signal], color: '#fff', alignSelf: 'center' }}
                />
              )}
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
                      <TableCell align="right">
                        {preview.taken > 0 ? '+' : ''}
                        {preview.taken.toFixed(2)}
                      </TableCell>
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
                        <TableCell align="right">
                          {row.applied_delta > 0 ? '+' : ''}
                          {row.applied_delta.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
