import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  /** Optional icon element shown in the tinted square (defaults to an inbox). */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional call-to-action rendered under the copy. */
  actionLabel?: string;
  onAction?: () => void;
  /** Alternative CTA rendered as a router <Link>. */
  actionTo?: string;
}

/** Friendly "nothing here yet" panel used across empty pages and filters. */
export function EmptyState({ icon = <Inbox className="h-7 w-7" aria-hidden="true" />, title, description, actionLabel, onAction, actionTo }: EmptyStateProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-300">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {actionLabel && (actionTo || onAction) && (
        actionTo ? (
          <Button asChild className="mt-5">
            <Link to={actionTo}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}