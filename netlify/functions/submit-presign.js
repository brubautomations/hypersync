// netlify/functions/submit-presign.js
//
// Hands the browser a short-lived URL it can PUT the file to.
// The file goes straight from the visitor to R2, so it never passes
// through a function body (which caps out well below MP3 size).
//
// No npm packages. The request signing is done inline below.
//
// Netlify environment variables required:
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET
//   R2_PUBLIC_BASE     public URL prefix for the bucket, no trailing slash
//
// EDIT ONLY THE CONFIG BLOCK BELOW.

const CONFIG = {
  PENDING_PREFIX: "submissions/pending/",
  MAX_BYTES: 25 * 1024 * 1024,          // 25MB ceiling on a submitted file
  URL_TTL_SECONDS: 600,                 // how long the upload slot stays valid

  // MP3 audio and PNG artwork only. Nothing else is accepted.
  ALLOWED: {
    "audio/mpeg": "mp3",
    "image/png": "png",
  },
};

// --- signing helpers -------------------------------------------------------

const enc = new TextEncoder();

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

function hex(buf) {
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256hex(text) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return hex(new Uint8Array(d));
}

function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function presignPut(opts) {
  const { accountId, accessKeyId, secretAccessKey, bucket, objectKey, expires } = opts;

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${encodeKey(objectKey)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const scope = `${dateStamp}/auto/s3/aws4_request`;

  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });

  // Query parameters must be sorted for the canonical request.
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    "PUT",
    path,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256hex(canonicalRequest),
  ].join("\n");

  let key = await hmac("AWS4" + secretAccessKey, dateStamp);
  key = await hmac(key, "auto");
  key = await hmac(key, "s3");
  key = await hmac(key, "aws4_request");
  const signature = hex(await hmac(key, stringToSign));

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// --- handler ---------------------------------------------------------------

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    return Response.json(
      { error: "R2 environment variables are not set." },
      { status: 500 }
    );
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const type = String(body?.contentType || "");
  const size = Number(body?.size || 0);

  const ext = CONFIG.ALLOWED[type];
  if (!ext) {
    return Response.json(
      { error: "Only MP3 audio and PNG images are accepted." },
      { status: 400 }
    );
  }
  if (!size || size > CONFIG.MAX_BYTES) {
    return Response.json(
      { error: "File is too large. Maximum is " + Math.round(CONFIG.MAX_BYTES / 1048576) + "MB." },
      { status: 400 }
    );
  }

  const objectKey = CONFIG.PENDING_PREFIX + id() + "." + ext;

  const uploadUrl = await presignPut({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    objectKey,
    expires: CONFIG.URL_TTL_SECONDS,
  });

  return Response.json(
    {
      uploadUrl,
      contentType: type,
      publicUrl: publicBase + "/" + objectKey,
      key: objectKey,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
};

export const config = { path: "/api/submit-presign" };
