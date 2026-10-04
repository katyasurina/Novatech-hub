import { Router } from 'express';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@novatech/shared';
import { authLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/errors';
import { clearRefreshCookie, REFRESH_COOKIE } from '../../lib/cookies';
import * as authService from './auth.service';

export const authRouter: Router = Router();

/**
 * POST /api/v1/auth/register
 * Body: RegisterInput. 201 { accessToken, user } + HttpOnly refresh cookie.
 */
authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as RegisterInput;
    const result = await authService.register(body, res);
    res.status(201).json(result);
  }),
);

/**
 * POST /api/v1/auth/login
 * Body: LoginInput. 200 { accessToken, user } + refresh cookie.
 */
authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as LoginInput;
    const result = await authService.login(body, res);
    res.json(result);
  }),
);

/**
 * POST /api/v1/auth/refresh
 * Reads the HttpOnly refresh cookie, rotates it, returns a fresh access token.
 * The web client calls this on boot + on 401 to persist the session.
 */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(res, req.cookies?.[REFRESH_COOKIE]);
    res.json(result);
  }),
);

/**
 * POST /api/v1/auth/logout
 * Revokes all refresh tokens for the session user and clears the cookie.
 */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await authService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
);

/**
 * GET /api/v1/auth/me
 * Returns the signed-in user (or 401). Used to hydrate the UI after refresh.
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.auth!.id);
    res.json(user);
  }),
);