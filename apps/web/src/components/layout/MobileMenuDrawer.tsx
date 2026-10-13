import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { logout as logoutRequest } from '../../api/auth';
import { queryClient } from '../../lib/queryClient';
import { toast } from '../../stores/toast';
import { cn } from '../../lib/cn';
import { Bookmark, LogOut, Settings, Shield, User as UserIcon } from 'lucide-react';
import { mediaUrl } from '../../lib/media';
import { Avatar } from '../ui/Avatar';
import type { PublicUser } from '@novatech/shared';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user?: PublicUser | null;
}

export function MobileMenuDrawer({ isOpen, onClose, user }: MobileMenuDrawerProps) {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && e.target !== document.querySelector('[data-mobile-drawer-backdrop]')) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Cookie may already be invalid — clear locally regardless.
    }
    clearSession();
    queryClient.clear();
    toast.info('Signed out', 'See you next time.');
    navigate('/');
    onClose();
  }, [clearSession, navigate, onClose]);

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/50 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={panelRef}
        data-mobile-drawer-backdrop
        className={cn(
          'h-full w-80 max-w-xs transform overflow-y-auto border-l bg-surface-raised p-4 shadow-xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Menu</h2>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {user ? (
          <>
            <div className="mb-6 flex items-center gap-3 pb-4 border-b border-line">
              <Avatar
                src={mediaUrl(user.avatarUrl)}
                alt={user.name ?? user.username}
                size="md"
                className="rounded-full"
              />
              <div>
                <p className="font-medium text-ink">{user.name ?? user.username}</p>
                <p className="text-xs text-ink-muted">@{user.username}</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              <DrawerItem
                to={`/u/${user.username}`}
                label="Profile"
                icon={<UserIcon className="h-4 w-4" />}
                onClick={() => handleNavigate(`/u/${user.username}`)}
              />
              <DrawerItem
                to="/wishlist"
                label="Wishlist"
                icon={<Bookmark className="h-4 w-4" />}
                onClick={() => handleNavigate('/wishlist')}
              />
              {user.role === 'ADMIN' && (
                <DrawerItem
                  to="/admin"
                  label="Admin panel"
                  icon={<Settings className="h-4 w-4" />}
                  onClick={() => handleNavigate('/admin')}
                />
              )}
              <button
                type="button"
                onClick={signOut}
                className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </nav>
          </>
        ) : (
          <>
            <nav className="space-y-1.5">
              <DrawerItem
                to="/login"
                label="Sign in"
                icon={<UserIcon className="h-4 w-4" />}
                onClick={() => handleNavigate('/login')}
                primary
              />
              <DrawerItem
                to="/register"
                label="Register"
                icon={<Shield className="h-4 w-4" />}
                onClick={() => handleNavigate('/register')}
              />
              <DrawerItem
                to="/catalog"
                label="Browse catalog"
                icon={<Bookmark className="h-4 w-4" />}
                onClick={() => handleNavigate('/catalog')}
              />
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

interface DrawerItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}

function DrawerItem({ to, label, icon, onClick, primary }: DrawerItemProps) {
  const base =
    'focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        base,
        primary
          ? 'bg-indigo-600 text-white hover:bg-indigo-500'
          : 'text-ink-muted hover:bg-slate-100 hover:text-ink dark:hover:bg-slate-800',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
