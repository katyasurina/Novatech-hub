import { useRef, useState, useEffect } from 'react';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  /** When true the image loads eagerly (e.g. hero backgrounds). */
  eager?: boolean;
}

export function ProgressiveImage({
  src,
  alt,
  className,
  eager = false,
  ...rest
}: ProgressiveImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(eager);

  useEffect(() => {
    if (eager) return;
    const el = imgRef.current;
    if (!el || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src, eager]);

  return (
    <div className={`relative overflow-hidden ${className || ''}`}>
      {/* Placeholder background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800" />
      <img
        ref={imgRef}
        src={inView ? src : undefined}
        data-src={inView ? undefined : src}
        alt={alt || ''}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          const target = e.currentTarget;
          target.style.opacity = '0';
        }}
        className={`relative z-10 h-full w-full object-cover transition-opacity duration-700 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
        {...rest}
      />
    </div>
  );
}