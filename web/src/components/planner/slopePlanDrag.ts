/**
 * Y-only Plan point drag on Plotly graph div (future months after handoff).
 */

import type { PlanPinKind } from './planTrajectoryPins';

export interface SlopePlanDragHandlers {
  kind: PlanPinKind;
  labels: string[];
  /** First editable spine index (handoffIdx + 1). */
  editableFromIndex: number;
  onPreview: (monthIndex: number, value: number) => void;
  onCommit: (monthIndex: number, value: number) => void;
  onCancel: () => void;
  /** Ignore events when generation mismatches (optional). */
  getGeneration?: () => number;
}

type PlotlyGd = HTMLElement & {
  _fullLayout?: {
    xaxis?: { p2c?: (v: number) => number; c2p?: (v: number) => number; _categories?: string[] };
    yaxis?: { p2d?: (v: number) => number; p2c?: (v: number) => number; c2p?: (v: number) => number };
  };
  calcdata?: Array<Array<{ x?: number; y?: number; i?: number }>>;
  data?: Array<{
    name?: string;
    y?: (number | null)[];
    x?: string[];
    meta?: { slopePlanDrag?: boolean };
  }>;
};

const HIT_PX = 14;

function clientToPlotLocal(gd: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = gd.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function yFromPointer(gd: PlotlyGd, clientY: number): number | null {
  const yaxis = gd._fullLayout?.yaxis;
  if (!yaxis) return null;
  const { y } = clientToPlotLocal(gd, 0, clientY);
  // Prefer p2d (data); fall back to p2c.
  if (typeof yaxis.p2d === 'function') {
    return yaxis.p2d(y);
  }
  if (typeof yaxis.p2c === 'function') {
    return yaxis.p2c(y);
  }
  return null;
}

function findNearestEditableIndex(
  gd: PlotlyGd,
  clientX: number,
  clientY: number,
  labels: string[],
  editableFromIndex: number,
): number | null {
  const { x, y } = clientToPlotLocal(gd, clientX, clientY);
  const calc = gd.calcdata;
  const data = gd.data;
  if (!calc || !data) return null;

  let bestIdx: number | null = null;
  let bestDist = HIT_PX;

  for (let ti = 0; ti < calc.length; ti += 1) {
    const trace = data[ti];
    if (!trace?.meta?.slopePlanDrag) continue;
    const pts = calc[ti];
    if (!pts) continue;
    for (let pi = 0; pi < pts.length; pi += 1) {
      const pt = pts[pi];
      if (pt?.x == null || pt.y == null) continue;
      const label = String(trace?.x?.[pi] ?? labels[pi] ?? '');
      const spineIdx = labels.indexOf(label);
      const idx = spineIdx >= 0 ? spineIdx : pi;
      if (idx < editableFromIndex) continue;
      if (trace.y?.[pi] == null) continue;
      const dx = pt.x - x;
      const dy = pt.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    }
  }
  return bestIdx;
}

/**
 * Attach native pointer listeners. Returns disposer.
 * Call again after Plotly redraws if needed (idempotent via disposer).
 */
export function attachSlopePlanDrag(gd: HTMLElement, handlers: SlopePlanDragHandlers): () => void {
  const plotlyGd = gd as PlotlyGd;
  let dragging: { monthIndex: number; gen: number } | null = null;

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    const monthIndex = findNearestEditableIndex(
      plotlyGd,
      ev.clientX,
      ev.clientY,
      handlers.labels,
      handlers.editableFromIndex,
    );
    if (monthIndex == null) return;
    dragging = {
      monthIndex,
      gen: handlers.getGeneration?.() ?? 0,
    };
    try {
      gd.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    ev.preventDefault();
    ev.stopPropagation();
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) return;
    if (handlers.getGeneration && handlers.getGeneration() !== dragging.gen) {
      dragging = null;
      handlers.onCancel();
      return;
    }
    const y = yFromPointer(plotlyGd, ev.clientY);
    if (y == null || !Number.isFinite(y)) return;
    const clamped = Math.min(100, Math.max(0, y));
    handlers.onPreview(dragging.monthIndex, clamped);
    ev.preventDefault();
  };

  const onUp = (ev: PointerEvent) => {
    if (!dragging) return;
    const { monthIndex, gen } = dragging;
    dragging = null;
    try {
      gd.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    if (handlers.getGeneration && handlers.getGeneration() !== gen) {
      handlers.onCancel();
      return;
    }
    const y = yFromPointer(plotlyGd, ev.clientY);
    if (y == null || !Number.isFinite(y)) {
      handlers.onCancel();
      return;
    }
    handlers.onCommit(monthIndex, Math.min(100, Math.max(0, y)));
  };

  const onCancel = () => {
    if (!dragging) return;
    dragging = null;
    handlers.onCancel();
  };

  gd.addEventListener('pointerdown', onDown);
  gd.addEventListener('pointermove', onMove);
  gd.addEventListener('pointerup', onUp);
  gd.addEventListener('pointercancel', onCancel);

  return () => {
    gd.removeEventListener('pointerdown', onDown);
    gd.removeEventListener('pointermove', onMove);
    gd.removeEventListener('pointerup', onUp);
    gd.removeEventListener('pointercancel', onCancel);
  };
}
