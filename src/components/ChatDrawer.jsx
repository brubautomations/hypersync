import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { chatEnabled, fetchRecentMessages, onNewMessage, sendChat } from '../lib/chat'

function timeShort(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

export default function ChatDrawer() {
  const { user, renderGoogleButton } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [unseen, setUnseen] = useState(0)
  const listRef = useRef(null)
  const openRef = useRef(false)
  openRef.current = open

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    if (!chatEnabled) return
    let alive = true
    fetchRecentMessages().then(m => { if (alive) { setMessages(m); scrollDown() } })
    const off = onNewMessage(msg => {
      setMessages(cur => [...cur.slice(-199), msg])
      if (openRef.current) scrollDown()
      else setUnseen(n => Math.min(99, n + 1))
    })
    return () => { alive = false; off() }
  }, [scrollDown])

  useEffect(() => { if (open) { setUnseen(0); scrollDown() } }, [open, scrollDown])

  const submit = async e => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true); setError('')
    try {
      await sendChat(text)
      setDraft('')
    } catch (err) {
      setError(err.message)
      setTimeout(() => setError(''), 3500)
    } finally {
      setSending(false)
    }
  }

  if (!chatEnabled) return null

  return (
    <>
      {/* floating toggle */}
      <button onClick={() => setOpen(o => !o)} aria-label="Global chat" style={{
        position: 'fixed', right: 18, bottom: 18, zIndex: 300,
        width: 54, height: 54, borderRadius: '50%',
        background: 'var(--volt-grad)', border: 'none', cursor: 'pointer',
        boxShadow: '0 6px 24px rgba(255, 212, 0, 0.35)',
        display: 'grid', placeItems: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14120A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unseen > 0 && !open && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20,
            padding: '0 5px', borderRadius: 10, background: 'var(--violet, #9D7BFF)',
            color: '#fff', fontSize: '0.62rem', fontWeight: 800,
            display: 'grid', placeItems: 'center', border: '2px solid var(--bg)',
          }}>{unseen}</span>
        )}
      </button>

      {/* drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 290,
        width: 'min(92vw, 380px)',
        background: 'var(--panel, #101016)',
        borderLeft: '1px solid var(--line)',
        transform: open ? 'translateX(0)' : 'translateX(102%)',
        transition: 'transform 0.32s var(--ease, ease)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px', borderBottom: '1px solid var(--line)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--volt)', boxShadow: '0 0 10px var(--volt)' }} />
          <div className="display" style={{ fontSize: '0.95rem', letterSpacing: '0.06em', flex: 1 }}>GLOBAL CHAT</div>
          <button onClick={() => setOpen(false)} style={{
            width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--line)',
            background: 'transparent', color: 'var(--text)', cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* messages */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--faint)', fontSize: '0.8rem', textAlign: 'center', marginTop: 30 }}>
              Quiet in here. Say something first.
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {m.avatar ? (
                <img src={m.avatar} alt="" referrerPolicy="no-referrer"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--line)' }} />
              ) : (
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--volt-grad)',
                  color: '#14120A', fontWeight: 800, fontSize: '0.66rem', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{(m.display_name || '?')[0]}</span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--volt)', letterSpacing: '0.04em' }}>
                    {m.display_name}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--faint)' }}>{timeShort(m.created_at)}</span>
                </div>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.45, wordBreak: 'break-word' }}>{m.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* composer */}
        <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px' }}>
          {error && (
            <div style={{ fontSize: '0.7rem', color: '#FF7A7A', marginBottom: 8 }}>{error}</div>
          )}
          {user ? (
            <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                maxLength={500}
                placeholder="Message the world…"
                style={{
                  flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 'var(--r-sm, 10px)',
                  border: '1px solid var(--line)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button type="submit" disabled={sending || !draft.trim()} className="btn btn--volt"
                style={{ opacity: sending || !draft.trim() ? 0.5 : 1 }}>
                Send
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--faint)' }}>Sign in to join the conversation</div>
              <div ref={el => el && renderGoogleButton(el)} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
