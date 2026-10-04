import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  description?: string;
  /** Retry re-runs the failed query/mutation. */
  onRetry?: () => void;
  compact?: boolean;
  /** Optional call-to-action rendered under the copy. */
  actionLabel?: string;
  onAction?: () => void;
  /** Alternative CTA rendered as a router <Link>. */
  actionTo?: string;
}

/** Standard error panel — prefers the API message when one is available. */
export function ErrorState({ title = 'Something went wrong', message, description, onRetry, compact, actionLabel, onAction, actionTo }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`animate-fade-in mx-auto flex flex-col items-center justify-center text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-16'
      }`}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-300">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-ink-muted">{message}</p>}
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      )}
      {actionLabel && (actionTo || onAction) && (
        actionTo ? (
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link to={actionTo}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}