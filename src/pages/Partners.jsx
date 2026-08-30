import { useState } from 'react'
import { Link } from 'react-router-dom'

/* ============================================================
   PARTNERS: the industry door. EN / KO / JA.
   Route: /partners
   ============================================================ */

const COPY = {
  en: {
    lang: "EN",
    eyebrow: "For artists, labels, agencies and management",
    heroA: "PUT YOUR ARTISTS INSIDE A",
    heroB: "LIVING MUSIC NETWORK",
    heroSub: "HYPERSYNC brings artist identity, news, schedules, releases, community, radio and direct fan participation into one continuously synchronized entertainment network. It is built around Asian music and open to global discovery.",
    ctaPrimary: "Become a HYPERSYNC partner",
    ctaSecondary: "Explore HYPERSYNC",
    whyHead: "ONE ARTIST CAN OPEN THE DOOR TO AN ENTIRE SCENE",
    whyBody: "Fans rarely discover music by geography. They discover through curiosity. A fan may arrive on HYPERSYNC to check an artist's news, tour dates or latest posts, then meet another artist they have never heard of, click through, listen, read, follow and stay.",
    whyBold: "That is the HYPERSYNC discovery loop. Familiar artists bring fans in, and the network introduces them to what comes next.",
    networkHead: "MORE THAN AN ARTIST PAGE",
    network: [
      ["Artist Hubs", "A living destination for artist identity, verified links, news, activity, posts, discussions and direct fan touchpoints."],
      ["News and Activity", "HYPERSYNC continuously organizes entertainment news, releases, appearances, concerts and tour activity into structured artist timelines."],
      ["Discovery", "Artists appear alongside artists from other scenes and markets, creating cross-fandom exposure that search alone cannot create."],
      ["Community", "Network-level conversation and artist-specific discussions give fandoms a place to react, debate and stay active between releases."],
      ["HYPERSYNC Radio", "A 24/7 programmed station and media property built to move listeners across artists, eras, scenes and regions."],
      ["Commerce and Direct Access", "Partner tools connect fans to official posts, messaging, merchandise and other artist-controlled experiences."]
    ],
    partnerHead: "FROM COVERED ARTIST TO OFFICIAL PARTICIPANT",
    partnerSub: "HYPERSYNC may already track and organize public information around artists across its network. Partnership gives the artist and their authorized team a direct operating role inside that presence.",
    partnership: [
      ["Official control", "Manage profile identity and approved artist information."],
      ["Direct publishing", "Post updates, media and announcements straight to fans."],
      ["Fan connection", "Take part in artist discussions and direct fan interaction features."],
      ["Commercial access", "Use marketplace, messaging and monetization tools as they become available to your account."],
      ["Media participation", "Coordinate with HYPERSYNC Radio and other network programming opportunities."],
      ["Discovery presence", "Be surfaced not only to existing fans, but to people entering HYPERSYNC through other artists and scenes."]
    ],
    discoveryHead: "THE FANS YOU HAVE, AND THE FANS WHO HAVEN'T FOUND YOU YET",
    discoveryBody: "HYPERSYNC is designed to increase the number of places where an artist can be found. A K-pop fan can run into P-pop. A P-pop fan can find Kazakh rap. A Japanese music fan can end up on an Australian act. The goal is not to flatten these scenes into one genre. It is to make the borders between them easier to cross.",
    systemHead: "A NETWORK THAT KEEPS MOVING",
    systemBody: "Behind the public experience, HYPERSYNC runs recurring systems that organize entertainment news, monitor artist activity, maintain schedules, refresh selected metrics and keep artist information synchronized. Automation handles the repetitive maintenance, while verification and editorial controls stay where accuracy matters.",
    systemBold: "For partners, that means your HYPERSYNC presence does not depend on someone rebuilding the page by hand every time the artist moves.",
    termsHead: "PARTNERSHIP WITHOUT PLATFORM RENT",
    terms: [
      ["No platform subscription", "There is no recurring fee simply to maintain an official partner presence."],
      ["90% of paid-message revenue to the artist", "Where paid messaging is enabled, the artist keeps 90% and HYPERSYNC retains 10%."],
      ["No marketplace commission", "Where HYPERSYNC links fans to the artist's own store, merchandise revenue stays with the seller."],
      ["No content quota", "Partners decide when and how they use the platform. HYPERSYNC does not require a posting schedule to remain official."]
    ],
    onboardHead: "HOW PARTNERSHIP WORKS",
    onboarding: [
      ["Partnership request", "An artist, label, agency or authorized representative gets in touch."],
      ["Verification", "HYPERSYNC verifies representation and the artist's official presence."],
      ["Partner access", "The authorized team receives access to the artist-side workspace and available controls."],
      ["Go official", "The artist's presence becomes an official participant in the HYPERSYNC network."]
    ],
    finalA: "BRING YOUR ROSTER INTO",
    finalB: "HYPERSYNC",
    finalBody: "HYPERSYNC connects your team to a global network built for artist discovery and collaboration.",
    formName: "Name",
    formOrg: "Agency, label or management",
    formArtist: "Artist or roster",
    formEmail: "Email",
    formMessage: "Message",
    tagline: "TUNE IN TO EVERYTHING",
  },

  ko: {
    lang: "한국어",
    eyebrow: "아티스트, 레이블, 기획사, 매니지먼트를 위한 안내",
    heroA: "살아 움직이는 음악 네트워크 안에",
    heroB: "아티스트를 배치하십시오",
    heroSub: "HYPERSYNC는 아티스트 정보, 뉴스, 일정, 발매, 커뮤니티, 라디오, 그리고 팬과의 직접적인 접점을 하나의 네트워크로 통합해 지속적으로 동기화합니다. 아시아 음악을 중심에 두면서도 글로벌한 발견에 열려 있습니다.",
    ctaPrimary: "HYPERSYNC 파트너 신청",
    ctaSecondary: "HYPERSYNC 둘러보기",
    whyHead: "한 아티스트가 하나의 씬 전체로 가는 문을 열 수 있습니다",
    whyBody: "팬은 지역을 기준으로 음악을 찾지 않습니다. 호기심을 따라 찾습니다. 특정 아티스트의 뉴스나 공연 일정, 최신 게시물을 보러 들어온 팬이 들어본 적 없는 다른 아티스트를 만나 클릭하고, 듣고, 읽고, 팔로우하고, 그대로 머무릅니다.",
    whyBold: "이것이 HYPERSYNC의 발견 구조입니다. 익숙한 아티스트가 팬을 데려오고, 네트워크가 그 다음을 소개합니다.",
    networkHead: "아티스트 페이지 그 이상입니다",
    network: [
      ["아티스트 허브", "아티스트 정보, 공식 링크, 뉴스, 활동, 게시물, 토론, 팬 접점이 한곳에 모이는 상시 공간입니다."],
      ["뉴스와 활동", "엔터테인먼트 뉴스, 발매, 출연, 콘서트, 투어 활동을 아티스트별 타임라인으로 계속 정리합니다."],
      ["발견", "다른 씬과 시장의 아티스트와 나란히 노출되어, 검색만으로는 만들 수 없는 팬덤 간 교차 노출이 일어납니다."],
      ["커뮤니티", "네트워크 전체 대화와 아티스트별 토론을 통해 컴백 사이에도 팬덤 활동이 이어집니다."],
      ["HYPERSYNC 라디오", "아티스트, 시대, 씬, 지역을 넘나들도록 편성한 24시간 방송이자 자체 미디어입니다."],
      ["커머스와 다이렉트 액세스", "파트너 기능을 통해 공식 게시물, 메시지, 상품 등 아티스트가 관리하는 경험으로 팬을 연결합니다."]
    ],
    partnerHead: "커버되는 아티스트에서 공식 참여자로",
    partnerSub: "HYPERSYNC는 이미 네트워크 전반에서 아티스트 관련 공개 정보를 수집하고 정리하고 있을 수 있습니다. 파트너십은 아티스트와 승인된 팀에게 그 존재를 직접 운영할 권한을 드립니다.",
    partnership: [
      ["공식 관리 권한", "프로필 정보와 승인된 아티스트 정보를 직접 관리합니다."],
      ["직접 게시", "소식, 미디어, 공지를 팬에게 바로 게시합니다."],
      ["팬 접점", "아티스트 토론과 직접 소통 기능에 참여합니다."],
      ["커머셜 액세스", "마켓플레이스, 메시징, 수익화 기능을 계정에서 사용 가능해지는 시점부터 이용합니다."],
      ["미디어 참여", "HYPERSYNC 라디오와 네트워크 편성 기회에 함께합니다."],
      ["발견 노출", "기존 팬뿐 아니라 다른 아티스트와 씬을 통해 들어온 이용자에게도 노출됩니다."]
    ],
    discoveryHead: "이미 함께하는 팬, 그리고 아직 만나지 못한 팬",
    discoveryBody: "HYPERSYNC는 아티스트가 발견될 수 있는 접점을 늘리도록 설계되었습니다. K-pop 팬이 P-pop을 접하고, P-pop 팬이 카자흐 랩을 찾고, 일본 음악 팬이 호주 아티스트에 닿습니다. 목표는 여러 씬을 하나의 장르로 묶는 것이 아니라, 그 경계를 더 쉽게 넘도록 만드는 것입니다.",
    systemHead: "계속 움직이는 네트워크",
    systemBody: "공개된 화면 뒤에서 HYPERSYNC는 엔터테인먼트 뉴스를 정리하고, 아티스트 활동을 확인하고, 일정을 유지하고, 선별된 지표를 갱신하며, 아티스트 정보를 동기화하는 시스템을 상시 운영합니다. 반복되는 유지 작업은 자동화가 맡고, 정확성이 중요한 부분에는 검증과 편집 관리를 유지합니다.",
    systemBold: "파트너 입장에서는, 아티스트의 활동이 바뀔 때마다 누군가 페이지를 수동으로 다시 만들 필요가 없다는 뜻입니다.",
    termsHead: "플랫폼 임대료 없는 파트너십",
    terms: [
      ["플랫폼 구독료 없음", "공식 파트너 지위를 유지하기 위한 정기 비용이 없습니다."],
      ["유료 메시지 수익의 90%는 아티스트에게", "유료 메시지를 운영하는 경우 아티스트가 90%를 가져가고 HYPERSYNC가 10%를 보유합니다."],
      ["마켓플레이스 수수료 없음", "HYPERSYNC가 아티스트 자체 스토어로 팬을 연결하는 경우, 상품 수익은 전액 판매자에게 귀속됩니다."],
      ["콘텐츠 의무 없음", "이용 시점과 방식은 파트너가 정합니다. 공식 지위 유지를 위한 게시 일정은 요구하지 않습니다."]
    ],
    onboardHead: "파트너십 진행 절차",
    onboarding: [
      ["파트너십 문의", "아티스트, 레이블, 기획사 또는 권한 있는 담당자가 연락합니다."],
      ["확인", "HYPERSYNC가 대리 권한과 아티스트의 공식 계정을 확인합니다."],
      ["파트너 권한 부여", "승인된 팀이 아티스트 전용 워크스페이스와 사용 가능한 관리 기능을 받습니다."],
      ["공식 전환", "해당 아티스트가 HYPERSYNC 네트워크의 공식 참여자가 됩니다."]
    ],
    finalA: "소속 아티스트를",
    finalB: "HYPERSYNC로",
    finalBody: "HYPERSYNC는 아티스트 발견과 협업을 위해 만든 글로벌 네트워크에 귀사 팀을 연결합니다.",
    formName: "성함",
    formOrg: "기획사, 레이블 또는 매니지먼트",
    formArtist: "아티스트 또는 로스터",
    formEmail: "이메일",
    formMessage: "문의 내용",
    tagline: "TUNE IN TO EVERYTHING",
  },

  ja: {
    lang: "日本語",
    eyebrow: "アーティスト、レーベル、事務所、マネジメントの皆様へ",
    heroA: "動き続ける音楽ネットワークの中に",
    heroB: "アーティストを",
    heroSub: "HYPERSYNCは、アーティスト情報、ニュース、スケジュール、リリース、コミュニティ、ラジオ、ファンとの直接的な接点をひとつのネットワークにまとめ、継続的に同期します。アジアの音楽を軸にしながら、グローバルな発見にも開かれています。",
    ctaPrimary: "HYPERSYNCパートナーに申し込む",
    ctaSecondary: "HYPERSYNCを見る",
    whyHead: "ひと組のアーティストが、シーン全体への入り口になります",
    whyBody: "ファンは地域で音楽を見つけるわけではありません。きっかけは好奇心です。あるアーティストのニュースやツアー日程、最新の投稿を見に来たファンが、名前も知らなかったアーティストに出会い、クリックし、聴き、読み、フォローして、そのまま留まります。",
    whyBold: "これがHYPERSYNCの発見のループです。馴染みのあるアーティストがファンを呼び込み、ネットワークが次の出会いを差し出します。",
    networkHead: "アーティストページ以上のものを",
    network: [
      ["アーティストハブ", "アーティスト情報、公式リンク、ニュース、活動、投稿、ディスカッション、ファンとの接点が集まる常設の拠点です。"],
      ["ニュースと活動", "エンターテインメントニュース、リリース、出演、コンサート、ツアー活動を、アーティストごとのタイムラインとして整理し続けます。"],
      ["ディスカバリー", "他のシーンや市場のアーティストと並んで表示され、検索だけでは生まれないファンダム間の露出が生まれます。"],
      ["コミュニティ", "ネットワーク全体の会話とアーティスト別のディスカッションにより、リリースの合間もファンダムが動き続けます。"],
      ["HYPERSYNC RADIO", "アーティスト、時代、シーン、地域を横断するように編成した24時間放送であり、自社メディアです。"],
      ["コマースとダイレクトアクセス", "パートナー向け機能で、公式投稿、メッセージ、グッズなどアーティスト側が管理する体験へファンをつなぎます。"]
    ],
    partnerHead: "掲載されるアーティストから、公式な参加者へ",
    partnerSub: "HYPERSYNCはすでに、ネットワーク全体でアーティストに関する公開情報を集めて整理している場合があります。パートナーシップは、アーティストと承認されたチームに、その存在を自ら運用する権限をもたらします。",
    partnership: [
      ["公式な管理権限", "プロフィール情報と承認済みのアーティスト情報を管理します。"],
      ["ダイレクト配信", "最新情報、メディア、告知をファンへ直接投稿します。"],
      ["ファンとの接点", "アーティストのディスカッションや直接的な交流機能に参加します。"],
      ["コマース機能", "マーケットプレイス、メッセージ、収益化ツールを、アカウントで利用可能になり次第ご利用いただけます。"],
      ["メディア参加", "HYPERSYNC RADIOやネットワーク編成の機会と連携します。"],
      ["発見される導線", "既存のファンだけでなく、他のアーティストやシーンから入ってきた人にも表示されます。"]
    ],
    discoveryHead: "すでにいるファンと、まだ出会っていないファン",
    discoveryBody: "HYPERSYNCは、アーティストが見つかる場所の数を増やすように設計しています。K-POPのファンがP-POPに出会い、P-POPのファンがカザフのラップを見つけ、日本の音楽ファンがオーストラリアのアーティストにたどり着きます。目的はシーンをひとつのジャンルにまとめることではありません。その境界を越えやすくすることです。",
    systemHead: "動き続けるネットワーク",
    systemBody: "公開されている画面の裏側で、HYPERSYNCはエンターテインメントニュースの整理、アーティスト活動の確認、スケジュールの維持、指標の更新、アーティスト情報の同期を行うシステムを常時動かしています。繰り返しの保守は自動化が担い、正確さが求められる部分には確認と編集の管理を残しています。",
    systemBold: "パートナーにとっては、アーティストの動きに合わせて誰かが毎回ページを作り直す必要がない、ということです。",
    termsHead: "プラットフォーム利用料のないパートナーシップ",
    terms: [
      ["月額利用料なし", "公式パートナーとしての掲載を維持するための継続費用はありません。"],
      ["有料メッセージ収益の90%をアーティストへ", "有料メッセージを運用する場合、アーティストが90%を受け取り、HYPERSYNCは10%を保持します。"],
      ["マーケットプレイス手数料なし", "HYPERSYNCがアーティスト自身のストアへファンを案内する場合、物販収益は全額販売者のものです。"],
      ["投稿ノルマなし", "利用の時期と方法はパートナーが決めます。公式である条件として投稿頻度を求めることはありません。"]
    ],
    onboardHead: "パートナーシップの進め方",
    onboarding: [
      ["お問い合わせ", "アーティスト、レーベル、事務所、または権限のあるご担当者からご連絡ください。"],
      ["確認", "HYPERSYNCが代理権限とアーティストの公式アカウントを確認します。"],
      ["パートナー権限の付与", "承認されたチームに、アーティスト側のワークスペースと利用可能な管理機能をお渡しします。"],
      ["公式化", "そのアーティストがHYPERSYNCネットワークの公式な参加者になります。"]
    ],
    finalA: "所属アーティストを",
    finalB: "HYPERSYNCへ",
    finalBody: "HYPERSYNCは、アーティストの発見とコラボレーションのために作られたグローバルネットワークに、あなたのチームをつなぎます。",
    formName: "お名前",
    formOrg: "事務所、レーベルまたはマネジメント",
    formArtist: "アーティスト名またはロスター",
    formEmail: "メールアドレス",
    formMessage: "ご用件",
    tagline: "TUNE IN TO EVERYTHING",
  },
}

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
  const [lang, setLang] = useState('en')
  const t = COPY[lang]

  return (
    <div>
      {/* language toggle */}
      <div className="wrap" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
        <div style={{ display: 'flex', gap: 3, border: '1px solid var(--line)', borderRadius: 999, padding: 3 }}>
          {Object.keys(COPY).map(k => (
            <button key={k} onClick={() => setLang(k)} style={{
              padding: '6px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em',
              background: lang === k ? 'var(--volt)' : 'transparent',
              color: lang === k ? '#14120A' : 'var(--dim)',
            }}>{COPY[k].lang}</button>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="wrap" style={{ padding: 'clamp(34px, 7vw, 90px) 0 clamp(36px, 6vw, 70px)' }}>
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <h1 className="display" style={{
          fontSize: 'clamp(2.1rem, 7vw, 4.6rem)', lineHeight: 1.03, maxWidth: 1000,
        }}>
          {t.heroA}<span className="volt-text">{t.heroB}</span>
        </h1>
        <p style={{
          color: 'var(--dim)', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
          lineHeight: 1.75, maxWidth: 760, marginTop: 26,
        }}>{t.heroSub}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 34 }}>
          <a href="#partner" className="btn btn--volt" style={{ padding: '13px 26px' }}>{t.ctaPrimary}</a>
          <Link to="/artists" className="btn" style={{ border: '1px solid var(--line)', padding: '13px 26px' }}>
            {t.ctaSecondary}
          </Link>
        </div>
      </section>

      <hr style={{ height: 1, background: 'var(--line)', border: 0, margin: 0 }} />

      {/* WHY */}
      <section className="wrap section">
        <div style={{
          display: 'grid', gap: 'clamp(24px, 5vw, 64px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 380px), 1fr))',
          alignItems: 'start',
        }}>
          <SectionHead>{t.whyHead}</SectionHead>
          <div style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85 }}>
            <p style={{ marginBottom: 18 }}>{t.whyBody}</p>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>{t.whyBold}</p>
          </div>
        </div>
      </section>

      {/* NETWORK */}
      <section className="wrap section">
        <SectionHead>{t.networkHead}</SectionHead>
        <div style={{
          display: 'grid', gap: 1, background: 'var(--line)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 300px), 1fr))',
        }}>
          {t.network.map(([title, bodyText]) => (
            <div key={title} style={{ background: 'var(--ink, #0C0C11)', padding: 'clamp(22px, 3vw, 32px)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', marginBottom: 10 }}>{title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--dim)', lineHeight: 1.7 }}>{bodyText}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PARTNERSHIP */}
      <section className="wrap section">
        <SectionHead sub={t.partnerSub}>{t.partnerHead}</SectionHead>
        <div style={{ display: 'grid', maxWidth: 880 }}>
          {t.partnership.map(([title, bodyText], i) => (
            <div key={title} style={{
              display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr',
              gap: 'clamp(14px, 3vw, 40px)', padding: '20px 0',
              borderTop: i === 0 ? '1px solid var(--line)' : 'none',
              borderBottom: '1px solid var(--line)',
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--volt)' }}>{title}</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--dim)', lineHeight: 1.7 }}>{bodyText}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DISCOVERY */}
      <section className="wrap section">
        <div className="card" style={{ padding: 'clamp(28px, 5vw, 60px)' }}>
          <SectionHead>{t.discoveryHead}</SectionHead>
          <p style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85, maxWidth: 780 }}>
            {t.discoveryBody}
          </p>
        </div>
      </section>

      {/* SYSTEM */}
      <section className="wrap section">
        <div style={{
          display: 'grid', gap: 'clamp(24px, 5vw, 64px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 380px), 1fr))',
          alignItems: 'start',
        }}>
          <SectionHead>{t.systemHead}</SectionHead>
          <div style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85 }}>
            <p style={{ marginBottom: 18 }}>{t.systemBody}</p>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>{t.systemBold}</p>
          </div>
        </div>
      </section>

      {/* TERMS */}
      <section className="wrap section">
        <SectionHead>{t.termsHead}</SectionHead>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 330px), 1fr))',
        }}>
          {t.terms.map(([title, bodyText]) => (
            <div key={title} className="card" style={{ padding: 'clamp(20px, 3vw, 28px)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: 10, lineHeight: 1.4 }}>{title}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--dim)', lineHeight: 1.7 }}>{bodyText}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ONBOARDING */}
      <section className="wrap section">
        <SectionHead>{t.onboardHead}</SectionHead>
        <div style={{
          display: 'grid', gap: 1, background: 'var(--line)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(90vw, 240px), 1fr))',
        }}>
          {t.onboarding.map(([title, bodyText], i) => (
            <div key={title} style={{ background: 'var(--ink, #0C0C11)', padding: 'clamp(22px, 3vw, 30px)' }}>
              <div className="display" style={{ fontSize: '1.6rem', color: 'var(--volt)', marginBottom: 12 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--dim)', lineHeight: 1.7 }}>{bodyText}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL */}
      <section className="wrap section" id="partner">
        <div className="card" style={{
          padding: 'clamp(34px, 6vw, 72px)', textAlign: 'center',
          border: '1px solid rgba(255,212,0,0.28)',
        }}>
          <h2 className="display" style={{
            fontSize: 'clamp(1.8rem, 5.5vw, 3.4rem)', lineHeight: 1.05, marginBottom: 20,
          }}>
            {t.finalA}<span className="volt-text">{t.finalB}</span>
          </h2>
          <p style={{
            color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.8,
            maxWidth: 620, margin: '0 auto 30px',
          }}>{t.finalBody}</p>

          <form name="partners" method="POST" data-netlify="true" netlify-honeypot="company-website"
            style={{ display: 'grid', gap: 12, maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
            <input type="hidden" name="form-name" value="partners" />
            <p style={{ display: 'none' }}>
              <label>Leave blank: <input name="company-website" /></label>
            </p>
            <input name="name" required placeholder={t.formName} style={inputStyle} />
            <input name="organization" required placeholder={t.formOrg} style={inputStyle} />
            <input name="artist" required placeholder={t.formArtist} style={inputStyle} />
            <input name="email" type="email" required placeholder={t.formEmail} style={inputStyle} />
            <textarea name="message" rows={4} placeholder={t.formMessage} style={{ ...inputStyle, resize: 'vertical' }} />
            <button type="submit" className="btn btn--volt" style={{ width: '100%', padding: '14px' }}>
              {t.ctaPrimary}
            </button>
          </form>

          <p style={{ marginTop: 26, fontSize: '0.8rem', color: 'var(--faint)', letterSpacing: '0.06em' }}>
            {t.tagline}
          </p>
        </div>
      </section>
    </div>
  )
}
