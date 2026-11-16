/**
 * Wave 10 / C-02 — shared MSW handlers for FE-without-backend fault tests.
 * Happy-path stubs keep Zod-shaped payloads; use `faults.ts` for 422/503/latency.
 */
import { http, HttpResponse, delay } from 'msw';

import { API_BASE_URL, API_PREFIX } from '../../api/config';

const api = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const healthOk = {
  status: 'ok',
  version: '0.1.0-test',
};

/** Minimal SanitizationResponse-shaped body for contract-safe stubs. */
export const processOk = {
  baseline_top_box_pct: 80,
  final_top_box_pct: 78,
  network_delta_pp: -2,
  steps: [
    {
      step_name: 'actual' as const,
      rows_in: 10,
      rows_out: 10,
      rows_dropped: 0,
      top_box_pct: 80,
    },
  ],
  high_store_months: [],
  store_impact_series: [],
  echo_config: {
    tier1_blacklist_enabled: true,
    tier2_freq_enabled: true,
    tier2_freq_threshold: 2,
    tier3_always_five_enabled: true,
    tier3_always_five_min_n: 25,
    tier4_enabled: false,
    tier4_min_volume: 30,
    tier4_z_threshold: 2,
    tier4_pct_threshold: 90,
  },
  meta: {
    execution_time_ms: 1,
    rows_scanned: 10,
  },
};

export const defaultHandlers = [
  http.get(api('/health'), () => HttpResponse.json(healthOk)),
  http.post(api(`${API_PREFIX}/process`), async () => {
    await delay(1);
    return HttpResponse.json(processOk);
  }),
];
