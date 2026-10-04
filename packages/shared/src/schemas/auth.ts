import { z } from 'zod';
import {
  PASSWORD_MIN,
  PASSWORD_MAX,
  USERNAME_RE,
  USERNAME_MIN,
  NAME_MAX,
  BIO_MAX,
} from '../constants';

/** Internal user shape as stored. Never serialised directly to clients. */
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.date(),
});

export type UserRecord = z.infer<typeof userSchema>;

/**
 * Public user DTO returned to clients. `email` is included for the user's own
 * profile only (the profile endpoint decides via a serializer function).
 */
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.date(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
    .regex(USERNAME_RE, 'Usernames may only contain letters, numbers and underscores'),
  password: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`),
  name: z.string().trim().min(1).max(NAME_MAX).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const profileUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`)
    .optional(),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, `Bio must be at most ${BIO_MAX} characters`)
    .optional()
    .nullable(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** User summary used on review cards (the author of a review). */
export const reviewAuthorSchema = publicUserSchema.pick({
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
});
export type ReviewAuthor = z.infer<typeof reviewAuthorSchema>;