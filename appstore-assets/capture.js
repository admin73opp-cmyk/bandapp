/**
 * Ritovo App Store Screenshot Capture
 * Uses an existing Supabase session to sign in headlessly, then captures
 * all 10 screens at 1242×2688 (iPhone 6.5") and 1284×2778 (iPhone 6.7").
 *
 * Usage: node capture.js
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const SESSION_FILE = path.join(process.env.HOME, 'Downloads/ritovo-session.json');
const OUTPUT_DIR   = path.join(__dirname, 'raw');
const APP_URL      = 'https://bandapp-six.vercel.app';
const STORAGE_KEY  = 'sb-yhnoxgoibtbwcavzwddj-auth-token';

// App Store required sizes  [name, width, height, deviceScaleFactor]
const SIZES = [
  ['6_5inch', 414, 896, 3],   // → 1242 × 2688
  ['6_7inch', 430, 932, 3],   // → 1290 × 2796  (closest puppeteer can hit; trimmed by format script)
];

// Screens to capture  [filename-stem, nav-function-arg, extra-setup-js]
const SCREENS = [
  ['01-signin',       null,           null],                                      // auth screen — no login needed
  ['02-dashboard',    'dashboard',    null],
  ['03-setlists',     'setlists',     null],
  ['04-library',      'library',      null],
  ['05-rehearsals',   'rehearsals',   null],
  ['06-calendar',     'calendar',     'setCalView("compact"); renderCal()'],
  ['07-concerts',     'concerts',     null],
  ['08-members',      'members',      null],
  ['09-bandprofile',  'bandprofile',  null],
  ['10-myprofile',    'myprofile',    'populateMpPage(); setTimeout(()=>{ const el=document.querySelector(".mp-avail-section,#mpAvailSection,[data-section=avail]"); if(el)el.scrollIntoView(); },800)'],
];

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const sessionJson = fs.readFileSync(SESSION_FILE, 'utf8');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const [sizeName, vpW, vpH, dpr] of SIZES) {
    console.log(`\n📐 Size: ${sizeName} (${vpW}x${vpH} @ ${dpr}x → ${vpW*dpr}x${vpH*dpr})`);
    const page = await browser.newPage();
    await page.setViewport({ width: vpW, height: vpH, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });

    // ── Screen 01: sign-in (no session) ──────────────────────────────────
    console.log('  📸 01-signin');
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `01-signin_${sizeName}.png`), fullPage: false });

    // ── Inject session and reload ─────────────────────────────────────────
    await page.evaluate((key, val) => localStorage.setItem(key, val), STORAGE_KEY, sessionJson);
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    // Wait for appLoader to hide (initApp() complete) — up to 20 seconds
    await page.waitForFunction(
      () => {
        const el = document.getElementById('appLoader');
        return el && el.style.display === 'none';
      },
      { timeout: 20000 }
    ).catch(() => console.warn('  ⚠ appLoader did not hide — proceeding anyway'));
    await sleep(1000); // extra settle time for renders
    // Hide UI chrome not needed for App Store screenshots
    await page.evaluate(() => {
      const fab = document.getElementById('feedbackFab');
      if (fab) fab.style.display = 'none';
    });

    // ── Remaining screens ─────────────────────────────────────────────────
    for (const [stem, navTarget, extraJs] of SCREENS.slice(1)) {
      console.log(`  📸 ${stem}`);
      await page.evaluate(target => nav(target), navTarget);
      if (extraJs) await page.evaluate(extraJs);
      await sleep(1200);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${stem}_${sizeName}.png`), fullPage: false });
    }

    await page.close();
  }

  await browser.close();
  console.log(`\n✅ All screenshots saved to appstore-assets/raw/`);
})();
