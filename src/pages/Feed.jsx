import { useState, useEffect, useMemo } from 'react'
import { fetchData } from '../lib/api'
import { useReveal } from '../lib/useReveal'
import PostCard from '../components/PostCard'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function FeedCard({ item }) {
  const isPost = item.kind === 'post'
  const body = (
    <article className="card card--lift reveal" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {item.image && (
        <div style={{ position: 'relative', paddingTop: '56%', overflow: 'hidden' }}>
          <img src={item.image} alt="" loading="lazy" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          }} />
          <span className={isPost ? 'chip chip--pulse' : 'chip chip--volt-line'} style={{
            position: 'absolute', top: 10, left: 10, cursor: 'default',
            fontSize: '0.58rem', padding: '4px 10px',
            background: 'rgba(12,12,17,0.7)', backdropFilter: 'blur(6px)',
          }}>{isPost ? (item.platform || 'Update') : 'News'}</span>
        </div>
      )}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {!item.image && (
          <span className={isPost ? 'chip chip--pulse' : 'chip chip--volt-line'}
            style={{ cursor: 'default', fontSize: '0.58rem', padding: '4px 10px', alignSelf: 'flex-start' }}>
            {isPost ? (item.platform || 'Update') : 'News'}
          </span>
        )}
        <p style={{ fontWeight: isPost ? 500 : 700, fontSize: '0.88rem', lineHeight: 1.45, flex: 1 }}>
          {item.title}
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {item.artist && (
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--volt)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {item.artist}
            </span>
          )}
          <span style={{ fontSize: '0.66rem', color: 'var(--faint)' }}>
            {item.source ? `${item.source} · ` : ''}{timeAgo(item.when)}
          </span>
        </div>
      </div>
    </article>
  )
  return item.link
    ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', height: '100%' }}>{body}</a>
    : body
}

export default function Feed() {
  const [news, setNews] = useState([])
  const [posts, setPosts] = useState([])
  const [artistsByName, setArtistsByName] = useState({})
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('All')     // All | News | Updates
  const [artist, setArtist] = useState('All')
  const [visible, setVisible] = useState(24)
  const rootRef = useReveal()

  useEffect(() => {
    fetchData('artists').then(rows => {
      const m = {}
      rows.forEach(a => { m[(a.name || '').trim().toLowerCase()] = a })
      setArtistsByName(m)
    }).catch(() => {})
    Promise.allSettled([fetchData('news'), fetchData('posts')]).then(([n, p]) => {
      if (n.status === 'fulfilled') setNews(n.value)
      if (p.status === 'fulfilled') setPosts(p.value)
      setLoading(false)
    })
  }, [])

  const items = useMemo(() => {
    const mapped = [
      ...news.map(n => ({
        kind: 'news', id: `n-${n.id}`, title: n.title, image: n.image,
        artist: n.artist, source: n.source, link: n.url,
        when: n.created_at || n.published,
      })),
      ...posts.map(p => ({
        kind: 'post', id: `p-${p.id}`, when: p.created_at, artist: p.artist_name, post: p,
      })),
    ]
    return mapped
      .filter(i => kind === 'All' || (kind === 'News' ? i.kind === 'news' : i.kind === 'post'))
      .filter(i => artist === 'All' || i.artist === artist)
      .sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0))
  }, [news, posts, kind, artist])

  const artists = useMemo(() =>
    ['All', ...new Set([...news.map(n => n.artist), ...posts.map(p => p.artist_name)].filter(Boolean).sort())],
    [news, posts])

  return (
    <div ref={rootRef} className="wrap section">
      <div style={{ marginBottom: 'clamp(24px, 4vw, 40px)' }}>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 7vw, 4.5rem)' }}>Feed</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {['All', 'News', 'Updates'].map(k => (
          <button key={k} className={k === kind ? 'chip chip--on' : 'chip'} onClick={() => setKind(k)}>{k}</button>
        ))}
      </div>
      {artists.length > 2 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
          {artists.slice(0, 14).map(a => (
            <button key={a} className={a === artist ? 'chip chip--volt-line' : 'chip'}
              onClick={() => setArtist(a)} style={{ fontSize: '0.64rem' }}>{a}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <span className="chip chip--volt-line" style={{ cursor: 'default' }}><span className="sync-dot" />Syncing the feed…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--dim)' }}>
          Nothing here yet — the feed fills as your artists make moves.
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid', gap: 14,
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(88vw, 290px), 1fr))',
          }}>
            {items.slice(0, visible).map(i => i.kind === 'post'
              ? <div key={i.id} style={{ gridColumn: '1 / -1', maxWidth: 620 }}>
                  <PostCard post={i.post} artist={artistsByName[(i.post.artist_name || '').trim().toLowerCase()]} />
                </div>
              : <FeedCard key={i.id} item={i} />)}
          </div>
          {visible < items.length && (
            <div style={{ textAlign: 'center', marginTop: 30 }}>
              <button className="btn btn--ghost" onClick={() => setVisible(v => v + 24)}>
                Load more ({items.length - visible} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
