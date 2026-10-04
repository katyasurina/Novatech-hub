import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

interface BackButtonProps {
  /** Navigate to a route instead of history back. */
  to?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Compact "← Back" affordance. Every page that can be reached from another
 * page must have a way back (Rule 11) — history back by default, or a route
 * link when the origin isn't part of an in-app flow.
 */
export function BackButton({ to, className, children = 'Back' }: BackButtonProps) {
  const navigate = useNavigate();
  const cls = cn(
    'focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
    className,
  );
  const label = (
    <>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {label}
    </Link>
  ) : (
    <button type="button" onClick={() => navigate(-1)} className={cls}>
      {label}
    </button>
  );
}