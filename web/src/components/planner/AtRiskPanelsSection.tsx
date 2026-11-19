import { Alert, Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import type { DirectedPlan, MetricScorePanel } from '../../schemas/metricScore';
import { periodLabel } from '../../schemas/plan';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import { AtRiskAiChatPanel } from './AtRiskAiChatPanel';
import { AtRiskExceptionPanel } from './AtRiskExceptionPanel';
import { AtRiskFilterBar } from './AtRiskFilterBar';
import { AtRiskPathPanel } from './AtRiskPathPanel';
import type { StoreBaselineRow } from './atRiskRowMetrics';
import { useAtRiskWorkbench } from './useAtRiskWorkbench';

export interface AtRiskPanelsSectionProps {
  plan: DirectedPlan;
  /** Kept for API parity with the old table; unused in the panels. */
  approvedPlan?: DirectedPlan | null;
  baselineRows: StoreBaselineRow[];
  panel: MetricScorePanel;
  insights: PlanMonitoringInsights;
  asOfOptions: { year: number; month: number }[];
  onAsOfChange: (year: number, month: number) => void;
  onInspect: (storeId: number) => void;
  inspectOnboardingId?: string;
  unreachableStoreIds?: ReadonlySet<number>;
  /** Optional banner above the filter bar (e.g. slope pending). */
  pendingBanner?: ReactNode;
  /** Root anchors for onboarding / page tests. */
  testId?: string;
  onboardingId?: string;
}

/**
 * Full-viewport At-risk screen: filters + Exception (50%) + Store mix | AI chat (50%).
 * Parent should give this a definite height (second monitor screen).
 */
export function AtRiskPanelsSection({
  plan,
  baselineRows,
  panel,
  insights,
  asOfOptions,
  onAsOfChange,
  onInspect,
  inspectOnboardingId = 'planner-inspect',
  unreachableStoreIds,
  pendingBanner,
  testId = 'atrisk-exception-table',
  onboardingId = 'planner-at-risk',
}: AtRiskPanelsSectionProps) {
  const t = useT();
  const unit = plan.unit;
  const asOfValue = periodLabel(insights.as_of_year, insights.as_of_month);
  const workbench = useAtRiskWorkbench({ plan, panel, insights, baselineRows });

  return (
    <Stack
      data-testid={testId}
      data-onboarding={onboardingId}
      spacing={0.75}
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        py: 0.5,
      }}
    >
      {pendingBanner}
      <AtRiskFilterBar
        filter={workbench.filter}
        onFilterChange={workbench.setFilter}
        behindCount={workbench.behindCount}
        aheadCount={workbench.aheadCount}
        allStoresCount={workbench.allStoresCount}
        topSliceCount={workbench.topSliceCount}
        asOfValue={asOfValue}
        asOfOptions={asOfOptions}
        onAsOfChange={onAsOfChange}
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1,
          alignItems: 'stretch',
          overflow: 'hidden',
        }}
      >
        <AtRiskExceptionPanel
          rows={workbench.rows}
          unit={unit}
          direction={plan.direction}
          onInspect={onInspect}
          inspectOnboardingId={inspectOnboardingId}
          unreachableStoreIds={unreachableStoreIds}
          scrollRef={workbench.exceptionScrollRef}
        />
        <Box
          data-testid="atrisk-right-column"
          sx={{
            flex: { xs: '1 1 auto', md: '1 1 50%' },
            minWidth: 0,
            width: { xs: '100%', md: 'auto' },
            maxWidth: { xs: '100%', md: '50%' },
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <AtRiskPathPanel
            summary={insights.summary}
            onSelectFilter={workbench.setFilter}
          />
          <AtRiskAiChatPanel />
        </Box>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ flexShrink: 0, pointerEvents: 'none', fontSize: '0.65rem', lineHeight: 1.2 }}
      >
        {unit === 'min'
          ? t('ttsPlanner.atRisk.footer', { asOf: asOfValue })
          : t('planner.atRisk.footer', { asOf: asOfValue })}
      </Typography>
    </Stack>
  );
}

/** Convenience pending banner for Slope allocate lag. */
export function AtRiskPendingBanner({ message }: { message: string }) {
  return (
    <Alert severity="info" sx={{ py: 0.25 }} data-testid="slope-at-risk-pending-banner">
      {message}
    </Alert>
  );
}
