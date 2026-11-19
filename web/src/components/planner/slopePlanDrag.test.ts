import { describe, expect, it } from 'vitest';

import { findNearestEditableIndex, pointerToPlotPx, yDataFromPlotPx } from './slopePlanDrag';

function mockGd(opts?: {
  l?: number;
  t?: number;
  clientW?: number;
  clientH?: number;
  rect?: { left: number; top: number; width: number; height: number };
}) {
  const l = opts?.l ?? 40;
  const t = opts?.t ?? 20;
  const clientW = opts?.clientW ?? 400;
  const clientH = opts?.clientH ?? 200;
  const rect = opts?.rect ?? { left: 100, top: 50, width: clientW, height: clientH };
  const categories = ['2026-01', '2026-02', '2026-03', '2026-04'];
  const gd = {
    clientWidth: clientW,
    clientHeight: clientH,
    getBoundingClientRect: () => rect,
    _fullLayout: {
      _size: { l, t, w: clientW - l - 20, h: clientH - t - 20 },
      xaxis: {
        p2d: (px: number) => {
          const w = clientW - l - 20;
          return (px / w) * (categories.length - 1);
        },
        d2p: (v: number | string) => {
          const idx = typeof v === 'number' ? v : categories.indexOf(String(v));
          const w = clientW - l - 20;
          return (idx / (categories.length - 1)) * w;
        },
        _categories: categories,
      },
      yaxis: {
        p2d: (px: number) => {
          const h = clientH - t - 20;
          // top=100, bottom=0 in plot px
          return 100 - (px / h) * 100;
        },
        d2p: (v: number | string) => {
          const h = clientH - t - 20;
          const n = typeof v === 'number' ? v : Number(v);
          return ((100 - n) / 100) * h;
        },
      },
    },
  };
  return gd as unknown as HTMLElement & { _fullLayout: unknown };
}

describe('slopePlanDrag geometry', () => {
  it('pointerToPlotPx subtracts plot margins and handles CSS scale', () => {
    const gd = mockGd({
      l: 40,
      t: 20,
      clientW: 400,
      clientH: 200,
      rect: { left: 0, top: 0, width: 200, height: 100 }, // 2x CSS scale
    });
    const plot = pointerToPlotPx(gd as never, 100, 60);
    expect(plot).not.toBeNull();
    // client 100 → gd x 200; plot x = 200 - 40 = 160
    expect(plot!.xPlot).toBeCloseTo(160, 5);
    expect(plot!.yPlot).toBeCloseTo(100, 5); // client 60 → gd 120; 120 - 20 = 100
  });

  it('yDataFromPlotPx uses axis p2d', () => {
    const gd = mockGd();
    const y = yDataFromPlotPx(gd as never, 0);
    expect(y).toBeCloseTo(100, 5);
  });

  it('findNearestEditableIndex hits a future plan point', () => {
    const gd = mockGd();
    const labels = ['2026-01', '2026-02', '2026-03', '2026-04'];
    const planYs = [60, 65, 70, 75];
    // Point index 2 at d2p → plot px; convert to client with identity scale/rect.
    const xPlot = (gd as never as { _fullLayout: { xaxis: { d2p: (v: number) => number } } })
      ._fullLayout.xaxis.d2p(2);
    const yPlot = (gd as never as { _fullLayout: { yaxis: { d2p: (v: number) => number } } })
      ._fullLayout.yaxis.d2p(70);
    const clientX = 100 + 40 + xPlot; // rect.left + margin.l + xPlot
    const clientY = 50 + 20 + yPlot;
    const idx = findNearestEditableIndex(
      gd as never,
      clientX,
      clientY,
      labels,
      planYs,
      1,
      30,
    );
    expect(idx).toBe(2);
  });

  it('findNearestEditableIndex ignores months before editableFromIndex', () => {
    const gd = mockGd();
    const labels = ['2026-01', '2026-02', '2026-03', '2026-04'];
    const planYs = [60, 65, 70, 75];
    const xPlot = (gd as never as { _fullLayout: { xaxis: { d2p: (v: number) => number } } })
      ._fullLayout.xaxis.d2p(0);
    const yPlot = (gd as never as { _fullLayout: { yaxis: { d2p: (v: number) => number } } })
      ._fullLayout.yaxis.d2p(60);
    const clientX = 100 + 40 + xPlot;
    const clientY = 50 + 20 + yPlot;
    const idx = findNearestEditableIndex(gd as never, clientX, clientY, labels, planYs, 1, 30);
    expect(idx).toBeNull();
  });
});
