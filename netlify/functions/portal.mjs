// ============================================================
// /api/portal — the artist portal, COMPLETE server side
// Rooms: auth · profile · posts · messages · earnings · market
//
// One-time Airtable prep (see delivery notes):
//   PORTAL_ACCOUNTS table (from Slice 1)
//   DMS table: add fields  "Reply" (long text), "Replied At" (text)
//   PAYOUTS table: artist_id, artist_name, amount_credits (number),
//     method, details, status, created_at  (text unless noted)
// ============================================================
import crypto from "node:crypto";
import {
  atList, atCreate, atUpdate, TABLES, signSession, getSessionFromRequest, json, err, esc,
} from "./_shared.mjs";

const ACCOUNTS = "PORTAL_ACCOUNTS";
const PAYOUTS = "PAYOUTS";
const EDITABLE = ["bio", "portal_banner", "portal_avatar", "dm_price"];
const PLATFORM_CUT = 0.10; // 90/10, artist keeps 90

// ── passwords ──
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(String(pw), salt, 64).toString("hex");
}
function verifyPassword(pw, stored) {
  try {
    const [salt, hash] = String(stored || "").split(":");
    if (!salt || !hash) return false;
    const test = crypto.scryptSync(String(pw), salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(test));
  } catch { return false; }
}

async function findAccount(email) {
  const rows = await atList(ACCOUNTS, {
    filterByFormula: `LOWER({email})='${esc(String(email).toLowerCase())}'`,
    maxRecords: 1,
  });
  return rows[0] || null;
}
function artistIdOf(acct) {
  for (const v of [acct?.artist, acct?.artist_id]) {
    if (Array.isArray(v) && v[0]) return v[0];
    if (typeof v === "string" && v.startsWith("rec")) return v;
  }
  return null;
}
async function artistRow(id) {
  const rows = await atList(TABLES.ARTISTS, {
    filterByFormula: `RECORD_ID()='${esc(id)}'`, maxRecords: 1,
  });
  return rows[0] || null;
}
async function makeSession(acct) {
  const aid = artistIdOf(acct);
  if (!aid) return null;
  const artist = await artistRow(aid);
  return signSession({
    portal: true, artist_id: aid,
    artist_name: artist?.name || "", email: acct.email,
  });
}
const portalSession = (req) => {
  const u = getSessionFromRequest(req);
  return u && u.portal && u.artist_id ? u : null;
};

