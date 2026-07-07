import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { fetchData } from '../lib/api'
import { useReveal } from '../lib/useReveal'
import { groupAnnouncements, resolveImage, indexArtistsByName } from '../lib/tours'

const HERO_FALLBACK = {
  title: 'HYPERSYNC',
  artist: '',
  date: '',
  image: '',
  eventType: 'HYPERSYNC',
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target - today) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── HERO — the announcement stage ───────────────────────────
function Hero({ slides }) {
  const [i, setI] = useState(0)
  const [on, setOn] = useState(true)
  const timer = useRef(null)

  const go = useCallback((next) => {
    setOn(false)
    setTimeout(() => { setI(next); setOn(true) }, 320)
  }, [])

  useEffect(() => {
    if (slides.length < 2) return
    timer.current = setInterval(() => go((iNow => (iNow + 1) % slides.length)(i)), 7000)
    return () => clearInterval(timer.current)
  }, [slides.length, i, go])

  const s = slides[i] || HERO_FALLBACK
  const countdown = daysUntil(s.date)

  return (
    <div style={{ position: 'relative', height: 'min(78vh, 720px)', minHeight: 480, overflow: 'hidden' }}>
      {/* backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        transition: 'opacity 0.32s ease', opacity: on ? 1 : 0,
      }}>
        {s.image ? (
          <img src={s.image} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%',
          }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background:
              'radial-gradient(900px 500px at 80% 10%, rgba(255,212,0,0.16), transparent 60%),' +
              'radial-gradient(700px 500px at 15% 90%, rgba(157,123,255,0.18), transparent 60%),' +
              'var(--ink)',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, var(--ink) 4%, rgba(12,12,17,0.55) 45%, rgba(12,12,17,0.15) 100%)',
        }} />
      </div>

      {/* content */}
      <div className="wrap" style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        paddingBottom: 'clamp(32px, 6vh, 64px)',
        transition: 'opacity 0.32s ease, transform 0.32s ease',
        opacity: on ? 1 : 0, transform: on ? 'none' : 'translateY(8px)',
      }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <span className="chip chip--on" style={{ cursor: 'default' }}>{s.eventType || 'Event'}</span>
          {s.legs > 1 && (
            <span className="chip chip--pulse" style={{ cursor: 'default' }}>Tour · {s.legs} dates</span>
          )}
          {countdown && (
            <span className="chip chip--volt-line" style={{ cursor: 'default' }}>
              <span className="sync-dot" />{countdown}
            </span>
          )}
        </div>

        {s.artist && (
          <div className="eyebrow eyebrow--volt" style={{ marginBottom: 10 }}>{s.artist}</div>
        )}

        <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 7vw, 5.4rem)', maxWidth: 900 }}>
          {s.title}
        </h1>

        {s.date && (
          <div className="display volt-text" style={{
            fontSize: 'clamp(1rem, 2.4vw, 1.5rem)', marginTop: 16, letterSpacing: '0.04em',
          }}>
            {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </div>
        )}
        {(s.venue || s.city || s.country) && (
          <div className="eyebrow" style={{
            color: 'var(--text)', marginTop: 6, fontSize: '0.85rem',
            textShadow: '0 2px 10px rgba(0,0,0,0.7)',
          }}>
            {[s.venue, s.city, s.country].filter(Boolean).join(', ')}
          </div>
        )}

        {slides.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 28, alignItems: 'center' }}>
            {slides.map((_, idx) => (
              <button key={idx} onClick={() => go(idx)} aria-label={`Slide ${idx + 1}`} style={{
                width: idx === i ? 30 : 8, height: 8, borderRadius: 99, border: 'none',
                cursor: 'pointer', transition: 'all 0.3s var(--ease)',
                background: idx === i ? 'var(--volt)' : 'rgba(255,255,255,0.22)',
                boxShadow: idx === i ? 'var(--glow)' : 'none',
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SYNC STRIP — the positioning, said out loud ─────────────

// ── PULSE STRIP: the page's heartbeat ─────────────────────────
// News headlines drift left; artist avatars drift right.
// Duplicated content = seamless loop. Hover pauses. Click navigates.
function NewsTicker({ items }) {
  if (!items.length) return null
  const row = items.map((n, i) => (
    <Link key={i} to="/feed" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      color: 'var(--dim)', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {n.artist && <span style={{ color: 'var(--volt)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.68rem' }}>{n.artist}</span>}
      <span>{n.title}</span>
      <span style={{ color: 'var(--faint)', margin: '0 8px' }}>◆</span>
    </Link>
  ))
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderBlock: '1px solid var(--line)', background: 'var(--panel)' }}>
      <div style={{
        flexShrink: 0, padding: '10px 16px', fontSize: '0.64rem', fontWeight: 800,
        letterSpacing: '0.14em', color: '#14120A', background: 'var(--volt-grad)',
      }}>LATEST</div>
      <div className="marquee">
        <div className="marquee__track">{row}{row}</div>
      </div>
    </div>
  )
}

function ArtistMarquee({ artists }) {
  if (!artists.length) return null
  const row = artists.map((a, i) => (
    <Link key={i} to={`/artists/${a.id}`} title={a.name} style={{
      display: 'inline-flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
      marginRight: 34,
    }}>
      {(a.portal_avatar || a.image) ? (
        <img src={a.portal_avatar || a.image} alt={a.name} loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none' }}
          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--line)' }} />
      ) : (
        <span style={{
          width: 34, height: 34, borderRadius: '50%', background: 'var(--volt-grad)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.7rem', color: '#14120A',
        }}>{(a.name || '?').trim()[0]}</span>
      )}
      <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--dim)' }}>
        {(a.name || '').trim()}
      </span>
    </Link>
  ))
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="marquee">
        <div className="marquee__track marquee__track--reverse">{row}{row}</div>
      </div>
    </div>
  )
}

