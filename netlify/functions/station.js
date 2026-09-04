// netlify/functions/station.js
//
// Holds your Airtable token server-side and returns the station data as JSON.
// Nothing secret ever reaches the browser.
//
// In Netlify → Site settings → Environment variables:
//   RADIO_TOKEN     personal access token (scope: data.records:read)
//   RADIO_BASE_ID   radio base id, starts with "app"
//
// TWO STATIONS, ONE FILE.
// Both share SHOWS, DROPS and ADS. Only the songs table differs.
// To add or rename a station, edit STATIONS below and nothing else.

const STATIONS = {
  "/api/station":  { songs: "SONGS",    tag: "station"    },
  "/api/station2": { songs: "SONGS-V2", tag: "station-v2" },
};

const DEFAULT_PATH = "/api/station";

const T = {
  SHOWS: "SHOWS",
  DROPS: "DROPS",
  ADS:   "ADS",
};

function stationFor(req) {
  const path = new URL(req.url).pathname;
  return STATIONS[path] || STATIONS[DEFAULT_PATH];
}

async function table(name, token, base) {
  const out = [];
  let offset;
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${base}/${encodeURIComponent(name)}`
    );
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Airtable throws the occasional 429/5xx. Wait a moment and try once more
    // before treating it as a real failure.
    if (!res.ok && res.status !== 404 && res.status !== 401) {
      await new Promise((r) => setTimeout(r, 600));
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (!res.ok) {
      if (res.status === 404) return []; // table not created yet — treat as empty
      throw new Error(`${name}: ${res.status}`);
    }
    const json = await res.json();
    out.push(...json.records);
    offset = json.offset;
  } while (offset);
  return out;
}

// ---------------------------------------------------------------------------
// POST: save measured file lengths into the Duration column.
// Only ever writes the Duration field, only on rows that already exist.
// The token stays here on the server — nothing is handled by the browser.
// ---------------------------------------------------------------------------
async function writeDurations(req, token, base, station) {
  let body;
  try { body = await req.json(); } catch { body = null; }
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return Response.json({ error: "no rows" }, { status: 400 });

  // Only this station's songs table, plus the shared audio tables.
  const allowed = {};
  allowed[station.songs.toUpperCase()] = station.songs;
  allowed[T.DROPS] = T.DROPS;
  allowed[T.ADS] = T.ADS;

  const byTable = {};
  for (const r of rows) {
    const key = String(r.table || "").toUpperCase();
    const id = String(r.id || "");
    const dur = Math.round(Number(r.dur) || 0);
    if (!allowed[key] || !id.startsWith("rec") || dur < 1 || dur > 7200) continue;
    const real = allowed[key];
    (byTable[real] = byTable[real] || []).push({ id, fields: { Duration: dur } });
  }

  let written = 0;
  const failed = [];
  for (const t of Object.keys(byTable)) {
    const list = byTable[t];
    for (let i = 0; i < list.length; i += 10) {          // Airtable caps at 10
      const chunk = list.slice(i, i + 10);
      const res = await fetch(
        `https://api.airtable.com/v0/${base}/${encodeURIComponent(t)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ records: chunk }),
        }
      );
      if (res.ok) written += chunk.length;
      else failed.push(`${t}: ${res.status}`);
      await new Promise((r) => setTimeout(r, 220));      // stay under the rate limit
    }
  }

  return Response.json(
    { written, failed: [...new Set(failed)] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export default async (req) => {
  // ?fresh=1 skips the edge cache — handy right after editing Airtable
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const token = process.env.RADIO_TOKEN;
  const base = process.env.RADIO_BASE_ID;
  const station = stationFor(req);

  if (req.method === "POST") {
    if (!token || !base)
      return Response.json({ error: "RADIO_TOKEN and RADIO_BASE_ID are not set in Netlify." }, { status: 500 });
    return writeDurations(req, token, base, station);
  }

  if (!token || !base) {
    // Diagnostic: report which variable names this function can see.
    // Names only — no values are ever returned.
    const seen = Object.keys(process.env).sort();
    return Response.json(
      {
        error: "RADIO_TOKEN and RADIO_BASE_ID are not visible to this function.",
        hasToken: !!token,
        hasBase: !!base,
        context: process.env.CONTEXT || "(none)",
        branch: process.env.BRANCH || "(none)",
        siteName: process.env.SITE_NAME || "(none)",
        matching: seen.filter((k) => /RADIO|AIRTABLE/i.test(k)),
        totalVars: seen.length,
      },
      { status: 500 }
    );
  }

  try {
    // SHOWS and the songs table are required. DROPS and ADS are optional — if
    // either fails, the station carries on with music instead of going dark.
    const optional = (name) => table(name, token, base).catch(() => []);

    const [showRecs, songRecs, dropRecs, adRecs] = await Promise.all([
      table(T.SHOWS, token, base),
      table(station.songs, token, base),
      optional(T.DROPS),
      optional(T.ADS),
    ]);

    const shows = showRecs
      .map((r) => ({
        id: r.id,
        name: r.fields.Show || "",
        start: r.fields.Start || "",
        end: r.fields.End || "",
        desc: r.fields.Description || "",
        art: (r.fields.Art && r.fields.Art[0] && r.fields.Art[0].url) || "",
        canvas: (r.fields.Canvas && r.fields.Canvas[0] && r.fields.Canvas[0].url) || "",
      }))
      .filter((s) => s.name && s.start && s.end);

    // The link field's name varies (Shows / SHOWS / Show...). Rather than
    // guess, find whichever field actually holds SHOWS record ids.
    const showIds = new Set(shows.map((s) => s.id));
    const linkedShows = (fields) => {
      for (const key of ["Shows", "SHOWS", "Show", "shows"]) {
        const v = fields[key];
        if (Array.isArray(v) && v.some((x) => showIds.has(x)))
          return v.filter((x) => showIds.has(x));
      }
      for (const v of Object.values(fields)) {
        if (
          Array.isArray(v) &&
          v.length &&
          v.every((x) => typeof x === "string") &&
          v.some((x) => showIds.has(x))
        )
          return v.filter((x) => showIds.has(x));
      }
      return [];
    };

    // Audio can come from an Airtable attachment or a plain URL field.
    // Attachment links are regenerated on every API call, so they're always
    // fresh by the time the player uses them.
    const audioOf = (fields, names) => {
      for (const n of names) {
        const v = fields[n];
        if (Array.isArray(v) && v[0] && v[0].url) return v[0].url;
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return "";
    };

    // "Intro URL" / "Outro URL" on the songs table. Attachment cells can hold
    // several files — each is a variant the player can choose between.
    // Comma-separated URLs work too.
    const urlList = (fields, names) => {
      const out = [];
      for (const n of names) {
        const v = fields[n];
        if (Array.isArray(v)) {
          for (const a of v) if (a && a.url) out.push(a.url);
        } else if (typeof v === "string" && v.trim()) {
          out.push(...v.split(",").map((x) => x.trim()).filter(Boolean));
        }
      }
      return out;
    };

    const songs = songRecs
      .map((r) => ({
        id: r.id,
        title: r.fields.Title || "",
        artist: r.fields.Artist || "",
        url: audioOf(r.fields, ["File URL", "Audio", "File", "Attachment"]),
        shows: linkedShows(r.fields),
        active: r.fields.Played !== false,
        created: r.createdTime,   // lets new songs join at the next show boundary
        dur: Number(r.fields.Duration) || 0,   // saves the player probing the file
        intros: urlList(r.fields, ["Intro Audio", "Intro URL", "Intro"]),
        outros: urlList(r.fields, ["Outro Audio", "Outro URL", "Outro"]),
      }))
      .filter((s) => s.url && s.active);

    const drops = dropRecs
      .map((r) => ({
        id: r.id,
        url: audioOf(r.fields, ["File URL", "Audio", "File", "Attachment"]),
        type: r.fields.Type || "Station ID",
        dur: Number(r.fields.Duration) || 0,
        shows: linkedShows(r.fields),
      }))
      .filter((d) => d.url);

    const ads = adRecs
      .map((r) => ({
        id: r.id,
        url: audioOf(r.fields, ["File URL", "Audio", "File", "Attachment"]),
        sponsor: r.fields.Sponsor || "",
        dur: Number(r.fields.Duration) || 0,
        active: r.fields.Active !== false,
      }))
      .filter((a) => a.url && a.active);

    return Response.json(
      {
        shows,
        songs,
        drops,
        ads,
        at: Date.now(),
        songsTable: station.songs,
        songFields: songRecs.length ? Object.keys(songRecs[0].fields) : [],
      },
      {
        headers: {
          // Everyone gets the identical payload, so cache it at Netlify's edge
          // rather than calling the function per listener. 1,000 listeners
          // become a handful of real invocations.
          //
          //   s-maxage=120                 edge keeps it 2 minutes
          //   stale-while-revalidate=600   serves the old copy while refreshing
          //   max-age=0                    listeners' own browsers never cache,
          //                                so an edge purge takes effect at once
          "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
          "Netlify-CDN-Cache-Control":
            "public, s-maxage=120, stale-while-revalidate=600",
          "Netlify-Cache-Tag": station.tag,
          ...(fresh ? { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" } : {}),
        },
      }
    );
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 502 });
  }
};

export const config = { path: ["/api/station", "/api/station2"] };
