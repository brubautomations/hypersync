// ============================================================
// POST /api/auth   { credential: <Google ID token> }
// Verifies the Google token server-side, upserts the fan's
// record (keyed by email), returns a signed session.
// ============================================================
import {
  atList, atCreate, TABLES, signSession, json, err, esc,
} from "./_shared.mjs";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return err("Bad request");
  }
  if (!body?.credential) return err("Missing credential");

  // Verify with Google
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.credential)}`
  );
  if (!res.ok) return err("Sign-in could not be verified", 401);
  const info = await res.json();

  if (info.aud !== GOOGLE_CLIENT_ID) return err("Sign-in could not be verified", 401);
  if (info.email_verified !== "true") return err("Email not verified", 401);

  const user = {
    email: info.email,
    name: info.name || info.email.split("@")[0],
    avatar: info.picture || "",
  };

  // Upsert fan record (keyed by email — stable across providers)
  try {
    const existing = await atList(TABLES.FAN_CREDITS, {
      filterByFormula: `{Fan Email}='${esc(user.email)}'`,
      maxRecords: 1,
    });
    if (!existing.length) {
      await atCreate(TABLES.FAN_CREDITS, {
        "Fan ID": user.email, // email is the canonical ID going forward
        "Fan Email": user.email,
        "Fan Name": user.name,
        Credits: 0,
      });
    }
  } catch {
    // Fan record creation is retried lazily by /api/credits; sign-in still succeeds
  }

  return json({ session: signSession(user), user });
}
