import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Box,
  Button,
  Card,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import { useT } from '../../i18n';
import type { KitchenBeforeAfter } from '../../schemas/ttsKitchen';
import { KitchenCodeTable } from './KitchenCodeTable';
import { KitchenMeanChart } from './KitchenMeanChart';
import { KitchenStoreInspectDialog } from './KitchenStoreInspectDialog';
import { kitchenPlotPoints } from './kitchenChartData';

type KitchenScope = 'network' | 'store' | 'code';

interface KitchenImpactChartProps {
  result: KitchenBeforeAfter;
}

export function KitchenImpactChart({ result }: KitchenImpactChartProps) {
  const t = useT();
  const [scope, setScope] = useState<KitchenScope>('network');
  const [inspectOpen, setInspectOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(
    result.by_store[0]?.store_id ?? null,
  );
  const storeIds = useMemo(
    () => result.by_store.map((store) => store.store_id),
    [result.by_store],
  );

  useEffect(() => {
    if (selectedStoreId != null && storeIds.includes(selectedStoreId)) {
      return;
    }
    setSelectedStoreId(storeIds[0] ?? null);
  }, [selectedStoreId, storeIds]);

  const points = useMemo(() => {
    if (scope === 'store') {
      const store = result.by_store.find((row) => row.store_id === selectedStoreId);
      return kitchenPlotPoints(store?.months ?? []);
    }
    return kitchenPlotPoints(result.network_months);
  }, [result, scope, selectedStoreId]);

  const canInspect = storeIds.length > 0;

  const handleScope = (_: MouseEvent<HTMLElement>, value: KitchenScope | null) => {
    if (value) {
      setScope(value);
    }
  };

  const handleStore = (event: SelectChangeEvent<number>) => {
    setSelectedStoreId(Number(event.target.value));
  };

  const scopeControls = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={scope}
        onChange={handleScope}
        aria-label={t('tts.chart.scopeAria')}
      >
        <ToggleButton value="network">{t('tts.chart.network')}</ToggleButton>
        <ToggleButton value="store">{t('tts.chart.store')}</ToggleButton>
        <ToggleButton value="code">{t('kitchen.chart.code')}</ToggleButton>
      </ToggleButtonGroup>
      {scope === 'store' ? (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="kitchen-store-select-label">{t('common.store')}</InputLabel>
          <Select
            labelId="kitchen-store-select-label"
            label={t('common.store')}
            value={selectedStoreId ?? ''}
            onChange={handleStore}
            data-testid="kitchen-store-select"
          >
            {storeIds.map((id) => (
              <MenuItem key={id} value={id}>
                {t('common.storeN', { id })}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
      <ToggleButtonGroup
        size="small"
        exclusive
        value="fit"
        aria-label={t('chart.yScaleAria')}
      >
        <ToggleButton value="fit" aria-label={t('chart.fitAria')} data-testid="kitchen-fit">
          {t('chart.fit')}
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  return (
    <Card
      variant="outlined"
      data-testid="kitchen-impact-chart"
      sx={{
        flex: 1,
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
        data-testid="kitchen-inspect-toolbar"
        sx={{ flexShrink: 0, px: 2, pt: 1.5, pb: 0.5 }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<OpenInNewRoundedIcon fontSize="small" />}
          onClick={() => setInspectOpen(true)}
          disabled={!canInspect}
          data-testid="kitchen-open-inspect"
        >
          {t('kitchen.inspect.open')}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {t('kitchen.inspect.entryHint')}
        </Typography>
      </Stack>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
        sx={{ flexShrink: 0, px: 2, pt: 0.5, pb: 0.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            component="h3"
            sx={{ m: 0, fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 }}
          >
            {t('kitchen.chart.title')}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('kitchen.chart.subheader', {
              start: result.period_start,
              end: result.period_end,
            })}
          </Typography>
        </Box>
        {scopeControls}
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', px: 2, pb: 1.5 }}>
        {scope === 'code' ? (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <KitchenCodeTable result={result} />
          </Box>
        ) : (
          <KitchenMeanChart points={points} minSec={result.tts_min_sec} />
        )}
      </Box>
      <KitchenStoreInspectDialog
        open={inspectOpen}
        storeId={selectedStoreId}
        stores={result.by_store}
        minSec={result.tts_min_sec}
        onClose={() => setInspectOpen(false)}
        onStoreChange={setSelectedStoreId}
      />
    </Card>
  );
}
