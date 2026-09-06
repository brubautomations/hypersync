// netlify/functions/card.js
//
// Takes a photo and a word, returns the photo with the word across it.
//
//   /api/card?img=<image url>&word=CRITICISM
//
// Used by the Instagram poster, which hands Instagram this URL instead of
// the bare photo. Square crop, dark gradient at the bottom, word over it.
//
// Needs "sharp" in package.json dependencies. Netlify installs it at build.
//
// EDIT ONLY THE CONFIG BLOCK BELOW.

import sharp from "sharp";

const CONFIG = {
  SIZE: 1080,              // Instagram square
  WORD_COLOR: "#FFD400",   // HYPERSYNC yellow
  MAX_CHARS: 22,           // longer words get shrunk to fit
  FOOTER: "HYPERSYNC.LIVE",
};

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function overlay(word) {
  const w = CONFIG.SIZE;
  const text = esc(word.toUpperCase()).slice(0, 40);

  // Shrink the type as the word gets longer so it always fits the width.
  const size = Math.round(
    Math.min(150, (w * 1.7) / Math.max(text.length, 6))
  );

  return Buffer.from(`
<svg width="${w}" height="${w}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0"/>
      <stop offset="55%"  stop-color="#000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.92"/>
    </linearGradient>
  </defs>

  <rect x="0" y="${w * 0.45}" width="${w}" height="${w * 0.55}" fill="url(#fade)"/>

  <text x="${w / 2}" y="${w - 150}"
        font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"
        font-size="${size}" font-weight="bold"
        fill="${CONFIG.WORD_COLOR}" text-anchor="middle"
        letter-spacing="2">${text}</text>

  <text x="${w / 2}" y="${w - 70}"
        font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"
        font-size="30" font-weight="bold"
        fill="#ffffff" fill-opacity="0.85" text-anchor="middle"
        letter-spacing="6">${CONFIG.FOOTER}</text>
</svg>`);
}

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const img = params.get("img");
  const word = params.get("word");

  if (!img || !/^https:\/\//.test(img)) {
    return new Response("bad image url", { status: 400 });
  }

  try {
    const src = await fetch(img);
    if (!src.ok) return new Response("could not fetch image", { status: 502 });

    const input = Buffer.from(await src.arrayBuffer());

    let pipeline = sharp(input)
      .resize(CONFIG.SIZE, CONFIG.SIZE, { fit: "cover", position: "attention" });

    if (word) {
      pipeline = pipeline.composite([{ input: overlay(word), top: 0, left: 0 }]);
    }

    const out = await pipeline.jpeg({ quality: 90 }).toBuffer();

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
