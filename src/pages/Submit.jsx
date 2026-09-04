import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

/* ============================================================
   SUBMIT: music submissions for HYPERSYNC RADIO.
   Route: /submit
   ============================================================ */

const SUBMITTING_AS = [
  "I am the artist and I own this recording",
  "I am a member of the band and we own this recording",
  "I manage or represent the artist and I am authorised to submit this",
  "I work for the label that owns this recording",
]

const MAX_MB = 25

const inputStyle = {
  width: '100%', padding: '13px 15px', borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--panel)',
  color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 8, display: 'block',
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Check({ checked, onChange, children }) {
  return (
    <label style={{
      display: 'grid', gridTemplateColumns: '20px 1fr', gap: 12,
      alignItems: 'start', cursor: 'pointer', fontSize: '0.85rem',
      color: 'var(--dim)', lineHeight: 1.65,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--volt)', cursor: 'pointer' }}
      />
      <span>{children}</span>
    </label>
  )
}

async function uploadToR2(file) {
  const presign = await fetch('/api/submit-presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  })

  const slot = await presign.json()
  if (!presign.ok) throw new Error(slot.error || 'Upload could not start.')

  const put = await fetch(slot.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': slot.contentType },
    body: file,
  })

  if (!put.ok) throw new Error('The file failed to upload. Please try again.')
  return slot.publicUrl
}

export default function Submit() {
  const [terms, setTerms] = useState(null)
  const [form, setForm] = useState({
    name: '', email: '', submittingAs: SUBMITTING_AS[0],
    artist: '', title: '', links: '', country: '', pro: '',
  })
  const [audio, setAudio] = useState(null)
  const [cover, setCover] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [authority, setAuthority] = useState(false)
  const [cleared, setCleared] = useState(false)

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/terms')
      .then(r => r.json())
      .then(d => setTerms(d.text || ''))
      .catch(() => setTerms(''))
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const ready =
    form.name && form.email && form.artist && form.title &&
    audio && agreed && authority && cleared && !busy

  async function submit() {
    setError('')

    if (!audio) return setError('Please attach your track as an MP3.')
    if (audio.type !== 'audio/mpeg') return setError('The track must be an MP3 file.')
    if (audio.size > MAX_MB * 1048576) return setError(`The track must be under ${MAX_MB}MB.`)
    if (cover && cover.type !== 'image/png') return setError('Cover art must be a PNG file.')

    try {
      setBusy('Uploading your track')
      const audioUrl = await uploadToR2(audio)

      let coverUrl = ''
      if (cover) {
        setBusy('Uploading your cover art')
        coverUrl = await uploadToR2(cover)
      }

      setBusy('Saving your submission')
      const res = await fetch('/api/submit-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, audioUrl, coverUrl, agreed: true }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')

      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  if (done) {
    return (
      <div className="wrap section" style={{ maxWidth: 640 }}>
        <div className="card" style={{
          padding: 'clamp(34px, 6vw, 64px)', textAlign: 'center',
          border: '1px solid rgba(255,212,0,0.28)',
        }}>
          <h1 className="display" style={{ fontSize: 'clamp(1.7rem, 5vw, 2.6rem)', lineHeight: 1.08, marginBottom: 18 }}>
            SUBMISSION <span className="volt-text">RECEIVED</span>
          </h1>
          <p style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: 28 }}>
            Check your email. We've sent you a link to confirm the submission. Your track goes into review once you've clicked it.
          </p>
          <Link to="/radio" className="btn btn--volt" style={{ padding: '13px 26px' }}>
            Listen to HYPERSYNC Radio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <section className="wrap" style={{ padding: 'clamp(34px, 7vw, 80px) 0 clamp(28px, 5vw, 50px)' }}>
        <div style={{
          fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--volt)', marginBottom: 18,
        }}>
          For artists, bands, managers and labels
        </div>

        <h1 className="display" style={{ fontSize: 'clamp(2rem, 6.5vw, 4.2rem)', lineHeight: 1.03, maxWidth: 900 }}>
          GET YOUR MUSIC ON <span className="volt-text">HYPERSYNC RADIO</span>
        </h1>

        <div style={{
          color: 'var(--dim)', fontSize: 'clamp(0.95rem, 2vw, 1.06rem)',
          lineHeight: 1.8, maxWidth: 700, marginTop: 26, display: 'grid', gap: 18,
        }}>
          <p>
            HYPERSYNC Radio is a 24/7 internet radio station with scheduled shows, on-air
            presentation, and music curated for different parts of the day.
          </p>
          <p>
            If your track fits one of our shows, we'll put it into rotation as part of the{' '}
            <span style={{
              color: '#ff3b30', fontWeight: 800, letterSpacing: '0.04em',
              animation: 'hsLiveBlink 1.4s ease-in-out infinite',
            }}>LIVE</span> broadcast.
          </p>
          <p>
            Independent artists are welcome to submit. Your music stays yours.
          </p>
        </div>
      </section>

      <hr style={{ height: 1, background: 'var(--line)', border: 0, margin: 0 }} />

      <section className="wrap section" style={{ maxWidth: 720 }}>
        <div style={{ display: 'grid', gap: 20 }}>

          <Field label="Your name">
            <input value={form.name} onChange={set('name')} style={inputStyle} placeholder="Full name" />
          </Field>

          <Field label="Your email">
            <input type="email" value={form.email} onChange={set('email')} style={inputStyle} placeholder="you@example.com" />
          </Field>

          <Field label="Submitting as">
            <select value={form.submittingAs} onChange={set('submittingAs')} style={inputStyle}>
              {SUBMITTING_AS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Artist or band name">
            <input value={form.artist} onChange={set('artist')} style={inputStyle} placeholder="As it should appear on air" />
          </Field>

          <Field label="Track title">
            <input value={form.title} onChange={set('title')} style={inputStyle} />
          </Field>

          <Field label="Country">
            <input value={form.country} onChange={set('country')} style={inputStyle} placeholder="Where the artist is based" />
          </Field>

          <Field label="Official links">
            <textarea
              value={form.links} onChange={set('links')} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder={"Spotify, YouTube, SoundCloud, Instagram\nOne per line"}
            />
          </Field>

          <Field label="Performing rights organisation">
            <input
              value={form.pro} onChange={set('pro')} style={inputStyle}
              placeholder="FILSCAP, KOMCA, JASRAC, ASCAP, BMI... or leave blank if none"
            />
          </Field>

          <Field label="Your track (MP3, max 25MB)">
            <input
              type="file" accept="audio/mpeg,.mp3"
              onChange={(e) => setAudio(e.target.files[0] || null)}
              style={{ ...inputStyle, padding: '11px 15px' }}
            />
          </Field>

          <Field label="Cover art (PNG, optional)">
            <input
              type="file" accept="image/png,.png"
              onChange={(e) => setCover(e.target.files[0] || null)}
              style={{ ...inputStyle, padding: '11px 15px' }}
            />
          </Field>

          <div>
            <label style={labelStyle}>Submission terms</label>
            <div style={{
              border: '1px solid var(--line)', borderRadius: 10, background: 'var(--panel)',
              padding: '18px 20px', maxHeight: 300, overflowY: 'auto',
              fontSize: '0.82rem', lineHeight: 1.75, color: 'var(--dim)', whiteSpace: 'pre-wrap',
            }}>
              {terms === null ? 'Loading terms...' : (terms || 'Terms are unavailable right now. Please try again later.')}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, marginTop: 4 }}>
            <Check checked={agreed} onChange={setAgreed}>
              I have read and agree to the HYPERSYNC Radio Submission Terms.
            </Check>
            <Check checked={authority} onChange={setAuthority}>
              I confirm that I have authority to grant HYPERSYNC the rights described above.
            </Check>
            <Check checked={cleared} onChange={setCleared}>
              I confirm that the recording and related materials I submitted are authorised and do not contain material I am not permitted to license.
            </Check>
          </div>

          {error ? (
            <div style={{
              border: '1px solid rgba(255,90,90,0.4)', borderRadius: 10,
              background: 'rgba(255,90,90,0.07)', padding: '14px 16px',
              fontSize: '0.85rem', color: '#ff9a9a', lineHeight: 1.6,
            }}>{error}</div>
          ) : null}

          <button
            onClick={submit}
            disabled={!ready}
            className="btn btn--volt"
            style={{
              width: '100%', padding: '15px', marginTop: 6,
              opacity: ready ? 1 : 0.4, cursor: ready ? 'pointer' : 'not-allowed',
            }}
          >
            {busy || 'Submit your track'}
          </button>

          <p style={{ fontSize: '0.78rem', color: 'var(--faint)', lineHeight: 1.7, textAlign: 'center' }}>
            Nothing goes on air until we've listened to it. You'll hear from us either way.
          </p>
        </div>
      </section>

      <section className="wrap section">
        <p style={{
          fontSize: '0.8rem', color: 'var(--faint)', letterSpacing: '0.06em', textAlign: 'center',
        }}>
          TUNE IN TO EVERYTHING
        </p>
      </section>

      <style>{`
        @keyframes hsLiveBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes hsLiveBlink { 0%, 100% { opacity: 1; } }
        }
      `}</style>
    </div>
  )
}
