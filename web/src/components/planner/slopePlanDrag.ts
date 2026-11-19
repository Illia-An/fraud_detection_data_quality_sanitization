/**
 * Y-only Plan point drag on Plotly graph div (future months after cutover).
 *
 * Handlers are read via getter each event so React re-renders during preview
 * do not tear down the active drag session.
 */

export interface SlopePlanDragHandlers {
  labels: string[];
  /** First editable spine index (handoffIdx + 1). */
  editableFromIndex: number;
  /** Full-spine Plan Y values (null = not editable / gap). */
  planYs: (number | null)[];
  onPreview: (monthIndex: number, value: number) => void;
  onCommit: (monthIndex: number, value: number) => void;
  onCancel: () => void;
  getGeneration?: () => number;
}

type AxisLike = {
  _offset?: number;
  _length?: number;
  p2d?: (pixel: number) => number | string;
  d2p?: (data: number | string) => number;
  _categories?: string[];
};

type PlotSize = { l: number; t: number; w: number; h: number };

type PlotlyGd = HTMLElement & {
  _fullLayout?: {
    _size?: PlotSize;
    xaxis?: AxisLike;
    yaxis?: AxisLike;
  };
  data?: Array<{
    y?: (number | null)[];
    x?: string[];
    meta?: { slopePlanDrag?: boolean };
    uid?: string;
  }>;
};

const HIT_PX = 28;

function plotSize(gd: PlotlyGd): PlotSize | null {
  const size = gd._fullLayout?._size;
  if (!size || !Number.isFinite(size.l) || !Number.isFinite(size.t)) {
    return null;
  }
  return size;
}

/** Pointer → coordinates inside the Plotly plotting area (px from plot top-left). */
export function pointerToPlotPx(
  gd: PlotlyGd,
  clientX: number,
  clientY: number,
): { xPlot: number; yPlot: number } | null {
  const size = plotSize(gd);
  if (!size) return null;
  const rect = gd.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  // CSS scale (flex / transform): map client → gd layout pixels.
  const scaleX = gd.clientWidth / rect.width;
  const scaleY = gd.clientHeight / rect.height;
  const xInGd = (clientX - rect.left) * scaleX;
  const yInGd = (clientY - rect.top) * scaleY;
  return {
    xPlot: xInGd - size.l,
    yPlot: yInGd - size.t,
  };
}

export function yDataFromPlotPx(gd: PlotlyGd, yPlot: number): number | null {
  const yaxis = gd._fullLayout?.yaxis;
  if (!yaxis || typeof yaxis.p2d !== 'function') return null;
  const raw = yaxis.p2d(yPlot);
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function xIndexFromPlotPx(gd: PlotlyGd, xPlot: number, labels: string[]): number | null {
  const xaxis = gd._fullLayout?.xaxis;
  if (!xaxis || typeof xaxis.p2d !== 'function') return null;
  const raw = xaxis.p2d(xPlot);
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const idx = Math.round(raw);
    if (idx >= 0 && idx < labels.length) return idx;
  }
  const asLabel = String(raw);
  const hit = labels.indexOf(asLabel);
  return hit >= 0 ? hit : null;
}

function pointPlotY(gd: PlotlyGd, yValue: number): number | null {
  const yaxis = gd._fullLayout?.yaxis;
  if (!yaxis || typeof yaxis.d2p !== 'function') return null;
  const px = yaxis.d2p(yValue);
  return Number.isFinite(px) ? px : null;
}

function pointPlotX(gd: PlotlyGd, monthIndex: number, label: string): number | null {
  const xaxis = gd._fullLayout?.xaxis;
  if (!xaxis || typeof xaxis.d2p !== 'function') return null;
  // Category axes accept index or category string.
  const byLabel = xaxis.d2p(label);
  if (Number.isFinite(byLabel)) return byLabel;
  const byIndex = xaxis.d2p(monthIndex);
  return Number.isFinite(byIndex) ? byIndex : null;
}

/**
 * Nearest editable Plan month under the pointer (plot-area px + axis helpers).
 */
