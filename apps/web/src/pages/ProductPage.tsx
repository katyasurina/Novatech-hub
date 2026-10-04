import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsUpDown, Package, Trash2, Zap } from 'lucide-react';
import type { ReviewDto } from '@novatech/shared';
import { CATEGORY_LABELS, REVIEW_SORTS, type ReviewSort } from '@novatech/shared';
import { fetchProductDetail, fetchReviews } from '../api/product';
import { deleteReview } from '../api/reviews';
import { deleteReviewAsAdmin } from '../api/admin';
import { isApiClientError } from '../api/client';
import { mediaUrl } from '../lib/media';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { joinProductRoom, leaveProductRoom, onReviewCreated } from '../lib/socket';
import { formatMoney, formatDate } from '../lib/format';
import { cn } from '../lib/cn';
import { RatingDisplay, RatingHistogram } from '../components/ui/Ratings';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { WishlistButton } from '../components/product/WishlistButton';
import { ReviewCard } from '../components/reviews/ReviewCard';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';
import { ReviewForm } from '../components/reviews/ReviewForm';

const REVIEWS_PAGE_SIZE = 8;

/**
 * Product page: live rating summary + histogram, gallery + specs, and the
 * review feed. Reviews push over Socket.io (`review:created`) so a new review
 * lands on every open product page immediately — the queries invalidate and
 * the aggregates recompute from the DB.
 */
