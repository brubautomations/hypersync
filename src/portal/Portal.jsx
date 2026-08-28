import { useState, useEffect, useCallback } from 'react'

/* ============================================================
   HYPERSYNC ARTIST PORTAL — Slice 1
   The cockpit: login/activate door → sidebar shell → Profile.
   Rooms beyond Slice 1 show as locked seats (Posts, Market,
   Messages, Earnings) or COMING SOON (Live).
   Mount at /portal — self-contained, no other imports needed.
   ============================================================ */

const KEY = 'hs_portal_session'
const getToken = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
const setToken = t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch {} }

async function api(action, payload = {}) {
  const res = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

/* ---------- shared bits ---------- */
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--card)',
  color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
}
const labelStyle = {
  fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.14em',
  color: 'var(--faint)', textTransform: 'uppercase', display: 'block', marginBottom: 6,
}
function Msg({ error, ok }) {
  if (!error && !ok) return null
  return (
    <div style={{
      fontSize: '0.76rem', padding: '10px 14px', borderRadius: 8, marginBottom: 12,
      color: error ? '#FF9A9A' : 'var(--volt)',
      background: error ? 'rgba(255,0,0,0.06)' : 'rgba(255,212,0,0.06)',
      border: `1px solid ${error ? 'rgba(255,80,80,0.25)' : 'rgba(255,212,0,0.25)'}`,
    }}>{error || ok}</div>
  )
}