export function findNearestEditableIndex(
  gd: PlotlyGd,
  clientX: number,
  clientY: number,
  labels: string[],
  planYs: (number | null)[],
  editableFromIndex: number,
  hitPx: number = HIT_PX,
): number | null {
  const plot = pointerToPlotPx(gd, clientX, clientY);
  if (!plot) return null;

  let bestIdx: number | null = null;
  let bestDist = hitPx;

  for (let i = editableFromIndex; i < labels.length; i += 1) {
    const yVal = planYs[i];
    if (yVal == null || !Number.isFinite(yVal)) continue;
    const xPx = pointPlotX(gd, i, labels[i]!);
    const yPx = pointPlotY(gd, yVal);
    if (xPx == null || yPx == null) continue;
    const dx = xPx - plot.xPlot;
    const dy = yPx - plot.yPlot;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  // Fallback: snap by X category if close enough horizontally and within plot Y band.
  if (bestIdx == null) {
    const xIdx = xIndexFromPlotPx(gd, plot.xPlot, labels);
    if (
      xIdx != null &&
      xIdx >= editableFromIndex &&
      planYs[xIdx] != null &&
      Number.isFinite(planYs[xIdx]!)
    ) {
      const xPx = pointPlotX(gd, xIdx, labels[xIdx]!);
      if (xPx != null && Math.abs(xPx - plot.xPlot) <= hitPx) {
        const yPx = pointPlotY(gd, planYs[xIdx]!);
        if (yPx != null && Math.abs(yPx - plot.yPlot) <= hitPx * 2) {
          bestIdx = xIdx;
        }
      }
    }
  }

  return bestIdx;
}

function enableMarkerPointerEvents(gd: HTMLElement): void {
  const styleId = 'slope-plan-drag-pointer-css';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .js-plotly-plot .scatterlayer .trace .points path {
      pointer-events: all !important;
    }
    .js-plotly-plot.slope-plan-drag-active {
      cursor: ns-resize !important;
    }
  `;
  document.head.appendChild(style);
  void gd;
}

/**
 * Attach native pointer listeners. `getHandlers` is called per event (fresh React props).
 */
export function attachSlopePlanDrag(
  gd: HTMLElement,
  getHandlers: () => SlopePlanDragHandlers,
): () => void {
  const plotlyGd = gd as PlotlyGd;
  enableMarkerPointerEvents(gd);
  let dragging: { monthIndex: number; gen: number } | null = null;

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    const h = getHandlers();
    const monthIndex = findNearestEditableIndex(
      plotlyGd,
      ev.clientX,
      ev.clientY,
      h.labels,
      h.planYs,
      h.editableFromIndex,
    );
    if (monthIndex == null) return;
    dragging = {
      monthIndex,
      gen: h.getGeneration?.() ?? 0,
    };
    gd.classList.add('slope-plan-drag-active');
    try {
      gd.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    ev.preventDefault();
    ev.stopPropagation();
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) {
      // Hover affordance: ns-resize near editable points.
      const h = getHandlers();
      const near = findNearestEditableIndex(
        plotlyGd,
        ev.clientX,
        ev.clientY,
        h.labels,
        h.planYs,
        h.editableFromIndex,
      );
      gd.style.cursor = near != null ? 'ns-resize' : '';
      return;
    }
    const h = getHandlers();
    if (h.getGeneration && h.getGeneration() !== dragging.gen) {
      dragging = null;
      gd.classList.remove('slope-plan-drag-active');
      h.onCancel();
      return;
    }
    const plot = pointerToPlotPx(plotlyGd, ev.clientX, ev.clientY);
    if (!plot) return;
    const y = yDataFromPlotPx(plotlyGd, plot.yPlot);
    if (y == null || !Number.isFinite(y)) return;
    h.onPreview(dragging.monthIndex, Math.min(100, Math.max(0, y)));
    ev.preventDefault();
    ev.stopPropagation();
  };

  const finish = (ev: PointerEvent, commit: boolean) => {
    if (!dragging) return;
    const { monthIndex, gen } = dragging;
    dragging = null;
    gd.classList.remove('slope-plan-drag-active');
    try {
      gd.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    const h = getHandlers();
    if (h.getGeneration && h.getGeneration() !== gen) {
      h.onCancel();
      return;
    }
    if (!commit) {
      h.onCancel();
      return;
    }
    const plot = pointerToPlotPx(plotlyGd, ev.clientX, ev.clientY);
    const y = plot ? yDataFromPlotPx(plotlyGd, plot.yPlot) : null;
    if (y == null || !Number.isFinite(y)) {
      h.onCancel();
      return;
    }
    h.onCommit(monthIndex, Math.min(100, Math.max(0, y)));
  };

  const onUp = (ev: PointerEvent) => finish(ev, true);
  const onCancel = (ev: PointerEvent) => finish(ev, false);

  // Capture phase: beat Plotly's own drag/hover handlers.
  gd.addEventListener('pointerdown', onDown, true);
  gd.addEventListener('pointermove', onMove, true);
  gd.addEventListener('pointerup', onUp, true);
  gd.addEventListener('pointercancel', onCancel, true);

  const onAfterPlot = () => {
    /* layout/_size refreshed — next event uses fresh axes */
  };
  gd.addEventListener('plotly_afterplot', onAfterPlot);

  return () => {
    gd.removeEventListener('pointerdown', onDown, true);
    gd.removeEventListener('pointermove', onMove, true);
    gd.removeEventListener('pointerup', onUp, true);
    gd.removeEventListener('pointercancel', onCancel, true);
    gd.removeEventListener('plotly_afterplot', onAfterPlot);
    gd.classList.remove('slope-plan-drag-active');
    gd.style.cursor = '';
  };
}
