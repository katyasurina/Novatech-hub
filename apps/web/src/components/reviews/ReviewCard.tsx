import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, Pencil, Trash2 } from 'lucide-react';
import type { ReviewDto } from '@novatech/shared';
import { voteReview } from '../../api/reviews';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/cn';
import { mediaUrl } from '../../lib/media';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

const REVIEWS_KEY = ['reviews'] as const;
const USER_REVIEWS_KEY = ['user-reviews'] as const;

interface ReviewCardProps {
  review: ReviewDto;
  productId: string;
  /** Show edit/delete affordances (own review or admin). */
  canModify?: boolean;
  onEdit?: (review: ReviewDto) => void;
  onDelete?: (review: ReviewDto) => void;
}

const voteTone = (v: number): string => {
  if (v >= 8) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (v >= 6) return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
  if (v >= 4) return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
};

/**
 * One review: author, quality chip, body, helpful-vote toggle, edit/delete.
 * Voting is optimistic (local state flips immediately, the server's answer on
 * success, original values restored on failure) and any list depending on the
 * counts is invalidated afterwards.
 */
export function ReviewCard({ review, productId, canModify, onEdit, onDelete }: ReviewCardProps) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [displayedVote, setDisplayedVote] = useState({ voteCount: review.voteCount, userVote: review.userVote });

  // Resync local display when a refetch changes the underlying review.
  useEffect(() => {
    setDisplayedVote({ voteCount: review.voteCount, userVote: review.userVote });
  }, [review.voteCount, review.userVote]);

  const vote = useMutation({
    mutationFn: (value: 1 | -1) => voteReview(review.id, value),
    // After the round-trip, invalidate lists that sort by helpfulness.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: REVIEWS_KEY });
      queryClient.invalidateQueries({ queryKey: USER_REVIEWS_KEY });
    },
  });

  const clickVote = (value: 1 | -1) => {
    if (!user) return;
    const was = displayedVote;
    // Server semantics: same value removes the vote, different value swaps it.
    const uvNext = was.userVote === value ? null : value;
    const delta =
      was.userVote === null ? value
      : was.userVote === value ? -value
      : value - was.userVote;
    setDisplayedVote({ voteCount: was.voteCount + delta, userVote: uvNext });
    vote.mutate(value, {
      onSuccess: (result) => setDisplayedVote({ voteCount: result.voteCount, userVote: result.userVote }),
      onError: () => {
        setDisplayedVote(was);
        toast.error('Could not update vote', 'Please try again.');
      },
    });
  };

  const author = review.author;

  return (
    <article className="card animate-fade-in p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/u/${author.username}`} className="focus-ring shrink-0 rounded-full" aria-label={`View ${author.username}'s profile`}>
            <Avatar src={mediaUrl(author.avatarUrl)} alt={author.name ?? author.username} size="md" />
          </Link>
          <div>
            <Link to={`/u/${author.username}`} className="focus-ring text-sm font-semibold text-ink hover:text-indigo-600 dark:hover:text-indigo-300">
              {author.name ?? author.username}
            </Link>
            <p className="text-xs text-ink-muted">@{author.username} · {timeAgo(review.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {review.status === 'SUSPENDED' && <Badge tone="danger">Suspended</Badge>}
          <span className={cn('rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums', voteTone(review.rating))}>
            {review.rating}<span className="text-xs font-medium opacity-70">/10</span>
          </span>
        </div>
      </div>

      <h4 className="mt-3 font-semibold text-ink">{review.title}</h4>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{review.body}</p>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            disabled={!user}
            onClick={() => clickVote(1)}
            aria-pressed={displayedVote.userVote === 1}
            aria-label="Mark as helpful"
            title="Mark as helpful"
            className={cn(
              'focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              displayedVote.userVote === 1
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-ink-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
            )}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">
              {displayedVote.voteCount > 0 ? displayedVote.voteCount : 'Helpful'}
            </span>
          </button>
          <button
            type="button"
            disabled={!user || (displayedVote.voteCount <= 0 && displayedVote.userVote !== -1)}
            onClick={() => clickVote(-1)}
            aria-pressed={displayedVote.userVote === -1}
            aria-label="Not helpful"
            title="Not helpful"
            className={cn(
              'focus-ring h-8 rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              displayedVote.userVote === -1
                ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                : 'text-ink-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
            )}
          >
            <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {canModify && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit?.(review)}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
              aria-label="Edit review"
              title="Edit"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(review)}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
              aria-label="Delete review"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}