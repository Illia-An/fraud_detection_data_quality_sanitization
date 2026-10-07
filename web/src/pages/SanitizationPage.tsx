import { useEffect, useRef, useState } from 'react';

import { ConfigForm } from '../components/ConfigForm';
import { PipelineRunPanel } from '../components/PipelineRunPanel';
import { SampleDataPanel } from '../components/SampleDataPanel';
import {
  type ActiveScenario,
} from '../components/sanitization/activeScenario';
import { SanitizationScenarioPackCards } from '../components/sanitization/SanitizationScenarioPackCards';
import {
  createScenarioUndoSnapshot,
  type ScenarioUndoSnapshot,
} from '../components/sanitization/scenarioUndo';
import { usePipelineRunner } from '../hooks/usePipelineRunner';
import { useT } from '../i18n';
import { defaultPipelineConfig, type PipelineConfig } from '../schemas/api';
import {
  getSanitizationScenarioPack,
  type SanitizationScenarioPackId,
} from '../schemas/sanitizationScenarioPacks';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

/** Controls rail width (Datadog-style Scenario Lab left pane). */
const CONTROLS_RAIL_WIDTH_PX = 360;
const CONTROLS_RAIL_COLLAPSED_PX = 40;
/** Delay before showing collapsed Play so the collapse click cannot ghost-hit it. */
const COLLAPSED_PLAY_REVEAL_MS = 250;

