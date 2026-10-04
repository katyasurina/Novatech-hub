import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  Package,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MAX_RATING,
  type AdminStats,
  type Category,
  type ModerationItem,
  type ProductDetail,
  type ProductUpsertInput,
} from '@novatech/shared';
import {
  createAdminProduct,
  deleteAdminProduct,
  deleteReviewAsAdmin,
  fetchAdminProducts,
  fetchAdminStats,
  fetchModerationQueue,
  setReviewStatus,
  updateAdminProduct,
  type AdminProduct,
} from '../api/admin';
import { fetchProductDetail } from '../api/product';
import { isApiClientError } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { formatDate, formatMoney, formatRating, timeAgo } from '../lib/format';
import { cn } from '../lib/cn';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { Skeleton, SkeletonList } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { BackButton } from '../components/ui/BackButton';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';

const ADMIN_STATS_KEY = ['admin-stats'] as const;
const ADMIN_PRODUCTS_PAGE_SIZE = 20;
const MOD_PAGE_SIZE = 10;

type AdminTab = 'dashboard' | 'products' | 'moderation';

const TABS: ReadonlyArray<{ key: AdminTab; label: string; icon: LucideIcon }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'moderation', label: 'Moderation', icon: ShieldAlert },
];

const CATEGORY_COLORS: Record<Category, string> = {
  AUDIO: '#6366f1',
  WEARABLES: '#8b5cf6',
  SMART_HOME: '#0ea5e9',
  MOBILE: '#10b981',
  COMPUTING: '#f59e0b',
  PHOTOGRAPHY: '#ef4444',
};

/**
 * Admin control panel: live dashboard (recharts), catalogue CRUD with a full
 * product form, and a review moderation queue. Routed behind an ADMIN-only
 * guard in App.tsx.
 */
export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<AdminTab>('dashboard');

  if (user?.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-7xl animate-fade-in px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" aria-hidden="true" />}
          title="Admins only"
          description="You need an administrator account to open the control panel."
          actionLabel="Browse the catalog"
          actionTo="/catalog"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8 sm:px-6">
      <BackButton className="mb-4" />

      <header className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-gradient-to-br from-indigo-500/10 via-transparent to-slate-500/10 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-slate-800 text-white shadow-lg shadow-indigo-500/25">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-ink">Admin</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Live aggregates, catalogue CRUD and review moderation — every number is computed from the database.
          </p>
        </div>
      </header>

      <AdminTabs tab={tab} onChange={setTab} />

      <section role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} className="mt-6">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'products' && <ProductsTab />}
        {tab === 'moderation' && <ModerationTab />}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Tabs
--------------------------------------------------------------------------- */

