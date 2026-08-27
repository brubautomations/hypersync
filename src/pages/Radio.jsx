import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   HYPERSYNC RADIO — standalone window (route: /radio)

   Opened with window.open() from the nav, so it's a real
   browser window the OS can move and resize. Layout:

     [ show art from Airtable    ][ local time ]
     [ canvas / visualizer — the show's own loop ]
     [ now playing + controls + schedule         ]

   The page covers the whole viewport, so the site's navbar
   and chat rail don't show through in the popup.

   Each show carries its own loop in the SHOWS table's
   Canvas attachment field. Shows without one fall back to
   animated bars.
   ============================================================ */

// 100ms of silence. iOS only lets an <audio> element play if that exact
// element was started inside a real tap, so on TUNE IN we play this through
// every deck to unlock them. Without it the first song plays and the
// crossfade to the second deck gets refused.
const SILENCE = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

const CFG = {
  API: "/api/station",
  LOGO: "/radio-logo.png",
  TZ: 8,                    // Manila, no DST

  SONGS_MIN: 4,
  SONGS_MAX: 5,
  ADS_MAX: 2,             // most spots in one in-show break
  BREAK_ADS_MIN: 45,      // in-show stopset length, seconds
  BREAK_ADS_MAX: 95,      // anything longer than this is left for the gaps

  // Break composition. Each piece rolls on its own, so no two breaks match.
  P_BREAK_OUTRO: 0.55,    // outro of the song that just ended
  P_BREAK_DROP: 0.85,     // DJ drop before the ads
  P_BREAK_TAIL: 0.90,     // station ID or DJ drop coming out of the ads
  P_BREAK_LAST: 0.45,     // one more line heading back into the music
  P_MID_LINE: 0.12,       // chance of an intro/outro landing mid-set

  TALKOVER: 6.0,          // seconds an outro rides over the song's tail
  XFADE_MIN: 0.9,         // never hard-cut between two items
  PROBE_MS: 6000,         // per-file ceiling when reading a length
  PROBE_TOTAL_MS: 6000,   // and a hard ceiling on the whole batch
  DEFAULT_DUR: 210,       // assumed length when a file won't say — never drop it

  XFADE: 2.0,
  XFADE_VOICE: 0.6,
  DUCK: 0.28,
  REFRESH_MIN: 30,
};

/* ---------- clock ---------- */
const tzShift = () => (CFG.TZ * 60 + new Date().getTimezoneOffset()) * 60000;
const nowManila = () => new Date(Date.now() + tzShift());
const toMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const clock = (d) =>
  [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0")).join(":");
// The station runs on Manila time, so that column is the one that matters;
// the rest are there so an overseas listener can place themselves.
const ZONES = [
  { label: "MANILA / SG", tz: "Asia/Manila", home: true },
  { label: "TOKYO / SEOUL", tz: "Asia/Tokyo" },
  { label: "DUBAI", tz: "Asia/Dubai" },
  { label: "LA", tz: "America/Los_Angeles" },
];

const zoneTime = (tz) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date());
  } catch { return "--:--"; }
};

