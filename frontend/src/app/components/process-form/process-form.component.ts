import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { StoreImpactChartComponent } from '../store-impact-chart/store-impact-chart.component';
import { ApiService } from '../../services/api.service';
import {
  DEFAULT_PIPELINE_CONFIG,
  PipelineConfig,
  ProcessResponse,
  SamplePreset,
  SurveyAnswerRow,
  StoreMonthCell,
} from '../../models/api.interface';

@Component({
  selector: 'app-process-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDividerModule,
    StoreImpactChartComponent,
  ],
  templateUrl: './process-form.component.html',
  styleUrl: './process-form.component.scss',
})
export class ProcessFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);

  form!: FormGroup;
  loading = false;
  loadingSample = false;
  healthStatus: string | null = null;
  result: ProcessResponse | null = null;
  jsonError: string | null = null;

  stepColumns = [
    'step_name',
    'rows_in',
    'rows_out',
    'rows_dropped',
    'top_box_rate_pct',
  ];
  storeColumns = ['store_id', 'year', 'month', 'volume', 'five_pct', 'z', 'flagged'];

  ngOnInit(): void {
    this.form = this.fb.group({
      rowsJson: ['[]', [Validators.required]],
      tier1_blacklist: [DEFAULT_PIPELINE_CONFIG.tier1.enable_blacklist],
      tier1_freq: [DEFAULT_PIPELINE_CONFIG.tier1.enable_freq_store_day],
      tier1_always5: [DEFAULT_PIPELINE_CONFIG.tier1.enable_always_topbox],
      tier1_freq_min: [
        DEFAULT_PIPELINE_CONFIG.tier1.freq_store_day_min,
        [Validators.required, Validators.min(2), Validators.max(20)],
      ],
      tier2_enabled: [DEFAULT_PIPELINE_CONFIG.tier2.enabled],
      tier2_min_volume: [
        DEFAULT_PIPELINE_CONFIG.tier2.min_volume,
        [Validators.required, Validators.min(1)],
      ],
      tier2_z_high: [
        DEFAULT_PIPELINE_CONFIG.tier2.z_high,
        [Validators.required, Validators.min(0.5), Validators.max(5)],
      ],
      tier2_five_pct: [
        DEFAULT_PIPELINE_CONFIG.tier2.five_pct_min,
        [Validators.required, Validators.min(50), Validators.max(100)],
      ],
      tier3_enabled: [DEFAULT_PIPELINE_CONFIG.tier3.enabled],
      tier3_contamination: [
        DEFAULT_PIPELINE_CONFIG.tier3.contamination,
        [Validators.required, Validators.min(0.001), Validators.max(0.1)],
      ],
    });

    this.api.health().subscribe({
      next: (h) => (this.healthStatus = h.status),
      error: () => (this.healthStatus = 'offline'),
    });

    this.loadPreset('small');
  }

  loadPreset(preset: SamplePreset): void {
    this.loadingSample = true;
    this.api.sample(preset).subscribe({
      next: (res) => {
        this.form.patchValue({
          rowsJson: JSON.stringify(res.rows, null, 2),
        });
        this.jsonError = null;
        this.loadingSample = false;
        this.snackBar.open(
          `Loaded ${res.meta.preset}: ${res.meta.row_count} rows, ${res.meta.store_count} stores`,
          'Close',
          { duration: 4000 },
        );
      },
      error: (err: Error) => {
        this.loadingSample = false;
        this.snackBar.open(err.message, 'Close', { duration: 6000 });
      },
    });
  }

  loadSample(): void {
    this.loadPreset('small');
  }

  run(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    let rows: SurveyAnswerRow[];
    try {
      rows = JSON.parse(this.form.value.rowsJson as string) as SurveyAnswerRow[];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('rows must be a non-empty JSON array');
      }
      this.jsonError = null;
    } catch (e) {
      this.jsonError = e instanceof Error ? e.message : 'Invalid JSON';
      return;
    }

    const config: PipelineConfig = {
      tier1: {
        enable_blacklist: this.form.value.tier1_blacklist,
        enable_freq_store_day: this.form.value.tier1_freq,
        enable_always_topbox: this.form.value.tier1_always5,
        freq_store_day_min: Number(this.form.value.tier1_freq_min),
        always_topbox_min_n: DEFAULT_PIPELINE_CONFIG.tier1.always_topbox_min_n,
        customer_blacklist_value:
          DEFAULT_PIPELINE_CONFIG.tier1.customer_blacklist_value,
      },
      tier2: {
        enabled: this.form.value.tier2_enabled,
        min_volume: Number(this.form.value.tier2_min_volume),
        z_high: Number(this.form.value.tier2_z_high),
        five_pct_min: Number(this.form.value.tier2_five_pct),
      },
      tier3: {
        enabled: this.form.value.tier3_enabled,
        contamination: Number(this.form.value.tier3_contamination),
        min_entity_n: DEFAULT_PIPELINE_CONFIG.tier3.min_entity_n,
        n_estimators: DEFAULT_PIPELINE_CONFIG.tier3.n_estimators,
        random_state: DEFAULT_PIPELINE_CONFIG.tier3.random_state,
      },
    };

    this.loading = true;
    this.result = null;
    this.api.process({ rows, config }).subscribe({
      next: (res) => {
        this.result = res;
        this.loading = false;
      },
      error: (err: Error) => {
        this.loading = false;
        this.snackBar.open(err.message, 'Close', { duration: 6000 });
      },
    });
  }

  flaggedStoreMonths(): StoreMonthCell[] {
    return this.result?.high_store_months.filter((c) => c.flagged) ?? [];
  }
}
