import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { fetchCatalog } from '../api/catalog';
import { useCatalogUrlState } from '../hooks/useCatalogUrlState';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATALOG_PAGE_SIZES,
  PAGE_SIZE_DEFAULT,
  type CatalogQuery,
  type CatalogSort,
} from '@novatech/shared';
import { cn } from '../lib/cn';
import { ProductCard } from '../components/product/ProductCard';
import { SkeletonList } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { BackButton } from '../components/ui/BackButton';

const MIN_RATING_OPTIONS = [undefined, 8, 7, 6, 5] as const;

const SORT_LABELS: Record<CatalogSort, string> = {
  trending: 'Trending',
  newest: 'Newest',
  top_rated: 'Top rated',
  most_reviewed: 'Most reviewed',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

const PRICE_BUCKETS = [50, 100, 200, 500, 1000, 2000, 5000] as const;

/**
 * Catalog — fully URL-driven: search, filters, sort and pagination all live in
 * the query string so any view is shareable. Search is debounced; every filter
 * resets to page 1 via `setQuery`; the sidebar collapses into a disclosure on
 * small screens.
 */
export function CatalogPage() {
  const { query, setQuery, clear } = useCatalogUrlState();

  // Local search box state; the debounced value pushes into the URL.
  const [searchInput, setSearchInput] = useState(query.q ?? '');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const appliedSearch = query.q ?? '';
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (debouncedSearch !== appliedSearch) {
      setQuery({ q: debouncedSearch || undefined });
    }
  }, [debouncedSearch, appliedSearch, setQuery]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['catalog', query],
    queryFn: () => fetchCatalog(query),
  });

  const totalPages = data?.totalPages ?? 0;
  const items = data?.items ?? [];
  const hasActiveFilters = Boolean(
    query.category || query.minPrice || query.maxPrice || query.minRating || query.q,
  );

  const goToPage = (page: number) => {
    setQuery({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filterPanel = (
    <FilterPanel
      query={query}
      setQuery={setQuery}
      onClear={clear}
      active={hasActiveFilters}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <BackButton to="/" className="mb-4">Back home</BackButton>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-2xl font-black tracking-tight text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-fuchsia-400">
            Gadget catalog
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data ? `${data.total} products` : 'Loading…'} — live ratings from the community
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <label htmlFor="catalog-search" className="sr-only">Search products</label>
            <input
              id="catalog-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              className="h-9 w-44 rounded-lg border border-line bg-surface-raised pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 sm:w-56"
            />
          </div>
          <Select
            aria-label="Sort products"
            value={query.sort ?? 'trending'}
            onChange={(e) => setQuery({ sort: e.target.value as CatalogSort, page: 1 })}
            className="h-9 w-auto"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        {/* Mobile filter disclosure */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((open) => !open)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="mobile-filters"
            className="focus-ring flex w-full items-center justify-between rounded-lg border border-line bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              Filters
              {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-indigo-500" aria-label="Active filters" />}
            </span>
            <ChevronDown className={cn('h-4 w-4 text-ink-muted transition-transform', mobileFiltersOpen && 'rotate-180')} aria-hidden="true" />
          </button>
          {mobileFiltersOpen && <div id="mobile-filters" className="mt-4">{filterPanel}</div>}
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">{filterPanel}</div>
        </aside>

        {/* Results */}
        <main>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted" role="status">
              {isLoading ? 'Loading results…' : `${data?.total ?? 0} matching`}
              {isFetching && !isLoading && <span className="ml-2 text-xs text-ink-faint">refreshing…</span>}
            </p>
            <Select
              aria-label="Results per page"
              value={query.pageSize ?? PAGE_SIZE_DEFAULT}
              onChange={(e) => setQuery({ pageSize: Number(e.target.value) })}
              className="h-9 w-auto"
            >
              {CATALOG_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </Select>
          </div>

          {isLoading ? (
            <SkeletonList rows={6} />
          ) : isError ? (
            <ErrorState title="Couldn't load the catalog" onRetry={() => void refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No products match"
              description="Try a different search or clear some filters."
              actionLabel="Reset filters"
              onAction={clear}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <Pagination current={query.page ?? 1} total={totalPages} onPage={goToPage} />
          )}
        </main>
      </div>
    </div>
  );
}

interface FilterPanelProps {
  query: CatalogQuery;
  setQuery: (patch: Partial<CatalogQuery>) => void;
  onClear: () => void;
  active: boolean;
}

function FilterPanel({ query, setQuery, onClear, active }: FilterPanelProps) {
  return (
    <div className="space-y-6">
      <FilterBlock title="Category">
        <div className="space-y-1">
          <FilterChip
            active={query.category === undefined}
            onClick={() => setQuery({ category: undefined })}
            label="All categories"
          />
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              active={query.category === cat}
              onClick={() => setQuery({ category: cat })}
              label={CATEGORY_LABELS[cat]}
            />
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Minimum rating">
        <div className="space-y-1">
          {MIN_RATING_OPTIONS.map((rating) => (
            <FilterChip
              key={rating ?? 'any'}
              active={query.minRating === rating}
              onClick={() => setQuery({ minRating: rating })}
              label={rating === undefined ? 'Any rating' : `${rating}+ stars`}
            />
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Price (max)">
        <Select
          aria-label="Maximum price"
          value={query.maxPrice ?? 'any'}
          onChange={(e) =>
            setQuery({ maxPrice: e.target.value === 'any' ? undefined : Number(e.target.value) })
          }
          className="h-9"
        >
          <option value="any">Any price</option>
          {PRICE_BUCKETS.map((bucket) => (
            <option key={bucket} value={bucket}>
              Under ${bucket}
            </option>
          ))}
        </Select>
      </FilterBlock>

      {active && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-red-600 hover:bg-red-50">
          <X className="h-4 w-4" aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-ring flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
          : 'text-ink-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
      )}
    >
      {label}
    </button>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === total || Math.abs(p - current) <= 1,
  );
  const items: Array<number | 'gap'> = [];
  let prev = 0;
  for (const p of pages) {
    if (prev > 0 && p - prev > 1) items.push('gap');
    items.push(p);
    prev = p;
  }
  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => onPage(current - 1)}
        aria-label="Previous page"
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      {items.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-ink-faint">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === current ? 'page' : undefined}
            className={cn(
              'focus-ring h-9 w-9 rounded-lg text-sm font-medium transition-colors',
              p === current
                ? 'bg-indigo-600 text-white'
                : 'text-ink-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={current >= total}
        onClick={() => onPage(current + 1)}
        aria-label="Next page"
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}