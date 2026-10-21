import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useMemo, useState } from 'react';

import type { OrderBumpPipelineRunner } from '../../hooks/useOrderBumpPipelineRunner';
import { useT } from '../../i18n';
import {
  buildOrderBumpSteps,
  storeMonthsToImpactSeries,
} from '../../schemas/ttsOrderBump';
import { OrderBumpKpiCards } from './OrderBumpKpiCards';
import { OrderBumpKvsStatsTable } from './OrderBumpKvsStatsTable';
import { OrderBumpStepsTable } from './OrderBumpStepsTable';
import { OrderBumpStoreAnomalyTable } from './OrderBumpStoreAnomalyTable';
import { OrderBumpStoreImpactChart } from './OrderBumpStoreImpactChart';

interface OrderBumpPipelineRunPanelProps {
  runner: OrderBumpPipelineRunner;
}

export function OrderBumpPipelineRunPanel({ runner }: OrderBumpPipelineRunPanelProps) {
  const t = useT();
  const { noData, isPending, isError, error, displayResult } = runner;
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const showResults = Boolean(displayResult && !isPending);

  const impactSeries = useMemo(
    () => (displayResult ? storeMonthsToImpactSeries(displayResult.store_months) : []),
    [displayResult],
  );

  const steps = useMemo(
    () => (displayResult ? buildOrderBumpSteps(displayResult) : []),
    [displayResult],
  );

  return (
    <Stack
      spacing={1.5}
      sx={{ flex: 1, minHeight: 0, position: 'relative' }}
      data-testid="tts-order-run-panel"
    >
      {noData && !displayResult ? (
        <Alert severity="info" data-testid="tts-order-waiting-data">
          {t('ttsOrder.waitingData')}
        </Alert>
      ) : null}

      {isPending ? (
        <Alert severity="info" data-testid="tts-order-running">
          {t('ttsOrder.runningAlert')}
        </Alert>
      ) : null}

      {isError ? (
        <Alert severity="error" data-testid="tts-order-run-error">
          {error?.message || t('ttsOrder.runFailed')}
        </Alert>
      ) : null}

      {showResults && displayResult ? (
        <>
          <OrderBumpKpiCards result={displayResult} />
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              color="success"
              label={t('ttsOrder.panel.ready', {
                count: displayResult.store_months.length,
              })}
              data-testid="tts-order-panel-chip"
            />
            <Typography variant="caption" color="text.secondary">
              {t('ttsOrder.panel.meta', {
                orders: displayResult.kpi.order_count,
                bumps: displayResult.kpi.bump_valid_count,
                cells: displayResult.store_months.length,
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('ttsOrder.kpi.echoNote')}
            </Typography>
            {typeof displayResult.meta.stores_anomaly_alert === 'number' ? (
              <Chip
                size="small"
                color={
                  displayResult.meta.stores_anomaly_alert > 0 ? 'warning' : 'default'
                }
                label={t('ttsOrder.anomaly.chip', {
                  count: displayResult.meta.stores_anomaly_alert,
                })}
                data-testid="tts-order-anomaly-chip"
              />
            ) : null}
          </Stack>
          <OrderBumpKvsStatsTable
            rows={displayResult.kvs_stats}
            alertPct={
              typeof displayResult.meta.anomaly_alert_pct === 'number'
                ? displayResult.meta.anomaly_alert_pct
                : 0.2
            }
          />
          <OrderBumpStoreAnomalyTable
            rows={displayResult.store_anomaly}
            alertPct={
              typeof displayResult.meta.anomaly_alert_pct === 'number'
                ? displayResult.meta.anomaly_alert_pct
                : 0.2
            }
          />
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            <OrderBumpStoreImpactChart series={impactSeries} />
            <Accordion
              expanded={stepsExpanded}
              onChange={(_, next) => setStepsExpanded(next)}
              disableGutters
              sx={{
                position: { md: 'absolute' },
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: { md: '40vh' },
                overflow: 'auto',
              }}
              data-testid="tts-order-steps-accordion"
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack spacing={0.25}>
                  <Typography variant="subtitle2">{t('ttsOrder.stepsTitle')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('ttsOrder.stepsHint')}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <OrderBumpStepsTable steps={steps} />
              </AccordionDetails>
            </Accordion>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
