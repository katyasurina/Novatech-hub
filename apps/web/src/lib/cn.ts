/** Tiny class-name joiner: drops falsy entries, joins the rest. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}