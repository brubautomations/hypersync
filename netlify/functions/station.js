// netlify/functions/station.js
//
// Holds your Airtable token server-side and returns the station data as JSON.
// Nothing secret ever reaches the browser.
//
// In Netlify → Site settings → Environment variables, add:
//   RADIO_TOKEN     your personal access token (scope: data.records:read)
//   RADIO_BASE_ID   your radio base id, starts with "app"

const T = {
  SHOWS: "SHOWS",
  SONGS: "SONGS",
  DROPS: "DROPS",
  ADS:   "ADS",
};

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

export default async (req) => {
  // /api/station?fresh=1 skips the edge cache — handy right after editing Airtable
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const token = process.env.RADIO_TOKEN;
  const base = process.env.RADIO_BASE_ID;

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
    // SHOWS and SONGS are required. DROPS and ADS are optional — if either
    // fails, the station carries on with music instead of going dark.
    const optional = (name) => table(name, token, base).catch(() => []);

    const [showRecs, songRecs, dropRecs, adRecs] = await Promise.all([
      table(T.SHOWS, token, base),
      table(T.SONGS, token, base),
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

    // "Intro URL" / "Outro URL" on SONGS. Several URLs separated by commas
    // gives the player variants to choose between.
    const urlList = (fields, names) => {
      for (const n of names) {
        const v = fields[n];
        if (typeof v === "string" && v.trim())
          return v.split(",").map((x) => x.trim()).filter(Boolean);
      }
      return [];
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
        intros: urlList(r.fields, ["Intro URL", "Intro", "INTRO", "Intro Url"]),
        outros: urlList(r.fields, ["Outro URL", "Outro", "OUTRO", "Outro Url"]),
      }))
      .filter((s) => s.url && s.active);

    const drops = dropRecs
      .map((r) => ({
        id: r.id,
        url: audioOf(r.fields, ["File URL", "Audio", "File", "Attachment"]),
        type: r.fields.Type || "Station ID",
        shows: linkedShows(r.fields),
      }))
      .filter((d) => d.url);

    const ads = adRecs
      .map((r) => ({
        id: r.id,
        url: audioOf(r.fields, ["File URL", "Audio", "File", "Attachment"]),
        sponsor: r.fields.Sponsor || "",
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
          "Netlify-Cache-Tag": "station",
          ...(fresh ? { "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" } : {}),
        },
      }
    );
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 502 });
  }
};

export const config = { path: "/api/station" };
