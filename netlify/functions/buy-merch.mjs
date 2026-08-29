// ============================================================
// /api/buy-merch — fan buys a HYPERSYNC-sold item with credits.
//   POST { merch_id }
//   • checks the item is sell_via = hypersync and active
//   • checks the fan has enough credits
//   • deducts fan credits, records an ORDER, credits the artist
// Money never touches the browser; the server is the register.
// ============================================================
import {
  atList, atCreate, atUpdate, TABLES,
  getSessionFromRequest, json, err, esc,
} from "./_shared.mjs";

const PLATFORM_CUT = 0.10; // artist keeps 90%

export default async function handler(req) {
  if (req.method !== "POST") return err("Method not allowed", 405);
  const user = getSessionFromRequest(req);
  if (!user) return err("Sign in to buy", 401);

  let body;
  try { body = await req.json(); } catch { return err("Bad request"); }
  const merchId = String(body?.merch_id || "");
  if (!merchId) return err("Missing item");

  try {
    // 1. load the item
    const rows = await atList(TABLES.MERCH, {
      filterByFormula: `RECORD_ID()='${esc(merchId)}'`, maxRecords: 1,
    });
    const item = rows[0];
    if (!item) return err("Item not found", 404);
    if ((item["sell_via"] || "store") !== "hypersync") return err("This item isn't sold on HYPERSYNC");
    if (!item["active"]) return err("Item not available");

    const cost = Number(item["credits"]) || Number(item["price"]) || 0;
    if (cost < 1) return err("Item has no price set");

    // 2. fan balance
    const fanRows = await atList(TABLES.FAN_CREDITS, {
      filterByFormula: `{Fan Email}='${esc(user.email)}'`, maxRecords: 1,
    });
    const fan = fanRows[0];
    const balance = fan ? Number(fan["Credits"]) || 0 : 0;
    if (balance < cost) return err("Not enough credits", 402);

    // 3. deduct
    await atUpdate(TABLES.FAN_CREDITS, fan.id, { Credits: balance - cost });

    // 4. record the order (artist fulfils; this is their to-do)
    await atCreate("ORDERS", {
      "Item Name": item["item_name"] || "",
      "Artist Name": item["artist_name"] || "",
      "Fan Email": user.email,
      "Fan Name": user.name || "",
      "Credits Paid": cost,
      "Artist Earns": Math.floor(cost * (1 - PLATFORM_CUT)),
      Status: "new",
      "Created At": new Date().toISOString(),
    });

    return json({ ok: true, credits_left: balance - cost });
  } catch (e) {
    return err("Purchase failed: " + String(e.message || e).slice(0, 120), 502);
  }
}
