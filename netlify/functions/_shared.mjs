// ============================================================
// HYPERSYNC — shared server helpers
// Secrets live ONLY here (Netlify environment variables).
// Nothing in /src ever sees a token.
// ============================================================
import crypto from "node:crypto";

const AT_TOKEN = process.env.AIRTABLE_TOKEN;
const AT_BASE = process.env.AIRTABLE_BASE_ID;
const SESSION_SECRET = process.env.SESSION_SECRET;

export const TABLES = {
  NEWS: "NEWS",
  ARTISTS: "tbllu3uZBqUqXO5Tj",
  POSTS: "tblDrRMI2x2125VPk",
  SCHEDULE: "tble4tAuGTrZkE4jv",
  ANNOUNCEMENTS: "tblhstxZnteZHFjlc",
  DMS: "tblbLfL7ie6e9i8PM",
  FAN_CREDITS: "tblK8DlvXOPt0R6FB",
  CREDIT_PURCHASES: "CREDIT_PURCHASES",
  MERCH: "MERCH",
  CAMPAIGNS: "CAMPAIGNS",
};

const AT_HEADERS = {
  Authorization: `Bearer ${AT_TOKEN}`,
  "Content-Type": "application/json",
};

// ── Airtable: list with pagination ──────────────────────────
export async function atList(table, params = {}) {
  const records = [];
  let offset = null;
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(table)}`
    );
    url.searchParams.set("pageSize", "100");
    for (const [k, v] of Object.entries(params)) {
      if (k === "sort") {
        v.forEach((s, i) => {
          url.searchParams.set(`sort[${i}][field]`, s.field);
          url.searchParams.set(`sort[${i}][direction]`, s.direction);
        });
      } else if (v != null) url.searchParams.set(k, String(v));
    }
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: AT_HEADERS });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    for (const r of data.records || [])
      records.push({ id: r.id, created_at: r.createdTime, ...r.fields });
    offset = data.offset || null;
  } while (offset);
  return records;
}

export async function atCreate(table, fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(table)}`,
    { method: "POST", headers: AT_HEADERS, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) throw new Error(`upstream create ${res.status}`);
  return res.json();
}

export async function atUpdate(table, id, fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(table)}/${id}`,
    { method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) throw new Error(`upstream update ${res.status}`);
  return res.json();
}

// ── Sessions: HMAC-signed, stateless ────────────────────────
export function signSession(user) {
  const payload = Buffer.from(
    JSON.stringify({ ...user, iat: Date.now() })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token) {
  try {
    const [payload, sig] = String(token || "").split(".");
    if (!payload || !sig) return null;
    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(payload)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const user = JSON.parse(Buffer.from(payload, "base64url").toString());
    // 30-day expiry
    if (Date.now() - user.iat > 30 * 24 * 60 * 60 * 1000) return null;
    return user;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  return verifySession(auth.replace(/^Bearer\s+/i, ""));
}

// ── Response helpers ─────────────────────────────────────────
export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

export const err = (message, status = 400) => json({ error: message }, status);

// Escape single quotes for filterByFormula
export const esc = (s) => String(s).replace(/'/g, "\\'");
