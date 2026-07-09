// ============================================================
// HYPERSYNC — global chat client
// Reading: Supabase (read-only anon key + realtime stream).
// Writing: our /api/chat endpoint (session-verified, filtered).
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { getSession } from './api'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const chatEnabled = Boolean(url && anon)

const sb = chatEnabled ? createClient(url, anon, { auth: { persistSession: false } }) : null

export async function fetchRecentMessages() {
  if (!sb) return []
  const { data } = await sb
    .from('chat_messages')
    .select('id, user_id, display_name, avatar, body, created_at')
    .order('id', { ascending: false })
    .limit(200)
  return (data || []).reverse()
}

// live inserts; returns unsubscribe
export function onNewMessage(cb) {
  if (!sb) return () => {}
  const ch = sb
    .channel('global-chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, p => cb(p.new))
    .subscribe()
  return () => sb.removeChannel(ch)
}

export async function sendChat(body) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getSession()}`,
    },
    body: JSON.stringify({ body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Message failed')
  return data
}

export async function getMyHandle() {
  const res = await fetch('/api/handle', {
    headers: { Authorization: `Bearer ${getSession()}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed')
  return data.handle
}

export async function claimHandle(handle) {
  const res = await fetch('/api/handle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSession()}` },
    body: JSON.stringify({ handle }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Claim failed')
  return data.handle
}
