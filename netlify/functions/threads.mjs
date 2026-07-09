// ============================================================
// /api/threads — artist discussion boards
//   GET  ?artist=recXXX            → thread list for an artist
//   GET  ?thread=ID                → one thread + its replies
//   POST { artist, artistName, title, body }  → new thread
//   POST { thread, body }                     → new reply
// Writes: session + claimed handle required, filtered, rate-limited.
// ============================================================
import { getSessionFromRequest, json, err } from "./_shared.mjs";
import { lookupHandle } from "./handle.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BANNED = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot",
  "puta", "putangina", "tangina", "tanginamo", "gago", "kantot", "bobo",
  "kys", "kill yourself",
];
const bannedRe = new RegExp("\\b(" + BANNED.join("|").replace(/ /g, "\\s+") + ")\\b", "i");
const linkRe = /(https?:\/\/|www\.)\S+/i;

const H = () => ({
  apikey: SERVICE_KEY,
  Authorization: "Bearer " + SERVICE_KEY,
  "Content-Type": "application/json",
});

const clean = (v, max) => String(v || "").trim().slice(0, max);

async function sb(path, opts = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...opts,
    headers: { ...H(), ...(opts.headers || {}) },
  });
  return res;
}

export default async function handler(req) {
  if (!SUPABASE_URL || !SERVICE_KEY) return err("Discussions not configured", 503);
  if (process.env.THREADS_DISABLED === "true") return err("Discussions are taking a break", 503);

  const q = new URL(req.url).searchParams;

  // ── READS (public) ──
  if (req.method === "GET") {
    try {
      const threadId = q.get("thread");
      if (threadId) {
        const t = await (await sb(`threads?id=eq.${encodeURIComponent(threadId)}&select=*&limit=1`)).json();
        if (!t?.[0]) return err("Thread not found", 404);
        const replies = await (await sb(
          `thread_replies?thread_id=eq.${encodeURIComponent(threadId)}&select=id,handle,body,created_at&order=id.asc&limit=200`
        )).json();
        return json({ thread: t[0], replies: replies || [] });
      }
      const artist = q.get("artist");
      if (!artist) return err("Missing artist");
      const rows = await (await sb(
        `threads?artist_id=eq.${encodeURIComponent(artist)}&select=id,title,handle,reply_count,created_at&order=id.desc&limit=50`
      )).json();
      return json({ threads: rows || [] });
    } catch {
      return err("Discussions temporarily unavailable", 502);
    }
  }

  if (req.method !== "POST") return err("Method not allowed", 405);

  // ── WRITES (session + handle) ──
  const user = getSessionFromRequest(req);
  if (!user) return err("Sign in to post", 401);

  let handle;
  try { handle = await lookupHandle(user.email); } catch { return err("Temporarily unavailable", 502); }
  if (!handle) return err("Pick a chat name first (open Global Chat)", 428);

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }

  try {
    // ── reply ──
    if (body?.thread) {
      const text = clean(body.body, 1000);
      if (!text) return err("Say something first");
      if (linkRe.test(text)) return err("Links aren't allowed");
      if (bannedRe.test(text)) return err("Keep it friendly");

      const last = (await (await sb(
        `thread_replies?user_id=eq.${encodeURIComponent(user.email)}&select=created_at&order=id.desc&limit=1`
      )).json())?.[0];
      if (last && Date.now() - new Date(last.created_at).getTime() < 5000) {
        return err("Slow down a little", 429);
      }

      const ins = await sb("thread_replies", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          thread_id: body.thread, user_id: user.email, handle, body: text,
        }),
      });
      if (!ins.ok) return err("Reply failed", 502);
      return json({ ok: true });
    }

    // ── new thread ──
    const title = clean(body?.title, 120);
    const text = clean(body?.body, 1000);
    const artistId = clean(body?.artist, 40);
    const artistName = clean(body?.artistName, 60);
    if (!artistId || !title) return err("Give your thread a title");
    if (linkRe.test(title) || linkRe.test(text)) return err("Links aren't allowed");
    if (bannedRe.test(title) || bannedRe.test(text)) return err("Keep it friendly");

    const last = (await (await sb(
      `threads?user_id=eq.${encodeURIComponent(user.email)}&select=created_at&order=id.desc&limit=1`
    )).json())?.[0];
    if (last && Date.now() - new Date(last.created_at).getTime() < 60000) {
      return err("One new thread per minute — give others a turn", 429);
    }

    const ins = await sb("threads", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        artist_id: artistId, artist_name: artistName,
        user_id: user.email, handle, title, body: text,
      }),
    });
    if (!ins.ok) return err("Thread failed", 502);
    const created = (await ins.json())?.[0];
    return json({ ok: true, id: created?.id });
  } catch {
    return err("Discussions temporarily unavailable", 502);
  }
}
