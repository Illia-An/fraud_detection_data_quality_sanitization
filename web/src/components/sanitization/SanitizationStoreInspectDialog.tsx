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
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { useT } from '../../i18n';
import type { PipelineConfig, StoreImpactPoint, StoreMonthCell } from '../../schemas/api';
import { getStoreIds } from '../charts/storeImpactChartData';
import { FlaggedMonthsTable } from '../FlaggedMonthsTable';
import { StoreImpactChart } from '../StoreImpactChart';
import { SanitizationInspectGlance } from './SanitizationInspectGlance';

/** Match Planner Inspect paper width. */
const INSPECT_DIALOG_PAPER_MAX_PX = 1580;
/** Collapsed Flagged strip reserved so chart is not covered on md. */
const FLAGGED_SUMMARY_RESERVE_PX = 56;
const FLAGGED_OVERLAY_GAP_PX = 8;
const FLAGGED_OVERLAY_MAX_HEIGHT = '42vh';

interface SanitizationStoreInspectDialogProps {
  open: boolean;
  storeId: number | null;
  series: StoreImpactPoint[];
  highStoreMonths: StoreMonthCell[];
  echoConfig: PipelineConfig | null;
  onClose: () => void;
  /** Switch Inspected store without closing (Planner-style). */
  onStoreChange?: (storeId: number) => void;
}

function collectInspectStoreIds(
  series: StoreImpactPoint[],
  highStoreMonths: StoreMonthCell[],
): number[] {
  const ids = new Set<number>(getStoreIds(series));
  for (const row of highStoreMonths) {
    ids.add(row.store_id);
  }
  return [...ids].sort((a, b) => a - b);
}

/** Store-level impact + flagged months — spatial layout mirrors Planner Inspect. */
export function SanitizationStoreInspectDialog({
  open,
  storeId,
  series,
  highStoreMonths,
  echoConfig,
  onClose,
  onStoreChange,
}: SanitizationStoreInspectDialogProps) {
  const t = useT();
  const [flaggedExpanded, setFlaggedExpanded] = useState(false);

  const storeIds = useMemo(
    () => collectInspectStoreIds(series, highStoreMonths),
    [series, highStoreMonths],
  );

  const effectiveStoreId =
    storeId != null && storeIds.includes(storeId) ? storeId : (storeIds[0] ?? null);

  const flaggedCount = useMemo(
    () => highStoreMonths.filter((row) => row.flagged).length,
    [highStoreMonths],
  );

  const canSwitchStore = Boolean(onStoreChange) && storeIds.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      scroll="paper"
      data-testid="sanitization-store-inspect"
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
            {t('sanitization.inspect.titlePrefix')}
          </Typography>
          {canSwitchStore ? (
            <Autocomplete
              size="small"
              options={storeIds}
              value={effectiveStoreId}
              disableClearable={effectiveStoreId != null}
              onChange={(_event, next) => {
                if (next != null && onStoreChange) {
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
                    'aria-label': t('sanitization.inspect.storeSelect'),
                    'data-testid': 'sanitization-inspect-store-select',
                  }}
                />
              )}
              data-testid="sanitization-inspect-store-autocomplete"
            />
          ) : (
            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              {effectiveStoreId != null
                ? t('common.storeN', { id: effectiveStoreId })
                : t('sanitization.inspect.title')}
            </Typography>
          )}
        </Stack>
        <IconButton
          aria-label={t('common.close')}
          onClick={onClose}
          size="small"
          sx={{ p: 0.5 }}
          data-testid="sanitization-inspect-close"
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
        <SanitizationInspectGlance
          storeId={effectiveStoreId}
          series={series}
          highStoreMonths={highStoreMonths}
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
              md: `${FLAGGED_SUMMARY_RESERVE_PX + FLAGGED_OVERLAY_GAP_PX}px`,
            },
          }}
        >
          <Box
            data-testid="sanitization-inspect-chart"
            sx={{ flex: 1, minHeight: 280, overflow: 'auto' }}
          >
            <StoreImpactChart
              series={series}
              highStoreMonths={highStoreMonths}
              echoConfig={echoConfig}
              layout="store"
              framed={false}
              storeSelect={false}
            />
          </Box>
        </Box>

        <Box
          data-testid="sanitization-inspect-flagged-overlay"
          sx={{
            position: { xs: 'relative', md: 'absolute' },
            left: { md: 16 },
            right: { md: 16 },
            bottom: { md: FLAGGED_OVERLAY_GAP_PX },
            zIndex: { md: 3 },
            flexShrink: 0,
            maxHeight: { md: FLAGGED_OVERLAY_MAX_HEIGHT },
            overflow: { md: 'auto' },
            mt: { xs: 1.5, md: 0 },
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: { md: flaggedExpanded ? 8 : 2 },
          }}
        >
          <Accordion
            disableGutters
            elevation={0}
            expanded={flaggedExpanded}
            onChange={(_event, next) => setFlaggedExpanded(next)}
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              bgcolor: 'transparent',
            }}
            data-testid="sanitization-inspect-flagged-panel"
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
                  {t('flagged.title')}
                </Typography>
                <Typography
                  component="span"
                  color="text.secondary"
                  sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}
                >
                  {t('sanitization.inspect.flaggedPanelSub', { count: flaggedCount })}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails
              sx={{
                pt: 0,
                maxHeight: {
                  md: `calc(${FLAGGED_OVERLAY_MAX_HEIGHT} - ${FLAGGED_SUMMARY_RESERVE_PX}px)`,
                },
                overflow: 'auto',
              }}
            >
              {flaggedExpanded ? (
                <FlaggedMonthsTable rows={highStoreMonths} variant="panel" />
              ) : null}
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} data-testid="sanitization-inspect-close-action">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
