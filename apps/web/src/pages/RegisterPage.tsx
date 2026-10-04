import { useId, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { register as registerRequest } from '../api/auth';
import { isApiClientError } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';
import { NAME_MAX, PASSWORD_MIN, USERNAME_MIN } from '@novatech/shared';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';

/**
 * Register — creates the account, logs the user in immediately (the API
 * returns a full session) and redirects to `state.from` if set.
 */
export function RegisterPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();

  const emailId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const nameId = useId();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={location.state?.from ?? '/'} replace />;
  }

  const from = location.state?.from ?? '/';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const tokens = await registerRequest({
        email: email.trim(),
        username: username.trim(),
        password,
        name: name.trim() || undefined,
      });
      setSession(tokens.user, tokens.accessToken);
      toast.success('Account created', 'Your session was started automatically.');
      navigate(from, { replace: true });
    } catch (err) {
      if (isApiClientError(err) && err.fields) {
        setErrors(err.fields);
      } else {
        setErrors({
          email: ' ',
          password: isApiClientError(err) ? err.message : 'Could not create your account. Please try again.',
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
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-ink">Create your account</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Join the community, write honest reviews, and help the averages stay real.
        </p>
      </div>

      <form onSubmit={submit} className="card w-full space-y-5 p-6 sm:p-8" noValidate>
        <Field id={emailId} label="Email" hint="Used only to sign you in — never shown publicly." error={errors.email}>
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

        <Field id={usernameId} label="Username" hint={`Public handle — ${USERNAME_MIN}+ letters, numbers or underscores.`} error={errors.username}>
          <Input
            id={usernameId}
            autoComplete="username"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="nova_enthusiast"
            required
          />
        </Field>

        <Field id={passwordId} label="Password" hint={`At least ${PASSWORD_MIN} characters.`} error={errors.password}>
          <Input
            id={passwordId}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="A strong, unique password"
            required
          />
        </Field>

        <Field id={nameId} label="Display name" hint={`Optional — ${NAME_MAX} characters max.`} error={errors.name}>
          <Input
            id={nameId}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How your reviews will be signed"
          />
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>

        <p className="border-t border-line pt-5 text-center text-sm text-ink-muted">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}