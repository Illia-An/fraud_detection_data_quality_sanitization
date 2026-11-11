/** SPEC-P001 D-05/D-06: show capped-store suggestion + network impact; Apply → /simulation/adjust. */

import { Alert, Button, Stack, Typography } from '@mui/material';

import { useT } from '../../i18n';
import type { UnreachableHint } from '../../schemas/cumulativePlan';

interface UnreachableRecommendationCardProps {
  hint: UnreachableHint;
  onApply: () => void;
  applyPending?: boolean;
  applyDisabled?: boolean;
}

function formatPp(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)} pp`;
}

export function UnreachableRecommendationCard({
  hint,
  onApply,
  applyPending = false,
  applyDisabled = false,
}: UnreachableRecommendationCardProps) {
  const t = useT();

  return (
    <Alert
      severity="warning"
      variant="outlined"
      data-testid="unreachable-recommendation-card"
      sx={{ flexShrink: 0, mb: 1, py: 0.75 }}
      action={
        <Button
          color="warning"
          size="small"
          variant="contained"
          disabled={applyDisabled || applyPending}
          onClick={onApply}
          data-testid="unreachable-apply-suggestion"
          sx={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
        >
          {applyPending
            ? t('planner.unreachable.applyPending')
            : t('planner.unreachable.apply')}
        </Button>
      }
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
        {t('planner.unreachable.title')}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25, lineHeight: 1.35 }}>
        {t('planner.unreachable.body', {
          implied: hint.implied_target.toFixed(1),
          suggested: hint.suggested_implied_target.toFixed(1),
        })}
      </Typography>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {t('planner.unreachable.networkImpact', {
            impact: formatPp(hint.network_impact_pp),
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('planner.unreachable.reason', { reason: hint.reason })}
        </Typography>
      </Stack>
    </Alert>
  );
}
