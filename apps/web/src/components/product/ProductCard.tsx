import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import type { CatalogProduct } from '@novatech/shared';
import { CATEGORY_LABELS } from '@novatech/shared';
import { formatMoney } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/Badge';
import { RatingDisplay } from '../ui/Ratings';
import { WishlistButton } from './WishlistButton';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { mediaUrl } from '../../lib/media';

interface ProductCardProps {
  product: CatalogProduct;
  className?: string;
  /** Optional footer strip inside the card (e.g. "Saved 2d ago"). */
  footer?: React.ReactNode;
}

/** Fallback artwork when the product's image URL is missing or broken. */
const PLACEHOLDER_IMAGE = '/media/products/placeholder.svg';

/** Catalog/grid card: image, category, rating + count, price, wishlist toggle. */
export function ProductCard({ product, className, footer }: ProductCardProps) {
  const { imageUrl, name, tagline, brand, category, priceMinor, currency, averageRating, reviewCount, slug } =
    product;

  const [imageFailed, setImageFailed] = useState(false);
  const src = imageUrl && !imageFailed ? mediaUrl(imageUrl) : PLACEHOLDER_IMAGE;

  return (
    <Link
      to={`/p/${slug}`}
      className={cn(
        'focus-ring group card block overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-card-hover dark:hover:border-brand-700',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
        <ProgressiveImage
          src={src}
          alt={name}
          onError={() => {
            if (imageUrl && !imageFailed) setImageFailed(true);
          }}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Hover gradient sheen */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute left-3 top-3">
          <Badge tone="neutral">{CATEGORY_LABELS[category]}</Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">{brand}</p>
            <h3 className="mt-1 truncate text-base font-bold text-ink transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
              {name}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">{tagline}</p>
          </div>
          <WishlistButton product={product} className="shrink-0" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex items-center gap-1.5">
            <RatingDisplay value={averageRating} showDenominator={false} />
            <span className="text-sm tabular-nums text-ink-faint">({reviewCount})</span>
            <MessageSquare className="ml-1 h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
          </div>
          <span className="text-base font-bold tabular-nums text-ink">
            {formatMoney(priceMinor, currency)}
          </span>
        </div>
      </div>

      {footer && <div className="border-t border-line px-4 py-2">{footer}</div>}
    </Link>
  );
}