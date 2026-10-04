/**
 * Normalize the fallback art set in apps/web/public/media/products/.
 *
 * Brings every background that isn't slate-900 (#0f172a) — the background of
 * the three "good" placeholders (voyager-anc-x, novaphone-x1, pulse-watch-s2)
 * — in line, while leaving each product's device illustration untouched.
 *
 * Run: node scripts/normalize-web-product-art.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, '../apps/web/public/media/products');
const NEUTRAL = '#0f172a';

// Full-canvas background rect, either attribute order.
const patterns = [
  { re: /<rect\s+fill="(#[\da-fA-F]{3,8})"\s+width="400"\s+height="300"\s*\/>/, label: 'fill-first' },
  { re: /<rect\s+width="400"\s+height="300"\s+fill="(#[\da-fA-F]{3,8})"\s*\/>/, label: 'size-first' },
];

let changed = 0;
let kept = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
  const svg = readFileSync(join(dir, file), 'utf8');
  let next = svg;
  let current = null;
  for (const { re, label } of patterns) {
    const m = next.match(re);
    if (m) {
      current = m[1].toLowerCase();
      next = next.replace(re, (all) => all.replace(m[1], NEUTRAL));
      if (!label) void 0;
      break;
    }
  }
  if (current === null) {
    console.log(`  ✗ ${file}: no full-canvas rect found`);
    continue;
  }
  if (current === NEUTRAL) {
    kept++;
    continue;
  }
  writeFileSync(join(dir, file), next, 'utf8');
  changed++;
  console.log(`  • ${file}: ${current} → ${NEUTRAL}`);
}
console.log(`Changed ${changed}; already neutral ${kept}.`);