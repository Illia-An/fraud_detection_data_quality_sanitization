import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
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
  Typography,
} from '@mui/material';

import { useT } from '../../../i18n';
import { periodLabel } from '../../../schemas/plan';
import type { StorePlanActualTable } from '../../../schemas/planActualGap';
import { SIGNAL_LABELS } from '../../../schemas/planMonitoring';
import type { SandboxEvenSplitPreview } from '../../../schemas/sandboxPreview';
import { formatScore, formatSigned } from './storeAuditFormat';
import {
  SANDBOX_OVERLAY_GAP_PX,
  SANDBOX_OVERLAY_MAX_HEIGHT,
  SANDBOX_SUMMARY_RESERVE_PX,
} from './storeAuditLayout';

export interface StoreAuditSandboxPanelProps {
  storeId: number;
  scoreDigits: number;
  sandboxExpanded: boolean;
  onSandboxExpandedChange: (expanded: boolean) => void;
  preview: SandboxEvenSplitPreview | null;
  originalLast: number | null;
  displayTable: StorePlanActualTable | null;
  editableCol: number;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  error: string | null;
  bounds: { min: number; max: number };
  lastPeriod: { year: number; month: number } | undefined;
  appliedDraft: number | null;
  onRecalculate: () => void;
  onApply: () => void;
  onReset: () => void;
  poolDialogOpen: boolean;
  onPoolDialogOpenChange: (open: boolean) => void;
  applyToastOpen: boolean;
  onApplyToastClose: () => void;
  /** Dialog overlays the hero; full-page Inspect keeps the panel in document flow. */
  layout?: 'overlay' | 'inline';
}

/**
 * Inspect Estimate funnel: overlay accordion + plan/actual table + pool dialog + apply toast.
 * State/handlers stay on the drawer orchestrator (props down).
 */
export function StoreAuditSandboxPanel({
  storeId,
  scoreDigits,
  sandboxExpanded,
  onSandboxExpandedChange,
  preview,
  originalLast,
  displayTable,
  editableCol,
  inputValue,
  onInputValueChange,
  error,
  bounds,
  lastPeriod,
  appliedDraft,
  onRecalculate,
  onApply,
  onReset,
  poolDialogOpen,
  onPoolDialogOpenChange,
  applyToastOpen,
  onApplyToastClose,
  layout = 'overlay',
}: StoreAuditSandboxPanelProps) {
  const t = useT();
  const fmt = (value: number) => formatScore(value, scoreDigits);
  const inline = layout === 'inline';

  return (
    <>
      <Box
        data-testid="inspect-sandbox-overlay"
        sx={
          inline
            ? {
                position: 'relative',
                flexShrink: 0,
                maxHeight: 'none',
                overflow: 'visible',
                mt: 0,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: 1,
              }
            : {
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
              }
        }
      >
        <Accordion
          disableGutters
          elevation={0}
          expanded={sandboxExpanded}
          onChange={(_, next) => onSandboxExpandedChange(next)}
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
                label={`Dist ${preview ? fmt(preview.distributed) : '—'}`}
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
                                    onChange={(e) => onInputValueChange(e.target.value)}
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
                                  fmt(score)
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
                                {actual == null ? '—' : fmt(actual)}
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
                    Allowed {fmt(bounds.min)}–{fmt(bounds.max)}
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
                        onClick={onRecalculate}
                        data-testid="inspect-recalculate"
                      >
                        {t('planner.inspect.recalculate')}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={preview == null}
                        onClick={onApply}
                        data-testid="inspect-apply"
                      >
                        {t('planner.inspect.apply')}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        disabled={appliedDraft == null}
                        onClick={onReset}
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
                    <Box
                      component="span"
                      sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}
                    >
                      {preview ? formatSigned(preview.taken) : '—'}
                    </Box>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    Distributed{' '}
                    <Box
                      component="span"
                      sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}
                    >
                      {preview ? preview.distributed.toFixed(2) : '—'}
                    </Box>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    Leftover{' '}
                    <Box
                      component="span"
                      sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}
                    >
                      {preview ? preview.leftover.toFixed(2) : '—'}
                    </Box>
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    disabled={!preview || preview.pool.length === 0}
                    onClick={() => onPoolDialogOpenChange(true)}
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

      <Dialog
        open={poolDialogOpen && preview != null && preview.pool.length > 0}
        onClose={() => onPoolDialogOpenChange(false)}
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
            onClick={() => onPoolDialogOpenChange(false)}
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
                    <TableCell align="right">{fmt(preview.original)}</TableCell>
                    <TableCell align="right">{fmt(preview.draft)}</TableCell>
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
                      <TableCell align="right">{fmt(row.original)}</TableCell>
                      <TableCell align="right">{fmt(row.draft)}</TableCell>
                      <TableCell align="right">{formatSigned(row.applied_delta)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <Button onClick={() => onPoolDialogOpenChange(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={applyToastOpen}
        autoHideDuration={4000}
        onClose={onApplyToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={onApplyToastClose}
          data-testid="inspect-apply-toast"
          sx={{ width: '100%' }}
        >
          {t('planner.inspect.appliedToast')}
        </Alert>
      </Snackbar>
    </>
  );
}
