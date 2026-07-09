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
      console.error('chat send:', err)
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (!chatEnabled) return null

  return (
    <>
      {/* edge tab — KOTH style */}
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Global chat" style={{
          position: 'fixed', right: 0, top: '42%', zIndex: 300,
          writingMode: 'vertical-rl', textOrientation: 'mixed',
          padding: '16px 9px', borderRadius: '10px 0 0 10px',
          background: '#0D0D12', border: '1px solid var(--line)', borderRight: 'none',
          color: 'var(--volt)', fontWeight: 800, fontSize: '0.64rem',
          letterSpacing: '0.28em', fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: '-6px 0 20px rgba(0,0,0,0.45)',
        }}>
          GLOBAL CHAT
          {unseen > 0 && (
            <span style={{
              writingMode: 'horizontal-tb',
              position: 'absolute', top: -8, left: -8, minWidth: 20, height: 20,
              padding: '0 5px', borderRadius: 10, background: 'var(--volt-grad)',
              color: '#14120A', fontSize: '0.62rem', fontWeight: 800,
              display: 'grid', placeItems: 'center', border: '2px solid var(--bg)',
            }}>{unseen}</span>
          )}
        </button>
      )}

      {/* backdrop */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 280,
          background: 'rgba(5,5,8,0.55)', backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 290,
        width: 'min(92vw, 380px)',
        background: '#0D0D12',
        boxShadow: open ? '-18px 0 50px rgba(0,0,0,0.55)' : 'none',
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
          <div style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.3em', color: 'var(--text)', flex: 1 }}>GLOBAL CHAT</div>
          <button onClick={() => setOpen(false)} style={{
            width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--line)',
            background: 'transparent', color: 'var(--text)', cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* messages — dense rows, KOTH energy */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--faint)', fontSize: '0.78rem', textAlign: 'center', marginTop: 36 }}>
              Quiet in here. Say something first.
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                <span style={{
                  fontSize: '0.66rem', fontWeight: 800, color: 'var(--volt)',
                  letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', maxWidth: '65%',
                }}>{m.display_name}</span>
                <span style={{
                  fontSize: '0.58rem', color: 'var(--faint)', marginLeft: 'auto',
                  fontFamily: 'ui-monospace, monospace', flexShrink: 0,
                }}>{timeShort(m.created_at)}</span>
              </div>
              <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text)', wordBreak: 'break-word' }}>
                {m.body}
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
