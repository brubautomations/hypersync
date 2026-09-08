// netlify/functions/p.mjs
//
// /p/<postId>
//
// The link an artist's post shares as. Facebook, Messenger, X, Discord,
// Viber and the rest read the tags below and draw a card with the photo,
// the artist and HYPERSYNC.LIVE. A person clicking it goes to the artist's
// page, where signing in is already handled.
//
// Netlify environment variables required:
//   AIRTABLE_TOKEN
//
// EDIT ONLY THE CONFIG BLOCK BELOW.

const CONFIG = {
  BASE_ID: "appTaRsXhsuOLHU3f",
  TABLE: "POSTS",

  // Confirm these against the POSTS table if a card comes out blank.
  F_CONTENT: "content",
  F_IMAGES: "image_urls",
  F_ARTIST_NAME: "artist_name",

  // POSTS stores the artist's name, not a record link, so the artist page
  // is found by matching that name in ARTIST.
  ARTIST_TABLE: "ARTIST",
  A_NAME: "name",

  SITE: "https://hypersync.live",
  FALLBACK: "/feed",
  SITE_NAME: "HYPERSYNC",
  FALLBACK_IMAGE: "https://hypersync.live/og-image.png",
};

const API_KEY = process.env.AIRTABLE_TOKEN;

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Posts can carry several languages in one field. The card shows the first
// readable chunk rather than the markup around it.
function firstLine(content) {
  const text = String(content || "")
    .replace(/\[[a-z]{2}\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 180 ? text.slice(0, 177).trimEnd() + "…" : text;
}

function page({ title, description, image, selfUrl, landing }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(CONFIG.SITE_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(selfUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
</head>
<body>
<script>location.replace(${JSON.stringify(landing)});</script>
<noscript><a href="${esc(landing)}">Continue to ${esc(CONFIG.SITE_NAME)}</a></noscript>
</body>
</html>`;
}

// POSTS holds a name; the page needs the ARTIST record id.
async function findArtist(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";

  const formula = `LOWER({${CONFIG.A_NAME}}) = "${clean.toLowerCase().replace(/"/g, '\\"')}"`;
  const url = `https://api.airtable.com/v0/${CONFIG.BASE_ID}/${encodeURIComponent(CONFIG.ARTIST_TABLE)}` +
    `?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!res.ok) return "";
    return (await res.json()).records?.[0]?.id || "";
  } catch {
    return "";
  }
}

export default async (request) => {
  const fallback = CONFIG.SITE + CONFIG.FALLBACK;
  const id = new URL(request.url).pathname.split("/").filter(Boolean).pop();

  if (!id || !id.startsWith("rec")) return Response.redirect(fallback, 302);

  const selfUrl = `${CONFIG.SITE}/p/${id}`;

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${CONFIG.BASE_ID}/${encodeURIComponent(CONFIG.TABLE)}/${id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    if (!res.ok) return Response.redirect(fallback, 302);

    const f = (await res.json()).fields || {};

    const artistName = f[CONFIG.F_ARTIST_NAME] || CONFIG.SITE_NAME;
    const body = firstLine(f[CONFIG.F_CONTENT]);

    // image_urls can be a list or a single string
    const raw = f[CONFIG.F_IMAGES];
    const first = Array.isArray(raw) ? raw[0] : String(raw || "").split(/[\s,]+/)[0];
    const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(first || "");
    const image = first && !isVideo ? first : CONFIG.FALLBACK_IMAGE;

    // Land on the artist's page when we can find it, the feed otherwise.
    const artistId = await findArtist(artistName);
    const landing = artistId ? `${CONFIG.SITE}/artists/${artistId}?post=${id}` : fallback;

    return new Response(
      page({
        title: `${artistName} on ${CONFIG.SITE_NAME}`,
        description: body,
        image,
        selfUrl,
        landing,
      }),
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      }
    );
  } catch (e) {
    return Response.redirect(fallback, 302);
  }
};

export const config = { path: "/p/*" };
