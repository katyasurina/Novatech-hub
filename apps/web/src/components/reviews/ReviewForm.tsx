import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, X } from 'lucide-react';
import type { CreateReviewInput, ReviewDto } from '@novatech/shared';
import { MAX_RATING, MIN_RATING, REVIEW_BODY_CHARS_HINT, REVIEW_BODY_MAX, REVIEW_TITLE_MAX } from '@novatech/shared';
import { createReview, updateReview } from '../../api/reviews';
import { isApiClientError } from '../../api/client';
import { queryClient } from '../../lib/queryClient';
import { toast } from '../../stores/toast';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';

const REVIEWS_KEY = ['reviews'] as const;

interface ReviewFormProps {
  productId: string;
  productName: string;
  /** When set, the form edits this review instead of creating a new one. */
  initial?: ReviewDto;
  onDone: () => void;
  onCancel?: () => void;
}

/**
 * Write/edit a review. Rating is a 1–10 tap-scale with instant preview copy;
 * title and body match the shared Zod constraints exactly (mirrored hints).
 */
export function ReviewForm({ productId, productName, initial, onDone, onCancel }: ReviewFormProps) {
  const titleId = useId();
  const bodyId = useId();
  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = initial !== undefined;

  const mutation = useMutation({
    mutationFn: (input: CreateReviewInput) =>
      isEdit
        ? updateReview(productId, initial.id, input) // required → partial is a widening, OK
        : createReview(productId, input),
    onSuccess: (_review: ReviewDto) => {
      toast.success(isEdit ? 'Review updated' : 'Review posted', 'Thanks for contributing.');
      queryClient.invalidateQueries({ queryKey: REVIEWS_KEY });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      onDone();
    },
    onError: (error: unknown) => {
      if (isApiClientError(error) && error.fields) {
        setErrors(error.fields);
      } else {
        toast.error('Could not save review', isApiClientError(error) ? error.message : 'Please try again.');
      }
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (rating < MIN_RATING || rating > MAX_RATING) {
      setErrors({ rating: `Pick a rating between ${MIN_RATING} and ${MAX_RATING}.` });
      return;
    }
    mutation.mutate({ rating, title: title.trim(), body: body.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="mb-2 block text-sm font-medium text-ink">Your rating</span>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Rating 1 to 10">
          {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`Rate ${value} out of 10`}
              className={cn(
                'focus-ring h-9 w-9 rounded-lg text-sm font-bold tabular-nums transition-all',
                rating === value
                  ? 'scale-105 bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-ink-muted hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700',
              )}
            >
              {value}
            </button>
          ))}
          <span className="ml-2 inline-flex items-center gap-1 text-sm text-ink-muted">
            {rating === 0 ? 'Tap a number to rate' : <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />}
            {rating > 0 && `${rating} / 10`}
          </span>
        </div>
        {errors.rating && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.rating}</p>}
      </div>

      <Field id={titleId} label="Review title" error={errors.title}>
        <Input
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="One honest line about it"
          maxLength={REVIEW_TITLE_MAX}
          aria-invalid={!!errors.title}
          required
        />
      </Field>

      <Field
        id={bodyId}
        label="Your review"
        hint={`Minimum ${REVIEW_BODY_CHARS_HINT} characters — the more specific, the more helpful.`}
        error={errors.body}
      >
        <Textarea
          id={bodyId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`What did you like, dislike, and would you buy it again? (Reviewing ${productName})`}
          maxLength={REVIEW_BODY_MAX}
          aria-invalid={!!errors.body}
          required
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" loading={mutation.isPending} data-submitting>
          {isEdit ? 'Save changes' : 'Post review'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}