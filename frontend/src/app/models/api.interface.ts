/** Mirrors backend/schemas.py — keep field names identical for JSON parity. */

export interface SurveyAnswerRow {
  ParticipateNumber?: string | null;
  Question_ID?: number;
  Answer_Value?: number | null;
  BlackList?: string | null;
  UserContact?: string | null;
  PhoneFromLog?: string | null;
  ext_user_id?: number | null;
  PrintStore?: number | null;
  AnswerTime?: string | null;
  PrintDateTime?: string | null;
  Year?: number | null;
  Month?: number | null;
  [key: string]: unknown;
}

export interface Tier1Options {
  enable_blacklist: boolean;
  enable_freq_store_day: boolean;
  enable_always_topbox: boolean;
  freq_store_day_min: number;
  always_topbox_min_n: number;
  customer_blacklist_value: string;
}

export interface Tier2Options {
  enabled: boolean;
  min_volume: number;
  z_high: number;
  five_pct_min: number;
}

export interface Tier3Options {
  enabled: boolean;
  contamination: number;
  min_entity_n: number;
  n_estimators: number;
  random_state: number;
}

export interface PipelineConfig {
  tier1: Tier1Options;
  tier2: Tier2Options;
  tier3: Tier3Options;
}

export interface ProcessRequest {
  rows: SurveyAnswerRow[];
  config: PipelineConfig;
}

export interface StepMetrics {
  step_name: string;
  rows_in: number;
  rows_out: number;
  rows_dropped: number;
  top_box_rate_pct: number | null;
  drop_reasons: Record<string, number>;
}

export interface StoreMonthCell {
  store_id: number;
  year: number;
  month: number;
  volume: number;
  five_pct: number;
  z: number;
  flagged: boolean;
}

export interface StoreImpactPoint {
  store_id: number;
  year: number;
  month: number;
  period_label: string;
  actual_five_pct: number;
  after_tier1_five_pct: number | null;
  after_tier2_five_pct: number | null;
  after_tier3_five_pct: number | null;
  actual_volume: number;
  final_volume: number;
  rows_dropped: number;
}

export interface ProcessResponse {
  baseline_top_box_pct: number | null;
  final_top_box_pct: number | null;
  network_delta_pp: number | null;
  steps: StepMetrics[];
  high_store_months: StoreMonthCell[];
  store_impact_series: StoreImpactPoint[];
  entities_flagged_tier3: number;
  meta: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export type SamplePreset = 'small' | 'medium' | 'stress';

export interface SamplePresetMeta {
  preset: SamplePreset;
  row_count: number;
  store_count: number;
  month_count: number;
  description: string;
}

export interface SampleResponse {
  preset: SamplePreset;
  rows: SurveyAnswerRow[];
  meta: SamplePresetMeta;
}

export interface ApiErrorBody {
  detail: string | ValidationErrorItem[];
}

export interface ValidationErrorItem {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  tier1: {
    enable_blacklist: true,
    enable_freq_store_day: true,
    enable_always_topbox: false,
    freq_store_day_min: 3,
    always_topbox_min_n: 10,
    customer_blacklist_value: 'לא',
  },
  tier2: {
    enabled: true,
    min_volume: 30,
    z_high: 2.0,
    five_pct_min: 90.0,
  },
  tier3: {
    enabled: false,
    contamination: 0.005,
    min_entity_n: 3,
    n_estimators: 200,
    random_state: 42,
  },
};
