import { useState } from 'react'
import { Link } from 'react-router-dom'

/* ============================================================
   HYPERSYNC — PARTNERS (agency-facing pitch page)
   Bilingual EN/KR toggle. The forwardable brochure.
   Route: /partners
   ============================================================ */

const T = {
  en: {
    eyebrow: 'FOR AGENCIES & ARTISTS',
    heroA: 'Your own fan platform.',
    heroB: 'Already built. Already running.',
    heroSub: 'HYPERSYNC is a pan-Asian fan platform — artist pages, automated news and tour tracking, fan community, paid messages, marketplace, and 24/7 radio. Southeast Asia\'s fans, one home. Yours to use.',
    cta: 'Request an invite',
    statA: 'Artists tracked',
    statB: 'Countries covered',
    statC: 'Radio, always on',
    already1: 'Your artist may already live here.',
    already2: 'Our automated newsroom tracks artists across Asia — news, tour dates, stats — updated daily without human hands. If your artist is on our roster, their page is already live, already current, already gathering Southeast Asian fans. Claiming the dashboard takes fifteen minutes.',
    featTitle: 'What your artist gets',
    feats: [
      ['Artist page', 'Bio, news, tour dates, stats — refreshed automatically by our pipeline, editable by your team.'],
      ['Artist dashboard', 'Post photos, video and updates straight to fans. Invite-only, handed to your staff with full control.'],
      ['Paid messages', 'Fans pay credits to message your artist. You set the price. You keep 90%.'],
      ['Marketplace', 'List merch and albums with links to your own store. We take nothing. 0%.'],
      ['Community', 'Global chat and per-artist discussion boards where fandoms live between comebacks.'],
      ['HYPERSYNC Radio', '24/7 station streaming across the platform. Partner artists can opt in to rotation.'],
    ],
    dealTitle: 'The deal, in writing',
    deal: [
      ['FREE', 'The platform costs your agency nothing. No setup fee, no subscription, no lock-in.'],
      ['90 / 10', 'Paid-message revenue: your artist keeps 90%. Our 10% is the entire business model.'],
      ['0%', 'Marketplace sales are yours entirely. We host the shelf; the register is yours.'],
      ['1 POST', 'What we ask: tell your fans you\'re here. One announcement. That\'s the whole price.'],
    ],
    howTitle: 'How onboarding works',
    how: [
      'You request an invite below.',
      'We set up your artist\'s account and hand you the credentials.',
      'Your team logs in, claims the page, sets the DM price, posts a hello.',
      'You announce it to your fans. We handle everything else — the machine runs itself.',
    ],
    formTitle: 'Request an invite',
    formSub: 'Tell us who you are and which artist. We reply within 24 hours.',
    formBtn: 'Send inquiry',
    formNote: 'Or write to us directly: partners@brubai.net',
    footer: 'HYPERSYNC is built and operated by BRUB AI Technologies Inc., Manila.',
  },
  kr: {
    eyebrow: '기획사 및 아티스트 전용',
    heroA: '귀사만의 팬 플랫폼.',
    heroB: '이미 완성되어, 이미 운영 중입니다.',
    heroSub: 'HYPERSYNC는 범아시아 팬 플랫폼입니다 — 아티스트 페이지, 자동화된 뉴스·투어 트래킹, 팬 커뮤니티, 유료 메시지, 마켓플레이스, 그리고 24시간 라디오까지. 동남아시아 팬들이 모이는 하나의 홈을 귀사의 아티스트에게 제공합니다.',
    cta: '초대 요청하기',
    statA: '트래킹 중인 아티스트',
    statB: '커버 국가',
    statC: '라디오, 24시간',
    already1: '귀사의 아티스트가 이미 이곳에 있을지도 모릅니다.',
    already2: '저희 자동화 뉴스룸은 아시아 전역의 아티스트를 매일 트래킹합니다 — 뉴스, 투어 일정, 지표까지 사람 손 없이 갱신됩니다. 귀사의 아티스트가 로스터에 있다면, 페이지는 이미 라이브 상태로 동남아 팬들을 모으고 있습니다. 대시보드 인수는 15분이면 충분합니다.',
    featTitle: '아티스트가 받는 것',
    feats: [
      ['아티스트 페이지', '소개, 뉴스, 투어 일정, 지표 — 파이프라인이 자동 갱신하며, 귀사 팀이 직접 편집할 수 있습니다.'],
      ['아티스트 대시보드', '사진·영상·소식을 팬에게 직접 게시. 초대 전용으로 귀사 스태프에게 전권을 드립니다.'],
      ['유료 메시지', '팬이 크레딧을 지불하고 아티스트에게 메시지를 보냅니다. 가격은 귀사가 정하고, 수익의 90%를 가져갑니다.'],
      ['마켓플레이스', '굿즈와 앨범을 귀사 스토어 링크와 함께 등록하세요. 수수료 0%. 저희는 아무것도 받지 않습니다.'],
      ['커뮤니티', '글로벌 채팅과 아티스트별 게시판 — 컴백 사이에도 팬덤이 머무는 공간입니다.'],
      ['HYPERSYNC 라디오', '플랫폼 전체에 스트리밍되는 24시간 방송. 파트너 아티스트는 로테이션에 참여할 수 있습니다.'],
    ],
    dealTitle: '조건은 명확합니다',
    deal: [
      ['무료', '플랫폼 이용료는 없습니다. 셋업 비용도, 구독료도, 락인도 없습니다.'],
      ['90 / 10', '유료 메시지 수익: 아티스트가 90%를 가져갑니다. 저희의 10%가 비즈니스 모델의 전부입니다.'],
      ['0%', '마켓플레이스 매출은 전액 귀사의 것입니다. 진열대는 저희가, 계산대는 귀사가.'],
      ['게시 1건', '저희가 요청하는 것: 팬들에게 알려주세요. 공지 한 번. 그것이 전부입니다.'],
    ],
    howTitle: '온보딩 절차',
    how: [
      '아래에서 초대를 요청합니다.',
      '저희가 아티스트 계정을 만들어 접속 정보를 전달합니다.',
      '귀사 팀이 로그인하여 페이지를 인수하고, DM 가격을 설정하고, 첫 인사를 게시합니다.',
      '팬들에게 공지하시면 됩니다. 나머지는 저희 시스템이 알아서 운영합니다.',
    ],
    formTitle: '초대 요청',
    formSub: '소속과 아티스트를 알려주세요. 24시간 이내에 회신드립니다.',
    formBtn: '문의 보내기',
    formNote: '직접 메일 주셔도 됩니다: partners@brubai.net',
    footer: 'HYPERSYNC는 마닐라의 BRUB AI Technologies Inc.가 만들고 운영합니다.',
  },
}

