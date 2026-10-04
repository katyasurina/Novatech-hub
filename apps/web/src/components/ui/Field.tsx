import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

/* ---------------------------------------------------------------------------
   Styled inputs. Every field pairs visually in light and dark, shows a `❖`
   error state when invalid, and is a real <label> so it stays accessible.
--------------------------------------------------------------------------- */

const baseControl =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60';

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean;
}

export function Field({ id, label, hint, error, children, hideLabel = false }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={cn(
          'block text-sm font-medium text-ink',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, 'aria-invalid': ariaInvalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(baseControl, ariaInvalid && 'border-red-500 focus:border-red-500 focus-visible:ring-red-500/25', className)}
        aria-invalid={ariaInvalid}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, 'aria-invalid': ariaInvalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(baseControl, 'min-h-[96px] resize-y', ariaInvalid && 'border-red-500 focus:border-red-500 focus-visible:ring-red-500/25', className)}
        aria-invalid={ariaInvalid}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, 'aria-invalid': ariaInvalid, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(baseControl, 'cursor-pointer appearance-none pr-9', ariaInvalid && 'border-red-500', className)}
        aria-invalid={ariaInvalid}
        {...rest}
      >
        {children}
      </select>
    );
  },
);