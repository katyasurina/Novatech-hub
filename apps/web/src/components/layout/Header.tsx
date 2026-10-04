import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bookmark, Moon, Search, Settings, Sun, User as UserIcon, LogOut, Shell } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore, useIsDark } from '../../stores/theme';
import { logout as logoutRequest } from '../../api/auth';
import { queryClient } from '../../lib/queryClient';
import { toast } from '../../stores/toast';
import { Avatar } from '../ui/Avatar';
import { cn } from '../../lib/cn';

const NAV = [
  { to: '/catalog', label: 'Catalog' },
  { to: '/trending', label: 'Trending' },
];

/** Header — search, theme, auth-aware menu. Sticky with a subtle blur. */
export function Header() {
  const user = useAuthStore((s) => s.user);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isDark = useIsDark();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/catalog?q=${encodeURIComponent(query.trim())}` : '/catalog');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="NovaTech Hub home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Shell className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight text-ink md:block">
            NovaTech<span className="text-indigo-600 dark:text-indigo-400">Hub</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'focus-ring rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-300'
                    : 'text-ink-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <form onSubmit={onSubmit} role="search" className="relative ml-auto min-w-0 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <label htmlFor="header-search" className="sr-only">
            Search products
          </label>
          <input
            id="header-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gadgets, brands…"
            className="h-9 w-full rounded-lg border border-line bg-surface-raised pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
          />
        </form>

        <div className="flex items-center gap-1.5">
          {user && (
            <Link
              to="/wishlist"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
              aria-label="My wishlist"
              title="Wishlist"
            >
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </button>

          {user ? <UserMenu /> : <SignInLink />}
        </div>
      </div>
    </header>
  );
}

function SignInLink() {
  return (
    <Link to="/login" className="focus-ring ml-1 hidden h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-500 sm:inline-flex">
      Sign in
    </Link>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const signOut = useCallback(async () => {
    setOpen(false);
    try {
      await logoutRequest();
    } catch {
      // Cookie may already be invalid — clear locally regardless.
    }
    clearSession();
    queryClient.clear();
    toast.info('Signed out', 'See you next time.');
    navigate('/');
  }, [clearSession, navigate]);

  if (!user) return null;

  const username = user.username;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring ml-1 flex h-9 w-9 items-center justify-center rounded-full"
        aria-label={`Account menu for ${username}`}
      >
        <Avatar src={user.avatarUrl} alt={user.name ?? username} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-pop-in card absolute right-0 top-11 z-50 w-56 overflow-hidden p-1"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink">{user.name ?? username}</p>
            <p className="truncate text-xs text-ink-muted">@{username}</p>
          </div>
          <MenuItem to={`/u/${username}`} icon={<UserIcon className="h-4 w-4" />} label="My profile" onClose={() => setOpen(false)} />
          <MenuItem to="/wishlist" icon={<Bookmark className="h-4 w-4" />} label="My wishlist" onClose={() => setOpen(false)} />
          {user.role === 'ADMIN' && (
            <MenuItem to="/admin" icon={<Settings className="h-4 w-4" />} label="Admin panel" onClose={() => setOpen(false)} />
          )}
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  to,
  icon,
  label,
  onClose,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClose: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClose}
      role="menuitem"
      className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {icon}
      {label}
    </Link>
  );
}