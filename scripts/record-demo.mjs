#!/usr/bin/env node
// Records a short Playwright video of the end-to-end encrypted loan flow,
// then converts it to docs/assets/demo.gif via ffmpeg.
//
// Requires: backend running on :8080, frontend running on :3000, ffmpeg installed.
// Run from repo root:  node scripts/record-demo.mjs
//
// Uses the Playwright install from ../frontend/node_modules — no separate install needed.

import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RECORD_DIR = join(ROOT, '.recording');
const OUTPUT_GIF = join(ROOT, 'docs', 'assets', 'demo.gif');

rmSync(RECORD_DIR, { recursive: true, force: true });
mkdirSync(RECORD_DIR, { recursive: true });

console.log('[record] launching browser...');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: RECORD_DIR, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

console.log('[record] opening http://localhost:3000 ...');
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

// Wait for keys to initialize
console.log('[record] waiting for encryption keys...');
await page.waitForSelector('.key-status', { timeout: 30_000 });
await page.waitForFunction(
  () => !document.querySelector('.key-status')?.textContent?.includes('Initializing'),
  { timeout: 30_000 },
);
await page.waitForTimeout(800);

console.log('[record] filling form...');
await page.fill('#customerId', 'CUST-DEMO-001');
await page.waitForTimeout(250);
await page.fill('#customerName', 'Jane Doe');
await page.waitForTimeout(250);
await page.fill('#amount', '25000');
await page.waitForTimeout(250);
await page.selectOption('#loanType', 'PERSONAL');
await page.waitForTimeout(250);
await page.fill('#term', '24');
await page.waitForTimeout(250);
await page.fill('#purpose', 'End-to-end encrypted demo');
await page.waitForTimeout(800);

console.log('[record] submitting encrypted request...');
await page.click('button:has-text("Submit JWE Encrypted Application")');

// Wait for response to render
await Promise.race([
  page.waitForSelector('.success-message', { timeout: 15_000 }),
  page.waitForSelector('.error-message', { timeout: 15_000 }),
]);
await page.waitForTimeout(1500);

console.log('[record] done, closing context to flush video...');
await context.close();
await browser.close();

// Find the video file
const files = readdirSync(RECORD_DIR).filter((f) => f.endsWith('.webm'));
if (files.length === 0) throw new Error('no video recorded');
const webm = join(RECORD_DIR, files[0]);
console.log(`[record] video: ${webm}`);

// Convert webm → GIF
console.log('[record] converting to GIF via ffmpeg...');
const palette = join(RECORD_DIR, 'palette.png');

// Two-pass for quality: generate palette then use it
await runFfmpeg(['-y', '-i', webm, '-vf', 'fps=12,scale=900:-1:flags=lanczos,palettegen=max_colors=128', palette]);
await runFfmpeg([
  '-y', '-i', webm, '-i', palette,
  '-lavfi', 'fps=12,scale=900:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5',
  OUTPUT_GIF,
]);

console.log(`[record] wrote ${OUTPUT_GIF}`);
rmSync(RECORD_DIR, { recursive: true, force: true });

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });
}
