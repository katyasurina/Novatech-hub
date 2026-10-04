import { parseWithDates } from '../lib/dates';
import { apiFetch } from './client';
import {
  type AuthTokens,
  type LoginInput,
  type PublicUser,
  type RegisterInput,
  authTokensSchema,
  publicUserSchema,
} from '@novatech/shared';

/** POST /auth/register — creates the account and returns a session. */
export async function register(input: RegisterInput): Promise<AuthTokens> {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
    retryOnUnauthorized: false,
  });
  return parseWithDates(authTokensSchema, data);
}

/** POST /auth/login — email + password, refresh token set as an httpOnly cookie. */
export async function login(input: LoginInput): Promise<AuthTokens> {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
    retryOnUnauthorized: false,
  });
  return parseWithDates(authTokensSchema, data);
}

/** POST /auth/logout — bumps the version, invalidating all refresh tokens. */
export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST', retryOnUnauthorized: false });
}

/** GET /users/me — full own profile (email included). */
export async function fetchMe(): Promise<PublicUser> {
  const data = await apiFetch('/users/me');
  return parseWithDates(publicUserSchema, data);
}