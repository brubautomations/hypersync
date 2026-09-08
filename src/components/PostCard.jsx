import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { parsePost, pickLanguage, getPreferredLang, setPreferredLang, LANGUAGES } from '../lib/posts'
import { useAuth } from '../context/AuthContext'
import { getSession } from '../lib/api'
import { SignInModal } from './modals'

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
  const [lightbox, setLightbox] = useState(false)
  const [shared, setShared] = useState(false)

  const { isSignedIn } = useAuth()
  const [likes, setLikes] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [openComments, setOpenComments] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wall, setWall] = useState(false)

  const { text } = lang && segments[lang]
    ? { text: segments[lang] }
    : pickLanguage(segments, getPreferredLang())

  const long = text.length > 260
  const shown = expanded || !long ? text : text.slice(0, 260).trimEnd() + '…'
  const avatar = artist?.portal_avatar || artist?.image || ''
  const name = post.artist_name || artist?.name || ''
  const image = post.image_urls?.[0] || ''
  const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(image)

  const switchLang = (code) => { setLang(code); setPreferredLang(code) }

  const load = useCallback(() => {
    fetch(`/api/post-actions?post=${post.id}`, {
      headers: { Authorization: `Bearer ${getSession() || ''}` },
    })
      .then(r => r.json())
      .then(d => {
        setLikes(d.likes || 0)
        setLiked(!!d.liked)
        setComments(Array.isArray(d.comments) ? d.comments : [])
      })
      .catch(() => {})
  }, [post.id])

  useEffect(load, [load])

  const act = async payload => {
    if (!isSignedIn) { setWall(true); return null }
    setError('')
    const res = await fetch('/api/post-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSession()}` },
      body: JSON.stringify({ post: post.id, ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Something went wrong'); return null }
    return data
  }

  const toggleLike = async () => {
    if (!isSignedIn) { setWall(true); return }
    const next = !liked
    setLiked(next); setLikes(n => n + (next ? 1 : -1))   // move first, correct after
    const d = await act({ like: next })
    if (d) { setLikes(d.likes); setLiked(d.liked) } else load()
  }

  const comment = async e => {
    e.preventDefault()
    if (busy || !draft.trim()) return
    setBusy(true)
    const d = await act({ body: draft.trim() })
    if (d) { setComments(d.comments || []); setDraft('') }
    setBusy(false)
  }

  // Shareable link. It carries its own preview card, so pasting it anywhere
  // shows the photo, the artist and HYPERSYNC.LIVE.
  const shareUrl = `https://hypersync.live/p/${post.id}`

  const share = async () => {
    const data = { title: `${name} on HYPERSYNC`, text: shown.slice(0, 120), url: shareUrl }
    try {
      if (navigator.share) { await navigator.share(data); return }
      await navigator.clipboard.writeText(shareUrl)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch { /* dismissed */ }
  }

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

      {/* ── media: photo or video ── */}
      {image && imgOk && (
        isVideo ? (
          <video
            src={image}
            controls
            playsInline
            preload="metadata"
            onError={() => setImgOk(false)}
            style={{ width: '100%', maxHeight: 560, background: '#000', display: 'block' }}
          />
        ) : (
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            onClick={() => setLightbox(true)}
            style={{
              width: '100%', maxHeight: 560, objectFit: 'contain',
              background: '#0A0A0D', display: 'block', cursor: 'zoom-in',
            }}
          />
        )
      )}

      {/* full photo, click anywhere to close */}
      {lightbox && !isVideo && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(4px)',
            display: 'grid', placeItems: 'center', padding: 20, cursor: 'zoom-out',
          }}
        >
          <img src={image} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}

      {/* ── like · comment · share ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px 0', flexWrap: 'wrap',
      }}>
        <button onClick={toggleLike} title={isSignedIn ? '' : 'Sign in to react'} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'none', border: '1px solid var(--line)', borderRadius: 999,
          padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em',
          color: liked ? 'var(--volt)' : 'var(--dim)',
          borderColor: liked ? 'rgba(255,212,0,0.5)' : 'var(--line)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24"
               fill={liked ? 'currentColor' : 'none'} stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
          {likes > 0 ? likes : 'LIKE'}
        </button>

        <button onClick={() => setOpenComments(o => !o)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'none', border: '1px solid var(--line)', borderRadius: 999,
          padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--dim)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4.2-1L3 20l1.1-4.6A8.4 8.4 0 1 1 21 11.5z" />
          </svg>
          {comments.length > 0 ? comments.length : 'COMMENT'}
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={share} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'none', border: '1px solid var(--line)', borderRadius: 999,
          padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em',
          color: shared ? 'var(--volt)' : 'var(--dim)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
          </svg>
          {shared ? 'LINK COPIED' : 'SHARE'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 16px 0', fontSize: '0.72rem', color: '#FF7A7A' }}>{error}</div>
      )}

      {/* ── comments ── */}
      {openComments && (
        <div style={{ padding: '12px 16px 4px', display: 'grid', gap: 10 }}>
          {comments.map(c => (
            <div key={c.id} style={{ fontSize: '0.82rem', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--volt)', fontWeight: 800, fontSize: '0.7rem', marginRight: 7 }}>
                {c.handle}
              </span>
              <span style={{ color: 'var(--text)' }}>{c.body}</span>
              <span style={{ color: 'var(--faint)', fontSize: '0.62rem', marginLeft: 7 }}>
                {timeAgo(c.created_at)}
              </span>
            </div>
          ))}

          {!comments.length && (
            <div style={{ fontSize: '0.76rem', color: 'var(--faint)' }}>No comments yet.</div>
          )}

          {isSignedIn ? (
            <form onSubmit={comment} style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                maxLength={500}
                placeholder="Add a comment…"
                style={{
                  flex: 1, minWidth: 0, padding: '9px 13px', borderRadius: 'var(--r-sm, 10px)',
                  border: '1px solid var(--line)', background: 'var(--panel)',
                  color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button type="submit" disabled={busy || !draft.trim()} className="btn btn--volt"
                style={{ padding: '9px 16px', fontSize: '0.72rem', opacity: busy || !draft.trim() ? 0.5 : 1 }}>
                Post
              </button>
            </form>
          ) : (
            <button onClick={() => setWall(true)} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.76rem', color: 'var(--volt)',
              fontWeight: 700, textAlign: 'left',
            }}>
              Sign in to comment
            </button>
          )}
        </div>
      )}

      {wall && !isSignedIn && (
        <SignInModal onClose={() => setWall(false)} message={`Sign in to react to ${name}.`} />
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
