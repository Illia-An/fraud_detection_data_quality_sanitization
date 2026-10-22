import { useRef, useState } from 'react';

import { KitchenImpactChart } from '../components/ttsKitchen/KitchenImpactChart';
import { KitchenKpiCards } from '../components/ttsKitchen/KitchenKpiCards';
import { KitchenStepsTable } from '../components/ttsKitchen/KitchenStepsTable';
import { useKitchenBeforeAfter } from '../api/hooks';
import { useT } from '../i18n';
import { KITCHEN_PERIOD_END, KITCHEN_PERIOD_START } from '../schemas/ttsKitchen';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const CONTROLS_RAIL_WIDTH_PX = 360;
const CONTROLS_RAIL_COLLAPSED_PX = 40;
const COLLAPSED_PLAY_REVEAL_MS = 250;
/** Collapsed accordion summary height reserved so the chart is not covered on md. */
const STEPS_SUMMARY_RESERVE_PX = 80;
const STEPS_GAP_PX = 12;
const STEPS_OVERLAY_MAX_HEIGHT = '45vh';

export function TtsKitchenPage() {
  const t = useT();
  const theme = useTheme();
  const run = useKitchenBeforeAfter();
  const [controlsOpen, setControlsOpen] = useState(true);
  const [showCollapsedPlay, setShowCollapsedPlay] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [minSecInput, setMinSecInput] = useState('30');
  const collapseTimerRef = useRef<number | null>(null);
  const result = run.data ?? null;
  const periodStart = result?.period_start ?? KITCHEN_PERIOD_START;
  const periodEnd = result?.period_end ?? KITCHEN_PERIOD_END;
  const railWidth = controlsOpen ? CONTROLS_RAIL_WIDTH_PX : CONTROLS_RAIL_COLLAPSED_PX;

  const minSec = /^\d+$/.test(minSecInput) ? Number(minSecInput) : null;
  const minSecReady = minSec != null;

  const handleRun = () => {
    if (minSec == null || run.isPending) {
      return;
    }
    run.mutate(minSec);
  };

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
        flex: 1,
        minHeight: { md: 0 },
        height: { xs: 'auto', md: '100%' },
        overflow: { xs: 'auto', md: 'hidden' },
        gap: { xs: 3, md: 0 },
      }}
      data-testid="tts-kitchen-page"
    >
      <Box
        component="aside"
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
              onClick={handleToggleControls}
              aria-label={
                controlsOpen ? t('common.collapseControls') : t('common.expandControls')
              }
              aria-expanded={controlsOpen}
              data-testid="kitchen-controls-toggle"
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
              <Card variant="outlined" data-testid="kitchen-source-panel">
                <CardHeader
                  title={t('kitchen.source.title')}
                  subheader={t('kitchen.source.subheader')}
                  titleTypographyProps={{ variant: 'subtitle1' }}
                  subheaderTypographyProps={{ variant: 'caption' }}
                  action={
                    run.isPending ? <CircularProgress size={20} sx={{ mt: 1, mr: 0.5 }} /> : null
                  }
                  sx={{ pb: 0 }}
                />
                <CardContent>
                  <Stack spacing={1.5}>
                    <FormControl fullWidth size="small" disabled>
                      <InputLabel id="kitchen-source-label">{t('kitchen.source.dataSource')}</InputLabel>
                      <Select
                        labelId="kitchen-source-label"
                        label={t('kitchen.source.dataSource')}
                        value="view"
                        inputProps={{ 'aria-label': t('kitchen.source.dataSource') }}
                      >
                        <MenuItem value="view">{t('kitchen.source.view')}</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl fullWidth size="small" disabled>
                      <InputLabel id="kitchen-period-label">{t('kitchen.source.period')}</InputLabel>
                      <Select
                        labelId="kitchen-period-label"
                        label={t('kitchen.source.period')}
                        value="fixed"
                        inputProps={{ 'aria-label': t('kitchen.source.period') }}
                      >
                        <MenuItem value="fixed">
                          {t('kitchen.source.window', { start: periodStart, end: periodEnd })}
                        </MenuItem>
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary">
                      {t('kitchen.source.processWindow', { from: periodStart, to: periodEnd })}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="button"
                      type="button"
                      onClick={handleRun}
                      disabled={run.isPending || !minSecReady}
                      data-testid="kitchen-reload"
                      sx={{
                        alignSelf: 'flex-start',
                        border: 0,
                        background: 'none',
                        cursor: run.isPending || !minSecReady ? 'default' : 'pointer',
                        p: 0,
                        textDecoration: 'underline',
                        font: 'inherit',
                      }}
                    >
                      {t('kitchen.source.reload')}
                    </Typography>
                    {result ? (
                      <Box>
                        <Typography variant="body2" data-testid="kitchen-source-summary">
                          {t('kitchen.source.summary', {
                            positions: result.network.rows_in.toLocaleString(),
                            stores: result.by_store.length,
                            months: result.network_months.length,
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {t('kitchen.source.view')}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('kitchen.waiting')}
                      </Typography>
                    )}
                    <Stack spacing={1.25} data-testid="kitchen-config-form">
                      <TextField
                        size="small"
                        type="number"
                        label={t('kitchen.config.minSec')}
                        value={minSecInput}
                        onChange={(event) => setMinSecInput(event.target.value)}
                        disabled={run.isPending}
                        error={!minSecReady}
                        helperText={
                          minSecReady
                            ? t('kitchen.config.minSecHint', { sec: minSec })
                            : t('kitchen.config.minSecInvalid')
                        }
                        fullWidth
                        slotProps={{
                          htmlInput: {
                            min: 0,
                            step: 1,
                            'data-testid': 'kitchen-min-sec',
                          },
                        }}
                      />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('kitchen.config.orderAgg')}
                        </Typography>
                        <Typography variant="body2" data-testid="kitchen-order-agg">
                          {t('kitchen.config.orderAgg.none')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('kitchen.config.orderAggHint')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
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
              onClick={handleRun}
              disabled={run.isPending || !minSecReady}
              data-testid="kitchen-run"
              startIcon={
                run.isPending ? <CircularProgress size={18} color="inherit" /> : undefined
              }
            >
              {run.isPending ? t('common.running') : t('kitchen.run')}
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
            <Tooltip title={t('kitchen.run')} placement="right">
              <span>
                <IconButton
                  data-testid="kitchen-collapsed-run"
                  color="primary"
                  onClick={handleRun}
                  disabled={run.isPending || !minSecReady}
                  aria-label={t('kitchen.run')}
                  size="small"
                >
                  {run.isPending ? (
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
        <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {!result && !run.isPending && !run.isError ? (
            <Alert severity="info" data-testid="kitchen-waiting">
              {t('kitchen.waiting')}
            </Alert>
          ) : null}
          {run.isPending ? (
            <Alert severity="info" data-testid="kitchen-running">
              {t('kitchen.runningAlert')}
            </Alert>
          ) : null}
          {run.isError ? (
            <Alert severity="error" data-testid="kitchen-run-error">
              {run.error instanceof Error ? run.error.message : t('kitchen.runFailed')}
            </Alert>
          ) : null}
          {result && !run.isPending ? (
            <>
              <KitchenKpiCards result={result} />
              <Box
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
                  <KitchenImpactChart result={result} />
                </Box>
                <Box
                  data-testid="kitchen-steps-accordion"
                  sx={{
                    position: { xs: 'relative', md: 'absolute' },
                    left: { md: 0 },
                    right: { md: 0 },
                    bottom: { md: STEPS_GAP_PX },
                    zIndex: { md: 3 },
                    flexShrink: 0,
                    maxHeight: { md: STEPS_OVERLAY_MAX_HEIGHT },
                    overflow: { md: 'auto' },
                    mt: { xs: `${STEPS_GAP_PX}px`, md: 0 },
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: { md: stepsExpanded ? 8 : 2 },
                  }}
                >
                  <Accordion
                    expanded={stepsExpanded}
                    onChange={(_, next) => setStepsExpanded(next)}
                    disableGutters
                    sx={{
                      '&:before': { display: 'none' },
                      boxShadow: 'none',
                      bgcolor: 'transparent',
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48, py: 0.5 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {t('kitchen.stepsTitle')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('kitchen.stepsHint')}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1 }}>
                      <KitchenStepsTable result={result} />
                    </AccordionDetails>
                  </Accordion>
                </Box>
              </Box>
            </>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