export function SanitizationPage() {
  const t = useT();
  const theme = useTheme();
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>(defaultPipelineConfig);
  /** Updated only when a scenario pack applies — avoids ConfigForm reset loops. */
  const [configSeed, setConfigSeed] = useState<PipelineConfig>(defaultPipelineConfig);
  const [configRevision, setConfigRevision] = useState(0);
  const [pendingPackId, setPendingPackId] = useState<SanitizationScenarioPackId | null>(null);
  const [runAfterSeed, setRunAfterSeed] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null);
  const [scenarioUndo, setScenarioUndo] = useState<ScenarioUndoSnapshot | null>(null);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [showCollapsedPlay, setShowCollapsedPlay] = useState(false);
  const runner = usePipelineRunner(pipelineConfig);
  const pendingRunConfigRef = useRef<PipelineConfig | null>(null);
  const pendingPackAnswerRef = useRef<SanitizationScenarioPackId | null>(null);
  const packsPanelRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollToPacksRef = useRef(false);
  const handleRunRef = useRef(runner.handleRun);
  handleRunRef.current = runner.handleRun;

  const railWidth = controlsOpen ? CONTROLS_RAIL_WIDTH_PX : CONTROLS_RAIL_COLLAPSED_PX;

  const scrollToScenarioPacks = () => {
    if (controlsOpen) {
      packsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    pendingScrollToPacksRef.current = true;
    setControlsOpen(true);
  };

  useEffect(() => {
    if (!controlsOpen || !pendingScrollToPacksRef.current) {
      return;
    }
    pendingScrollToPacksRef.current = false;
    packsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [controlsOpen]);

  const captureScenarioUndo = (): ScenarioUndoSnapshot => {
    const snap = createScenarioUndoSnapshot({
      processResult: runner.displayResult,
      activeScenario,
      config: pipelineConfig,
    });
    setScenarioUndo(snap);
    return snap;
  };

  const handleUndoScenario = () => {
    if (!scenarioUndo) {
      return;
    }
    const snap = scenarioUndo;
    setScenarioUndo(null);
    setActiveScenario(snap.activeScenario);
    setConfigSeed(snap.config);
    setPipelineConfig(snap.config);
    setConfigRevision((revision) => revision + 1);
    runner.restoreDisplayResult(snap.processResult);
  };

  const handleApplyScenarioPack = (packId: SanitizationScenarioPackId) => {
    if (runner.noData || runner.isPending) {
      return;
    }
    const pack = getSanitizationScenarioPack(packId);
    captureScenarioUndo();
    setPendingPackId(packId);
    pendingPackAnswerRef.current = packId;
    pendingRunConfigRef.current = pack.config;
    setConfigSeed(pack.config);
    setPipelineConfig(pack.config);
    setConfigRevision((revision) => revision + 1);
    setRunAfterSeed(true);
  };

  const handleManualRun = () => {
    if (runner.noData || runner.isPending) {
      return;
    }
    captureScenarioUndo();
    runner.handleRun(undefined, {
      onSuccess: () => {
        setActiveScenario({ kind: 'manual' });
      },
      onError: () => {
        setScenarioUndo(null);
      },
    });
  };

  useEffect(() => {
    if (!runAfterSeed || runner.noData || runner.isPending) {
      return;
    }
    const runConfig = pendingRunConfigRef.current;
    const packId = pendingPackAnswerRef.current;
    pendingRunConfigRef.current = null;
    pendingPackAnswerRef.current = null;
    setRunAfterSeed(false);
    setPendingPackId(null);
    handleRunRef.current(runConfig ?? undefined, {
      onSuccess: () => {
        if (packId) {
          setActiveScenario({ kind: 'pack', id: packId });
        }
      },
      onError: () => {
        setScenarioUndo(null);
      },
    });
  }, [runAfterSeed, runner.noData, runner.isPending]);

  useEffect(() => {
    if (controlsOpen) {
      setShowCollapsedPlay(false);
      return;
    }
    const timerId = window.setTimeout(() => setShowCollapsedPlay(true), COLLAPSED_PLAY_REVEAL_MS);
    return () => window.clearTimeout(timerId);
  }, [controlsOpen]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        flex: 1,
        minHeight: 0,
        height: { xs: 'auto', md: '100%' },
        overflow: { xs: 'auto', md: 'hidden' },
        gap: { xs: 3, md: 0 },
      }}
    >
      <Box
        component="aside"
        data-testid="controls-rail"
        data-collapsed={controlsOpen ? 'false' : 'true'}
        sx={{
          width: { xs: '100%', md: railWidth },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: { md: 0 },
          overflow: { md: 'hidden' },
          borderRight: { md: 1 },
          borderColor: { md: 'divider' },
          pr: { md: controlsOpen ? 2 : 0.5 },
          mr: { md: controlsOpen ? 2 : 1 },
          transition: theme.transitions.create(['width', 'padding', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        {/* Desktop: collapse always available. Mobile stays full-width open content. */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            justifyContent: controlsOpen ? 'flex-end' : 'center',
            flexShrink: 0,
            pb: 0.5,
          }}
        >
          <Tooltip
            title={controlsOpen ? t('common.collapseControls') : t('common.expandControls')}
            placement="right"
          >
            <IconButton
              size="small"
              onClick={() => setControlsOpen((open) => !open)}
              aria-label={
                controlsOpen ? t('common.collapseControls') : t('common.expandControls')
              }
              aria-expanded={controlsOpen}
            >
              {controlsOpen ? (
                <ChevronLeftIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Keep mounted when collapsed so SampleDataPanel does not remount → auto-run. */}
        <Box
          sx={{
            display: { xs: 'flex', md: controlsOpen ? 'flex' : 'none' },
            flexDirection: 'column',
            flex: { md: 1 },
            minHeight: { md: 0 },
          }}
        >
          <Box
            sx={{
              flex: { md: 1 },
              minHeight: { md: 0 },
              overflowY: { xs: 'visible', md: 'auto' },
              overflowX: 'hidden',
              pb: 2,
            }}
          >
            <Stack spacing={2}>
              <SampleDataPanel />
              <Box
                ref={packsPanelRef}
                sx={{
                  border: 2,
                  borderColor: 'primary.light',
                  borderRadius: 1.5,
                  p: 1.25,
                  bgcolor: 'action.hover',
                }}
                data-testid="sanitization-scenario-packs-panel"
              >
                <SanitizationScenarioPackCards
                  disabled={runner.noData || runner.isPending}
                  disabledTip={
                    runner.noData ? t('sanitization.packs.disabledTip') : ''
                  }
                  pendingId={pendingPackId}
                  onApply={handleApplyScenarioPack}
                />
              </Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ letterSpacing: 0.8, pt: 0.5 }}
              >
                {t('sanitization.section.manualTiers')}
              </Typography>
              <ConfigForm
                onValidConfigChange={setPipelineConfig}
                configRevision={configRevision}
                seedConfig={configSeed}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              pt: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Button
              variant="outlined"
              fullWidth
              onClick={handleManualRun}
              disabled={runner.isPending || runner.noData}
              data-testid="sanitization-manual-run"
              startIcon={
                runner.isPending ? <CircularProgress size={18} color="inherit" /> : undefined
              }
            >
              {runner.isPending ? t('common.running') : t('sanitization.run')}
            </Button>
          </Box>
        </Box>

        {!controlsOpen && showCollapsedPlay ? (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              pt: 1,
              flex: 1,
            }}
          >
            <Tooltip title={t('sanitization.run')} placement="right">
              <span>
                <IconButton
                  data-testid="collapsed-run"
                  color="primary"
                  onClick={handleManualRun}
                  disabled={runner.isPending || runner.noData}
                  aria-label={t('sanitization.run')}
                  size="small"
                >
                  {runner.isPending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <PlayArrowIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ) : null}
      </Box>

      <Box
        component="section"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: { md: 0 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          // md: pane owns height; steps funnel is a bottom overlay inside PipelineRunPanel.
          overflow: { xs: 'visible', md: 'hidden' },
          pb: { xs: 2, md: 0 },
        }}
      >
        <PipelineRunPanel
          runner={runner}
          activeScenario={activeScenario}
          scenarioUndoAvailable={scenarioUndo != null}
          onUndoScenario={handleUndoScenario}
          onActiveScenarioClick={scrollToScenarioPacks}
        />
      </Box>
    </Box>
  );
}
