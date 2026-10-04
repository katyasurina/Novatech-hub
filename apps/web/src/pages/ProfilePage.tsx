import { useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react';
import type { UserReview } from '@novatech/shared';
import { REVIEW_SORTS, type ReviewSort } from '@novatech/shared';
import { fetchProfile, fetchUserReviews, updateProfile, uploadAvatar } from '../api/users';
import { deleteReview } from '../api/reviews';
import { isApiClientError } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { formatDate } from '../lib/format';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, Textarea } from '../components/ui/Field';
import { Select } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { BackButton } from '../components/ui/BackButton';
import { ReviewCard } from '../components/reviews/ReviewCard';
import { ProgressiveImage } from '../components/ui/ProgressiveImage';
import { CATEGORY_LABELS } from '@novatech/shared';

const REVIEWS_PAGE_SIZE = 8;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Public profile: header + stats + the user's review history. The signed-in
 * owner additionally gets an inline editor (display name, bio, avatar).
 */
export function ProfilePage() {
  const { username = '' } = useParams();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [reviewSort, setReviewSort] = useState<ReviewSort>('newest');
  const [reviewPage, setReviewPage] = useState(1);
  const [editing, setEditing] = useState(false);

  const profile = useQuery({
    queryKey: ['profile', username],
    queryFn: () => fetchProfile(username),
  });

  const reviews = useQuery({
    queryKey: ['user-reviews', username, reviewSort, reviewPage],
    queryFn: () =>
      fetchUserReviews(username, { page: reviewPage, pageSize: REVIEWS_PAGE_SIZE, sort: reviewSort }),
  });

  if (profile.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-12 w-56" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    const notFound = isApiClientError(profile.error) && profile.error.status === 404;
    return (
      <ErrorState
        title={notFound ? 'User not found' : "Couldn't load this profile"}
        description={notFound ? 'This username has no profile yet.' : 'Something went wrong. Please try again.'}
        actionLabel="Browse the catalog"
        actionTo="/catalog"
      />
    );
  }

  const user = profile.data;
  const isOwn = user.isOwnProfile;
  const totalReviewPages = reviews.data?.totalPages ?? 0;

  const changeSort = (sort: ReviewSort) => {
    setReviewSort(sort);
    setReviewPage(1);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['profile', username] });
    queryClient.invalidateQueries({ queryKey: ['user-reviews', username] });
  };

  const afterEdit = (update: { name: string; bio: string }) => {
    // Keep the app-wide session in sync so the header reflects new name/avatar.
    const token = useAuthStore.getState().accessToken;
    if (currentUser && token) useAuthStore.getState().setSession({ ...currentUser, ...update }, token);
    toast.success('Profile updated', 'Your changes are live.');
    setEditing(false);
    refresh();
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-4 py-8 sm:px-6">
      <BackButton className="mb-4" />

      {/* Header */}
      <header className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <Avatar src={user.avatarUrl} alt={user.name ?? user.username} size="lg" className="ring-2 ring-indigo-200 dark:ring-indigo-900" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-xl font-bold text-ink">{user.name ?? user.username}</h1>
              {user.role === 'ADMIN' && <Badge tone="brand">Admin</Badge>}
              {user.isOwnProfile && <Badge>That&rsquo;s you</Badge>}
            </div>
            <p className="text-sm text-ink-muted">@{user.username}</p>
            {user.bio ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{user.bio}</p>
            ) : (
              <p className="mt-2 text-sm italic text-ink-faint">No bio yet.</p>
            )}
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-faint sm:justify-start">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Joined {formatDate(user.createdAt)}
            </p>
          </div>

          {isOwn && (
            <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
              {editing ? <X className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
              {editing ? 'Cancel' : 'Edit profile'}
            </Button>
          )}
        </div>

        {/* Stats */}
        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
          <Stat label="Reviews written" value={String(user.stats.totalReviewsWritten)} />
          <Stat
            label="Average rating"
            value={user.stats.averageRatingGiven === null ? '—' : user.stats.averageRatingGiven.toFixed(1) + ' / 10'}
          />
          <Stat label="Saved products" value={String(user.stats.wishlistCount)} />
          <Stat label="Member rank" value={memberTier(user.stats.totalReviewsWritten)} />
        </dl>
      </header>

      {editing && isOwn && (
        <ProfileEditor
          initial={{ name: user.name ?? '', bio: user.bio ?? '' }}
          onSave={afterEdit}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Reviews */}
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Reviews</h2>
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

        {reviews.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : reviews.isError ? (
          <ErrorState title="Couldn't load this user's reviews" onRetry={() => void refresh()} />
        ) : reviews.data!.items.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description={isOwn ? 'Write your first review and it will show up here.' : 'This user has not reviewed anything yet.'}
          />
        ) : (
          <ul className="space-y-4">
            {reviews.data!.items.map((review) => (
              <li key={review.id}>
                <ProfileReviewRow
                  username={username}
                  review={review}
                  canModify={isOwn}
                  onChanged={refresh}
                />
              </li>
            ))}
          </ul>
        )}

        {totalReviewPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={reviewPage <= 1}
              onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setReviewPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-lg font-bold tabular-nums text-ink">{value}</dd>
      <dt className="text-xs text-ink-muted">{label}</dt>
    </div>
  );
}

function ProfileEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: { name: string; bio: string };
  onSave: (user: { name: string; bio: string }) => void;
  onCancel: () => void;
}) {
  const nameId = useId();
  const bioId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const updated = await updateProfile({ name: name.trim(), bio: bio.trim() || null });
      onSave({ name: updated.name ?? '', bio: updated.bio ?? '' });
    } catch (err) {
      if (isApiClientError(err) && err.fields) setErrors(err.fields);
      else toast.error('Could not save profile', isApiClientError(err) ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error('Image too large', 'Keep avatars under 2 MB.');
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadAvatar(file);
      onSave({ name: updated.name ?? '', bio: updated.bio ?? '' });
    } catch (err) {
      toast.error('Could not upload avatar', isApiClientError(err) ? err.message : 'Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="card mt-6 p-5">
      <h2 className="font-semibold text-ink">Edit your profile</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Field id={nameId} label="Display name" error={errors.name}>
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>

        <Field id={bioId} label="Bio" hint="Short version of what you review." error={errors.bio}>
          <Textarea id={bioId} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} />
        </Field>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            Upload avatar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload a new avatar image"
            onChange={(e) => void pickAvatar(e.target.files?.[0])}
          />
          <span className="text-xs text-ink-faint">JPG/PNG/WebP, under 2 MB.</span>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" loading={saving}>
            Save changes
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProfileReviewRow({
  username,
  review,
  canModify,
  onChanged,
}: {
  username: string;
  review: UserReview;
  canModify: boolean;
  onChanged: () => void;
}) {
  const { product, ...rest } = review;
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => deleteReview(rest.productId, rest.id),
    onSuccess: () => {
      toast.success('Review deleted', 'It has been removed from your profile.');
      setDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['user-reviews', username] });
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      onChanged();
    },
    onError: () => toast.error('Could not delete review', 'Please try again.'),
  });

  return (
    <div className="space-y-3">
      <Link
        to={`/p/${product.slug}`}
        className="focus-ring flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-3 transition-colors hover:border-indigo-400"
      >
          <ProgressiveImage src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{product.name}</p>
          <p className="text-xs text-ink-faint">{CATEGORY_LABELS[product.category]}</p>
        </div>
      </Link>
      <ReviewCard review={rest} productId={rest.productId} canModify={canModify} onDelete={() => setDeleting(true)} />

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete review?">
        <p className="text-sm text-ink-muted">
          &ldquo;{review.title}&rdquo; will be permanently removed. This can&rsquo;t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
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

/** Rough contributor tiers shown on profiles — purely cosmetic. */
function memberTier(reviewsWritten: number): string {
  if (reviewsWritten >= 50) return 'Veteran';
  if (reviewsWritten >= 20) return 'Contributor';
  if (reviewsWritten >= 5) return 'Regular';
  return 'New member';
}