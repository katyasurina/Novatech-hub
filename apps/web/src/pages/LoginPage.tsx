import { useId, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shell } from 'lucide-react';
import { login as loginRequest } from '../api/auth';
import { isApiClientError } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';

/**
 * Login — email + password. On success the session (user + access token) is
 * stored in memory; the refresh token is already an httpOnly cookie set by
 * the API. Redirects to the page the user came from (preserved via location.state.from).
 */
export function LoginPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();

  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Already signed in — send away immediately.
  if (user) {
    return <Navigate to={location.state?.from ?? '/'} replace />;
  }

  const from = location.state?.from ?? '/';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const tokens = await loginRequest({ email: email.trim(), password });
      setSession(tokens.user, tokens.accessToken);
      toast.success('Signed in', `Welcome back, ${tokens.user.name ?? tokens.user.username}.`);
      navigate(from, { replace: true });
    } catch (err) {
      if (isApiClientError(err) && err.fields) {
        setErrors(err.fields);
      } else {
        setErrors({
          email: ' ',
          password: isApiClientError(err) ? err.message : 'Invalid email or password. Please try again.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md animate-fade-in flex-col items-center px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="focus-ring mb-8 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to home
      </Link>

      <div className="mb-8 flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25">
          <Shell className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-ink">Welcome back</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in to write reviews, save wishlists, and keep the averages honest.
        </p>
      </div>

      <form onSubmit={submit} className="card w-full space-y-5 p-6 sm:p-8">
        <Field id={emailId} label="Email" error={errors.email}>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field id={passwordId} label="Password" error={errors.password}>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>

        <p className="border-t border-line pt-5 text-center text-sm text-ink-muted">
          Don&rsquo;t have an account yet?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}