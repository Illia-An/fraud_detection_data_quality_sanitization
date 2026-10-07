import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useEffect } from 'react';

import { useT } from '../i18n';
import {
  configFormSchema,
  defaultConfigFormValues,
  pipelineConfigToFormValues,
  toPipelineConfig,
  type ConfigFormValues,
} from '../schemas/configForm';
import { defaultPipelineConfig, type PipelineConfig } from '../schemas/api';

interface ConfigFormProps {
  onValidConfigChange?: (config: PipelineConfig) => void;
  /** Bump when parent applies a scenario pack so manual levers match the recipe. */
  configRevision?: number;
  seedConfig?: PipelineConfig;
}

export function ConfigForm({
  onValidConfigChange,
  configRevision = 0,
  seedConfig,
}: ConfigFormProps) {
  const t = useT();
  const {
    control,
    register,
    reset,
    formState: { errors, isValid },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    defaultValues: defaultConfigFormValues,
    mode: 'onChange',
  });

  const values = useWatch({ control });

  useEffect(() => {
    if (configRevision === 0) {
      return;
    }
    reset(pipelineConfigToFormValues(seedConfig ?? defaultPipelineConfig));
  }, [configRevision, reset, seedConfig]);

  useEffect(() => {
    if (!isValid || !values) {
      return;
    }
    const parsed = configFormSchema.safeParse(values);
    if (!parsed.success) {
      return;
    }
    onValidConfigChange?.(toPipelineConfig(parsed.data));
  }, [values, isValid, onValidConfigChange]);

  return (
    <Card variant="outlined">
      <CardHeader
        title={t('sanitization.controlsTitle')}
        subheader={t('sanitization.controlsSub')}
        titleTypographyProps={{ variant: 'subtitle1' }}
        subheaderTypographyProps={{ variant: 'caption' }}
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              {t('config.tier1.title')}
            </Typography>
            <Controller
              name="tier1_blacklist_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': t('config.tier1.aria') }}
                    />
                  }
                  label={t('config.tier1.label')}
                />
              )}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              {t('config.tier2.title')}
            </Typography>
            <Controller
              name="tier2_freq_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': t('config.tier2.aria') }}
                    />
                  }
                  label={t('config.tier2.label')}
                />
              )}
            />
            <TextField
              label={t('config.tier2.threshold')}
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier2_freq_enabled}
              {...register('tier2_freq_threshold', { valueAsNumber: true })}
              error={Boolean(errors.tier2_freq_threshold)}
              helperText={errors.tier2_freq_threshold?.message}
              slotProps={{ htmlInput: { min: 2, max: 20 } }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              {t('config.tier3.title')}
            </Typography>
            <Controller
              name="tier3_always_five_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': t('config.tier3.aria') }}
                    />
                  }
                  label={t('config.tier3.label')}
                />
              )}
            />
            <TextField
              label={t('config.tier3.minN')}
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier3_always_five_enabled}
              {...register('tier3_always_five_min_n', { valueAsNumber: true })}
              error={Boolean(errors.tier3_always_five_min_n)}
              helperText={errors.tier3_always_five_min_n?.message}
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h3">
              {t('config.tier4.title')}
            </Typography>
            <Controller
              name="tier4_enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      inputProps={{ 'aria-label': t('config.tier4.aria') }}
                    />
                  }
                  label={t('config.tier4.label')}
                />
              )}
            />
            <TextField
              label={t('config.tier4.minVolume')}
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier4_enabled}
              {...register('tier4_min_volume', { valueAsNumber: true })}
              error={Boolean(errors.tier4_min_volume)}
              helperText={errors.tier4_min_volume?.message}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <TextField
              label={t('config.tier4.zHigh')}
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier4_enabled}
              {...register('tier4_z_threshold', { valueAsNumber: true })}
              error={Boolean(errors.tier4_z_threshold)}
              helperText={errors.tier4_z_threshold?.message}
              slotProps={{ htmlInput: { min: 0, max: 5, step: 0.1 } }}
            />
            <TextField
              label={t('config.tier4.fiveMin')}
              type="number"
              size="small"
              fullWidth
              disabled={!values.tier4_enabled}
              {...register('tier4_pct_threshold', { valueAsNumber: true })}
              error={Boolean(errors.tier4_pct_threshold)}
              helperText={errors.tier4_pct_threshold?.message}
              slotProps={{ htmlInput: { min: 0, max: 100 } }}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
