import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const media = (): MediaQueryList | null =>
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const isDarkNow = (): boolean => media()?.matches ?? false;

/** Single place that flips <html class="dark">. */
function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && isDarkNow());
  document.documentElement.classList.toggle('dark', dark);
}

/** Subscribe to OS scheme changes when the user chose "system". */
let unlistenSystem: (() => void) | null = null;
function watchSystem(theme: Theme): void {
  unlistenSystem?.();
  unlistenSystem = null;
  if (theme !== 'system') return;
  const mql = media();
  if (!mql) return;
  const onChange = (): void => applyTheme('system');
  mql.addEventListener('change', onChange);
  unlistenSystem = () => mql.removeEventListener('change', onChange);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
        watchSystem(theme);
      },
    }),
    {
      name: 'novatech-theme',
      onRehydrateStorage: () => (state) => {
        // Runs synchronously during persist rehydration (localStorage), before
        // first paint — no wrong-theme flash.
        const theme = state?.theme ?? 'system';
        applyTheme(theme);
        watchSystem(theme);
      },
    },
  ),
);

/** Live selector: true when the UI should render in dark mode. */
export function useIsDark(): boolean {
  const theme = useThemeStore((s) => s.theme);
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return isDarkNow();
}