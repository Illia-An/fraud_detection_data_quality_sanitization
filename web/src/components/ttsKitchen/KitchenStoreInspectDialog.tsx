import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { useT } from '../../i18n';
import { periodLabel } from '../../schemas/tts';
import type { KitchenMonth, KitchenStore } from '../../schemas/ttsKitchen';
import { kitchenPlotPoints } from './kitchenChartData';
import { KitchenMeanChart } from './KitchenMeanChart';

/** Match Sanitization Inspect paper width. */
const INSPECT_DIALOG_PAPER_MAX_PX = 1580;
/** Collapsed months strip reserved so the chart is not covered on md. */
const MONTHS_SUMMARY_RESERVE_PX = 56;
const MONTHS_OVERLAY_GAP_PX = 8;
const MONTHS_OVERLAY_MAX_HEIGHT = '42vh';

interface KitchenStoreInspectDialogProps {
  open: boolean;
  storeId: number | null;
  stores: KitchenStore[];
  minSec: number;
  onClose: () => void;
  onStoreChange: (storeId: number) => void;
}

function formatSec(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

function formatDelta(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} s`;
}

function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(2)}%`;
}

function GlanceCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', fontSize: '0.65rem', lineHeight: 1.2 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.85rem',
          lineHeight: 1.3,
          color: valueColor ?? 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function MonthsTable({ months }: { months: KitchenMonth[] }) {
  const t = useT();
  if (months.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('kitchen.inspect.noMonths')}
      </Typography>
    );
  }
  return (
    <TableContainer data-testid="kitchen-inspect-months">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('kitchen.chart.xAxis')}</TableCell>
            <TableCell align="right">{t('kitchen.inspect.before')}</TableCell>
            <TableCell align="right">{t('kitchen.inspect.after')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {months.map((month) => (
            <TableRow key={periodLabel(month.year, month.month)}>
              <TableCell>{periodLabel(month.year, month.month)}</TableCell>
              <TableCell align="right">{formatSec(month.mean_before_sec)}</TableCell>
              <TableCell align="right">{formatSec(month.mean_after_sec)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Store glance, store chart, and a months strip. Layout matches Sanitization Inspect. */
export function KitchenStoreInspectDialog({
  open,
  storeId,
  stores,
  minSec,
  onClose,
  onStoreChange,
}: KitchenStoreInspectDialogProps) {
  const t = useT();
  const [monthsExpanded, setMonthsExpanded] = useState(false);
  const storeIds = useMemo(
    () => stores.map((store) => store.store_id).sort((a, b) => a - b),
    [stores],
  );
  const effectiveStoreId =
    storeId != null && storeIds.includes(storeId) ? storeId : (storeIds[0] ?? null);
  const store = stores.find((row) => row.store_id === effectiveStoreId) ?? null;
  const months = useMemo(
    () => [...(store?.months ?? [])].sort((a, b) => a.year - b.year || a.month - b.month),
    [store],
  );
  const points = useMemo(() => kitchenPlotPoints(months), [months]);
  const deltaColor =
    store?.delta_sec == null || store.delta_sec === 0
      ? undefined
      : store.delta_sec > 0
        ? 'success.main'
        : 'error.main';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      scroll="paper"
      data-testid="kitchen-store-inspect"
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
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="span"
            variant="subtitle1"
            sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, flexShrink: 0 }}
          >
            {t('kitchen.inspect.titlePrefix')}
          </Typography>
          {storeIds.length > 0 ? (
            <Autocomplete
              size="small"
              options={storeIds}
              value={effectiveStoreId}
              disableClearable={effectiveStoreId != null}
              onChange={(_event, next) => {
                if (next != null) {
                  onStoreChange(next);
                }
              }}
              getOptionLabel={(id) => t('common.storeN', { id })}
              isOptionEqualToValue={(a, b) => a === b}
              filterOptions={(options, state) => {
                const query = state.inputValue.trim().toLowerCase();
                if (!query) {
                  return options;
                }
                return options.filter((id) => {
                  const label = t('common.storeN', { id }).toLowerCase();
                  return String(id).includes(query) || label.includes(query);
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
                    'aria-label': t('kitchen.inspect.storeSelect'),
                    'data-testid': 'kitchen-inspect-store-select',
                  }}
                />
              )}
              data-testid="kitchen-inspect-store-autocomplete"
            />
          ) : (
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              {t('kitchen.chart.empty')}
            </Typography>
          )}
        </Stack>
        <IconButton
          aria-label={t('common.close')}
          onClick={onClose}
          size="small"
          sx={{ p: 0.5 }}
          data-testid="kitchen-inspect-close"
        >
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
        <Stack
          spacing={0.5}
          data-testid="kitchen-inspect-glance"
          sx={{
            flexShrink: 0,
            px: 0.25,
            py: 0.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {effectiveStoreId != null
              ? t('kitchen.inspect.glanceSub', { id: effectiveStoreId })
              : t('kitchen.chart.empty')}
          </Typography>
          {store ? (
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ rowGap: 0.75 }}>
              <GlanceCell label={t('kitchen.inspect.before')} value={formatSec(store.mean_before_sec)} />
              <GlanceCell label={t('kitchen.inspect.after')} value={formatSec(store.mean_after_sec)} />
              <GlanceCell
                label={t('kitchen.inspect.delta')}
                value={formatDelta(store.delta_sec)}
                valueColor={deltaColor}
              />
              <GlanceCell
                label={t('kitchen.inspect.positions')}
                value={store.rows_in.toLocaleString()}
              />
              <GlanceCell
                label={t('kitchen.inspect.removed')}
                value={`${store.rows_dropped.toLocaleString()} · ${formatPct(store.pct_dropped)}`}
              />
            </Stack>
          ) : null}
        </Stack>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            pb: {
              xs: 0,
              md: `${MONTHS_SUMMARY_RESERVE_PX + MONTHS_OVERLAY_GAP_PX}px`,
            },
          }}
        >
          <Box data-testid="kitchen-inspect-chart" sx={{ flex: 1, minHeight: 280, overflow: 'auto' }}>
            <KitchenMeanChart
              points={points}
              minSec={minSec}
              showFit
              legendTestId="kitchen-inspect-legend"
              actualTestId="kitchen-inspect-legend-actual"
              afterTestId="kitchen-inspect-legend-after"
              fitTestId="kitchen-inspect-fit"
            />
          </Box>
        </Box>

        <Box
          data-testid="kitchen-inspect-months-overlay"
          sx={{
            position: { xs: 'relative', md: 'absolute' },
            left: { md: 16 },
            right: { md: 16 },
            bottom: { md: MONTHS_OVERLAY_GAP_PX },
            zIndex: { md: 3 },
            flexShrink: 0,
            maxHeight: { md: MONTHS_OVERLAY_MAX_HEIGHT },
            overflow: { md: 'auto' },
            mt: { xs: 1.5, md: 0 },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: { md: monthsExpanded ? 8 : 2 },
          }}
        >
          <Accordion
            disableGutters
            elevation={0}
            expanded={monthsExpanded}
            onChange={(_event, next) => setMonthsExpanded(next)}
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              bgcolor: 'transparent',
            }}
            data-testid="kitchen-inspect-months-panel"
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
                <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2 }}>
                  {t('kitchen.inspect.months')}
                </Typography>
                <Typography
                  component="span"
                  color="text.secondary"
                  sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}
                >
                  {t('kitchen.inspect.monthsPanelSub', { count: months.length })}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails
              sx={{
                pt: 0,
                maxHeight: {
                  md: `calc(${MONTHS_OVERLAY_MAX_HEIGHT} - ${MONTHS_SUMMARY_RESERVE_PX}px)`,
                },
                overflow: 'auto',
              }}
            >
              {monthsExpanded ? <MonthsTable months={months} /> : null}
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} data-testid="kitchen-inspect-close-action">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
