import type { MonitorSignal } from '../../schemas/planMonitoring';
import { SIGNAL_COLORS } from '../../schemas/planMonitoring';

export interface AtRiskMixSummary {
  ahead: number;
  on_plan: number;
  behind: number;
  insufficient: number;
}

export interface DonutSlice {
  signal: MonitorSignal;
  count: number;
  /** Share of total in [0, 1]. */
  share: number;
  color: string;
  /** SVG arc path for an annular sector. */
  path: string;
}

const ORDER: MonitorSignal[] = [
  'behind_plan',
  'on_plan',
  'ahead_of_plan',
  'insufficient_history',
];

function polar(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** Build one donut slice path (outer arc → inner arc). Angles from −π/2 (12 o'clock). */
function slicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const o0 = polar(cx, cy, outerR, startAngle);
  const o1 = polar(cx, cy, outerR, endAngle);
  const i1 = polar(cx, cy, innerR, endAngle);
  const i0 = polar(cx, cy, innerR, startAngle);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

/**
 * Donut geometry for monitoring mix (Behind / On plan / Ahead / No actual).
 * Zero-count signals are omitted from the ring but stay available for legends.
 */
export function buildAtRiskDonutSlices(
  summary: AtRiskMixSummary,
  opts?: { cx?: number; cy?: number; outerR?: number; innerR?: number },
): { slices: DonutSlice[]; total: number } {
  const cx = opts?.cx ?? 100;
  const cy = opts?.cy ?? 100;
  const outerR = opts?.outerR ?? 88;
  const innerR = opts?.innerR ?? 52;

  const counts: Record<MonitorSignal, number> = {
    behind_plan: summary.behind,
    on_plan: summary.on_plan,
    ahead_of_plan: summary.ahead,
    insufficient_history: summary.insufficient,
  };

  const total = ORDER.reduce((sum, key) => sum + Math.max(0, counts[key]), 0);
  if (total <= 0) {
    return { slices: [], total: 0 };
  }

  let angle = -Math.PI / 2;
  const slices: DonutSlice[] = [];
  for (const signal of ORDER) {
    const count = Math.max(0, counts[signal]);
    if (count === 0) {
      continue;
    }
    const share = count / total;
    const sweep = share * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    // Full circle as one slice: use almost-full arc to avoid SVG identical-point collapse.
    const pathEnd = sweep >= Math.PI * 2 - 1e-6 ? start + Math.PI * 2 - 1e-4 : end;
    slices.push({
      signal,
      count,
      share,
      color: SIGNAL_COLORS[signal],
      path: slicePath(cx, cy, outerR, innerR, start, pathEnd),
    });
    angle = end;
  }
  return { slices, total };
}
