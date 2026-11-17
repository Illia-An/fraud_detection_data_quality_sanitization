import CloseIcon from '@mui/icons-material/Close';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Autocomplete,
  Chip,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { useT } from '../../../i18n';
import {
  PIPELINE_STEP_LABELS,
  type StepMetrics,
} from '../../../schemas/api';
import {
  SIGNAL_COLORS,
  SIGNAL_LABELS,
  type StoreMonitorRow,
} from '../../../schemas/planMonitoring';
import type { SanitizedPanel } from '../../../schemas/sanitizedPanel';

export interface StoreAuditDialogTitleProps {
  storeIds: number[];
  storeId: number;
  onStoreChange: (storeId: number) => void;
  onClose: () => void;
  monitorRow?: StoreMonitorRow;
  echo?: SanitizedPanel['echo_config'];
  steps: StepMetrics[];
}

/** Inspect dialog chrome: title, store picker, signal chip, sandbox/audit tooltips, close. */
export function StoreAuditDialogTitle({
  storeIds,
  storeId,
  onStoreChange,
  onClose,
  monitorRow,
  echo,
  steps,
}: StoreAuditDialogTitleProps) {
  const t = useT();

  return (
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
              {echo ? (
                <>
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
                </>
              ) : (
                <Typography variant="caption">{t('planner.baseline.noSteps')}</Typography>
              )}
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
  );
}