function SyncStrip() {
  const ITEMS = [
    ['News', '/feed'], ['Socials', '/feed'], ['Schedule', '/schedule'],
    ['Releases', '/feed'], ['Merch', '/shop'], ['Messages', '/artists'],
  ]
  return (
    <div style={{ borderBlock: '1px solid var(--line)', background: 'var(--panel)', overflow: 'hidden' }}>
      <div className="wrap" style={{
        display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 28px)',
        padding: '18px 0', flexWrap: 'wrap',
      }}>
        {ITEMS.map(([label, path], idx) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 28px)' }}>
            <Link to={path} style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dim)', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = 'var(--volt)'}
              onMouseLeave={e => e.target.style.color = 'var(--dim)'}>{label}</Link>
            {idx < ITEMS.length - 1 && <span style={{ color: 'var(--volt)', fontSize: '0.6rem' }}>◆</span>}
          </span>
        ))}
        <span className="chip chip--volt-line" style={{ cursor: 'default', marginLeft: 'auto' }}>
          <span className="sync-dot" />Synced
        </span>
      </div>
    </div>
  )
}

// ── ARTIST CARD ──────────────────────────────────────────────
function ArtistCard({ a }) {
  return (
    <Link to={`/artists/${a.id}`} className="card card--lift reveal" style={{ display: 'block' }}>
      <div style={{ position: 'relative', paddingTop: '118%', overflow: 'hidden' }}>
        {a.image ? (
          <img src={a.image} alt={a.name} loading="lazy" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
          }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(300px 200px at 50% 30%, rgba(157,123,255,0.25), var(--panel-2))',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(12,12,17,0.85) 0%, transparent 45%)',
        }} />
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
          <div className="display" style={{ fontSize: '1.15rem', letterSpacing: 0 }}>{a.name}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--dim)', letterSpacing: '0.1em' }}>
            {a.country}{a.followers ? ` · ${a.followers}` : ''}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── EVENT ROW ────────────────────────────────────────────────
function EventRow({ e }) {
  const countdown = daysUntil(e.event_date)
  return (
    <div className="card card--lift reveal" style={{
      display: 'flex', alignItems: 'center', gap: 18, padding: '16px 20px',
    }}>
      <div style={{ textAlign: 'center', minWidth: 56 }}>
        <div className="display volt-text" style={{ fontSize: '1.6rem' }}>
          {e.event_date ? new Date(e.event_date + 'T00:00:00').getDate() : '—'}
        </div>
        <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--dim)', textTransform: 'uppercase' }}>
          {e.event_date ? new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }) : ''}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {e.event_name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--dim)' }}>
          {e.artist_name}{e.city ? ` · ${e.city}` : ''}{e.country ? `, ${e.country}` : ''}
        </div>
      </div>
      {countdown && (
        <span className="chip chip--pulse" style={{ cursor: 'default', flexShrink: 0 }}>{countdown}</span>
      )}
    </div>
  )
}

