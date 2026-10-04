import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';

/** Catch-all 404 — friendly, with recoverable actions. */
export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md animate-fade-in flex-col items-center justify-center px-4 text-center sm:px-6">
      <p className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-300">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </p>
      <h1 className="mt-6 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-6xl font-black tracking-tight text-transparent">404</h1>
      <p className="mt-3 text-ink-muted">
        This page wandered off. The gadget you&rsquo;re looking for may have been removed,
        or the link is simply wrong.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/">Back home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/catalog">Browse the catalog</Link>
        </Button>
      </div>
    </div>
  );
}