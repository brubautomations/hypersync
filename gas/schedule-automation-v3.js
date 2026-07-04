// ============================================================
// HYPERSYNC — SCHEDULE AUTOMATION v3 (tours edition)
// ============================================================
// WHAT'S NEW vs v2:
//  1. tour_key — one tour, many legs. Derived from event names.
//  2. Real dedup — same tour + same date = same event, regardless
//     of how the city/venue got spelled this week.
//  3. Official graphics — og:image scraped from ticket_url, so
//     festival/tour announcements get the real poster automatically.
//  4. Review gate — new auto-announcements start active = FALSE.
//     You flip the checkbox to put them on the front page.
//  5. One-time cleanup tools for the existing mess (run once):
//       backfillTourKeys()   → tags every existing row
//       cleanupDuplicates()  → deletes clone events/announcements
//       backfillImages()     → scrapes posters for existing rows
//
// SETUP:
//  - Same Script Properties as v2 (GEMINI_API_KEY,
//    AIRTABLE_WRITE_TOKEN, AIRTABLE_BASE_ID)
//  - Add a `tour_key` text field to SCHEDULES and ANNOUNCEMENTS
//  - Replace the whole v2 script with this file
//  - Triggers are identical — no need to recreate them
// ============================================================

function getScheduleConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    GEMINI_API_KEY:       props.GEMINI_API_KEY,
    AIRTABLE_WRITE_TOKEN: props.AIRTABLE_WRITE_TOKEN,
    AIRTABLE_BASE_ID:     props.AIRTABLE_BASE_ID,
  };
}

const TABLES = {
  ARTISTS:       'tbllu3uZBqUqXO5Tj',
  SCHEDULE:      'tble4tAuGTrZkE4jv',
  ANNOUNCEMENTS: 'tblhstxZnteZHFjlc',
};

const BATCH_SIZE = 8;

