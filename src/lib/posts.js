// ============================================================
// HYPERSYNC — multilingual post intelligence
// Artist posts arrive as [ENGLISH]...[KOREAN]... blocks from the
// portal's translation flow. Fans read ONE language of choice.
// ============================================================

export const LANGUAGES = {
  ENGLISH: 'English', KOREAN: '한국어', JAPANESE: '日本語', CHINESE: '中文',
  THAI: 'ไทย', VIETNAMESE: 'Tiếng Việt', FILIPINO: 'Filipino', INDONESIAN: 'Indonesia',
}

const LANG_KEY = 'hs_lang'
export const getPreferredLang = () => localStorage.getItem(LANG_KEY) || 'ENGLISH'
export const setPreferredLang = (code) => localStorage.setItem(LANG_KEY, code)

// Parse "[ENGLISH]\ntext\n\n[KOREAN]\ntext" → { ENGLISH: text, KOREAN: text }
// Plain posts (no markers) → { _plain: text }
export function parsePost(content) {
  const text = String(content || '').trim()
  const re = /\[([A-Z]+)\]\s*/g
  if (!re.test(text)) return { _plain: text }
  re.lastIndex = 0

  const segments = {}
  const parts = text.split(/\[([A-Z]+)\]\s*/)
  // parts: ["", "ENGLISH", "text...", "KOREAN", "text...", ...]
  for (let i = 1; i < parts.length; i += 2) {
    const code = parts[i]
    const body = (parts[i + 1] || '').trim()
    if (body) segments[code] = body
  }
  return Object.keys(segments).length ? segments : { _plain: text }
}

// Pick the text to show: preferred → English → first available
export function pickLanguage(segments, preferred) {
  if (segments._plain !== undefined) return { code: null, text: segments._plain }
  if (segments[preferred]) return { code: preferred, text: segments[preferred] }
  if (segments.ENGLISH) return { code: 'ENGLISH', text: segments.ENGLISH }
  const first = Object.keys(segments)[0]
  return { code: first, text: segments[first] || '' }
}