export function ProductPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Local review-feed state (sort + page). Changing sort restarts at page 1.
  const [reviewSort, setReviewSort] = useState<ReviewSort>('newest');
  const [reviewPage, setReviewPage] = useState(1);
  const [editingReview, setEditingReview] = useState<ReviewDto | null>(null);
  const [deletingReview, setDeletingReview] = useState<ReviewDto | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const detail = useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProductDetail(slug),
  });

  const product = detail.data?.product ?? null;

  // -- Realtime -------------------------------------------------------------
  // Join the product's room once loaded; a pushed review invalidates the
  // detail + review queries so every open page stays live.
  useEffect(() => {
    const pid = product?.id;
    if (!pid) return;
    joinProductRoom(pid);
    const unsubscribe = onReviewCreated(() => {
      queryClient.invalidateQueries({ queryKey: ['reviews', pid] });
      queryClient.invalidateQueries({ queryKey: ['product', slug] });
    });
    return () => {
      unsubscribe();
      leaveProductRoom(pid);
    };
  }, [product?.id, slug, queryClient]);

  const reviews = useQuery({
    queryKey: ['reviews', product?.id, reviewSort, reviewPage],
    queryFn: () =>
      product
        ? fetchReviews(product.id, { page: reviewPage, pageSize: REVIEWS_PAGE_SIZE, sort: reviewSort })
        : Promise.reject(new Error('No product loaded')),
    enabled: !!product,
  });

  const deleteMutation = useMutation({
    mutationFn: (review: ReviewDto) =>
      user?.role === 'ADMIN'
        ? deleteReviewAsAdmin(review.id)
        : deleteReview(product!.id, review.id),
    onSuccess: () => {
      toast.success('Review deleted', 'It has been removed.');
      setDeletingReview(null);
      queryClient.invalidateQueries({ queryKey: ['reviews', product!.id] });
      queryClient.invalidateQueries({ queryKey: ['product', slug] });
    },
    onError: () => toast.error('Could not delete review', 'Please try again.'),
  });

  // Own review within the current page (drives whether the composer shows).
  // Computed inline — distinct from hooks before any early return.
  const myReview = reviews.data?.items.find((r) => r.author.id === user?.id) ?? null;
  // Anyone signed in (any role) can write; guests get the "create an account" nudge.
  const canWrite = user !== null;

  const changeSort = (sort: ReviewSort) => {
    setReviewSort(sort);
    setReviewPage(1);
  };

  const goToReviewsPage = (page: number) => {
    setReviewPage(page);
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' });
  };

  // -- Early returns --------------------------------------------------------

  if (detail.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Skeleton className="h-5 w-56" />
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (detail.isError || !product) {
    const notFound = isApiClientError(detail.error) && detail.error.status === 404;
    return (
      <ErrorState
        title={notFound ? 'Product not found' : "Couldn't load this product"}
        description={
          notFound
            ? 'It may have been removed by an admin, or the link is wrong.'
            : 'Something went wrong on our side. Please try again.'
        }
        actionLabel="Back to catalog"
        onAction={() => {
          window.location.href = '/catalog';
        }}
      />
    );
  }

  // Safe to non-null-assert: the `!product` early return above guarantees data.
  const summary = detail.data!.summary;
  // Plain computation now that product is known non-null (post early-return).
  const gallery = [mediaUrl(product.imageUrl), ...product.galleryUrls.filter((u) => u !== product.imageUrl).map(mediaUrl)];

  const totalReviewPages = reviews.data?.totalPages ?? 0;

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8 sm:px-6">
      {/* Back link (Rule 11) */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/" className="focus-ring rounded hover:text-ink">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/catalog" className="focus-ring rounded hover:text-ink">Catalog</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/catalog?category=${product.category}`} className="focus-ring rounded hover:text-ink">
          {CATEGORY_LABELS[product.category]}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate font-medium text-ink">{product.name}</span>
      </nav>

      {/* Header */}
      <header className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Gallery + description */}
        <div className="min-w-0">
          <figure className="card overflow-hidden">
            <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800">
              <ProgressiveImage src={gallery[galleryIndex]} alt={product.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = mediaUrl(product.imageUrl); }} />
            </div>
          </figure>

          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Product gallery">
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setGalleryIndex(i)}
                  aria-pressed={galleryIndex === i}
                  aria-label={`View image ${i + 1}`}
                  className={cn(
                    'focus-ring h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                    galleryIndex === i ? 'border-indigo-500' : 'border-transparent opacity-70 hover:opacity-100',
                  )}
                >
                    <ProgressiveImage src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <section className="card mt-6 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Package className="h-5 w-5 text-indigo-500" aria-hidden="true" />
              What it is
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{product.description}</p>
          </section>

          {Object.keys(product.specs).length > 0 && (
            <section className="card mt-6 p-5">
              <h2 className="text-lg font-semibold text-ink">Specs</h2>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{key}</dt>
                    <dd className="text-right text-sm text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {/* Summary rail */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{CATEGORY_LABELS[product.category]}</Badge>
                  <span className="text-xs text-ink-muted">{product.brand}</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold text-ink">{product.name}</h1>
                <p className="mt-1 text-sm text-ink-muted">{product.tagline}</p>
              </div>
              <WishlistButton product={product} className="h-10 w-10" />
            </div>

            <p className="mt-4 text-2xl font-bold text-ink">
              {formatMoney(product.priceMinor, product.currency)}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">
              Released {formatDate(product.releaseDate)}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
              <RatingDisplay value={summary.average} />
              <span className="text-sm text-ink-muted">
                {summary.count} review{summary.count === 1 ? '' : 's'}
              </span>
              {summary.average !== null && (
                <span className="text-xs text-ink-faint">computed live from visible reviews</span>
              )}
            </div>
          </section>

          {summary.count > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-ink">Rating distribution</h2>
              <RatingHistogram histogram={summary.histogram} total={summary.count} className="mt-3" />
              <p className="mt-3 text-xs text-ink-faint">
                Each bar is the share of the {summary.count} visible reviews at that rating.
              </p>
            </section>
          )}

          <section className="card flex items-start gap-3 p-4">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm text-ink-muted">
              Numbers on this page are Postgres aggregates over visible reviews — never cached,
              never seeded into the response.
            </p>
          </section>
        </aside>
      </header>

      {/* Reviews */}
      <section id="reviews" className="mt-12 scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ChevronsUpDown className="h-5 w-5 text-indigo-500" aria-hidden="true" />
            Reviews
            {reviews.data && <span className="text-sm font-normal text-ink-muted">({reviews.data.total})</span>}
          </h2>
          <Select
            aria-label="Sort reviews"
            value={reviewSort}
            onChange={(e) => changeSort(e.target.value as ReviewSort)}
            className="h-9 w-auto"
          >
            {REVIEW_SORTS.map((s) => (
              <option key={s} value={s}>
                {REVIEW_SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
          {/* Composer / guide */}
          <div>
            {canWrite && !myReview ? (
              <div className="card p-5">
                <h3 className="font-semibold text-ink">Write a review</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Your rating feeds the averages and histogram instantly.
                </p>
                <div className="mt-4">
                  <ReviewForm productId={product.id} productName={product.name} onDone={() => setReviewPage(1)} />
                </div>
              </div>
            ) : (
              <div className="card p-5 text-sm text-ink-muted">
                {myReview ? (
                  <p>
                    You&rsquo;ve reviewed this product — use <span className="font-medium text-ink">Edit</span> on your
                    review below to change it.
                  </p>
                ) : (
                  <p>
                    <Link to="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                      Create an account
                    </Link>{' '}
                    to share your own experience and help the community&rsquo;s averages stay honest.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Feed */}
          <div className="min-w-0">
            {reviews.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-2xl" />
                ))}
              </div>
            ) : reviews.isError ? (
              <ErrorState
                title="Couldn't load reviews"
                onRetry={() =>
                  queryClient.invalidateQueries({ queryKey: ['reviews', product.id] })
                }
              />
            ) : reviews.data!.items.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Be the first to rate this product — the averages update instantly."
              />
            ) : (
              <div className="space-y-4">
                {reviews.data!.items.map((review) => {
                  const own = review.author.id === user?.id;
                  const isEditing = editingReview?.id === review.id;
                  return (
                    <div key={review.id}>
                      {isEditing ? (
                        <div className="card p-4">
                          <h4 className="mb-3 font-semibold text-ink">Edit your review</h4>
                          <ReviewForm
                            productId={product.id}
                            productName={product.name}
                            initial={review}
                            onDone={() => setEditingReview(null)}
                            onCancel={() => setEditingReview(null)}
                          />
                        </div>
                      ) : (
                        <ReviewCard
                          review={review}
                          productId={product.id}
                          canModify={own || user?.role === 'ADMIN'}
                          onEdit={own ? setEditingReview : undefined}
                          onDelete={setDeletingReview}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {totalReviewPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reviewPage <= 1}
                  onClick={() => goToReviewsPage(reviewPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
                </Button>
                <span className="px-3 text-sm tabular-nums text-ink-muted">
                  {reviewPage} / {totalReviewPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reviewPage >= totalReviewPages}
                  onClick={() => goToReviewsPage(reviewPage + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal
        open={deletingReview !== null}
        onClose={() => setDeletingReview(null)}
        title="Delete review?"
      >
        <p className="text-sm text-ink-muted">
          &ldquo;{deletingReview?.title}&rdquo; will be permanently removed
          {user?.role === 'ADMIN' ? ' and its votes dropped' : ''}. This can&rsquo;t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeletingReview(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deletingReview && deleteMutation.mutate(deletingReview)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

const REVIEW_SORT_LABELS: Record<ReviewSort, string> = {
  newest: 'Newest first',
  highest: 'Highest rated',
  lowest: 'Lowest rated',
  helpful: 'Most helpful',
};