import { TrendingUp, Info } from 'lucide-react';
import type { TrendingProduct } from '@novatech/shared';
import { cn } from '../../lib/cn';

/**
 * "Why is this trending?" — renders each score component with its weight and
 * the live value, plus the exact formula the server uses. This is the visible
 * math the product's rating UI promises.
 */
export function ScoreBreakdown({ product, className }: { product: TrendingProduct; className?: string }) {
  const { score, scoreBreakdown } = product;

  const components: Array<{ label: string; value: number; description: string }> = [
    { label: 'Rating quality', value: scoreBreakdown.ratingComponent, description: 'weighted by how high the average sits on the 1–10 scale' },
    { label: 'Review volume', value: scoreBreakdown.volumeComponent, description: 'more reviews, saturating as they pile up' },
    { label: 'Recency', value: scoreBreakdown.recencyComponent, description: 'fresh reviews decay over ~21 days' },
  ];

  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <TrendingUp className="h-4 w-4 text-indigo-500" aria-hidden="true" />
          Why it&rsquo;s trending
        </h3>
        <span className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-300">
          {score.toFixed(1)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {components.map((c) => (
          <div key={c.label}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink">{c.label}</span>
              <span className="tabular-nums text-ink-muted">{c.value.toFixed(3)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                style={{ width: pct(c.value) }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-faint">{c.description}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-1.5 border-t border-line pt-3 text-[11px] text-ink-faint">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{scoreBreakdown.formula}</span>
      </p>
    </div>
  );
}