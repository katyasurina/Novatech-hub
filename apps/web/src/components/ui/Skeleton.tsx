import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Render a text-like bar (fixed height) vs. a block. */
  text?: boolean;
}

/** Skeleton loading block — shimmer handled by the shared `.skeleton` class. */
export function Skeleton({ className, text = false, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton', text ? 'h-4 w-full' : 'h-full w-full', className)}
      {...rest}
    />
  );
}

/** Batches of skeleton rows for list loading states. */
export function SkeletonList({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton text className="max-w-md" />
            <Skeleton text className="max-w-xs" />
          </div>
          <Skeleton className="hidden h-6 w-16 sm:block" />
        </div>
      ))}
      <span className="sr-only">Loading content</span>
    </div>
  );
}