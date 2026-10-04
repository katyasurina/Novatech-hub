/**
 * Seed: 6 primary users (1 admin + 5 demo), 36 products across 6 categories
 * and ~200 reviews, plus votes and wishlist rows.
 *
 * The [productId, userId] unique constraint means a single product can't take
 * more reviews than there are users. To hit realistic review density (3-15 per
 * product) we seed 6 *named* users plus 12 filler reviewers - the named users
 * are the demo accounts; the fillers exist purely to make review histograms,
 * "most reviewed" and the trending signal look like a real community.
 *
 * Run: `npm run db:setup` (or `npx tsx apps/api/prisma/seed.ts`).
 */

import bcrypt from 'bcryptjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type Category, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const here = dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = resolve(here, '../assets/avatars');
const PRODUCT_ART_DIR = resolve(here, '../uploads/products');

const BCRYPT_ROUNDS = 10;
const DEMO_PASSWORD = 'novatech123';

// ---------------------------------------------------------------------------
// Deterministic RNG + helpers (re-runnable seed produces identical data)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xdecafbad);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (lo: number, hi: number): number => lo + rand() * (hi - lo);
const intBetween = (lo: number, hi: number): number => Math.floor(between(lo, hi + 1));

/** Round a raw rating score to the 1-10 scale. */
function clampRating(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n)));
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000 - Math.floor(rand() * 86_400_000));
}

