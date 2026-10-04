import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { AppError } from './errors';

const here = dirname(fileURLToPath(import.meta.url));
/** apps/api/uploads — served publicly via /media. */
export const UPLOADS_DIR = resolve(here, '../../uploads');

const AVATAR_DIR = resolve(UPLOADS_DIR, 'avatars');
mkdirSync(AVATAR_DIR, { recursive: true });

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/avif',
]);

function extFor(mime: string): string {
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    case 'image/avif':
      return '.avif';
    default:
      return '.jpg';
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}${extFor(file.mimetype)}`),
});

export const avatarUpload = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      cb(AppError.badRequest('Avatar must be a PNG, JPEG, WebP, SVG or AVIF image.'));
      return;
    }
    cb(null, true);
  },
});