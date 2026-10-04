import { useQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { fetchWishlist } from '../api/users';
import { timeAgo } from '../lib/format';
import { ProductCard } from '../components/product/ProductCard';
import { SkeletonList } from '../components/ui/Skeleton';
import { BackButton } from '../components/ui/BackButton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

const WISHLIST_KEY = ['wishlist'] as const;

/**
 * Your saved products, with live per-product aggregates (the same rows the
 * catalog uses, so ratings here are always current). Only visible to you.
 */
export function WishlistPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: fetchWishlist,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <SkeletonList rows={6} className="mt-6" />
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState title="Couldn't load your wishlist" onRetry={() => void refetch()} />;
  }

  if (data.length === 0) {
    return (
      <div className="mx-auto max-w-7xl animate-fade-in px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Bookmark className="h-8 w-8" aria-hidden="true" />}
          title="Your wishlist is empty"
          description="Tap the bookmark on any product to keep it handy here — bets on the ones you might buy."
          actionLabel="Browse the catalog"
          actionTo="/catalog"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8 sm:px-6">
      <BackButton className="mb-4" />

      <header className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-fuchsia-500/10 via-transparent to-indigo-500/10 p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white shadow-lg shadow-fuchsia-500/25">
          <Bookmark className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink">My wishlist</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data.length} saved {data.length === 1 ? 'product' : 'products'} — ratings refresh on every visit.
          </p>
        </div>
      </header>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((item) => (
          <li key={item.product.id}>
            <ProductCard product={item.product} footer={
              <p className="text-xs text-ink-faint">Saved {timeAgo(item.addedAt)}</p>
            } />
          </li>
        ))}
      </ul>
    </div>
  );
}