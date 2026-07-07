import { useEffect, useRef } from 'react'

// Reveal-on-scroll, FAIL-OPEN edition.
// Philosophy: content is visible by default; hiding is only allowed while
// the observer is provably alive (html.reveal-armed). A safety valve
// force-reveals anything still hidden after 1.5s. Broken animation can
// dim the experience — it can never blank the page.
export function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    if (!('IntersectionObserver' in window)) return // never arm → everything visible

    document.documentElement.classList.add('reveal-armed')

    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.05 }
    )

    const watch = () => root.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el))
    watch()

    const mo = new MutationObserver(watch)
    mo.observe(root, { childList: true, subtree: true })

    // safety valve: anything not revealed shortly after (re)render pops in
    const valve = setInterval(() => {
      root.querySelectorAll('.reveal:not(.in)').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in')
      })
    }, 1500)

    return () => {
      io.disconnect(); mo.disconnect(); clearInterval(valve)
      document.documentElement.classList.remove('reveal-armed')
    }
  }, [])
  return ref
}
