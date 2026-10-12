/** Shared Plotly hover spikes + fixed as-of horizontal for Network / Store Hero. */

export const HERO_HOVERMODE = 'x unified' as const;

/** Compact dark tooltip for unified crosshair hover. */
export const HERO_HOVERLABEL = {
  bgcolor: 'rgba(33, 33, 33, 0.9)',
  bordercolor: 'rgba(255, 255, 255, 0.12)',
  font: { size: 10, color: '#f5f5f5' },
  align: 'left' as const,
  namelength: 22,
};

/** Value-only row under the shared month header (unified hover). */
export const HERO_HOVER_TEMPLATE = '%{y:.1f}%<extra></extra>';

export const HERO_X_SPIKES = {
  showspikes: true,
  spikemode: 'across' as const,
  spikesnap: 'cursor' as const,
  spikedash: 'solid' as const,
  spikethickness: 1.5,
  spikecolor: 'rgba(66, 66, 66, 0.85)',
};

export const HERO_Y_SPIKES = {
  showspikes: true,
  spikemode: 'across' as const,
  spikesnap: 'cursor' as const,
  spikedash: 'dot' as const,
  spikethickness: 1.5,
  spikecolor: 'rgba(66, 66, 66, 0.7)',
};

/** Full-width horizontal through as-of handoff Y (pairs with existing vertical marker). */
export function asOfHorizontalShape(
  y: number,
  color: string,
): {
  type: 'line';
  xref: 'paper';
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  line: { color: string; width: number; dash: 'dash' };
} {
  return {
    type: 'line',
    xref: 'paper',
    x0: 0,
    x1: 1,
    y0: y,
    y1: y,
    line: { color, width: 1.5, dash: 'dash' },
  };
}