// ============================================================
// TOUR KEY — the heart of v3.
// "ITZY 3RD WORLD TOUR <TUNNEL VISION> in BANGKOK"
// "ITZY TUNNEL VISION World Tour 2026 – Bangkok, Thailand"
// both → "itzy|3rd-tour-tunnel-vision" ... close enough to collide,
// which is exactly what we want.
// NOTE: keep this in sync with src/lib/tours.js on the frontend.
// ============================================================
function deriveTourKey(artistName, eventName) {
  let s = String(eventName || '').toLowerCase();
  s = s
    .replace(/[<>\[\]（）()「」【】'"''""]/g, ' ')
    .replace(/\b(in|at|live in|live at)\b\s+[a-zà-ž\s,.-]+$/i, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(world|asia|europe|us|na)?\s*tour\b/g, ' tour ')
    .replace(/[–—\-:·|,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const artist = String(artistName || '').toLowerCase().trim();
  if (artist) {
    const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp('\\b' + escaped + '\\b', 'g'), ' ').replace(/\s+/g, ' ').trim();
  }
  const key = s.split(' ').filter(Boolean).slice(0, 6).join('-');
  return artist.replace(/\s+/g, '-') + '|' + (key || 'event');
}

// ============================================================
// ENTRY POINTS — same trigger names as v2
// ============================================================
function startWeeklyRun() {
  const CONFIG = getScheduleConfig();
  const artists = fetchAllArtists(CONFIG);
  if (!artists.length) { Logger.log('No artists found.'); return; }

  const props = PropertiesService.getScriptProperties();
  props.setProperty('schedule_artists', JSON.stringify(artists.map(a => ({ name: a.name, country: a.country }))));
  props.setProperty('schedule_index', '0');
  props.setProperty('schedule_running', 'true');

  Logger.log('=== HYPERSYNC SCHEDULE v3 — weekly run started (' + artists.length + ' artists) ===');
  processBatch();
}

function processBatch() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('schedule_running') !== 'true') { Logger.log('No active run.'); return; }

  const artists = JSON.parse(props.getProperty('schedule_artists') || '[]');
  const index = parseInt(props.getProperty('schedule_index') || '0');

  if (index >= artists.length) {
    Logger.log('=== Run complete. ===');
    props.setProperty('schedule_running', 'false');
    props.deleteProperty('schedule_artists');
    props.setProperty('schedule_index', '0');
    return;
  }

  const CONFIG = getScheduleConfig();
  const batch = artists.slice(index, index + BATCH_SIZE);
  Logger.log('=== BATCH ' + (Math.floor(index / BATCH_SIZE) + 1) + ' — ' + (index + 1) + ' to ' + (index + batch.length) + ' of ' + artists.length + ' ===');

  for (const artist of batch) {
    try {
      Logger.log('\n--- ' + artist.name + ' (' + artist.country + ') ---');
      processArtist(artist, CONFIG);
      Utilities.sleep(3000);
    } catch (e) {
      Logger.log('ERROR [' + artist.name + ']: ' + e.message);
    }
  }

  props.setProperty('schedule_index', String(index + batch.length));
  Logger.log('\nBatch done. Continuing in 30 minutes.');
}

// ============================================================
// PROCESS ONE ARTIST — now tour-aware
// ============================================================
function processArtist(artist, CONFIG) {
  const events = searchArtistEvents(artist, CONFIG);
  if (!events || !events.length) { Logger.log('  No events found.'); return; }
  Logger.log('  Found ' + events.length + ' events from search');

  const existing = fetchArtistSchedule(artist.name, CONFIG);
  Logger.log('  Existing schedule rows: ' + existing.length);

  // Cache of official tour posters found this run: tour_key → image url
  const posterCache = {};

  let inserted = 0, updated = 0, skipped = 0;

  for (const event of events) {
    try {
      const today = new Date().toISOString().split('T')[0];
      if (!event.event_date || event.event_date.indexOf('X') >= 0 || event.event_date.indexOf('?') >= 0 || event.event_date < today) {
        skipped++; continue;
      }

      const tourKey = deriveTourKey(artist.name, event.event_name);

      // v3 DEDUP: same tour + same date = same event. City spelling irrelevant.
      const match = existing.find(function (e) {
        return e.event_date === event.event_date &&
          (e.tour_key === tourKey ||
            (e.city && event.city && e.city.toLowerCase().trim() === event.city.toLowerCase().trim()));
      });

      if (match) {
        const patch = {};
        if (!match.tour_key) patch.tour_key = tourKey;
        if (!match.ticket_url && event.ticket_url) patch.ticket_url = event.ticket_url;
        if (Object.keys(patch).length) {
          updateScheduleRow(match.airtable_id, patch, CONFIG);
          updated++;
          Logger.log('  ↑ Updated: ' + event.event_name + ' @ ' + (event.city || '?'));
        } else skipped++;
        continue;
      }

      // Official graphic: scrape the ticket page's og:image once per tour
      let poster = posterCache[tourKey] || '';
      if (!poster && event.ticket_url) {
        poster = scrapeOgImageFromUrl(event.ticket_url);
        if (poster) {
          posterCache[tourKey] = poster;
          Logger.log('  🎨 Poster found via ticket page');
        }
        Utilities.sleep(500);
      }

      const newId = generateId();
      if (insertScheduleRow(newId, artist, event, tourKey, CONFIG)) {
        // Only ONE announcement per tour per run — first leg carries it.
        const tourAlreadyAnnounced = existing.some(function (e) { return e.tour_key === tourKey; }) ||
          Object.prototype.hasOwnProperty.call(posterCache, tourKey + '__announced');
        if (!tourAlreadyAnnounced) {
          createAnnouncement(newId, artist, event, tourKey, poster, CONFIG);
          posterCache[tourKey + '__announced'] = true;
        }
        existing.push({ airtable_id: '', event_date: event.event_date, city: event.city || '', ticket_url: event.ticket_url || '', tour_key: tourKey });
        inserted++;
        Logger.log('  ✓ New: ' + event.event_name + ' @ ' + (event.city || '?') + ' on ' + event.event_date + ' [' + tourKey + ']');
      }
      Utilities.sleep(300);
    } catch (e) {
      Logger.log('  ERR processing event: ' + e.message);
    }
  }

  Logger.log('  Results — inserted: ' + inserted + ', updated: ' + updated + ', skipped: ' + skipped);
}

// ============================================================
// ONE-TIME CLEANUP TOOLS — run each ONCE, in this order
// ============================================================

// 1) Tag every existing row with its tour_key
function backfillTourKeys() {
  const CONFIG = getScheduleConfig();
  Logger.log('=== BACKFILL tour_key ===');

  const jobs = [
    { table: TABLES.SCHEDULE,      artistField: 'artist_name',    nameField: 'event_name' },
    { table: TABLES.ANNOUNCEMENTS, artistField: 'override_artist', nameField: 'override_title' },
  ];

  for (const job of jobs) {
    let offset = null, tagged = 0;
    do {
      let url = 'https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + job.table + '?pageSize=100';
      if (offset) url += '&offset=' + offset;
      const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) break;
      const data = JSON.parse(res.getContentText());
      offset = data.offset || null;

      for (const r of (data.records || [])) {
        if (r.fields.tour_key) continue;
        const key = deriveTourKey(r.fields[job.artistField] || '', r.fields[job.nameField] || '');
        UrlFetchApp.fetch('https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + job.table + '/' + r.id, {
          method: 'PATCH',
          headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN, 'Content-Type': 'application/json' },
          payload: JSON.stringify({ fields: { tour_key: key } }),
          muteHttpExceptions: true,
        });
        tagged++;
        Utilities.sleep(220);
      }
    } while (offset);
    Logger.log('  ' + job.table + ': tagged ' + tagged + ' rows');
  }
  Logger.log('=== Backfill done. Now run cleanupDuplicates() ===');
}

