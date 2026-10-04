import { Link } from 'react-router-dom';
import { Shell, Heart } from 'lucide-react';
import { CATEGORIES, CATEGORY_LABELS } from '@novatech/shared';

/**
 * Footer — brand + honesty note, explore links, and category shortcuts so the
 * catalogue is always two clicks away.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line bg-surface-raised">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-2" aria-label="NovaTech Hub home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20">
                <Shell className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-black tracking-tight text-ink">
                NovaTech
                <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">Hub</span>
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
              Every rating, histogram and trending score on this site is computed live from real
              reviews in the database — nothing is hardcoded.
            </p>
          </div>

          <nav aria-label="Explore" className="lg:justify-self-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Explore</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/catalog" className="focus-ring rounded transition-colors text-ink-muted hover:text-indigo-600 dark:hover:text-indigo-300">
                  Catalog
                </Link>
              </li>
              <li>
                <Link to="/trending" className="focus-ring rounded transition-colors text-ink-muted hover:text-indigo-600 dark:hover:text-indigo-300">
                  Trending
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="focus-ring rounded transition-colors text-ink-muted hover:text-indigo-600 dark:hover:text-indigo-300">
                  Wishlist
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Categories" className="lg:justify-self-end">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Categories</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {CATEGORIES.map((cat) => (
                <li key={cat}>
                  <Link
                    to={`/catalog?category=${cat}`}
                    className="focus-ring rounded transition-colors text-ink-muted hover:text-indigo-600 dark:hover:text-indigo-300"
                  >
                    {CATEGORY_LABELS[cat]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-10 flex items-center justify-center gap-1 border-t border-line pt-6 text-center text-xs text-ink-faint">
          Built with <Heart className="h-3 w-3 text-red-500" aria-hidden="true" /> and a PostgreSQL full-text dream · {year}
        </p>
      </div>
    </footer>
  );
}