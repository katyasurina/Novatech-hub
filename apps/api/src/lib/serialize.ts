import type { Prisma } from '@prisma/client';
import type { PublicUser } from '@novatech/shared';

type UserRow = Prisma.UserGetPayload<Record<string, unknown>>;
/** The smallest shape the serializer actually needs (works with partial selects). */
type PublicUserShape = Pick<
  UserRow,
  'id' | 'email' | 'username' | 'name' | 'bio' | 'avatarUrl' | 'role' | 'createdAt'
>;

/** User -> public client DTO. Email is the user's own data (self endpoints only). */
export function toPublicUser(u: PublicUserShape): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    role: u.role,
    createdAt: u.createdAt,
  };
}