import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Chart,
  ChartConfiguration,
  registerables,
} from 'chart.js';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { StoreImpactPoint } from '../../models/api.interface';

Chart.register(...registerables);

@Component({
  selector: 'app-store-impact-chart',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './store-impact-chart.component.html',
  styleUrl: './store-impact-chart.component.scss',
})
export class StoreImpactChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() series: StoreImpactPoint[] = [];
  @Input() tier2Enabled = true;
  @Input() tier3Enabled = false;

  @ViewChild('lineCanvas') lineCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas') barCanvas?: ElementRef<HTMLCanvasElement>;

  selectedStoreId: number | null = null;
  storeIds: number[] = [];

  private lineChart: Chart | null = null;
  private barChart: Chart | null = null;

  ngAfterViewInit(): void {
    this.refreshStoreList();
    this.renderCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series'] || changes['tier2Enabled'] || changes['tier3Enabled']) {
      this.refreshStoreList();
      this.renderCharts();
    }
  }

  ngOnDestroy(): void {
    this.lineChart?.destroy();
    this.barChart?.destroy();
  }

  onStoreChange(storeId: number): void {
    this.selectedStoreId = storeId;
    this.renderCharts();
  }

  selectedStoreSummary(): StoreImpactPoint[] {
    if (this.selectedStoreId == null) {
      return [];
    }
    return this.series
      .filter((p) => p.store_id === this.selectedStoreId)
      .sort((a, b) =>
        a.year === b.year ? a.month - b.month : a.year - b.year,
      );
  }

  private refreshStoreList(): void {
    const ids = [...new Set(this.series.map((p) => p.store_id))].sort(
      (a, b) => a - b,
    );
    this.storeIds = ids;
    if (ids.length === 0) {
      this.selectedStoreId = null;
      return;
    }
    if (this.selectedStoreId == null || !ids.includes(this.selectedStoreId)) {
      this.selectedStoreId = ids[0];
    }
  }

  private renderCharts(): void {
    const points = this.selectedStoreSummary();
    this.renderLineChart(points);
    this.renderBarChart(points);
  }

  private renderLineChart(points: StoreImpactPoint[]): void {
    this.lineChart?.destroy();
    const canvas = this.lineCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const labels = points.map((p) => p.period_label);
    const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
      {
        label: 'Actual 5% (before filters)',
        data: points.map((p) => p.actual_five_pct),
        borderColor: '#4C78A8',
        backgroundColor: '#4C78A8',
        tension: 0.2,
      },
      {
        label: 'After Tier 1',
        data: points.map((p) => p.after_tier1_five_pct),
        borderColor: '#F58518',
        backgroundColor: '#F58518',
        tension: 0.2,
      },
    ];

    if (this.tier2Enabled) {
      datasets.push({
        label: 'After Tier 2',
        data: points.map((p) => p.after_tier2_five_pct),
        borderColor: '#54A24B',
        backgroundColor: '#54A24B',
        tension: 0.2,
      });
    }
    if (this.tier3Enabled) {
      datasets.push({
        label: 'After Tier 3',
        data: points.map((p) => p.after_tier3_five_pct),
        borderColor: '#72B7B2',
        backgroundColor: '#72B7B2',
        tension: 0.2,
      });
    }

    this.lineChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: {
            display: true,
            text: 'Monthly 5%: actual vs sanitized',
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Top-box, %' },
          },
        },
      },
    });
  }

  private renderBarChart(points: StoreImpactPoint[]): void {
    this.barChart?.destroy();
    const canvas = this.barCanvas?.nativeElement;
    if (!canvas || points.length === 0) {
      return;
    }

    const avg = (values: (number | null | undefined)[]): number | null => {
      const nums = values.filter((v): v is number => v != null);
      if (nums.length === 0) {
        return null;
      }
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };

    const actual = avg(points.map((p) => p.actual_five_pct));
    const t1 = avg(points.map((p) => p.after_tier1_five_pct));
    const t2 = this.tier2Enabled
      ? avg(points.map((p) => p.after_tier2_five_pct))
      : null;
    const t3 = this.tier3Enabled
      ? avg(points.map((p) => p.after_tier3_five_pct))
      : null;

    const labels = ['Actual', 'Tier 1'];
    const values: number[] = [actual ?? 0, t1 ?? 0];
    const colors = ['#4C78A8', '#F58518'];

    if (this.tier2Enabled && t2 != null) {
      labels.push('Tier 2');
      values.push(t2);
      colors.push('#54A24B');
    }
    if (this.tier3Enabled && t3 != null) {
      labels.push('Tier 3');
      values.push(t3);
      colors.push('#72B7B2');
    }

    this.barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Average 5% over period',
            data: values,
            backgroundColor: colors,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Filter impact (average for selected store)',
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Top-box, %' },
          },
        },
      },
    });
  }
}
