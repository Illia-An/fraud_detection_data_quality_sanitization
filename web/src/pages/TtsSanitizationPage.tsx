import { useRef, useState } from 'react';

import { TtsConfigForm } from '../components/tts/TtsConfigForm';
import { TtsPipelineRunPanel } from '../components/tts/TtsPipelineRunPanel';
import { TtsSampleDataPanel } from '../components/tts/TtsSampleDataPanel';
import { useTtsPipelineRunner } from '../hooks/useTtsPipelineRunner';
import { useT } from '../i18n';
import {
  defaultTtsPipelineConfig,
  type TtsPipelineConfig,
} from '../schemas/tts';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const CONTROLS_RAIL_WIDTH_PX = 360;
const CONTROLS_RAIL_COLLAPSED_PX = 40;
const COLLAPSED_PLAY_REVEAL_MS = 250;

export function TtsSanitizationPage() {
  const t = useT();
  const theme = useTheme();
  const [pipelineConfig, setPipelineConfig] =
    useState<TtsPipelineConfig>(defaultTtsPipelineConfig);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [showCollapsedPlay, setShowCollapsedPlay] = useState(false);
  const runner = useTtsPipelineRunner(pipelineConfig);
  const collapseTimerRef = useRef<number | null>(null);

  const railWidth = controlsOpen ? CONTROLS_RAIL_WIDTH_PX : CONTROLS_RAIL_COLLAPSED_PX;

  const handleToggleControls = () => {
    if (collapseTimerRef.current != null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (controlsOpen) {
      setControlsOpen(false);
      setShowCollapsedPlay(false);
      collapseTimerRef.current = window.setTimeout(() => {
        setShowCollapsedPlay(true);
        collapseTimerRef.current = null;
      }, COLLAPSED_PLAY_REVEAL_MS);
      return;
    }
    setShowCollapsedPlay(false);
    setControlsOpen(true);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        flex: 1,
        minHeight: { md: 0 },
        height: { md: '100%' },
        overflow: { xs: 'visible', md: 'hidden' },
      }}
      data-testid="tts-sanitization-page"
    >
      <Box
        component="aside"
        sx={{
          width: { xs: '100%', md: railWidth },
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
          borderRight: { md: 1 },
          borderColor: { md: 'divider' },
          pr: { md: controlsOpen ? 1.5 : 0.5 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: { md: 0 },
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: controlsOpen ? 'space-between' : 'center',
            mb: controlsOpen ? 1 : 0.5,
            minHeight: 32,
          }}
        >
          {controlsOpen ? (
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.8 }}>
              {t('tts.controlsTitle')}
            </Typography>
          ) : null}
          <Tooltip
            title={controlsOpen ? t('common.collapseControls') : t('common.expandControls')}
          >
            <IconButton
              size="small"
              onClick={handleToggleControls}
              aria-label={
                controlsOpen ? t('common.collapseControls') : t('common.expandControls')
              }
              aria-expanded={controlsOpen}
              data-testid="tts-controls-toggle"
            >
              {controlsOpen ? (
                <ChevronLeftIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

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
              <TtsSampleDataPanel />
              <TtsConfigForm onValidConfigChange={setPipelineConfig} />
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
              onClick={() => runner.handleRun()}
              disabled={runner.isPending || runner.noData}
              data-testid="tts-run"
              startIcon={
                runner.isPending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : undefined
              }
            >
              {runner.isPending ? t('common.running') : t('tts.run')}
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
            <Tooltip title={t('tts.run')} placement="right">
              <span>
                <IconButton
                  data-testid="tts-collapsed-run"
                  color="primary"
                  onClick={() => runner.handleRun()}
                  disabled={runner.isPending || runner.noData}
                  aria-label={t('tts.run')}
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
          overflow: { xs: 'visible', md: 'hidden' },
          pb: { xs: 2, md: 0 },
        }}
      >
        <TtsPipelineRunPanel runner={runner} />
      </Box>
    </Box>
  );
}
