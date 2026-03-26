import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type LineChartDatum = { month: number; count: number };

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="line-root">
      <div class="line-head">
        <div class="line-title">Monthly tickets</div>
      </div>

      <svg class="line-svg" [attr.viewBox]="viewBox" role="img" aria-label="Monthly chart">
        <ng-container *ngIf="hasData; else empty">
          <line class="axis" [attr.x1]="pad" [attr.y1]="padY" [attr.x2]="padX" [attr.y2]="padY"></line>
          <line class="axis" [attr.x1]="padX" [attr.y1]="pad" [attr.x2]="padX" [attr.y2]="padY"></line>

          <polyline class="line-poly" [attr.points]="polylinePoints"></polyline>

          <circle
            *ngFor="let p of points"
            class="line-point"
            [attr.cx]="p.x"
            [attr.cy]="p.y"
            [attr.r]="4"
          ></circle>

          <g *ngFor="let p of points">
            <text class="line-label" [attr.x]="p.x" [attr.y]="padY + 18" text-anchor="middle">
              {{ monthName(p.month) }}
            </text>
          </g>
        </ng-container>

        <ng-template #empty>
          <text class="line-empty-text" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">
            No data
          </text>
        </ng-template>
      </svg>
    </div>
  `,
  styles: [
    `
      .line-root {
        width: 100%;
      }

      .line-head {
        margin-bottom: 0.5rem;
      }

      .line-title {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
      }

      .line-svg {
        width: 100%;
        height: 220px;
        background: rgba(255, 255, 255, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 14px;
      }

      .axis {
        stroke: rgba(100, 116, 139, 0.35);
        stroke-width: 1;
      }

      .line-poly {
        fill: none;
        stroke: #4f46e5;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .line-point {
        fill: #fff;
        stroke: #4f46e5;
        stroke-width: 2;
      }

      .line-label {
        font-size: 11px;
        fill: rgba(51, 65, 85, 0.95);
      }

      .line-empty-text {
        fill: rgba(100, 116, 139, 0.95);
        font-size: 14px;
        font-weight: 600;
      }
    `,
  ],
})
export class LineChartComponent {
  @Input() data: LineChartDatum[] = [];

  viewBox = '0 0 360 220';

  // drawing area
  pad = 20;
  padX = 340;
  padY = 150;

  private monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  get hasData(): boolean {
    return (this.data?.length ?? 0) > 0;
  }

  monthName(month: number): string {
    if (!month || month < 1 || month > 12) return `${month ?? ''}`;
    return this.monthNames[month - 1] ?? `${month}`;
  }

  get points(): Array<{ x: number; y: number; month: number }> {
    const sorted = [...(this.data ?? [])].sort((a, b) => a.month - b.month);
    const maxCount = Math.max(1, ...sorted.map((d) => d.count ?? 0));

    const width = this.padX - this.pad;
    const height = this.padY - this.pad;

    if (sorted.length === 1) {
      const d = sorted[0];
      return [{ x: this.pad + width / 2, y: this.padY - (d.count / maxCount) * height, month: d.month }];
    }

    return sorted.map((d, i) => {
      const x = this.pad + (i / (sorted.length - 1)) * width;
      const normalized = (d.count ?? 0) / maxCount;
      const y = this.padY - normalized * height;
      return { x, y, month: d.month };
    });
  }

  get polylinePoints(): string {
    const pts = this.points;
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  }
}

