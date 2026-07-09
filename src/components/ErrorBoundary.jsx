import { Component } from 'react'

// Crash containment: a page that dies renders THIS instead of
// taking the whole app down. The error message is printed so
// black screens become readable diagnoses.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Page crash:', error, info?.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="wrap section" style={{ paddingTop: 80 }}>
        <div className="card" style={{ padding: '32px 28px', maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
          <div className="display" style={{ fontSize: '1.4rem', marginBottom: 10 }}>
            SOMETHING BROKE
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--dim)', marginBottom: 16 }}>
            This page hit an error. The rest of the site is fine.
          </p>
          <code style={{
            display: 'block', textAlign: 'left', fontSize: '0.72rem', color: '#FF9A9A',
            background: 'rgba(255,0,0,0.06)', border: '1px solid rgba(255,80,80,0.25)',
            borderRadius: 8, padding: '12px 14px', wordBreak: 'break-word', marginBottom: 18,
          }}>
            {String(this.state.error?.message || this.state.error)}
          </code>
          <button className="btn btn--volt" onClick={() => { this.setState({ error: null }); window.location.href = '/' }}>
            Back to home
          </button>
        </div>
      </div>
    )
  }
}
