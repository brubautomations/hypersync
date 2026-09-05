// netlify/functions/sort-submissions.js
//
// Runs every 5 minutes and clears out SUBMISSIONS.
//
//   Status = Approved
//     → file moves to submissions/approved/
//     → row created in SONGS-V2 with artist, title, URL
//     → record written to SUBMISSION_LOG
//     → SUBMISSIONS row removed
//
//   Status = Rejected or Withdrawn
//     → file moves to submissions/rejected/
//     → record written to SUBMISSION_LOG
//     → SUBMISSIONS row removed
//     → R2 lifecycle rule deletes the file after 30 days
//
//   Status = Pending or Disputed
//     → left alone, still waiting on you
//
// SUBMISSIONS is a work queue. SUBMISSION_LOG is the permanent record:
// who submitted what, when, which terms version they accepted, and what
// you decided. It holds no audio, so it costs nothing to keep forever.
//
// Netlify environment variables required:
//   RADIO_TOKEN, RADIO_BASE_ID
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE
//
// EDIT ONLY THE CONFIG BLOCK BELOW.

const CONFIG = {
  TABLE: "SUBMISSIONS",
  SONGS_TABLE: "SONGS-V2",
  LOG_TABLE: "SUBMISSION_LOG",
  TERMS_TABLE: "TERMS",

  // SUBMISSIONS fields
  F_STATUS: "Status",
  F_URL: "File URL",
  F_ARTIST: "Artist Name",
  F_TITLE: "Track Title",
  F_NAME: "Submitter Name",
  F_EMAIL: "Submitter Email",
  F_AS: "Submitting As",
  F_COUNTRY: "Country",
  F_PRO: "PRO/CMO Affiliation",
  F_LINKS: "Profile Links",
  F_TERMS: "Terms",
  F_VERIFIED: "Verified",

  // SONGS-V2 fields
  S_ARTIST: "Artist",
  S_TITLE: "Title",
  S_URL: "File URL",
  S_PLAYED: "Played",

  // SUBMISSION_LOG fields
  L_TITLE: "Track Title",
  L_ARTIST: "Artist Name",
  L_NAME: "Submitter Name",
  L_EMAIL: "Submitter Email",
  L_AS: "Submitting As",
  L_COUNTRY: "Country",
  L_PRO: "PRO/CMO Affiliation",
  L_LINKS: "Profile Links",
  L_TERMS: "Terms Version",
  L_VERIFIED: "Verified",
  L_OUTCOME: "Outcome",
  L_SUBMITTED: "Submitted At",
  L_DECIDED: "Decided At",
  L_FILE: "File URL",

  APPROVED_FOLDER: "submissions/approved/",
  REJECTED_FOLDER: "submissions/rejected/",

  APPROVE: ["Approved"],
  REJECT: ["Rejected", "Withdrawn"],

  BATCH: 50,
};

const AIR = "https://api.airtable.com/v0";
const enc = new TextEncoder();

// --- R2 signing ------------------------------------------------------------

async function hmac(key, data) {
  const k = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? enc.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

const hex = (buf) => Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");

async function sha256hex(text) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text))));
}

const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");

