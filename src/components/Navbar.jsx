import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCredits } from '../context/CreditContext'

const LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Artists', path: '/artists' },
  { label: 'Feed', path: '/feed' },
  { label: 'Schedule', path: '/schedule' },
  { label: 'Shop', path: '/shop' },
]

function SignInModal({ onClose }) {
  const { renderGoogleButton, ready } = useAuth()
  const slot = useRef(null)
  useEffect(() => { if (ready) renderGoogleButton(slot.current) }, [ready, renderGoogleButton])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(6,6,10,0.82)',
      backdropFilter: 'blur(10px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        padding: '44px 36px', maxWidth: 400, width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        borderRadius: 'var(--r-lg)',
      }}>
        <img src="/logo.png" alt="HYPERSYNC" style={{ height: 44 }} />
        <div style={{ textAlign: 'center' }}>
          <div className="display" style={{ fontSize: '1.5rem', marginBottom: 8 }}>
            Get in <span className="volt-text">sync</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--dim)' }}>
            One account. Your artists' whole universe.
          </p>
        </div>
        <div ref={slot} style={{ minHeight: 44 }} />
        <button className="btn btn--quiet" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const { user, isSignedIn, signOut } = useAuth()
  const { credits } = useCredits()
  const [showSignIn, setShowSignIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)

  useEffect(() => { setMenuOpen(false); setUserMenu(false) }, [location.pathname])

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(12,12,17,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div className="wrap" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 68, gap: 16,
        }}>
          <Link to="/" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="HYPERSYNC" style={{ height: 34 }} />
          </Link>

          {/* desktop links */}
          <div className="nav-links" style={{ display: 'flex', gap: 4 }}>
            {LINKS.map(l => {
              const active = location.pathname === l.path
              return (
                <Link key={l.path} to={l.path} className={active ? 'chip chip--on' : 'chip'}
                  style={{ border: active ? 'none' : '1px solid transparent' }}>
                  {l.label}
                </Link>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {isSignedIn && (
              <button className="chip chip--volt-line" title="Your credits">
                <span className="sync-dot" />
                {credits}
              </button>
            )}

            {isSignedIn ? (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setUserMenu(m => !m)} style={{
                  background: 'none', border: '1px solid var(--line)', borderRadius: 999,
                  padding: 3, cursor: 'pointer', display: 'flex',
                }}>
                  {user.avatar
                    ? <img src={user.avatar} alt={user.name} referrerPolicy="no-referrer"
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: 'var(--volt-grad)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, color: '#14120A', fontSize: '0.85rem',
                      }}>{(user.name || '?')[0].toUpperCase()}</div>}
                </button>
                {userMenu && (
                  <div className="card" style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 10px)', minWidth: 220,
                    padding: 8, zIndex: 200,
                  }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{user.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                    </div>
                    <button className="btn btn--quiet" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)' }}
                      onClick={signOut}>Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn btn--volt" style={{ padding: '10px 22px' }}
                onClick={() => setShowSignIn(true)}>Sign in</button>
            )}

            {/* mobile burger */}
            <button className="nav-burger" aria-label="Menu" onClick={() => setMenuOpen(m => !m)} style={{
              display: 'none', background: 'none', border: '1px solid var(--line)',
              borderRadius: 10, padding: '9px 11px', cursor: 'pointer',
              flexDirection: 'column', gap: 4,
            }}>
              <span style={{ width: 16, height: 2, background: menuOpen ? 'var(--volt)' : 'var(--text)', display: 'block', borderRadius: 2 }} />
              <span style={{ width: 16, height: 2, background: menuOpen ? 'var(--volt)' : 'var(--text)', display: 'block', borderRadius: 2 }} />
              <span style={{ width: 16, height: 2, background: menuOpen ? 'var(--volt)' : 'var(--text)', display: 'block', borderRadius: 2 }} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '10px 18px 16px', display: 'grid', gap: 6 }}>
            {LINKS.map(l => {
              const active = location.pathname === l.path
              return (
                <Link key={l.path} to={l.path} className={active ? 'chip chip--on' : 'chip'}
                  style={{ justifyContent: 'center', padding: '12px 14px', fontSize: '0.8rem' }}>
                  {l.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      <style>{`
        @media (max-width: 820px) {
          .nav-links { display: none !important; }
          .nav-burger { display: flex !important; }
        }
      `}</style>

      {showSignIn && !isSignedIn && <SignInModal onClose={() => setShowSignIn(false)} />}
    </>
  )
}
