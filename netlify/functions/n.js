/**
 * /n/<recordId>
 *
 * Crawlers read the meta tags and build the card.
 * People get redirected to the feed before the page paints.
 *
 * EDIT ONLY THE CONFIG BLOCK BELOW.
 */

const CONFIG = {
  TABLE: 'NEWS',
  FIELD_TITLE: 'Title',
  FIELD_SUMMARY: 'Summary',
  FIELD_IMAGE: 'Image',

  SITE: 'https://hypersync.live',
  LANDING: '/feed',

  SITE_NAME: 'HYPERSYNC',
  FALLBACK_IMAGE: 'https://hypersync.live/og-default.jpg'
};

const API_KEY = process.env.AIRTABLE_KEY;
const BASE_ID = process.env.AIRTABLE_BASE;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page(title, description, image, landing) {
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
<meta property="og:url" content="${esc(landing)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(landing)}">
<link rel="canonical" href="${esc(landing)}">
</head>
<body><script>location.replace(${JSON.stringify(landing)});</script></body>
</html>`;
}

export default async (request) => {
  const landing = CONFIG.SITE + CONFIG.LANDING;
  const id = new URL(request.url).pathname.split('/').filter(Boolean).pop();

  if (!id || !id.startsWith('rec')) {
    return Response.redirect(landing, 302);
  }

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(CONFIG.TABLE)}/${id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    if (!res.ok) return Response.redirect(landing, 302);

    const f = (await res.json()).fields || {};
    const title = f[CONFIG.FIELD_TITLE] || CONFIG.SITE_NAME;
    const desc = f[CONFIG.FIELD_SUMMARY] || '';
    const image = f[CONFIG.FIELD_IMAGE] || CONFIG.FALLBACK_IMAGE;

    return new Response(page(title, desc, image, landing), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=600'
      }
    });
  } catch (e) {
    return Response.redirect(landing, 302);
  }
};

export const config = { path: '/n/*' };
