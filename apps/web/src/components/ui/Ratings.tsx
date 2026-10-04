import { Star } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/format';

function ratingTone(value: number | null): string {
  if (value === null) return 'text-ink-muted';
  if (value >= 8) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 6) return 'text-sky-600 dark:text-sky-400';
  if (value >= 4) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

interface RatingDisplayProps {
  value: number | null;
  /** Show "/10" suffix; default true. */
  showDenominator?: boolean;
  className?: string;
}

/** Big numeric 1–10 score with a star, colour-coded by band. */
export function RatingDisplay({ value, showDenominator = true, className }: RatingDisplayProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold tabular-nums', ratingTone(value), className)}>
      <Star className="h-4 w-4 fill-current" aria-hidden="true" />
      <span>{value === null ? '—' : formatRating(value)}</span>
      {showDenominator && <span className="text-xs font-normal text-ink-muted">/ 10</span>}
    </span>
  );
}

interface HistogramProps {
  /** rating bucket ("1".."10") → count. */
  histogram: Record<string, number>;
  total: number;
  /** Optional selected bucket (e.g. filter chip). */
  selected?: number | null;
  onSelectBucket?: (rating: number | null) => void;
  className?: string;
}

/**
 * Live rating histogram, 10 → 1 top-down, each bar its share of the total.
 * Optionally interactive (tap a bucket to filter the review list).
 */
export function RatingHistogram({ histogram, total, selected, onSelectBucket, className }: HistogramProps) {
  const max = total > 0 ? Math.max(...Object.values(histogram), 1) : 1;
  const buckets = Array.from({ length: 10 }, (_, i) => 10 - i);

  return (
    <div className={cn('space-y-1.5', className)}>
      {buckets.map((rating) => {
        const count = histogram[String(rating)] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isSelected = selected === rating;
        const interactive = onSelectBucket !== undefined;
        return (
          <button
            key={rating}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onSelectBucket?.(isSelected ? null : rating)}
            aria-pressed={interactive ? isSelected : undefined}
            className={cn(
              'group flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-sm',
              interactive && 'focus-ring cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800',
            )}
          >
            <span className="w-4 text-right tabular-nums text-ink-muted">{rating}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  isSelected ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-indigo-400/70 group-hover:bg-indigo-500',
                )}
                style={{ width: total > 0 ? `${(count / max) * 100}%` : '0%' }}
              />
            </div>
            <span className="w-8 text-right text-xs tabular-nums text-ink-muted">{count}</span>
          </button>
        );
      })}
    </div>
  );
}