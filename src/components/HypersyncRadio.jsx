import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   HYPERSYNC RADIO — floating, draggable player

   Not a modal. It sits on top of the site and the site stays
   fully usable underneath. Drag it by the header, minimise it
   to a slim bar, or close it. Audio keeps playing wherever the
   listener navigates.

   Usage (mount once, in Navbar or App — never inside a page):
     <HypersyncRadio open={radioOpen} onClose={() => setRadioOpen(false)} />

   Logo: drop your file at  public/radio-logo.png
   ============================================================ */

const CFG = {
  API: "/api/station",
  LOGO: "/radio-logo.png",
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

  XFADE: 2.0,               // song → song crossfade, seconds
  XFADE_VOICE: 0.6,         // voice → song overlap
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

/* ---------- duration probing ---------- */
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
  const [, setTick] = useState(0);
  const [vol, setVol] = useState(0.85);
  const [mini, setMini] = useState(false);
  const [showList, setShowList] = useState(false);
  const [pos, setPos] = useState(null);
  const [narrow, setNarrow] = useState(false);

  const deck = useRef([]);
  const active = useRef(0);
  const line = useRef([]);
  const cursor = useRef(-1);
  const timer = useRef(null);
  const panel = useRef(null);
  const drag = useRef(null);

  /* ---------- viewport ---------- */
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  /* ---------- library ---------- */
  const load = useCallback(async () => {
    try {
      const r = await fetch(CFG.API);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (!j.shows?.length) throw new Error("No shows found in the SHOWS table.");
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
    return null;
  }, [lib]);

  /* ---------- running order ---------- */
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
      const ov = nextIt.kind === "voice" || it.kind === "voice" ? CFG.XFADE_VOICE : CFG.XFADE;
      timer.current = setTimeout(() => handoff(i + 1, ov),
        Math.max(200, (it.dur - cur.currentTime - ov) * 1000));
    } else {
      timer.current = setTimeout(() => resync(),
        Math.max(500, (it.dur - cur.currentTime) * 1000));
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
    let s = 0;
    const fade = setInterval(() => {
      s++;
      const k = s / steps;
      out.volume = it.kind === "voice" ? vol * (1 - k * (1 - CFG.DUCK)) : vol * (1 - k);
      if (it.kind !== "voice") inc.volume = vol * k;
      if (s >= steps) {
        clearInterval(fade);
        out.pause();
        inc.volume = vol;
      }
    }, (overlap * 1000) / steps);

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

  /* ---------- dragging ---------- */
  const onGrab = (e) => {
    if (narrow) return;
    const box = panel.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    setPos({ x: box.left, y: box.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const w = panel.current.offsetWidth, h = panel.current.offsetHeight;
    setPos({
      x: Math.max(6, Math.min(window.innerWidth - w - 6, e.clientX - drag.current.dx)),
      y: Math.max(6, Math.min(window.innerHeight - h - 6, e.clientY - drag.current.dy)),
    });
  };
  const onDrop = () => { drag.current = null; };

  if (!open) return null;

  const t = nowManila();
  const shows = lib?.shows || [];
  const art = block?.show?.art || "";
  const onAir = live && nowItem && nowItem.kind !== "break";

  const placement = narrow
    ? { left: 8, right: 8, bottom: 8 }
    : pos
      ? { left: pos.x, top: pos.y }
      : { right: 22, bottom: 22 };

  return (
    <div className="hsr-panel" ref={panel} style={placement}>
      <style>{CSS}</style>

      <div
        className={narrow ? "hsr-head" : "hsr-head hsr-grab"}
        onPointerDown={onGrab}
        onPointerMove={onMove}
        onPointerUp={onDrop}
        onPointerCancel={onDrop}
      >
        <img
          className="hsr-logo"
          src={CFG.LOGO}
          alt="HYPERSYNC RADIO"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <span className="hsr-wordmark">HYPERSYNC<em>RADIO</em></span>

        <div className="hsr-tools">
          <button onClick={() => setMini((m) => !m)} title={mini ? "Expand" : "Minimise"}>
            {mini ? "\u25A2" : "\u2014"}
          </button>
          <button onClick={onClose} title="Close">×</button>
        </div>
      </div>

      {err ? (
        <div className="hsr-msg hsr-err">{err}</div>
      ) : !lib ? (
        <div className="hsr-msg">Connecting to the station…</div>
      ) : mini ? (
        <div className="hsr-mini">
          <div className="hsr-mini-art">
            {art ? <img src={art} alt="" /> : <span>{(block?.show?.name || "H")[0]}</span>}
            {onAir && <i className="hsr-eq"><b /><b /><b /></i>}
          </div>
          <div className="hsr-mini-txt">
            <div className="hsr-mini-title">{nowItem ? nowItem.title : "Off air"}</div>
            <div className="hsr-mini-artist">
              {(nowItem?.artist || block?.show?.name || "").toUpperCase()}
            </div>
          </div>
          <button className="hsr-play" onClick={toggle}>{live ? "❚❚" : "▶"}</button>
        </div>
      ) : (
        <>
          <div className="hsr-cover">
            {art
              ? <img src={art} alt={block?.show?.name || ""} />
              : <div className="hsr-cover-fallback">
                  <span>{(block?.show?.name || "HYPERSYNC")[0]}</span>
                </div>}
            <div className="hsr-scrim" />

            <div className="hsr-badge">
              <i className={onAir ? "hsr-dot" : "hsr-dot off"} />
              {!live ? "OFF AIR"
                : nowItem?.kind === "ad" ? "AD BREAK"
                : nowItem?.kind === "break" ? "STATION BREAK"
                : "ON AIR"}
              <span className="hsr-time">{clock(t)}</span>
            </div>

            <div className="hsr-cover-txt">
              <div className="hsr-show">
                {block ? block.show.name.toUpperCase() : "BETWEEN SHOWS"}
              </div>
              <div className="hsr-title">
                {nowItem ? nowItem.title : "Ready when you are"}
              </div>
              <div className="hsr-artist">{(nowItem?.artist || "").toUpperCase()}</div>
            </div>
          </div>

          <div className="hsr-bar">
            <button className="hsr-btn" onClick={toggle}>{live ? "STOP" : "TUNE IN"}</button>
            <input
              className="hsr-vol" type="range" min="0" max="100"
              value={Math.round(vol * 100)}
              onChange={(e) => setVol(e.target.value / 100)}
              aria-label="Volume"
            />
            <button className="hsr-link" onClick={() => setShowList((v) => !v)}>
              {showList ? "HIDE" : "SCHEDULE"}
            </button>
          </div>

          {showList && (
            <div className="hsr-sched">
              {shows.map((s) => {
                const on = block && block.show.id === s.id;
                return (
                  <div key={s.id} className={on ? "hsr-row on" : "hsr-row"}>
                    <div className="hsr-thumb">
                      {s.art ? <img src={s.art} alt="" /> : <span>{s.name[0]}</span>}
                    </div>
                    <div className="hsr-rowtxt">
                      <div className="hsr-rowname">{s.name.toUpperCase()}</div>
                      <div className="hsr-rowtime">
                        {label(toMin(s.start))} – {label(toMin(s.end))}
                      </div>
                    </div>
                    {on && <em className="hsr-live">ON AIR</em>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CSS = `
.hsr-panel{position:fixed;z-index:900;width:min(360px,calc(100vw - 16px));
  background:#0C0C11;border:1px solid var(--line,#2A2A38);border-radius:18px;
  box-shadow:0 24px 60px rgba(0,0,0,.6);overflow:hidden;
  font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#fff}

.hsr-head{display:flex;align-items:center;gap:9px;padding:11px 13px;
  border-bottom:1px solid var(--line,#2A2A38);background:#101017;user-select:none}
.hsr-grab{cursor:grab}
.hsr-grab:active{cursor:grabbing}
.hsr-logo{height:22px;width:auto;display:block}
.hsr-wordmark{font-weight:900;font-size:12px;letter-spacing:.1em}
.hsr-wordmark em{color:var(--volt,#FFD60A);font-style:normal;margin-left:4px}
.hsr-tools{margin-left:auto;display:flex;gap:2px}
.hsr-tools button{background:none;border:0;color:#8B8B9E;width:26px;height:26px;
  border-radius:7px;cursor:pointer;font-size:14px;line-height:1}
.hsr-tools button:hover{background:#1C1C26;color:#fff}

.hsr-cover{position:relative;aspect-ratio:1/1;background:#15151D}
.hsr-cover>img{width:100%;height:100%;object-fit:cover;display:block}
.hsr-cover-fallback{width:100%;height:100%;display:grid;place-items:center;
  background:linear-gradient(150deg,#1C1C26,#0C0C11)}
.hsr-cover-fallback span{font-size:76px;font-weight:900;color:var(--volt,#FFD60A);opacity:.22}
.hsr-scrim{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(12,12,17,.72) 0%,rgba(12,12,17,0) 34%,rgba(12,12,17,.94) 100%)}

.hsr-badge{position:absolute;top:12px;left:13px;right:13px;display:flex;align-items:center;
  gap:7px;font-size:10px;font-weight:900;letter-spacing:.15em}
.hsr-time{margin-left:auto;font-variant-numeric:tabular-nums;color:#C9C9D6;
  font-weight:700;letter-spacing:.07em}
.hsr-dot{width:7px;height:7px;border-radius:50%;background:#FF3B5C;
  box-shadow:0 0 0 0 rgba(255,59,92,.7);animation:hsrp 2s infinite}
.hsr-dot.off{background:#8B8B9E;animation:none;box-shadow:none}
@keyframes hsrp{70%{box-shadow:0 0 0 8px rgba(255,59,92,0)}100%{box-shadow:0 0 0 0 rgba(255,59,92,0)}}

.hsr-cover-txt{position:absolute;left:15px;right:15px;bottom:14px}
.hsr-show{font-size:9.5px;font-weight:900;letter-spacing:.2em;
  color:var(--volt,#FFD60A);margin-bottom:6px}
.hsr-title{font-size:22px;font-weight:900;line-height:1.13;letter-spacing:-.015em;
  margin-bottom:4px;text-shadow:0 2px 14px rgba(0,0,0,.65);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hsr-artist{font-size:10px;font-weight:800;letter-spacing:.17em;color:#C9C9D6;min-height:14px}

.hsr-bar{display:flex;align-items:center;gap:11px;padding:13px}
.hsr-btn{background:var(--volt,#FFD60A);color:#000;border:0;border-radius:999px;
  padding:9px 20px;font-weight:900;font-size:11px;letter-spacing:.11em;cursor:pointer}
.hsr-btn:hover{filter:brightness(1.08)}
.hsr-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.hsr-vol{flex:1;min-width:0;accent-color:var(--volt,#FFD60A)}
.hsr-link{background:none;border:0;color:#8B8B9E;font-size:9.5px;font-weight:900;
  letter-spacing:.13em;cursor:pointer;padding:4px}
.hsr-link:hover{color:#fff}

.hsr-sched{border-top:1px solid var(--line,#2A2A38);max-height:238px;overflow:auto}
.hsr-row{display:flex;align-items:center;gap:11px;padding:9px 13px}
.hsr-row+.hsr-row{border-top:1px solid rgba(42,42,56,.55)}
.hsr-row.on{background:rgba(255,214,10,.07)}
.hsr-thumb{width:38px;height:38px;border-radius:8px;overflow:hidden;flex-shrink:0;
  background:#1C1C26;display:grid;place-items:center}
.hsr-thumb img{width:100%;height:100%;object-fit:cover}
.hsr-thumb span{font-weight:900;color:#8B8B9E;font-size:15px}
.hsr-rowname{font-size:11.5px;font-weight:800;letter-spacing:.03em}
.hsr-row.on .hsr-rowname{color:var(--volt,#FFD60A)}
.hsr-rowtime{font-size:10px;color:#8B8B9E;font-weight:700;margin-top:2px;
  font-variant-numeric:tabular-nums}
.hsr-live{margin-left:auto;font-style:normal;font-size:8.5px;font-weight:900;
  letter-spacing:.14em;background:#FF3B5C;color:#fff;padding:3px 6px;border-radius:4px}

.hsr-mini{display:flex;align-items:center;gap:11px;padding:11px 13px}
.hsr-mini-art{position:relative;width:42px;height:42px;border-radius:9px;overflow:hidden;
  flex-shrink:0;background:#1C1C26;display:grid;place-items:center}
.hsr-mini-art img{width:100%;height:100%;object-fit:cover}
.hsr-mini-art span{font-weight:900;color:var(--volt,#FFD60A)}
.hsr-mini-txt{min-width:0;flex:1}
.hsr-mini-title{font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.hsr-mini-artist{font-size:9.5px;font-weight:800;letter-spacing:.14em;color:#8B8B9E;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.hsr-play{background:var(--volt,#FFD60A);color:#000;border:0;width:34px;height:34px;
  border-radius:50%;cursor:pointer;font-size:12px;flex-shrink:0}

.hsr-eq{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;
  gap:2px;padding-bottom:6px;background:rgba(12,12,17,.5)}
.hsr-eq b{width:3px;background:var(--volt,#FFD60A);border-radius:2px;
  animation:hsreq .9s infinite ease-in-out}
.hsr-eq b:nth-child(2){animation-delay:.15s}
.hsr-eq b:nth-child(3){animation-delay:.3s}
@keyframes hsreq{0%,100%{height:5px}50%{height:15px}}

.hsr-msg{padding:20px;color:#8B8B9E;font-size:12.5px;line-height:1.6}
.hsr-err{color:#FF3B5C}
@media (prefers-reduced-motion:reduce){.hsr-dot,.hsr-eq b{animation:none}}
`;
