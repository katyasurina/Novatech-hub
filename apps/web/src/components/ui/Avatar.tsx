import { cn } from '../../lib/cn';
import { DEFAULT_AVATAR } from '@novatech/shared';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
};

/** Rounded avatar with a graceful fallback when the URL is missing/offline. */
export function Avatar({ src, alt, size = 'md', className }: AvatarProps) {
  const url = src || DEFAULT_AVATAR;
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn(
        'shrink-0 rounded-full object-cover ring-1 ring-line',
        SIZE[size],
        className,
      )}
      onError={(e) => {
        // Broken uploads degrade to the bundled default instead of a broken image.
        if (e.currentTarget.src !== DEFAULT_AVATAR) e.currentTarget.src = DEFAULT_AVATAR;
      }}
    />
  );
}