export default function Partners() {
  const [lang, setLang] = useState('en')
  const [name, setName] = useState('')
  const [agency, setAgency] = useState('')
  const [artist, setArtist] = useState('')
  const [email, setEmail] = useState('')
  const t = T[lang]

  const inquire = e => {
    e.preventDefault()
    const subject = encodeURIComponent(`HYPERSYNC partner inquiry — ${agency || artist}`)
    const body = encodeURIComponent(
      `Name: ${name}\nAgency: ${agency}\nArtist: ${artist}\nReply-to: ${email}\n\n(sent from hypersync.live/partners)`
    )
    window.location.href = `mailto:partners@brubai.net?subject=${subject}&body=${body}`
  }

  const input = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--line)', background: 'var(--card)',
    color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div>
      {/* language toggle */}
      <div className="wrap" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 18 }}>
        <div style={{ display: 'flex', gap: 4, border: '1px solid var(--line)', borderRadius: 999, padding: 3 }}>
          {['en', 'kr'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.12em',
              background: lang === l ? 'var(--volt-grad, #FFD400)' : 'transparent',
              color: lang === l ? '#14120A' : 'var(--dim)',
            }}>{l === 'en' ? 'EN' : '한국어'}</button>
          ))}
        </div>
      </div>

      {/* hero */}
      <section className="wrap section" style={{ textAlign: 'center', paddingTop: 'clamp(30px, 6vw, 70px)' }}>
        <div className="eyebrow eyebrow--volt" style={{ marginBottom: 16 }}>{t.eyebrow}</div>
        <h1 className="display" style={{ fontSize: 'clamp(2rem, 6.5vw, 4rem)', lineHeight: 1.05 }}>
          {t.heroA}<br /><span className="volt-text">{t.heroB}</span>
        </h1>
        <p style={{ color: 'var(--dim)', maxWidth: 640, margin: '22px auto 0', fontSize: '0.95rem', lineHeight: 1.7 }}>
          {t.heroSub}
        </p>
        <div style={{ marginTop: 30, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#invite" className="btn btn--volt">{t.cta}</a>
          <Link to="/artists" className="btn" style={{ border: '1px solid var(--line)' }}>hypersync.live →</Link>
        </div>
      </section>

      {/* stats band */}
      <section className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, marginTop: 10 }}>
        {[['65+', t.statA], ['20+', t.statB], ['24/7', t.statC]].map(([v, l]) => (
          <div key={l} className="card" style={{ padding: '22px 14px', textAlign: 'center', borderRadius: 0 }}>
            <div className="display" style={{ fontSize: '1.8rem', color: 'var(--volt)' }}>{v}</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.16em', color: 'var(--faint)', textTransform: 'uppercase', marginTop: 6 }}>{l}</div>
          </div>
        ))}
      </section>

      {/* already here */}
      <section className="wrap section">
        <div className="card" style={{ padding: 'clamp(24px, 5vw, 44px)', border: '1px solid rgba(255,212,0,0.25)' }}>
          <h2 className="display" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.1rem)', marginBottom: 14 }}>
            {t.already1}
          </h2>
          <p style={{ color: 'var(--dim)', fontSize: '0.9rem', lineHeight: 1.75, maxWidth: 720 }}>{t.already2}</p>
        </div>
      </section>

      {/* features */}
      <section className="wrap section">
        <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.3rem)', marginBottom: 22 }}>{t.featTitle}</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(90vw, 300px), 1fr))' }}>
          {t.feats.map(([h, p]) => (
            <div key={h} className="card card--lift" style={{ padding: '22px 22px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 8, color: 'var(--volt)' }}>{h}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--dim)', lineHeight: 1.65 }}>{p}</div>
            </div>
          ))}
        </div>
      </section>

      {/* the deal */}
      <section className="wrap section">
        <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.3rem)', marginBottom: 22 }}>{t.dealTitle}</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 220px), 1fr))' }}>
          {t.deal.map(([big, small]) => (
            <div key={big} className="card" style={{ padding: '28px 22px', textAlign: 'center' }}>
              <div className="display" style={{ fontSize: '2rem', color: 'var(--volt)', marginBottom: 10 }}>{big}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--dim)', lineHeight: 1.6 }}>{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* how */}
      <section className="wrap section">
        <h2 className="display" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.3rem)', marginBottom: 22 }}>{t.howTitle}</h2>
        <div style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
          {t.how.map((step, i) => (
            <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
              <span className="display" style={{ fontSize: '1.2rem', color: 'var(--volt)', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.6 }}>{step}</span>
            </div>
          ))}
        </div>
      </section>

      {/* invite form */}
      <section className="wrap section" id="invite">
        <div className="card" style={{ padding: 'clamp(24px, 5vw, 40px)', maxWidth: 560, margin: '0 auto' }}>
          <h2 className="display" style={{ fontSize: '1.4rem', marginBottom: 8, textAlign: 'center' }}>{t.formTitle}</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--faint)', textAlign: 'center', marginBottom: 22 }}>{t.formSub}</p>
          <form onSubmit={inquire} style={{ display: 'grid', gap: 12 }}>
            <input style={input} placeholder={lang === 'kr' ? '성함' : 'Your name'} value={name} onChange={e => setName(e.target.value)} required />
            <input style={input} placeholder={lang === 'kr' ? '소속 기획사' : 'Agency'} value={agency} onChange={e => setAgency(e.target.value)} required />
            <input style={input} placeholder={lang === 'kr' ? '아티스트명' : 'Artist name'} value={artist} onChange={e => setArtist(e.target.value)} required />
            <input style={input} type="email" placeholder={lang === 'kr' ? '회신 받으실 이메일' : 'Reply-to email'} value={email} onChange={e => setEmail(e.target.value)} required />
            <button className="btn btn--volt" style={{ width: '100%' }}>{t.formBtn}</button>
          </form>
          <div style={{ fontSize: '0.68rem', color: 'var(--faint)', textAlign: 'center', marginTop: 14 }}>{t.formNote}</div>
        </div>
      </section>

      <div style={{ textAlign: 'center', padding: '10px 20px 46px', fontSize: '0.64rem', color: 'var(--faint)' }}>
        {t.footer}
      </div>
    </div>
  )
}
