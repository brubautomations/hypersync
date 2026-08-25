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

const CFG = {
  API: "/api/station",
  LOGO: "/radio-logo.png",
  TZ: 8,                    // Manila, no DST

  SONGS_MIN: 4,
  SONGS_MAX: 5,
  ADS_MIN: 3,
  ADS_MAX: 4,

  P_OUTRO: 0.5,
  P_FILLER: 0.4,
  P_STATION: 0.5,
  P_INTRO: 0.6,

  XFADE: 2.0,
  XFADE_VOICE: 0.6,
  DUCK: 0.28,
  REFRESH_MIN: 30,
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
    .map((n) => String(n).padStart(2, "0")).join(":");
// what the listener sees: their own local time, wherever they are
const localClock = () => {
  const d = new Date();
  const hh = d.getHours(), mm = String(d.getMinutes()).padStart(2, "0");
  const ap = hh < 12 ? "AM" : "PM";
  return `${hh % 12 === 0 ? 12 : hh % 12}:${mm} ${ap}`;
};
const localZone = () => {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value || "";
  } catch { return ""; }
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

/* ---------- duration probing ---------- */
const durCache = new Map();
function probe(url) {
  if (durCache.has(url)) return Promise.resolve(durCache.get(url));
  return new Promise((res) => {
    const a = new Audio();
    a.preload = "metadata";
    let settled = false;
    const done = (v) => { if (settled) return; settled = true; durCache.set(url, v); res(v); };
    a.onloadedmetadata = () => done(isFinite(a.duration) && a.duration > 1 ? a.duration : 210);
    a.onerror = () => done(210);
    setTimeout(() => done(210), 12000);
    a.src = url;
  });
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

  const deck = useRef([]);
  const active = useRef(0);
  const line = useRef([]);
  const timer = useRef(null);

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

  /* ---------- running order ---------- */
  const build = useCallback(async (t) => {
    const blk = findBlock(t);
    if (!blk || !lib) return { items: [], blk };

    const rnd = mulberry32(seed(`${t.toISOString().slice(0, 10)}|${blk.show.id}`));
    const pool = lib.songs.filter((s) => s.shows.includes(blk.show.id));
    if (!pool.length) return { items: [], blk, empty: true };

    const showDrops = lib.drops.filter((d) => !d.shows.length || d.shows.includes(blk.show.id));
    const voice = showDrops.length ? showDrops : lib.drops;

    const songQ = shuffled(pool, rnd);
    const dropQ = shuffled(voice, rnd);
    const adQ = shuffled(lib.ads, rnd);

    await Promise.all([...new Set([...songQ, ...dropQ, ...adQ].map((x) => x.url))].map(probe));

    const startSec = blk.start * 60, endSec = blk.end * 60;
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
      let spoke = false;
      const voiceLine = (p) => {
        if (!roll(p)) return;
        const d = nextDrop(); if (!d) return;
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
      if (!spoke) voiceLine(1); else voiceLine(CFG.P_INTRO);
    }
    return { items, blk };
  }, [lib, findBlock]);

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
    const items = line.current, it = items[i];
    if (!it) return;
    const cur = deck.current[active.current], nxt = deck.current[1 - active.current];
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
      const ov = nextIt.kind === "voice" || it.kind === "voice" ? CFG.XFADE_VOICE : CFG.XFADE;
      timer.current = setTimeout(() => handoff(i + 1, ov),
        Math.max(200, (it.dur - cur.currentTime - ov) * 1000));
    } else {
      timer.current = setTimeout(() => resync(), Math.max(500, (it.dur - cur.currentTime) * 1000));
    }
  }, [vol]);

  const handoff = useCallback((i, overlap) => {
    const items = line.current, it = items[i];
    if (!it) return resync();
    const out = deck.current[active.current], inc = deck.current[1 - active.current];

    inc.src = it.url;
    inc.currentTime = 0;
    inc.volume = it.kind === "voice" ? vol : 0;
    inc.play().catch(() => {});

    const steps = 20; let s = 0;
    const fade = setInterval(() => {
      s++; const k = s / steps;
      out.volume = it.kind === "voice" ? vol * (1 - k * (1 - CFG.DUCK)) : vol * (1 - k);
      if (it.kind !== "voice") inc.volume = vol * k;
      if (s >= steps) { clearInterval(fade); out.pause(); inc.volume = vol; }
    }, (overlap * 1000) / steps);

    active.current = 1 - active.current;
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
      setNowItem({ kind: "break", title: "Station break", artist: "" });
      deck.current.forEach((a) => a.pause());
      clearTimeout(timer.current);
      timer.current = setTimeout(resync, 15000);
    }
  }, [build, locate, live, playIndex]);

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

  const t = nowManila();
  const shows = lib?.shows || [];
  const art = block?.show?.art || "";
  const onAir = live && nowItem && nowItem.kind !== "break";

  return (
    <div className="rw">
      <style>{CSS}</style>

      {/* ---------- show art + local time ---------- */}
      <header className="rw-head">
        {art
          ? <img className="rw-art" src={art} alt={block?.show?.name || ""} />
          : <div className="rw-art rw-art--none">
              <img src={CFG.LOGO} alt="HYPERSYNC RADIO"
                   onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>}

        <div className="rw-timechip">
          <div className="rw-tnow">{localClock()}</div>
          <div className="rw-tzone">{localZone()}</div>
        </div>
      </header>

      <div className="rw-status">
        <i className={onAir ? "rw-dot" : "rw-dot off"} />
        {!live ? "OFF AIR"
          : nowItem?.kind === "ad" ? "AD BREAK"
          : nowItem?.kind === "break" ? "STATION BREAK"
          : "ON AIR"}
        <span className="rw-showname">
          {block ? block.show.name.toUpperCase() : "BETWEEN SHOWS"}
        </span>
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
          <h1 className="rw-title">{nowItem ? nowItem.title : "Ready when you are"}</h1>
          <div className="rw-by">{(nowItem?.artist || "").toUpperCase()}</div>
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

      {listOpen && (
        <div className="rw-sched">
          {shows.map((s) => {
            const on = block && block.show.id === s.id;
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
.rw-art{display:block;width:100%;height:auto;max-height:132px;object-fit:cover}
.rw-art--none{display:grid;place-items:center;height:96px;background:#15151D}
.rw-art--none img{height:38px;width:auto}

.rw-timechip{position:absolute;top:10px;right:10px;text-align:right;
  background:rgba(12,12,17,.78);backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px 11px}
.rw-tnow{font-size:15px;font-weight:900;letter-spacing:.02em;
  font-variant-numeric:tabular-nums;line-height:1.1}
.rw-tzone{font-size:8.5px;font-weight:800;letter-spacing:.15em;color:#8B8B9E;margin-top:1px}

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

.rw-err{padding:13px 14px;color:#FF3B5C;font-size:12px;line-height:1.55;
  border-top:1px solid #2A2A38}
@media (prefers-reduced-motion:reduce){.rw-dot,.rw-fallback span{animation:none}}
`;
