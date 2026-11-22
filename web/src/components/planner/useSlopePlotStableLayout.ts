/**
 * Freeze Slope plot box size + Y-axis range while dragging so Plotly / flex
 * reflows do not jitter under the pointer.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

export function useSlopePlotBoxSize(freeze: boolean): {
  hostRef: RefObject<HTMLDivElement | null>;
  plotWidth: number;
  hostHeight: number;
} {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const [hostHeight, setHostHeight] = useState(0);
  const freezeRef = useRef(freeze);
  freezeRef.current = freeze;

  useEffect(() => {
    const node = hostRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      if (freezeRef.current) return;
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setPlotWidth(Math.max(0, Math.floor(rect.width)));
      setHostHeight(Math.max(0, Math.floor(rect.height)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { hostRef, plotWidth, hostHeight };
}

/** Lock the first fit range when freeze becomes true; release when false. */
export function useFrozenYRange(
  freeze: boolean,
  fittedRange: [number, number] | undefined,
): [number, number] | undefined {
  const [locked, setLocked] = useState<[number, number] | null>(null);
  const fittedRef = useRef(fittedRange);
  fittedRef.current = fittedRange;

  useEffect(() => {
    if (!freeze) {
      setLocked(null);
      return;
    }
    setLocked((prev) => {
      if (prev) return prev;
      const r = fittedRef.current;
      if (!r || r.length < 2) return null;
      return [r[0], r[1]];
    });
  }, [freeze]);

  return freeze && locked ? locked : fittedRange;
}