// 2) Delete clones: same tour_key + same date. Keeper = has image,
//    then has ticket_url, then oldest created.
function cleanupDuplicates() {
  const CONFIG = getScheduleConfig();
  Logger.log('=== CLEANUP duplicates ===');

  const jobs = [
    { table: TABLES.SCHEDULE, dateField: 'event_date',
      score: function (f) { return (f.ticket_url ? 2 : 0); } },
    { table: TABLES.ANNOUNCEMENTS, dateField: 'override_date',
      score: function (f) { return (f.image_url ? 4 : 0) + (f.custom_text ? 1 : 0); } },
  ];

  for (const job of jobs) {
    const rows = [];
    let offset = null;
    do {
      let url = 'https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + job.table + '?pageSize=100';
      if (offset) url += '&offset=' + offset;
      const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) break;
      const data = JSON.parse(res.getContentText());
      offset = data.offset || null;
      for (const r of (data.records || [])) rows.push(r);
    } while (offset);

    const groups = {};
    for (const r of rows) {
      const key = (r.fields.tour_key || 'none') + '__' + (r.fields[job.dateField] || 'nodate');
      (groups[key] = groups[key] || []).push(r);
    }

    const toDelete = [];
    for (const key in groups) {
      const g = groups[key];
      if (g.length < 2 || key.indexOf('none__') === 0) continue;
      g.sort(function (a, b) {
        const d = job.score(b.fields) - job.score(a.fields);
        return d !== 0 ? d : new Date(a.createdTime) - new Date(b.createdTime);
      });
      for (let i = 1; i < g.length; i++) toDelete.push(g[i].id);
    }

    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 10) {
      const batch = toDelete.slice(i, i + 10);
      const qs = batch.map(function (id) { return 'records[]=' + id; }).join('&');
      const res = UrlFetchApp.fetch('https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + job.table + '?' + qs, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true,
      });
      if (res.getResponseCode() === 200) deleted += batch.length;
      Utilities.sleep(300);
    }
    Logger.log('  ' + job.table + ': deleted ' + deleted + ' duplicates (kept the best of each group)');
  }
  Logger.log('=== Cleanup done. Optionally run backfillImages() ===');
}

// 3) For announcements with no image: scrape og:image from the tour's
//    ticket_url in SCHEDULES. Processes 40 per run — run repeatedly
//    until it logs 0 remaining.
function backfillImages() {
  const CONFIG = getScheduleConfig();
  Logger.log('=== BACKFILL images from ticket pages ===');

  // Build tour_key → ticket_url map from schedule
  const ticketByTour = {};
  let offset = null;
  do {
    let url = 'https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.SCHEDULE + '?pageSize=100';
    if (offset) url += '&offset=' + offset;
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) break;
    const data = JSON.parse(res.getContentText());
    offset = data.offset || null;
    for (const r of (data.records || [])) {
      if (r.fields.tour_key && r.fields.ticket_url && !ticketByTour[r.fields.tour_key]) {
        ticketByTour[r.fields.tour_key] = r.fields.ticket_url;
      }
    }
  } while (offset);

  // Announcements missing images
  const filter = encodeURIComponent("AND({image_url}='',NOT({tour_key}=''))");
  const res = UrlFetchApp.fetch(
    'https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.ANNOUNCEMENTS + '?pageSize=100&filterByFormula=' + filter,
    { headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) { Logger.log('Fetch failed'); return; }
  const records = JSON.parse(res.getContentText()).records || [];
  Logger.log('  Announcements without images: ' + records.length + ' (processing up to 40)');

  const cache = {};
  let filled = 0;
  for (const r of records.slice(0, 40)) {
    const key = r.fields.tour_key;
    const ticket = ticketByTour[key];
    if (!ticket) continue;
    if (!(key in cache)) {
      cache[key] = scrapeOgImageFromUrl(ticket);
      Utilities.sleep(700);
    }
    if (cache[key]) {
      UrlFetchApp.fetch('https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.ANNOUNCEMENTS + '/' + r.id, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN, 'Content-Type': 'application/json' },
        payload: JSON.stringify({ fields: { image_url: cache[key] } }),
        muteHttpExceptions: true,
      });
      filled++;
      Logger.log('  🎨 ' + (r.fields.override_title || '').substring(0, 60));
      Utilities.sleep(220);
    }
  }
  Logger.log('=== Filled ' + filled + '. Re-run until it reports 0 without images. ===');
}

