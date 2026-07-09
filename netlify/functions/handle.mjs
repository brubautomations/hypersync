// ============================================================
// /api/handle — the one-time chat name claim
//   GET  → { handle } or { handle: null }   (has this fan claimed?)
//   POST { handle } → claim it. Rules, in order:
//     session required → format → banned words → uniqueness
//     → immutable (one claim per fan, forever)
// The chat send path stamps messages with THIS server-side
// lookup — the browser never supplies a display name at all.
// ============================================================
import { getSessionFromRequest, json, err } from "./_shared.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BANNED = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot",
  "puta", "putangina", "tangina", "gago", "kantot", "bobo",
  "admin", "hypersync", "moderator", "official",
];
const bannedRe = new RegExp("(" + BANNED.join("|") + ")", "i");
const formatRe = /^[a-zA-Z0-9_]{3,20}$/;

const H = () => ({
  apikey: SERVICE_KEY,
  Authorization: "Bearer " + SERVICE_KEY,
  "Content-Type": "application/json",
});

export async function lookupHandle(email) {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/chat_handles?user_id=eq." + encodeURIComponent(email) + "&select=handle&limit=1",
    { headers: H() }
  );
  const rows = await res.json().catch(() => []);
  return rows?.[0]?.handle || null;
}

export default async function handler(req) {
  if (!SUPABASE_URL || !SERVICE_KEY) return err("Chat is not configured", 503);
  const user = getSessionFromRequest(req);
  if (!user) return err("Sign in first", 401);

  if (req.method === "GET") {
    try {
      return json({ handle: await lookupHandle(user.email) });
    } catch {
      return err("Temporarily unavailable", 502);
    }
  }

  if (req.method !== "POST") return err("Method not allowed", 405);

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }
  const handle = String(body?.handle || "").trim();

  if (!formatRe.test(handle)) return err("3-20 characters: letters, numbers, underscores only");
  if (bannedRe.test(handle)) return err("That name isn't available");

  try {
    // immutable: refuses if this fan already owns one
    if (await lookupHandle(user.email)) return err("You already have a chat name", 409);

    const ins = await fetch(SUPABASE_URL + "/rest/v1/chat_handles", {
      method: "POST",
      headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.email, handle }),
    });

    if (ins.status === 409) return err("That name is taken", 409);
    if (!ins.ok) return err("Claim failed, try again", 502);
    return json({ ok: true, handle });
  } catch {
    return err("Temporarily unavailable", 502);
  }
}
