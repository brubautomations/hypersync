import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchData } from '../lib/api'
import { useReveal } from '../lib/useReveal'

function ArtistTile({ a }) {
  return (
    <Link to={`/artists/${a.id}`} className="card card--lift reveal" style={{ display: 'block' }}>
      <div style={{ position: 'relative', paddingTop: '118%', overflow: 'hidden' }}>
        {a.image ? (
          <img src={a.image} alt={a.name} loading="lazy" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(320px 220px at 50% 30%, rgba(157,123,255,0.25), var(--panel-2))',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(12,12,17,0.88) 0%, transparent 48%)',
        }} />
        <span className="chip" style={{
          position: 'absolute', top: 10, left: 10, cursor: 'default',
          background: 'rgba(12,12,17,0.65)', backdropFilter: 'blur(6px)',
          padding: '4px 10px', fontSize: '0.6rem',
        }}>{a.country}</span>
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
          <div className="display" style={{ fontSize: '1.2rem' }}>{a.name}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--dim)', letterSpacing: '0.08em' }}>
            {a.agency || '—'}{a.followers ? ` · ${a.followers} followers` : ''}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Artists() {
  const [artists, setArtists] = useState(null)
  const [country, setCountry] = useState('All')
  const [search, setSearch] = useState('')
  const rootRef = useReveal()

  useEffect(() => {
    fetchData('artists').then(setArtists).catch(() => setArtists([]))
  }, [])

  const countries = useMemo(() =>
    ['All', ...new Set((artists || []).map(a => a.country).filter(Boolean).sort())],
    [artists])

  const filtered = useMemo(() => (artists || []).filter(a => {
    const okC = country === 'All' || a.country === country
    const q = search.toLowerCase()
    const okQ = !q || a.name.toLowerCase().includes(q) || (a.agency || '').toLowerCase().includes(q)
    return okC && okQ
  }), [artists, country, search])

  return (
    <div ref={rootRef} className="wrap section">
      <div style={{ marginBottom: 'clamp(24px, 4vw, 40px)' }}>
        <div className="eyebrow eyebrow--volt" style={{ marginBottom: 10 }}>Explore</div>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 7vw, 4.5rem)' }}>
          Pick your <span className="volt-text">artist</span>
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 26 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search artists or agencies…"
          style={{
            background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 999,
            color: 'var(--text)', padding: '11px 20px', fontSize: '0.88rem',
            outline: 'none', fontFamily: 'inherit', minWidth: 'min(300px, 100%)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--volt)'}
          onBlur={e => e.target.style.borderColor = 'var(--line)'}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {countries.map(c => (
            <button key={c} className={c === country ? 'chip chip--on' : 'chip'} onClick={() => setCountry(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {artists === null ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--dim)' }}>
          <span className="chip chip--volt-line" style={{ cursor: 'default' }}><span className="sync-dot" />Syncing artists…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--dim)' }}>
          No artists match. Try another search or country.
        </div>
      ) : (
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(46vw, 200px), 1fr))',
        }}>
          {filtered.map(a => <ArtistTile key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}
