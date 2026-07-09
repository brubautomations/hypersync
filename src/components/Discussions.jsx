import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSession } from '../lib/api'

function ago(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getSession()}`,
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

// ── one open thread: original post + replies + reply box ──
function ThreadView({ threadId, onBack }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api(`/api/threads?thread=${threadId}`)
      .then(d => setData({ thread: d.thread, replies: Array.isArray(d.replies) ? d.replies : [] }))
      .catch(() => {})
  }, [threadId])
  useEffect(load, [load])

  const reply = async e => {
    e.preventDefault()
    if (busy || !draft.trim()) return
    setBusy(true); setError('')
    try {
      await api('/api/threads', { method: 'POST', body: JSON.stringify({ thread: threadId, body: draft.trim() }) })
      setDraft(''); load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!data) return <div className="card" style={{ height: 120, opacity: 0.4 }} />
  const t = data.thread

  return (
    <div>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: 'var(--volt)', fontWeight: 800,
        cursor: 'pointer', fontSize: '0.74rem', padding: 0, fontFamily: 'inherit', marginBottom: 14,
      }}>← All discussions</button>

      <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--volt)', letterSpacing: '0.05em' }}>{t.handle}</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--faint)' }}>{ago(t.created_at)}</span>
        </div>
        <h3 style={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.35, marginBottom: t.body ? 8 : 0 }}>{t.title}</h3>
        {t.body && <p style={{ fontSize: '0.86rem', lineHeight: 1.6, color: 'var(--dim)', whiteSpace: 'pre-line' }}>{t.body}</p>}
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {data.replies.map(r => (
          <div key={r.id} style={{
            padding: '12px 16px', background: 'var(--card)',
            border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--volt)', letterSpacing: '0.05em' }}>{r.handle}</span>
              <span style={{ fontSize: '0.58rem', color: 'var(--faint)' }}>{ago(r.created_at)}</span>
            </div>
            <div style={{ fontSize: '0.84rem', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{r.body}</div>
          </div>
        ))}
        {!data.replies.length && (
          <div style={{ color: 'var(--faint)', fontSize: '0.78rem', padding: '8px 4px' }}>
            No replies yet. Take the first swing.
          </div>
        )}
      </div>

      {error && <div style={{ fontSize: '0.72rem', color: '#FF7A7A', marginBottom: 8 }}>{error}</div>}
      {user ? (
        <form onSubmit={reply} style={{ display: 'flex', gap: 8 }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} maxLength={1000}
            placeholder="Add your take…" style={{
              flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)', background: 'var(--card)',
              color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
            }} />
          <button type="submit" disabled={busy || !draft.trim()} className="btn btn--volt"
            style={{ opacity: busy || !draft.trim() ? 0.5 : 1 }}>Reply</button>
        </form>
      ) : (
        <div style={{ fontSize: '0.74rem', color: 'var(--faint)' }}>Sign in to join the discussion.</div>
      )}
    </div>
  )
}

// ── the artist-page section ──
export default function Discussions({ artist }) {
  const { user } = useAuth()
  const [threads, setThreads] = useState(null)
  const [openThread, setOpenThread] = useState(null)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api(`/api/threads?artist=${artist.id}`).then(d => setThreads(Array.isArray(d.threads) ? d.threads : [])).catch(() => setThreads([]))
  }, [artist.id])
  useEffect(load, [load])

  const create = async e => {
    e.preventDefault()
    if (busy || !title.trim()) return
    setBusy(true); setError('')
    try {
      const d = await api('/api/threads', {
        method: 'POST',
        body: JSON.stringify({ artist: artist.id, artistName: artist.name, title: title.trim(), body: body.trim() }),
      })
      setTitle(''); setBody(''); setComposing(false)
      load()
      if (d.id) setOpenThread(d.id)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <section className="reveal" style={{ marginTop: 'clamp(40px, 6vw, 64px)' }}>
      <div className="section-head" style={{ marginBottom: 18 }}>
        <h2 className="display" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)' }}>
          DISCUSSIONS
        </h2>
        {!openThread && user && !composing && (
          <button className="btn btn--volt" onClick={() => setComposing(true)}>Start a thread</button>
        )}
      </div>

      {openThread ? (
        <ThreadView threadId={openThread} onBack={() => { setOpenThread(null); load() }} />
      ) : (
        <>
          {composing && (
            <form onSubmit={create} className="card" style={{ padding: '16px 18px', marginBottom: 16, display: 'grid', gap: 10 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} autoFocus
                placeholder={`Hot take about ${artist.name}…`} style={{
                  padding: '11px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
                  background: 'var(--panel)', color: 'var(--text)', fontSize: '0.9rem',
                  fontWeight: 700, fontFamily: 'inherit', outline: 'none',
                }} />
              <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000} rows={3}
                placeholder="Make your case (optional)" style={{
                  padding: '11px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
                  background: 'var(--panel)', color: 'var(--text)', fontSize: '0.84rem',
                  fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                }} />
              {error && <div style={{ fontSize: '0.72rem', color: '#FF7A7A' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="chip" onClick={() => setComposing(false)}>Cancel</button>
                <button type="submit" disabled={busy || !title.trim()} className="btn btn--volt"
                  style={{ opacity: busy || !title.trim() ? 0.5 : 1 }}>Post thread</button>
              </div>
            </form>
          )}

          {threads === null ? (
            <div className="card" style={{ height: 90, opacity: 0.4 }} />
          ) : threads.length === 0 ? (
            <div className="card" style={{ padding: '26px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: '0.82rem' }}>
              No discussions yet. {user ? 'Start the first one.' : 'Sign in and start the first one.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {threads.map(t => (
                <button key={t.id} onClick={() => setOpenThread(t.id)} className="card card--lift" style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                  textAlign: 'left', cursor: 'pointer', width: '100%',
                  background: 'var(--card)', border: '1px solid var(--line)',
                  color: 'var(--text)', fontFamily: 'inherit',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.35, marginBottom: 4 }}>{t.title}</div>
                    <div style={{ fontSize: '0.64rem', color: 'var(--faint)' }}>
                      <span style={{ color: 'var(--volt)', fontWeight: 800 }}>{t.handle}</span> · {ago(t.created_at)}
                    </div>
                  </div>
                  <span className="chip" style={{ cursor: 'pointer', flexShrink: 0, fontSize: '0.6rem' }}>
                    {t.reply_count || 0} {(t.reply_count || 0) === 1 ? 'reply' : 'replies'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
