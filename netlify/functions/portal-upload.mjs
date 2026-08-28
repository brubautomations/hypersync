// ============================================================
// /api/portal-upload — presigned R2 upload URLs (photos/videos)
// The browser asks here for permission, then PUTs the file
// STRAIGHT to Cloudflare R2 — no size squeeze through Netlify.
//
// Netlify env needed (all from your Cloudflare dashboard):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_BUCKET, R2_PUBLIC_BASE  (e.g. https://media.hypersync.live
//   or the bucket's public r2.dev URL, no trailing slash)
// Bucket CORS must allow PUT from https://www.hypersync.live
// Not configured yet? The endpoint says so and the portal
// falls back to paste-a-URL. Nothing breaks.
// ============================================================
import crypto from "node:crypto";
import { getSessionFromRequest, json, err } from "./_shared.mjs";

const {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE,
} = process.env;

const sha256hex = (s) => crypto.createHash("sha256").update(s).digest("hex");
const hmac = (key, s) => crypto.createHmac("sha256", key).update(s).digest();

// AWS SigV4 presigned PUT for R2's S3 endpoint
function presignPut(key, expires = 600) {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;

  const q = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${R2_ACCESS_KEY_ID}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  });
  const path = `/${R2_BUCKET}/${key}`;
  const canonical = ["PUT", path, q.toString(), `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonical)].join("\n");
  let k = hmac("AWS4" + R2_SECRET_ACCESS_KEY, date);
  for (const part of ["auto", "s3", "aws4_request"]) k = hmac(k, part);
  const sig = crypto.createHmac("sha256", k).update(toSign).digest("hex");
  return `https://${host}${path}?${q.toString()}&X-Amz-Signature=${sig}`;
}

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);
  const user = getSessionFromRequest(req);
  if (!user || !user.portal || !user.artist_id) return err("Sign in first", 401);
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE) {
    return err("Uploads not configured yet", 503);
  }

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }
  const type = String(body?.type || "");
  const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"];
  if (!okTypes.includes(type)) return err("Unsupported file type");

  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }[type];
  const key = `portal/${user.artist_id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

  return json({
    ok: true,
    upload_url: presignPut(key),
    public_url: `${R2_PUBLIC_BASE.replace(/\/$/, "")}/${key}`,
  });
}
