import { Link } from 'react-router-dom'

/* ============================================================
   PARTNERS — the industry door.
   Copy follows the HYPERSYNC Partners Page blueprint.
   Route: /partners
   ============================================================ */

const NETWORK = [
  ['Artist Hubs', 'A living destination for artist identity, verified links, news, activity, posts, discussions and direct fan touchpoints.'],
  ['News + Activity', 'HYPERSYNC continuously organizes entertainment news, releases, appearances, concerts and tour activity into structured artist timelines.'],
  ['Discovery', 'Artists appear alongside artists from other scenes and markets, creating organic cross-fandom exposure that search alone cannot create.'],
  ['Community', 'Network-level conversation and artist-specific discussions give fandoms a place to react, debate and stay active between releases.'],
  ['HYPERSYNC Radio', 'A 24/7 programmed station and media property designed to move listeners across artists, eras, scenes and regions.'],
  ['Commerce + Direct Access', 'Partner tools can connect fans to official posts, messaging, merchandise and other artist-controlled experiences.'],
]

const PARTNERSHIP = [
  ['Official control', 'Manage profile identity and approved artist information.'],
  ['Direct publishing', 'Post updates, media and announcements straight to fans.'],
  ['Fan connection', 'Participate in artist discussions and direct fan interaction features.'],
  ['Commercial access', 'Use marketplace, messaging and monetization tools as they become available to your account.'],
  ['Media participation', 'Coordinate with HYPERSYNC Radio and other network programming opportunities.'],
  ['Discovery presence', 'Be surfaced not only to existing fans, but to people entering HYPERSYNC through other artists and scenes.'],
]

const TERMS = [
  ['No platform subscription', 'There is no recurring fee simply to maintain an official partner presence.'],
  ['90% of paid-message revenue to the artist', 'Where paid messaging is enabled, the artist keeps 90%; HYPERSYNC retains 10%.'],
  ['No marketplace commission', "Where HYPERSYNC links fans to the artist's own store, merchandise revenue remains with the seller."],
  ['No content quota', 'Partners decide when and how they use the platform. HYPERSYNC does not require a posting schedule to remain official.'],
]

const ONBOARDING = [
  ['Partnership request', 'An artist, label, agency or authorized representative gets in touch.'],
  ['Verification', "HYPERSYNC verifies representation and the artist's official presence."],
  ['Partner access', 'The authorized team receives access to the artist-side workspace and available controls.'],
  ['Go official', "The artist's presence becomes an official participant in the HYPERSYNC network."],
]

const inputStyle = {
  width: '100%', padding: '13px 15px', borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--panel)',
  color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
}

function Eyebrow({ children }) {
  return (
    <div style={{
      fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.22em',
      color: 'var(--volt)', textTransform: 'uppercase', marginBottom: 18,
    }}>{children}</div>
  )
}

function SectionHead({ children, sub }) {
  return (
    <>
      <h2 className="display" style={{
        fontSize: 'clamp(1.6rem, 4.5vw, 2.8rem)', lineHeight: 1.08,
        maxWidth: 900, marginBottom: sub ? 16 : 28,
      }}>{children}</h2>
      {sub ? (
        <p style={{
          color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.8,
          maxWidth: 720, marginBottom: 30,
        }}>{sub}</p>
      ) : null}
    </>
  )
}

