import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   HYPERSYNC RADIO
   Clock-driven station. Every listener computes the same running
   order from the date, so everyone hears the same second of the
   same song. Joining mid-song seeks to the right position.

   Usage:
     const [radioOpen, setRadioOpen] = useState(false);
     <button onClick={() => setRadioOpen(true)}>HYPERSYNC RADIO</button>
     <HypersyncRadio open={radioOpen} onClose={() => setRadioOpen(false)} />

   Mount it once, high in the tree (App level), so audio survives
   navigation between pages.
   ============================================================ */

const CFG = {
  API: "/api/station",
  TZ: 8,                    // Manila, no DST

  SONGS_MIN: 4,             // songs between breaks
  SONGS_MAX: 5,
  ADS_MIN: 3,
  ADS_MAX: 4,

  // how often each piece of a break fires (0–1)
  P_OUTRO: 0.5,
  P_FILLER: 0.4,
  P_STATION: 0.5,
  P_INTRO: 0.6,

  XFADE: 2.0,               // song→song crossfade, seconds
  XFADE_VOICE: 0.6,         // voice→song overlap
  DUCK: 0.28,               // music level under the voice
  REFRESH_MIN: 30,          // re-pull the library every N minutes
};

/* ---------- clock ---------- */
const nowManila = () =>
  new Date(Date.now() + (CFG.TZ * 60 + new Date().getTimezoneOffset()) * 60000);
const toMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const clock = (d) =>
  [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
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
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
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

/* ---------- duration probing (no Duration column needed) ---------- */
const durCache = new Map();
function probe(url) {
  if (durCache.has(url)) return Promise.resolve(durCache.get(url));
  return new Promise((res) => {
    const a = new Audio();
    a.preload = "metadata";
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      durCache.set(url, v);
      res(v);
    };
    a.onloadedmetadata = () =>
      done(isFinite(a.duration) && a.duration > 1 ? a.duration : 210);
    a.onerror = () => done(210);
    setTimeout(() => done(210), 12000);
    a.src = url;
  });
}

