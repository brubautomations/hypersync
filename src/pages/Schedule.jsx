import { useState, useEffect, useMemo } from 'react'
import { fetchData } from '../lib/api'
import { useReveal } from '../lib/useReveal'


// country name → ISO code → emoji flag (choice (a): native emoji, no assets)
const COUNTRY_CODES = {
  'philippines': 'PH', 'south korea': 'KR', 'korea': 'KR', 'japan': 'JP', 'china': 'CN',
  'taiwan': 'TW', 'hong kong': 'HK', 'macao': 'MO', 'macau': 'MO', 'thailand': 'TH',
  'vietnam': 'VN', 'indonesia': 'ID', 'malaysia': 'MY', 'singapore': 'SG', 'india': 'IN',
  'bangladesh': 'BD', 'sri lanka': 'LK', 'nepal': 'NP', 'kazakhstan': 'KZ', 'myanmar': 'MM',
  'cambodia': 'KH', 'australia': 'AU', 'new zealand': 'NZ', 'usa': 'US', 'united states': 'US',
  'uk': 'GB', 'united kingdom': 'GB', 'france': 'FR', 'germany': 'DE', 'spain': 'ES',
  'italy': 'IT', 'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH', 'austria': 'AT',
  'sweden': 'SE', 'denmark': 'DK', 'norway': 'NO', 'finland': 'FI', 'portugal': 'PT',
  'ireland': 'IE', 'czech republic': 'CZ', 'poland': 'PL', 'luxembourg': 'LU', 'cyprus': 'CY',
  'canada': 'CA', 'mexico': 'MX', 'brazil': 'BR', 'argentina': 'AR', 'chile': 'CL',
  'peru': 'PE', 'colombia': 'CO',
}
function flagOf(country) {
  const code = COUNTRY_CODES[(country || '').toLowerCase().trim()]
  if (!code) return null
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

// drag-to-scroll belt (NXG-style): grab, drag, momentum via native scroll
function useBelt() {
  const ref = { current: null }
  const state = { down: false, startX: 0, scrollLeft: 0, moved: 0 }
  const onPointerDown = e => {
    const el = e.currentTarget
    state.down = true; state.moved = 0
    state.startX = e.clientX; state.scrollLeft = el.scrollLeft
    el.setPointerCapture(e.pointerId)
  }
  const onPointerMove = e => {
    if (!state.down) return
    const dx = e.clientX - state.startX
    state.moved = Math.max(state.moved, Math.abs(dx))
    e.currentTarget.scrollLeft = state.scrollLeft - dx
  }
  const onPointerUp = e => { state.down = false; e.currentTarget.releasePointerCapture(e.pointerId) }
  const wasDrag = () => state.moved > 6
  return { onPointerDown, onPointerMove, onPointerUp, wasDrag }
}

const fmtLong = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
const iso = d => d.toISOString().split('T')[0]

// ── EVENT DETAIL MODAL — artist photo as the backdrop ──
function EventModal({ event, artist, onClose }) {
  const photo = artist?.portal_banner || artist?.portal_avatar || artist?.image || ''
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,8,12,0.82)',
      backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 18,
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        position: 'relative', width: 'min(94vw, 540px)', overflow: 'hidden',
        minHeight: 380, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}>
        {photo && (
          <img src={photo} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(10,10,14,0.25) 0%, rgba(10,10,14,0.88) 72%, rgba(10,10,14,0.97) 100%)',
        }} />
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 2, width: 34, height: 34,
          borderRadius: '50%', border: '1px solid var(--line)', background: 'rgba(12,12,17,0.7)',
          color: 'var(--text)', cursor: 'pointer', fontSize: '1rem',
        }}>✕</button>

        <div style={{ position: 'relative', zIndex: 1, padding: '26px 26px 28px' }}>
          <div className="eyebrow eyebrow--volt" style={{ marginBottom: 8 }}>{event.artist_name}</div>
          <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 4.5vw, 2.2rem)', lineHeight: 1.05, marginBottom: 12 }}>
            {event.event_name}
          </h2>
          <div className="display volt-text" style={{ fontSize: 'clamp(1rem, 2.6vw, 1.3rem)', letterSpacing: '0.04em', marginBottom: 6 }}>
            {fmtLong(event.event_date)}
          </div>
          {(event.venue || event.city || event.country) && (
            <div className="eyebrow" style={{ color: 'var(--text)', fontSize: '0.8rem', marginBottom: 18 }}>
              {[event.venue, event.city, event.country].filter(Boolean).join(', ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {event.event_type && <span className="chip" style={{ cursor: 'default' }}>{event.event_type}</span>}
            {event.ticket_url && (
              <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn--volt">
                Get tickets
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DAY MODAL — a date's full lineup ──
function DayModal({ date, events, onPick, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(8,8,12,0.8)',
      backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 18,
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: 'min(94vw, 440px)', padding: '22px 22px 18px' }}>
        <div className="display volt-text" style={{ fontSize: '1.1rem', letterSpacing: '0.04em', marginBottom: 14 }}>
          {fmtLong(date)}
        </div>
        <div style={{ display: 'grid', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
          {events.map(e => (
            <button key={e.id} onClick={() => onPick(e)} style={{
              textAlign: 'left', padding: '12px 14px', background: 'var(--panel)',
              border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              color: 'var(--text)', fontFamily: 'inherit',
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.72rem', color: 'var(--volt)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                {e.artist_name}
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{e.event_name}</div>
              {(e.city || e.country) && (
                <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: 3 }}>
                  {[e.city, e.country].filter(Boolean).join(', ')}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Schedule() {
  const rootRef = useReveal()
  const [events, setEvents] = useState([])
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('calendar')
  const [selArtists, setSelArtists] = useState([])   // empty = all
  const [selCountries, setSelCountries] = useState([]) // empty = all
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(null)
  const [dayOpen, setDayOpen] = useState(null)

  useEffect(() => {
    Promise.allSettled([fetchData('schedule'), fetchData('artists')]).then(([s, a]) => {
      if (s.status === 'fulfilled') setEvents(s.value)
      if (a.status === 'fulfilled') setArtists(a.value)
      setLoading(false)
    })
  }, [])

  const artistByName = useMemo(() => {
    const m = {}
    artists.forEach(a => { m[(a.name || '').toLowerCase()] = a })
    return m
  }, [artists])

  const filtered = useMemo(() =>
    events
      .filter(e => !selArtists.length || selArtists.includes(e.artist_name))
      .filter(e => !selCountries.length || selCountries.includes(e.country)),
    [events, selArtists, selCountries])

  const byDate = useMemo(() => {
    const m = new Map()
    for (const e of filtered) {
      if (!e.event_date) continue
      if (!m.has(e.event_date)) m.set(e.event_date, [])
      m.get(e.event_date).push(e)
    }
    return m
  }, [filtered])

  // artists on the belt: only those with events, ordered by SOONEST event
  const beltArtists = useMemo(() => {
    const nearest = {}
    for (const e of events) {
      if (!e.artist_name || !e.event_date) continue
      if (!nearest[e.artist_name] || e.event_date < nearest[e.artist_name]) nearest[e.artist_name] = e.event_date
    }
    return Object.keys(nearest)
      .sort((a, b) => nearest[a].localeCompare(nearest[b]))
      .map(name => ({ name, next: nearest[name], profile: artistByName[name.toLowerCase()] }))
  }, [events, artistByName])

  const countries = useMemo(() =>
    [...new Set(events.map(e => e.country).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [events])

  const toggleArtist = name => setSelArtists(cur =>
    cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name])
  const toggleCountry = c => setSelCountries(cur =>
    cur.includes(c) ? cur.filter(n => n !== c) : [...cur, c])
  const belt = useBelt()

  // calendar grid for the visible month
  const cells = useMemo(() => {
    const first = new Date(month)
    const startPad = first.getDay() // Sun = 0
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const out = []
    for (let i = 0; i < startPad; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = iso(new Date(Date.UTC(month.getFullYear(), month.getMonth(), d)))
      out.push({ day: d, date, events: byDate.get(date) || [] })
    }
    return out
  }, [month, byDate])

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayIso = iso(new Date(Date.now() + 8 * 3600 * 1000))

  // list view: filtered, upcoming, chronological
  const listRows = useMemo(() =>
    [...filtered].sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '')),
    [filtered])

  return (
    <div ref={rootRef} className="wrap section">
      <div className="section-head" style={{ marginBottom: 'clamp(20px, 3vw, 32px)' }}>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 7vw, 4.5rem)' }}>Schedule</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={view === 'calendar' ? 'chip chip--on' : 'chip'} onClick={() => setView('calendar')}>Calendar</button>
          <button className={view === 'list' ? 'chip chip--on' : 'chip'} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {/* ── flag strip: the world map of coverage ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {countries.map(c => {
          const flag = flagOf(c)
          const on = selCountries.includes(c)
          return (
            <button key={c} onClick={() => toggleCountry(c)} title={c} style={{
              width: 40, height: 32, display: 'grid', placeItems: 'center',
              fontSize: flag ? '1.15rem' : '0.58rem', fontWeight: 800, letterSpacing: '0.04em',
              background: on ? 'var(--volt-grad)' : 'var(--card)',
              color: on ? '#14120A' : 'var(--dim)',
              border: on ? '1px solid var(--volt)' : '1px solid var(--line)',
              borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'transform 0.15s', lineHeight: 1,
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              {flag || c.slice(0, 3).toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* ── artist belt: soonest event first, drag + multi-select ── */}
      {beltArtists.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            onPointerDown={belt.onPointerDown}
            onPointerMove={belt.onPointerMove}
            onPointerUp={belt.onPointerUp}
            style={{
              display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12,
              cursor: 'grab', userSelect: 'none', WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}>
            {beltArtists.map(a => {
              const on = selArtists.includes(a.name)
              const photo = a.profile?.portal_avatar || a.profile?.image || ''
              return (
                <button key={a.name}
                  onClick={() => { if (!belt.wasDrag()) toggleArtist(a.name) }}
                  style={{
                    flexShrink: 0, width: 74, background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                  }}>
                  <div style={{
                    width: 62, height: 62, margin: '0 auto 6px', borderRadius: '50%',
                    padding: 3, background: on ? 'var(--volt-grad)' : 'var(--line)',
                    transition: 'background 0.2s',
                  }}>
                    {photo ? (
                      <img src={photo} alt={a.name} draggable={false} loading="lazy" style={{
                        width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover',
                        display: 'block', opacity: selArtists.length && !on ? 0.45 : 1,
                        transition: 'opacity 0.2s',
                      }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        background: 'var(--card)', display: 'grid', placeItems: 'center',
                        fontWeight: 800, color: on ? 'var(--volt)' : 'var(--dim)',
                        opacity: selArtists.length && !on ? 0.45 : 1,
                      }}>{a.name[0]}</div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.05em',
                    textTransform: 'uppercase', textAlign: 'center',
                    color: on ? 'var(--volt)' : 'var(--dim)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{a.name}</div>
                </button>
              )
            })}
          </div>
          {(selArtists.length > 0 || selCountries.length > 0) && (
            <button className="chip chip--volt-line" style={{ marginTop: 2 }}
              onClick={() => { setSelArtists([]); setSelCountries([]) }}>
              {[selArtists.length && `${selArtists.length} artist${selArtists.length > 1 ? 's' : ''}`,
                selCountries.length && `${selCountries.length} countr${selCountries.length > 1 ? 'ies' : 'y'}`]
                .filter(Boolean).join(' · ')} — clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ height: 420, opacity: 0.4 }} />
      ) : view === 'calendar' ? (
        <>
          {/* month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button className="chip" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>←</button>
            <div className="display" style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)' }}>{monthLabel}</div>
            <button className="chip" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>→</button>
          </div>

          {/* weekday header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--faint)' }}>{d}</div>
            ))}
          </div>

          {/* grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {cells.map((c, i) => c === null ? <div key={`pad-${i}`} /> : (
              <div key={c.date}
                onClick={() => c.events.length && setDayOpen(c.date)}
                style={{
                  minHeight: 'clamp(64px, 9vw, 108px)', padding: '6px 6px',
                  background: 'var(--card)', border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)', overflow: 'hidden',
                  cursor: c.events.length ? 'pointer' : 'default',
                  outline: c.date === todayIso ? '1px solid var(--volt)' : 'none',
                }}>
                <div style={{
                  fontSize: '0.66rem', fontWeight: 800, marginBottom: 4,
                  color: c.date === todayIso ? 'var(--volt)' : c.events.length ? 'var(--text)' : 'var(--faint)',
                }}>{c.day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {c.events.slice(0, 3).map(e => (
                    <div key={e.id}
                      onClick={ev => { ev.stopPropagation(); setSelected(e) }}
                      style={{
                        fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.04em',
                        textTransform: 'uppercase', color: '#14120A',
                        background: 'var(--volt-grad)', borderRadius: 4,
                        padding: '2px 5px', whiteSpace: 'nowrap', overflow: 'hidden',
                        textOverflow: 'ellipsis', cursor: 'pointer',
                      }}>
                      {e.artist_name}
                    </div>
                  ))}
                  {c.events.length > 3 && (
                    <div style={{ fontSize: '0.56rem', fontWeight: 700, color: 'var(--volt)' }}>
                      +{c.events.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── LIST VIEW ── */
        !listRows.length ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--dim)' }}>
            Nothing scheduled for this filter yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, maxWidth: 760 }}>
            {listRows.map(e => (
              <button key={e.id} onClick={() => setSelected(e)} className="card card--lift reveal" style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
                textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit', width: '100%',
              }}>
                <div style={{ minWidth: 64, textAlign: 'center', flexShrink: 0 }}>
                  <div className="display volt-text" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                    {new Date(e.event_date + 'T00:00:00').getDate()}
                  </div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--faint)', textTransform: 'uppercase' }}>
                    {new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--volt)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                    {e.artist_name}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.event_name}
                  </div>
                  {(e.city || e.country) && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--faint)', marginTop: 2 }}>
                      {[e.venue, e.city, e.country].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                {e.event_type && (
                  <span className="chip" style={{ cursor: 'default', flexShrink: 0, fontSize: '0.56rem' }}>{e.event_type}</span>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {dayOpen && (
        <DayModal date={dayOpen} events={byDate.get(dayOpen) || []}
          onPick={e => { setDayOpen(null); setSelected(e) }}
          onClose={() => setDayOpen(null)} />
      )}
      {selected && (
        <EventModal event={selected}
          artist={artistByName[(selected.artist_name || '').toLowerCase()]}
          onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
