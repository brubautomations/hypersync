import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { fetchBalance } from '../lib/api'

const CreditContext = createContext({})

export function CreditProvider({ children }) {
  const { isSignedIn } = useAuth()
  const [credits, setCredits] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isSignedIn) { setCredits(0); return }
    setLoading(true)
    try {
      const { credits: c } = await fetchBalance()
      setCredits(c || 0)
    } catch {
      setCredits(0)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn])

  useEffect(() => { refresh() }, [refresh])

  // Server responses (dm send, purchase check) return fresh balances;
  // pages call setFromServer(n) or refresh() after those actions.
  const setFromServer = useCallback((n) => setCredits(n), [])

  return (
    <CreditContext.Provider value={{ credits, loading, refresh, setFromServer }}>
      {children}
    </CreditContext.Provider>
  )
}

export const useCredits = () => useContext(CreditContext)
