import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { exchangeGoogleCredential, storeAuth, clearAuth, getStoredUser, getSession } from '../lib/api'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const AuthContext = createContext({})

let gsiLoaded = null
function loadGoogleScript() {
  if (gsiLoaded) return gsiLoaded
  gsiLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Sign-in service failed to load'))
    document.head.appendChild(s)
  })
  return gsiLoaded
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  const handleCredential = useCallback(async (response) => {
    setLoading(true)
    try {
      const { session, user: u } = await exchangeGoogleCredential(response.credential)
      storeAuth(session, u)
      setUser(u)
    } catch (e) {
      console.error('Sign-in failed:', e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
        })
        setReady(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [handleCredential])

  // Renders the official Google button into a target element
  const renderGoogleButton = useCallback((el) => {
    if (!el || !window.google?.accounts?.id) return
    window.google.accounts.id.renderButton(el, {
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 280,
    })
  }, [])

  const signOut = useCallback(() => {
    clearAuth()
    setUser(null)
    window.google?.accounts?.id?.disableAutoSelect?.()
  }, [])

  const isSignedIn = !!user && !!getSession()

  return (
    <AuthContext.Provider value={{ user, isSignedIn, loading, ready, renderGoogleButton, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
