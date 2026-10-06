import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { useT } from '../../i18n';
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
  applySandboxEvenSplitToPlan,
  clipSandboxScore,
  previewSandboxEvenSplit,
  sandboxScoreBounds,
  type SandboxEvenSplitPreview,
} from '../../schemas/sandboxPreview';
import { StoreHeroEvaluationChart } from './StoreHeroEvaluationChart';
import { InspectStoreGlance } from './InspectStoreGlance';
import type { StoreBaselineRow } from './atRiskRowMetrics';

/** EXP: large Inspect dialog — room for store Hero + sandbox (~+13% vs 1400). */
const INSPECT_DIALOG_PAPER_MAX_PX = 1580;
/** Collapsed Estimate funnel strip reserved so Hero is not covered. */
const SANDBOX_SUMMARY_RESERVE_PX = 56;
const SANDBOX_OVERLAY_GAP_PX = 8;
/** Expanded Estimate overlay cap — chart underneath keeps space. */
const SANDBOX_OVERLAY_MAX_HEIGHT = '42vh';
/** Min plot height when chart fills remaining Inspect pane. */
const STORE_HERO_IN_DIALOG_MIN_PX = 280;

interface StoreAuditDrawerProps {
  open: boolean;
  storeId: number;
  plan: FivePercentPlan;
  panel: SanitizedPanel;
  insights: PlanMonitoringInsights;
  processResult: ProcessResponse | null;
  maxMonthlyImprove: number;
  /** Reference-month baseline scores (Baseline → End). */
  baselineRows?: StoreBaselineRow[];
  onClose: () => void;
  /** Switch Inspected store without closing the dialog. */
  onStoreChange: (storeId: number) => void;
  /** Commit even-split into session draftPlan (Hero updates; Inspect stays open). */
  onApplyPlan: (plan: FivePercentPlan) => void;
}

function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

/**
 * V4.2 Component F — store audit + ephemeral sandbox.
 * EXP layout: full-width Store Hero · accordion panels below (At-risk style).
 */
