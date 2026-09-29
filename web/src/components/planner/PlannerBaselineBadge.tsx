import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Chip,
  IconButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { useT, type MessageKey } from '../../i18n';
import {
  sortPipelineSteps,
  type ProcessResponse,
  type StepName,
} from '../../schemas/api';
import type { SanitizedPanel } from '../../schemas/sanitizedPanel';

const STEP_I18N_KEYS: Record<StepName, MessageKey> = {
  actual: 'steps.actual',
  tier1: 'steps.tier1',
  tier2: 'steps.tier2',
  tier3: 'steps.tier3',
  tier4: 'steps.tier4',
};

interface PlannerBaselineBadgeProps {
  panel: SanitizedPanel | null;
  processResult: ProcessResponse | null;
  baselineReady: boolean;
}

/** V4.2 — Baseline gate badge + lightweight sanitization audit popover. */
export function PlannerBaselineBadge({
  panel,
  processResult,
  baselineReady,
}: PlannerBaselineBadgeProps) {
  const t = useT();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const steps = processResult ? sortPipelineSteps(processResult.steps) : [];
  const rowsLabel =
    processResult?.meta?.rows_scanned != null
      ? t('planner.baseline.rowsScanned', {
          count: processResult.meta.rows_scanned.toLocaleString(),
        })
      : panel
        ? t('planner.baseline.panelCells', { count: panel.row_count })
        : '—';

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <Chip
        size="small"
        color={baselineReady ? 'success' : 'default'}
        label={
          baselineReady
            ? t('planner.baseline.ready', { rows: rowsLabel })
            : t('planner.baseline.missing')
        }
      />
      {baselineReady && (
        <IconButton
          size="small"
          aria-label={t('planner.baseline.auditAria')}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      )}
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 320 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('planner.baseline.auditTitle')}
          </Typography>
          {steps.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              {t('planner.baseline.noSteps')}
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {steps.map((step) => (
                <Stack
                  key={step.step_name}
                  direction="row"
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Typography variant="caption">
                    {t(STEP_I18N_KEYS[step.step_name])}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('planner.baseline.drop', { count: step.rows_dropped })}
                    {step.top_box_pct != null ? ` · ${step.top_box_pct.toFixed(1)}%` : ''}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {panel && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {t('planner.baseline.panelMeta', {
                count: panel.row_count,
                start: panel.period_start ?? '—',
                end: panel.period_end ? ` → ${panel.period_end}` : '',
              })}
            </Typography>
          )}
        </Box>
      </Popover>
    </Stack>
  );
}
