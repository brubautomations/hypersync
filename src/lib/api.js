// ============================================================
// HYPERSYNC — frontend API client
// Talks only to our own /api endpoints. No tokens, no vendors.
// ============================================================

const SESSION_KEY = 'hs_session'
const USER_KEY = 'hs_user'

export const getSession = () => localStorage.getItem(SESSION_KEY) || ''
export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
}
export const storeAuth = (session, user) => {
  localStorage.setItem(SESSION_KEY, session)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
export const clearAuth = () => {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (auth) headers['Authorization'] = `Bearer ${getSession()}`
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = new Error(data.error || 'Something went wrong')
    e.status = res.status
    e.data = data
    throw e
  }
  return data
}

// ── public data ─────────────────────────────────────────────
export const fetchData = (resource, params = {}) => {
  const q = new URLSearchParams({ resource, ...params })
  return request(`/api/data?${q}`)
}

// ── auth ────────────────────────────────────────────────────
export const exchangeGoogleCredential = (credential) =>
  request('/api/auth', { method: 'POST', body: { credential } })

// ── credits ─────────────────────────────────────────────────
export const fetchBalance = () =>
  request('/api/credits?action=balance', { auth: true })

export const createPurchase = (pack) =>
  request('/api/credits?action=create', { method: 'POST', body: { pack }, auth: true })

export const checkPurchase = (linkId) =>
  request(`/api/credits?action=check&link_id=${encodeURIComponent(linkId)}`, { auth: true })

// ── dm ──────────────────────────────────────────────────────
export const sendDM = (artistId, message) =>
  request('/api/dm', { method: 'POST', body: { artistId, message }, auth: true })
