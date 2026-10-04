import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToastStore, type ToastKind } from '../stores/toast';
import { cn } from '../lib/cn';

const KIND_STYLES: Record<ToastKind, { icon: typeof CheckCircle2; box: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    box: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950',
    iconColor: 'text-emerald-500',
  },
  error: {
    icon: XCircle,
    box: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
    iconColor: 'text-red-500',
  },
  info: {
    icon: Info,
    box: 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950',
    iconColor: 'text-sky-500',
  },
};

/** Renders the global toast stack, top-right, stacked above everything. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      {toasts.map((t) => {
        const style = KIND_STYLES[t.kind];
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            className={cn(
              'animate-rise-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-card-lg',
              style.box,
            )}
            role="status"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.iconColor)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.message && <p className="mt-0.5 text-sm text-ink-muted">{t.message}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="focus-ring rounded-md p-0.5 text-ink-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}