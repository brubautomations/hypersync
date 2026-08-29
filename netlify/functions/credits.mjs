// ============================================================
// /api/credits — the cash register, now with a locked drawer.
//   GET  ?action=balance                  → { credits }
//   POST ?action=create { pack }          → { checkout_url, link_id }
//   GET  ?action=check&link_id=...        → { status } (adds credits on paid)
// The browser can never write a balance. Only this function can.
// ============================================================
import {
  atList, atCreate, atUpdate, TABLES,
  getSessionFromRequest, json, err, esc,
} from "./_shared.mjs";

const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET;

// Credit packs live in the MERCH table — rows where Category = "CREDITS".
// Columns used:  Item Name (label) · Price (pesos) · credits (number) · Active
// Change a price = edit the cell. Add a pack = add a row. No code, no deploy.
async function getPacks() {
  const all = await atList(TABLES.MERCH, {});
  const rows = all.filter((r) => {
    const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
    const map = {};
    for (const k of Object.keys(r)) map[norm(k)] = r[k];
    const cat = String(map["category"] || "").trim().toUpperCase();
    const act = map["active"];
    const isActive = act === true || act === 1 || act === "true" || act === "checked";
    return cat.includes("CREDIT") && isActive;
  });
  const pick = (row, ...names) => {
    const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
    const map = {};
    for (const k of Object.keys(row)) map[norm(k)] = row[k];
    for (const n of names) {
      const v = map[norm(n)];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const packs = {};
  for (const r of rows) {
    const name = String(pick(r, "item_name", "Item Name") || "").trim();
    const id = name.toLowerCase().replace(/\s+/g, "-");
    if (!id) continue;
    packs[id] = {
      credits: Number(pick(r, "credits", "Credits")) || 0,
      price: Number(pick(r, "price", "Price")) || 0,
      label: name,
    };
  }
  return packs;
}

const pmHeaders = {
  Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET + ":").toString("base64")}`,
  "Content-Type": "application/json",
};

async function getFanRecord(email) {
  const rows = await atList(TABLES.FAN_CREDITS, {
    filterByFormula: `{Fan Email}='${esc(email)}'`,
    maxRecords: 1,
  });
  if (rows.length) return rows[0];
  const created = await atCreate(TABLES.FAN_CREDITS, {
    "Fan ID": email,
    "Fan Email": email,
    "Fan Name": "",
    Credits: 0,
  });
  return { id: created.id, Credits: 0 };
}

export default async function handler(req) {
  const q = new URL(req.url).searchParams;
  const action = q.get("action");
  // ── packs (price list, from Airtable) ──────────────────────
  if (action === "packs" && req.method === "GET") {
    try { return json({ packs: await getPacks() }); }
    catch { return err("Could not load packs", 502); }
  }

  const user = getSessionFromRequest(req);
  if (!user) return err("Sign in to continue", 401);

  // ── balance ────────────────────────────────────────────────
  if (action === "balance" && req.method === "GET") {
    try {
      const fan = await getFanRecord(user.email);
      return json({ credits: fan["Credits"] || 0 });
    } catch {
      return err("Could not load balance", 502);
    }
  }

  // ── create payment link ────────────────────────────────────
  if (action === "create" && req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return err("Bad request"); }
    const packs = await getPacks();
    const pack = packs[body?.pack];
    if (!pack) return err("Unknown pack");

    try {
      const res = await fetch("https://api.paymongo.com/v1/links", {
        method: "POST",
        headers: pmHeaders,
        body: JSON.stringify({
          data: {
            attributes: {
              amount: pack.price * 100, // centavos
              description: `HYPERSYNC ${pack.label} — ${pack.credits} credits — ${user.email}`,
            },
          },
        }),
      });
      if (!res.ok) return err("Payment link could not be created", 502);
      const data = await res.json();

      // Record the pending purchase server-side
      await atCreate(TABLES.CREDIT_PURCHASES, {
        "Fan Email": user.email,
        "Link ID": data.data.id,
        Credits: pack.credits,
        Amount: pack.price,
        Status: "pending",
      });

      return json({
        checkout_url: data.data.attributes.checkout_url,
        link_id: data.data.id,
      });
    } catch {
      return err("Payment link could not be created", 502);
    }
  }

  // ── check payment + fulfil ─────────────────────────────────
  if (action === "check" && req.method === "GET") {
    const linkId = q.get("link_id");
    if (!linkId) return err("Missing link_id");

    try {
      // Look up the pending purchase we created (never trust client amounts)
      const purchases = await atList(TABLES.CREDIT_PURCHASES, {
        filterByFormula: `AND({Link ID}='${esc(linkId)}',{Fan Email}='${esc(user.email)}')`,
        maxRecords: 1,
      });
      const purchase = purchases[0];
      if (!purchase) return err("Purchase not found", 404);
      if (purchase["Status"] === "paid") return json({ status: "paid" });

      const res = await fetch(`https://api.paymongo.com/v1/links/${linkId}`, {
        headers: pmHeaders,
      });
      if (!res.ok) return err("Could not check payment", 502);
      const data = await res.json();
      const status = data?.data?.attributes?.status;

      if (status !== "paid") return json({ status: status || "pending" });

      // Fulfil exactly once: mark paid first, then add credits
      await atUpdate(TABLES.CREDIT_PURCHASES, purchase.id, { Status: "paid" });
      const fan = await getFanRecord(user.email);
      await atUpdate(TABLES.FAN_CREDITS, fan.id, {
        Credits: (fan["Credits"] || 0) + (purchase["Credits"] || 0),
      });

      return json({ status: "paid" });
    } catch {
      return err("Could not check payment", 502);
    }
  }

  return err("Unknown action", 404);
}
