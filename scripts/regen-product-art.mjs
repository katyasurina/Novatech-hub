/**
 * One-off reconciliation for apps/api/uploads/products/*.svg.
 *
 * Product art used to be generated with a per-slug HSL hue (see git history of
 * seed.ts / admin.service.ts); this wrote the neutral template over every
 * existing file so the catalogue is uniform without re-running the seed.
 *
 * The templates below mirror `generateProductArt` / `generateGallery` in
 * apps/api/prisma/seed.ts (and `generatePlaceholderArt` in
 * apps/api/src/modules/admin/admin.service.ts) — keep them in sync.
 *
 * Run: node scripts/regen-product-art.mjs
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_ART_DIR = resolve(here, '../apps/api/uploads/products');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function initialsOf(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function productArt(name, brand) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${esc(name)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4338ca"/>
      <stop offset="1" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <circle cx="400" cy="248" r="150" fill="url(#g)" opacity="0.16"/>
  <circle cx="400" cy="248" r="96"  fill="url(#g)" opacity="0.24"/>
  <text x="400" y="272" text-anchor="middle" font-family="system-ui,sans-serif" font-size="64" font-weight="700" fill="#e2e8f0">${esc(initialsOf(name))}</text>
  <text x="400" y="470" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" letter-spacing="2" fill="#94a3b8">${esc(brand.toUpperCase())}</text>
</svg>`;
}

function galleryArt(name, brand) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${esc(name)}">
  <defs>
    <linearGradient id="g" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4338ca"/>
      <stop offset="1" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <rect x="240" y="120" width="320" height="320" rx="48" fill="url(#g)" opacity="0.13"/>
  <rect x="240" y="120" width="320" height="320" rx="48" fill="none" stroke="url(#g)" stroke-opacity="0.4"/>
  <text x="400" y="285" text-anchor="middle" font-family="system-ui,sans-serif" font-size="44" font-weight="700" fill="#e2e8f0">${esc(brand.toUpperCase())}</text>
</svg>`;
}

// Pull name/brand back out of each existing file, then rewrite it neutral.
// Main art carries the brand label at y="470", gallery variants at y="285".
const nameRe = /aria-label="([^"]*)"/;
const brandRe = /<text[^>]*y="470"[^>]*>([^<]+)<\/text>/;
const galleryBrandRe = /<text[^>]*y="285"[^>]*>([^<]+)<\/text>/;

let rewritten = 0;
let skipped = 0;
for (const file of readdirSync(PRODUCT_ART_DIR).filter((f) => f.endsWith('.svg')).sort()) {
  const existing = readFileSync(join(PRODUCT_ART_DIR, file), 'utf8');
  const nameMatch = existing.match(nameRe);
  if (!nameMatch) {
    console.log(`  ✗ ${file}: no aria-label, skipped`);
    skipped++;
    continue;
  }
  const name = nameMatch[1];
  const isGallery = /-(a|b)\.svg$/.test(file);
  const brandMatch = (isGallery ? galleryBrandRe : brandRe).exec(existing);
  const brand = brandMatch ? brandMatch[1] : name.slice(0, 12);
  const next = isGallery ? galleryArt(name, brand) : productArt(name, brand);
  writeFileSync(join(PRODUCT_ART_DIR, file), next, 'utf8');
  rewritten++;
}

mkdirSync(PRODUCT_ART_DIR, { recursive: true });
console.log(`Rewrote ${rewritten} product SVGs; skipped ${skipped}.`);