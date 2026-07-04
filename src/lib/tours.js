// ============================================================
// HYPERSYNC — tour intelligence
// One tour, many legs. Derives a stable tour_key from messy
// event names, groups slides, resolves the best image.
// Mirrors the server pipeline's derivation exactly.
// ============================================================

// Strip cities, venues, dates, punctuation noise from event names
export function deriveTourKey(artistName, eventName) {
  // v3.2 order-proof fingerprint — mirrors the server pipeline exactly:
  // filler words removed, remaining tokens sorted alphabetically.
  const STOP = ['tour','world','live','concert','show','the','a','an','in','at','on','of','and','with','presents','encore','day','vol']
  let s = String(eventName || '').toLowerCase()
  s = s
    .replace(/[<>\[\]（）()「」【】'"''""]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/[–—\-:·|,.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const artist = String(artistName || '').toLowerCase().trim()
  if (artist) {
    const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    s = s.replace(new RegExp(`\\b${escaped}\\b`, 'g'), ' ')
  }
  const uniq = [...new Set(s.split(/\s+/).filter(t => t && !STOP.includes(t) && t.length > 1))].sort()
  const key = uniq.slice(0, 6).join('-')
  return `${artist.replace(/\s+/g, '-')}|${key || 'event'}`
}

// Collapse announcement slides: one per tour, earliest upcoming date wins,
// best image wins (explicit image > any sibling's image).
export function groupAnnouncements(rows) {
  const groups = new Map()
  for (const a of rows) {
    const key = a.tour_key || deriveTourKey(a.artist, a.title)
    const g = groups.get(key)
    if (!g) {
      groups.set(key, { ...a, tour_key: key, legs: 1 })
    } else {
      g.legs += 1
      if (a.date && (!g.date || a.date < g.date)) {
        g.date = a.date; g.title = a.title
        // Location follows the earliest (next) leg
        g.venue = a.venue; g.city = a.city; g.country = a.country
        if (a.event_type) g.event_type = a.event_type
      }
      if (!g.image && a.image) g.image = a.image
      if (!g.text && a.text) g.text = a.text
      if (!g.event_type && a.event_type) g.event_type = a.event_type
    }
  }
  return [...groups.values()].sort((x, y) => (x.date || '').localeCompare(y.date || ''))
}

// Image ladder: explicit → artist portal banner → artist image → '' (gradient)
export function resolveImage(slide, artistsByName) {
  if (slide.image) return slide.image
  const a = artistsByName[(slide.artist || '').toLowerCase()]
  return a?.portal_banner || a?.image || ''
}

export function indexArtistsByName(artists) {
  const map = {}
  for (const a of artists) map[(a.name || '').toLowerCase()] = a
  return map
}