function AdminTabs({ tab, onChange }: { tab: AdminTab; onChange: (t: AdminTab) => void }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.key === tab);
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    // `next` is always in bounds (derived from TABS.length via modulo), but
    // noUncheckedIndexedAccess can't see that — narrow it before use.
    const target = TABS[next];
    if (!target) return;
    onChange(target.key);
    document.getElementById(`admin-tab-${target.key}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Admin sections"
      onKeyDown={onKeyDown}
      className="card inline-flex max-w-full overflow-x-auto p-1"
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            id={`admin-tab-${key}`}
            role="tab"
            aria-selected={active}
            aria-controls={`admin-panel-${key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(key)}
            className={cn(
              'focus-ring flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-indigo-600 text-white'
                : 'text-ink-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Dashboard
--------------------------------------------------------------------------- */

function DashboardTab() {
  const stats = useQuery({ queryKey: ADMIN_STATS_KEY, queryFn: fetchAdminStats });

  if (stats.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (stats.isError || !stats.data) {
    return <ErrorState title="Couldn't load dashboard stats" onRetry={() => void stats.refetch()} />;
  }

  const s = stats.data;
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Users" value={s.totals.users} />
        <Kpi label="Products" value={s.totals.products} />
        <Kpi label="Reviews" value={s.totals.reviews} />
        <Kpi label="Wishlist saves" value={s.totals.wishlistItems} />
        <Kpi
          label="Suspended reviews"
          value={s.totals.suspendedReviews}
          danger={s.totals.suspendedReviews > 0}
        />
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ReviewsOverTimeChart data={s.reviewsOverTime} />
        <CategoryPie data={s.categoryDistribution} />
      </div>

      <TopRatedPanel products={s.topRated} />
    </div>
  );
}

function Kpi({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="card p-4">
      <dd
        className={cn(
          'text-2xl font-bold tabular-nums',
          danger ? 'text-red-600 dark:text-red-400' : 'text-ink',
        )}
      >
        {value.toLocaleString()}
      </dd>
      <dt className="mt-0.5 text-xs text-ink-muted">{label}</dt>
    </div>
  );
}

function axisDate(value: string | number | undefined): string {
  if (value == null) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Shared recharts tooltip shell (kept out of `any` by a narrow prop type). */
function ChartTooltip({
  active,
  payload,
  label,
  labelHidden = false,
  formatName,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string | number; value?: number | string; color?: string }>;
  label?: string | number;
  labelHidden?: boolean;
  formatName?: (name: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card space-y-1 p-2.5 text-xs shadow-card-lg">
      {!labelHidden && label !== undefined && label !== '' && (
        <p className="font-semibold text-ink">{axisDate(label as string)}</p>
      )}
      {payload.map((entry) => {
        const name = entry.name == null ? '' : (formatName?.(String(entry.name)) ?? String(entry.name));
        const shown =
          typeof entry.value === 'number' && !Number.isInteger(entry.value)
            ? Number(entry.value).toFixed(1)
            : String(entry.value ?? '');
        return (
          <p key={name} className="flex items-center gap-2 text-ink-muted">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
            <span>{name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">{shown}</span>
          </p>
        );
      })}
    </div>
  );
}

function ReviewsOverTimeChart({ data }: { data: AdminStats['reviewsOverTime'] }) {
  return (
    <section className="card min-w-0 p-5 lg:col-span-2" aria-label="Reviews over time">
      <h2 className="font-semibold text-ink">Reviews over time</h2>
      <p className="text-xs text-ink-muted">Created each day, with that day&rsquo;s average rating.</p>
      <div className="mt-4 h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="reviewArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.4} />
            <XAxis
              dataKey="date"
              tickFormatter={axisDate}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="rating"
              orientation="right"
              domain={[1, MAX_RATING]}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
            <Area
              yAxisId="count"
              type="monotone"
              dataKey="count"
              name="Reviews"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#reviewArea)"
            />
            <Line
              yAxisId="rating"
              type="monotone"
              dataKey="averageRating"
              name="Average rating"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CategoryPie({ data }: { data: AdminStats['categoryDistribution'] }) {
  return (
    <section className="card min-w-0 p-5" aria-label="Products by category">
      <h2 className="font-semibold text-ink">Products by category</h2>
      <p className="text-xs text-ink-muted">Catalogue share per category.</p>
      <div className="mt-4 h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="category"
              innerRadius={52}
              outerRadius={84}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
              ))}
            </Pie>
            <Tooltip
              content={<ChartTooltip labelHidden formatName={(n) => CATEGORY_LABELS[n as Category]} />}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        {data.map((entry) => (
          <li key={entry.category} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: CATEGORY_COLORS[entry.category] }}
              aria-hidden="true"
            />
            <span className="truncate">{CATEGORY_LABELS[entry.category]}</span>
            <span className="ml-auto tabular-nums text-ink">{entry.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopRatedPanel({ products }: { products: AdminStats['topRated'] }) {
  return (
    <section className="card p-5" aria-label="Top rated products">
      <h2 className="font-semibold text-ink">Top rated products</h2>
      <p className="text-xs text-ink-muted">Overall average across the whole catalogue.</p>
      <div className="mt-4 space-y-2">
        {products.length === 0 ? (
          <p className="text-sm text-ink-muted">No reviews yet — unreviewed products are excluded.</p>
        ) : (
          products.map((p, i) => (
            <div key={p.slug} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <span className="w-5 text-sm font-semibold tabular-nums text-ink-faint">{i + 1}</span>
              <Link
                to={`/p/${p.slug}`}
                className="focus-ring min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-indigo-600 dark:hover:text-indigo-300"
              >
                {p.name}
              </Link>
              <span className="hidden text-xs tabular-nums text-ink-faint sm:block">
                {p.reviewCount} {p.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
              <span className="w-12 text-right text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-300">
                {formatRating(p.averageRating)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Products (CRUD)
--------------------------------------------------------------------------- */

function ProductsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDetail | null>(null);
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);

  const products = useQuery({
    queryKey: ['admin-products', page],
    queryFn: () => fetchAdminProducts(page, ADMIN_PRODUCTS_PAGE_SIZE),
  });

  const invalidateProductData = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ADMIN_STATS_KEY });
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (row: AdminProduct) => deleteAdminProduct(row.id),
    onSuccess: (_data, row) => {
      toast.success('Product deleted', `“${row.name}” and its reviews are gone.`);
      setDeleting(null);
      invalidateProductData();
    },
    onError: () => toast.error('Could not delete product', 'Please try again.'),
  });

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = async (row: AdminProduct) => {
    try {
      const { product } = await fetchProductDetail(row.slug);
      setEditing(product);
      setEditorOpen(true);
    } catch (err) {
      toast.error('Could not load product', isApiClientError(err) ? err.message : 'Please try again.');
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
  };

  const afterSave = () => {
    closeEditor();
    invalidateProductData();
  };

  if (products.isLoading) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton text className="max-w-28" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <SkeletonList rows={6} />
      </div>
    );
  }

  if (products.isError || !products.data) {
    return <ErrorState title="Couldn't load products" onRetry={() => void products.refetch()} />;
  }

  const { items, totalPages } = products.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {products.data.total} {products.data.total === 1 ? 'product' : 'products'}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add product
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" aria-hidden="true" />}
          title="No products yet"
          description="Add the first gadget to the catalogue."
          actionLabel="Add a product"
          onAction={openCreate}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Reviews</th>
                  <th className="px-4 py-3 font-medium">Featured</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProgressiveImage src={row.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        <Link
                          to={`/p/${row.slug}`}
                          className="focus-ring max-w-56 truncate font-medium text-ink hover:text-indigo-600 dark:hover:text-indigo-300"
                        >
                          {row.name}
                        </Link>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                      {CATEGORY_LABELS[row.category as Category]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">{formatMoney(row.priceMinor, row.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-muted">{row.visibleReviews}</td>
                    <td className="px-4 py-3">
                      {row.featured ? <Badge tone="brand">Featured</Badge> : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" onClick={() => void openEdit(row)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Edit {row.name}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Delete {row.name}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <p className="text-xs text-ink-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
                </Button>
                <span className="px-2 text-sm tabular-nums text-ink-muted">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title={editing ? `Edit ${editing.name}` : 'Add a product'}
        className="max-w-2xl"
      >
        <ProductForm key={editing?.id ?? 'new'} initial={editing} onCancel={closeEditor} onSaved={afterSave} />
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete product?">
        <p className="text-sm text-ink-muted">
          &ldquo;{deleting?.name}&rdquo; and all of its reviews and wishlist saves will be permanently removed. This
          can&rsquo;t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Full product create/edit form — the same shape the API validates. */
function ProductForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ProductDetail | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const nameId = useId();
  const slugId = useId();
  const brandId = useId();
  const categoryId = useId();
  const priceId = useId();
  const taglineId = useId();
  const imageId = useId();
  const galleryId = useId();
  const releaseId = useId();
  const descriptionId = useId();

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? CATEGORIES[0]);
  const [price, setPrice] = useState(initial ? (initial.priceMinor / 100).toFixed(2) : '');
  const [tagline, setTagline] = useState(initial?.tagline ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [galleryText, setGalleryText] = useState((initial?.galleryUrls ?? []).join('\n'));
  const [releaseDate, setReleaseDate] = useState(initial ? toDateInput(initial.releaseDate) : '');
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [specRows, setSpecRows] = useState(() => specRowsFrom(initial));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const payload: ProductUpsertInput = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        brand: brand.trim(),
        category,
        priceMinor: Math.round(Number.parseFloat(price) * 100),
        currency: 'USD',
        tagline: tagline.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        galleryUrls: galleryText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 6),
        featured,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        specs: buildSpecs(specRows),
      };
      if (initial) await updateAdminProduct(initial.id, payload);
      else await createAdminProduct(payload);
      toast.success(initial ? 'Product updated' : 'Product created', initial ? 'Your changes are live.' : 'It is now in the catalogue.');
      onSaved();
    } catch (err) {
      if (isApiClientError(err) && err.fields) setErrors(err.fields);
      else toast.error('Could not save product', isApiClientError(err) ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (index: number, field: 'key' | 'value', value: string) =>
    setSpecRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeRow = (index: number) => setSpecRows((rows) => rows.filter((_, i) => i !== index));
  const addRow = () => setSpecRows((rows) => (rows.length < 16 ? [...rows, { key: '', value: '' }] : rows));

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={nameId} label="Name" error={errors.name}>
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={!!errors.name} />
        </Field>
        <Field id={slugId} label="Slug" hint="Kebab-case URL part, e.g. nova-x1" error={errors.slug}>
          <Input id={slugId} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={120} aria-invalid={!!errors.slug} />
        </Field>
        <Field id={brandId} label="Brand" error={errors.brand}>
          <Input id={brandId} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={60} aria-invalid={!!errors.brand} />
        </Field>
        <Field id={priceId} label="Price (USD)" error={errors.priceMinor}>
          <Input
            id={priceId}
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={!!errors.priceMinor}
          />
        </Field>
        <Field id={categoryId} label="Category" error={errors.category}>
          <Select id={categoryId} value={category} onChange={(e) => setCategory(e.target.value as Category)} aria-invalid={!!errors.category}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={releaseId} label="Release date" hint="Optional" error={errors.releaseDate}>
          <Input id={releaseId} type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} aria-invalid={!!errors.releaseDate} />
        </Field>
      </div>

      <Field id={taglineId} label="Tagline" hint="Short one-liner for cards (optional)" error={errors.tagline}>
        <Input id={taglineId} value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={160} aria-invalid={!!errors.tagline} />
      </Field>

      <Field id={descriptionId} label="Description" hint="At least 20 characters" error={errors.description}>
        <Textarea id={descriptionId} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} aria-invalid={!!errors.description} />
      </Field>

      <Field id={imageId} label="Cover image URL" error={errors.imageUrl}>
        <Input id={imageId} type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" aria-invalid={!!errors.imageUrl} />
      </Field>

      <Field id={galleryId} label="Gallery URLs" hint="One per line, up to 6" error={errors.galleryUrls}>
        <Textarea
          id={galleryId}
          value={galleryText}
          onChange={(e) => setGalleryText(e.target.value)}
          rows={3}
          placeholder={'https://…\nhttps://…'}
          aria-invalid={!!errors.galleryUrls}
        />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Specifications</p>
        {errors.specs && (
          <p role="alert" className="mb-1.5 text-xs text-red-600 dark:text-red-400">
            {errors.specs}
          </p>
        )}
        <div className="space-y-2">
          {specRows.map((row, index) => (
            <div key={index} className="flex items-start gap-2">
              <Input
                value={row.key}
                onChange={(e) => updateRow(index, 'key', e.target.value)}
                maxLength={40}
                placeholder="e.g. Battery"
                className="flex-1"
                aria-label={`Specification key ${index + 1}`}
              />
              <Input
                value={row.value}
                onChange={(e) => updateRow(index, 'value', e.target.value)}
                maxLength={120}
                placeholder="e.g. 5,000 mAh"
                className="flex-1"
                aria-label={`Specification value ${index + 1}`}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)} aria-label={`Remove specification ${index + 1}`}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={specRows.length >= 16}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add spec
          </Button>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
        <span className="text-sm font-medium text-ink">Featured</span>
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
          className="h-4 w-4 rounded accent-indigo-600"
        />
      </label>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {initial ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}

function toDateInput(value: Date | null | undefined): string {
  if (!value) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function specRowsFrom(product: ProductDetail | null): Array<{ key: string; value: string }> {
  if (!product) return [];
  return Object.entries(product.specs).map(([key, value]) => ({ key, value }));
}

function buildSpecs(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (key && value) specs[key] = value;
  }
  return specs;
}

/* ---------------------------------------------------------------------------
   Moderation queue
--------------------------------------------------------------------------- */

type ModFilter = 'ALL' | 'VISIBLE' | 'SUSPENDED';

const MOD_FILTERS: ReadonlyArray<{ key: ModFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'VISIBLE', label: 'Visible' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

function ModerationTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ModFilter>('ALL');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<ModerationItem | null>(null);

  const queue = useQuery({
    queryKey: ['admin-moderation', filter, page],
    queryFn: () => fetchModerationQueue({ page, pageSize: MOD_PAGE_SIZE, status: filter === 'ALL' ? undefined : filter }),
  });

  const invalidateModeration = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-moderation'] });
    queryClient.invalidateQueries({ queryKey: ADMIN_STATS_KEY });
    queryClient.invalidateQueries({ queryKey: ['product'] });
    queryClient.invalidateQueries({ queryKey: ['reviews'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VISIBLE' | 'SUSPENDED' }) => setReviewStatus(id, status),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'SUSPENDED' ? 'Review suspended' : 'Review restored',
        vars.status === 'SUSPENDED' ? 'It is hidden from the product page.' : 'It is public again.',
      );
      invalidateModeration();
    },
    onError: () => toast.error('Could not update review status', 'Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: ModerationItem) => deleteReviewAsAdmin(item.id),
    onSuccess: () => {
      toast.success('Review deleted', 'It has been removed for good.');
      setDeleting(null);
      invalidateModeration();
    },
    onError: () => toast.error('Could not delete review', 'Please try again.'),
  });

  const changeFilter = (next: ModFilter) => {
    setFilter(next);
    setPage(1);
  };

  if (queue.isLoading) return <SkeletonList rows={5} />;

  if (queue.isError || !queue.data) {
    return <ErrorState title="Couldn't load the moderation queue" onRetry={() => void queue.refetch()} />;
  }

  const { items, total, totalPages } = queue.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {total} {total === 1 ? 'review' : 'reviews'}
        </p>
        <div role="group" aria-label="Filter reviews by visibility" className="inline-flex rounded-lg border border-line bg-surface-raised p-0.5">
          {MOD_FILTERS.map((filterOption) => (
            <button
              key={filterOption.key}
              type="button"
              aria-pressed={filter === filterOption.key}
              onClick={() => changeFilter(filterOption.key)}
              className={cn(
                'focus-ring rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filter === filterOption.key ? 'bg-indigo-600 text-white' : 'text-ink-muted hover:text-ink',
              )}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" aria-hidden="true" />}
          title="Nothing here"
          description={
            filter === 'ALL'
              ? 'No reviews have been written yet.'
              : filter === 'SUSPENDED'
                ? 'No suspended reviews right now.'
                : 'No visible reviews right now.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const suspended = item.status === 'SUSPENDED';
            const busy = statusMutation.isPending && statusMutation.variables?.id === item.id;
            return (
              <li key={item.id} className={cn('card p-4 transition-opacity', suspended && 'opacity-80')}>
                <div className="flex items-start gap-3">
                  <Avatar src={item.author.avatarUrl} alt={item.author.username} size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink">{item.author.username}</p>
                      <Badge className="tabular-nums">
                        {item.rating} / {MAX_RATING}
                      </Badge>
                      {suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Visible</Badge>}
                      <span className="text-xs text-ink-faint">{timeAgo(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{item.body}</p>
                    <Link
                      to={`/p/${item.product.slug}`}
                      className="focus-ring mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                    >
                      on {item.product.name}
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {suspended ? (
                      <Button variant="outline" size="sm" loading={busy} onClick={() => statusMutation.mutate({ id: item.id, status: 'VISIBLE' })}>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Restore
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" loading={busy} onClick={() => statusMutation.mutate({ id: item.id, status: 'SUSPENDED' })}>
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                        Suspend
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Delete review</span>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
          </Button>
          <span className="px-3 text-sm tabular-nums text-ink-muted">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete review?">
        <p className="text-sm text-ink-muted">
          This permanently removes &ldquo;{deleting?.title}&rdquo; by @{deleting?.author.username}. It can&rsquo;t be
          undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}