import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CreditProvider } from './context/CreditContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'

// Phase 2–4 pages land here. Placeholder keeps routes stable meanwhile.
function ComingSoon({ label }) {
  return (
    <div className="wrap section" style={{ textAlign: 'center', minHeight: '55vh', display: 'grid', placeItems: 'center' }}>
      <div>
        <div className="eyebrow eyebrow--volt" style={{ marginBottom: 12 }}>In the works</div>
        <h1 className="display" style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)' }}>
          {label} <span className="volt-text">syncing…</span>
        </h1>
        <p style={{ color: 'var(--dim)', marginTop: 14 }}>This page ships in the next build phase.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CreditProvider>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/artists" element={<ComingSoon label="Artists" />} />
            <Route path="/artists/:id" element={<ComingSoon label="Artist" />} />
            <Route path="/feed" element={<ComingSoon label="Feed" />} />
            <Route path="/schedule" element={<ComingSoon label="Schedule" />} />
            <Route path="/shop" element={<ComingSoon label="Shop" />} />
            <Route path="*" element={<ComingSoon label="Page" />} />
          </Routes>
        </Router>
      </CreditProvider>
    </AuthProvider>
  )
}
