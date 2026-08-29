import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchData } from '../lib/api'

/* ============================================================
   SHOP — the fan-facing marketplace.
   Reads MERCH (active items only, served by /api/data).
   Featured items lead. Buy buttons go to the artist's own
   store link — HYPERSYNC takes nothing on marketplace sales.
   ============================================================ */

export default function Shop() {
  const [items, setItems] = useState(null)
  const [artists, setArtists] = useState([])
  const [packs, setPacks] = useState([])
  const [cat, setCat] = useState('ALL')
  const [who, setWho] = useState('ALL')

  useEffect(() => {
    fetchData('merch').then(setItems).catch(() => setItems([]))
    fetchData('artists').then(setArtists).catch(() => {})
    fetch('/api/credits?action=packs')
      .then(r => r.json())
      .then(d => setPacks(Object.entries(d.packs || {}).map(([id, p]) => ({ id, ...p }))))
      .catch(() => {})
  }, [])

  const artistId = useMemo(() => {
    const map = {}
    for (const a of artists) map[(a.name || '').trim().toLowerCase()] = a.id
    return map
  }, [artists])

  const cats = useMemo(() => {
    const set = new Set()
    for (const it of items || []) if (it.category) set.add(it.category)
    return ['ALL', ...[...set].sort()]
  }, [items])

  const names = useMemo(() => {
    const set = new Set()
    for (const it of items || []) if (it.artist_name) set.add(it.artist_name)
    return ['ALL', ...[...set].sort()]
  }, [items])

  const shown = useMemo(() => {
    let list = items || []
    if (cat !== 'ALL') list = list.filter(i => i.category === cat)
    if (who !== 'ALL') list = list.filter(i => i.artist_name === who)
    return [...list.filter(i => i.featured), ...list.filter(i => !i.featured)]
  }, [items, cat, who])

  const price = it => (it.price != null && it.price !== '' ? `${it.currency || ''}${Number(it.price).toLocaleString()}` : '')

  return (
    <div className="wrap section">
      <h1 className="display" style={{ fontSize: 'clamp(2.2rem, 7vw, 4rem)', marginBottom: 20 }}>SHOP</h1>

      {/* ── CREDITS ── the platform currency, buyable here ── */}
      {packs.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <h2 className="display" style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.9rem)' }}>CREDITS</h2>

          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(88vw, 200px), 1fr))' }}>
            {packs.map(p => (
              <div key={p.id} className="card card--lift" style={{ padding: '22px 20px', textAlign: 'center', border: p.id === 'superfan' ? '1px solid rgba(255,212,0,0.4)' : undefined }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.16em', color: 'var(--faint)', textTransform: 'uppercase' }}>{p.label}</div>
                <div className="display" style={{ fontSize: '2rem', color: 'var(--volt)', margin: '8px 0 2px' }}>{p.credits}</div>
                <div style={{ fontSize: '0.64rem', color: 'var(--faint)', marginBottom: 14 }}>credits</div>
                <a href={`/shop?buy=${p.id}`} onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('hs-buy-credits', { detail: p.id })) }}
                  className="btn btn--volt" style={{ width: '100%' }}>₱{p.price}</a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* filters */}
      {items && items.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
          {names.length > 2 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {names.map(n => (
                <button key={n} onClick={() => setWho(n)} className="chip" style={{
                  cursor: 'pointer',
                  background: who === n ? 'var(--volt-grad)' : undefined,
                  color: who === n ? '#14120A' : undefined,
                }}>{n}</button>
              ))}
            </div>
          )}
          {cats.length > 2 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {cats.map(c => (
                <button key={c} onClick={() => setCat(c)} className="chip" style={{
                  cursor: 'pointer', fontSize: '0.58rem',
                  background: cat === c ? 'rgba(157,123,255,0.25)' : undefined,
                }}>{c}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {items === null ? (
        <div className="card" style={{ height: 160, opacity: 0.35 }} />
      ) : shown.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="display" style={{ fontSize: '1.2rem' }}>COMING SOON</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(88vw, 240px), 1fr))' }}>
          {shown.map(it => (
            <div key={it.id} className="card card--lift" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--panel)' }}>
                {it.image_url && (
                  <img src={it.image_url} alt={it.item_name} loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.currentTarget.style.display = 'none' }} />
                )}
                {it.featured && (
                  <span style={{
                    position: 'absolute', top: 10, left: 10, padding: '4px 10px', borderRadius: 999,
                    background: 'var(--volt-grad)', color: '#14120A',
                    fontSize: '0.54rem', fontWeight: 800, letterSpacing: '0.14em',
                  }}>FEATURED</span>
                )}
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {artistId[(it.artist_name || '').trim().toLowerCase()] ? (
                  <Link to={`/artists/${artistId[(it.artist_name || '').trim().toLowerCase()]}`} style={{
                    fontSize: '0.6rem', fontWeight: 800, color: 'var(--volt)',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>{it.artist_name}</Link>
                ) : (
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--volt)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {it.artist_name}
                  </span>
                )}
                <div style={{ fontWeight: 800, fontSize: '0.9rem', lineHeight: 1.35 }}>{it.item_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                  <span className="display" style={{ fontSize: '1.05rem' }}>{price(it)}</span>
                  {it.category && <span className="chip" style={{ fontSize: '0.52rem' }}>{it.category}</span>}
                  {it.buy_url ? (
                    <a href={it.buy_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn--volt" style={{ marginLeft: 'auto', padding: '8px 16px', fontSize: '0.7rem' }}>
                      Buy
                    </a>
                  ) : (
                    <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--faint)' }}>In stores soon</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
