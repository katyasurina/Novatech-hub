import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { useSession } from './hooks/useSession';
import { useAuthStore } from './stores/auth';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/Toaster';
import Spinner from './components/ui/Spinner';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { TrendingPage } from './pages/TrendingPage';
import { ProductPage } from './pages/ProductPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WishlistPage } from './pages/WishlistPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Session bootstrap + shell. We render the routed content only after the
 * one-time /auth/refresh attempt (useSession) has finished, so an already
 * signed-in user on a hard reload is never briefly mistaken for an anonymous
 * one and bounced to /login by a route guard.
 */
function AppShell() {
  useSession();
  const ready = useAuthStore((s) => s.ready);

  return (
    <>
      <ScrollToTop />
      <Header />
      <main className="min-h-[calc(100vh-4rem)]">
        {ready ? (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/trending" element={<TrendingPage />} />
            <Route path="/p/:slug" element={<ProductPage />} />
            <Route path="/u/:username" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/wishlist"
              element={
                <ProtectedRoute>
                  <WishlistPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute admin>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Restoring session">
            <Spinner className="h-8 w-8" />
          </div>
        )}
      </main>
      <Footer />
      <Toaster />
    </>
  );
}

/** Provider tree for the whole app — query cache, router, and the error boundary. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}