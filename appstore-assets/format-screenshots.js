/**
 * Ritovo App Store Screenshot Formatter
 *
 * Usage:
 *   node format-screenshots.js
 *
 * Requirements:
 *   npm install sharp   (run once in this folder)
 *
 * Put your raw simulator screenshots in:
 *   appstore-assets/raw/
 *   Name them: 01-dashboard.png, 02-setlist.png, etc.
 *
 * Output goes to:
 *   appstore-assets/output/
 *
 * Apple-required sizes produced:
 *   - 1242 × 2688 px  (iPhone 6.5" — Xs Max / 11 Pro Max)
 *   - 1284 × 2778 px  (iPhone 6.7" — 14 Plus / 15 Plus)
 */

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────

const SIZES = [
  { name: '6_5inch', w: 1242, h: 2688 },  // 6.5" required
  { name: '6_7inch', w: 1284, h: 2778 },  // 6.7" required
];

// Brand colours (dark theme)
const BG_COLOR   = { r: 17,  g: 17,  b: 22  };  // #111116
const CARD_COLOR = { r: 28,  g: 28,  b: 38  };  // #1C1C26

// Optional: captions to overlay on each screenshot
// Key = filename stem (without extension)
const CAPTIONS = {
  '01-dashboard'   : 'Everything at a glance',
  '02-setlist'     : 'Your set list, beautifully organised',
  '03-library'     : 'Full song library with keys & links',
  '04-rehearsals'  : 'Schedule & track rehearsals',
  '05-calendar'    : 'Group calendar in one view',
  '06-concerts'    : 'Manage upcoming gigs',
  '07-members'     : 'Know your band',
  '08-profile'     : 'Group profile & social links',
  '09-availability': 'Availability at a glance',
  '10-signin'      : 'Get started in seconds',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const RAW_DIR    = path.join(__dirname, 'raw');
const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function getPngFiles() {
  return fs.readdirSync(RAW_DIR)
    .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    .sort();
}

async function formatOne(file, size) {
  const inputPath  = path.join(RAW_DIR, file);
  const stem       = path.basename(file, path.extname(file));
  const outputPath = path.join(OUTPUT_DIR, `${stem}_${size.name}.png`);

  const meta   = await sharp(inputPath).metadata();
  const srcW   = meta.width;
  const srcH   = meta.height;

  // Scale the screenshot to fit within the target canvas (preserve aspect ratio)
  const PADDING_TOP    = Math.round(size.h * 0.06);  // 6% top padding
  const PADDING_BOTTOM = Math.round(size.h * 0.04);  // 4% bottom
  const PADDING_SIDE   = Math.round(size.w * 0.04);  // 4% side
  const CAPTION_H      = CAPTIONS[stem] ? Math.round(size.h * 0.07) : 0;

  const availW = size.w - PADDING_SIDE * 2;
  const availH = size.h - PADDING_TOP - PADDING_BOTTOM - CAPTION_H;

  const scale  = Math.min(availW / srcW, availH / srcH);
  const fitW   = Math.round(srcW * scale);
  const fitH   = Math.round(srcH * scale);

  const left   = Math.round((size.w - fitW) / 2);
  const top    = PADDING_TOP;

  // Resize the screenshot
  const screenshotBuf = await sharp(inputPath)
    .resize(fitW, fitH, { fit: 'fill' })
    .png()
    .toBuffer();

  // Build caption SVG if defined
  let captionOverlay = [];
  const caption = CAPTIONS[stem];
  if (caption) {
    const captionY = top + fitH + Math.round(CAPTION_H * 0.55);
    const fontSize = Math.round(size.w * 0.045);
    const svg = Buffer.from(`
      <svg width="${size.w}" height="${size.h}" xmlns="http://www.w3.org/2000/svg">
        <text
          x="${size.w / 2}"
          y="${captionY}"
          text-anchor="middle"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="${fontSize}"
          font-weight="600"
          fill="#F0F0F8"
        >${caption}</text>
      </svg>`);
    captionOverlay = [{ input: svg, top: 0, left: 0 }];
  }

  // Compose: background + screenshot + caption
  await sharp({
    create: {
      width:      size.w,
      height:     size.h,
      channels:   3,
      background: BG_COLOR,
    },
  })
    .composite([
      { input: screenshotBuf, top, left },
      ...captionOverlay,
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`  ✓ ${outputPath}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const files = getPngFiles();
  if (!files.length) {
    console.error('No PNG/JPG files found in appstore-assets/raw/');
    console.error('Add your simulator screenshots there and re-run.');
    process.exit(1);
  }

  console.log(`Found ${files.length} screenshot(s). Generating ${files.length * SIZES.length} output files...\n`);

  for (const file of files) {
    console.log(`Processing ${file}...`);
    for (const size of SIZES) {
      await formatOne(file, size);
    }
  }

  console.log(`\n✅ Done. Output in: appstore-assets/output/`);
})();
