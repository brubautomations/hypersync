// netlify/functions/card.js
//
// Takes a photo and a word, returns the photo with the word across it.
//
//   /api/card?img=<image url>&word=CRITICISM
//
// The word is turned into vector outlines from a bundled font, so it never
// depends on whatever fonts the server happens to have. The logo underneath
// is fetched from the site and cached.
//
// Needs in package.json: sharp, opentype.js
// Needs in netlify.toml: included_files for the fonts folder
// Needs the file:         netlify/functions/fonts/Anton-Regular.ttf
//
// EDIT ONLY THE CONFIG BLOCK BELOW.

import sharp from "sharp";
import opentype from "opentype.js";
import { readFileSync } from "fs";
import { join } from "path";

const CONFIG = {
  SIZE: 1080,                 // Instagram square
  WORD_COLOR: "#FFD400",      // HYPERSYNC yellow
  WORD_MAX: 150,              // biggest the word ever gets
  SIDE_PADDING: 90,           // keeps the word off the edges
  FONT: "netlify/functions/fonts/Anton-Regular.ttf",

  // Logo sits under the word. Put the file in your public folder so it
  // deploys with the site, then point this at it.
  LOGO_URL: "https://hypersync.live/card-logo.png",
  LOGO_WIDTH: 380,            // how wide the logo sits on the 1080 card
  LOGO_BOTTOM: 70,            // gap from the bottom edge

  WORD_BASELINE: 260,         // word sits this far up from the bottom
};

let font = null;

function loadFont() {
  if (font) return font;
  const buf = readFileSync(join(process.cwd(), CONFIG.FONT));
  font = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
  return font;
}

// Lays out one line of text as SVG path data, centred, scaled to fit.
function line(text, centreX, baselineY, maxSize, maxWidth, letterSpacing) {
  const f = loadFont();
  const spacing = letterSpacing || 0;

  let size = maxSize;
  let width = f.getAdvanceWidth(text, size) + spacing * (text.length - 1);

  if (width > maxWidth) {
    size = Math.floor(size * (maxWidth / width));
    width = f.getAdvanceWidth(text, size) + spacing * (text.length - 1);
  }

  let x = centreX - width / 2;
  const parts = [];

  for (const ch of text) {
    parts.push(f.getPath(ch, x, baselineY, size).toPathData(2));
    x += f.getAdvanceWidth(ch, size) + spacing;
  }

  return parts.join(" ");
}

function overlay(word) {
  const w = CONFIG.SIZE;
  const inner = w - CONFIG.SIDE_PADDING * 2;
  const text = String(word || "").toUpperCase().slice(0, 40);

  const wordPath = text
    ? `<path d="${line(text, w / 2, w - CONFIG.WORD_BASELINE, CONFIG.WORD_MAX, inner, 2)}" fill="${CONFIG.WORD_COLOR}"/>`
    : "";

  return Buffer.from(`
<svg width="${w}" height="${w}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0"/>
      <stop offset="55%"  stop-color="#000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${Math.round(w * 0.42)}" width="${w}" height="${Math.round(w * 0.58)}" fill="url(#fade)"/>
  ${wordPath}
</svg>`);
}

let logoCache = null;

async function logo() {
  if (logoCache !== null) return logoCache;
  try {
    const res = await fetch(CONFIG.LOGO_URL);
    if (!res.ok) throw new Error(String(res.status));
    logoCache = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width: CONFIG.LOGO_WIDTH })
      .png()
      .toBuffer();
  } catch (e) {
    logoCache = false;        // card still works without it
  }
  return logoCache;
}

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const img = params.get("img");
  const word = params.get("word") || "";

  if (!img || !/^https:\/\//.test(img)) {
    return new Response("bad image url", { status: 400 });
  }

  try {
    const src = await fetch(img);
    if (!src.ok) return new Response("could not fetch image", { status: 502 });

    const input = Buffer.from(await src.arrayBuffer());

    const layers = [{ input: overlay(word), top: 0, left: 0 }];

    const mark = await logo();
    if (mark) {
      const meta = await sharp(mark).metadata();
      layers.push({
        input: mark,
        left: Math.round((CONFIG.SIZE - meta.width) / 2),
        top: CONFIG.SIZE - meta.height - CONFIG.LOGO_BOTTOM,
      });
    }

    const out = await sharp(input)
      .resize(CONFIG.SIZE, CONFIG.SIZE, { fit: "cover", position: "attention" })
      .composite(layers)
      .jpeg({ quality: 90 })
      .toBuffer();

    return new Response(out, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response("card failed: " + e.message, { status: 500 });
  }
};

export const config = { path: "/api/card" };
