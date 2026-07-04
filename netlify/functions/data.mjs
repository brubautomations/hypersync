// ============================================================
// GET /api/data?resource=<name>
// Public, read-only. Whitelist only — nothing else is reachable.
// Edge-cached to keep upstream quota low.
// ============================================================
import { atList, TABLES, json, err } from "./_shared.mjs";

const CACHE = "public, max-age=0, s-maxage=120, stale-while-revalidate=300";

const RESOURCES = {
  news: async () => {
    let rows;
    try {
      rows = await atList(TABLES.NEWS, {
        sort: [{ field: "Published", direction: "desc" }],
        maxRecords: 400,
      });
    } catch {
      // Sort field hiccup shouldn't blank the feed — fetch unsorted, sort here
      rows = await atList(TABLES.NEWS, { maxRecords: 400 });
      rows.sort((a, b) => (b["Published"] || b.created_at || "").localeCompare(a["Published"] || a.created_at || ""));
    }
    return rows.map((r) => ({
      id: r.id,
      title: r["Title"] || "",
      summary: r["Summary"] || "",
      url: r["URL"] || "",
      image: r["Image"] || "",
      source: r["Source"] || "",
      artist: r["Artist"] || "",
      country: r["Country"] || "",
      published: r["Published"] || "",
      news_type: r["News Type"] || "",
      created_at: r.created_at || r["Published"] || "",
    }));
  },

  artists: async () => {
    const rows = await atList(TABLES.ARTISTS, {
      filterByFormula: "AND({verified},{setup_done})",
    });
    return rows.map((r) => ({
      id: r.id,
      name: r["name"] || "",
      country: r["country"] || "",
      agency: r["agency"] || "",
      debut: r["debut"] || "",
      members: r["members"] || "",
      bio: r["bio"] || "",
      image: r["image"] || "",
      followers: r["followers"] || "",
      youtube_views: r["youtube_views"] || "",
      youtube: r["youtube"] || "",
      spotify: r["spotify"] || "",
      instagram: r["instagram"] || "",
      twitter: r["twitter"] || "",
      facebook: r["facebook"] || "",
      tiktok: r["tiktok"] || "",
      portal_avatar: r["portal_avatar"] || r["image"] || "",
      portal_banner: r["portal_banner"] || "",
      local_score: r["local_score"] || 0,
      asia_score: r["asia_score"] || 0,
      global_score: r["global_score"] || 0,
      dm_price: r["dm_price"] || 1,
      news_this_month: r["news_this_month"] || 0,
    }));
  },

  posts: async (q) => {
    const rows = await atList(TABLES.POSTS, { maxRecords: 200 });
    const name = (q.get("artist") || "").toLowerCase();
    return rows
      .filter((r) => !name || (r["artist_name"] || "").toLowerCase() === name)
      .sort((a, b) => new Date(b["created_at"] || 0) - new Date(a["created_at"] || 0))
      .slice(0, 40)
      .map((r) => ({
        id: r.id,
        artist_name: r["artist_name"] || "",
        content: r["content"] || "",
        image_urls: r["image_urls"]
          ? r["image_urls"].split(",").map((s) => s.trim())
          : r["image_url"] ? [r["image_url"]] : [],
        is_exclusive: !!r["is_exclusive"],
        platform: r["platform"] || "",
        source_url: r["source_url"] || "",
        ai_blurb: r["ai_blurb"] || "",
        created_at: r["created_at"] || "",
      }));
  },

  schedule: async () => {
    const today = new Date().toISOString().split("T")[0];
    const rows = await atList(TABLES.SCHEDULE, {
      filterByFormula: `{event_date}>='${today}'`,
      sort: [{ field: "event_date", direction: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      artist_name: r["artist_name"] || "",
      event_name: r["event_name"] || "",
      event_type: r["event_type"] || "EVENT",
      venue: r["venue"] || "",
      city: r["city"] || "",
      country: r["country"] || "",
      event_date: r["event_date"] || "",
      ticket_url: r["ticket_url"] || "",
      source: r["source"] || "",
      tour_key: r["tour_key"] || "",
    }));
  },

  announcements: async () => {
    const [rows, sched] = await Promise.all([
      atList(TABLES.ANNOUNCEMENTS, { filterByFormula: "{active}=1" }),
      atList(TABLES.SCHEDULE, {
        filterByFormula: `{event_date}>='${new Date().toISOString().split("T")[0]}'`,
      }),
    ]);
    // Three lookup maps: exact schedule_id, tour_key+date, and
    // tour_key alone → NEXT upcoming leg (rescues orphaned announcements
    // whose original schedule rows were purged)
    const byId = {};
    const byTourDate = {};
    const byTour = {};
    const sorted = [...sched].sort((a, b) =>
      (a["event_date"] || "").localeCompare(b["event_date"] || ""));
    for (const s of sorted) {
      const loc = {
        venue: s["venue"] || "",
        city: s["city"] || "",
        country: s["country"] || "",
        event_type: s["event_type"] || "",
        date: s["event_date"] || "",
      };
      if (s["id"]) byId[s["id"]] = loc;
      byId[s.id] = loc;
      if (s["tour_key"]) {
        if (s["event_date"]) byTourDate[`${s["tour_key"]}__${s["event_date"]}`] = loc;
        if (!byTour[s["tour_key"]]) byTour[s["tour_key"]] = loc; // earliest wins
      }
    }
    return rows.map((r) => {
      const loc =
        byId[r["schedule_id"]] ||
        byTourDate[`${r["tour_key"] || ""}__${r["override_date"] || ""}`] ||
        byTour[r["tour_key"] || ""] ||
        {};
      return {
        id: r.id,
        schedule_id: r["schedule_id"] || "",
        title: r["override_title"] || "",
        artist: r["override_artist"] || "",
        date: r["override_date"] || "",
        image: r["image_url"] || "",
        text: r["custom_text"] || "",
        tour_key: r["tour_key"] || "",
        show_from: r["show_from"] || "",
        venue: loc.venue || "",
        city: loc.city || "",
        country: loc.country || "",
        event_type: loc.event_type || "",
      };
    });
  },

  merch: async () => {
    const rows = await atList(TABLES.MERCH, {
      filterByFormula: "{active}=1",
    });
    return rows.map((r) => ({
      id: r.id,
      artist_name: r["artist_name"] || "",
      item_name: r["item_name"] || "",
      image_url: r["image_url"] || "",
      price: r["price"] || null,
      currency: r["currency"] || "₱",
      category: r["category"] || "",
      buy_url: r["buy_url"] || "",
      featured: !!r["featured"],
    }));
  },

  campaigns: async (q) => {
    const type = q.get("type") || "";
    const today = new Date().toISOString().split("T")[0];
    const rows = await atList(TABLES.CAMPAIGNS, {
      filterByFormula: `AND({active}=1,{end_date}>='${today}')`,
    });
    return rows
      .filter((r) => !type || r["type"] === type || r["type"] === "both")
      .map((r) => ({
        id: r.id,
        type: r["type"] || "",
        media_url: r["media_url"] || "",
        tagline: r["tagline"] || "",
        artist_name: r["artist_name"] || "",
        link_url: r["link_url"] || "",
      }));
  },
};

export default async function handler(req) {
  const q = new URL(req.url).searchParams;
  const resource = q.get("resource");
  const fn = RESOURCES[resource];
  if (!fn) return err("Unknown resource", 404);
  try {
    return json(await fn(q), 200, { "Cache-Control": CACHE });
  } catch (e) {
    return err("Data temporarily unavailable", 502);
  }
}
