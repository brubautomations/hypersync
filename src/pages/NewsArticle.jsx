import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchData } from '../lib/api'
import { useReveal } from '../lib/useReveal'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d)
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// The write-up lives in Body. Older rows only have the one-line Summary,
// so those still read fine, just shorter.
function bodyOf(n) {
  return n.body || n.Body || n.summary || n.Summary || ''
}

export default function NewsArticle() {
  const { id } = useParams()
  const [all, setAll] = useState(null)
  const [artists, setArtists] = useState({})
  const rootRef = useReveal()

  useEffect(() => {
    fetchData('news').then(setAll).catch(() => setAll([]))
    fetchData('artists').then(rows => {
      const m = {}
      rows.forEach(a => { m[(a.name || '').trim().toLowerCase()] = a })
      setArtists(m)
    }).catch(() => {})
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [id])

  const story = useMemo(() => (all || []).find(n => n.id === id), [all, id])

  // More on the same artist, then anything else recent.
  const related = useMemo(() => {
    if (!story || !all) return []
    const others = all.filter(n => n.id !== story.id)
    const sameArtist = story.artist
      ? others.filter(n => (n.artist || '') === story.artist)
      : []
    return [...sameArtist, ...others.filter(n => !sameArtist.includes(n))].slice(0, 6)
  }, [all, story])

  if (all === null) return (
    <div className="wrap section" style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
      <span className="chip chip--volt-line"><span className="sync-dot" />Syncing…</span>
    </div>
  )

  if (!story) return (
    <div className="wrap section" style={{ textAlign: 'center' }}>
      <h1 className="display" style={{ fontSize: '2.2rem' }}>Story not found</h1>
      <Link to="/feed" className="btn btn--ghost" style={{ marginTop: 18 }}>Back to the feed</Link>
    </div>
  )

  const artist = artists[(story.artist || '').trim().toLowerCase()]
  const paragraphs = bodyOf(story).split(/\n{2,}/).filter(Boolean)

  return (
    <div ref={rootRef}>
      {/* ── lead image ── */}
      {story.image && (
        <div style={{ position: 'relative', height: 'min(46vh, 420px)', minHeight: 240, overflow: 'hidden' }}>
          <img src={story.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, var(--ink) 3%, rgba(12,12,17,0.35) 60%, rgba(12,12,17,0.1))',
          }} />
        </div>
      )}

      <article className="wrap section" style={{ maxWidth: 760, marginTop: story.image ? -80 : 0, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {story.artist && (
            artist
              ? <Link to={`/artists/${artist.id}`} className="chip chip--on">{story.artist}</Link>
              : <span className="chip chip--on" style={{ cursor: 'default' }}>{story.artist}</span>
          )}
          {story.country && <span className="chip" style={{ cursor: 'default' }}>{story.country}</span>}
        </div>

        <h1 className="display" style={{ fontSize: 'clamp(1.9rem, 5vw, 3.1rem)', lineHeight: 1.1 }}>
          {story.title}
        </h1>

        <div style={{ fontSize: '0.72rem', color: 'var(--faint)', marginTop: 14, letterSpacing: '0.04em' }}>
          HYPERSYNC{story.published ? ` · ${fmtDate(story.published)}` : ''}
        </div>

        <div style={{ marginTop: 26, display: 'grid', gap: 18 }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: '1.02rem', lineHeight: 1.85, color: 'var(--dim)' }}>{p}</p>
          ))}
        </div>

        {/* ── credit, kept visible on purpose ── */}
        {story.url && (
          <div style={{
            marginTop: 30, paddingTop: 18, borderTop: '1px solid var(--line)',
            fontSize: '0.76rem', color: 'var(--faint)', lineHeight: 1.7,
          }}>
            Reported by{' '}
            <a href={story.url} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--volt)', fontWeight: 700 }}>
              {story.source || 'the original source'} ↗
            </a>
          </div>
        )}

        {artist && (
          <div className="card" style={{
            marginTop: 26, padding: '18px 20px', display: 'flex',
            alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            {artist.portal_avatar && (
              <img src={artist.portal_avatar} alt={artist.name}
                style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover' }} />
            )}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 800 }}>{artist.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--faint)' }}>{artist.country}</div>
            </div>
            <Link to={`/artists/${artist.id}`} className="btn btn--volt" style={{ padding: '10px 20px' }}>
              Follow the story
            </Link>
          </div>
        )}
      </article>

      {related.length > 0 && (
        <div className="wrap section" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <h2 className="display" style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2rem)' }}>More like this</h2>
            <Link to="/feed" className="btn btn--ghost">Full feed</Link>
          </div>
          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(88vw, 280px), 1fr))',
          }}>
            {related.map(n => (
              <Link key={n.id} to={`/news/${n.id}`} className="card card--lift reveal" style={{ display: 'block' }}>
                {n.image && (
                  <div style={{ paddingTop: '54%', position: 'relative', overflow: 'hidden' }}>
                    <img src={n.image} alt="" loading="lazy" style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                    }} />
                  </div>
                )}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.4 }}>{n.title}</div>
                  {n.artist && (
                    <div style={{
                      fontSize: '0.64rem', color: 'var(--volt)', fontWeight: 800,
                      letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 8,
                    }}>{n.artist}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
