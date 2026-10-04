import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, CATALOG_SORTS, type CatalogQuery } from '@novatech/shared';

/**
 * The catalog screen is URL-driven: every filter (search, category, sort,
 * price, rating, pagination) lives in the query string so results are
 * shareable and bookmarkable, and back/forward works naturally.
 *
 * Reading: parse the current params into a CatalogQuery.
 * Writing: `setQuery(patch)` applies a patch, resetting page → 1 unless the
 * patch itself sets page.
 */

const intParam = (value: string | null, fallback: number): number => {
  if (value === null || value === '' || Number.isNaN(Number(value))) return fallback;
  return Number(value);
};

export function useCatalogUrlState(): {
  query: CatalogQuery;
  setQuery: (patch: Partial<CatalogQuery>) => void;
  clear: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo<CatalogQuery>(() => {
    const category = searchParams.get('category');
    const sort = searchParams.get('sort');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minRating = searchParams.get('minRating');
    const q = searchParams.get('q') ?? undefined;

    return {
      page: intParam(searchParams.get('page'), 1),
      pageSize: intParam(searchParams.get('pageSize'), 12),
      q: q && q.trim() ? q.trim() : undefined,
      category: category && (CATEGORIES as readonly string[]).includes(category) ? (category as CatalogQuery['category']) : undefined,
      sort: sort && (CATALOG_SORTS as readonly string[]).includes(sort) ? (sort as CatalogQuery['sort']) : 'trending',
      minPrice: minPrice !== null && Number.isFinite(Number(minPrice)) ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== null && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : undefined,
      minRating: minRating !== null && Number.isFinite(Number(minRating)) ? Number(minRating) : undefined,
    };
  }, [searchParams]);

  const setQuery = useCallback(
    (patch: Partial<CatalogQuery>) => {
      const next: CatalogQuery = {
        ...query,
        ...patch,
        // Any filter change restarts at page 1 unless the patch is page-specific.
        page: 'page' in patch ? (patch.page ?? 1) : 1,
      };
      const params = new URLSearchParams();
      const set = (key: keyof CatalogQuery, value: string | number | undefined) => {
        if (value !== undefined && value !== '' && value !== 0) params.set(key, String(value));
      };
      set('page', next.page === 1 ? undefined : next.page);
      set('pageSize', next.pageSize === 12 ? undefined : next.pageSize);
      set('q', next.q);
      set('category', next.category);
      set('sort', next.sort === 'trending' ? undefined : next.sort);
      set('minPrice', next.minPrice);
      set('maxPrice', next.maxPrice);
      set('minRating', next.minRating);
      setSearchParams(params, { replace: false });
    },
    [query, setSearchParams],
  );

  const clear = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return { query, setQuery, clear };
}