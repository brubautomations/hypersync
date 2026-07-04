import { useEffect, useRef } from 'react'

// Adds .in to .reveal elements as they enter the viewport.
// MutationObserver catches elements rendered AFTER data loads —
// without it, async-rendered cards mount at opacity 0 and stay invisible.
export function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.08 }
    )

    const watch = () => root.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el))
    watch()

    const mo = new MutationObserver(watch)
    mo.observe(root, { childList: true, subtree: true })

    return () => { io.disconnect(); mo.disconnect() }
  }, [])
  return ref
}