export default function Partners() {
  return (
    <div>
      {/* HERO */}
      <section className="wrap" style={{ padding: 'clamp(48px, 9vw, 110px) 0 clamp(36px, 6vw, 70px)' }}>
        <Eyebrow>For artists · Labels · Agencies · Management</Eyebrow>
        <h1 className="display" style={{
          fontSize: 'clamp(2.3rem, 7.5vw, 5rem)', lineHeight: 1.02, maxWidth: 1000,
        }}>
          PUT YOUR ARTISTS INSIDE A <span className="volt-text">LIVING MUSIC NETWORK.</span>
        </h1>
        <p style={{
          color: 'var(--dim)', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
          lineHeight: 1.75, maxWidth: 760, marginTop: 26,
        }}>
          HYPERSYNC brings artist identity, news, schedules, releases, community, radio and
          direct fan participation into one continuously synchronized entertainment network —
          built around Asian music and open to global discovery.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 34 }}>
          <a href="#partner" className="btn btn--volt" style={{ padding: '13px 26px' }}>
            Become a HYPERSYNC partner
          </a>
          <Link to="/artists" className="btn" style={{ border: '1px solid var(--line)', padding: '13px 26px' }}>
            Explore HYPERSYNC
          </Link>
        </div>
        <p style={{ marginTop: 26, fontSize: '0.86rem', color: 'var(--faint)' }}>
          Come for the artist you know. Discover the ones you don't.
        </p>
      </section>

      <hr style={{ height: 1, background: 'var(--line)', border: 0, margin: 0 }} />

      {/* WHY HYPERSYNC EXISTS */}
      <section className="wrap section">
        <div style={{
          display: 'grid', gap: 'clamp(24px, 5vw, 64px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 380px), 1fr))',
          alignItems: 'start',
        }}>
          <SectionHead>ONE ARTIST CAN OPEN THE DOOR TO AN ENTIRE SCENE.</SectionHead>
          <div style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85 }}>
            <p style={{ marginBottom: 18 }}>
              Fans rarely discover music by geography. They discover through curiosity.
              A fan may arrive on HYPERSYNC to check an artist's news, tour dates or latest
              posts — then encounter another artist they have never heard of, click through,
              listen, read, follow and stay.
            </p>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>
              That is the HYPERSYNC discovery loop: familiar artists bring fans in;
              the network introduces them to what comes next.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT THE NETWORK DOES */}
      <section className="wrap section">
        <SectionHead>MORE THAN AN ARTIST PAGE.</SectionHead>
        <div style={{
          display: 'grid', gap: 1, background: 'var(--line)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 300px), 1fr))',
        }}>
          {NETWORK.map(([title, body]) => (
            <div key={title} style={{ background: 'var(--ink, #0C0C11)', padding: 'clamp(22px, 3vw, 32px)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', marginBottom: 10 }}>{title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--dim)', lineHeight: 1.7 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT PARTNERSHIP CHANGES */}
      <section className="wrap section">
        <SectionHead sub="HYPERSYNC may already track and organize public information around artists across its network. Partnership gives the artist and their authorized team a direct operating role inside that presence.">
          FROM COVERED ARTIST TO OFFICIAL PARTICIPANT.
        </SectionHead>
        <div style={{ display: 'grid', maxWidth: 880 }}>
          {PARTNERSHIP.map(([title, body], i) => (
            <div key={title} style={{
              display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr',
              gap: 'clamp(14px, 3vw, 40px)', padding: '20px 0',
              borderTop: i === 0 ? '1px solid var(--line)' : 'none',
              borderBottom: '1px solid var(--line)',
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--volt)' }}>{title}</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--dim)', lineHeight: 1.7 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DISCOVERY VALUE */}
      <section className="wrap section">
        <div className="card" style={{ padding: 'clamp(28px, 5vw, 60px)' }}>
          <SectionHead>
            THE FANS YOU ALREADY HAVE MATTER. SO DO THE FANS WHO DO NOT KNOW TO SEARCH FOR YOU YET.
          </SectionHead>
          <p style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85, maxWidth: 780 }}>
            HYPERSYNC is designed to increase the number of contexts in which an artist can be
            discovered. A K-pop fan can encounter P-pop. A P-pop fan can find Kazakh rap. A
            Japanese music fan can stumble into an Australian act. The goal is not to flatten
            these scenes into one genre — it is to make the borders between them easier to cross.
          </p>
        </div>
      </section>

      {/* HOW HYPERSYNC STAYS CURRENT */}
      <section className="wrap section">
        <div style={{
          display: 'grid', gap: 'clamp(24px, 5vw, 64px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 380px), 1fr))',
          alignItems: 'start',
        }}>
          <SectionHead>A NETWORK THAT KEEPS MOVING.</SectionHead>
          <div style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85 }}>
            <p style={{ marginBottom: 18 }}>
              Behind the public experience, HYPERSYNC runs recurring systems that organize
              entertainment news, monitor artist activity, maintain schedules, refresh selected
              metrics and keep artist information synchronized. Automation handles repetitive
              maintenance; verification and editorial controls remain where accuracy matters.
            </p>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>
              For partners, that means your HYPERSYNC presence is not dependent on someone
              manually rebuilding the page every time the artist moves.
            </p>
          </div>
        </div>
      </section>

      {/* COMMERCIAL TERMS */}
      <section className="wrap section">
        <SectionHead>PARTNERSHIP WITHOUT PLATFORM RENT.</SectionHead>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 330px), 1fr))',
        }}>
          {TERMS.map(([title, body]) => (
            <div key={title} className="card" style={{ padding: 'clamp(20px, 3vw, 28px)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: 10, lineHeight: 1.4 }}>{title}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--dim)', lineHeight: 1.7 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ONBOARDING */}
      <section className="wrap section">
        <SectionHead>HOW PARTNERSHIP WORKS.</SectionHead>
        <div style={{
          display: 'grid', gap: 1, background: 'var(--line)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 240px), 1fr))',
        }}>
          {ONBOARDING.map(([title, body], i) => (
            <div key={title} style={{ background: 'var(--ink, #0C0C11)', padding: 'clamp(22px, 3vw, 30px)' }}>
              <div className="display" style={{ fontSize: '1.6rem', color: 'var(--volt)', marginBottom: 12 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--dim)', lineHeight: 1.7 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="wrap section" id="partner">
        <div className="card" style={{
          padding: 'clamp(34px, 6vw, 72px)', textAlign: 'center',
          border: '1px solid rgba(255,212,0,0.28)',
        }}>
          <h2 className="display" style={{
            fontSize: 'clamp(1.8rem, 5.5vw, 3.4rem)', lineHeight: 1.05, marginBottom: 20,
          }}>
            BRING YOUR ROSTER INTO <span className="volt-text">HYPERSYNC.</span>
          </h2>
          <p style={{
            color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.8,
            maxWidth: 620, margin: '0 auto 30px',
          }}>
            Whether you represent one artist or an international roster, HYPERSYNC gives your
            team a direct place inside a network built for discovery, participation and
            continuous artist activity.
          </p>

          <form name="partners" method="POST" data-netlify="true" netlify-honeypot="company-website"
            style={{ display: 'grid', gap: 12, maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
            <input type="hidden" name="form-name" value="partners" />
            <p style={{ display: 'none' }}>
              <label>Leave blank: <input name="company-website" /></label>
            </p>
            <input name="name" required placeholder="Name" style={inputStyle} />
            <input name="organization" required placeholder="Agency / label / management" style={inputStyle} />
            <input name="artist" required placeholder="Artist or roster" style={inputStyle} />
            <input name="email" type="email" required placeholder="Email" style={inputStyle} />
            <textarea name="message" rows={4} placeholder="Message" style={{ ...inputStyle, resize: 'vertical' }} />
            <button type="submit" className="btn btn--volt" style={{ width: '100%', padding: '14px' }}>
              Become a HYPERSYNC partner
            </button>
          </form>

          <p style={{ marginTop: 26, fontSize: '0.8rem', color: 'var(--faint)', letterSpacing: '0.06em' }}>
            Asian at the center. Global by design.
          </p>
        </div>
      </section>
    </div>
  )
}
