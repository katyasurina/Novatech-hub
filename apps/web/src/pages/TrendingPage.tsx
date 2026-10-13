import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import type { TrendingProduct } from '@novatech/shared';
import { fetchTrending } from '../api/home';
import { CATEGORY_LABELS } from '@novatech/shared';
import { SkeletonList } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { ScoreBreakdown } from '../components/product/ScoreBreakdown';
import { BackButton } from '../components/ui/BackButton';
import { ProductCard } from '../components/product/ProductCard';
import { formatMoney } from '../lib/format';
import { cn } from '../lib/cn';

const MEDAL = ['🥇', '🥈', '🥉'] as const;

const TRENDING_LIMIT = 24;

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
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8 sm:px-6">
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

      {/* Mobile-first 2-column grid */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((product, index) => (
          <TrendingCard key={product.id} product={product} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

function TrendingCard({ product, rank }: { product: TrendingProduct; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const toCatalogProduct = (t: TrendingProduct) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    category: t.category,
    brand: t.brand,
    priceMinor: t.priceMinor,
    currency: t.currency,
    imageUrl: t.imageUrl,
    featured: false,
    releaseDate: null,
    createdAt: new Date(0),
    averageRating: t.averageRating,
    reviewCount: t.reviewCount,
  });

  return (
    <div className="card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card-hover dark:hover:border-brand-700">
      {/* Rank badge */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
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
        {rank <= 3 && <span className="text-base" aria-hidden="true">{MEDAL[rank - 1]}</span>}
        <div className="ml-auto flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold tabular-nums text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
          {product.score.toFixed(1)}
        </div>
      </div>

      {/* ProductCard for the image/text */}
      <ProductCard product={toCatalogProduct(product)} className="border-0 shadow-none hover:-translate-y-0" />

      {/* Breakdown shown on mobile below the card (Option A, collapsed by default) */}
      <div className="border-t border-line">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="focus-ring flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          aria-expanded={expanded}
        >
          <span>Why it&rsquo;s trending</span>
          <span className={cn('text-xs transition-transform', expanded && 'rotate-180')}>▼</span>
        </button>
        {expanded && (
          <div className="px-3 pb-3">
            <ScoreBreakdown product={product} className="border-0 shadow-none p-0 bg-transparent dark:bg-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
