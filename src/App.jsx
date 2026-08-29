import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CreditProvider } from './context/CreditContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Artists from './pages/Artists'
import ArtistDetail from './pages/ArtistDetail'
import Feed from './pages/Feed'
import Schedule from './pages/Schedule'
import Radio from './pages/Radio'
import ChatDrawer from './components/ChatDrawer'
import ErrorBoundary from './components/ErrorBoundary'
import SignInWall from './components/SignInWall'
import Portal from './portal/Portal'
import Messages from './pages/Messages'

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

function Shell() {
  const { pathname } = useLocation()

  // /radio opens in its own browser window — no navbar, no chat rail,
  // nothing but the station.
  if (pathname === '/radio') {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/radio" element={<Radio />} />
        </Routes>
      </ErrorBoundary>
    )
  }

  // /portal is the artists' workspace — same treatment: no fan chrome.
  if (pathname.startsWith('/portal')) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/portal" element={<Portal />} />
        </Routes>
      </ErrorBoundary>
    )
  }

  return (
    <>
      <Navbar />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/:id" element={<ArtistDetail />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/messages" element={<SignInWall label="Your inbox"><Messages /></SignInWall>} />
          <Route path="/schedule" element={<SignInWall label="The schedule"><Schedule /></SignInWall>} />
          <Route path="/shop" element={<SignInWall label="The shop"><ComingSoon label="Shop" /></SignInWall>} />
          <Route path="*" element={<ComingSoon label="Page" />} />
        </Routes>
      </ErrorBoundary>
      <ChatDrawer />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CreditProvider>
        <Router>
          <Shell />
        </Router>
      </CreditProvider>
    </AuthProvider>
  )
}
