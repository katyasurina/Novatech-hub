import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { LoginInput, RegisterInput } from '@novatech/shared';
import { prisma } from '../../db/prisma';
import { AppError } from '../../lib/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { setRefreshCookie } from '../../lib/cookies';
import { toPublicUser } from '../../lib/serialize';

const BCRYPT_ROUNDS = 10;

type UserRow = Prisma.UserGetPayload<Record<string, unknown>>;

export interface AuthResult {
  accessToken: string;
  user: ReturnType<typeof toPublicUser>;
}

/**
 * Register a new user. Shape is validated upstream by the shared Zod schema;
 * the DB is the final authority on uniqueness, surfaced as a 409 with
 * field-specific messages so the form can highlight the offending input.
 */
export async function register(input: RegisterInput, res: Response): Promise<AuthResult> {
  const email = input.email.toLowerCase();
  const username = input.username.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    const fields: Record<string, string> = {};
    if (existing.email === email) fields.email = 'An account with this email already exists.';
    if (existing.username === username) fields.username = 'This username is already taken.';
    throw new AppError({
      status: 409,
      code: 'CONFLICT',
      message: 'That email or username is already in use.',
      fields,
    });
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      name: input.name ?? null,
    },
  });

  return issueTokens(user, res);
}

/** Current user profile — the app hydrates its session from this after refresh. */
export async function me(id: string): Promise<ReturnType<typeof toPublicUser>> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      bio: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
    },
  });
  if (!user) throw AppError.notFound('User not found');
  return toPublicUser(user);
}

export async function login(input: LoginInput, res: Response): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) throw AppError.unauthorized('Incorrect email or password.');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw AppError.unauthorized('Incorrect email or password.');

  return issueTokens(user, res);
}

/**
 * Rotate the refresh token: verify the cookie, check its tokenVersion matches
 * the current one, then issue a fresh pair (version bumped). A reused/older
 * refresh token is treated as a compromise signal and kills the whole session.
 */
export async function refresh(res: Response, cookie: unknown): Promise<AuthResult> {
  if (typeof cookie !== 'string' || cookie.length === 0) {
    throw AppError.unauthorized('No active session.');
  }

  let claims;
  try {
    claims = verifyRefreshToken(cookie);
  } catch {
    throw AppError.unauthorized('Your session has expired. Please sign in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) throw AppError.unauthorized('Your session has expired. Please sign in again.');
  if (user.refreshTokenVersion !== claims.tokenVersion) {
    // Stale or stolen token → invalidate the entire session family.
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenVersion: { increment: 1 } },
    });
    throw AppError.unauthorized('Your session has expired. Please sign in again.');
  }

  return issueTokens(user, res);
}

/** Sign a fresh access + refresh pair, set the refresh cookie, bump rotation. */
export async function issueTokens(user: UserRow, res: Response): Promise<AuthResult> {
  const nextVersion = user.refreshTokenVersion + 1;
  const refreshToken = signRefreshToken(user.id, nextVersion);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenVersion: nextVersion },
  });
  setRefreshCookie(res, refreshToken);
  return {
    accessToken: signAccessToken({ id: user.id, username: user.username, role: user.role }),
    user: toPublicUser(user),
  };
}

/** Revoke every refresh token the user holds and clear the cookie. */
export async function logout(cookie: unknown): Promise<void> {
  if (typeof cookie === 'string' && cookie.length > 0) {
    try {
      const claims = verifyRefreshToken(cookie);
      await prisma.user.updateMany({
        where: { id: claims.sub },
        data: { refreshTokenVersion: { increment: 1 } },
      });
    } catch {
      // already invalid/expired — logout is still a clean exit
    }
  }
}