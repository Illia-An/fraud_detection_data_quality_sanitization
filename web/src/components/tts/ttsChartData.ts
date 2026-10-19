import {
  periodLabel,
  type TtsStoreImpactPoint,
} from '../../schemas/tts';

export const TTS_CHART_COLORS = {
  actual: '#4C78A8',
  ge30: '#54A24B',
} as const;

export function getTtsStoreIds(series: TtsStoreImpactPoint[]): number[] {
  return [...new Set(series.map((point) => point.store_id))].sort((a, b) => a - b);
}

export function filterTtsStoreSeries(
  series: TtsStoreImpactPoint[],
  storeId: number,
): TtsStoreImpactPoint[] {
  return series
    .filter((point) => point.store_id === storeId)
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

export function defaultTtsSelectedStoreId(
  series: TtsStoreImpactPoint[],
  preferred: number | null,
): number | null {
  const ids = getTtsStoreIds(series);
  if (ids.length === 0) {
    return null;
  }
  if (preferred != null && ids.includes(preferred)) {
    return preferred;
  }
  return ids[0] ?? null;
}

export interface TtsNetworkPoint {
  period_label: string;
  year: number;
  month: number;
  actual_mean_tts_sec: number | null;
  after_ge30_mean_tts_sec: number | null;
  volume_before: number;
  volume_after: number;
}

/** Volume-weighted network mean per calendar month. */
export function aggregateTtsNetworkSeries(series: TtsStoreImpactPoint[]): TtsNetworkPoint[] {
  const buckets = new Map<
    string,
    {
      year: number;
      month: number;
      actualSum: number;
      actualVol: number;
      ge30Sum: number;
      ge30Vol: number;
      volume_before: number;
      volume_after: number;
    }
  >();

  for (const point of series) {
    const key = periodLabel(point.year, point.month);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        year: point.year,
        month: point.month,
        actualSum: 0,
        actualVol: 0,
        ge30Sum: 0,
        ge30Vol: 0,
        volume_before: 0,
        volume_after: 0,
      };
      buckets.set(key, bucket);
    }
    const volBefore = point.volume_before ?? 0;
    const volAfter = point.volume_after ?? 0;
    bucket.volume_before += volBefore;
    bucket.volume_after += volAfter;
    if (point.actual_mean_tts_sec != null && volBefore > 0) {
      bucket.actualSum += point.actual_mean_tts_sec * volBefore;
      bucket.actualVol += volBefore;
    }
    if (point.after_ge30_mean_tts_sec != null && volAfter > 0) {
      bucket.ge30Sum += point.after_ge30_mean_tts_sec * volAfter;
      bucket.ge30Vol += volAfter;
    }
  }

  return [...buckets.entries()]
    .map(([label, bucket]) => ({
      period_label: label,
      year: bucket.year,
      month: bucket.month,
      actual_mean_tts_sec:
        bucket.actualVol > 0 ? bucket.actualSum / bucket.actualVol : null,
      after_ge30_mean_tts_sec:
        bucket.ge30Vol > 0 ? bucket.ge30Sum / bucket.ge30Vol : null,
      volume_before: bucket.volume_before,
      volume_after: bucket.volume_after,
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

export interface TtsPlotTrace {
  name: string;
  x: string[];
  y: (number | null)[];
  mode: 'lines+markers';
  line: { color: string; width: number };
  marker: { size: number };
  hovertemplate: string;
  connectgaps: boolean;
}

export function buildTtsImpactTraces(
  points: Array<{
    period_label?: string;
    year: number;
    month: number;
    actual_mean_tts_sec?: number | null;
    after_ge30_mean_tts_sec?: number | null;
  }>,
  labels: { actual: string; ge30: string },
): TtsPlotTrace[] {
  const x = points.map(
    (p) => p.period_label ?? periodLabel(p.year, p.month),
  );
  return [
    {
      name: labels.actual,
      x,
      y: points.map((p) => p.actual_mean_tts_sec ?? null),
      mode: 'lines+markers',
      line: { color: TTS_CHART_COLORS.actual, width: 2 },
      marker: { size: 6 },
      hovertemplate: '%{x}<br>%{y:.1f} s<extra>%{fullData.name}</extra>',
      connectgaps: false,
    },
    {
      name: labels.ge30,
      x,
      y: points.map((p) => p.after_ge30_mean_tts_sec ?? null),
      mode: 'lines+markers',
      line: { color: TTS_CHART_COLORS.ge30, width: 2 },
      marker: { size: 6 },
      hovertemplate: '%{x}<br>%{y:.1f} s<extra>%{fullData.name}</extra>',
      connectgaps: false,
    },
  ];
}
