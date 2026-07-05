import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchData } from '../lib/api'
import { useReveal } from '../lib/useReveal'

const TYPE_ICONS = {
  CONCERT: '🎤', FESTIVAL: '🎪', 'FAN MEET': '💛', 'ALBUM RELEASE': '💿',
  'SINGLE RELEASE': '🎵', COMEBACK: '✨', 'AWARD SHOW': '🏆',
  'TV GUESTING': '📺', 'VARIETY SHOW': '📺', MOVIE: '🎬', DRAMA: '🎬',
}

function fmtDay(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function monthOf(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// One tour (or standalone event) = one card, legs listed inside
function TourCard({ tour, artistId }) {
  const [open, setOpen] = useState(false)
  const legs = tour.legs
  const shown = open ? legs : legs.slice(0, 3)
  const icon = TYPE_ICONS[(tour.event_type || '').toUpperCase()] || '🎤'

  return (
    <article className="card reveal" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: legs.length ? 12 : 0 }}>
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {artistId
            ? <Link to={`/artists/${artistId}`} className="eyebrow eyebrow--volt" style={{ display: 'inline-block', marginBottom: 4 }}>{tour.artist}</Link>
            : <div className="eyebrow eyebrow--volt" style={{ marginBottom: 4 }}>{tour.artist}</div>}
          <h3 style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.3 }}>{tour.title}</h3>
        </div>
        {legs.length > 1 && (
          <span className="chip chip--pulse" style={{ cursor: 'default', flexShrink: 0 }}>{legs.length} dates</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {shown.map(l => (
          <div key={l.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
            background: 'var(--panel)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
          }}>
            <div style={{ minWidth: 92, fontWeight: 800, fontSize: '0.78rem', color: 'var(--volt)' }}>
              {fmtDay(l.event_date)}
            </div>
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'var(--dim)' }}>
              {[l.venue, l.city, l.country].filter(Boolean).join(', ') || '—'}
            </div>
            {l.ticket_url && l.source !== 'gemini_web_search' && (
              <a href={l.ticket_url} target="_blank" rel="noopener noreferrer"
                className="chip chip--volt-line" style={{ flexShrink: 0, fontSize: '0.58rem' }}>
                Tickets
              </a>
            )}
          </div>
        ))}
      </div>

      {legs.length > 3 && (
        <button onClick={() => setOpen(o => !o)} style={{
          background: 'none', border: 'none', color: 'var(--volt)', fontWeight: 700,
          cursor: 'pointer', fontSize: '0.78rem', marginTop: 10, padding: 0, fontFamily: 'inherit',
        }}>
          {open ? 'Show less' : `All ${legs.length} dates →`}
        </button>
      )}
    </article>
  )
}

export default function Schedule() {
  const rootRef = useReveal()
  const [events, setEvents] = useState([])
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [artist, setArtist] = useState('All')
  const [country, setCountry] = useState('All')

  useEffect(() => {
    Promise.allSettled([fetchData('schedule'), fetchData('artists')]).then(([s, a]) => {
      if (s.status === 'fulfilled') setEvents(s.value)
      if (a.status === 'fulfilled') setArtists(a.value)
      setLoading(false)
    })
  }, [])

  const artistIdByName = useMemo(() => {
    const m = {}
    artists.forEach(a => { m[(a.name || '').toLowerCase()] = a.id })
    return m
  }, [artists])

  const artistNames = useMemo(() =>
    ['All', ...new Set(events.map(e => e.artist_name).filter(Boolean))].sort((a, b) =>
      a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)),
    [events])

  const countries = useMemo(() =>
    ['All', ...new Set(events.map(e => e.country).filter(Boolean))].sort((a, b) =>
      a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)),
    [events])

  // Filter → group into tours → group tours by starting month
  const months = useMemo(() => {
    const filtered = events
      .filter(e => artist === 'All' || e.artist_name === artist)
      .filter(e => country === 'All' || e.country === country)

    const tours = new Map()
    for (const e of filtered) {
      const key = e.tour_key || `${e.artist_name}|${e.event_name}|${e.id}`
      if (!tours.has(key)) {
        tours.set(key, { key, artist: e.artist_name, title: e.event_name, event_type: e.event_type, legs: [] })
      }
      tours.get(key).legs.push(e)
    }

    const list = [...tours.values()]
    list.forEach(t => t.legs.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '')))
    list.sort((a, b) => (a.legs[0]?.event_date || '').localeCompare(b.legs[0]?.event_date || ''))

    const byMonth = new Map()
    for (const t of list) {
      const m = monthOf(t.legs[0].event_date)
      if (!byMonth.has(m)) byMonth.set(m, [])
      byMonth.get(m).push(t)
    }
    return [...byMonth.entries()]
  }, [events, artist, country])

  return (
    <div ref={rootRef} className="wrap section">
      <div style={{ marginBottom: 'clamp(24px, 4vw, 40px)' }}>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 7vw, 4.5rem)' }}>Schedule</h1>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {countries.map(c => (
            <button key={c} className={c === country ? 'chip chip--on' : 'chip'} onClick={() => setCountry(c)}>
              {c}
            </button>
          ))}
        </div>
        {artistNames.length > 2 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {artistNames.map(a => (
              <button key={a} className={a === artist ? 'chip chip--on' : 'chip'} onClick={() => setArtist(a)}>
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="card" style={{ height: 120, opacity: 0.4 }} />)}
        </div>
      ) : !months.length ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--dim)' }}>
          Nothing scheduled for this filter yet.
        </div>
      ) : (
        months.map(([month, tours]) => (
          <section key={month} style={{ marginBottom: 36 }}>
            <div className="eyebrow" style={{ color: 'var(--text)', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
              {month}
            </div>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(88vw, 340px), 1fr))' }}>
              {tours.map(t => (
                <TourCard key={t.key} tour={t} artistId={artistIdByName[(t.artist || '').toLowerCase()]} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
