import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';

import type { TtsPipelineRunner } from '../../hooks/useTtsPipelineRunner';
import { useT } from '../../i18n';
import { useTtsUiStore } from '../../store/ttsUiStore';
import { TtsKpiCards } from './TtsKpiCards';
import { TtsPanelHandoffBar } from './TtsPanelHandoffBar';
import { TtsStepsTable } from './TtsStepsTable';
import { TtsStoreImpactChart } from './TtsStoreImpactChart';

interface TtsPipelineRunPanelProps {
  runner: TtsPipelineRunner;
}

export function TtsPipelineRunPanel({ runner }: TtsPipelineRunPanelProps) {
  const t = useT();
  const { noData, isPending, isError, error, displayResult } = runner;
  const sanitizedPanel = useTtsUiStore((s) => s.sanitizedPanel);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const showResults = Boolean(displayResult && !isPending);

  return (
    <Stack
      spacing={1.5}
      sx={{ flex: 1, minHeight: 0, position: 'relative' }}
      data-testid="tts-run-panel"
    >
      {noData && !displayResult ? (
        <Alert severity="info" data-testid="tts-waiting-data">
          {t('tts.waitingData')}
        </Alert>
      ) : null}

      {isPending ? (
        <Alert severity="info" data-testid="tts-running">
          {t('tts.runningAlert')}
        </Alert>
      ) : null}

      {isError ? (
        <Alert severity="error" data-testid="tts-run-error">
          {error?.message || t('tts.runFailed')}
        </Alert>
      ) : null}

      {showResults && displayResult ? (
        <>
          <TtsKpiCards result={displayResult} />
          <TtsPanelHandoffBar panel={sanitizedPanel} />
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            <TtsStoreImpactChart series={displayResult.store_impact_series} />
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
              data-testid="tts-steps-accordion"
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack spacing={0.25}>
                  <Typography variant="subtitle2">{t('tts.stepsTitle')}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('tts.stepsHint')}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <TtsStepsTable steps={displayResult.steps} />
              </AccordionDetails>
            </Accordion>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
