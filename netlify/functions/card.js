// netlify/functions/card.js
//
// Takes a photo and a word, returns the photo with the word across it.
//
//   /api/card?img=<image url>&word=CRITICISM
//
// The word is turned into vector outlines from a bundled font, so it never
// depends on whatever fonts the server happens to have. That's what fixed
// the empty boxes.
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
  FOOTER: "HYPERSYNC.LIVE",
  FOOTER_SIZE: 30,
  FONT: "netlify/functions/fonts/Anton-Regular.ttf",
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
    ? `<path d="${line(text, w / 2, w - 150, CONFIG.WORD_MAX, inner, 2)}" fill="${CONFIG.WORD_COLOR}"/>`
    : "";

  const footPath =
    `<path d="${line(CONFIG.FOOTER, w / 2, w - 70, CONFIG.FOOTER_SIZE, inner, 7)}" fill="#ffffff" fill-opacity="0.85"/>`;

  return Buffer.from(`
<svg width="${w}" height="${w}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0"/>
      <stop offset="55%"  stop-color="#000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${Math.round(w * 0.45)}" width="${w}" height="${Math.round(w * 0.55)}" fill="url(#fade)"/>
  ${wordPath}
  ${footPath}
</svg>`);
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

    const out = await sharp(input)
      .resize(CONFIG.SIZE, CONFIG.SIZE, { fit: "cover", position: "attention" })
      .composite([{ input: overlay(word), top: 0, left: 0 }])
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
