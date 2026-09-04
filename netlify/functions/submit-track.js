// netlify/functions/submit-track.js
//
// Writes the submission row into Airtable. The audio and cover art are
// already in R2 by this point, so they arrive here as URLs and Airtable
// fetches them into the attachment fields.
//
// Also serves GET /api/verify?t=<token> to tick the Verified box.
//
// Netlify environment variables required:
//   RADIO_TOKEN     Airtable personal access token (needs write scope)
//   RADIO_BASE_ID   the radio base id
//
// EDIT ONLY THE CONFIG BLOCK BELOW.

const CONFIG = {
  TABLE: "SUBMISSIONS",
  TERMS_TABLE: "TERMS",

  F_NAME: "Submitter Name",
  F_EMAIL: "Submitter Email",
  F_AS: "Submitting As",
  F_ARTIST: "Artist Name",
  F_TITLE: "Track Title",
  F_AUDIO: "Audio",
  F_COVER: "Cover Art",
  F_LINKS: "Profile Links",
  F_COUNTRY: "Country",
  F_PRO: "PRO/CMO Affiliation",
  F_TERMS: "Terms",
  F_STATUS: "Status",
  F_VERIFIED: "Verified",
  F_TOKEN: "Verify Token",

  STATUS_NEW: "Pending",
};

const AIR = "https://api.airtable.com/v0";

function token() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(s, max) {
  return String(s == null ? "" : s).trim().slice(0, max || 500);
}

async function activeTermsId(pat, base) {
  const url = new URL(`${AIR}/${base}/${encodeURIComponent(CONFIG.TERMS_TABLE)}`);
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("filterByFormula", "{Active}");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.records && json.records[0] ? json.records[0].id : null;
}

async function createSubmission(req, pat, base) {
  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body) return Response.json({ error: "Bad request." }, { status: 400 });

  const email = clean(body.email, 200);
  const name = clean(body.name, 200);
  const artist = clean(body.artist, 200);
  const title = clean(body.title, 200);
  const audioUrl = clean(body.audioUrl, 800);

  if (!email || !email.includes("@"))
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  if (!name || !artist || !title)
    return Response.json({ error: "Name, artist name and track title are required." }, { status: 400 });
  if (!audioUrl)
    return Response.json({ error: "The audio file did not finish uploading." }, { status: 400 });
  if (body.agreed !== true)
    return Response.json({ error: "You must agree to the terms to submit." }, { status: 400 });

  const termsId = await activeTermsId(pat, base);
  if (!termsId)
    return Response.json({ error: "Submissions are closed right now." }, { status: 503 });

  const verify = token();

  const fields = {};
  fields[CONFIG.F_NAME] = name;
  fields[CONFIG.F_EMAIL] = email;
  fields[CONFIG.F_ARTIST] = artist;
  fields[CONFIG.F_TITLE] = title;
  fields[CONFIG.F_AUDIO] = [{ url: audioUrl }];
  fields[CONFIG.F_LINKS] = clean(body.links, 2000);
  fields[CONFIG.F_COUNTRY] = clean(body.country, 100);
  fields[CONFIG.F_PRO] = clean(body.pro, 200);
  fields[CONFIG.F_TERMS] = [termsId];
  fields[CONFIG.F_STATUS] = CONFIG.STATUS_NEW;
  fields[CONFIG.F_VERIFIED] = false;
  fields[CONFIG.F_TOKEN] = verify;

  if (body.submittingAs) fields[CONFIG.F_AS] = clean(body.submittingAs, 200);
  if (body.coverUrl) fields[CONFIG.F_COVER] = [{ url: clean(body.coverUrl, 800) }];

  const res = await fetch(`${AIR}/${base}/${encodeURIComponent(CONFIG.TABLE)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });

  if (!res.ok) {
    return Response.json(
      { error: "Could not save the submission.", detail: await res.text() },
      { status: 502 }
    );
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

async function verifyToken(req, pat, base) {
  const t = new URL(req.url).searchParams.get("t") || "";
  const page = (msg) =>
    new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HYPERSYNC</title>
<meta http-equiv="refresh" content="4; url=/radio"></head>
<body style="background:#0b0b0d;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p style="max-width:32rem;text-align:center;line-height:1.6">${msg}</p></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    );

  if (!/^[a-f0-9]{48}$/.test(t)) return page("That verification link is not valid.");

  const url = new URL(`${AIR}/${base}/${encodeURIComponent(CONFIG.TABLE)}`);
  url.searchParams.set("maxRecords", "1");
  url.searchParams.set(
    "filterByFormula",
    `{${CONFIG.F_TOKEN}} = "${t}"`
  );

  const find = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
  if (!find.ok) return page("Something went wrong. Please try again later.");

  const rec = (await find.json()).records[0];
  if (!rec) return page("That verification link is not valid or has already been used.");

  const fields = {};
  fields[CONFIG.F_VERIFIED] = true;
  fields[CONFIG.F_TOKEN] = "";

  await fetch(`${AIR}/${base}/${encodeURIComponent(CONFIG.TABLE)}/${rec.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  return page("Thanks, your submission is confirmed. We'll be in touch once it has been reviewed.");
}

export default async (req) => {
  const pat = process.env.RADIO_TOKEN;
  const base = process.env.RADIO_BASE_ID;

  if (!pat || !base) {
    return Response.json(
      { error: "RADIO_TOKEN and RADIO_BASE_ID are not set." },
      { status: 500 }
    );
  }

  const path = new URL(req.url).pathname;

  if (path === "/api/verify") return verifyToken(req, pat, base);
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });

  return createSubmission(req, pat, base);
};

export const config = { path: ["/api/submit-track", "/api/verify"] };
