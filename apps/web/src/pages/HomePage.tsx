import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Sparkles, ShieldCheck, Smartphone, Watch, Headphones } from 'lucide-react';
import type { CatalogProduct, TrendingProduct } from '@novatech/shared';
import { fetchHomeAggregates } from '../api/home';
import { CATEGORY_LABELS } from '@novatech/shared';
import { SkeletonList } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { ProductCard } from '../components/product/ProductCard';
import { RatingDisplay } from '../components/ui/Ratings';
import { ScoreBreakdown } from '../components/product/ScoreBreakdown';
import { Button } from '../components/ui/Button';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';
import { mediaUrl } from '../lib/media';
import { formatMoney } from '../lib/format';
import { cn } from '../lib/cn';
import { motion } from 'framer-motion';

const HOME_KEY = ['home'] as const;

function RailBtn({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2.5 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-xl shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20 hover:shadow-glow"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white">
        {icon}
      </span>
      <span className="hidden group-hover:block">{label}</span>
    </Link>
  );
}

export function HomePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: HOME_KEY,
    queryFn: fetchHomeAggregates,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        <div className="h-72 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-amber-500/20 animate-pulse" />
        <SkeletonList rows={4} className="mt-14" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState title="Couldn't load the home feed" onRetry={() => void refetch()} />;
  }

  return (
    <div className="animate-fade-in pb-20">
      <Hero />

      {/* Featured */}
      {data.featured.length > 0 && (
        <Section title="Featured this week" icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} linkTo="/catalog" linkLabel="See all">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.featured.map((p) => (
              <ProductCard key={p.id} product={toCatalogProduct(p)} />
            ))}
          </div>
        </Section>
      )}

      {/* Categories → best sellers */}
      <Section title="Browse by category" linkTo="/catalog" linkLabel="See all">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map(({ category, count, bestSeller }) => (
            <Link
              key={category}
              to={`/catalog?category=${category}`}
              className="focus-ring card group flex flex-col gap-3 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-card-hover dark:hover:border-indigo-700"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-ink">{CATEGORY_LABELS[category]}</span>
                <span className="text-xs font-medium text-ink-muted">{count} products</span>
              </div>
              {bestSeller ? (
                <div className="flex items-center gap-3">
                  <ProgressiveImage
                    src={mediaUrl(bestSeller.imageUrl)}
                    alt={bestSeller.name}
                    className="h-16 w-16 rounded-xl ring-1 ring-line transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{bestSeller.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <RatingDisplay value={bestSeller.averageRating} showDenominator={false} />
                      <span className="text-xs text-ink-faint">{bestSeller.reviewCount} reviews</span>
                    </div>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-300">
                      {formatMoney(bestSeller.priceMinor, bestSeller.currency)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-brand-400 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              ) : (
                <p className="text-sm text-ink-muted">No reviews yet — be the first!</p>
              )}
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Trending now" icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} linkTo="/trending" linkLabel="See all">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {data.trending.map((p) => (
            <div
              key={p.id}
              className="card flex flex-col gap-5 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-card-hover dark:hover:border-indigo-700 sm:flex-row"
            >
              <Link to={`/p/${p.slug}`} className="focus-ring shrink-0">
                <ProgressiveImage src={mediaUrl(p.imageUrl)} alt={p.name} className="h-32 w-full rounded-xl sm:w-44" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/p/${p.slug}`} className="focus-ring text-base font-bold text-ink hover:text-indigo-600 dark:hover:text-indigo-300">
                    {p.name}
                  </Link>
                  <span className="flex h-9 min-w-10 items-center justify-center rounded-lg bg-brand-50 px-2 text-lg font-bold tabular-nums text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                    {p.score.toFixed(1)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{p.tagline}</p>
                <ScoreBreakdown product={p} className="mt-3 border-0 p-0 shadow-none" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <TrustBanner />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
      {/* Background image — full bleed, right-aligned */}
      <div className="absolute inset-0 z-0">
        <img
          src="/media/hero-bg.jpg"
          alt=""
          className="h-full w-full object-cover object-right"
        />
        {/* Dark gradient from left to transparent on right — for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
      </div>

      {/* Content — left-aligned */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="max-w-xl text-left text-white">
          {/* Optional small eyebrow label */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            Community-rated
          </p>

          {/* Headline */}
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Gadget reviews,
            <br />
            <span className="text-violet-400">honestly averaged</span>
            <br />
            by the people who use them.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-md text-base text-white/80 sm:text-lg">
            Every score you see is computed in real time from real reviews —
            no sponsored scores, no rounded hype.
          </p>

          {/* Buttons */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/50 transition-colors"
            >
              <Link to="/catalog">
                Browse the catalog <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-white/[0.05] hover:bg-white/[0.12] border-white/25 text-white backdrop-blur-sm transition-colors"
            >
              <Link to="/trending">What&rsquo;s trending</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
function TrustBanner() {
  return (
    <div className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'No fake scores', body: 'Averages and histograms are Postgres aggregates over VISIBLE reviews only.', tint: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950' },
          { icon: TrendingUp, title: 'Transparent ranking', body: 'Every trending score ships with its own formula breakdown.', tint: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950' },
          { icon: Sparkles, title: 'Realtime reviews', body: 'New reviews appear on product pages the moment they are posted.', tint: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950' },
        ].map(({ icon: Icon, title, body, tint, bg }) => (
          <div key={title} className="card flex gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
              <Icon className={cn('h-5 w-5', tint)} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  linkTo,
  linkLabel,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 mt-16 first:mt-12">
      <div className="mb-6 flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              {icon}
            </span>
          )}
          {title}
        </h2>
        {linkTo && (
          <Link
            to={linkTo}
            className="focus-ring group flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-brand-950 dark:hover:text-brand-200"
          >
            {linkLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function toCatalogProduct(t: TrendingProduct): CatalogProduct {
  return {
    id: t.id, slug: t.slug, name: t.name, tagline: t.tagline, category: t.category,
    brand: t.brand, priceMinor: t.priceMinor, currency: t.currency, imageUrl: t.imageUrl,
    featured: false, releaseDate: null, createdAt: new Date(0),
    averageRating: t.averageRating, reviewCount: t.reviewCount,
  };
}