// ============================================================
// AUTO-DELETE — unchanged from v2 (daily 3am trigger)
// ============================================================
function deleteOldRecords() {
  const CONFIG = getScheduleConfig();
  const today = new Date().toISOString().split('T')[0];
  Logger.log('=== DELETE OLD RECORDS — before ' + today + ' ===');

  const jobs = [
    { table: TABLES.SCHEDULE, filter: "AND({event_date}<'" + today + "')" },
    { table: TABLES.ANNOUNCEMENTS, filter: "AND({override_date}<'" + today + "')" },
  ];

  for (const job of jobs) {
    try {
      const toDelete = [];
      let offset = null;
      do {
        let url = 'https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + job.table + '?pageSize=100&filterByFormula=' + encodeURIComponent(job.filter);
        if (offset) url += '&offset=' + offset;
        const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true });
        if (res.getResponseCode() !== 200) break;
        const data = JSON.parse(res.getContentText());
        offset = data.offset || null;
        for (const r of (data.records || [])) toDelete.push(r.id);
      } while (offset);

      let deleted = 0;
      for (let i = 0; i < toDelete.length; i += 10) {
        const batch = toDelete.slice(i, i + 10);
        const qs = batch.map(function (id) { return 'records[]=' + id; }).join('&');
        const res = UrlFetchApp.fetch('https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + job.table + '?' + qs, {
          method: 'DELETE', headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true,
        });
        if (res.getResponseCode() === 200) deleted += batch.length;
        Utilities.sleep(300);
      }
      Logger.log('  ' + job.table + ': deleted ' + deleted + ' past rows');
    } catch (e) {
      Logger.log('  delete error: ' + e.message);
    }
  }
  Logger.log('=== CLEANUP DONE ===');
}

// ============================================================
// GEMINI SEARCH — unchanged from v2
// ============================================================
function searchArtistEvents(artist, CONFIG) {
  const currentYear = new Date().getFullYear();
  const prompt = 'Find all confirmed upcoming events for "' + artist.name + '" (' + artist.country + ') from today through end of ' + (currentYear + 1) + '. Include concerts, tours, festivals, fan meets, single/album releases, TV appearances, award shows.\n\nReturn ONLY a JSON array (no markdown, no explanation):\n[{"event_name":"...","event_type":"CONCERT|FESTIVAL|FAN MEET|SINGLE RELEASE|ALBUM RELEASE|TV GUESTING|AWARD SHOW","venue":"...","city":"...","country":"...","event_date":"YYYY-MM-DD","ticket_url":"...","confidence":"CONFIRMED"}]\n\nOnly CONFIRMED events. If none found return [].';

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + CONFIG.GEMINI_API_KEY,
        { method: 'POST', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true }
      );
      const code = res.getResponseCode();
      if (code === 503) { Utilities.sleep(5000); continue; }
      if (code !== 200) { Logger.log('  search error ' + code); return []; }

      const rawText = (JSON.parse(res.getContentText()).candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (!rawText) return [];
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start === -1 || end === -1 || end < start) return [];
      let events;
      try { events = JSON.parse(cleaned.substring(start, end + 1)); } catch (e) { return []; }
      return events.filter(function (e) { return e.confidence !== 'RUMORED' && e.event_date; });
    } catch (e) {
      Logger.log('  search err (attempt ' + attempt + '): ' + e.message);
      if (attempt < 3) Utilities.sleep(2000);
    }
  }
  return [];
}

// ============================================================
// OG:IMAGE from any URL (ticket pages, festival sites)
// ============================================================
function scrapeOgImageFromUrl(url) {
  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    if (res.getResponseCode() !== 200) return '';
    const html = res.getContentText().substring(0, 40000);
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (og && og[1] && og[1].indexOf('http') === 0) return og[1].replace(/&amp;/g, '&');
    const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (tw && tw[1] && tw[1].indexOf('http') === 0) return tw[1].replace(/&amp;/g, '&');
  } catch (e) {}
  return '';
}

