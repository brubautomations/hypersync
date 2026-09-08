// netlify/functions/portal-upload.mjs
//
// Hands a signed-in artist a short-lived URL to upload a photo or video to.
// The file goes browser to storage directly, so there is no size ceiling
// from the function.
//
// The portal has its own bucket, kept separate from song submissions.
//
// Netlify environment variables required:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
//   R2_PORTAL_BUCKET        the portal's own bucket name
//   R2_PORTAL_PUBLIC_BASE   that bucket's public URL, no trailing slash
//
// No npm packages. Request signing is done inline.
//
// EDIT ONLY THE CONFIG BLOCK BELOW.

const CONFIG = {
  PREFIX: "portal/",
  MAX_BYTES: 500 * 1024 * 1024,     // 500MB, enough for a long video
  URL_TTL_SECONDS: 900,             // 15 minutes to finish the upload

  ALLOWED: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  },
};

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

const hex = (buf) => Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");

async function sha256hex(text) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text))));
}

const encodeKey = (key) => key.split("/").map(encodeURIComponent).join("/");

async function presignPut(objectKey, expires) {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PORTAL_BUCKET;

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${encodeKey(objectKey)}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;

  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });

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

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  // Only a signed-in artist gets an upload slot.
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth)) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const bucket = process.env.R2_PORTAL_BUCKET;
  const publicBase = process.env.R2_PORTAL_PUBLIC_BASE;

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY || !bucket || !publicBase) {
    return Response.json({ error: "Uploads are not configured yet." }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const type = String(body?.type || "");
  const size = Number(body?.size || 0);

  const ext = CONFIG.ALLOWED[type];
  if (!ext) {
    return Response.json(
      { error: "That file type isn't supported. Use JPG, PNG, WEBP, GIF, MP4, MOV or WEBM." },
      { status: 400 }
    );
  }

  if (size && size > CONFIG.MAX_BYTES) {
    return Response.json(
      { error: "File is too large. Maximum is " + Math.round(CONFIG.MAX_BYTES / 1048576) + "MB." },
      { status: 400 }
    );
  }

  const objectKey = CONFIG.PREFIX + id() + "." + ext;

  return Response.json(
    {
      upload_url: await presignPut(objectKey, CONFIG.URL_TTL_SECONDS),
      public_url: publicBase + "/" + encodeKey(objectKey),
      content_type: type,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
};

export const config = { path: "/api/portal-upload" };