function daysFrom(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/** Escape a string into an SVG text-safe value. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Deterministic placeholder art, hand-written to uploads/products.
 *
 * Deliberately neutral: every product shares one template so the whole
 * catalogue reads as a single visual set. Transparent background lets the
 * card's slate gradient show through, the accent stays a soft indigo/violet,
 * and no per-slug hue (or category colour) decides anything.
 */
function generateProductArt(slug: string, name: string, brand: string): string {
  mkdirSync(PRODUCT_ART_DIR, { recursive: true });
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${esc(name)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4338ca"/>
      <stop offset="1" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <circle cx="400" cy="248" r="150" fill="url(#g)" opacity="0.16"/>
  <circle cx="400" cy="248" r="96"  fill="url(#g)" opacity="0.24"/>
  <text x="400" y="272" text-anchor="middle" font-family="system-ui,sans-serif" font-size="64" font-weight="700" fill="#e2e8f0">${esc(initials)}</text>
  <text x="400" y="470" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" letter-spacing="2" fill="#94a3b8">${esc(brand.toUpperCase())}</text>
</svg>`;
  writeFileSync(resolve(PRODUCT_ART_DIR, `${slug}.svg`), svg, 'utf8');
  return `/media/products/${slug}.svg`;
}

function generateGallery(variantSlug: string, name: string, brand: string): string[] {
  mkdirSync(PRODUCT_ART_DIR, { recursive: true });
  const seeds = [`${variantSlug}-a`, `${variantSlug}-b`];
  return seeds.map((s) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${esc(name)}">
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
    writeFileSync(resolve(PRODUCT_ART_DIR, `${s}.svg`), svg, 'utf8');
    return `/media/products/${s}.svg`;
  });
}

function avatarSvg(bg: string, fg: string, initial: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="avatar">
  <rect width="128" height="128" rx="64" fill="${bg}"/>
  <text x="64" y="82" text-anchor="middle" font-family="system-ui,sans-serif" font-size="52" font-weight="700" fill="${fg}">${esc(initial)}</text>
</svg>`;
}
const AVATARS = ['#7c3aed', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'] as const;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

interface SeedUser {
  email: string;
  username: string;
  name: string;
  bio: string;
  role: 'USER' | 'ADMIN';
  avatarIndex: number;
}

const NAMED_USERS: SeedUser[] = [
  {
    email: 'admin@novatech.dev',
    username: 'admin',
    name: 'Nova Admin',
    bio: 'Building the hub. I read every single review.',
    role: 'ADMIN',
    avatarIndex: 0,
  },
  {
    email: 'priya@example.com',
    username: 'priya.k',
    name: 'Priya Krishnan',
    bio: 'Product engineer. Reviews are my love language - I test before I type.',
    role: 'USER',
    avatarIndex: 1,
  },
  {
    email: 'marco@example.com',
    username: 'marco.dev',
    name: 'Marco Vega',
    bio: 'Weekend filmmaker and keyboard nerd. If my desk is clean, I am sick.',
    role: 'USER',
    avatarIndex: 2,
  },
  {
    email: 'elena@example.com',
    username: 'elena',
    name: 'Elena Fischer',
    bio: 'Audio snob. My ears are calibrated.',
    role: 'USER',
    avatarIndex: 3,
  },
  {
    email: 'tom@example.com',
    username: 'tom.bike',
    name: 'Tom Adeyemi',
    bio: 'Ride first, review later. Endurance tech enthusiast.',
    role: 'USER',
    avatarIndex: 4,
  },
  {
    email: 'riley@example.com',
    username: 'riley',
    name: 'Riley Walsh',
    bio: 'Smart home tinkerer. If it isn\'t on a schedule, it isn\'t installed.',
    role: 'USER',
    avatarIndex: 5,
  },
];

/** Reviewers without featured profiles - they exist to give every product a real histogram. */
const FILLER_USERS: SeedUser[] = (
  [
    ['sofia@example.com', 'sofia', 'Sofia Lind'],
    ['jonas@example.com', 'jonas', 'Jonas Berg'],
    ['ami@example.com', 'ami_w', 'Ami Wong'],
    ['dev.tobias@example.com', 'tobias', 'Tobias Roy'],
    ['nora@example.com', 'nora', 'Nora Haddad'],
    ['ken@example.com', 'ken_lee', 'Ken Lee'],
    ['ida@example.com', 'ida', 'Ida Novak'],
    ['raul@example.com', 'raul', 'Raúl Mendes'],
    ['claire@example.com', 'claire', 'Claire Dubois'],
    ['jules@example.com', 'jules', 'Jules Moreau'],
    ['anna@example.com', 'anna', 'Anna Biel'],
    ['marc@example.com', 'marc', 'Marc Olivier'],
  ] as const
).map(([email, username, name], i) => ({
  email,
  username,
  name,
  bio: 'Hardware enthusiast and early adopter.',
  role: 'USER' as const,
  avatarIndex: (i + 1) % AVATARS.length,
}));

// ---------------------------------------------------------------------------
// Products (36 - 6 per category)
// ---------------------------------------------------------------------------

interface SeedProduct {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  brand: string;
  /** Integer cents. */
  priceMinor: number;
  imageUrl: string;
  galleryUrls?: string[];
  featured: boolean;
  releaseDate: Date;
  specs: Record<string, string>;
  /** How many reviews this product carries (3-15). */
  reviewCount: number;
  /** Center of the rating distribution - a quality signal per product. */
  ratingBias: number;
}

const COMMITTED = (slug: string) => `/media/products/${slug}.jpg`;
const art = generateProductArt; // convenience alias

const PRODUCTS: SeedProduct[] = [
  // ---------------------------------------------------------------- AUDIO
  {
    slug: 'pulsebuds-pro', name: 'PulseBuds Pro', brand: 'NovaTech',
    tagline: 'Charged earbuds with studio-grade ANC',
    description: 'A featherweight true-wireless pair with adaptive noise cancelling, an hour of super bass, and a charging case that clips anywhere.',
    category: 'AUDIO', priceMinor: 18999, imageUrl: COMMITTED('pulsebuds-pro'), featured: true,
    releaseDate: daysFrom(-70), specs: { Driver: '11mm dynamic', 'Active noise cancelling': 'Adaptive, -42 dB',
      'Battery life': '8h, +28h with case', Water: 'IPX5', Weight: '5.2 g / bud' },
    reviewCount: 14, ratingBias: 8.6,
  },
  {
    slug: 'voyager-anc-x', name: 'Voyager ANC X', brand: 'Aura Sound',
    tagline: 'Over-ear comfort tuned for 12-hour flights',
    description: 'Plush memory-foam cups, four-mic call quality and a battery that outlasts any long-haul schedule. Folds flat into the travel case.',
    category: 'AUDIO', priceMinor: 32900, imageUrl: COMMITTED('voyager-anc-x'), featured: false,
    releaseDate: daysFrom(-140), specs: { Driver: '40mm custom cellulose', 'Active noise cancelling': 'Hybrid, -45 dB',
      'Battery life': 'Up to 38h (ANC on)', Weight: '254 g', 'Charging': 'USB-C, 10min = 4h' },
    reviewCount: 12, ratingBias: 9.0,
  },
  {
    slug: 'echo-soundbar', name: 'Echo Soundbar 511', brand: 'NovaTech',
    tagline: 'Cinematic three-channel bar for small rooms',
    description: 'A slim soundbar with dedicated centre channel and night mode. Dialogue stays crisp even at whisper volume.',
    category: 'AUDIO', priceMinor: 27999, imageUrl: COMMITTED('echo-soundbar'), featured: false,
    releaseDate: daysFrom(-210), specs: { Channels: '3.0', 'Peak power': '300 W', 'HDMI': 'eARC',
      'Night mode': 'Yes', 'Wall mount': 'Included' },
    reviewCount: 6, ratingBias: 7.6,
  },
  {
    slug: 'halo-speaker-360', name: 'Halo Speaker 360', brand: 'Halo Labs',
    tagline: 'Room-filling omni-directional smart speaker',
    description: 'A 360° radiating smart speaker with bass radiators top and bottom. Plays beautifully both on the shelf and centre-table.',
    category: 'AUDIO', priceMinor: 15900, imageUrl: COMMITTED('halo-speaker-360'), featured: false,
    releaseDate: daysFrom(-45), specs: { 'Drivers': '2× full-range, 2× passive bass', Power: '40 W',
      'Assistant': 'Built-in', 'Connectivity': 'Wi-Fi 6, BT 5.3', 'Multi-room': 'Yes' },
    reviewCount: 9, ratingBias: 8.0,
  },
  {
    slug: 'novaphono-vinyl', name: 'NovaPhono Turntable', brand: 'NovaTech',
    tagline: 'Belt-drive vinyl with a zero-vibration motor',
    description: 'A minimal belt-drive deck with switchable phono stage. Hands-off auto-stop protects your records when the needle lifts.',
    category: 'AUDIO', priceMinor: 39900, imageUrl: COMMITTED('novaphono-vinyl'),
    featured: false, releaseDate: daysFrom(-30), specs: { Drive: 'Belt', Speeds: '33/45 rpm',
      'Phono stage': 'Switchable', Arm: '9" aluminium', 'Cartridge': 'MM pre-fitted' },
    reviewCount: 5, ratingBias: 8.4,
  },
  {
    slug: 'bassline-go', name: 'BassLine Go Amp', brand: 'Lakeview Audio',
    tagline: 'Pocket amp that turns headphones into studio cans',
    description: 'A class-A/B portable headphone amp with hand-matched volume pots. Neutral gain staging that reveals detail without glare.',
    category: 'AUDIO', priceMinor: 12900, imageUrl: COMMITTED('bassline-go'),
    featured: false, releaseDate: daysFrom(-15), specs: { Type: 'Class A/B', 'Input': '3.5mm, USB-C',
      'Battery': '18h', 'Output': '150 mW @ 32Ω', 'Gain': 'Low / high' },
    reviewCount: 3, ratingBias: 7.9,
  },

  // ------------------------------------------------------------- WEARABLES
  {
    slug: 'pulse-watch-s2', name: 'Pulse Watch S2', brand: 'NovaTech',
    tagline: 'AMOLED fitness watch with 10-day battery',
    description: 'The S2 pairs a bright always-on AMOLED with dual-band GPS and a health engine that tracks recovery as carefully as it tracks steps.',
    category: 'WEARABLES', priceMinor: 24900, imageUrl: COMMITTED('pulse-watch-s2'), featured: true,
    releaseDate: daysFrom(-55), specs: { Display: '1.43" AMOLED, 466×466', Battery: 'Up to 10 days',
      'GPS': 'Dual-band', 'Heart rate': 'Optical + ECG', Water: '5 ATM', 'OS': 'NovaOS 4' },
    reviewCount: 15, ratingBias: 8.2,
  },
  {
    slug: 'orbit-band-fit', name: 'Orbit Band Fit', brand: 'Orbit Labs',
    tagline: 'A 12 g band that disappears on the wrist',
    description: 'The lightest band we track with - sleep, stress and heart-rate windows no buzzing, no big screen, just the numbers you need.',
    category: 'WEARABLES', priceMinor: 7999, imageUrl: COMMITTED('orbit-band-fit'), featured: false,
    releaseDate: daysFrom(-95), specs: { Weight: '12 g', Battery: '7 days', 'Sleep staging': 'Yes',
      'Stress': 'HRV-based', Water: '5 ATM', 'Companion app': 'iOS / Android' },
    reviewCount: 10, ratingBias: 8.1,
  },
  {
    slug: 'spectra-ring', name: 'Spectra Ring', brand: 'NovaTech',
    tagline: 'Sleep and readiness scores, minus the wrist',
    description: 'A polished titanium ring that turns body temperature and overnight HRV into a readable readiness score by morning.',
    category: 'WEARABLES', priceMinor: 29900, imageUrl: COMMITTED('spectra-ring'), featured: false,
    releaseDate: daysFrom(-25), specs: { Material: 'Grade 5 titanium', Battery: '5-6 days',
      'Sensors': 'Skin temp, SpO2, HRV', 'Sizing': '6-13', Water: '10 ATM', 'Sync': 'Daily, auto' },
    reviewCount: 8, ratingBias: 8.7,
  },
  {
    slug: 'levitate-sleep-band', name: 'Levitate Sleep Band', brand: 'Orbit Labs',
    tagline: 'Headband that coaches your sleep stages',
    description: 'Sleep coaching that listens. The headband tracks EEG-style brain activity and nudges your wind-down routine, morning paper included.',
    category: 'WEARABLES', priceMinor: 17900, imageUrl: COMMITTED('levitate-sleep-band'),
    featured: false, releaseDate: daysFrom(-5), specs: { 'EEG': '3-channel', Battery: '2 nights',
      'Sleep score': 'Morning report', 'Subscription': 'Optional premium', Weight: '38 g' },
    reviewCount: 5, ratingBias: 8.3,
  },
  {
    slug: 'strider-runner-gps', name: 'Strider Runner GPS', brand: 'PaceWorks',
    tagline: 'A runner\'s watch with mapping that just works',
    description: 'Turn-by-turn breadcrumb off-road, a lock-on GNSS engine for city canyons and workout presets tuned by actual runners.',
    category: 'WEARABLES', priceMinor: 19900, imageUrl: COMMITTED('strider-runner-gps'),
    featured: false, releaseDate: daysFrom(-130), specs: { 'GPS': 'Multi-band GNSS', Battery: '16 h GPS',
      'Maps': 'Topo, offline', 'Training': 'AI pace plans', 'Weight': '34 g' },
    reviewCount: 7, ratingBias: 7.8,
  },
  {
    slug: 'aurora-frames', name: 'Aurora Glass Frames', brand: 'Halo Labs',
    tagline: 'Smart glasses with discreet open-ear audio',
    description: 'Music and notifications woven into a lightweight frame. Open-ear transducers keep you present; lens tint swaps with a tap.',
    category: 'WEARABLES', priceMinor: 39900, imageUrl: COMMITTED('aurora-frames'),
    featured: false, releaseDate: daysFrom(-18), specs: { 'Audio': 'Open-ear', Battery: '6 h playback',
      'Lens': 'Photochromic', Weight: '31 g', 'Mic array': '2× beamforming' },
    reviewCount: 4, ratingBias: 7.5,
  },

  // ------------------------------------------------------------- SMART_HOME
  {
    slug: 'aurora-lamp', name: 'Aurora Lamp', brand: 'NovaTech',
    tagline: 'Ambient glow that follows your routines',
    description: 'A diffused LED lamp with sunrise wake and wind-down scenes. Playfully physical dials replace a barrage of app buttons.',
    category: 'SMART_HOME', priceMinor: 4999, imageUrl: COMMITTED('aurora-lamp'), featured: false,
    releaseDate: daysFrom(-120), specs: { 'Light engine': 'RGBCW LED', Brightness: '1200 lm',
      'CCT range': '2200-6500 K', Controls: 'Dial + app', 'Matter': 'Yes' },
    reviewCount: 8, ratingBias: 8.0,
  },
  {
    slug: 'lumen-globe', name: 'Lumen Globe', brand: 'NovaTech',
    tagline: 'Orb light for cosy corners',
    description: 'A hand-blown glass orb with warm gradients for reading nooks and bedside tables. Dimmable to a single ember.',
    category: 'SMART_HOME', priceMinor: 8900, imageUrl: COMMITTED('lumen-globe'), featured: false,
    releaseDate: daysFrom(-40), specs: { 'Light engine': 'Warm white LED', Brightness: '800 lm',
      'Dim curve': '1-100%', 'Power': 'USB-C 10 W', 'Material': 'Borosilicate' },
    reviewCount: 6, ratingBias: 7.7,
  },
  {
    slug: 'hearth-thermostat', name: 'Hearth Thermostat', brand: 'Ember Home',
    tagline: 'Learning thermostat with per-room zones',
    description: 'Room sensors learn who is where and heats to match. Weekly reports show where your energy actually went.',
    category: 'SMART_HOME', priceMinor: 15900, imageUrl: COMMITTED('hearth-thermostat'),
    featured: false, releaseDate: daysFrom(-90), specs: { 'Compatibility': '24 V HVAC', Sensors: 'Up to 8 rooms',
      'Reports': 'Weekly energy', 'Geofencing': 'Yes', 'Efficiency': 'Eco rec mode' },
    reviewCount: 9, ratingBias: 8.5,
  },
  {
    slug: 'sentrycam-360', name: 'SentryCam 360', brand: 'Ember Home',
    tagline: 'Privacy-first indoor camera with on-device AI',
    description: 'All person/pet detection runs on-device; footage can stay local. Pan to any corner from your phone, no cloud fees required.',
    category: 'SMART_HOME', priceMinor: 12900, imageUrl: COMMITTED('sentrycam-360'),
    featured: false, releaseDate: daysFrom(-22), specs: { Resolution: '2K / 30 fps', 'Field of view': '360° pan',
      'Storage': 'Local microSD', 'AI': 'On-device', 'Audio': 'Two-way' },
    reviewCount: 7, ratingBias: 7.9,
  },
  {
    slug: 'aegis-lock-pro', name: 'Aegis Lock Pro', brand: 'Ember Home',
    tagline: 'Fingerprint, code and app - one deadbolt',
    description: 'Three ways in and a tamper alarm. The fingerprint sensor reads even slightly damp fingers, and the app logs every entry.',
    category: 'SMART_HOME', priceMinor: 21900, imageUrl: COMMITTED('aegis-lock-pro'),
    featured: false, releaseDate: daysFrom(-160), specs: { 'Entry methods': 'Fingerprint, PIN, app, key',
      'Battery': '8× AA, 12 mo', 'Tamper alarm': 'Yes', 'Auto-lock': 'Configurable', 'Warranty': '2 yr' },
    reviewCount: 5, ratingBias: 8.1,
  },
  {
    slug: 'nestline-air', name: 'Nestline Air Purifier', brand: 'AriaPure',
    tagline: 'Quiet air cleaning for sleepers',
    description: 'A purifier engineered around 24 dB sleep mode. The overnight CADR curve drops fan noise as sensors see the air clean up.',
    category: 'SMART_HOME', priceMinor: 29900, imageUrl: COMMITTED('nestline-air'),
    featured: false, releaseDate: daysFrom(-11), specs: { 'Coverage': '560 sq ft', 'CADR': '300 CFM',
      'Await mode': '24 dB', 'Filters': 'HEPA H13 + carbon', 'Sensor': 'PM2.5 / VOC' },
    reviewCount: 4, ratingBias: 8.2,
  },

  // ---------------------------------------------------------------- MOBILE
  {
    slug: 'novaphone-x1', name: 'NovaPhone X1', brand: 'NovaTech',
    tagline: 'The flagship that does everything sooner',
    description: 'A no-compromise flagship: an adaptive LTPO display, the Nova X2 chip, and a camera system that makes its own light.',
    category: 'MOBILE', priceMinor: 99999, imageUrl: '/media/products/novaphone-x1.jpg', featured: true,
    releaseDate: daysFrom(-60), specs: { Display: '6.7" LTPO 1-120 Hz', Chip: 'Nova X2',
      'RAM / storage': '12 / 256 GB', Battery: '5000 mAh, 80 W', Camera: '50 MP main + 50 MP ultrawide',
      'OS': 'NovaOS 5', Weight: '197 g' },
    reviewCount: 15, ratingBias: 9.1,
  },
  {
    slug: 'nova-arc-powerbank', name: 'Ark Power Bank 20K', brand: 'NovaTech',
    tagline: '20,000 mAh that fast-charges two phones at once',
    description: 'Two USB-C ports output 65 W combined, so the Ark tops up a laptop and phone together. The digital gauge ends capacity guesswork.',
    category: 'MOBILE', priceMinor: 4499, imageUrl: '/media/products/nova-arc-powerbank.jpg', featured: false,
    releaseDate: daysFrom(-85), specs: { Capacity: '20,000 mAh', Output: '65 W max', 'Ports': '2× USB-C + 1× A',
      'Pass-through': 'Yes', 'Display': 'LED %, W', Weight: '398 g' },
    reviewCount: 11, ratingBias: 8.3,
  },
  {
    slug: 'volt-charger-65w', name: 'Volt Charger 65W', brand: 'NovaTech',
    tagline: 'GaN brick that folds into any pocket',
    description: 'A foldable gallium-nitride charger with three ports. It charges a laptop, phone and buds from one hotel plug.',
    category: 'MOBILE', priceMinor: 3499, imageUrl: '/media/products/volt-charger-65w.jpg', featured: false,
    releaseDate: daysFrom(-33), specs: { Output: '65 W USB-C + 20 W', 'Ports': '2× USB-C, 1× USB-A',
      'Tech': 'GaN II', 'Foldable plug': 'Yes', Weight: '92 g' },
    reviewCount: 10, ratingBias: 8.0,
  },
  {
    slug: 'flexdock-wireless', name: 'FlexDock Wireless Pad', brand: 'Orbit Labs',
    tagline: 'Aligned-wireless charging for phone, buds and watch',
    description: 'One pad, three coils, magnetic alignment. Devices land exactly where the 15 W fast lane is.',
    category: 'MOBILE', priceMinor: 3999, imageUrl: '/media/products/flexdock-wireless.jpg',
    featured: false, releaseDate: daysFrom(-26), specs: { 'Charge zones': 'Phone 15 W, buds 5 W, watch 3 W',
      'Coils': '3 (free-position)', Interface: 'USB-C in', 'Material': 'Silicone + aluminium', Weight: '168 g' },
    reviewCount: 6, ratingBias: 7.6,
  },
  {
    slug: 'skyring-car-mount', name: 'SkyRing Car Mount', brand: 'Orbit Labs',
    tagline: 'Magnetic grip that holds over every pothole',
    description: 'A 14-magnet array holds a case in place across the worst suspension engineering on the road. One-handed snap in and out.',
    category: 'MOBILE', priceMinor: 2499, imageUrl: '/media/products/skyring-car-mount.jpg',
    featured: false, releaseDate: daysFrom(-7), specs: { 'Magnets': '14× N52', 'Rotation': '360°',
      'Vent mount': 'Reinforced clamp', 'Case compatibility': 'Any MagSafe or <2 mm case', Weight: '46 g' },
    reviewCount: 3, ratingBias: 7.2,
  },
  {
    slug: 'novaphone-se', name: 'NovaPhone SE', brand: 'NovaTech',
    tagline: 'Compact, and refreshingly complete',
    description: 'A 6.1-inch phone with flagship responsiveness where it counts and a battery that runs two full days.',
    category: 'MOBILE', priceMinor: 59999, imageUrl: '/media/products/novaphone-se.jpg',
    featured: false, releaseDate: daysFrom(-110), specs: { Display: '6.1" AMOLED 90 Hz', Chip: 'Nova X1',
      'RAM / storage': '8 / 128 GB', Battery: '4700 mAh', Camera: '48 MP with OIS', 'OS': 'NovaOS 5',
      Weight: '163 g' },
    reviewCount: 8, ratingBias: 8.4,
  },

  // -------------------------------------------------------------- COMPUTING
  {
    slug: 'devbook-pro-16', name: 'DevBook Pro 16', brand: 'NovaTech',
    tagline: 'M-series-class power in a 16-inch frame',
    description: 'For CPU bursts that never slow the fan. Forty-core graphics, 64 GB unified memory and a Mini-LED screen that hurts to leave.',
    category: 'COMPUTING', priceMinor: 319999, imageUrl: COMMITTED('devbook-pro-16'),
    featured: true, releaseDate: daysFrom(-50), specs: { Display: '16.2" Mini-LED 120 Hz',
      'CPU': 'Nova M4 Max, 16-core', 'GPU': '40-core', 'Memory': '64 GB unified', 'Storage': '2 TB SSD',
      'Battery': '24 h video' },
    reviewCount: 13, ratingBias: 8.9,
  },
  {
    slug: 'devbook-air-13', name: 'DevBook Air 13', brand: 'NovaTech',
    tagline: 'Pound-for-pound the best laptop most people need',
    description: 'Fanless, silent, all-day. The Air proves a light 13-inch can still chew through serious work without breaking a sweat.',
    category: 'COMPUTING', priceMinor: 119999, imageUrl: COMMITTED('devbook-air-13'),
    featured: false, releaseDate: daysFrom(-145), specs: { Display: '13.6" Liquid Retina', 'CPU': 'Nova M3, 8-core',
      'GPU': '10-core', 'Memory': '16 GB unified', 'Storage': '512 GB SSD', 'Battery': '18 h video',
      Weight: '1.24 kg' },
    reviewCount: 12, ratingBias: 9.2,
  },
  {
    slug: 'atlasdesk-27', name: 'AtlasDesk 27 Monitor', brand: 'Orbit Labs',
    tagline: '4K at 120 Hz on a desk, not a stand',
    description: 'A 27-inch 4K 120 Hz panel with Thunderbolt upstream that charges a laptop while it puts 94% P3 on screen.',
    category: 'COMPUTING', priceMinor: 69999, imageUrl: COMMITTED('atlasdesk-27'),
    featured: false, releaseDate: daysFrom(-75), specs: { Display: '27" 4K IPS, 120 Hz', 'Colour': '94% DCI-P3',
      'Ports': 'TB4 in/out, USB-A ×3', 'Stand': 'Height/rotate, VESA', 'Power': '90 W to laptop' },
    reviewCount: 7, ratingBias: 8.6,
  },
  {
    slug: 'corex-84', name: 'CoreX 84 Keyboard', brand: 'KeyForge',
    tagline: 'Hot-swap gasket keyboard, silent lubed',
    description: 'An 84-key gasket-mount board shipped lubed and ready. The silicone plate swap changes the feel from silk to thock in minutes.',
    category: 'COMPUTING', priceMinor: 10999, imageUrl: COMMITTED('corex-84'),
    featured: false, releaseDate: daysFrom(-20), specs: { Layout: '84-key (75%)', Mount: 'Gasket',
      'Switch': 'Hot-swap 5 pin', 'Connectivity': 'USB-C / BT 5.1 / 2.4G', 'Battery': '4000 mAh',
      'Keycaps': 'PBT dye-sub' },
    reviewCount: 9, ratingBias: 8.8,
  },
  {
    slug: 'drift-mouse-ergo', name: 'Drift Mouse Ergo', brand: 'PaceWorks',
    tagline: 'Battery-sipping vertical mouse',
    description: 'A 60° vertical shape that keeps the wrist straight through a long sprint. Silent switches and a battery that lasts six months.',
    category: 'COMPUTING', priceMinor: 5999, imageUrl: COMMITTED('drift-mouse-ergo'),
    featured: false, releaseDate: daysFrom(-12), specs: { 'Angle': '60° vertical', Sensor: 'Avago 8200 DPI',
      'Battery': '6 months (2× AA)', 'Switches': 'Silent', 'Connectivity': 'BT + 2.4G' },
    reviewCount: 5, ratingBias: 7.7,
  },
  {
    slug: 'thunderbay-tb4', name: 'ThunderBay TB4 Dock', brand: 'NovaTech',
    tagline: 'One cable does everything',
    description: 'A Thunderbolt 4 dock with 15 ports and a pass-through that delivers 100 W to your laptop.',
    category: 'COMPUTING', priceMinor: 18999, imageUrl: COMMITTED('thunderbay-tb4'),
    featured: false, releaseDate: daysFrom(-3), specs: { 'Upstream': 'TB4, 100 W', 'Ports': '2× TB4, DP1.4',
      'USB': '3× A, 2× C 10 Gbps', 'Ethernet': '2.5 GbE', 'Storage': 'SD 4.0 built-in' },
    reviewCount: 4, ratingBias: 8.0,
  },

  // ------------------------------------------------------------ PHOTOGRAPHY
  {
    slug: 'horizon-cam-v', name: 'Horizon Cam V', brand: 'Horizon Optics',
    tagline: 'Hybrid captures in a body you carry daily',
    description: 'A 26 MP hybrid stills-and-video camera with in-body stabilisation that shakes out handheld C-mount work.',
    category: 'PHOTOGRAPHY', priceMinor: 149999, imageUrl: COMMITTED('horizon-cam-v'), featured: true,
    releaseDate: daysFrom(-65), specs: { Sensor: '26 MP APS-C BSI', 'Stabilisation': '5-axis IBIS + digital',
      'Video': '4K 60 / HD 240', 'Eye AF': 'Human + animal', 'Weather seal': 'Yes', 'Weight': '445 g' },
    reviewCount: 8, ratingBias: 8.7,
  },
  {
    slug: 'lens-drone-air', name: 'Lens Drone Air', brand: 'AeroVue',
    tagline: 'Sub-250 g cine drone with gimbal light',
    description: 'A 249 g drone that squeezes a 4-axis gimbal and a 1-inch sensor into a registration-free class.',
    category: 'PHOTOGRAPHY', priceMinor: 89999, imageUrl: COMMITTED('lens-drone-air'), featured: false,
    releaseDate: daysFrom(-135), specs: { Weight: '249 g', Sensor: '1-inch', 'Video': '4K 60 D-Log',
      'Flight time': '34 min', 'Range': '10 km (O4)', 'Gimbal': '4-axis' },
    reviewCount: 6, ratingBias: 8.5,
  },
  {
    slug: 'prisma-50mm', name: 'Prisma 50mm f/1.4', brand: 'Horizon Optics',
    tagline: 'A portrait prime with swirly bokeh',
    description: 'Fast, weather-sealed and absurdly sharp at the centre. The neutral coating keeps flaring away while backgrounds melt.',
    category: 'PHOTOGRAPHY', priceMinor: 64999, imageUrl: COMMITTED('prisma-50mm'),
    featured: false, releaseDate: daysFrom(-28), specs: {'Aperture': 'f/1.4-f/16', 'Mount': 'H-mount full-frame',
      'Blades': '11 circular', 'AF': 'Stepping motor', 'Seal': 'Weather-sealed' },
    reviewCount: 5, ratingBias: 8.8,
  },
  {
    slug: 'fluxtouch-ttl', name: 'FluxTouch TTL Flash', brand: 'AeroVue',
    tagline: 'Tiny speedlight, huge control',
    description: 'A pocket speedlight with touch-S-LCD menus and 500 full-power pops. Radio triggers are built in, no extra cable monsters.',
    category: 'PHOTOGRAPHY', priceMinor: 22999, imageUrl: COMMITTED('fluxtouch-ttl'),
    featured: false, releaseDate: daysFrom(-9), specs: {'Guide no.': 'GN40 (ISO 100, 200mm)',
      'Recycle': '1.5 s AA / 0.9 s li-ion', 'HSS': 'Yes', 'Radio': 'Built-in receiver', 'Batteries': '4× AA or li-ion' },
    reviewCount: 3, ratingBias: 8.1,
  },
  {
    slug: 'trilock-carbon', name: 'TriLock Carbon Tripod', brand: 'PaceWorks',
    tagline: 'A 1.1 kg tripod that shrugs off gale force',
    description: 'Carbon legs with a freedom column that converts to a monopod. The ball head holds a long lens perfectly still.',
    category: 'PHOTOGRAPHY', priceMinor: 32999, imageUrl: COMMITTED('trilock-carbon'),
    featured: false, releaseDate: daysFrom(-16), specs: {'Max height': '1.56 m', 'Load': '10 kg',
      'Weight': '1.1 kg', 'Legs': '4-section carbon', 'Head': 'Gimbal-style ball' },
    reviewCount: 4, ratingBias: 8.0,
  },
  {
    slug: 'voyager-gimbal', name: 'Voyager Handheld Gimbal', brand: 'AeroVue',
    tagline: 'Smooth cinematic moves out of your hands',
    description: 'A three-axis phone/C-camera gimbal with follow-me tracking, for handheld moves that stay glassy across a full run.',
    category: 'PHOTOGRAPHY', priceMinor: 15999, imageUrl: COMMITTED('voyager-gimbal'),
    featured: false, releaseDate: daysFrom(-4), specs: {'Axes': '3-axis', 'Load': '≤ 900 g',
      'Tracking': 'Active follow-me', 'Battery': '12 h', 'App': 'Voyager Studio', 'Payload': 'Phone + lens mount' },
    reviewCount: 3, ratingBias: 7.6,
  },
];

// ---------------------------------------------------------------------------
// Review copy
// ---------------------------------------------------------------------------

const TITLES = {
  praise: [
    'Exceeded every expectation',
    'Worth every penny',
    'Still smiling after a week',
    'The best in its class, period',
    'Became my daily carry instantly',
    'Zero buyers remorse',
    'Squeezed my wallet, stole my heart',
  ],
  mixed: [
    'Great, with one small asterisk',
    'Very good, not quite perfect',
    'Great hardware, meh software',
    'Close to five stars',
    'Almost perfect, then the firmware',
  ],
  critique: [
    'Doesn\'t live up to the hype',
    'Good ideas, rough execution',
    'Fine, but I expected more',
    'My third one is the charm',
    'Promising but flawed',
    'Returned it after a week',
  ],
};

const PRAISE_SENTENCES = [
  'Setup took under five minutes and the packaging alone is worth photographing.',
  'The build quality is the first thing I noticed - nothing creaks, nothing gaps.',
  'I have used it daily for two weeks now and the honeymoon has yet to end.',
  'Battery life matches the sticker, which is rarer than it should be.',
  'The software is refreshingly complete on day one, no day-one-patch required.',
  'Detail, fit and finish all punch well above the price.',
  'This replaces two things on my desk and does both better.',
  'Customer support actually answered, which apparently is a luxury now.',
];

const MIXED_SENTENCES = [
  'The hardware is lovely, but a few rough edges keep it from a perfect score.',
  'Very close to excellent - two small gripes below, both software-related.',
  'It does the headline feature brilliantly and the rest adequately.',
  'Genuinely good, though the mobile app feels one release behind the device.',
];

const CRITIQUE_SENTENCES = [
  'The first unit had a rattling part and the replacement was better but not perfect.',
  'It looks great in promos and ordinary in real life.',
  'A firmware update fixed the worst issue, but two remain.',
  'I wanted to love it, and I only like it.',
  'For this price I expected polish in the corners, not just on the box.',
  'Battery life is way off the advertised figure in my testing.',
];

const VERDICTS = [
  'Would I buy it again? Without hesitation.',
  'I\'d recommend it to a friend with my eyes about half closed.',
  'Five stars from me, with the asterisk in the middle above.',
  'Three stars feels harsh and four feels generous - I landed on this.',
  'If the price drops by 20%, it is a steal.',
  'My final verdict is simple: try one before you buy one.',
];

function reviewTitle(rating: number): string {
  if (rating >= 9) return pick(TITLES.praise);
  if (rating >= 7) return pick(TITLES.mixed);
  return pick(TITLES.critique);
}

function reviewBody(rating: number, productName: string): string {
  const pool =
    rating >= 9 ? PRAISE_SENTENCES
    : rating >= 7 ? MIXED_SENTENCES
    : CRITIQUE_SENTENCES;

  const sentences = new Set<string>();
  sentences.add(pool[intBetween(0, pool.length - 1)]!);
  sentences.add(pool[intBetween(0, pool.length - 1)]!);
  // One or two extras to comfortably clear the 20-char minimum.
  for (let i = 0; i < 2 && sentences.size < 3; i++) {
    sentences.add(pool[intBetween(0, pool.length - 1)]!);
  }
  let body = [...sentences].join(' ');
  if (body.length < 40) body += ' I tested the ' + productName + ' for myself, and here is the honest version.';
  return body + ' ' + pick(VERDICTS);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding NovaTech Hub...');

  // Idempotent reset - children first, order matters for FK constraints.
  await prisma.reviewVote.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // ---- Users --------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  mkdirSync(AVATAR_DIR, { recursive: true });
  const avatarFiles: string[] = [];
  writeFileSync(
    resolve(AVATAR_DIR, 'default.svg'),
    avatarSvg('#475569', '#f8fafc', '?'),
    'utf8',
  );

  const allUsers = [...NAMED_USERS, ...FILLER_USERS];
  const createdUsers = await Promise.all(
    allUsers.map((u, i) => {
      const initial = u.name.trim()[0]!.toUpperCase();
      const color = AVATARS[u.avatarIndex % AVATARS.length]!;
      const file = `seed-${i}.svg`;
      writeFileSync(resolve(AVATAR_DIR, file), avatarSvg(color, '#ffffff', initial), 'utf8');
      avatarFiles.push(file);
      return prisma.user.create({
        data: {
          email: u.email,
          username: u.username,
          passwordHash,
          name: u.name,
          bio: u.bio,
          role: u.role,
          avatarUrl: `/media/avatars/${file}`,
        },
      });
    }),
  );
  console.log(`  ✓ ${createdUsers.length} users`);

  const userByUsername = new Map(createdUsers.map((u) => [u.username, u]));
  const named = NAMED_USERS.map((u) => userByUsername.get(u.username)!);
  const reviewers = [...named, ...FILLER_USERS.map((f) => userByUsername.get(f.username)!)].filter(
    (u): u is NonNullable<typeof u> => u !== undefined,
  );

  // ---- Products -----------------------------------------------------------
  for (const p of PRODUCTS) {
    await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        category: p.category,
        brand: p.brand,
        priceMinor: p.priceMinor,
        imageUrl: p.imageUrl,
        galleryUrls: p.galleryUrls?.length ? p.galleryUrls : generateGallery(p.slug, p.name, p.brand),
        specs: p.specs,
        releaseDate: p.releaseDate,
        featured: p.featured,
      },
    });
  }
  const products = await prisma.product.findMany({ orderBy: { slug: 'asc' } });
  console.log(`  ✓ ${products.length} products`);

  // ---- Reviews (≈200, 3-15 per product) ------------------------------------
  const reviewRows: Prisma.ReviewCreateManyInput[] = [];
  const reviewMeta: Array<{ productId: string; userId: string; rating: number }> = [];
  let reviewTally = 0;

  for (const seedProduct of PRODUCTS) {
    const product = products.find((pp) => pp.slug === seedProduct.slug)!;
    const count = seedProduct.reviewCount;
    // Shuffle reviewers so different products get different voices.
    const roster = [...reviewers].sort(() => rand() - 0.5).slice(0, count);

    for (const user of roster) {
      const rating = clampRating(seedProduct.ratingBias + (rand() * 5 - 2.5));
      reviewRows.push({
        productId: product.id,
        userId: user.id,
        rating,
        title: reviewTitle(rating),
        body: reviewBody(rating, seedProduct.name),
        visibility: 'VISIBLE',
        createdAt: daysAgo(intBetween(1, 110)),
      });
      reviewMeta.push({ productId: product.id, userId: user.id, rating });
      reviewTally++;
    }
  }

  // Batch insert all reviews, then distribute votes across them.
  await prisma.review.createMany({ data: reviewRows });
  const reviews = await prisma.review.findMany({
    where: { productId: { in: products.map((p) => p.id) } },
  });
  console.log(`  ✓ ${reviewTally} reviews`);

  const voteRows: Prisma.ReviewVoteCreateManyInput[] = [];
  const votesByReview = new Map<string, number>();
  for (const review of reviews) {
    const voterCount = intBetween(0, 10);
    const voters = [...reviewers].sort(() => rand() - 0.5).slice(0, voterCount);
    for (const voter of voters) {
      if (voter.id === review.userId) continue; // can't vote your own review
      const value = rand() > 0.55 ? 1 : -1;
      voteRows.push({ reviewId: review.id, userId: voter.id, value });
      votesByReview.set(review.id, (votesByReview.get(review.id) ?? 0) + (value === 1 ? 1 : -1));
    }
  }
  await prisma.reviewVote.createMany({ data: voteRows });
  console.log(`  ✓ ${voteRows.length} votes`);

  // ---- Wishlist (named users only) -----------------------------------------
  const wishlistRows: Prisma.WishlistItemCreateManyInput[] = [];
  for (const user of named) {
    const desired = intBetween(3, 6);
    const targets = products.slice().sort(() => rand() - 0.5).slice(0, desired);
    for (const product of targets) {
      wishlistRows.push({ userId: user.id, productId: product.id });
    }
  }
  await prisma.wishlistItem.createMany({ data: wishlistRows });
  console.log(`  ✓ ${wishlistRows.length} wishlist items`);

  console.log('\nSeed complete ✨');
  console.log('Demo passwords - all users: "novatech123"');
  console.log('Sign in as: admin / priya.k / marco.dev / elena / tom.bike / riley');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });