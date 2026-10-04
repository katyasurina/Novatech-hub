import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import type { CatalogProduct, WishlistItem } from '@novatech/shared';
import { addToWishlist, fetchWishlist, removeFromWishlist } from '../../api/users';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { cn } from '../../lib/cn';

const WISHLIST_KEY = ['wishlist'] as const;

/**
 * Read the user's wishlist id set reactively. Only enabled when signed in.
 * The list query is shared app-wide so a toggle here updates everywhere.
 */
export function useWishlistIds(): Set<string> {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: fetchWishlist,
    enabled: !!user,
    staleTime: 3 * 60_000,
  });
  return new Set((data ?? []).map((item) => item.product.id));
}

interface WishlistButtonProps {
  product: CatalogProduct;
  className?: string;
}

/** Bookmark toggle with optimistic UI: flips instantly, rolls back on failure. */
export function WishlistButton({ product, className }: WishlistButtonProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ids = useWishlistIds();
  const isWishlisted = ids.has(product.id);

  const mutation = useMutation({
    mutationFn: async ({ productId, add }: { productId: string; add: boolean }) => {
      if (add) await addToWishlist(productId);
      else await removeFromWishlist(productId);
    },
    onMutate: async ({ productId, add }) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_KEY });
      const previous = queryClient.getQueryData<WishlistItem[]>(WISHLIST_KEY) ?? [];
      const next: WishlistItem[] = add
        ? [{ addedAt: new Date(), product }, ...previous.filter((i) => i.product.id !== productId)]
        : previous.filter((i) => i.product.id !== productId);
      queryClient.setQueryData(WISHLIST_KEY, next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(WISHLIST_KEY, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });

  const toggle = () => {
    if (!user) {
      navigate('/login', { state: { from: `/p/${product.slug}` } });
      return;
    }
    const add = !isWishlisted;
    mutation.mutate(
      { productId: product.id, add },
      {
        onSuccess: () => {
          toast.success(add ? 'Saved to wishlist' : 'Removed from wishlist', product.name);
        },
        onError: () => toast.error('Could not update wishlist', 'Please try again.'),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        // The card is a <Link>; bookmark clicks must not navigate.
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-pressed={isWishlisted}
      aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
      title={isWishlisted ? 'In your wishlist' : 'Add to wishlist'}
      className={cn(
        'focus-ring flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        isWishlisted
          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300'
          : 'text-ink-faint hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
        className,
      )}
    >
      {isWishlisted ? (
        <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Bookmark className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}