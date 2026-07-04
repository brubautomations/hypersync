// ============================================================
// POST /api/dm   { artistId, message }
// Server looks up the artist's real price, deducts server-side,
// writes the DM. The client never touches a balance.
// ============================================================
import {
  atList, atCreate, atUpdate, TABLES,
  getSessionFromRequest, json, err, esc,
} from "./_shared.mjs";

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);
  const user = getSessionFromRequest(req);
  if (!user) return err("Sign in to continue", 401);

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }
  const message = String(body?.message || "").trim().slice(0, 500);
  const artistId = String(body?.artistId || "");
  if (!message) return err("Message is empty");
  if (!artistId) return err("Missing artist");

  try {
    // Real price from the artist record — never from the client
    const artists = await atList(TABLES.ARTISTS, {
      filterByFormula: `RECORD_ID()='${esc(artistId)}'`,
      maxRecords: 1,
    });
    const artist = artists[0];
    if (!artist) return err("Artist not found", 404);
    const price = artist["dm_price"] || 1;

    // Balance check + deduct
    const fans = await atList(TABLES.FAN_CREDITS, {
      filterByFormula: `{Fan Email}='${esc(user.email)}'`,
      maxRecords: 1,
    });
    const fan = fans[0];
    const balance = fan?.["Credits"] || 0;
    if (!fan || balance < price)
      return json({ error: "Not enough credits", needed: price, credits: balance }, 402);

    await atUpdate(TABLES.FAN_CREDITS, fan.id, { Credits: balance - price });

    await atCreate(TABLES.DMS, {
      "Artist Name": artist["name"] || "",
      "Artist ID": artistId,
      "Fan ID": user.email,
      "Fan Name": user.name || user.email.split("@")[0],
      "Fan Email": user.email,
      Message: message,
      "Credits Spent": price,
      Read: false,
    });

    return json({ sent: true, credits: balance - price, price });
  } catch {
    return err("Message could not be sent", 502);
  }
}
