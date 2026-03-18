/**
 * Screenshot capture for taste-driven iteration.
 *
 * Usage:
 *   node scripts/capture.js [--wait=SECONDS] [--delay=SECONDS] [--url=URL] [--out=DIR]
 *
 * Requires: Vite dev server running (npm run dev)
 * Requires: npx playwright install chromium
 *
 * Options:
 *   --wait    Seconds to wait after page load before first capture (default: 5)
 *   --delay   Seconds between first and second capture (default: 8)
 *   --url     Dev server URL (default: http://localhost:5173)
 *   --out     Output directory (default: screenshots)
 *   --seed    Append ?seed=VALUE to URL for reproducible captures
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);

const WAIT = Number(args.wait ?? 5) * 1000;
const DELAY = Number(args.delay ?? 8) * 1000;
const BASE_URL = args.url ?? 'http://localhost:5173';
const OUT_DIR = resolve(args.out ?? 'screenshots');
const SEED = args.seed;

const url = SEED ? `${BASE_URL}?seed=${SEED}` : BASE_URL;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

async function capture() {
  console.log(`Capturing ${url}`);
  console.log(`  Wait: ${WAIT / 1000}s, Delay between shots: ${DELAY / 1000}s`);
  console.log(`  Output: ${OUT_DIR}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('  Page loaded, waiting for animation to develop...');

  await page.waitForTimeout(WAIT);

  const file1 = join(OUT_DIR, `capture-${timestamp}-A.png`);
  await page.screenshot({ path: file1, fullPage: false });
  console.log(`  Shot A: ${file1}`);

  // Also save as "latest" for quick access
  const latest1 = join(OUT_DIR, 'latest-A.png');
  await page.screenshot({ path: latest1, fullPage: false });

  console.log(`  Waiting ${DELAY / 1000}s for evolution...`);
  await page.waitForTimeout(DELAY);

  const file2 = join(OUT_DIR, `capture-${timestamp}-B.png`);
  await page.screenshot({ path: file2, fullPage: false });
  console.log(`  Shot B: ${file2}`);

  const latest2 = join(OUT_DIR, 'latest-B.png');
  await page.screenshot({ path: latest2, fullPage: false });

  await browser.close();
  console.log('Done.');
}

capture().catch(err => {
  console.error('Capture failed:', err.message);
  process.exit(1);
});
