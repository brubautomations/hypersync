import { useAuth } from '../context/AuthContext'

// Members-only gate: signed-out visitors hit this instead of the page.
export default function SignInWall({ label, children }) {
  const { user, loading, renderGoogleButton } = useAuth()
  if (loading) return <div className="wrap section"><div className="card" style={{ height: 200, opacity: 0.3 }} /></div>
  if (user) return children
  return (
    <div className="wrap section" style={{ display: 'grid', placeItems: 'center', minHeight: '55vh' }}>
      <div className="card" style={{ padding: '36px 30px', maxWidth: 460, textAlign: 'center' }}>
        <div className="display" style={{ fontSize: '1.5rem', marginBottom: 10 }}>MEMBERS ONLY</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--dim)', marginBottom: 20 }}>
          {label} is for signed-in fans. It takes ten seconds and it's free.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div ref={el => el && renderGoogleButton(el)} />
        </div>
      </div>
    </div>
  )
}
