import { useEffect, useState } from 'react';

import { ConfigForm } from '../components/ConfigForm';
import { PipelineRunPanel } from '../components/PipelineRunPanel';
import { SampleDataPanel } from '../components/SampleDataPanel';
import { usePipelineRunner } from '../hooks/usePipelineRunner';
import { defaultPipelineConfig, type PipelineConfig } from '../schemas/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

/** Controls rail width (Datadog-style Scenario Lab left pane). */
const CONTROLS_RAIL_WIDTH_PX = 360;
const CONTROLS_RAIL_COLLAPSED_PX = 40;
/** Delay before showing collapsed Play so the collapse click cannot ghost-hit it. */
const COLLAPSED_PLAY_REVEAL_MS = 250;

export function SanitizationPage() {
  const theme = useTheme();
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>(defaultPipelineConfig);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [showCollapsedPlay, setShowCollapsedPlay] = useState(false);
  const runner = usePipelineRunner(pipelineConfig);

  const railWidth = controlsOpen ? CONTROLS_RAIL_WIDTH_PX : CONTROLS_RAIL_COLLAPSED_PX;

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
          <Tooltip title={controlsOpen ? 'Collapse controls' : 'Expand controls'} placement="right">
            <IconButton
              size="small"
              onClick={() => setControlsOpen((open) => !open)}
              aria-label={controlsOpen ? 'Collapse controls' : 'Expand controls'}
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
              <ConfigForm onValidConfigChange={setPipelineConfig} />
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
              variant="contained"
              fullWidth
              onClick={runner.handleRun}
              disabled={runner.isPending || runner.noData}
              startIcon={
                runner.isPending ? <CircularProgress size={18} color="inherit" /> : undefined
              }
            >
              {runner.isPending ? 'Running…' : 'Run Scenario'}
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
            <Tooltip title="Run Scenario" placement="right">
              <span>
                <IconButton
                  data-testid="collapsed-run"
                  color="primary"
                  onClick={runner.handleRun}
                  disabled={runner.isPending || runner.noData}
                  aria-label="Run Scenario"
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
        sx={(sectionTheme) => ({
          flex: 1,
          minWidth: 0,
          minHeight: { md: 0 },
          display: 'flex',
          flexDirection: 'column',
          // md: pane owns height; steps funnel is a bottom overlay inside PipelineRunPanel.
          overflow: { xs: 'visible', md: 'hidden' },
          bgcolor: {
            md: alpha(sectionTheme.palette.action.hover, 0.35),
          },
          borderRadius: { md: 1 },
          px: { md: 2 },
          py: { md: 1.5 },
        })}
      >
        <PipelineRunPanel runner={runner} />
      </Box>
    </Box>
  );
}
