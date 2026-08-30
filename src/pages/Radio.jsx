import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ============================================================
   HYPERSYNC RADIO — player

   The station itself runs on the server: one playhead, one
   running order, everyone hearing the same second. This page
   just tunes in and shows what's on.

     [ show art ]
     ON AIR · rotating: live now / up next / after that
     [ MANILA · TOKYO · DUBAI · LA ]
     [ the show's canvas loop ]
     TUNE IN   volume   SCHEDULE
   ============================================================ */

const CFG = {
  STREAM: "https://radio.hypersync.live/stream",
  NOW: "https://radio.hypersync.live/now",
  SHOWS: "/api/station",          // art, canvas and times still come from here
  NOW_EVERY: 8000,                // how often to ask what's playing
  LOGO: "/radio-logo.png",
};

const ZONES = [
  { label: "MANILA / SG", tz: "Asia/Manila", home: true },
  { label: "TOKYO / SEOUL", tz: "Asia/Tokyo" },
  { label: "DUBAI", tz: "Asia/Dubai" },
  { label: "LA", tz: "America/Los_Angeles" },
];

const toMin = (s) => {
  const [h, m] = String(s || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const label = (mins) => {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
};
const zoneTime = (tz) =>
  new Date().toLocaleTimeString("en-US", {
    timeZone: tz, hour: "numeric", minute: "2-digit",
  });

export default function Radio() {
  const [shows, setShows] = useState([]);
  const [now, setNow] = useState(null);
  const [live, setLive] = useState(false);
  const [vol, setVol] = useState(0.85);
  const [listOpen, setListOpen] = useState(false);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const audio = useRef(null);
  const liveRef = useRef(false);

  /* ---------- the schedule, for art and times ---------- */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(CFG.SHOWS);
        const j = await r.json();
        if (!alive) return;
        if (j.error) throw new Error(j.error);
        setShows(
          (j.shows || [])
            .filter((s) => s.start && s.end)
            .sort((a, b) => toMin(a.start) - toMin(b.start))
        );
      } catch (e) {
        if (alive) setErr(e.message || String(e));
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  /* ---------- what the station is playing ---------- */
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(CFG.NOW, { cache: "no-store" });
        const j = await r.json();
        if (alive) setNow(j);
      } catch { /* a missed poll is not worth showing anyone */ }
    };
    poll();
    const id = setInterval(poll, CFG.NOW_EVERY);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // clocks
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 20000);
    return () => clearInterval(id);
  }, []);

  liveRef.current = live;

  useEffect(() => { if (audio.current) audio.current.volume = vol; }, [vol]);

  /* ---------- tune in ---------- */
  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (live) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      setLive(false);
      return;
    }
    // cache-buster so we always join the live edge rather than a stale copy
    setErr("");
    a.src = `${CFG.STREAM}?t=${Date.now()}`;
    a.volume = vol;
    a.play()
      .then(() => setLive(true))
      .catch((e) => {
        if (e && e.name === "AbortError") return;   // superseded by another tap
        setErr(e.message || "Could not start playback");
      });
  }, [live, vol]);

  /* ---------- lock screen ---------- */
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    if (!live) { try { ms.playbackState = "paused"; } catch {} return; }
    try {
      ms.metadata = new window.MediaMetadata({
        title: now?.title || "HYPERSYNC RADIO",
        artist: now?.artist || now?.show || "HYPERSYNC RADIO",
        album: now?.show || "HYPERSYNC RADIO",
        artwork: art ? [{ src: art, sizes: "512x512", type: "image/jpeg" }] : [],
      });
      ms.playbackState = "playing";
    } catch { /* older browsers */ }
  });

  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const set = (a, f) => { try { ms.setActionHandler(a, f); } catch {} };
    set("play", () => { if (!live) toggle(); });
    set("pause", () => { if (live) toggle(); });
    set("stop", () => { if (live) toggle(); });
    set("seekbackward", null); set("seekforward", null);
    set("previoustrack", null); set("nexttrack", null);
  }, [live, toggle]);

  /* ---------- a dropped stream should pick itself back up ----------
     iOS pauses us whenever another app takes the audio — a video in
     Instagram, a call, the phone locking oddly. Recovery has to be ONE
     attempt at a time: several racing each other cancel one another and
     the whole thing wedges with "the operation was aborted". */
  const rejoining = useRef(false);

  const rejoin = useCallback(async () => {
    const a = audio.current;
    if (!a || !liveRef.current || rejoining.current) return;
    rejoining.current = true;
    try {
      a.src = `${CFG.STREAM}?t=${Date.now()}`;
      await a.play();
      setErr("");
    } catch {
      // iOS often refuses to resume without a tap. Whatever the reason, a
      // failed recovery must leave the button saying TUNE IN — otherwise it
      // says STOP over silence, and tapping it stops a stream that isn't
      // playing. Only one recovery runs at a time, so this is never a
      // benign "superseded by the next attempt" case.
      setLive(false);
      setErr("Tap TUNE IN to start again");
    } finally {
      rejoining.current = false;
    }
  }, []);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    let timer = null;
    const soon = () => {
      if (!liveRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(rejoin, 1200);
    };
    // `pause` covers the interruption case; the others cover a dropped
    // connection. All of them funnel into the same single attempt.
    const onPause = () => { if (liveRef.current && !rejoining.current) soon(); };
    a.addEventListener("pause", onPause);
    a.addEventListener("error", soon);
    a.addEventListener("stalled", soon);
    a.addEventListener("ended", soon);
    const wake = () => {
      if (document.visibilityState === "hidden") return;
      if (liveRef.current && a.paused) rejoin();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearTimeout(timer);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("error", soon);
      a.removeEventListener("stalled", soon);
      a.removeEventListener("ended", soon);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [rejoin]);

  /* ---------- which show is on ---------- */
  const t = new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60000);
  const minute = t.getHours() * 60 + t.getMinutes();

  const onNow = useMemo(() => {
    for (const s of shows) {
      const a = toMin(s.start), b = toMin(s.end);
      if (b <= a) { if (minute >= a || minute < b) return s; }
      else if (minute >= a && minute < b) return s;
    }
    return null;
  }, [shows, minute]);

  // live now / up next / after that
  const lineup = useMemo(() => {
    if (!shows.length) return [];
    let idx = 0, best = Infinity;
    shows.forEach((s, k) => {
      const behind = (minute - toMin(s.start) + 1440) % 1440;
      if (behind < best) { best = behind; idx = k; }
    });
    const at = (n) => shows[(idx + n) % shows.length];
    const fmt = (s) => `${s.start}–${s.end}`;
    return [
      { tag: "LIVE NOW", show: at(0), when: fmt(at(0)) },
      { tag: "UP NEXT", show: at(1), when: fmt(at(1)) },
      { tag: "AFTER THAT", show: at(2), when: fmt(at(2)) },
    ];
  }, [shows, minute]);

  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (!lineup.length) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % lineup.length), 5000);
    return () => clearInterval(id);
  }, [lineup.length]);

  const current = onNow || lineup[0]?.show || null;
  const art = current?.art || "";
  const onAir = live && now?.kind !== "ad";
  const debug = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  return (
    <div className="rw">
      <style>{CSS}</style>
      <audio ref={audio} preload="none" crossOrigin="anonymous" />

      {/* ---------- show art ---------- */}
      <header className="rw-head">
        {art
          ? <img className="rw-art" src={art} alt={current?.name || ""} />
          : <div className="rw-art rw-art--none">
              <img src={CFG.LOGO} alt="HYPERSYNC RADIO"
                   onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </div>}
      </header>

      <div className="rw-status">
        <i className={onAir ? "rw-dot" : "rw-dot off"} />
        {!live ? "OFF AIR"
          : now?.kind === "ad" ? "AD BREAK"
          : "ON AIR"}

        {!onNow && lineup[1] ? (
          <span className="rw-showname">
            COMING UP · {lineup[1].show.name.toUpperCase()} · {lineup[1].when}
          </span>
        ) : lineup.length ? (
          <span className="rw-showname rw-rot" key={slide}>
            <em>{lineup[slide].tag}</em>
            {lineup[slide].show.name.toUpperCase()}
            <b>{lineup[slide].when}</b>
          </span>
        ) : (
          <span className="rw-showname">HYPERSYNC RADIO</span>
        )}
      </div>

      <div className="rw-clocks">
        {ZONES.map((z) => (
          <div key={z.tz} className={z.home ? "rw-clock on" : "rw-clock"}>
            <span className="rw-czone">{z.label}</span>
            <span className="rw-ctime">{zoneTime(z.tz)}</span>
          </div>
        ))}
      </div>

      {/* ---------- canvas ---------- */}
      <div className="rw-stage">
        {current?.canvas ? (
          <video className="rw-canvas" src={current.canvas} key={current.id}
                 autoPlay loop muted playsInline />
        ) : (
          <div className="rw-fallback" aria-hidden="true">
            <span /><span /><span /><span /><span />
            <span /><span /><span /><span /><span />
          </div>
        )}
        <div className="rw-veil" />

        <div className="rw-meta">
          <h1 className="rw-title">
            {live ? (now?.title || "HYPERSYNC RADIO") : "Ready when you are"}
          </h1>
          <div className="rw-by">
            {live ? (now?.artist || "").toUpperCase() : ""}
          </div>
        </div>
      </div>

      {/* ---------- controls ---------- */}
      <div className="rw-bar">
        <button className="rw-btn" onClick={toggle}>
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

      {debug && (
        <div className="rw-diag">
          {`${shows.length} shows · on air=${onNow?.name || "GAP"} · ` +
           `stream=${live ? "playing" : "stopped"} · listeners=${now?.listeners ?? "?"}`}
        </div>
      )}

      {listOpen && (
        <div className="rw-sched">
          {shows.map((s) => {
            const on = onNow && onNow.id === s.id;
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
.rw-showname{margin-left:auto;color:var(--volt,#FFD60A);letter-spacing:.18em;
  display:flex;align-items:center;gap:9px;min-width:0}
.rw-showname em{font-style:normal;color:#8B8B9E;letter-spacing:.2em;flex-shrink:0}
.rw-showname b{font-weight:800;color:#EDEDF2;letter-spacing:.08em;flex-shrink:0}
.rw-rot{animation:rwFade .45s ease}
@keyframes rwFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.rw-rot{animation:none}}
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
