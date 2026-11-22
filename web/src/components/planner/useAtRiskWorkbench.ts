import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';

import type { DirectedPlan, MetricScorePanel } from '../../schemas/metricScore';
import type { PlanMonitoringInsights } from '../../schemas/planMonitoring';
import type { StoreBaselineRow } from './atRiskRowMetrics';
import {
  type AtRiskFilter,
  type AtRiskRow,
  TOP_SLICE_LIMIT,
  buildAtRiskRows,
} from './atRiskRows';

export interface UseAtRiskWorkbenchArgs {
  plan: DirectedPlan;
  panel: MetricScorePanel;
  insights: PlanMonitoringInsights;
  baselineRows: StoreBaselineRow[];
}

export interface AtRiskWorkbenchModel {
  filter: AtRiskFilter;
  setFilter: (next: AtRiskFilter) => void;
  rows: AtRiskRow[];
  behindCount: number;
  aheadCount: number;
  allStoresCount: number;
  topSliceCount: number;
  exceptionScrollRef: RefObject<HTMLDivElement | null>;
  pathScrollRef: RefObject<HTMLDivElement | null>;
  onExceptionScroll: () => void;
  onPathScroll: () => void;
}

/** Shared filter + row model for the two standalone At-risk panels. */
export function useAtRiskWorkbench({
  plan,
  panel,
  insights,
  baselineRows,
}: UseAtRiskWorkbenchArgs): AtRiskWorkbenchModel {
  const [filter, setFilter] = useState<AtRiskFilter>('behind');
  const exceptionScrollRef = useRef<HTMLDivElement | null>(null);
  const pathScrollRef = useRef<HTMLDivElement | null>(null);
  const syncLock = useRef(false);

  const syncScroll = useCallback((source: 'exception' | 'path') => {
    if (syncLock.current) {
      return;
    }
    const from = source === 'exception' ? exceptionScrollRef.current : pathScrollRef.current;
    const to = source === 'exception' ? pathScrollRef.current : exceptionScrollRef.current;
    if (!from || !to) {
      return;
    }
    syncLock.current = true;
    to.scrollTop = from.scrollTop;
    requestAnimationFrame(() => {
      syncLock.current = false;
    });
  }, []);

  const rows = useMemo(
    () => buildAtRiskRows({ plan, panel, insights, baselineRows, filter }),
    [plan, panel, insights, baselineRows, filter],
  );

  return {
    filter,
    setFilter,
    rows,
    behindCount: insights.summary.behind,
    aheadCount: insights.summary.ahead,
    allStoresCount: plan.projections.length,
    topSliceCount: Math.min(TOP_SLICE_LIMIT, plan.projections.length),
    exceptionScrollRef,
    pathScrollRef,
    onExceptionScroll: () => syncScroll('exception'),
    onPathScroll: () => syncScroll('path'),
  };
}
