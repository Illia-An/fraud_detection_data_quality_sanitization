import {
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useT } from '../../i18n';
import {
  defaultTtsPipelineConfig,
  type OrderAgg,
  type TtsPipelineConfig,
} from '../../schemas/tts';

interface TtsConfigFormProps {
  onValidConfigChange: (config: TtsPipelineConfig) => void;
  seedConfig?: TtsPipelineConfig;
  configRevision?: number;
}

export function TtsConfigForm({
  onValidConfigChange,
  seedConfig = defaultTtsPipelineConfig,
  configRevision = 0,
}: TtsConfigFormProps) {
  const t = useT();
  const [ttsMinSec, setTtsMinSec] = useState(seedConfig.tts_min_sec);
  const [orderAgg] = useState<OrderAgg>(seedConfig.order_agg);
  const onChangeRef = useRef(onValidConfigChange);
  onChangeRef.current = onValidConfigChange;

  useEffect(() => {
    setTtsMinSec(seedConfig.tts_min_sec);
  }, [seedConfig, configRevision]);

  useEffect(() => {
    const minSec = Number.isFinite(ttsMinSec) && ttsMinSec >= 0 ? ttsMinSec : 30;
    onChangeRef.current({ tts_min_sec: minSec, order_agg: orderAgg });
  }, [ttsMinSec, orderAgg]);

  return (
    <Card variant="outlined" data-testid="tts-config-form">
      <CardHeader
        title={t('tts.config.title')}
        subheader={t('tts.config.subheader')}
        titleTypographyProps={{ variant: 'subtitle2' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0.5 }}
      />
      <CardContent sx={{ pt: 1 }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            type="number"
            label={t('tts.config.minSec')}
            value={ttsMinSec}
            onChange={(e) => setTtsMinSec(Number(e.target.value))}
            inputProps={{ min: 0, step: 1, 'data-testid': 'tts-min-sec' }}
            helperText={t('tts.config.minSecHint')}
            fullWidth
          />
          <FormControl size="small" fullWidth disabled>
            <InputLabel id="tts-order-agg-label">{t('tts.config.orderAgg')}</InputLabel>
            <Select
              labelId="tts-order-agg-label"
              label={t('tts.config.orderAgg')}
              value={orderAgg}
              data-testid="tts-order-agg"
            >
              <MenuItem value="none">{t('tts.config.orderAgg.none')}</MenuItem>
              <MenuItem value="avg">{t('tts.config.orderAgg.avg')}</MenuItem>
              <MenuItem value="max">{t('tts.config.orderAgg.max')}</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            {t('tts.config.orderAggHint')}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
