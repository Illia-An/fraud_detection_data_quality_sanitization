import { Box, Button, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import {
  SANITIZATION_SCENARIO_PACKS,
  type SanitizationScenarioPackId,
} from '../../schemas/sanitizationScenarioPacks';

interface SanitizationScenarioPackCardsProps {
  disabled: boolean;
  disabledTip: string;
  pendingId: SanitizationScenarioPackId | null;
  onApply: (id: SanitizationScenarioPackId) => void;
}

const PACK_COPY: Record<
  SanitizationScenarioPackId,
  { title: MessageKey; blurb: MessageKey }
> = {
  standard_spec: {
    title: 'sanitization.packs.standard.title',
    blurb: 'sanitization.packs.standard.blurb',
  },
  with_store_month: {
    title: 'sanitization.packs.withStoreMonth.title',
    blurb: 'sanitization.packs.withStoreMonth.blurb',
  },
  core_only: {
    title: 'sanitization.packs.coreOnly.title',
    blurb: 'sanitization.packs.coreOnly.blurb',
  },
};

/** Preset questions — one click sets pipeline config and runs; canvas is the answer. */
export function SanitizationScenarioPackCards({
  disabled,
  disabledTip,
  pendingId,
  onApply,
}: SanitizationScenarioPackCardsProps) {
  const t = useT();

  return (
    <Stack spacing={1.25} data-testid="sanitization-scenario-packs">
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {t('sanitization.packs.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
          {t('sanitization.packs.sub')}
        </Typography>
      </Box>
      {SANITIZATION_SCENARIO_PACKS.map((pack) => {
        const copy = PACK_COPY[pack.id];
        const busy = pendingId === pack.id;
        const otherBusy = pendingId != null && pendingId !== pack.id;
        return (
          <Box
            key={pack.id}
            data-testid={`sanitization-pack-${pack.id}`}
            sx={{
              border: 1,
              borderColor: 'primary.light',
              borderRadius: 1.5,
              px: 1.25,
              py: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={0.75}>
              <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.35 }}>
                {t(copy.title)}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.72rem', lineHeight: 1.35 }}
              >
                {t(copy.blurb)}
              </Typography>
              {disabled && disabledTip ? (
                <Typography
                  variant="caption"
                  color="warning.main"
                  data-testid={`sanitization-pack-disabled-reason-${pack.id}`}
                  sx={{ fontSize: '0.72rem', lineHeight: 1.35 }}
                >
                  {disabledTip}
                </Typography>
              ) : null}
              <Button
                size="medium"
                variant="contained"
                fullWidth
                disabled={disabled || otherBusy}
                onClick={() => onApply(pack.id)}
                data-testid={`sanitization-pack-apply-${pack.id}`}
              >
                {busy ? t('common.runningDots') : t('sanitization.packs.apply')}
              </Button>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