async function r2(method, objectKey, extraHeaders = {}) {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${encodeKey(objectKey)}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const payloadHash = await sha256hex("");

  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };

  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v).trim();

  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join("");
  const signedHeaders = names.join(";");

  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256hex(canonicalRequest)].join("\n");

  let key = await hmac("AWS4" + secretAccessKey, dateStamp);
  key = await hmac(key, "auto");
  key = await hmac(key, "s3");
  key = await hmac(key, "aws4_request");
  const signature = hex(await hmac(key, stringToSign));

  return fetch(`https://${host}${path}`, {
    method,
    headers: {
      ...headers,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
}

async function moveObject(fromKey, toKey) {
  const bucket = process.env.R2_BUCKET;

  const copy = await r2("PUT", toKey, {
    "x-amz-copy-source": `/${bucket}/${encodeKey(fromKey)}`,
  });
  if (!copy.ok) throw new Error(`copy ${copy.status}: ${await copy.text()}`);

  const del = await r2("DELETE", fromKey);
  if (!del.ok && del.status !== 404) throw new Error(`delete ${del.status}`);
}

// --- Airtable --------------------------------------------------------------

async function post(pat, base, table, records) {
  for (let i = 0; i < records.length; i += 10) {
    const res = await fetch(`${AIR}/${base}/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true }),
    });
    if (!res.ok) throw new Error(`${table} write failed ${res.status}: ${await res.text()}`);
  }
}

async function fetchFinished(pat, base) {
  const done = [...CONFIG.APPROVE, ...CONFIG.REJECT]
    .map((s) => `{${CONFIG.F_STATUS}} = "${s}"`)
    .join(", ");

  const url = new URL(`${AIR}/${base}/${encodeURIComponent(CONFIG.TABLE)}`);
  url.searchParams.set("pageSize", String(CONFIG.BATCH));
  url.searchParams.set("filterByFormula", `OR(${done})`);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
  if (!res.ok) throw new Error(`Airtable read failed: ${res.status}`);
  return (await res.json()).records || [];
}

// Terms rows are few; fetch them once so the log can store the version
// string rather than a link that could later be edited.
async function termsVersions(pat, base) {
  const map = {};
  try {
    const res = await fetch(
      `${AIR}/${base}/${encodeURIComponent(CONFIG.TERMS_TABLE)}?pageSize=100`,
      { headers: { Authorization: `Bearer ${pat}` } }
    );
    if (!res.ok) return map;
    for (const r of (await res.json()).records || []) {
      map[r.id] = r.fields.Version || "";
    }
  } catch { /* log the rest anyway */ }
  return map;
}

async function deleteRows(pat, base, ids) {
  for (let i = 0; i < ids.length; i += 10) {
    const qs = ids.slice(i, i + 10).map((id) => `records[]=${id}`).join("&");
    await fetch(`${AIR}/${base}/${encodeURIComponent(CONFIG.TABLE)}?${qs}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${pat}` },
    });
  }
}

// --- handler ---------------------------------------------------------------

export default async () => {
  const pat = process.env.RADIO_TOKEN;
  const base = process.env.RADIO_BASE_ID;
  const publicBase = process.env.R2_PUBLIC_BASE;

  if (!pat || !base || !publicBase) {
    return Response.json({ error: "Environment variables are not set." }, { status: 500 });
  }

  const rows = await fetchFinished(pat, base);
  if (!rows.length) return Response.json({ added: 0, logged: 0, cleared: 0, errors: [] });

  const versions = await termsVersions(pat, base);
  const decidedAt = new Date().toISOString();

  const newSongs = [];
  const logEntries = [];
  const clear = [];
  const errors = [];

  for (const row of rows) {
    const f = row.fields;
    const status = f[CONFIG.F_STATUS];
    const url = f[CONFIG.F_URL];
    if (!url) continue;

    const approved = CONFIG.APPROVE.includes(status);
    const folder = approved ? CONFIG.APPROVED_FOLDER : CONFIG.REJECTED_FOLDER;

    const currentKey = decodeURIComponent(String(url).replace(publicBase + "/", ""));
    const filename = currentKey.split("/").pop();
    const newKey = folder + filename;
    const newUrl = `${publicBase}/${encodeKey(newKey)}`;

    try {
      if (!currentKey.startsWith(folder)) await moveObject(currentKey, newKey);

      const termsIds = Array.isArray(f[CONFIG.F_TERMS]) ? f[CONFIG.F_TERMS] : [];

      const log = {};
      log[CONFIG.L_TITLE] = f[CONFIG.F_TITLE] || "";
      log[CONFIG.L_ARTIST] = f[CONFIG.F_ARTIST] || "";
      log[CONFIG.L_NAME] = f[CONFIG.F_NAME] || "";
      log[CONFIG.L_EMAIL] = f[CONFIG.F_EMAIL] || "";
      log[CONFIG.L_AS] = f[CONFIG.F_AS] || "";
      log[CONFIG.L_COUNTRY] = f[CONFIG.F_COUNTRY] || "";
      log[CONFIG.L_PRO] = f[CONFIG.F_PRO] || "";
      log[CONFIG.L_LINKS] = f[CONFIG.F_LINKS] || "";
      log[CONFIG.L_TERMS] = versions[termsIds[0]] || "";
      log[CONFIG.L_VERIFIED] = f[CONFIG.F_VERIFIED] === true;
      log[CONFIG.L_OUTCOME] = status;
      log[CONFIG.L_SUBMITTED] = row.createdTime;
      log[CONFIG.L_DECIDED] = decidedAt;
      log[CONFIG.L_FILE] = newUrl;
      logEntries.push({ fields: log });

      if (approved) {
        const song = {};
        song[CONFIG.S_ARTIST] = f[CONFIG.F_ARTIST] || "";
        song[CONFIG.S_TITLE] = f[CONFIG.F_TITLE] || "";
        song[CONFIG.S_URL] = newUrl;
        song[CONFIG.S_PLAYED] = true;
        newSongs.push({ fields: song });
      }

      clear.push(row.id);
    } catch (e) {
      errors.push(`${row.id}: ${e.message}`);
    }
  }

  // Nothing leaves SUBMISSIONS until it exists somewhere permanent.
  if (newSongs.length) await post(pat, base, CONFIG.SONGS_TABLE, newSongs);
  if (logEntries.length) await post(pat, base, CONFIG.LOG_TABLE, logEntries);
  if (clear.length) await deleteRows(pat, base, clear);

  return Response.json({
    added: newSongs.length,
    logged: logEntries.length,
    cleared: clear.length,
    errors,
  });
};

export const config = {
  path: "/api/sort-submissions",
  schedule: "*/5 * * * *",
};