/* ---------- the door ---------- */
function Door({ onEnter }) {
  const [mode, setMode] = useState('login') // login | activate
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const d = mode === 'login'
        ? await api('login', { email, password })
        : await api('activate', { email, code, password })
      setToken(d.session)
      onEnter()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--bg, #0C0C11)' }}>
      <div style={{ width: 'min(94vw, 420px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div className="display" style={{ fontSize: '1.7rem', letterSpacing: '0.04em' }}>
            ARTIST <span style={{ color: 'var(--volt)' }}>PORTAL</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--faint)', marginTop: 6 }}>
            HYPERSYNC · for artists and their teams
          </div>
        </div>

        <div className="card" style={{ padding: '26px 24px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {['login', 'activate'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                border: '1px solid var(--line)',
                background: mode === m ? 'var(--volt-grad, #FFD400)' : 'transparent',
                color: mode === m ? '#14120A' : 'var(--text)',
              }}>{m === 'login' ? 'Sign in' : 'First time'}</button>
            ))}
          </div>

          <Msg error={error} />
          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
            </div>
            {mode === 'activate' && (
              <div>
                <label style={labelStyle}>Invite code</label>
                <input style={inputStyle} value={code} onChange={e => setCode(e.target.value)} placeholder="from your HYPERSYNC contact" />
              </div>
            )}
            <div>
              <label style={labelStyle}>{mode === 'activate' ? 'Choose a password (8+ chars)' : 'Password'}</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'activate' ? 'new-password' : 'current-password'} />
            </div>
            <button type="submit" disabled={busy} className="btn btn--volt" style={{ width: '100%', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'One moment…' : mode === 'login' ? 'Enter the portal' : 'Activate account'}
            </button>
          </form>

          {mode === 'login' && (
            <div style={{ fontSize: '0.66rem', color: 'var(--faint)', marginTop: 14, textAlign: 'center' }}>
              Forgot your password? Contact your HYPERSYNC manager for a fresh invite code.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Profile room ---------- */
function ProfileRoom() {
  const [artist, setArtist] = useState(null)
  const [bio, setBio] = useState('')
  const [banner, setBanner] = useState('')
  const [avatar, setAvatar] = useState('')
  const [dmPrice, setDmPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  // password box
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwOk, setPwOk] = useState('')

  useEffect(() => {
    api('get_profile').then(d => {
      setArtist(d.artist)
      setBio(d.artist.bio || '')
      setBanner(d.artist.banner || '')
      setAvatar(d.artist.avatar || '')
      setDmPrice(d.artist.dm_price != null ? String(d.artist.dm_price) : '')
    }).catch(e => setError(e.message))
  }, [])

  const save = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setOk('')
    try {
      const fields = { bio, banner, avatar }
      if (dmPrice !== '') fields.dm_price = dmPrice
      await api('update_profile', { fields })
      setOk('Saved. The fan side updates within a minute.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const changePw = async e => {
    e.preventDefault()
    if (pwBusy) return
    setPwBusy(true); setPwError(''); setPwOk('')
    try {
      await api('change_password', { old_password: oldPw, new_password: newPw })
      setPwOk('Password changed.')
      setOldPw(''); setNewPw('')
    } catch (err) { setPwError(err.message) } finally { setPwBusy(false) }
  }

  if (!artist) return <div className="card" style={{ height: 160, opacity: 0.35 }} />

  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 640 }}>
      <div>
        <div className="display" style={{ fontSize: '1.3rem', marginBottom: 4 }}>{artist.name}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--faint)' }}>
          {artist.country || ''}{artist.agency ? ` · ${artist.agency}` : ''}
        </div>
      </div>

      <form onSubmit={save} className="card" style={{ padding: '22px 22px', display: 'grid', gap: 16 }}>
        <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em' }}>PROFILE</div>
        <Msg error={error} ok={ok} />
        <div>
          <label style={labelStyle}>Bio</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={bio} onChange={e => setBio(e.target.value)} maxLength={1000} />
        </div>
        <div>
          <label style={labelStyle}>Banner image URL</label>
          <input style={inputStyle} value={banner} onChange={e => setBanner(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label style={labelStyle}>Avatar image URL</label>
          <input style={inputStyle} value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label style={labelStyle}>DM price (credits per message)</label>
          <input style={inputStyle} type="number" min="0" value={dmPrice} onChange={e => setDmPrice(e.target.value)} />
        </div>
        <button className="btn btn--volt" disabled={busy} style={{ justifySelf: 'start', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form onSubmit={changePw} className="card" style={{ padding: '22px 22px', display: 'grid', gap: 16 }}>
        <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em' }}>PASSWORD</div>
        <Msg error={pwError} ok={pwOk} />
        <div>
          <label style={labelStyle}>Current password</label>
          <input style={inputStyle} type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label style={labelStyle}>New password (8+ chars)</label>
          <input style={inputStyle} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="btn btn--volt" disabled={pwBusy} style={{ justifySelf: 'start', opacity: pwBusy ? 0.6 : 1 }}>
          {pwBusy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </div>
  )
}

/* ---------- locked / coming soon rooms ---------- */
function LockedRoom({ name, note }) {
  return (
    <div className="card" style={{ padding: '48px 30px', textAlign: 'center', maxWidth: 640 }}>
      <div className="display" style={{ fontSize: '1.2rem', marginBottom: 8, opacity: 0.85 }}>{name}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--faint)' }}>{note}</div>
    </div>
  )
}
function LiveRoom() {
  return (
    <div className="card" style={{
      padding: '56px 30px', textAlign: 'center', maxWidth: 640,
      border: '1px solid rgba(255,212,0,0.3)',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14,
        padding: '6px 14px', borderRadius: 999, background: 'rgba(255,0,60,0.12)',
        border: '1px solid rgba(255,0,60,0.35)',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF3B5C' }} />
        <span style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.2em', color: '#FF6B85' }}>LIVE</span>
      </div>
      <div className="display" style={{ fontSize: '1.5rem', marginBottom: 10 }}>GO LIVE TO YOUR FANS</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--dim)', maxWidth: 400, margin: '0 auto' }}>
        Native livestreaming — straight from this portal to every fan on your page. Coming soon.
      </div>
    </div>
  )
}

/* ---------- the shell ---------- */
const ROOMS = [
  { key: 'posts', label: 'Posts' },
  { key: 'live', label: 'Live' },
  { key: 'market', label: 'Market' },
  { key: 'messages', label: 'Messages' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'profile', label: 'Profile' },
]

export default function Portal() {
  const [authed, setAuthed] = useState(null) // null = checking
  const [room, setRoom] = useState('profile')

  const check = useCallback(() => {
    if (!getToken()) { setAuthed(false); return }
    api('me').then(() => setAuthed(true)).catch(() => { setToken(''); setAuthed(false) })
  }, [])
  useEffect(check, [check])

  if (authed === null) return <div style={{ minHeight: '100vh', background: 'var(--bg, #0C0C11)' }} />
  if (!authed) return <Door onEnter={() => setAuthed(true)} />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg, #0C0C11)' }}>
      {/* sidebar */}
      <aside style={{
        width: 200, flexShrink: 0, borderRight: '1px solid var(--line)',
        padding: '26px 14px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div className="display" style={{ fontSize: '0.85rem', letterSpacing: '0.06em', padding: '0 10px', marginBottom: 18 }}>
          HYPER<span style={{ color: 'var(--volt)' }}>SYNC</span>
          <div style={{ fontSize: '0.54rem', color: 'var(--faint)', letterSpacing: '0.24em', marginTop: 3 }}>ARTIST PORTAL</div>
        </div>
        {ROOMS.map(r => (
          <button key={r.key} onClick={() => setRoom(r.key)} style={{
            textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700,
            border: 'none',
            background: room === r.key ? 'rgba(255,212,0,0.1)' : 'transparent',
            color: room === r.key ? 'var(--volt)' : 'var(--dim)',
          }}>
            {r.label}
            {r.key === 'live' && (
              <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.1em', color: '#FF6B85', marginLeft: 8 }}>SOON</span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => { setToken(''); setAuthed(false) }} style={{
          textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700,
          border: '1px solid var(--line)', background: 'transparent', color: 'var(--faint)',
        }}>Sign out</button>
      </aside>

      {/* room */}
      <main style={{ flex: 1, padding: 'clamp(20px, 4vw, 44px)', overflowX: 'hidden' }}>
        {room === 'profile' && <ProfileRoom />}
        {room === 'live' && <LiveRoom />}
        {room === 'posts' && <LockedRoom name="POSTS" note="Slice 2 — your composer is on the way." />}
        {room === 'market' && <LockedRoom name="MARKET" note="Slice 4 — sell to your fans, coming up." />}
        {room === 'messages' && <LockedRoom name="MESSAGES" note="Slice 3 — your paid DM inbox arrives next." />}
        {room === 'earnings' && <LockedRoom name="EARNINGS" note="Slice 3 — your money story, one screen." />}
      </main>
    </div>
  )
}
