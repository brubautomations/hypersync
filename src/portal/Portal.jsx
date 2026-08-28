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
const selectStyle = { colorScheme: 'dark', background: '#0D0D12', color: '#fff' }
const optStyle = { background: '#0D0D12', color: '#fff' }
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
      setBanner(d.artist.portal_banner || '')
      setAvatar(d.artist.portal_avatar || '')
      setDmPrice(d.artist.dm_price != null ? String(d.artist.dm_price) : '')
    }).catch(e => setError(e.message))
  }, [])

  const save = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setOk('')
    try {
      const fields = { bio, portal_banner: banner, portal_avatar: avatar }
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


/* ---------- Posts room ---------- */
function PostsRoom() {
  const [posts, setPosts] = useState(null)
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [exclusive, setExclusive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [urlBox, setUrlBox] = useState('')

  const load = useCallback(() => {
    api('posts_list').then(d => setPosts(d.posts)).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])

  const pickFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true); setError('')
    try {
      const res = await fetch('/api/portal-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ type: file.type }),
      })
      const grant = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(grant.error || 'Upload not available')
      const put = await fetch(grant.upload_url, { method: 'PUT', body: file })
      if (!put.ok) throw new Error('Upload failed — check bucket CORS')
      setImages(list => [...list, grant.public_url].slice(0, 6))
    } catch (err) {
      setError(err.message + ' — you can paste a media URL instead')
    } finally { setUploading(false) }
  }

  const addUrl = () => {
    const u = urlBox.trim()
    if (/^https?:\/\//.test(u)) { setImages(list => [...list, u].slice(0, 6)); setUrlBox('') }
  }

  const publish = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await api('post_create', { content: content.trim(), images, is_exclusive: exclusive })
      setContent(''); setImages([]); setExclusive(false)
      load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const remove = async id => {
    if (!confirm('Delete this post?')) return
    try { await api('post_delete', { id }); load() } catch (err) { setError(err.message) }
  }

  return (
    <div style={{ display: 'grid', gap: 22, maxWidth: 680 }}>
      <form onSubmit={publish} className="card" style={{ padding: '20px 22px', display: 'grid', gap: 12 }}>
        <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em' }}>NEW POST</div>
        <Msg error={error} />
        <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} maxLength={2000}
          placeholder="Tell your fans something…" value={content} onChange={e => setContent(e.target.value)} />
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((u, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {/\.(mp4|mov|webm)(\?|$)/i.test(u)
                  ? <video src={u} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10 }} />
                  : <img src={u} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10 }} />}
                <button type="button" onClick={() => setImages(l => l.filter((_, x) => x !== i))} style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                  border: 'none', background: '#FF3B5C', color: '#fff', fontSize: 11, cursor: 'pointer',
                }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="chip" style={{ cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : '+ Photo / video'}
            <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm"
              style={{ display: 'none' }} onChange={pickFile} disabled={uploading} />
          </label>
          <input style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: 140, padding: '8px 12px', fontSize: '0.76rem' }}
            placeholder="…or paste a media URL" value={urlBox} onChange={e => setUrlBox(e.target.value)} />
          <button type="button" className="chip" onClick={addUrl}>Add</button>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.74rem', color: 'var(--dim)', cursor: 'pointer' }}>
          <input type="checkbox" checked={exclusive} onChange={e => setExclusive(e.target.checked)} />
          Exclusive (members-only badge on the fan side)
        </label>
        <button className="btn btn--volt" disabled={busy || (!content.trim() && !images.length)}
          style={{ justifySelf: 'start', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>
      </form>

      <div style={{ display: 'grid', gap: 10 }}>
        <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em' }}>YOUR POSTS</div>
        {posts === null ? <div className="card" style={{ height: 90, opacity: 0.35 }} /> :
          posts.length === 0 ? (
            <div className="card" style={{ padding: '26px 20px', color: 'var(--faint)', fontSize: '0.8rem', textAlign: 'center' }}>
              Nothing yet. Your first post goes straight to your page and the fan feed.
            </div>
          ) : posts.map(p => (
            <div key={p.id} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {p.image_urls[0] && (
                /\.(mp4|mov|webm)(\?|$)/i.test(p.image_urls[0])
                  ? <video src={p.image_urls[0]} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  : <img src={p.image_urls[0]} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{p.content}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--faint)', marginTop: 6 }}>
                  {new Date(p.created_at).toLocaleString()} {p.is_exclusive ? '· Exclusive' : ''}
                </div>
              </div>
              <button onClick={() => remove(p.id)} className="chip" style={{ flexShrink: 0, color: '#FF9A9A' }}>Delete</button>
            </div>
          ))}
      </div>
    </div>
  )
}

/* ---------- Messages room ---------- */
function MessagesRoom() {
  const [msgs, setMsgs] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api('dms_list').then(d => setMsgs(d.messages)).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])

  const reply = async id => {
    const text = (drafts[id] || '').trim()
    if (!text || busyId) return
    setBusyId(id); setError('')
    try {
      await api('dm_reply', { id, reply: text })
      setDrafts(d => ({ ...d, [id]: '' }))
      load()
    } catch (err) { setError(err.message) } finally { setBusyId(null) }
  }

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 680 }}>
      <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em' }}>PAID MESSAGES</div>
      <Msg error={error} />
      {msgs === null ? <div className="card" style={{ height: 120, opacity: 0.35 }} /> :
        msgs.length === 0 ? (
          <div className="card" style={{ padding: '30px 20px', color: 'var(--faint)', fontSize: '0.8rem', textAlign: 'center' }}>
            No messages yet. Fans pay credits to reach you — set your price in Profile.
          </div>
        ) : msgs.map(m => (
          <div key={m.id} className="card" style={{ padding: '16px 18px', display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--volt)' }}>{m.fan}</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--faint)' }}>
                paid {m.credits} cr {m.created_at ? '· ' + new Date(m.created_at).toLocaleDateString() : ''}
              </span>
            </div>
            <div style={{ fontSize: '0.86rem', lineHeight: 1.55 }}>{m.message}</div>
            {m.reply ? (
              <div style={{
                borderLeft: '3px solid var(--volt)', paddingLeft: 12,
                fontSize: '0.82rem', color: 'var(--dim)', lineHeight: 1.5,
              }}>
                {m.reply}
                <div style={{ fontSize: '0.6rem', color: 'var(--faint)', marginTop: 4 }}>
                  Replied {m.replied_at ? new Date(m.replied_at).toLocaleDateString() : ''}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1, padding: '10px 12px' }} maxLength={1000}
                  placeholder="Write your reply…" value={drafts[m.id] || ''}
                  onChange={e => setDrafts(d => ({ ...d, [m.id]: e.target.value }))} />
                <button className="btn btn--volt" disabled={busyId === m.id || !(drafts[m.id] || '').trim()}
                  onClick={() => reply(m.id)} style={{ opacity: busyId === m.id ? 0.6 : 1 }}>
                  {busyId === m.id ? '…' : 'Reply'}
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

/* ---------- Earnings room ---------- */
function EarningsRoom() {
  const [data, setData] = useState(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Bank transfer')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const load = useCallback(() => {
    api('earnings').then(setData).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])

  const request = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setOk('')
    try {
      await api('payout_request', { amount, method, details })
      setOk('Payout requested — our finance desk will settle it and mark it paid.')
      setAmount(''); load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!data) return <div className="card" style={{ height: 160, opacity: 0.35, maxWidth: 680 }} />

  const stat = (label, value, hot) => (
    <div style={{ padding: '16px 14px', textAlign: 'center' }}>
      <div className="display" style={{ fontSize: '1.25rem', color: hot ? 'var(--volt)' : 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 680 }}>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1 }}>
        {stat('Gross earned', data.gross_credits + ' cr')}
        {stat('Your 90%', data.artist_share + ' cr')}
        {stat('Paid out', data.paid + ' cr')}
        {stat('Available', data.available + ' cr', true)}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--faint)' }}>
        From {data.dm_count} paid messages · credits convert to cash at payout · HYPERSYNC keeps 10%
      </div>

      <form onSubmit={request} className="card" style={{ padding: '20px 22px', display: 'grid', gap: 12 }}>
        <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em' }}>REQUEST PAYOUT</div>
        <Msg error={error} ok={ok} />
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={labelStyle}>Amount (credits)</label>
            <input style={inputStyle} type="number" min="1" max={data.available} value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Method</label>
            <select style={{ ...inputStyle, ...selectStyle }} value={method} onChange={e => setMethod(e.target.value)}>
              <option style={optStyle}>Bank transfer</option>
              <option style={optStyle}>Wise</option>
              <option style={optStyle}>PayPal</option>
              <option style={optStyle}>Payoneer</option>
              <option style={optStyle}>GCash (PH)</option>
              <option style={optStyle}>Maya (PH)</option>
              <option style={optStyle}>Other</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Payout details (account name · number / IBAN / email · bank & country)</label>
          <input style={inputStyle} value={details} onChange={e => setDetails(e.target.value)} maxLength={300}
            placeholder="e.g. HANA BANK KR · 123-456789 · HYBE Ent. Co." />
        </div>
        <button className="btn btn--volt" disabled={busy || !amount || data.available < 1}
          style={{ justifySelf: 'start', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Sending…' : 'Request payout'}
        </button>
      </form>

      {data.requests.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em' }}>HISTORY</div>
          {data.requests.map(r => (
            <div key={r.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.78rem' }}>
              <span style={{ fontWeight: 800 }}>{r.amount} cr</span>
              <span style={{ color: 'var(--faint)' }}>{r.method}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.62rem', textTransform: 'uppercase',
                color: r.status === 'paid' ? '#7CE38B' : 'var(--volt)' }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Market room ---------- */
function MarketRoom() {
  const [items, setItems] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} | item
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api('merch_list').then(d => setItems(d.items)).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])

  const save = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await api('merch_save', { item: editing })
      setEditing(null); load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const toggle = async (item, key) => {
    try { await api('merch_save', { item: { ...item, [key]: !item[key] } }); load() }
    catch (err) { setError(err.message) }
  }
  const set = (k, v) => setEditing(x => ({ ...x, [k]: v }))

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="display" style={{ fontSize: '0.9rem', letterSpacing: '0.08em', flex: 1 }}>YOUR MARKET</div>
        {!editing && <button className="btn btn--volt" onClick={() => setEditing({ currency: '$', active: true })}>Add item</button>}
      </div>
      <Msg error={error} />

      {editing && (
        <form onSubmit={save} className="card" style={{ padding: '20px 22px', display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Item name</label>
            <input style={inputStyle} value={editing.item_name || ''} onChange={e => set('item_name', e.target.value)} maxLength={120} />
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr' }}>
            <div>
              <label style={labelStyle}>Image URL</label>
              <input style={inputStyle} value={editing.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label style={labelStyle}>Price</label>
              <input style={inputStyle} type="number" min="0" value={editing.price ?? ''} onChange={e => set('price', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={{ ...inputStyle, ...selectStyle }} value={editing.currency || '$'}
                onChange={e => set('currency', e.target.value)}>
                <option style={optStyle} value="$">USD $</option>
                <option style={optStyle} value="₩">KRW ₩</option>
                <option style={optStyle} value="¥">JPY ¥</option>
                <option style={optStyle} value="฿">THB ฿</option>
                <option style={optStyle} value="₫">VND ₫</option>
                <option style={optStyle} value="Rp">IDR Rp</option>
                <option style={optStyle} value="S$">SGD S$</option>
                <option style={optStyle} value="RM">MYR RM</option>
                <option style={optStyle} value="€">EUR €</option>
                <option style={optStyle} value="₱">PHP ₱</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 2fr' }}>
            <div>
              <label style={labelStyle}>Category</label>
              <input style={inputStyle} value={editing.category || ''} onChange={e => set('category', e.target.value)} placeholder="Merch / Album / Digital" />
            </div>
            <div>
              <label style={labelStyle}>Buy link (your shop / order form)</label>
              <input style={inputStyle} value={editing.buy_url || ''} onChange={e => set('buy_url', e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.74rem', color: 'var(--dim)' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={editing.active !== false} onChange={e => set('active', e.target.checked)} /> Live on the shop
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!editing.featured} onChange={e => set('featured', e.target.checked)} /> Featured
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="chip" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn--volt" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Saving…' : 'Save item'}
            </button>
          </div>
        </form>
      )}

      {items === null ? <div className="card" style={{ height: 100, opacity: 0.35 }} /> :
        items.length === 0 && !editing ? (
          <div className="card" style={{ padding: '30px 20px', color: 'var(--faint)', fontSize: '0.8rem', textAlign: 'center' }}>
            Nothing listed. Add your first item and it appears on the fan shop.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items?.map(it => (
              <div key={it.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                {it.image_url && <img src={it.image_url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.84rem' }}>{it.item_name}</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--faint)' }}>
                    {it.currency}{it.price} {it.category ? '· ' + it.category : ''} {it.featured ? '· Featured' : ''}
                  </div>
                </div>
                <button className="chip" onClick={() => setEditing(it)}>Edit</button>
                <button className="chip" onClick={() => toggle(it, 'active')}
                  style={{ color: it.active ? '#7CE38B' : 'var(--faint)' }}>
                  {it.active ? 'Live' : 'Hidden'}
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

/* ---------- coming soon ---------- */
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
        {room === 'posts' && <PostsRoom />}
        {room === 'market' && <MarketRoom />}
        {room === 'messages' && <MessagesRoom />}
        {room === 'earnings' && <EarningsRoom />}
      </main>
    </div>
  )
}