// raw delete (no _shared helper for deletes)
async function atDelete(table, id) {
  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${table}/${id}`,
    { method: "DELETE", headers: { Authorization: "Bearer " + process.env.AIRTABLE_TOKEN } }
  );
  return res.ok;
}

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);
  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }
  const action = body?.action;

  try {
    // ══ AUTH ══
    if (action === "activate") {
      const { email, code, password } = body;
      if (!email || !code || !password) return err("Fill in everything");
      if (String(password).length < 8) return err("Password needs at least 8 characters");
      const acct = await findAccount(email);
      if (!acct || !acct.invite_code || acct.invite_code !== String(code).trim()) {
        return err("Invite code doesn't match", 401);
      }
      const session = await makeSession(acct);
      if (!session) return err("This account isn't linked to an artist yet — contact HYPERSYNC", 409);
      await atUpdate(ACCOUNTS, acct.id, { password_hash: hashPassword(password), invite_code: "" });
      return json({ ok: true, session });
    }

    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return err("Fill in everything");
      const acct = await findAccount(email);
      if (!acct || !acct.password_hash) return err("Account not found or not activated", 401);
      if (!verifyPassword(password, acct.password_hash)) return err("Wrong email or password", 401);
      const session = await makeSession(acct);
      if (!session) return err("This account isn't linked to an artist yet — contact HYPERSYNC", 409);
      return json({ ok: true, session });
    }

    const user = portalSession(req);
    if (!user) return err("Sign in first", 401);
    const NAME = user.artist_name || "";

    if (action === "me") return json({ ok: true, email: user.email, artist_id: user.artist_id, artist_name: NAME });

    if (action === "change_password") {
      const { old_password, new_password } = body;
      if (!old_password || !new_password) return err("Fill in everything");
      if (String(new_password).length < 8) return err("New password needs at least 8 characters");
      const acct = await findAccount(user.email);
      if (!acct || !verifyPassword(old_password, acct.password_hash)) return err("Current password is wrong", 401);
      await atUpdate(ACCOUNTS, acct.id, { password_hash: hashPassword(new_password) });
      return json({ ok: true });
    }

    // ══ PROFILE ══
    if (action === "get_profile") {
      const a = await artistRow(user.artist_id);
      if (!a) return err("Artist record not found", 404);
      return json({ ok: true, artist: a });
    }
    if (action === "update_profile") {
      const input = body?.fields || {};
      const fields = {};
      for (const k of EDITABLE) {
        if (input[k] !== undefined) {
          fields[k] = k === "dm_price" ? Number(input[k]) || 0 : String(input[k]).slice(0, 2000);
        }
      }
      if (!Object.keys(fields).length) return err("Nothing to save");
      await atUpdate(TABLES.ARTISTS, user.artist_id, fields);
      return json({ ok: true });
    }

    // ══ POSTS ══
    if (action === "posts_list") {
      const rows = await atList(TABLES.POSTS, { maxRecords: 200 });
      const mine = rows
        .filter(r => (r["artist_name"] || "").toLowerCase() === NAME.toLowerCase())
        .sort((a, b) => new Date(b["created_at"] || 0) - new Date(a["created_at"] || 0))
        .map(r => ({
          id: r.id, content: r["content"] || "",
          image_urls: r["image_urls"] ? r["image_urls"].split(",").map(s => s.trim()).filter(Boolean) : [],
          is_exclusive: !!r["is_exclusive"], created_at: r["created_at"] || "",
        }));
      return json({ ok: true, posts: mine });
    }
    if (action === "post_create") {
      const content = String(body?.content || "").trim().slice(0, 2000);
      const images = Array.isArray(body?.images) ? body.images.filter(u => /^https?:\/\//.test(u)).slice(0, 6) : [];
      if (!content && !images.length) return err("Write something or add media");
      await atCreate(TABLES.POSTS, {
        artist_name: NAME,
        content,
        image_urls: images.join(","),
        platform: "HYPERSYNC",
        is_exclusive: !!body?.is_exclusive,
        created_at: new Date().toISOString(),
      });
      return json({ ok: true });
    }
    if (action === "post_delete") {
      const rows = await atList(TABLES.POSTS, {
        filterByFormula: `RECORD_ID()='${esc(body?.id || "")}'`, maxRecords: 1,
      });
      const p = rows[0];
      if (!p) return err("Post not found", 404);
      if ((p["artist_name"] || "").toLowerCase() !== NAME.toLowerCase()) return err("Not your post", 403);
      const ok = await atDelete(TABLES.POSTS, p.id);
      return ok ? json({ ok: true }) : err("Delete failed", 502);
    }

    // ══ MESSAGES ══
    if (action === "dms_list") {
      const rows = await atList(TABLES.DMS, {
        filterByFormula: `{Artist ID}='${esc(user.artist_id)}'`, maxRecords: 200,
      });
      const msgs = rows
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .map(r => ({
          id: r.id,
          fan: r["Fan Name"] || "fan",
          message: r["Message"] || "",
          credits: r["Credits Spent"] || 0,
          reply: r["Reply"] || "",
          replied_at: r["Replied At"] || "",
          read: !!r["Read"],
          created_at: r.created_at || "",
        }));
      return json({ ok: true, messages: msgs });
    }
    if (action === "dm_reply") {
      const reply = String(body?.reply || "").trim().slice(0, 1000);
      if (!reply) return err("Write a reply");
      const rows = await atList(TABLES.DMS, {
        filterByFormula: `RECORD_ID()='${esc(body?.id || "")}'`, maxRecords: 1,
      });
      const dm = rows[0];
      if (!dm) return err("Message not found", 404);
      if ((dm["Artist ID"] || "") !== user.artist_id) return err("Not your message", 403);
      await atUpdate(TABLES.DMS, dm.id, {
        Reply: reply, "Replied At": new Date().toISOString(), Read: true,
      });
      return json({ ok: true });
    }

    // ══ EARNINGS ══
    if (action === "earnings") {
      const dms = await atList(TABLES.DMS, {
        filterByFormula: `{Artist ID}='${esc(user.artist_id)}'`, maxRecords: 500,
      });
      const gross = dms.reduce((t, r) => t + (Number(r["Credits Spent"]) || 0), 0);
      const artistShare = Math.floor(gross * (1 - PLATFORM_CUT));

      let paid = 0, pending = 0, requests = [];
      try {
        const rows = await atList(PAYOUTS, {
          filterByFormula: `{artist_id}='${esc(user.artist_id)}'`, maxRecords: 100,
        });
        requests = rows
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          .map(r => ({
            id: r.id, amount: Number(r["amount_credits"]) || 0,
            status: r["status"] || "requested", method: r["method"] || "",
            created_at: r["created_at"] || r.created_at || "",
          }));
        for (const r of requests) {
          if (r.status === "paid") paid += r.amount;
          else pending += r.amount;
        }
      } catch { /* PAYOUTS table not created yet — earnings still shows */ }

      return json({
        ok: true,
        gross_credits: gross,
        artist_share: artistShare,
        platform_cut: gross - artistShare,
        paid, pending,
        available: Math.max(0, artistShare - paid - pending),
        dm_count: dms.length,
        requests,
      });
    }
    if (action === "payout_request") {
      const amount = Math.floor(Number(body?.amount) || 0);
      const method = String(body?.method || "").trim().slice(0, 60);
      const details = String(body?.details || "").trim().slice(0, 300);
      if (amount < 1) return err("Enter an amount");
      if (!method || !details) return err("Add your payout method and details");
      await atCreate(PAYOUTS, {
        artist_id: user.artist_id, artist_name: NAME,
        amount_credits: amount, method, details,
        status: "requested", created_at: new Date().toISOString(),
      });
      return json({ ok: true });
    }

    // ══ MARKET ══
    if (action === "merch_list") {
      const rows = await atList(TABLES.MERCH, { maxRecords: 200 });
      const mine = rows
        .filter(r => (r["artist_name"] || "").toLowerCase() === NAME.toLowerCase())
        .map(r => ({
          id: r.id, item_name: r["item_name"] || "", image_url: r["image_url"] || "",
          price: r["price"] ?? "", currency: r["currency"] || "₱",
          category: r["category"] || "", buy_url: r["buy_url"] || "",
          featured: !!r["featured"], active: !!r["active"],
        }));
      return json({ ok: true, items: mine });
    }
    if (action === "merch_save") {
      const f = body?.item || {};
      const fields = {
        artist_name: NAME,
        item_name: String(f.item_name || "").trim().slice(0, 120),
        image_url: String(f.image_url || "").trim(),
        price: Number(f.price) || 0,
        currency: String(f.currency || "₱").slice(0, 4),
        category: String(f.category || "").slice(0, 60),
        buy_url: String(f.buy_url || "").trim(),
        featured: !!f.featured,
        active: f.active !== false,
      };
      if (!fields.item_name) return err("Item needs a name");
      if (f.id) {
        const rows = await atList(TABLES.MERCH, { filterByFormula: `RECORD_ID()='${esc(f.id)}'`, maxRecords: 1 });
        if (!rows[0] || (rows[0]["artist_name"] || "").toLowerCase() !== NAME.toLowerCase()) return err("Not your item", 403);
        await atUpdate(TABLES.MERCH, f.id, fields);
      } else {
        await atCreate(TABLES.MERCH, fields);
      }
      return json({ ok: true });
    }

    return err("Unknown action");
  } catch (e) {
    return err("Server hiccup: " + String(e.message || e).slice(0, 180), 502);
  }
}
