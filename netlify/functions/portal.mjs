// ============================================================
// /api/portal — the artist portal's entire server side (Slice 1)
//
// Accounts live in a new Airtable table: PORTAL_ACCOUNTS
//   fields (all "Single line text"):
//     email | invite_code | password_hash | artist_id
//
// Invite-only flow:
//   F creates a row: email + invite_code + artist_id (the rec… id
//   from the artist's page URL). Password stays EMPTY.
//   Artist activates: email + invite code + chosen password →
//   we hash and store it, and burn the invite code.
//   Forgot password? F types a fresh invite_code into the row —
//   the artist activates again. That's the whole support desk.
//
// Actions (POST { action, ... }):
//   activate         { email, code, password }
//   login            { email, password }
//   me               (session)
//   change_password  { old_password, new_password } (session)
//   get_profile      (session) → their ARTISTS row
//   update_profile   { fields } (session) → writes allowed fields
// ============================================================
import crypto from "node:crypto";
import {
  atList, atUpdate, TABLES, signSession, getSessionFromRequest, json, err, esc,
} from "./_shared.mjs";

const ACCOUNTS = "PORTAL_ACCOUNTS";

// fields an artist may edit on their own ARTISTS row
const EDITABLE = ["bio", "banner", "avatar", "dm_price"];

// ── password hashing: scrypt, salt:hash hex ──
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return salt + ":" + hash;
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

// artist reference: linked field "artist" (dropdown) wins, plain
// text "artist_id" works as fallback — use whichever you filled.
function artistIdOf(acct) {
  if (Array.isArray(acct?.artist) && acct.artist[0]) return acct.artist[0];
  return acct?.artist_id || null;
}

const portalSession = (req) => {
  const u = getSessionFromRequest(req);
  return u && u.portal && u.artist_id ? u : null;
};

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }
  const action = body?.action;

  try {
    // ── ACTIVATE: invite code + set first password ──
    if (action === "activate") {
      const { email, code, password } = body;
      if (!email || !code || !password) return err("Fill in everything");
      if (String(password).length < 8) return err("Password needs at least 8 characters");
      const acct = await findAccount(email);
      if (!acct || !acct.invite_code || acct.invite_code !== String(code).trim()) {
        return err("Invite code doesn't match", 401);
      }
      const aid = artistIdOf(acct);
      if (!aid) return err("This account isn't linked to an artist yet — contact HYPERSYNC", 409);
      await atUpdate(ACCOUNTS, acct.id, {
        password_hash: hashPassword(password),
        invite_code: "", // burned
      });
      const session = signSession({ portal: true, artist_id: aid, email: acct.email });
      return json({ ok: true, session });
    }

    // ── LOGIN ──
    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return err("Fill in everything");
      const acct = await findAccount(email);
      if (!acct || !acct.password_hash) return err("Account not found or not activated", 401);
      if (!verifyPassword(password, acct.password_hash)) return err("Wrong email or password", 401);
      const aid = artistIdOf(acct);
      if (!aid) return err("This account isn't linked to an artist yet — contact HYPERSYNC", 409);
      const session = signSession({ portal: true, artist_id: aid, email: acct.email });
      return json({ ok: true, session });
    }

    // ── everything below needs a portal session ──
    const user = portalSession(req);
    if (!user) return err("Sign in first", 401);

    if (action === "me") return json({ ok: true, email: user.email, artist_id: user.artist_id });

    if (action === "change_password") {
      const { old_password, new_password } = body;
      if (!old_password || !new_password) return err("Fill in everything");
      if (String(new_password).length < 8) return err("New password needs at least 8 characters");
      const acct = await findAccount(user.email);
      if (!acct || !verifyPassword(old_password, acct.password_hash)) {
        return err("Current password is wrong", 401);
      }
      await atUpdate(ACCOUNTS, acct.id, { password_hash: hashPassword(new_password) });
      return json({ ok: true });
    }

    if (action === "get_profile") {
      const rows = await atList(TABLES.ARTISTS, {
        filterByFormula: `RECORD_ID()='${esc(user.artist_id)}'`,
        maxRecords: 1,
      });
      if (!rows[0]) return err("Artist record not found", 404);
      return json({ ok: true, artist: rows[0] });
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

    return err("Unknown action");
  } catch (e) {
    // Airtable 422 usually means a field name doesn't exist in the base
    return err("Server hiccup: " + String(e.message || e), 502);
  }
}
