import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCredits } from '../context/CreditContext'
import { createPurchase, checkPurchase, sendDM } from '../lib/api'

// ── shell ────────────────────────────────────────────────────
export function Modal({ onClose, children, maxWidth = 440 }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(6,6,10,0.82)',
      backdropFilter: 'blur(10px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="card"
        style={{ padding: 'clamp(26px, 5vw, 40px)', maxWidth, width: '100%', borderRadius: 'var(--r-lg)' }}>
        {children}
      </div>
    </div>
  )
}

// ── sign in ──────────────────────────────────────────────────
export function SignInModal({ onClose, message = "Sign in to continue." }) {
  const { renderGoogleButton, ready } = useAuth()
  const slot = useRef(null)
  useEffect(() => { if (ready) renderGoogleButton(slot.current) }, [ready, renderGoogleButton])
  return (
    <Modal onClose={onClose} maxWidth={400}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <img src="/logo.png" alt="HYPERSYNC" style={{ height: 40 }} />
        <div style={{ textAlign: 'center' }}>
          <div className="display" style={{ fontSize: '1.5rem', marginBottom: 8 }}>Sign in</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--dim)' }}>{message}</p>
        </div>
        <div ref={slot} style={{ minHeight: 44 }} />
        <button className="btn btn--quiet" onClick={onClose}>Maybe later</button>
      </div>
    </Modal>
  )
}

// ── buy credits ──────────────────────────────────────────────
// Prices live in ONE place: credits.mjs. This screen just asks.
const PACK_TAGS = { fan: 'Most popular', superfan: 'Best value' }

export function BuyCreditsModal({ onClose }) {
  const { refresh } = useCredits()
  const [selected, setSelected] = useState('fan')
  const [PACKS, setPacks] = useState([])
  useEffect(() => {
    fetch('/api/credits?action=packs')
      .then(r => r.json())
      .then(d => setPacks(
        Object.entries(d.packs || {})
          .filter(([id]) => id !== 'test')
          .map(([id, p]) => ({ id, credits: p.credits, price: p.price, label: p.label[0] + p.label.slice(1).toLowerCase(), tag: PACK_TAGS[id] || '' }))
      ))
      .catch(() => {})
  }, [])
  const [phase, setPhase] = useState('pick') // pick | paying
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => () => clearInterval(pollRef.current), [])

  const buy = async () => {
    setBusy(true); setError('')
    try {
      const { checkout_url, link_id } = await createPurchase(selected)
      window.open(checkout_url, '_blank')
      setPhase('paying')
      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts++
        try {
          const { status } = await checkPurchase(link_id)
          if (status === 'paid') {
            clearInterval(pollRef.current)
            await refresh()
            onClose?.()
          }
        } catch {}
        if (attempts > 60) { clearInterval(pollRef.current); setPhase('pick') }
      }, 5000)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div className="display" style={{ fontSize: '1.7rem' }}>Buy credits</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--dim)', marginTop: 8 }}>
          Credits let you send messages straight to your artists.
        </p>
      </div>

      {phase === 'paying' ? (
        <div style={{ textAlign: 'center', padding: '18px 0' }}>
          <span className="chip chip--volt-line" style={{ cursor: 'default' }}>
            <span className="sync-dot" />Waiting for payment
          </span>
          <p style={{ fontSize: '0.8rem', color: 'var(--dim)', marginTop: 16, lineHeight: 1.6 }}>
            Finish checkout in the payment window.<br />This updates automatically once paid.
          </p>
          <button className="btn btn--quiet" style={{ marginTop: 18 }} onClick={onClose}>Close for now</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
            {PACKS.map(p => {
              const on = selected === p.id
              return (
                <button key={p.id} onClick={() => setSelected(p.id)} className="card" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
                  borderColor: on ? 'rgba(255,212,0,0.6)' : 'var(--line)',
                  boxShadow: on ? 'var(--glow)' : 'none',
                  background: on ? 'rgba(255,212,0,0.05)' : 'var(--panel)',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: on ? 'var(--volt)' : 'var(--text)' }}>{p.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--dim)' }}>{p.tag}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="display" style={{ fontSize: '1.2rem', color: on ? 'var(--volt)' : 'var(--text)' }}>
                      {p.credits} <span style={{ fontSize: '0.7rem' }}>credits</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dim)' }}>₱{p.price}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', textAlign: 'center', marginBottom: 14 }}>{error}</p>}

          <button className="btn btn--volt" style={{ width: '100%' }} disabled={busy} onClick={buy}>
            {busy ? 'Preparing…' : `Buy ${PACKS.find(p => p.id === selected)?.credits} credits — ₱${PACKS.find(p => p.id === selected)?.price}`}
          </button>
          <button className="btn btn--quiet" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Cancel</button>
        </>
      )}
    </Modal>
  )
}

