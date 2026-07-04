import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchData } from '../lib/api'
import { useReveal } from '../lib/useReveal'
import { deriveTourKey } from '../lib/tours'
import { DMModal } from '../components/modals'

const SOCIALS = [
  ['youtube', 'YouTube'], ['spotify', 'Spotify'], ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'], ['twitter', 'X'], ['facebook', 'Facebook'],
]

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDate(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

export default function ArtistDetail() {
  const { id } = useParams()
  const [artist, setArtist] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [posts, setPosts] = useState([])
  const [news, setNews] = useState([])
  const [events, setEvents] = useState([])
  const [showDM, setShowDM] = useState(false)
  const rootRef = useReveal()

  useEffect(() => {
    fetchData('artists').then(rows => {
      const a = rows.find(r => r.id === id)
      if (!a) { setNotFound(true); return }
      setArtist(a)
      fetchData('posts', { artist: a.name }).then(setPosts).catch(() => {})
      fetchData('news').then(all =>
        setNews(all.filter(n => (n.artist || '').toLowerCase() === a.name.toLowerCase()).slice(0, 8))
      ).catch(() => {})
      fetchData('schedule').then(all =>
        setEvents(all.filter(e => (e.artist_name || '').toLowerCase() === a.name.toLowerCase()))
      ).catch(() => {})
    }).catch(() => setNotFound(true))
  }, [id])

  // Group legs of the same tour together
  const tours = useMemo(() => {
    const map = new Map()
    for (const e of events) {
      const key = e.tour_key || deriveTourKey(e.artist_name, e.event_name)
      if (!map.has(key)) map.set(key, { name: e.event_name, type: e.event_type, legs: [] })
      map.get(key).legs.push(e)
    }
    return [...map.values()].map(t => ({
      ...t,
      legs: t.legs.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '')),
    })).sort((a, b) => (a.legs[0]?.event_date || '').localeCompare(b.legs[0]?.event_date || ''))
  }, [events])

  if (notFound) return (
    <div className="wrap section" style={{ textAlign: 'center' }}>
      <h1 className="display" style={{ fontSize: '2.4rem' }}>Artist not found</h1>
      <Link to="/artists" className="btn btn--ghost" style={{ marginTop: 18 }}>All artists</Link>
    </div>
  )

  if (!artist) return (
    <div className="wrap section" style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
      <span className="chip chip--volt-line"><span className="sync-dot" />Syncing…</span>
    </div>
  )

  const banner = artist.portal_banner || artist.image

  return (
    <div ref={rootRef}>
      {/* ── BANNER ── */}
      <div style={{ position: 'relative', height: 'min(52vh, 460px)', minHeight: 300, overflow: 'hidden' }}>
        {banner ? (
          <img src={banner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'radial-gradient(800px 400px at 70% 20%, rgba(255,212,0,0.15), transparent 60%), radial-gradient(600px 400px at 20% 90%, rgba(157,123,255,0.2), var(--ink))',
          }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--ink) 2%, rgba(12,12,17,0.4) 55%, rgba(12,12,17,0.1))' }} />
        <div className="wrap" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            {artist.portal_avatar && (
              <img src={artist.portal_avatar} alt={artist.name} style={{
                width: 92, height: 92, borderRadius: 24, objectFit: 'cover',
                border: '2px solid rgba(255,212,0,0.5)', boxShadow: 'var(--glow)',
              }} />
            )}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="chip chip--on" style={{ cursor: 'default' }}>{artist.country}</span>
                {artist.debut && <span className="chip" style={{ cursor: 'default' }}>Since {artist.debut}</span>}
              </div>
              <h1 className="display" style={{ fontSize: 'clamp(2.2rem, 6vw, 4.2rem)' }}>{artist.name}</h1>
            </div>
            <button className="btn btn--volt" onClick={() => setShowDM(true)}>
              Message {artist.name}
            </button>
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ borderBlock: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1 }}>
          {[
            ['Followers', artist.followers || '—'],
            ['Video views', artist.youtube_views || '—'],
            ['News this month', artist.news_this_month || 0],
            ['Agency', artist.agency || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '18px 12px', textAlign: 'center' }}>
              <div className="display volt-text" style={{ fontSize: '1.3rem' }}>{value}</div>
              <div className="eyebrow" style={{ fontSize: '0.6rem', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wrap section" style={{ display: 'grid', gap: 'clamp(36px, 5vw, 56px)' }}>
        {/* ── BIO + SOCIALS ── */}
        {(artist.bio || SOCIALS.some(([k]) => artist[k])) && (
          <section className="reveal">
            {artist.bio && (
              <p style={{ maxWidth: 720, color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: 18 }}>
                {artist.bio}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SOCIALS.filter(([k]) => artist[k]).map(([k, label]) => (
                <a key={k} href={artist[k]} target="_blank" rel="noopener noreferrer" className="chip">
                  {label} ↗
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── TOURS ── */}
        {tours.length > 0 && (
          <section>
            <div className="section-head">
              <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)' }}>
                On <span className="volt-text">stage</span>
              </h2>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {tours.map((t, i) => (
                <div key={i} className="card reveal" style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: t.legs.length > 1 ? 12 : 0 }}>
                    <span className="chip chip--on" style={{ cursor: 'default' }}>{t.type || 'Event'}</span>
                    <div style={{ fontWeight: 800, fontSize: '1rem', flex: 1, minWidth: 200 }}>{t.name}</div>
                    {t.legs.length > 1 && (
                      <span className="chip chip--pulse" style={{ cursor: 'default' }}>{t.legs.length} dates</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {t.legs.map(l => (
                      <div key={l.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                        fontSize: '0.82rem', color: 'var(--dim)',
                        padding: '8px 0', borderTop: t.legs.length > 1 ? '1px solid var(--line)' : 'none',
                      }}>
                        <span style={{ color: 'var(--volt)', fontWeight: 800, minWidth: 96 }}>{fmtDate(l.event_date)}</span>
                        <span style={{ flex: 1, minWidth: 160 }}>
                          {[l.venue, l.city, l.country].filter(Boolean).join(', ') || 'Details soon'}
                        </span>
                        {l.ticket_url && l.source !== 'gemini_web_search' && (
                          <a href={l.ticket_url} target="_blank" rel="noopener noreferrer"
                            className="chip chip--volt-line">Tickets ↗</a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── POSTS ── */}
        {posts.length > 0 && (
          <section>
            <div className="section-head">
              <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)' }}>Updates</h2>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {posts.slice(0, 10).map(p => {
                const body = (
                  <div className="card card--lift reveal" style={{ display: 'flex', gap: 16, padding: '16px 18px', alignItems: 'flex-start' }}>
                    {p.image_urls[0] && (
                      <img src={p.image_urls[0]} alt="" loading="lazy" style={{
                        width: 84, height: 84, borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0,
                      }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.9rem', lineHeight: 1.55, marginBottom: 8 }}>
                        {p.ai_blurb || p.content}
                      </p>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {p.platform && <span className="chip" style={{ cursor: 'default', fontSize: '0.58rem', padding: '3px 9px' }}>{p.platform}</span>}
                        <span style={{ fontSize: '0.68rem', color: 'var(--faint)' }}>{timeAgo(p.created_at)}</span>
                        {p.is_exclusive && <span className="chip chip--volt-line" style={{ cursor: 'default', fontSize: '0.58rem', padding: '3px 9px' }}>Exclusive</span>}
                      </div>
                    </div>
                  </div>
                )
                return p.source_url
                  ? <a key={p.id} href={p.source_url} target="_blank" rel="noopener noreferrer">{body}</a>
                  : <div key={p.id}>{body}</div>
              })}
            </div>
          </section>
        )}

        {/* ── NEWS ── */}
        {news.length > 0 && (
          <section>
            <div className="section-head">
              <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)' }}>In the news</h2>
              <Link to="/feed" className="btn btn--ghost">Full feed</Link>
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(88vw, 300px), 1fr))' }}>
              {news.map(n => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                  className="card card--lift reveal" style={{ display: 'block' }}>
                  {n.image && (
                    <div style={{ paddingTop: '54%', position: 'relative', overflow: 'hidden' }}>
                      <img src={n.image} alt="" loading="lazy" style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                      }} />
                    </div>
                  )}
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.4, marginBottom: 8 }}>{n.title}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--faint)' }}>
                      {n.source}{n.published ? ` · ${fmtDate(n.published)}` : ''}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>

      {showDM && <DMModal artist={artist} onClose={() => setShowDM(false)} />}
    </div>
  )
}