const label = (mins) => {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const ap = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`;
};

/* ---------- deterministic randomness ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- rotation ----------
   Deals a pool out COMPLETELY before anything repeats, and remembers where it
   got to across rebuilds, page reloads and library refreshes.

   Two things this has to survive:
   • Airtable regenerates attachment URLs on every fetch, so progress is
     tracked by record id — a URL would look like a brand-new file each time.
   • The running order is rebuilt often. Without persistence every rebuild
     restarted the same seeded shuffle, so only the first few spots in that
     order were ever heard. */
const ROT_KEY = "hsr_rotation_v2";
const DUR_KEY = "hsr_durations_v1";

function loadRot() {
  try { return JSON.parse(localStorage.getItem(ROT_KEY) || "{}"); } catch { return {}; }
}
function saveRot(state) {
  try { localStorage.setItem(ROT_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function takeFromBag(state, pool, rnd) {
  if (!pool.length) return null;
  if (!Array.isArray(state.played)) state.played = [];

  const byId = new Map(pool.map((x) => [x.id || x.url, x]));
  const ids = [...byId.keys()];

  // Anything not yet played this pass. When they've all had a turn, start a
  // new pass — and keep the most recent picks out of the front of it.
  let left = ids.filter((id) => !state.played.includes(id));
  if (!left.length) {
    const tail = state.played.slice(-Math.max(1, Math.floor(ids.length / 3)));
    state.played = [];
    left = ids.filter((id) => !tail.includes(id));
    if (!left.length) left = ids.slice();
  }

  const pick = shuffled(left, rnd)[0];
  state.played.push(pick);
  // forget ids that have left the pool entirely
  state.played = state.played.filter((id) => byId.has(id));
  return byId.get(pick);
}

/* ---------- duration probing ----------
   Every listener has to arrive at the SAME number for every track,
   or their timelines drift apart and they hear different songs.
   So: whole seconds only, no timing-dependent fallbacks. A track
   whose length can't be established is dropped from rotation for
   everyone rather than guessed at. */
// Real file lengths, remembered between visits. The timeline is built from
// these, so once a browser has heard something it computes the same running
// order as everyone else — which is what keeps listeners together.
const durCache = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(DUR_KEY) || "{}");
  for (const k of Object.keys(saved)) durCache.set(k, saved[k]);
} catch { /* private mode */ }

let durSaveTimer = null;
function rememberDurations() {
  clearTimeout(durSaveTimer);
  durSaveTimer = setTimeout(() => {
    try { localStorage.setItem(DUR_KEY, JSON.stringify(Object.fromEntries(durCache))); }
    catch { /* ignore */ }
  }, 2000);
}

function readDuration(url, ms) {
  return new Promise((res) => {
    const a = new Audio();
    a.preload = "metadata";
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      a.src = "";
      res(v);
    };
    a.onloadedmetadata = () =>
      done(isFinite(a.duration) && a.duration > 1 ? Math.round(a.duration) : 0);
    a.onerror = () => done(0);
    setTimeout(() => done(0), ms);
    a.src = url;
  });
}

// If Airtable has a Duration we use it and never touch the file. Otherwise we
// read it once — with a short ceiling, because the running order can't be
// built until these come back and a slow file would hold up the whole station.
async function probe(item) {
  const url = typeof item === "string" ? item : item.url;
  if (durCache.has(url)) return durCache.get(url);

  const given = typeof item === "object" ? Number(item.dur) || 0 : 0;
  if (given > 0) {
    durCache.set(url, Math.round(given));
    return durCache.get(url);
  }

  const d = await readDuration(url, CFG.PROBE_MS);
  durCache.set(url, d);
  return d;
}

// Never let one slow file stall everything — take what we have and move on.
function probeAll(list) {
  const jobs = list.map(probe);
  return Promise.race([
    Promise.all(jobs),
    new Promise((r) => setTimeout(r, CFG.PROBE_TOTAL_MS)),
  ]);
}

export default function Radio() {
  const [lib, setLib] = useState(null);
  const [err, setErr] = useState("");
  const [live, setLive] = useState(false);
  const [block, setBlock] = useState(null);
  const [nowItem, setNowItem] = useState(null);
  const [, setTick] = useState(0);
  const [vol, setVol] = useState(0.85);
  const [listOpen, setListOpen] = useState(false);
  // the readout is for you, not listeners: hypersync.live/radio?debug=1
  const fillMode = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("fill") === "1";
  const debug = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";
  const [empty, setEmpty] = useState(false);
  const [fill, setFill] = useState(null);   // one-time duration fill
  const [pool, setPool] = useState(0);
  const [audioErr, setAudioErr] = useState("");
  const [badCount, setBadCount] = useState(0);

  const deck = useRef([]);
  const active = useRef(0);
  const line = useRef([]);
  const timer = useRef(null);
  const cursor = useRef(-1);
  const handing = useRef(false);
  const preload = useRef(null);
  const queueShow = useRef(null);
  const rollRef = useRef(null);
  const handoffRef = useRef(null);
  const blockRef = useRef(null);
  const blkRef = useRef(null);
  const locateRef = useRef(null);
  const rot = useRef(loadRot());
  const liveRef = useRef(false);

  useEffect(() => { document.title = "HYPERSYNC RADIO"; }, []);

  /* ---------- audio decks ---------- */
  useEffect(() => {
    const mk = () => { const a = new Audio(); a.preload = "auto"; return a; };
    deck.current = [mk(), mk()];
    return () => deck.current.forEach((a) => { a.pause(); a.src = ""; });
  }, []);

  useEffect(() => {
    deck.current.forEach((a) => { if (a) a.volume = vol; });
  }, [vol]);

  /* ---------- library ---------- */
  const load = useCallback(async () => {
    try {
      const r = await fetch(CFG.API);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (!j.shows?.length) throw new Error("No shows found in the SHOWS table.");
      j.shows.sort((a, b) => toMin(a.start) - toMin(b.start));
      setLib(j); setErr("");
    } catch (e) { setErr(e.message || String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, CFG.REFRESH_MIN * 60000);
    return () => clearInterval(id);
  }, [load]);

  /* ---------- which show is on ---------- */
  const findBlock = useCallback((t) => {
    if (!lib) return null;
    const m = t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60;
    for (const s of lib.shows) {
      const a = toMin(s.start), b = toMin(s.end);
      if (b <= a) {
        if (m >= a) return { show: s, start: a, end: b + 1440, wrap: false };
        if (m < b) return { show: s, start: a - 1440, end: b, wrap: true };
      } else if (m >= a && m < b) return { show: s, start: a, end: b, wrap: false };
    }
    return null;
  }, [lib]);

  // Between shows: the window from one show's end to the next one's start.
  const findGap = useCallback((t) => {
    if (!lib?.shows?.length) return null;
    const m = t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60;
    const spans = lib.shows.map((s) => ({ a: toMin(s.start), b: toMin(s.end) }));
    for (let i = 0; i < spans.length; i++) {
      const end = spans[i].b;
      const next = spans[(i + 1) % spans.length].a;
      const gapEnd = next <= end ? next + 1440 : next;
      if (m >= end && m < gapEnd) return { show: null, start: end, end: gapEnd, wrap: false, gap: true };
      if (m + 1440 >= end && m + 1440 < gapEnd)
        return { show: null, start: end - 1440, end: gapEnd - 1440, wrap: false, gap: true };
    }
    return null;
  }, [lib]);

  /* ---------- running order ---------- */
  const build = useCallback(async (t) => {
    if (!lib) return { items: [], blk: null };

    // xf is how much the NEXT item overlaps this one — the player reads it
    // back so the audio crossfade matches the timeline exactly.
    // Nothing is ever refused for "not fitting" — an item that runs past the
    // hour simply finishes and the next block starts after it. `at` is only
    // used to pick a rough starting point for someone tuning in.
    const put = (list, o, dur, at, endSec, xfade) => {
      if (!dur) dur = CFG.DEFAULT_DUR;
      list.push({ ...o, at, dur, xf: xfade || 0 });
      return at + dur - (xfade || 0);
    };

    // ---------- between shows: ads only ----------
    const gap = findBlock(t) ? null : findGap(t);
    if (gap) {
      const rnd = mulberry32(seed(`${t.toISOString().slice(0, 10)}|gap|${gap.start}`));
      const adQ = shuffled(lib.ads, rnd);
      if (!adQ.length) return { items: [], blk: gap, empty: true, forShowId: null };

      await probeAll(adQ);

      const items = [];
      let at = gap.start * 60;
      const endSec = gap.end * 60;
      const R = rot.current;
      if (!R.ad) R.ad = {};
      let guard = 0;
      while (at < endSec && guard++ < 200) {
        const ad = takeFromBag(R.ad, adQ, rnd);
        if (!ad) break;
        at = put(items, { kind: "ad", title: ad.sponsor || "Advertisement", artist: "", url: ad.url },
          durCache.get(ad.url) || CFG.DEFAULT_DUR, at, endSec, 0);
      }
      // Sign off the break with a station ID for the show that's ABOUT to
      // start — it announces what's coming rather than what just finished.
      const nextStart = ((gap.end % 1440) + 1440) % 1440;
      const incoming = lib.shows.find((s) => toMin(s.start) === nextStart);
      if (incoming) {
        const ids = lib.drops.filter(
          (d) => /station/i.test(d.type || "") &&
                 (!d.shows.length || d.shows.includes(incoming.id))
        );
        if (ids.length) {
          const id = shuffled(ids, rnd)[0];
          await probe(id);
          put(items, { kind: "voice", title: "HYPERSYNC RADIO", artist: "", url: id.url },
            durCache.get(id.url) || 10, at, endSec, 0);
        }
      }

      saveRot(rot.current);
      return { items, blk: gap, forShowId: null };
    }

    // ---------- inside a show ----------
    let blk = findBlock(t);
    if (!blk && lib.shows.length) {
      // Belt and braces: with a loaded schedule the station should never be
      // "between shows" with nothing to play. Fall back to whichever show
      // started most recently.
      const m = t.getHours() * 60 + t.getMinutes();
      let best = null, bestGap = Infinity;
      for (const s of lib.shows) {
        const a = toMin(s.start);
        const behind = (m - a + 1440) % 1440;
        if (behind < bestGap) { bestGap = behind; best = s; }
      }
      if (best) blk = { show: best, start: toMin(best.start), end: toMin(best.start) + 1440, wrap: false };
    }
    if (!blk) return { items: [], blk: null, forShowId: null };

    const rnd = mulberry32(seed(`${t.toISOString().slice(0, 10)}|${blk.show.id}`));

    const dayStart = new Date(t);
    dayStart.setHours(0, 0, 0, 0);
    const blockStartMs = dayStart.getTime() + blk.start * 60000;

    const tagged = lib.songs.filter((s) => s.shows.includes(blk.show.id));
    const settled = tagged.filter(
      (s) => !s.created || new Date(s.created).getTime() + tzShift() < blockStartMs
    );
    const poolAll = settled.length ? settled : tagged;
    setPool(poolAll.length);
    if (!poolAll.length) return { items: [], blk, empty: true };

    const forShow = (d) => !d.shows.length || d.shows.includes(blk.show.id);
    const isID = (d) => /station/i.test(d.type || "");
    const djQ = shuffled(lib.drops.filter((d) => forShow(d) && !isID(d)), rnd);
    const idQ = shuffled(lib.drops.filter((d) => forShow(d) && isID(d)), rnd);
    const adQ = shuffled(lib.ads, rnd);

    await probeAll([...poolAll, ...djQ, ...idQ, ...adQ]);

    // A file that hasn't reported its length yet still gets played — we just
    // estimate it. Playback advances off the real audio, so a wrong estimate
    // only shifts where a fresh listener drops in, and it self-corrects.
    const playable = poolAll;
    setBadCount(poolAll.filter((s) => !durCache.get(s.url)).length);

    // Rotation carries across rebuilds. Without this, every rebuild restarted
    // the shuffled order from the top and you'd hear the same ad and the same
    // station ID over and over.
    // Ads rotate station-wide and are never reset — every spot gets played
    // before any of them comes round again, however long that takes.
    // Drops and IDs are per-show, so they reset when the show does.
    const R = rot.current;
    if (!R.ad) R.ad = {};
    if (!R.byShow) R.byShow = {};
    if (!R.byShow[blk.show.id]) R.byShow[blk.show.id] = { dj: {}, id: {}, song: {} };
    if (!R.byShow[blk.show.id].song) R.byShow[blk.show.id].song = {};
    R.dj = R.byShow[blk.show.id].dj;
    R.id = R.byShow[blk.show.id].id;
    R.song = R.byShow[blk.show.id].song;
    R.showId = blk.show.id;

    // drop the old object-based bag if it's still in storage from a previous build
    delete R.bag; delete R.lastPlayed;

    // Songs rotate per show on the same id-based bag as everything else, so
    // every track in a show gets played before any of them comes round again
    // — and it survives reloads instead of restarting at the top.
    const nextSong = () => takeFromBag(R.song, playable, rnd);
    const pick = (a) => (a && a.length ? a[Math.floor(rnd() * a.length)] : null);

    const items = [];
    let at = blk.start * 60;
    const endSec = blk.end * 60;

    const place = (o, xfade) => {
      at = put(items, o, durCache.get(o.url) || CFG.DEFAULT_DUR, at, endSec, xfade);
      return true;
    };
    // Voice lines run clean — nothing overlaps them on the way out.
    // A voice line is never followed by another of the same kind: no two DJ
    // drops back to back, no two station IDs back to back.
    let lastVoice = null;
    const voice = (url, kind) => {
      if (!url) return false;
      const prev = items[items.length - 1];
      if (kind && prev && prev.kind === "voice" && lastVoice === kind) return false;
      const ok = place({ kind: "voice", title: "HYPERSYNC RADIO", artist: "", url }, 0);
      if (ok) lastVoice = kind || null;
      return ok;
    };
    const song = (s, xf) =>
      place({ kind: "song", title: s.title, artist: s.artist, url: s.url },
        xf === undefined ? CFG.XFADE : xf);

    const nextDJ = () => takeFromBag(R.dj, djQ, rnd)?.url || null;
    const nextID = () => takeFromBag(R.id, idQ, rnd)?.url || null;
    const nextAd = () => takeFromBag(R.ad, adQ, rnd);

    // the show opens with the DJ
    voice(nextDJ(), "dj");

    let pending = null, guard = 0;
    outer: while (at < endSec && guard++ < 400) {
      const n = CFG.SONGS_MIN + Math.floor(rnd() * (CFG.SONGS_MAX - CFG.SONGS_MIN + 1));
      const set = pending || Array.from({ length: n }, nextSong);
      pending = null;

      for (let k = 0; k < set.length; k++) {
        const last = k === set.length - 1;

        // Decide what follows this song BEFORE placing it — an outro has to
        // ride over the song's tail, so the song needs the longer overlap.
        let mid = null, midIsOutro = false;
        if (!last && rnd() < CFG.P_MID_LINE) {
          midIsOutro = rnd() < 0.5;
          mid = midIsOutro ? pick(set[k].outros) : pick(set[k + 1].intros);
        }
        const breakOutro = last && rnd() < CFG.P_BREAK_OUTRO ? pick(set[k].outros) : null;

        const talkedOver = breakOutro || (mid && midIsOutro);
        if (!song(set[k], talkedOver ? CFG.TALKOVER : CFG.XFADE)) break outer;

        if (mid) voice(mid);
        if (breakOutro) voice(breakOutro);
      }

      const setLen = CFG.SONGS_MIN + Math.floor(rnd() * (CFG.SONGS_MAX - CFG.SONGS_MIN + 1));
      pending = Array.from({ length: setLen }, nextSong);

      // ---- break ----

      let beforeType = null;
      if (rnd() < CFG.P_BREAK_DROP && voice(nextDJ(), "dj")) beforeType = "dj";

      // Stopsets are capped by TIME, not by a count. Spots of mixed length
      // sort themselves out, and anything too long to fit — like a 3-minute
      // spot — is passed over here and lands in the between-shows gap instead.
      if (adQ.length) {
        const budget =
          CFG.BREAK_ADS_MIN + rnd() * (CFG.BREAK_ADS_MAX - CFG.BREAK_ADS_MIN);
        let spent = 0, count = 0;
        while (spent < budget && count < CFG.ADS_MAX) {
          const ad = nextAd();
          if (!ad) break;
          place({ kind: "ad", title: ad.sponsor || "Advertisement", artist: "", url: ad.url }, 0);
          spent += durCache.get(ad.url) || 45;
          count++;
        }
      }

      // coming out of the ads — never the same kind as went in
      let tailType = null;
      if (rnd() < CFG.P_BREAK_TAIL) {
        if (beforeType === "dj") { if (voice(nextID(), "id")) tailType = "id"; }
        else if (voice(nextID(), "id")) tailType = "id";
        else if (voice(nextDJ(), "dj")) tailType = "dj";
      }

      // …and sometimes one more heading back into the music, always the
      // opposite kind so you never get two of the same back to back
      if (tailType && rnd() < CFG.P_BREAK_LAST) {
        if (tailType === "id") voice(nextDJ(), "dj");
        else voice(nextID(), "id");
      }
    }

    saveRot(rot.current);
    return { items, blk, forShowId: blk?.show?.id || null };
  }, [lib, findBlock, findGap]);

  const locate = useCallback((t, items, blk) => {
    // An overnight block that began yesterday is laid out with negative
    // seconds, so today's clock time already lines up — no day offset here.
    const sec = t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (sec >= it.at && sec < it.at + it.dur) return { i, off: sec - it.at };
    }
    return null;
  }, []);

  /* ---------- playback ----------
     Driven by the audio itself, not by the clock. An item always finishes:
     the handoff is armed off the real remaining time, so buffering delays
     the next item instead of cutting the current one. The next file is
     preloaded well ahead so it starts without a gap. */

  const startItem = useCallback((i, offset) => {
    const items = line.current;
    const it = items[i];
    if (!it) return;

    cursor.current = i;
    handing.current = false;

    const cur = deck.current[active.current];

    cur.ontimeupdate = null;
    cur.onended = null;
    setAudioErr("");

    // The running order is built from estimates when a file hasn't reported
    // its length. Once the element knows, record it — the next build is then
    // accurate and the clock stops disagreeing with what's actually playing.
    const learn = () => {
      const d = cur.duration;
      if (d && isFinite(d) && d > 1) { durCache.set(it.url, Math.round(d)); rememberDurations(); }
    };
    cur.addEventListener("loadedmetadata", learn, { once: true });
    if (cur.readyState >= 1) learn();

    cur.onerror = () =>
      setAudioErr("That file wouldn't load: " + decodeURIComponent(it.url.split("/").pop()));

    // handoff() has already started this deck and is fading it in — don't
    // touch the source or the volume, or we'd restart it and kill the fade.
    const alreadyRunning = cur.src === it.url && !cur.paused;

    if (!alreadyRunning) {
      cur.pause();
      cur.src = it.url;
      cur.volume = vol;

      const seek = Math.max(0, offset || 0);
      if (seek > 0) {
        // currentTime can't be set until the file reports its length
        const onMeta = () => {
          try { cur.currentTime = Math.min(seek, (cur.duration || seek) - 0.5); } catch { /* ignore */ }
          cur.removeEventListener("loadedmetadata", onMeta);
        };
        cur.addEventListener("loadedmetadata", onMeta);
      }

      cur.play().catch((e) =>
        setAudioErr(
          e?.name === "NotAllowedError"
            ? "Tap TUNE IN again to start audio."
            : "Playback blocked: " + (e?.message || e)
        )
      );
    }

    setNowItem(it);

    // Get the next file buffering ahead of time — but not immediately: right
    // after a handoff the idle deck is still fading the previous item out,
    // and touching its source would cut that short.
    clearTimeout(preload.current);
    const nx = items[i + 1];
    if (nx) {
      preload.current = setTimeout(() => {
        const idle = deck.current[1 - active.current];
        if (!idle || !idle.paused) return;      // still fading — leave it alone
        if (idle.src === nx.url) return;
        idle.src = nx.url;
        try { idle.load(); } catch { /* ignore */ }
      }, 4000);
    }

    // arm the crossfade off the real remaining time
    // Songs crossfade into what's next. Voice and ads never do — they play to
    // the last syllable and the next item starts after, so nothing is clipped.
    if (it.kind === "song") {
      cur.ontimeupdate = () => {
        if (handing.current) return;
        const d = cur.duration;
        if (!d || !isFinite(d)) return;
        const ov = Math.max(CFG.XFADE_MIN, Math.min(it.xf || 0, d / 3));
        if (d - cur.currentTime <= ov) {
          handing.current = true;
          handoff(i + 1, ov);
        }
      };
    }
    cur.onended = () => {
      if (handing.current) return;
      handing.current = true;
      handoffRef.current?.(i + 1, 0);
    };
  }, [vol]);

  const handoff = useCallback((i, overlap) => {
    const items = line.current;
    let it = items[i];

    // We're at a boundary — the previous item has finished, so it is safe to
    // consult the clock. This is what keeps every listener on the same item:
    // each one re-anchors to the same shared reference at every handoff.
    // Mid-item we never do this, which is why nothing gets cut.
    const t = nowManila();
    const showNow = blockRef.current?.(t)?.show?.id || null;
    if (showNow !== queueShow.current) { rollOver(); return; }

    const spot = locateRef.current?.(t, items, blkRef.current);
    if (spot) {
      i = spot.i;
      it = items[i];
      if (it) { startItem(i, spot.off); return; }
    }
    if (!it) { rollOver(); return; }

    const out = deck.current[active.current];
    const inc = deck.current[1 - active.current];

    // Detach the outgoing deck's handlers straight away. It keeps playing
    // through the crossfade, and if it reaches its natural end mid-fade its
    // onended would fire a second handoff and cut what just started.
    out.ontimeupdate = null;
    out.onended = null;

    if (inc.src !== it.url) inc.src = it.url;
    try { inc.currentTime = 0; } catch { /* ignore */ }
    inc.volume = it.kind === "voice" ? vol : 0;
    inc.play().catch(() => {});

    // overlap 0 means the previous item already finished — fade the new one
    // in quickly so it doesn't pop, but don't hold anything back.
    const ms = overlap > 0 ? overlap * 1000 : 400;
    const steps = 20;
    let s = 0;
    const fade = setInterval(() => {
      s++;
      const k = s / steps;
      // a voice sits on top and the music ducks under it; anything else fades
      out.volume = it.kind === "voice" ? vol * (1 - k * (1 - CFG.DUCK)) : vol * (1 - k);
      if (it.kind !== "voice") inc.volume = vol * k;
      if (s >= steps) {
        clearInterval(fade);
        out.pause();
        out.ontimeupdate = null;
        out.onended = null;
        inc.volume = vol;
      }
    }, ms / steps);

    active.current = 1 - active.current;
    startItem(i, 0);
  }, [vol, startItem, findBlock]);

  // Rebuild the order for whatever's on now. Called when the queue runs out,
  // when the show changes, or if audio genuinely dies — never mid-item.
  const rollOver = useCallback(async (seekToClock = false) => {
    // The library may not be here yet on a cold start. Wait for it rather
    // than blanking the schedule — and retry through a ref, so the retry
    // always uses the current state instead of the snapshot it was born in.
    if (!lib) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => rollRef.current?.(), 1500);
      return;
    }

    const t = nowManila();
    const { items, blk, empty: none, forShowId } = await build(t);
    line.current = items;
    queueShow.current = forShowId;
    setBlock(blk);
    setEmpty(!!none);
    if (!liveRef.current) return;

    if (!items.length) {
      setNowItem({ kind: "break", title: "Station break", artist: "" });
      deck.current.forEach((a) => a.pause());
      clearTimeout(timer.current);
      timer.current = setTimeout(() => rollRef.current?.(), 15000);
      return;
    }

    // Tuning in drops you wherever the station roughly is. After that it just
    // runs in order — the clock never interrupts anything again.
    if (seekToClock) {
      const spot = locate(t, items, blk);
      if (spot) { startItem(spot.i, spot.off); return; }
    }
    startItem(0, 0);
  }, [lib, build, locate, startItem]);

  const resync = rollOver;

  // iOS only lets an <audio> element play if that exact element was started
  // inside a real tap, so both decks get a moment of silence on TUNE IN.
  const unlockDecks = async () => {
    await Promise.all(
      deck.current.map(async (a) => {
        try {
          a.src = SILENCE;
          a.muted = true;
          await a.play();
          a.pause();
          a.currentTime = 0;
        } catch { /* try again on the next tap */ }
        a.muted = false;
      })
    );
  };

  const toggle = async () => {
    if (live) {
      liveRef.current = false;
      setLive(false);
      clearTimeout(timer.current);
      handing.current = false;
      deck.current.forEach((a) => {
        a.pause();
        a.ontimeupdate = null;
        a.onended = null;
      });
      setNowItem(null);
      return;
    }

    await unlockDecks();          // inside the tap, before anything async
    liveRef.current = true;
    setLive(true);

    const t = nowManila();
    const { items, blk, empty: none, forShowId } = await build(t);
    line.current = items;
    setBlock(blk);
    setEmpty(!!none);

    queueShow.current = forShowId;
    const spot = locate(t, items, blk);
    if (spot) startItem(spot.i, spot.off);
    else if (items.length) startItem(0, 0);
    else timer.current = setTimeout(() => rollRef.current?.(), 5000);
  };

  // ---- one-time: measure every file and save the lengths ----
  const runFill = useCallback(async () => {
    if (!lib) return;
    const jobs = [
      ...lib.songs.map((x) => ({ table: "SONGS", id: x.id, url: x.url })),
      ...lib.drops.map((x) => ({ table: "DROPS", id: x.id, url: x.url })),
      ...lib.ads.map((x) => ({ table: "ADS", id: x.id, url: x.url })),
    ].filter((j) => j.id && j.url);

    setFill({ done: 0, total: jobs.length, saved: 0, note: "reading…" });

    const rows = [];
    let done = 0;
    const LANES = 6;
    await Promise.all(
      Array.from({ length: LANES }, async (_, lane) => {
        for (let i = lane; i < jobs.length; i += LANES) {
          const j = jobs[i];
          const d = await readDuration(j.url, 20000);
          if (d > 0) { durCache.set(j.url, d); rows.push({ ...j, dur: d }); }
          done++;
          setFill((f) => ({ ...f, done }));
        }
      })
    );
    rememberDurations();

    setFill((f) => ({ ...f, note: "saving…" }));
    let saved = 0;
    const failed = [];
    for (let i = 0; i < rows.length; i += 40) {
      try {
        const res = await fetch(CFG.API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rows.slice(i, i + 40) }),
        });
        const j = await res.json();
        saved += j.written || 0;
        if (j.failed?.length) failed.push(...j.failed);
        if (j.error) failed.push(j.error);
      } catch (e) { failed.push(String(e.message || e)); }
      setFill((f) => ({ ...f, saved }));
    }
    setFill((f) => ({
      ...f,
      note: failed.length ? "problem: " + [...new Set(failed)].join(", ") : "done",
    }));
  }, [lib]);

  rollRef.current = rollOver;
  handoffRef.current = handoff;
  blockRef.current = findBlock;
  blkRef.current = block;
  locateRef.current = locate;

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(preload.current); }, []);

  /* ---------- watchdog ----------
     Only looks for genuinely stuck audio — a dead element, or a playhead
     that hasn't moved. It never compares against the clock and never
     interrupts something that's playing, so nothing gets cut short. */
  useEffect(() => {
    if (!live) return;
    let last = -1, still = 0;
    const id = setInterval(() => {
      const a = deck.current[active.current];
      if (!a) return;

      if (!liveRef.current) return;
      const dead = a.error || (a.paused && !handing.current);
      const frozen = !a.paused && a.currentTime === last;

      if (dead || frozen) {
        still++;
        if (still >= 4) {           // ~8 seconds of nothing happening
          still = 0;
          rollOver();
        }
      } else {
        still = 0;
      }
      last = a.currentTime;
    }, 2000);
    return () => clearInterval(id);
  }, [live, rollOver]);

  const t = nowManila();
  const shows = lib?.shows || [];
  const art = block?.show?.art || "";
  const showLabel = block
    ? (block.show ? block.show.name.toUpperCase() : "STATION BREAK")
    : "BETWEEN SHOWS";
  const onAir = live && nowItem && nowItem.kind !== "break";

  return (
    <div className="rw">
      <style>{CSS}</style>

      {fillMode && (
        <div className="rw-fill">
          <button
            className="rw-btn"
            onClick={runFill}
            disabled={!lib || (fill && fill.note !== "done" && !fill.note.startsWith("problem"))}
          >
            {fill ? "MEASURING…" : "FILL DURATIONS"}
          </button>
          <span className="rw-fillnote">
            {fill
              ? `read ${fill.done}/${fill.total} · saved ${fill.saved} · ${fill.note}`
              : lib
                ? `${lib.songs.length + lib.drops.length + lib.ads.length} files ready`
                : "loading…"}
          </span>
        </div>
      )}

      {/* ---------- show art + local time ---------- */}
      <header className="rw-head">
        {art
          ? <img className="rw-art" src={art} alt={block?.show?.name || ""} />
          : <div className="rw-art rw-art--none">
              <img src={CFG.LOGO} alt="HYPERSYNC RADIO"
                   onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>}

      </header>

      <div className="rw-status">
        <i className={onAir ? "rw-dot" : "rw-dot off"} />
        {!live ? "OFF AIR"
          : nowItem?.kind === "ad" ? "AD BREAK"
          : nowItem?.kind === "break" ? "STATION BREAK"
          : "ON AIR"}
        <span className="rw-showname">
          {showLabel}
        </span>
      </div>

      <div className="rw-clocks">
        {ZONES.map((z) => (
          <div key={z.tz} className={z.home ? "rw-clock on" : "rw-clock"}>
            <span className="rw-czone">{z.label}</span>
            <span className="rw-ctime">{zoneTime(z.tz)}</span>
          </div>
        ))}
      </div>

      {/* ---------- canvas / visualizer ---------- */}
      <div className="rw-stage">
        {block?.show?.canvas ? (
          <video
            className="rw-canvas"
            src={block.show.canvas}
            key={block.show.id}
            autoPlay loop muted playsInline
          />
        ) : (
          <div className="rw-fallback" aria-hidden="true">
            <span /><span /><span /><span /><span />
            <span /><span /><span /><span /><span />
          </div>
        )}
        <div className="rw-veil" />

        <div className="rw-meta">
          <h1 className="rw-title">
            {nowItem ? nowItem.title
              : empty && block?.gap ? "Station break"
              : empty ? "No songs tagged for this show"
              : "Ready when you are"}
          </h1>
          <div className="rw-by">
            {nowItem ? (nowItem.artist || "").toUpperCase()
              : empty && block?.gap ? "NOTHING IN ADS — BACK WHEN THE NEXT SHOW STARTS"
              : empty ? "OPEN SONGS IN AIRTABLE AND FILL THE SHOWS COLUMN"
              : ""}
          </div>
        </div>
      </div>

      {/* ---------- controls ---------- */}
      <div className="rw-bar">
        <button className="rw-btn" onClick={toggle} disabled={!!err || !lib}>
          {live ? "STOP" : "TUNE IN"}
        </button>
        <input className="rw-vol" type="range" min="0" max="100"
               value={Math.round(vol * 100)}
               onChange={(e) => setVol(e.target.value / 100)} aria-label="Volume" />
        <button className="rw-link" onClick={() => setListOpen((v) => !v)}>
          {listOpen ? "HIDE SCHEDULE" : "SCHEDULE"}
        </button>
      </div>

      {err && <div className="rw-err">{err}</div>}
      {audioErr && <div className="rw-err">{audioErr}</div>}

      {debug && (
        <div className="rw-diag">
          {lib ? `${lib.shows.length} shows · ${lib.songs.length} songs · ${pool} in show · ${lib.drops.length} drops · ${lib.ads.length} ads · block=${block ? (block.show ? block.show.name : "GAP") : "NONE"} · queue=${line.current.length}` : "loading…"}
        </div>
      )}

      {listOpen && (
        <div className="rw-sched">
          {shows.map((s) => {
            const on = block?.show && block.show.id === s.id;
            return (
              <div key={s.id} className={on ? "rw-row on" : "rw-row"}>
                <div className="rw-thumb">
                  {s.art ? <img src={s.art} alt="" /> : <span>{s.name[0]}</span>}
                </div>
                <div>
                  <div className="rw-rn">{s.name.toUpperCase()}</div>
                  <div className="rw-rt">{label(toMin(s.start))} – {label(toMin(s.end))}</div>
                </div>
                {on && <em className="rw-onair">ON AIR</em>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CSS = `
/* covers the viewport so the site's navbar and chat rail can't show through */
.rw{position:fixed;inset:0;z-index:2147483000;overflow:auto;
  background:#0C0C11;color:#fff;display:flex;flex-direction:column;
  font-family:Inter,'Helvetica Neue',Arial,sans-serif}

/* ---- show art band ---- */
.rw-head{position:relative;background:#101017;border-bottom:1px solid #2A2A38;flex-shrink:0}
.rw-art{display:block;width:100%;height:132px;object-fit:contain;object-position:center;
  background:#0C0C11}
.rw-art--none{display:grid;place-items:center;height:96px;background:#15151D}
.rw-art--none img{height:38px;width:auto}

.rw-clocks{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;flex-shrink:0;
  background:#2A2A38;border-bottom:1px solid #2A2A38}
.rw-clock{background:#0C0C11;padding:8px 4px;text-align:center;display:flex;
  flex-direction:column;gap:3px}
.rw-czone{font-size:8px;font-weight:800;letter-spacing:.1em;color:#5C5C70;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rw-ctime{font-size:12.5px;font-weight:900;letter-spacing:.01em;color:#C9C9D6;
  font-variant-numeric:tabular-nums;white-space:nowrap}
.rw-clock.on .rw-czone{color:var(--volt,#FFD60A)}
.rw-clock.on .rw-ctime{color:#fff}
@media (max-width:420px){
  .rw-czone{font-size:7px;letter-spacing:.06em}
  .rw-ctime{font-size:11px}
}

/* ---- status strip ---- */
.rw-status{display:flex;align-items:center;gap:8px;padding:9px 14px;flex-shrink:0;
  font-size:10px;font-weight:900;letter-spacing:.16em;background:#101017;
  border-bottom:1px solid #2A2A38}
.rw-showname{margin-left:auto;color:var(--volt,#FFD60A);letter-spacing:.18em}
.rw-dot{width:7px;height:7px;border-radius:50%;background:#FF3B5C;
  box-shadow:0 0 0 0 rgba(255,59,92,.7);animation:rwp 2s infinite}
.rw-dot.off{background:#8B8B9E;animation:none;box-shadow:none}
@keyframes rwp{70%{box-shadow:0 0 0 8px rgba(255,59,92,0)}100%{box-shadow:0 0 0 0 rgba(255,59,92,0)}}

/* ---- canvas stage ---- */
.rw-stage{position:relative;flex:1;min-height:280px;overflow:hidden;background:#0C0C11}
.rw-canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.rw-veil{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(12,12,17,.15),rgba(12,12,17,.92))}

.rw-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  gap:8px;opacity:.5}
.rw-fallback span{width:8px;background:var(--volt,#FFD60A);border-radius:4px;
  animation:rwbar 1.5s ease-in-out infinite}
.rw-fallback span:nth-child(1){animation-delay:0s}
.rw-fallback span:nth-child(2){animation-delay:.13s}
.rw-fallback span:nth-child(3){animation-delay:.26s}
.rw-fallback span:nth-child(4){animation-delay:.39s}
.rw-fallback span:nth-child(5){animation-delay:.52s}
.rw-fallback span:nth-child(6){animation-delay:.42s}
.rw-fallback span:nth-child(7){animation-delay:.31s}
.rw-fallback span:nth-child(8){animation-delay:.2s}
.rw-fallback span:nth-child(9){animation-delay:.1s}
.rw-fallback span:nth-child(10){animation-delay:0s}
@keyframes rwbar{0%,100%{height:18px}50%{height:110px}}

.rw-meta{position:absolute;left:18px;right:18px;bottom:16px}
.rw-title{font-size:clamp(22px,4.4vw,34px);font-weight:900;line-height:1.1;
  letter-spacing:-.02em;margin:0 0 5px;text-shadow:0 2px 16px rgba(0,0,0,.7)}
.rw-by{font-size:11px;font-weight:800;letter-spacing:.18em;color:#C9C9D6;min-height:15px}

/* ---- controls ---- */
.rw-bar{display:flex;align-items:center;gap:13px;padding:14px;flex-shrink:0;
  border-top:1px solid #2A2A38;background:#101017}
.rw-btn{background:var(--volt,#FFD60A);color:#000;border:0;border-radius:999px;
  padding:11px 26px;font-weight:900;font-size:11.5px;letter-spacing:.12em;cursor:pointer}
.rw-btn:hover{filter:brightness(1.08)}
.rw-btn:disabled{opacity:.4;cursor:default}
.rw-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.rw-vol{flex:1;min-width:0;accent-color:var(--volt,#FFD60A)}
.rw-link{background:none;border:0;color:#8B8B9E;font-size:9.5px;font-weight:900;
  letter-spacing:.14em;cursor:pointer;padding:5px;white-space:nowrap}
.rw-link:hover{color:#fff}

/* ---- schedule ---- */
.rw-sched{border-top:1px solid #2A2A38;background:#0C0C11;flex-shrink:0}
.rw-row{display:flex;align-items:center;gap:12px;padding:10px 14px}
.rw-row+.rw-row{border-top:1px solid rgba(42,42,56,.55)}
.rw-row.on{background:rgba(255,214,10,.07)}
.rw-thumb{width:52px;height:30px;border-radius:6px;overflow:hidden;flex-shrink:0;
  background:#1C1C26;display:grid;place-items:center}
.rw-thumb img{width:100%;height:100%;object-fit:cover}
.rw-thumb span{font-weight:900;color:#8B8B9E;font-size:14px}
.rw-rn{font-size:12px;font-weight:800;letter-spacing:.03em}
.rw-row.on .rw-rn{color:var(--volt,#FFD60A)}
.rw-rt{font-size:10px;color:#8B8B9E;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums}
.rw-onair{margin-left:auto;font-style:normal;font-size:8.5px;font-weight:900;
  letter-spacing:.14em;background:#FF3B5C;color:#fff;padding:3px 6px;border-radius:4px}

.rw-fill{position:fixed;top:0;left:0;right:0;z-index:2147483600;
  display:flex;align-items:center;gap:12px;padding:12px 14px;
  background:#FFD60A;color:#000;box-shadow:0 4px 18px rgba(0,0,0,.5)}
.rw-fill .rw-btn{background:#000;color:#FFD60A}
.rw-fillnote{font-size:12px;font-weight:800;letter-spacing:.05em;color:#000}
.rw-err{padding:13px 14px;color:#FF3B5C;font-size:12px;line-height:1.55;
  border-top:1px solid #2A2A38}
.rw-diag{padding:8px 14px;color:#5C5C70;font-size:10px;font-weight:700;
  letter-spacing:.08em;border-top:1px solid #2A2A38;flex-shrink:0}
@media (prefers-reduced-motion:reduce){.rw-dot,.rw-fallback span{animation:none}}
`;