// ── DM composer ──────────────────────────────────────────────
export function DMModal({ artist, onClose }) {
  const { isSignedIn } = useAuth()
  const { credits, setFromServer } = useCredits()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [showBuy, setShowBuy] = useState(false)

  const price = artist.dm_price || 1
  const enough = credits >= price
  const left = 500 - message.length

  if (!isSignedIn) return <SignInModal onClose={onClose} message={`Sign in to message ${artist.name}.`} />
  if (showBuy) return <BuyCreditsModal onClose={() => setShowBuy(false)} />

  const send = async () => {
    if (!message.trim()) return
    setBusy(true); setError('')
    try {
      const res = await sendDM(artist.id, message.trim())
      setFromServer(res.credits)
      setSent(true)
    } catch (e) {
      if (e.status === 402) { setShowBuy(true) } else { setError(e.message) }
    } finally {
      setBusy(false)
    }
  }

  if (sent) return (
    <Modal onClose={onClose} maxWidth={380}>
      <div style={{ textAlign: 'center', display: 'grid', gap: 14, justifyItems: 'center' }}>
        <span className="chip chip--on" style={{ cursor: 'default' }}>Sent ✓</span>
        <div className="display" style={{ fontSize: '1.5rem' }}>On its way</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--dim)' }}>
          Your message to <strong style={{ color: 'var(--text)' }}>{artist.name}</strong> is delivered.
          You have <span style={{ color: 'var(--volt)', fontWeight: 800 }}>{credits}</span> credits left.
        </p>
        <button className="btn btn--volt" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow eyebrow--volt" style={{ marginBottom: 6 }}>Direct message</div>
        <div className="display" style={{ fontSize: '1.5rem' }}>To {artist.name}</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--dim)', marginTop: 6 }}>
          Costs <span style={{ color: 'var(--volt)', fontWeight: 800 }}>{price} credit{price !== 1 ? 's' : ''}</span> ·
          you have <span style={{ color: enough ? 'var(--volt)' : 'var(--danger)', fontWeight: 800 }}> {credits}</span>
        </p>
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value.slice(0, 500))}
        placeholder={`Write your message to ${artist.name}…`}
        rows={6}
        style={{
          width: '100%', background: 'var(--ink)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)', color: 'var(--text)', padding: '14px 16px',
          fontSize: '0.9rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
          lineHeight: 1.6, boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--volt)'}
        onBlur={e => e.target.style.borderColor = 'var(--line)'}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 2px 16px' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--faint)' }}>Be kind — a person reads this.</span>
        <span style={{ fontSize: '0.68rem', color: left < 50 ? 'var(--danger)' : 'var(--faint)' }}>{left}</span>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', marginBottom: 12 }}>{error}</p>}

      {!enough && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 14, borderColor: 'rgba(255,212,0,0.35)' }}>
          <p style={{ fontSize: '0.76rem', color: 'var(--dim)', marginBottom: 10 }}>
            You need {price - credits} more credit{price - credits !== 1 ? 's' : ''} to send this.
          </p>
          <button className="btn btn--volt" style={{ padding: '9px 18px', fontSize: '0.78rem' }}
            onClick={() => setShowBuy(true)}>Get credits</button>
        </div>
      )}

      <button className="btn btn--volt" style={{ width: '100%' }}
        disabled={busy || !message.trim() || !enough} onClick={send}>
        {busy ? 'Sending…' : `Send — ${price} credit${price !== 1 ? 's' : ''}`}
      </button>
      <button className="btn btn--quiet" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Cancel</button>
    </Modal>
  )
}
