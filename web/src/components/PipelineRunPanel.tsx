import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { useMemo, useState } from 'react';

import type { PipelineRunner } from '../hooks/usePipelineRunner';
import { useT } from '../i18n';
import { useUiStore } from '../store/uiStore';
import { defaultSelectedStoreId, getStoreIds } from './charts/storeImpactChartData';
import { KpiCards } from './KpiCards';
import { PipelineStepsTable, summarizeLargestDelta } from './PipelineStepsTable';
import {
  activeScenarioLabelKey,
  type ActiveScenario,
} from './sanitization/activeScenario';
import { SanitizationStoreInspectDialog } from './sanitization/SanitizationStoreInspectDialog';
import { StoreImpactChart } from './StoreImpactChart';

/** Collapsed accordion summary height reserved so Network card is not covered on md. */
const STEPS_SUMMARY_RESERVE_PX = 80;
/** Gap between Network card and Pipeline steps sheet (mirrors Planner At-Risk). */
const STEPS_GAP_PX = 12;
/** Expanded overlay cap on md — scrolls internally; chart underneath does not move. */
const STEPS_OVERLAY_MAX_HEIGHT = '45vh';

interface PipelineRunPanelProps {
  runner: PipelineRunner;
  activeScenario?: ActiveScenario | null;
  scenarioUndoAvailable?: boolean;
  onUndoScenario?: () => void;
  /** Click active-scenario chip → jump back to question packs. */
  onActiveScenarioClick?: () => void;
}