export function StoreAuditDrawer({
  open,
  storeId,
  plan,
  panel,
  insights,
  processResult,
  maxMonthlyImprove,
  baselineRows = [],
  onClose,
  onStoreChange,
  onApplyPlan,
}: StoreAuditDrawerProps) {
  const t = useT();
  const storeIds = useMemo(
    () =>
      [...new Set(plan.projections.map((p) => p.store_id))].sort((a, b) => a - b),
    [plan.projections],
  );
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

  const steps = processResult ? sortPipelineSteps(processResult.steps) : [];
  const echo = panel.echo_config;

  const [inputValue, setInputValue] = useState(
    originalLast == null ? '' : originalLast.toFixed(1),
  );
  const [appliedDraft, setAppliedDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SandboxEvenSplitPreview | null>(null);
  /** Estimate funnel — collapsed by default (Pipeline steps / At-risk pattern). */
  const [sandboxExpanded, setSandboxExpanded] = useState(false);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [applyToastOpen, setApplyToastOpen] = useState(false);

  useEffect(() => {
    if (open && originalLast != null) {
      setInputValue(originalLast.toFixed(1));
      setAppliedDraft(null);
      setPreview(null);
      setError(null);
      setSandboxExpanded(false);
      setPoolDialogOpen(false);
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

  const clearLocalSandbox = () => {
    if (originalLast != null) {
      setInputValue(originalLast.toFixed(1));
    }
    setAppliedDraft(null);
    setPreview(null);
    setError(null);
    setPoolDialogOpen(false);
  };

  const handleApply = () => {
    if (!preview || !lastPeriod) {
      return;
    }
    const next = applySandboxEvenSplitToPlan(
      plan,
      preview,
      lastPeriod.year,
      lastPeriod.month,
    );
    onApplyPlan(next);
    clearLocalSandbox();
    setApplyToastOpen(true);
  };

  /** Clears Estimate preview only — session draft revert lives on Planner. */
  const handleReset = () => {
    clearLocalSandbox();
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      scroll="paper"
      data-testid="store-inspect-dialog"
      PaperProps={{
        sx: {
          height: { xs: '100%', md: '90vh' },
          maxHeight: { xs: '100%', md: '90vh' },
          m: { xs: 0, md: 2 },
          width: { xs: '100%', md: 'calc(100% - 32px)' },
          maxWidth: { md: INSPECT_DIALOG_PAPER_MAX_PX },
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          py: 1,
          px: 2,
          pr: 1,
          minHeight: 0,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{ flex: 1, minWidth: 0 }}
        >
          <Typography
            component="span"
            variant="subtitle1"
            sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, flexShrink: 0 }}
          >
            {t('planner.inspect.titlePrefix')}
          </Typography>
          <Autocomplete
            size="small"
            options={storeIds}
            value={storeId}
            disableClearable
            onChange={(_event, next) => {
              if (next != null && next !== storeId) {
                onStoreChange(next);
              }
            }}
            getOptionLabel={(id) => t('common.storeN', { id })}
            isOptionEqualToValue={(a, b) => a === b}
            filterOptions={(options, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) {
                return options;
              }
              return options.filter((id) => {
                const label = t('common.storeN', { id }).toLowerCase();
                return String(id).includes(q) || label.includes(q);
              });
            }}
            sx={{ width: { xs: 148, sm: 176 }, flexShrink: 0 }}
            slotProps={{
              listbox: { sx: { maxHeight: 280 } },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                inputProps={{
                  ...params.inputProps,
                  'aria-label': t('planner.inspect.storeSelect'),
                  'data-testid': 'inspect-store-select',
                }}
              />
            )}
            data-testid="inspect-store-autocomplete"
          />
        </Stack>
        {monitorRow && (
          <Chip
            size="small"
            label={SIGNAL_LABELS[monitorRow.signal]}
            sx={{
              bgcolor: SIGNAL_COLORS[monitorRow.signal],
              color: '#fff',
              height: 22,
              fontSize: '0.7rem',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
        <Tooltip
          title={t('planner.inspect.sandboxWarn')}
          arrow
          enterDelay={200}
          slotProps={{
            tooltip: {
              sx: { maxWidth: 320, fontSize: '0.75rem', lineHeight: 1.35 },
            },
          }}
        >
          <IconButton
            size="small"
            aria-label={t('planner.inspect.sandboxWarn')}
            sx={{ p: 0.4, color: 'warning.main' }}
            data-testid="inspect-sandbox-warn"
          >
            <WarningAmberIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip
          arrow
          enterDelay={200}
          slotProps={{
            tooltip: {
              sx: {
                maxWidth: 340,
                bgcolor: 'background.paper',
                color: 'text.primary',
                border: 1,
                borderColor: 'divider',
                boxShadow: 3,
                p: 1.25,
              },
            },
          }}
          title={
            <Stack spacing={0.75} data-testid="inspect-audit-tooltip">
              <Typography variant="caption" fontWeight={700} display="block">
                {t('planner.inspect.auditPanel')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('planner.inspect.auditHint')}
              </Typography>
              <Stack spacing={0.35}>
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
            </Stack>
          }
        >
          <IconButton
            size="small"
            aria-label={t('planner.inspect.auditPanel')}
            sx={{ p: 0.4, color: 'text.secondary' }}
            data-testid="inspect-audit-info"
          >
            <PolicyOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton aria-label={t('common.close')} onClick={onClose} size="small" sx={{ p: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          py: 1.5,
          px: 2,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <InspectStoreGlance
          plan={plan}
          insights={insights}
          storeId={storeId}
          baselineRows={baselineRows}
          draftLast={appliedDraft}
        />
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            pb: {
              xs: 0,
              md: `${SANDBOX_SUMMARY_RESERVE_PX + SANDBOX_OVERLAY_GAP_PX}px`,
            },
          }}
        >
          <StoreHeroEvaluationChart
            plan={plan}
            storeId={storeId}
            panel={panel}
            insights={insights}
            draftLast={appliedDraft}
            plotHeightPx={STORE_HERO_IN_DIALOG_MIN_PX}
            fillParent
          />
        </Box>

        <Box
          data-testid="inspect-sandbox-overlay"
          sx={{
            position: { xs: 'relative', md: 'absolute' },
            left: { md: 16 },
            right: { md: 16 },
            bottom: { md: SANDBOX_OVERLAY_GAP_PX },
            zIndex: { md: 3 },
            flexShrink: 0,
            maxHeight: { md: SANDBOX_OVERLAY_MAX_HEIGHT },
            overflow: { md: 'auto' },
            mt: { xs: 1.5, md: 0 },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: { md: sandboxExpanded ? 8 : 2 },
          }}
        >
          <Accordion
            disableGutters
            elevation={0}
            expanded={sandboxExpanded}
            onChange={(_, next) => setSandboxExpanded(next)}
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              bgcolor: 'transparent',
            }}
            data-testid="inspect-sandbox-panel"
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48, py: 0 }}>
              <Stack
                direction="row"
                alignItems="baseline"
                spacing={0.75}
                flexWrap="wrap"
                useFlexGap
                sx={{ pr: 1, minWidth: 0, flex: 1 }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2 }}
                >
                  {t('planner.inspect.sandboxPanel')}
                </Typography>
                <Typography
                  component="span"
                  color="text.secondary"
                  sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}
                >
                  {t('planner.inspect.sandboxPanelSub')}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto', mr: 1 }}>
                <Chip size="small" label={`Taken ${preview ? formatSigned(preview.taken) : '—'}`} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Dist ${preview ? preview.distributed.toFixed(1) : '—'}`}
                />
              </Stack>
            </AccordionSummary>
            <AccordionDetails
              sx={{
                pt: 0,
                maxHeight: {
                  md: `calc(${SANDBOX_OVERLAY_MAX_HEIGHT} - ${SANDBOX_SUMMARY_RESERVE_PX}px)`,
                },
                overflow: 'auto',
              }}
            >
            <Stack spacing={1.5}>
              {originalLast == null || !displayTable ? (
                <Typography variant="body2" color="text.secondary">
                  {t('planner.inspect.noProjection')}
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
                              {col.isAsOf ? t('planner.inspect.asOfSuffix') : ''}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {t('planner.inspect.estimate')}
                          </TableCell>
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
                          <TableCell sx={{ fontWeight: 600 }}>
                            {t('planner.inspect.actual')}
                          </TableCell>
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
                </Stack>
              )}

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                useFlexGap
                spacing={1.5}
                sx={{ pt: originalLast == null || !displayTable ? 0 : 0.5 }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {originalLast != null && displayTable ? (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleRecalculate}
                        data-testid="inspect-recalculate"
                      >
                        {t('planner.inspect.recalculate')}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={preview == null}
                        onClick={handleApply}
                        data-testid="inspect-apply"
                      >
                        {t('planner.inspect.apply')}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        disabled={appliedDraft == null}
                        onClick={handleReset}
                        data-testid="inspect-reset"
                      >
                        {t('planner.inspect.reset')}
                      </Button>
                    </>
                  ) : null}
                </Stack>
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <Typography variant="caption" color="text.secondary" component="span">
                    Taken{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                      {preview ? formatSigned(preview.taken) : '—'}
                    </Box>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    Distributed{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                      {preview ? preview.distributed.toFixed(2) : '—'}
                    </Box>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    Leftover{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                      {preview ? preview.leftover.toFixed(2) : '—'}
                    </Box>
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    disabled={!preview || preview.pool.length === 0}
                    onClick={() => setPoolDialogOpen(true)}
                    data-testid="inspect-view-pool"
                  >
                    {t('planner.inspect.viewPool')}
                    {preview ? ` (${preview.pool.length + 1})` : ''}
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </AccordionDetails>
        </Accordion>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="contained" onClick={onClose}>
          {t('common.close')}
        </Button>
      </DialogActions>

      <Dialog
        open={poolDialogOpen && preview != null && preview.pool.length > 0}
        onClose={() => setPoolDialogOpen(false)}
        fullWidth
        maxWidth="md"
        data-testid="inspect-pool-dialog"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1, py: 1.25 }}>
          <Typography component="span" variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
            {t('planner.inspect.poolPanel')}
            {preview ? ` (${preview.pool.length + 1})` : ''}
          </Typography>
          <IconButton
            aria-label={t('common.close')}
            onClick={() => setPoolDialogOpen(false)}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {t('planner.inspect.poolHint')}
          </Typography>
          {preview ? (
            <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
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
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <Button onClick={() => setPoolDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
    <Snackbar
      open={applyToastOpen}
      autoHideDuration={4000}
      onClose={() => setApplyToastOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="success"
        variant="filled"
        onClose={() => setApplyToastOpen(false)}
        data-testid="inspect-apply-toast"
        sx={{ width: '100%' }}
      >
        {t('planner.inspect.appliedToast')}
      </Alert>
    </Snackbar>
    </>
  );
}
