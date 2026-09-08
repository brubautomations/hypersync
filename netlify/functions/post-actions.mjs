// ============================================================
// /api/post-actions — likes and comments on artist posts
//   GET  ?post=recXXX             → { likes, liked, comments[] }
//   POST { post, like: true|false }   → like / unlike
//   POST { post, body }               → comment
// Reads are public. Writes need a session and a claimed handle,
// same rules as /api/threads.
//
// Stored in Airtable for now. When these move to Supabase, only the
// four helpers under "storage" change.
// ============================================================
import { getSessionFromRequest, json, err } from "./_shared.mjs";
import { lookupHandle } from "./handle.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

const CFG = {
  BASE_ID: "appTaRsXhsuOLHU3f",
  REACTIONS: "REACTIONS",
  COMMENTS: "COMMENTS",

  // REACTIONS fields
  R_POST: "post_id",
  R_USER: "user_id",

  // COMMENTS fields
  C_POST: "post_id",
  C_USER: "user_id",
  C_HANDLE: "handle",
  C_BODY: "body",

  MAX_COMMENTS: 100,
  MAX_LIKES_SCAN: 500,
};

const BANNED = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot",
  "puta", "putangina", "tangina", "tanginamo", "gago", "kantot", "bobo",
  "kys", "kill yourself",
];
const bannedRe = new RegExp("\\b(" + BANNED.join("|").replace(/ /g, "\\s+") + ")\\b", "i");
const linkRe = /(https?:\/\/|www\.)\S+/i;

const clean = (v, max) => String(v || "").trim().slice(0, max);

// ── the ban hammer, same list as chat and threads ──
async function isBanned(email) {
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/banned_users?user_id=eq." + encodeURIComponent(email) + "&select=user_id&limit=1",
    { headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY } }
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

// ── storage ────────────────────────────────────────────────
const AIR = "https://api.airtable.com/v0/";

async function at(path, opts = {}) {
  return fetch(AIR + CFG.BASE_ID + "/" + path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + AIRTABLE_TOKEN,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

const esc = (v) => String(v).replace(/"/g, '\\"');

async function listLikes(postId) {
  const formula = `{${CFG.R_POST}} = "${esc(postId)}"`;
  const res = await at(
    `${encodeURIComponent(CFG.REACTIONS)}?pageSize=100&maxRecords=${CFG.MAX_LIKES_SCAN}` +
    `&filterByFormula=${encodeURIComponent(formula)}`
  );
  if (!res.ok) return [];
  return (await res.json()).records || [];
}

async function listComments(postId) {
  const formula = `{${CFG.C_POST}} = "${esc(postId)}"`;
  const res = await at(
    `${encodeURIComponent(CFG.COMMENTS)}?pageSize=100&maxRecords=${CFG.MAX_COMMENTS}` +
    `&filterByFormula=${encodeURIComponent(formula)}`
  );
  if (!res.ok) return [];
  return ((await res.json()).records || []).map((r) => ({
    id: r.id,
    handle: r.fields[CFG.C_HANDLE] || "",
    body: r.fields[CFG.C_BODY] || "",
    created_at: r.createdTime,
  }));
}

// Returns "" on success, or Airtable's own complaint so the reason
// reaches the browser instead of a bare 502.
async function addRecord(table, fields) {
  const res = await at(encodeURIComponent(table), {
    method: "POST",
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  if (res.ok) return "";
  return `${table}: ${(await res.text()).slice(0, 300)}`;
}

async function deleteRecord(table, id) {
  const res = await at(`${encodeURIComponent(table)}/${id}`, { method: "DELETE" });
  return res.ok;
}

// ── handler ────────────────────────────────────────────────
export default async function handler(req) {
  if (!AIRTABLE_TOKEN) return err("Reactions not configured", 503);

  const q = new URL(req.url).searchParams;

  // ── READS (public) ──
  if (req.method === "GET") {
    const postId = clean(q.get("post"), 40);
    if (!postId) return err("Missing post");

    try {
      const user = getSessionFromRequest(req);
      const [likes, comments] = await Promise.all([listLikes(postId), listComments(postId)]);

      return json({
        likes: likes.length,
        liked: user ? likes.some((r) => r.fields[CFG.R_USER] === user.email) : false,
        comments,
      });
    } catch {
      return err("Temporarily unavailable", 502);
    }
  }

  if (req.method !== "POST") return err("Method not allowed", 405);

  // ── WRITES (session + handle) ──
  const user = getSessionFromRequest(req);
  if (!user) return err("Sign in to join in", 401);
  try { if (await isBanned(user.email)) return err("You can't post right now", 403); } catch {}

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }

  const postId = clean(body?.post, 40);
  if (!postId) return err("Missing post");

  try {
    // ── like / unlike ──
    if (typeof body.like === "boolean") {
      const mine = (await listLikes(postId)).filter((r) => r.fields[CFG.R_USER] === user.email);

      if (body.like && !mine.length) {
        const fields = {};
        fields[CFG.R_POST] = postId;
        fields[CFG.R_USER] = user.email;
        const why = await addRecord(CFG.REACTIONS, fields);
        if (why) return err(why, 502);
      }

      if (!body.like && mine.length) {
        for (const r of mine) await deleteRecord(CFG.REACTIONS, r.id);
      }

      const likes = await listLikes(postId);
      return json({ ok: true, likes: likes.length, liked: !!body.like });
    }

    // ── comment ──
    const text = clean(body?.body, 500);
    if (!text) return err("Say something first");
    if (linkRe.test(text)) return err("Links aren't allowed");
    if (bannedRe.test(text)) return err("Keep it friendly");

    let handle;
    try { handle = await lookupHandle(user.email); } catch { return err("Temporarily unavailable", 502); }
    if (!handle) return err("Pick a chat name first (open Global Chat)", 428);

    const fields = {};
    fields[CFG.C_POST] = postId;
    fields[CFG.C_USER] = user.email;
    fields[CFG.C_HANDLE] = handle;
    fields[CFG.C_BODY] = text;

    const why = await addRecord(CFG.COMMENTS, fields);
    if (why) return err(why, 502);

    return json({ ok: true, comments: await listComments(postId) });
  } catch (e) {
    return err("post-actions: " + (e?.message || e), 502);
  }
}

export const config = { path: "/api/post-actions" };
