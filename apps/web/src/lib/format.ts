/** Money is integer minor units on the wire; the UI always formats from cents. */
export function formatMoney(priceMinor: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(priceMinor / 100);
}

export function formatDate(value: Date | string | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export function formatDateTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

/** Human "3h ago" / "5d ago" style timestamps for review cards. */
export function timeAgo(value: Date | string, now: Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  const units: Array<[number, string]> = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'],
  ];
  let amount = seconds;
  let label = 'second';
  for (const [size, name] of units) {
    if (amount < size) { label = name; break; }
    amount = Math.floor(amount / size);
    label = name;
  }
  if (amount === 0) return 'just now';
  return `${amount} ${label}${amount === 1 ? '' : 's'} ago`;
}

/** 1–10 scale rating; render one decimal for the blend of a 1–10 average. */
export function formatRating(value: number | null): string {
  if (value === null) return '—';
  return value % 1 === 0 ? value.toFixed(1) : value.toFixed(1);
}