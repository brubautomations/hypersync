import { useState } from 'react'
import { Link } from 'react-router-dom'
import { parsePost, pickLanguage, getPreferredLang, setPreferredLang, LANGUAGES } from '../lib/posts'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// One artist post, styled like a real social post.
// `artist` (optional): { id, name, portal_avatar, image, country } for the header.
export default function PostCard({ post, artist }) {
  const segments = parsePost(post.content)
  const langCodes = segments._plain !== undefined ? [] : Object.keys(segments)
  const [lang, setLang] = useState(() => pickLanguage(segments, getPreferredLang()).code)
  const [expanded, setExpanded] = useState(false)
  const [imgOk, setImgOk] = useState(true)

  const { text } = lang && segments[lang]
    ? { text: segments[lang] }
    : pickLanguage(segments, getPreferredLang())

  const long = text.length > 260
  const shown = expanded || !long ? text : text.slice(0, 260).trimEnd() + '…'
  const avatar = artist?.portal_avatar || artist?.image || ''
  const name = post.artist_name || artist?.name || ''
  const image = post.image_urls?.[0] || ''

  const switchLang = (code) => { setLang(code); setPreferredLang(code) }

  return (
    <article className="card reveal" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── header: who + when ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
        {artist?.id ? (
          <Link to={`/artists/${artist.id}`} style={{ flexShrink: 0, display: 'flex' }}>
            {avatar ? (
              <img src={avatar} alt={name} loading="lazy" style={{
                width: 42, height: 42, borderRadius: 12, objectFit: 'cover',
                border: '1px solid var(--line)',
              }} />
            ) : (
              <div style={{
                width: 42, height: 42, borderRadius: 12, background: 'var(--volt-grad)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: '#14120A',
              }}>{(name || '?')[0]}</div>
            )}
          </Link>
        ) : avatar ? (
          <img src={avatar} alt={name} loading="lazy" style={{
            width: 42, height: 42, borderRadius: 12, objectFit: 'cover',
            border: '1px solid var(--line)', flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: 'var(--volt-grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#14120A', flexShrink: 0,
          }}>{(name || '?')[0]}</div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {artist?.id
              ? <Link to={`/artists/${artist.id}`} style={{ color: 'var(--text)' }}>{name}</Link>
              : name}
            {post.is_exclusive && (
              <span className="chip chip--volt-line" style={{ cursor: 'default', fontSize: '0.55rem', padding: '2px 8px' }}>Exclusive</span>
            )}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--faint)' }}>
            {post.platform ? `${post.platform} · ` : ''}{timeAgo(post.created_at)}
          </div>
        </div>
      </div>

      {/* ── body text ── */}
      <div style={{ padding: '0 16px 12px' }}>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {shown}
          {long && (
            <button onClick={() => setExpanded(e => !e)} style={{
              background: 'none', border: 'none', color: 'var(--volt)',
              fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
              padding: 0, marginLeft: 6, fontFamily: 'inherit',
            }}>{expanded ? 'less' : 'see more'}</button>
          )}
        </p>
      </div>

      {/* ── image (only when healthy) ── */}
      {image && imgOk && (
        <img src={image} alt="" loading="lazy" onError={() => setImgOk(false)}
          style={{ width: '100%', maxHeight: 440, objectFit: 'cover' }} />
      )}

      {/* ── language switcher ── */}
      {langCodes.length > 1 && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 16px 14px',
        }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--faint)' }}>🌐</span>
          {langCodes.map(code => (
            <button key={code} onClick={() => switchLang(code)}
              className={code === lang ? 'chip chip--on' : 'chip'}
              style={{ fontSize: '0.58rem', padding: '3px 10px' }}>
              {LANGUAGES[code] || code}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