export default function HypersyncRadio({ open = false, onClose = () => {} }) {
  const [lib, setLib] = useState(null);
  const [err, setErr] = useState("");
  const [live, setLive] = useState(false);
  const [block, setBlock] = useState(null);
  const [nowItem, setNowItem] = useState(null);
  const [tick, setTick] = useState(0);
  const [vol, setVol] = useState(0.85);

  const deck = useRef([]);
  const active = useRef(0);
  const line = useRef([]);
  const cursor = useRef(-1);
  const timer = useRef(null);

  /* ---------- audio decks ---------- */
  useEffect(() => {
    const mk = () => {
      const a = new Audio();
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      return a;
    };
    deck.current = [mk(), mk()];
    return () => deck.current.forEach((a) => { a.pause(); a.src = ""; });
  }, []);

  useEffect(() => {
    deck.current.forEach((a) => { if (a) a.volume = vol; });
  }, [vol]);

  /* ---------- load library ---------- */
  const load = useCallback(async () => {
    try {
      const r = await fetch(CFG.API);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (!j.shows?.length) throw new Error("No shows found. Add rows to the SHOWS table.");
      j.shows.sort((a, b) => toMin(a.start) - toMin(b.start));
      setLib(j);
      setErr("");
    } catch (e) {
      setErr(e.message || String(e));
    }
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
      } else if (m >= a && m < b) {
        return { show: s, start: a, end: b, wrap: false };
      }
    }
    return null; // station break between blocks
  }, [lib]);

  /* ---------- build the running order ---------- */
  const build = useCallback(async (t) => {
    const blk = findBlock(t);
    if (!blk || !lib) return { items: [], blk };

    const key = `${t.toISOString().slice(0, 10)}|${blk.show.id}`;
    const rnd = mulberry32(seed(key));

    const pool = lib.songs.filter((s) => s.shows.includes(blk.show.id));
    if (!pool.length) return { items: [], blk, empty: true };

    const showDrops = lib.drops.filter(
      (d) => !d.shows.length || d.shows.includes(blk.show.id)
    );
    const voice = showDrops.length ? showDrops : lib.drops;

    const songQ = shuffled(pool, rnd);
    const dropQ = shuffled(voice, rnd);
    const adQ = shuffled(lib.ads, rnd);

    await Promise.all(
      [...new Set([...songQ, ...dropQ, ...adQ].map((x) => x.url))].map(probe)
    );

    const startSec = blk.start * 60;
    const endSec = blk.end * 60;
    let at = startSec, si = 0, di = 0, ai = 0;
    const items = [];

    const put = (o, xfade) => {
      const dur = durCache.get(o.url) || 210;
      if (at + dur > endSec) return false;
      items.push({ ...o, at, dur });
      at += dur - (xfade || 0);
      return true;
    };

    const roll = (p) => rnd() < p;
    const nextDrop = () => (dropQ.length ? dropQ[di++ % dropQ.length] : null);

    let guard = 0;
    outer: while (at < endSec && guard++ < 800) {
      const n = CFG.SONGS_MIN + Math.floor(rnd() * (CFG.SONGS_MAX - CFG.SONGS_MIN + 1));
      for (let k = 0; k < n; k++) {
        const s = songQ[si++ % songQ.length];
        if (!put({ kind: "song", title: s.title, artist: s.artist, url: s.url }, CFG.XFADE))
          break outer;
      }

      // ---- break ----
      let spoke = false;
      const voiceLine = (p) => {
        if (!roll(p)) return;
        const d = nextDrop();
        if (!d) return;
        if (put({ kind: "voice", title: "HYPERSYNC RADIO", artist: "", url: d.url }, CFG.XFADE_VOICE))
          spoke = true;
      };

      voiceLine(CFG.P_OUTRO);
      voiceLine(CFG.P_FILLER);
      voiceLine(CFG.P_STATION);

      if (adQ.length) {
        const k = CFG.ADS_MIN + Math.floor(rnd() * (CFG.ADS_MAX - CFG.ADS_MIN + 1));
        for (let j = 0; j < k; j++) {
          const ad = adQ[ai++ % adQ.length];
          if (!put({ kind: "ad", title: ad.sponsor || "Advertisement", artist: "", url: ad.url }, 0))
            break outer;
        }
      }

      if (!spoke) voiceLine(1);
      else voiceLine(CFG.P_INTRO);
    }

    return { items, blk };
  }, [lib, findBlock]);

  /* ---------- locate current position ---------- */
  const locate = useCallback((t, items, blk) => {
    let sec = t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
    if (blk?.wrap) sec += 86400;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (sec >= it.at && sec < it.at + it.dur) return { i, off: sec - it.at };
    }
    return null;
  }, []);

  /* ---------- playback ---------- */
  const playIndex = useCallback((i, offset) => {
    const items = line.current;
    const it = items[i];
    if (!it) return;
    cursor.current = i;

    const cur = deck.current[active.current];
    const nxt = deck.current[1 - active.current];

    cur.pause();
    cur.src = it.url;
    cur.volume = vol;
    cur.currentTime = Math.max(0, Math.min(offset || 0, Math.max(0, it.dur - 1)));
    cur.play().catch(() => {});
    nxt.pause();

    setNowItem(it);

    clearTimeout(timer.current);
    const nextIt = items[i + 1];
    if (nextIt) {
      const overlap = nextIt.kind === "voice" || it.kind === "voice"
        ? CFG.XFADE_VOICE
        : CFG.XFADE;
      const waitMs = Math.max(200, (it.dur - cur.currentTime - overlap) * 1000);
      timer.current = setTimeout(() => handoff(i + 1, overlap), waitMs);
    } else {
      timer.current = setTimeout(() => resync(), Math.max(500, (it.dur - cur.currentTime) * 1000));
    }
  }, [vol]);

  const handoff = useCallback((i, overlap) => {
    const items = line.current;
    const it = items[i];
    if (!it) return resync();

    const out = deck.current[active.current];
    const inc = deck.current[1 - active.current];

    inc.src = it.url;
    inc.currentTime = 0;
    inc.volume = it.kind === "voice" ? vol : 0;
    inc.play().catch(() => {});

    const steps = 20;
    const stepMs = (overlap * 1000) / steps;
    let s = 0;
    const fade = setInterval(() => {
      s++;
      const k = s / steps;
      // voice sits on top; music ducks under it rather than fading out
      out.volume = it.kind === "voice" ? vol * (1 - k * (1 - CFG.DUCK)) : vol * (1 - k);
      if (it.kind !== "voice") inc.volume = vol * k;
      if (s >= steps) {
        clearInterval(fade);
        out.pause();
        inc.volume = vol;
      }
    }, stepMs);

    active.current = 1 - active.current;
    cursor.current = i;
    setNowItem(it);

    clearTimeout(timer.current);
    const nextIt = items[i + 1];
    if (nextIt) {
      const ov = nextIt.kind === "voice" || it.kind === "voice" ? CFG.XFADE_VOICE : CFG.XFADE;
      timer.current = setTimeout(() => handoff(i + 1, ov), Math.max(200, (it.dur - ov) * 1000));
    } else {
      timer.current = setTimeout(() => resync(), Math.max(500, it.dur * 1000));
    }
  }, [vol]);

  const resync = useCallback(async () => {
    const t = nowManila();
    const { items, blk } = await build(t);
    line.current = items;
    setBlock(blk);
    if (!live) return;
    const spot = locate(t, items, blk);
    if (spot) playIndex(spot.i, spot.off);
    else {
      // in the station break between blocks
      setNowItem({ kind: "break", title: "Station break", artist: "" });
      deck.current.forEach((a) => a.pause());
      clearTimeout(timer.current);
      timer.current = setTimeout(resync, 15000);
    }
  }, [build, locate, live, playIndex]);

  /* keep the schedule panel current even when off air */
  useEffect(() => {
    if (!lib) return;
    (async () => {
      const t = nowManila();
      const { items, blk } = await build(t);
      line.current = items;
      setBlock(blk);
    })();
  }, [lib, build]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const toggle = async () => {
    if (live) {
      setLive(false);
      clearTimeout(timer.current);
      deck.current.forEach((a) => a.pause());
      setNowItem(null);
      return;
    }
    setLive(true);
    const t = nowManila();
    const { items, blk } = await build(t);
    line.current = items;
    setBlock(blk);
    const spot = locate(t, items, blk);
    if (spot) playIndex(spot.i, spot.off);
    else timer.current = setTimeout(resync, 5000);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!open) return null;

  const t = nowManila();
  const shows = lib?.shows || [];

  return (
    <div className="hsr-overlay" onClick={onClose}>
      <div className="hsr" onClick={(e) => e.stopPropagation()}>
        <style>{CSS}</style>

        <div className="hsr-top">
          <div className="hsr-brand">
            <span className="hsr-mark">H</span>
            HYPERSYNC<em>RADIO</em>
          </div>
          <button className="hsr-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {err ? (
          <div className="hsr-err">{err}</div>
        ) : !lib ? (
          <div className="hsr-note">Connecting to the station…</div>
        ) : (
          <>
            <div className="hsr-deck">
              <div className="hsr-state">
                <i className={live ? "hsr-dot" : "hsr-dot off"} />
                <b>
                  {!live ? "OFF AIR"
                    : nowItem?.kind === "ad" ? "AD BREAK"
                    : nowItem?.kind === "voice" ? "ON AIR"
                    : nowItem?.kind === "break" ? "STATION BREAK"
                    : "ON AIR"}
                </b>
                <span>{block ? `· ${block.show.name.toUpperCase()}` : "· BETWEEN SHOWS"}</span>
                <span className="hsr-clock">{clock(t)}</span>
              </div>

              <div className="hsr-title">
                {nowItem ? nowItem.title : "Ready when you are"}
              </div>
              <div className="hsr-artist">
                {(nowItem?.artist || "").toUpperCase()}
              </div>

              <div className="hsr-row">
                <button className="hsr-btn" onClick={toggle}>
                  {live ? "STOP" : "TUNE IN"}
                </button>
                <label className="hsr-vol">
                  VOL
                  <input
                    type="range" min="0" max="100"
                    value={Math.round(vol * 100)}
                    onChange={(e) => setVol(e.target.value / 100)}
                  />
                </label>
              </div>
            </div>

            <div className="hsr-sched">
              <h4>SCHEDULE</h4>
              {shows.map((s) => {
                const on = block && block.show.id === s.id;
                return (
                  <div key={s.id} className={on ? "hsr-item on" : "hsr-item"}>
                    <span className="hsr-t">
                      {label(toMin(s.start))} – {label(toMin(s.end))}
                    </span>
                    <span className="hsr-n">{s.name.toUpperCase()}</span>
                    <span className="hsr-d">
                      {on ? <em className="hsr-live">ON AIR</em> : s.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.hsr-overlay{position:fixed;inset:0;background:rgba(4,4,8,.82);backdrop-filter:blur(6px);
  display:grid;place-items:center;z-index:9999;padding:20px}
.hsr{width:min(720px,100%);max-height:88vh;overflow:auto;background:#0C0C11;
  border:1px solid #2A2A38;border-radius:20px;padding:22px;
  font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#fff}
.hsr-top{display:flex;align-items:center;margin-bottom:18px}
.hsr-brand{font-weight:900;font-size:17px;letter-spacing:.07em;display:flex;align-items:center;gap:10px}
.hsr-brand em{color:#FFD60A;font-style:normal;margin-left:5px}
.hsr-mark{width:30px;height:30px;border-radius:8px;background:#FFD60A;color:#000;
  display:grid;place-items:center;font-size:15px}
.hsr-x{margin-left:auto;background:none;border:0;color:#8B8B9E;font-size:26px;cursor:pointer;line-height:1}
.hsr-x:hover{color:#fff}

.hsr-deck{background:linear-gradient(160deg,#15151D,#1C1C26);border:1px solid #2A2A38;
  border-radius:16px;padding:24px;margin-bottom:14px}
.hsr-state{display:flex;align-items:center;gap:9px;margin-bottom:18px;
  font-size:11px;letter-spacing:.15em;font-weight:800}
.hsr-state span{color:#8B8B9E;letter-spacing:.11em;font-weight:700}
.hsr-dot{width:8px;height:8px;border-radius:50%;background:#FF3B5C;
  box-shadow:0 0 0 0 rgba(255,59,92,.7);animation:hsrp 2s infinite}
.hsr-dot.off{background:#8B8B9E;animation:none;box-shadow:none}
@keyframes hsrp{70%{box-shadow:0 0 0 9px rgba(255,59,92,0)}100%{box-shadow:0 0 0 0 rgba(255,59,92,0)}}
.hsr-clock{margin-left:auto;font-variant-numeric:tabular-nums}

.hsr-title{font-size:clamp(24px,4.5vw,38px);font-weight:900;line-height:1.07;
  letter-spacing:-.02em;margin-bottom:7px;word-break:break-word}
.hsr-artist{font-size:12px;letter-spacing:.19em;font-weight:800;color:#FFD60A;min-height:17px}

.hsr-row{display:flex;align-items:center;gap:16px;margin-top:22px;flex-wrap:wrap}
.hsr-btn{background:#FFD60A;color:#000;border:0;border-radius:999px;padding:12px 30px;
  font-weight:900;font-size:12px;letter-spacing:.11em;cursor:pointer}
.hsr-btn:hover{filter:brightness(1.08)}
.hsr-btn:focus-visible{outline:2px solid #fff;outline-offset:3px}
.hsr-vol{display:flex;align-items:center;gap:8px;color:#8B8B9E;font-size:10px;
  letter-spacing:.12em;font-weight:800}
.hsr-vol input{width:104px;accent-color:#FFD60A}

.hsr-sched{background:#15151D;border:1px solid #2A2A38;border-radius:14px;overflow:hidden}
.hsr-sched h4{font-size:10px;letter-spacing:.18em;color:#8B8B9E;font-weight:800;padding:15px 17px 9px;margin:0}
.hsr-item{display:flex;align-items:center;gap:15px;padding:12px 17px;border-top:1px solid #2A2A38}
.hsr-item.on{background:rgba(255,214,10,.07)}
.hsr-t{font-variant-numeric:tabular-nums;font-size:11px;font-weight:800;color:#8B8B9E;min-width:92px}
.hsr-n{font-weight:800;font-size:13px;letter-spacing:.02em}
.hsr-item.on .hsr-n{color:#FFD60A}
.hsr-d{margin-left:auto;color:#8B8B9E;font-size:11px;text-align:right}
.hsr-live{font-style:normal;font-size:9px;font-weight:900;letter-spacing:.14em;
  background:#FF3B5C;color:#fff;padding:3px 7px;border-radius:4px}

.hsr-note,.hsr-err{padding:22px;color:#8B8B9E;font-size:13px;line-height:1.6}
.hsr-err{color:#FF3B5C}
@media (prefers-reduced-motion:reduce){.hsr-dot{animation:none}}
`;
