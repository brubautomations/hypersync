// ============================================================
// POST /api/chat   { body }
// The ONLY write path into global chat. The browser's Supabase
// key is read-only; every message passes this chokepoint:
//   sign-in required → kill switch → word filter → rate limit
//   → insert with the server-side service key.
// The rolling 200-message cap lives in the database trigger.
// ============================================================
import { getSessionFromRequest, json, err } from "./_shared.mjs";
import { lookupHandle } from "./handle.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// starter banned list — extend anytime, matches whole words, case-insensitive
const BANNED = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot",
  "puta", "putangina", "tangina", "tanginamo", "gago", "kantot", "bobo",
  "kys", "kill yourself",
];
const bannedRe = new RegExp("\\b(" + BANNED.join("|").replace(/ /g, "\\s+") + ")\\b", "i");
const linkRe = /(https?:\/\/|www\.)\S+/i;

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);

  if (process.env.CHAT_DISABLED === "true") return err("Chat is taking a break", 503);
  if (!SUPABASE_URL || !SERVICE_KEY) return err("Chat is not configured", 503);

  const user = getSessionFromRequest(req);
  if (!user) return err("Sign in to chat", 401);

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }
  const text = String(body?.body || "").trim().slice(0, 500);
  if (!text) return err("Say something first");
  if (linkRe.test(text)) return err("Links aren't allowed in chat");
  if (bannedRe.test(text)) return err("Keep it friendly");

  // identity comes from the claimed handle — never from the client
  let handle;
  try { handle = await lookupHandle(user.email); } catch { return err("Chat temporarily unavailable", 502); }
  if (!handle) return err("Pick a chat name first", 428);

  const H = {
    apikey: SERVICE_KEY,
    Authorization: "Bearer " + SERVICE_KEY,
    "Content-Type": "application/json",
  };

  try {
    // rate limit: one message per 3 seconds per user, enforced server-side
    const lastRes = await fetch(
      SUPABASE_URL + "/rest/v1/chat_messages?user_id=eq." + encodeURIComponent(user.email) +
      "&select=created_at&order=id.desc&limit=1",
      { headers: H }
    );
    const last = (await lastRes.json())?.[0];
    if (last && Date.now() - new Date(last.created_at).getTime() < 3000) {
      return err("Slow down a little", 429);
    }

    const ins = await fetch(SUPABASE_URL + "/rest/v1/chat_messages", {
      method: "POST",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: user.email,
        display_name: handle,
        avatar: "",
        body: text,
      }),
    });
    if (!ins.ok) return err("Message failed to send", 502);
    return json({ ok: true });
  } catch {
    return err("Chat temporarily unavailable", 502);
  }
}
