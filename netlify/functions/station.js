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

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
  const token = process.env.RADIO_TOKEN;
  const base = process.env.RADIO_BASE_ID;

  if (!token || !base) {
    return Response.json(
      { error: "RADIO_TOKEN and RADIO_BASE_ID are not set in Netlify." },
      { status: 500 }
    );
  }

  try {
    const [showRecs, songRecs, dropRecs, adRecs] = await Promise.all([
      table(T.SHOWS, token, base),
      table(T.SONGS, token, base),
      table(T.DROPS, token, base),
      table(T.ADS, token, base),
    ]);

    const shows = showRecs
      .map((r) => ({
        id: r.id,
        name: r.fields.Show || "",
        start: r.fields.Start || "",
        end: r.fields.End || "",
        desc: r.fields.Description || "",
        art: (r.fields.Art && r.fields.Art[0] && r.fields.Art[0].url) || "",
      }))
      .filter((s) => s.name && s.start && s.end);

    const songs = songRecs
      .map((r) => ({
        id: r.id,
        title: r.fields.Title || "",
        artist: r.fields.Artist || "",
        url: r.fields["File URL"] || "",
        shows: r.fields.Shows || [],
        active: r.fields.Played !== false,
      }))
      .filter((s) => s.url && s.active);

    const drops = dropRecs
      .map((r) => ({
        id: r.id,
        url: r.fields["File URL"] || "",
        type: r.fields.Type || "Station ID",
        shows: r.fields.Shows || [],
      }))
      .filter((d) => d.url);

    const ads = adRecs
      .map((r) => ({
        id: r.id,
        url: r.fields["File URL"] || "",
        sponsor: r.fields.Sponsor || "",
        active: r.fields.Active !== false,
      }))
      .filter((a) => a.url && a.active);

    return Response.json(
      { shows, songs, drops, ads, at: Date.now() },
      {
        headers: {
          // browsers may reuse this for 5 min; the station itself is clock-driven
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 502 });
  }
};

export const config = { path: "/api/station" };
