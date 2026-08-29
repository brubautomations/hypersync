import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../lib/api'

/* ============================================================
   MESSAGES — the fan's inbox.
   Every paid DM they've sent + the artist's reply when it lands.
   This is the missing half of the DM economy: proof to the fan
   that the credits bought a real channel.
   ============================================================ */

export default function Messages() {
  const [msgs, setMsgs] = useState(null)

  useEffect(() => {
    fetch('/api/dm', { headers: { Authorization: `Bearer ${getSession()}` } })
      .then(r => r.json())
      .then(d => setMsgs(Array.isArray(d.messages) ? d.messages : []))
      .catch(() => setMsgs([]))
  }, [])

  const when = iso => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return '' } }

  return (
    <div className="wrap section" style={{ maxWidth: 760 }}>
      <h1 className="display" style={{ fontSize: 'clamp(2.2rem, 7vw, 4rem)', marginBottom: 6 }}>MESSAGES</h1>
      <p style={{ fontSize: '0.78rem', color: 'var(--faint)', marginBottom: 24 }}>
        
      </p>

      {msgs === null ? (
        <div className="card" style={{ height: 140, opacity: 0.35 }} />
      ) : msgs.length === 0 ? (
        <div className="card" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <div className="display" style={{ fontSize: '1.2rem', marginBottom: 8 }}>NO MESSAGES YET</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--faint)', marginBottom: 18 }}>
            Find an artist and say something worth their reply.
          </div>
          <Link to="/artists" className="btn btn--volt">Browse artists</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {msgs.map(m => (
            <div key={m.id} className="card" style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                {m.artist_id ? (
                  <Link to={`/artists/${m.artist_id}`} style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--volt)' }}>
                    {m.artist}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--volt)' }}>{m.artist}</span>
                )}
                <span style={{ fontSize: '0.6rem', color: 'var(--faint)' }}>
                  {when(m.created_at)} · {m.credits} cr
                </span>
              </div>

              <div style={{
                fontSize: '0.84rem', lineHeight: 1.55,
                padding: '10px 14px', background: 'var(--panel)', borderRadius: 10,
              }}>{m.message}</div>

              {m.reply ? (
                <div style={{
                  borderLeft: '3px solid var(--volt)', padding: '8px 14px',
                  fontSize: '0.84rem', lineHeight: 1.55,
                }}>
                  {m.reply}
                  <div style={{ fontSize: '0.58rem', color: 'var(--faint)', marginTop: 6 }}>
                    {m.artist} · {when(m.replied_at)}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.64rem', color: 'var(--faint)' }}>
                  Waiting for a reply…
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
