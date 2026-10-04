import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  /** Shows a small inline spinner and disables the button while true. */
  loading?: boolean;
  /** Render a single child element (e.g. a router <Link>) with the button's styles. */
  asChild?: boolean;
  children?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  outline:
    'border border-line bg-transparent text-ink hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

function buttonClasses(variant: Variant, size: Size, className?: string): string {
  return cn(
    'focus-ring inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors',
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

/**
 * Button — the only <button> style you need. `loading` swaps in a spinner and
 * blocks clicks; `asChild` forwards the styles onto a single child element
 * (typically a router <Link>) so links look identical to buttons.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, asChild = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  if (asChild && isValidElement(children)) {
    return cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: cn(buttonClasses(variant, size, className), loading && 'pointer-events-none cursor-wait'),
      ...(rest as Record<string, unknown>),
      ...(disabled || loading ? { 'aria-disabled': true } : {}),
    });
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(buttonClasses(variant, size, className), loading && 'cursor-wait')}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      <span>{children}</span>
    </button>
  );
});