// ── PAGE ─────────────────────────────────────────────────────
export default function Home() {
  const [announcements, setAnnouncements] = useState([])
  const [artists, setArtists] = useState([])
  const [events, setEvents] = useState([])
  const [news, setNews] = useState([])
  const rootRef = useReveal()

  useEffect(() => {
    Promise.allSettled([fetchData('announcements'), fetchData('artists')]).then(([ann, art]) => {
      const artistList = (art.status === 'fulfilled' ? art.value : [])
        .map(a => [Math.random(), a]).sort((x, y) => x[0] - y[0]).map(x => x[1])
      setArtists(artistList)
      const byName = indexArtistsByName(artistList)
      if (ann.status === 'fulfilled') {
        const today = new Date().toISOString().split('T')[0]
        const upcoming = ann.value.filter(a => a.date && a.date >= today)
        // One slide per tour; explicit image → artist banner → gradient
        setAnnouncements(
          groupAnnouncements(upcoming).slice(0, 8).map(a => ({
            ...a,
            image: resolveImage(a, byName),
            eventType: (a.event_type || 'Event').toLowerCase().replace(/^./, c => c.toUpperCase()),
          }))
        )
      }
    })
    fetchData('schedule').then(rows => setEvents(rows.slice(0, 6))).catch(() => {})
    fetchData('news').then(rows => setNews(rows.slice(0, 8))).catch(() => {})
  }, [])

  return (
    <div ref={rootRef}>
      <Hero slides={announcements.length ? announcements : [HERO_FALLBACK]} />
      <NewsTicker items={news} />
      <ArtistMarquee artists={artists} />
      <SyncStrip />

      {/* ARTISTS */}
      <section className="section wrap">
        <div className="section-head">
          <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>Artists</h2>
          <Link to="/artists" className="btn btn--ghost" style={{ flexShrink: 0 }}>All artists</Link>
        </div>
        {artists.length ? (
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(44vw, 180px), 1fr))' }}>
            {artists.slice(0, 5).map(a => <ArtistCard key={a.id} a={a} />)}
          </div>
        ) : (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--dim)' }}>
            Artists appear here once they're live.
          </div>
        )}
      </section>

      {/* UPCOMING */}
      <section className="section wrap" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>Upcoming</h2>
          <Link to="/schedule" className="btn btn--ghost" style={{ flexShrink: 0 }}>Full schedule</Link>
        </div>
        {events.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {events.map(e => <EventRow key={e.id} e={e} />)}
          </div>
        ) : (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--dim)' }}>
            No upcoming events yet. Check back soon.
          </div>
        )}
      </section>

      {/* NEWS STRIP */}
      {news.length > 0 && (
        <section className="section wrap" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>News</h2>
            <Link to="/feed" className="btn btn--ghost" style={{ flexShrink: 0 }}>The feed</Link>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(88vw, 290px), 1fr))' }}>
            {news.map(n => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="card card--lift reveal" style={{ display: 'block' }}>
                {n.image && (
                  <div style={{ position: 'relative', paddingTop: '54%', overflow: 'hidden' }}>
                    <img src={n.image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: '13px 15px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.4, marginBottom: 7 }}>{n.title}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--faint)' }}>
                    {n.artist && <span style={{ color: 'var(--volt)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{n.artist} · </span>}
                    {n.source}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--line)', marginTop: 24 }}>
        <div className="wrap" style={{
          padding: '32px 0', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <img src="/logo.png" alt="HYPERSYNC" style={{ height: 34 }} />
          <div className="display volt-text" style={{ fontSize: 'clamp(1rem, 2.2vw, 1.4rem)', letterSpacing: '0.06em' }}>
            Tune in to everything.
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--faint)' }}>
            © {new Date().getFullYear()} HYPERSYNC
          </p>
        </div>
      </footer>
    </div>
  )
}
