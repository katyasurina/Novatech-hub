import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Top-level error boundary. A crash anywhere in the tree swaps in a calm
 * retry panel instead of a white screen; clicking retry resets the subtree.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The message is already rendered in the fallback UI; this hook exists to
    // keep the boundary contract explicit.
  }

  private reset = (): void => this.setState({ hasError: false, message: undefined });

  override render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-ink">Something broke on this page</h1>
          <p className="mt-1 max-w-md text-sm text-ink-muted">{this.state.message}</p>
          <Button className="mt-5" onClick={this.reset}>
            Try again
          </Button>
        </main>
      );
    }
    return this.props.children;
  }
}

/**
 * Rethrows render-time errors so React's error boundary sees them
 * (React ≥18 requires this boundary for async/event errors too).
 */
export function ThrowError({ error }: { error: unknown }) {
  throw error;
}