export function PipelineRunPanel({
  runner,
  activeScenario = null,
  scenarioUndoAvailable = false,
  onUndoScenario,
  onActiveScenarioClick,
}: PipelineRunPanelProps) {
  const t = useT();
  const { noData, isPending, isError, error, displayResult } = runner;
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);
  const showScenarioChrome = Boolean(activeScenario || scenarioUndoAvailable);

  const largestDeltaHint = useMemo(
    () =>
      displayResult
        ? summarizeLargestDelta(displayResult.steps, displayResult.echo_config)
        : null,
    [displayResult],
  );

  const flaggedCount = useMemo(
    () => displayResult?.high_store_months.filter((row) => row.flagged).length ?? 0,
    [displayResult],
  );

  const canInspect = useMemo(() => {
    if (!displayResult) {
      return false;
    }
    return getStoreIds(displayResult.store_impact_series).length > 0 || flaggedCount > 0;
  }, [displayResult, flaggedCount]);

  const showResults = Boolean(displayResult && !isPending);

  const openInspect = () => {
    if (!displayResult) {
      return;
    }
    let nextStoreId = defaultSelectedStoreId(
      displayResult.store_impact_series,
      selectedStoreId,
    );
    if (nextStoreId == null) {
      nextStoreId =
        displayResult.high_store_months.find((row) => row.flagged)?.store_id ?? null;
    }
    if (nextStoreId != null) {
      setSelectedStoreId(nextStoreId);
    }
    setInspectOpen(true);
  };

  const closeInspect = () => {
    setInspectOpen(false);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        flex: { md: 1 },
        width: '100%',
        height: { md: '100%' },
        minHeight: { md: 0 },
        overflow: { md: 'hidden' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {noData && (
        <Alert severity="info" sx={{ py: 0.5, flexShrink: 0 }}>
          {t('sanitization.waitingData')}
        </Alert>
      )}

      {isError && (
        <Alert severity="error" sx={{ py: 0.5, flexShrink: 0 }}>
          {error instanceof Error ? error.message : t('sanitization.runFailed')}
        </Alert>
      )}

      {showScenarioChrome || (showResults && displayResult) ? (
        <Box
          data-testid="sanitization-glance-row"
          role="region"
          aria-label={t('sanitization.glance.aria')}
          sx={{
            flexShrink: 0,
            display: 'flex',
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            gap: 0.75,
            width: '100%',
            overflowX: { md: 'auto' },
          }}
        >
          {showScenarioChrome ? (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ alignSelf: 'center', flexShrink: 0 }}
            >
              {activeScenario ? (
                <Tooltip title={t('sanitization.answer.chipTip')}>
                  <Chip
                    color="primary"
                    variant="outlined"
                    size="small"
                    clickable={Boolean(onActiveScenarioClick)}
                    onClick={onActiveScenarioClick}
                    data-testid="sanitization-active-scenario"
                    label={t('sanitization.answer.chip', {
                      label: t(activeScenarioLabelKey(activeScenario)),
                    })}
                    sx={{
                      fontWeight: 600,
                      maxWidth: { xs: '100%', md: 280 },
                      cursor: onActiveScenarioClick ? 'pointer' : undefined,
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                    }}
                  />
                </Tooltip>
              ) : null}
              {scenarioUndoAvailable && onUndoScenario ? (
                <Tooltip title={t('sanitization.answer.undoTip')}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<UndoRoundedIcon fontSize="small" />}
                    onClick={onUndoScenario}
                    data-testid="sanitization-undo-scenario"
                    sx={{ flexShrink: 0, minWidth: 0, px: 1 }}
                  >
                    {t('sanitization.answer.undo')}
                  </Button>
                </Tooltip>
              ) : null}
            </Stack>
          ) : null}
          {showResults && displayResult ? (
            <KpiCards result={displayResult} scopeMode="network" embedded />
          ) : null}
        </Box>
      ) : null}

      {isPending && (
        <Alert severity="info" sx={{ py: 0.5, flexShrink: 0 }}>
          {t('sanitization.runningAlert')}
        </Alert>
      )}

      {showResults && displayResult ? (
        <Box
          data-testid="sanitization-explore-stack"
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 320,
              display: 'flex',
              overflow: 'hidden',
              pb: { md: `${STEPS_SUMMARY_RESERVE_PX + STEPS_GAP_PX}px` },
            }}
          >
            <Card
              variant="outlined"
              data-testid="sanitization-network-card"
              sx={{
                flex: 1,
                width: '100%',
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                borderWidth: 2,
                borderColor: 'primary.light',
                overflow: 'hidden',
              }}
            >
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                data-testid="sanitization-network-toolbar"
                sx={{ flexShrink: 0, px: 2, pt: 1.5, pb: 0.5 }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewRoundedIcon fontSize="small" />}
                  onClick={openInspect}
                  disabled={!canInspect}
                  data-testid="sanitization-open-inspect"
                >
                  {t('sanitization.inspect.open')}
                </Button>
                {flaggedCount > 0 ? (
                  <Chip
                    size="small"
                    clickable={canInspect}
                    onClick={openInspect}
                    color="warning"
                    variant="outlined"
                    data-testid="sanitization-flagged-entry"
                    label={t('sanitization.inspect.flaggedChip', { count: flaggedCount })}
                    sx={{ fontWeight: 600 }}
                  />
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  {t('sanitization.inspect.entryHint')}
                </Typography>
              </Stack>

              <Box
                data-testid="sanitization-network-chart"
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                }}
              >
                <StoreImpactChart
                  series={displayResult.store_impact_series}
                  highStoreMonths={displayResult.high_store_months}
                  echoConfig={displayResult.echo_config}
                  layout="network"
                  framed={false}
                />
              </Box>
            </Card>
          </Box>

          <Box
            data-testid="pipeline-steps-overlay"
            sx={{
              // xs: normal flow under Network. md: bottom overlay over the pane.
              position: { xs: 'relative', md: 'absolute' },
              left: { md: 0 },
              right: { md: 0 },
              bottom: { md: STEPS_GAP_PX },
              zIndex: { md: 3 },
              flexShrink: 0,
              maxHeight: { md: STEPS_OVERLAY_MAX_HEIGHT },
              overflow: { md: 'auto' },
              scrollbarGutter: 'stable',
              mt: { xs: `${STEPS_GAP_PX}px`, md: 0 },
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              boxShadow: { md: stepsExpanded ? 8 : 2 },
            }}
          >
            <Accordion
              disableGutters
              expanded={stepsExpanded}
              onChange={(_event, expanded) => setStepsExpanded(expanded)}
              sx={{
                '&:before': { display: 'none' },
                boxShadow: 'none',
                bgcolor: 'transparent',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: 48, py: 0.5 }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {t('sanitization.stepsTitle')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {largestDeltaHint
                      ? t('sanitization.largestDelta', { hint: largestDeltaHint })
                      : t('sanitization.stepsHint')}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1 }}>
                <PipelineStepsTable
                  steps={displayResult.steps}
                  echoConfig={displayResult.echo_config}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        </Box>
      ) : null}

      {displayResult ? (
        <SanitizationStoreInspectDialog
          open={inspectOpen}
          storeId={selectedStoreId}
          series={displayResult.store_impact_series}
          highStoreMonths={displayResult.high_store_months}
          echoConfig={displayResult.echo_config}
          onClose={closeInspect}
          onStoreChange={setSelectedStoreId}
        />
      ) : null}
    </Box>
  );
}