// ============================================================
// AIRTABLE HELPERS
// ============================================================
function fetchAllArtists(CONFIG) {
  const artists = [];
  let offset = null;
  do {
    let url = 'https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.ARTISTS + '?pageSize=100&fields[]=name&fields[]=country';
    if (offset) url += '&offset=' + offset;
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) break;
    const data = JSON.parse(res.getContentText());
    for (const r of (data.records || [])) {
      const name = (r.fields.name || '').trim();
      const country = (r.fields.country || '').trim().toUpperCase();
      if (name) artists.push({ name: name, country: country });
    }
    offset = data.offset || null;
  } while (offset);
  return artists;
}

function fetchArtistSchedule(artistName, CONFIG) {
  const records = [];
  let offset = null;
  const filter = encodeURIComponent("AND({artist_name}='" + artistName.replace(/'/g, "\\'") + "')");
  do {
    let url = 'https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.SCHEDULE + '?pageSize=100&filterByFormula=' + filter;
    if (offset) url += '&offset=' + offset;
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) break;
    const data = JSON.parse(res.getContentText());
    for (const r of (data.records || [])) {
      records.push({
        airtable_id: r.id,
        event_date:  r.fields.event_date || '',
        city:        r.fields.city || '',
        ticket_url:  r.fields.ticket_url || '',
        tour_key:    r.fields.tour_key || '',
      });
    }
    offset = data.offset || null;
  } while (offset);
  return records;
}

function insertScheduleRow(id, artist, event, tourKey, CONFIG) {
  const fields = {
    artist_name:    artist.name,
    artist_country: artist.country,
    event_name:     event.event_name || '',
    venue:          event.venue || 'TBA',
    city:           event.city || '',
    country:        event.country || '',
    event_date:     event.event_date || '',
    ticket_url:     event.ticket_url || '',
    source:         'gemini_web_search',
    event_type:     event.event_type || 'CONCERT',
    confidence:     event.confidence || 'CONFIRMED',
    tour_key:       tourKey,
    created_at:     new Date().toISOString(),
  };
  const res = UrlFetchApp.fetch('https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.SCHEDULE, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('  SCHEDULE insert error: ' + res.getContentText().substring(0, 200));
    return false;
  }
  return true;
}

function updateScheduleRow(airtableId, fields, CONFIG) {
  const res = UrlFetchApp.fetch('https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.SCHEDULE + '/' + airtableId, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) Logger.log('  SCHEDULE update error: ' + res.getContentText().substring(0, 200));
}

// v3: starts INACTIVE (review gate) + carries tour_key + poster
function createAnnouncement(scheduleId, artist, event, tourKey, poster, CONFIG) {
  const fields = {
    schedule_id:     scheduleId,
    override_title:  event.event_name || '',
    override_artist: artist.name,
    override_date:   event.event_date || '',
    image_url:       poster || '',
    custom_text:     '',
    show_from:       '',
    tour_key:        tourKey,
    active:          false, // ← review gate: flip the checkbox to publish
    created_at:      new Date().toISOString(),
  };
  const res = UrlFetchApp.fetch('https://api.airtable.com/v0/' + CONFIG.AIRTABLE_BASE_ID + '/' + TABLES.ANNOUNCEMENTS, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + CONFIG.AIRTABLE_WRITE_TOKEN, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) Logger.log('  ANNOUNCEMENT insert error: ' + res.getContentText().substring(0, 200));
}

// ============================================================
// MANUAL / DEBUG — unchanged surface
// ============================================================
function runForArtist(artistName) {
  const CONFIG = getScheduleConfig();
  const artists = fetchAllArtists(CONFIG);
  const artist = artists.find(function (a) { return a.name.toLowerCase() === artistName.toLowerCase(); });
  if (!artist) { Logger.log('Artist not found: ' + artistName); return; }
  processArtist(artist, CONFIG);
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function checkProgress() {
  const props = PropertiesService.getScriptProperties().getProperties();
  Logger.log('Running: ' + props.schedule_running);
  const index = parseInt(props.schedule_index || '0');
  const artists = JSON.parse(props.schedule_artists || '[]');
  Logger.log('Progress: ' + index + ' / ' + artists.length);
}

function setupScheduleTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['startWeeklyRun', 'processBatch', 'deleteOldRecords'].indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('startWeeklyRun').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  ScriptApp.newTrigger('processBatch').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('deleteOldRecords').timeBased().everyDays(1).atHour(3).create();
  Logger.log('✓ Triggers set (same schedule as v2).');
}
