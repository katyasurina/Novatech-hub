import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import type { TrendingProduct } from '@novatech/shared';
import { fetchTrending } from '../api/home';
import { CATEGORY_LABELS } from '@novatech/shared';
import { SkeletonList } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { ScoreBreakdown } from '../components/product/ScoreBreakdown';
import { RatingDisplay } from '../components/ui/Ratings';
import { BackButton } from '../components/ui/BackButton';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';
import { formatMoney } from '../lib/format';
import { cn } from '../lib/cn';

const MEDAL = ['🥇', '🥈', '🥉'] as const;
const Medal = ({ rank }: { rank: number }) => {
  if (rank < 1 || rank > 3) return null;
  return <span className="text-lg" aria-hidden="true">{MEDAL[rank - 1]}</span>;
};

const TRENDING_LIMIT = 24;

/**
 * The leaderboard. Rank is the DB-computed trending score (0–10, higher = more
 * worth your attention right now), and every row expands to the exact formula
 * breakdown the server used — rating quality, review volume and recency.
 */
export function TrendingPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['trending', TRENDING_LIMIT],
    queryFn: () => fetchTrending(TRENDING_LIMIT),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <SkeletonList rows={6} className="mt-10" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState title="Couldn't load trending products" onRetry={() => void refetch()} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Nothing trending yet"
        description="Once products pick up reviews, the best of them surface here automatically."
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-4 py-8 sm:px-6">
      <BackButton className="mb-4" />

      <header className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-indigo-500/10 via-transparent to-amber-500/10 p-6 sm:p-8 dark:from-indigo-950/50 dark:to-amber-950/30">
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-indigo-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:bg-brand-900 dark:text-brand-300">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            Recalculated on every request
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-ink">What&rsquo;s trending</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            A trending score weighs <strong className="font-medium text-ink">average rating</strong> (55%),
            <strong className="font-medium text-ink"> review volume </strong> (30%, saturating) and
            <strong className="font-medium text-ink"> recency </strong> (15%, halving every ~21 days).
            Nothing is editorialized — each score below shows its own math.
          </p>
        </div>
      </header>

      <ol className="mt-8 space-y-4">
        {data.map((product, index) => (
          <li key={product.id}>
            <TrendingRow product={product} rank={index + 1} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function TrendingRow({ product, rank }: { product: TrendingProduct; rank: number }) {
  return (
    <article className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
      <div className="flex items-center gap-3 sm:w-16 sm:flex-col sm:items-center">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums',
            rank === 1
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : rank <= 3
                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                : 'bg-slate-100 text-ink-muted dark:bg-slate-800',
          )}
          aria-label={`Rank ${rank}`}
        >
          #{rank}
        </span>
        <span className="hidden sm:block">{rank <= 3 && <Medal rank={rank} />}</span>
      </div>

      <Link to={`/p/${product.slug}`} className="focus-ring block shrink-0">
        <ProgressiveImage src={product.imageUrl} alt={product.name} className="h-24 w-full rounded-lg sm:w-32" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-ink-faint">
              {CATEGORY_LABELS[product.category]} · {product.brand}
            </p>
            <Link
              to={`/p/${product.slug}`}
              className="focus-ring mt-0.5 block font-semibold text-ink hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              {product.name}
            </Link>
            <p className="truncate text-sm text-ink-muted">{product.tagline}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-300">
              {product.score.toFixed(1)}
            </p>
            <p className="text-xs text-ink-faint">trending score</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <RatingDisplay value={product.averageRating} className="text-sm" />
          <span>{product.reviewCount} reviews</span>
          <span className="font-medium text-ink">{formatMoney(product.priceMinor, product.currency)}</span>
        </div>

        <ScoreBreakdown product={product} className="mt-3 border-0 bg-slate-50 p-3 shadow-none dark:bg-slate-800/50" />
      </div>
    </article>
  );
}