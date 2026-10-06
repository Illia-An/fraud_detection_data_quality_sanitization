import type { MessageKey } from '../../i18n';
import type { PlanParams } from '../../schemas/plan';

const TRAJECTORY_LABEL: Record<PlanParams['trajectory'], MessageKey> = {
  uniform: 'planner.traj.uniform',
  front_loaded: 'planner.traj.front',
  accelerated: 'planner.traj.accel',
};

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/** One-line mirror of Allocator (+ Advanced when trajectory is shaped). */
export function formatPathLeversSummary(params: PlanParams, t: Translate): string {
  const trajectory = t(TRAJECTORY_LABEL[params.trajectory]);
  const base = t('planner.packs.pathLeversSummary', {
    trajectory,
    priority: params.priority_power,
    maxMonthly: params.max_monthly_improve,
  });
  if (params.trajectory === 'uniform') {
    return base;
  }
  return (
    base +
    t('planner.packs.pathLeversAdvancedSuffix', {
      power: params.trajectory_power,
    })
  );
}
