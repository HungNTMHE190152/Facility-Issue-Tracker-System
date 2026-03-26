import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type PieChartDatum = { name: string; value: number };

@Component({
  selector: 'app-pie-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pie-root">
      <div class="pie-wrap">
        <svg class="pie-svg" [attr.viewBox]="viewBox">
          <ng-container *ngIf="total > 0; else emptyState">
            <path
              *ngFor="let s of slices"
              class="pie-slice"
              [attr.d]="s.pathD"
              [attr.fill]="s.color"
            />
          </ng-container>
          <ng-template #emptyState>
            <circle class="pie-empty-circle" [attr.cx]="center" [attr.cy]="center" [attr.r]="radius" />
            <text class="pie-empty-text" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">
              No data
            </text>
          </ng-template>
        </svg>
      </div>

      <div class="legend" *ngIf="total > 0">
        <div class="legend-item" *ngFor="let s of slices">
          <span class="legend-swatch" [style.background]="s.color"></span>
          <span class="legend-label">{{ s.name }}: {{ s.value }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .pie-root {
        display: flex;
        gap: 1rem;
        align-items: center;
        width: 100%;
      }

      .pie-wrap {
        flex: 0 0 auto;
      }

      .pie-svg {
        width: 220px;
        height: 220px;
      }

      .pie-slice {
        stroke: rgba(255, 255, 255, 0.85);
        stroke-width: 1;
      }

      .pie-empty-circle {
        fill: rgba(148, 163, 184, 0.15);
        stroke: rgba(148, 163, 184, 0.35);
        stroke-width: 2;
      }

      .pie-empty-text {
        fill: rgba(100, 116, 139, 0.95);
        font-size: 14px;
        font-weight: 600;
      }

      .legend {
        display: grid;
        gap: 0.5rem;
        min-width: 180px;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 13px;
        color: #334155;
        white-space: nowrap;
      }

      .legend-swatch {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7);
      }
    `,
  ],
})
export class PieChartComponent {
  @Input() data: PieChartDatum[] = [];

  viewBox = '0 0 200 200';
  center = 100;
  radius = 85;

  private palette = ['#4f46e5', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];

  get total(): number {
    return this.data.reduce((acc, d) => acc + (d.value ?? 0), 0);
  }

  get slices(): Array<{ name: string; value: number; color: string; pathD: string }> {
    const total = this.total;
    if (total <= 0) return [];

    let angle = -90; // start at top
    return this.data
      .filter((d) => (d.value ?? 0) > 0)
      .map((d, i) => {
        const sliceAngle = ((d.value ?? 0) / total) * 360;
        const startAngle = angle;
        const endAngle = angle + sliceAngle;
        angle = endAngle;

        const pathD = this.describeArc(this.center, this.center, this.radius, startAngle, endAngle);
        return {
          name: d.name,
          value: d.value,
          color: this.palette[i % this.palette.length],
          pathD,
        };
      });
  }

  private polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  }

  private describeArc(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number) {
    const start = this.polarToCartesian(cx, cy, r, endAngleDeg);
    const end = this.polarToCartesian(cx, cy, r, startAngleDeg);

    // Arc spans more than 180 degrees.
    const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? 0 : 1;

    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
  }
}

