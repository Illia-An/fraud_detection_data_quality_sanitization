import { Card, CardContent, CardHeader, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { useT } from '../../i18n';
import {
  defaultOrderBumpPipelineConfig,
  type OrderBumpPipelineConfig,
} from '../../schemas/ttsOrderBump';

interface OrderBumpConfigFormProps {
  onValidConfigChange: (config: OrderBumpPipelineConfig) => void;
  seedConfig?: OrderBumpPipelineConfig;
}

export function OrderBumpConfigForm({
  onValidConfigChange,
  seedConfig = defaultOrderBumpPipelineConfig,
}: OrderBumpConfigFormProps) {
  const t = useT();
  const [ttsMinSec, setTtsMinSec] = useState(seedConfig.tts_min_sec);
  const onChangeRef = useRef(onValidConfigChange);
  onChangeRef.current = onValidConfigChange;

  useEffect(() => {
    setTtsMinSec(seedConfig.tts_min_sec);
  }, [seedConfig]);

  useEffect(() => {
    const minSec = Number.isFinite(ttsMinSec) && ttsMinSec >= 0 ? ttsMinSec : 30;
    onChangeRef.current({ tts_min_sec: minSec });
  }, [ttsMinSec]);

  return (
    <Card variant="outlined" data-testid="tts-order-config-form">
      <CardHeader
        title={t('ttsOrder.config.title')}
        subheader={t('ttsOrder.config.subheader')}
        titleTypographyProps={{ variant: 'subtitle2' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0.5 }}
      />
      <CardContent sx={{ pt: 1 }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            type="number"
            label={t('ttsOrder.config.minSec')}
            value={ttsMinSec}
            onChange={(e) => setTtsMinSec(Number(e.target.value))}
            inputProps={{ min: 0, step: 1, 'data-testid': 'tts-order-min-sec' }}
            helperText={t('ttsOrder.config.minSecHint')}
            fullWidth
          />
          <Typography variant="caption" color="text.secondary">
            {t('ttsOrder.config.echoHint')}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
