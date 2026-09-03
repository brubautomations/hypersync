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
    heroA: "BUILD YOUR ARTIST'S HYPERSYNC PRESENCE ",
    heroB: "FROM DAY ONE",
    heroSub: "HYPERSYNC is an early-stage Asian music discovery and fan platform with a working core for artist identity, continuously updated news, schedules and cross-scene discovery. We are opening a small number of launch partnerships with teams that want to shape the artist experience with us.",
    ctaPrimary: "Discuss a launch partnership",
    ctaSecondary: "Explore HYPERSYNC",
    whyHead: "FAMILIARITY IS THE ENTRANCE. DISCOVERY IS THE DESTINATION.",
    whyBody: "Fans usually arrive with one artist in mind. HYPERSYNC is being built so that a news check, schedule lookup or artist page can become the start of a journey into another artist, another scene or another market.",
    whyBold: "The goal is simple: increase the number of moments in which an artist can be discovered without flattening different music scenes into one.",
    networkHead: "THE WORKING CORE",
    networkSub: "These are the systems and experiences HYPERSYNC can demonstrate today.",
    network: [
      ["Artist Hubs", "Structured artist pages bring identity, official links, activity and continuously maintained information into one place."],
      ["News Aggregation", "HYPERSYNC collects entertainment coverage, filters it for relevance and connects it to the right artists and markets."],
      ["Schedule Intelligence", "Recurring systems discover, verify, deduplicate and maintain concerts, releases, appearances and other artist activity."],
      ["Artist Data", "Artist details and selected public metrics are refreshed through recurring data workflows, with review controls where accuracy matters."],
      ["Cross-Scene Discovery", "The product is structured so one artist page, article or schedule check can lead naturally into another artist or scene."],
      ["Partner Workspace", "An artist-side workspace already supports official profile control and direct publishing. Additional partner tools are still being developed."]
    ],
    roadmapHead: "BUILDING NEXT",
    roadmapSub: "These are active development areas. We show them as roadmap, not as finished capabilities.",
    roadmap: [
      ["Payments and Commerce", "Payment-gateway integration and partner commerce workflows for artist-controlled sales and transactions."],
      ["Paid Fan Interaction", "Direct paid messaging and related artist-to-fan monetization tools."],
      ["Streaming and Media", "Production streaming capability and deeper HYPERSYNC Radio and media integrations."],
      ["Partner Analytics", "Reporting for profile views, visitor geography, discovery paths, outbound clicks and engagement signals."]
    ],
    partnerHead: "DON'T JUST JOIN HYPERSYNC. HELP SHAPE IT.",
    partnerSub: "HYPERSYNC is in an early-stage rollout. Instead of onboarding hundreds of artists at once, we are looking for a small number of launch partners whose teams can help shape how official artist participation should work in practice.",
    partnership: [
      ["Official presence", "Take control of the artist's verified HYPERSYNC identity and approved information."],
      ["Direct publishing", "Publish approved updates and media directly through the artist-side workspace."],
      ["Product input", "Tell us what your team actually needs from artist tools, reporting, community and workflow."],
      ["Discovery presence", "Build the artist's presence inside HYPERSYNC's cross-scene discovery structure from an early stage."],
      ["Priority development", "Launch-partner needs can influence what HYPERSYNC prioritizes next."],
      ["Commercial options", "If your team wants specific functionality accelerated, custom integrations or a larger implementation, we can scope sponsored development or a commercial engagement separately."]
    ],
    discoveryHead: "YOUR NEXT FAN MAY BE SOMEONE ELSE'S FAN TODAY",
    discoveryBody: "HYPERSYNC is designed around movement between scenes. A K-pop fan can encounter P-pop. A P-pop fan can discover Kazakh rap. A Japanese music fan can end up exploring an Australian act. The point is not to blend these scenes into one genre. It is to create more paths between them.",
    systemHead: "ALWAYS CURRENT WITHOUT THE BUSYWORK",
    systemBody: "Behind the public experience, HYPERSYNC runs recurring systems that organize entertainment news, monitor artist activity, maintain schedules, refresh selected artist data and keep profiles synchronized. Automation handles repetitive maintenance; verification and editorial controls stay where accuracy matters.",
    systemBold: "The goal is simple: partner teams should not have to rebuild the same information by hand every time an artist moves.",
    termsHead: "START SMALL. PROVE VALUE. BUILD FROM THERE.",
    terms: [
      ["No recurring platform fee during the pilot", "Launch partners can evaluate the current HYPERSYNC experience without a recurring platform subscription during the agreed pilot."],
      ["No content quota", "Your team decides how actively it participates. There is no posting requirement simply to remain part of the pilot."],
      ["Works alongside existing channels", "HYPERSYNC can complement your website, social accounts, fan community and other infrastructure rather than replace them."],
      ["Custom development scoped separately", "If you want specific features accelerated or built for your project, scope, timeline and commercial terms are agreed separately."]
    ],
    onboardHead: "HOW A LAUNCH PARTNERSHIP WORKS",
    onboarding: [
      ["Talk", "Tell us about the artist or project and what your team wants from a fan platform."],
      ["Demo", "We show you what HYPERSYNC can do today and what is still being built."],
      ["Define the pilot", "Together we choose the current features that matter and identify any partner-specific development."],
      ["Build together", "Your artist receives an official HYPERSYNC presence while feedback from the pilot helps shape the platform."]
    ],
    finalA: "BUILD WHAT COMES NEXT WITH ",
    finalB: "HYPERSYNC",
    finalBody: "We are looking for a small number of artists, labels and agencies willing to explore HYPERSYNC early — not only as users, but as launch partners helping shape the artist and fan experience.",
    formName: "Name",
    formOrg: "Agency, label or management",
    formArtist: "Artist or project",
    formEmail: "Email",
    formMessage: "Message",
    tagline: "TUNE IN TO EVERYTHING",
  },

  ko: {
    lang: "한국어",
    eyebrow: "아티스트, 레이블, 기획사, 매니지먼트를 위한 안내",
    heroA: "아티스트의 HYPERSYNC 여정을 ",
    heroB: "첫날부터 시작하세요",
    heroSub: "HYPERSYNC는 아시아 음악을 중심으로 한 초기 단계의 음악 디스커버리·팬 플랫폼입니다. 아티스트 정보, 뉴스, 일정, 씬 간 발견을 지속적으로 업데이트하는 핵심 시스템은 이미 작동하고 있습니다. 지금은 아티스트 경험을 함께 만들어갈 소수의 초기 파트너를 찾고 있습니다.",
    ctaPrimary: "초기 파트너십 논의하기",
    ctaSecondary: "HYPERSYNC 둘러보기",
    whyHead: "익숙한 아티스트에서 시작해, 새로운 발견으로 이어집니다",
    whyBody: "팬은 보통 이미 알고 있는 한 아티스트를 찾아옵니다. HYPERSYNC는 뉴스 확인, 일정 조회, 아티스트 페이지 방문이 다른 아티스트와 다른 씬, 다른 시장으로 이어지도록 설계되고 있습니다.",
    whyBold: "목표는 단순합니다. 서로 다른 음악 씬을 하나로 섞지 않으면서도, 아티스트가 발견되는 순간을 더 많이 만드는 것입니다.",
    networkHead: "지금 작동하는 핵심 기능",
    networkSub: "아래 기능과 시스템은 현재 HYPERSYNC에서 직접 확인할 수 있습니다.",
    network: [
      ["아티스트 허브", "아티스트 정보, 공식 링크, 활동, 지속적으로 관리되는 공개 정보를 한곳에 정리합니다."],
      ["뉴스 집계", "엔터테인먼트 기사를 수집하고 관련성을 확인한 뒤, 적절한 아티스트와 시장에 연결합니다."],
      ["일정 인텔리전스", "콘서트, 발매, 출연 등 아티스트 활동을 반복적으로 탐색·검증·중복 정리·유지합니다."],
      ["아티스트 데이터", "아티스트 상세 정보와 일부 공개 지표를 반복적으로 갱신하며, 정확성이 중요한 항목에는 검토 절차를 둡니다."],
      ["씬 간 디스커버리", "한 아티스트 페이지나 기사, 일정 확인이 다른 아티스트와 다른 음악 씬으로 자연스럽게 이어지도록 구조화되어 있습니다."],
      ["파트너 워크스페이스", "아티스트 측 워크스페이스에서 공식 프로필 관리와 직접 게시를 지원합니다. 추가 파트너 기능은 계속 개발 중입니다."]
    ],
    roadmapHead: "다음 단계로 만들고 있는 것",
    roadmapSub: "아래 항목은 현재 개발 중인 영역입니다.",
    roadmap: [
      ["결제·커머스", "결제 게이트웨이와 파트너 커머스 흐름을 개발하고 있습니다."],
      ["유료 팬 소통", "아티스트와 팬의 유료 직접 소통 및 관련 수익화 기능을 개발하고 있습니다."],
      ["스트리밍·미디어", "프로덕션 스트리밍과 HYPERSYNC RADIO를 포함한 미디어 연동을 확장하고 있습니다."],
      ["파트너 분석", "프로필 조회, 방문 국가, 디스커버리 경로, 외부 링크 클릭, 참여도 등을 보여주는 리포팅을 개발하고 있습니다."]
    ],
    partnerHead: "단순히 참여하는 파트너가 아니라, 함께 만드는 파트너를 찾습니다",
    partnerSub: "HYPERSYNC는 현재 초기 롤아웃 단계입니다. 한꺼번에 수백 팀을 받기보다, 실제 현장에서 필요한 공식 아티스트 경험을 함께 설계할 소수의 초기 파트너와 먼저 시작하려 합니다.",
    partnership: [
      ["공식 프로필 운영", "검증된 HYPERSYNC 아티스트 프로필과 승인된 정보를 직접 관리합니다."],
      ["직접 게시", "승인된 소식과 미디어를 아티스트 전용 워크스페이스에서 직접 게시합니다."],
      ["제품 피드백", "아티스트 도구, 리포팅, 커뮤니티, 업무 흐름에서 실제로 필요한 기능을 알려주세요."],
      ["초기 디스커버리 참여", "HYPERSYNC의 씬 간 디스커버리 구조 안에서 아티스트의 존재를 초기부터 함께 구축합니다."],
      ["개발 우선순위 반영", "초기 파트너의 실제 요구는 HYPERSYNC의 다음 개발 우선순위에 반영될 수 있습니다."],
      ["확장 개발 옵션", "특정 기능의 빠른 개발, 커스텀 연동 또는 더 큰 규모의 구현이 필요하다면 별도의 스폰서 개발 또는 상업적 협업으로 범위를 논의할 수 있습니다."]
    ],
    discoveryHead: "다음 팬은 오늘, 다른 아티스트의 팬일 수 있습니다",
    discoveryBody: "HYPERSYNC는 서로 다른 음악 씬 사이의 이동을 전제로 설계되고 있습니다. K-pop 팬이 P-pop을 접하고, P-pop 팬이 카자흐 랩을 발견하고, 일본 음악 팬이 호주 아티스트까지 탐색할 수 있습니다. 목표는 여러 씬을 하나의 장르로 섞는 것이 아니라, 그 사이를 오갈 수 있는 길을 더 많이 만드는 것입니다.",
    systemHead: "반복 업무 없이, 계속 최신으로",
    systemBody: "공개된 화면 뒤에서 HYPERSYNC는 엔터테인먼트 뉴스를 정리하고, 아티스트 활동을 확인하고, 일정을 유지하고, 일부 아티스트 데이터를 갱신하며, 프로필 정보를 동기화하는 시스템을 반복적으로 운영합니다. 반복 유지 작업은 자동화가 맡고, 정확성이 중요한 부분에는 검증과 편집 관리를 유지합니다.",
    systemBold: "목표는 단순합니다. 아티스트가 움직일 때마다 파트너 팀이 같은 정보를 매번 손으로 다시 만들 필요가 없도록 하는 것입니다.",
    termsHead: "작게 시작하고, 가치를 확인한 뒤, 함께 키웁니다",
    terms: [
      ["파일럿 기간 정기 플랫폼 이용료 없음", "합의된 파일럿 기간 동안 현재 HYPERSYNC를 정기 플랫폼 구독료 없이 평가할 수 있습니다."],
      ["콘텐츠 의무 없음", "참여 방식과 빈도는 파트너가 정합니다. 파일럿 참여를 유지하기 위한 게시 의무는 없습니다."],
      ["기존 채널과 병행 가능", "웹사이트, SNS, 팬 커뮤니티 등 기존 인프라를 대체할 필요 없이 함께 운영할 수 있습니다."],
      ["커스텀 개발은 별도 협의", "특정 기능의 우선 개발이나 프로젝트 전용 기능이 필요할 경우 범위, 일정, 상업 조건을 별도로 협의합니다."]
    ],
    onboardHead: "초기 파트너십 진행 방식",
    onboarding: [
      ["이야기 나누기", "아티스트 또는 프로젝트와 팬 플랫폼에서 원하는 것을 알려주세요."],
      ["데모", "현재 HYPERSYNC에서 가능한 것과 아직 개발 중인 것을 그대로 보여드립니다."],
      ["파일럿 정의", "어떤 현재 기능이 필요한지 정하고, 파트너 전용 개발이 필요한지도 함께 확인합니다."],
      ["함께 구축", "아티스트의 공식 HYPERSYNC 존재를 만들고, 파일럿 피드백을 제품에 반영합니다."]
    ],
    finalA: "다음 팬 경험을 ",
    finalB: "HYPERSYNC와 함께 만드세요",
    finalBody: "HYPERSYNC를 단순히 사용하는 것이 아니라, 아티스트와 팬 경험을 함께 만들어갈 소수의 아티스트, 레이블, 기획사를 찾고 있습니다.",
    formName: "성함",
    formOrg: "기획사, 레이블 또는 매니지먼트",
    formArtist: "아티스트 또는 프로젝트",
    formEmail: "이메일",
    formMessage: "문의 내용",
    tagline: "TUNE IN TO EVERYTHING",
  },

  ja: {
    lang: "日本語",
    eyebrow: "アーティスト、レーベル、事務所、マネジメントの皆様へ",
    heroA: "アーティストの公式な拠点を、",
    heroB: "HYPERSYNCで初日から",
    heroSub: "HYPERSYNCは、アジアの音楽を軸にした初期段階の音楽ディスカバリー／ファンプラットフォームです。アーティスト情報、ニュース、スケジュール、シーンをまたぐ発見を継続的に更新する中核システムはすでに稼働しています。現在、アーティスト体験を一緒に形にしていく少数のローンチパートナーを募集しています。",
    ctaPrimary: "ローンチパートナーシップを相談する",
    ctaSecondary: "HYPERSYNCを見る",
    whyHead: "知っているアーティストが入口になり、次の発見につながる",
    whyBody: "ファンは通常、すでに知っているひと組のアーティストを目的に訪れます。HYPERSYNCは、ニュースの確認、スケジュールのチェック、アーティストページの閲覧が、別のアーティスト、別のシーン、別の市場への入口になるよう設計しています。",
    whyBold: "目的はシンプルです。異なる音楽シーンをひとつに混ぜることなく、アーティストが発見されるきっかけを増やすことです。",
    networkHead: "いま動いている中核機能",
    networkSub: "以下は、現在のHYPERSYNCで実際にご覧いただける機能と仕組みです。",
    network: [
      ["アーティストハブ", "アーティスト情報、公式リンク、活動、継続的に更新される公開情報をひとつの場所にまとめます。"],
      ["ニュース集約", "エンターテインメント記事を収集し、関連性を確認したうえで、適切なアーティストや市場に紐づけます。"],
      ["スケジュール管理システム", "コンサート、リリース、出演などのアーティスト活動を継続的に検出・確認し、重複を整理しながら維持します。"],
      ["アーティストデータ", "アーティスト情報と一部の公開指標を定期的に更新し、正確さが重要な項目には確認の仕組みを残しています。"],
      ["シーン横断ディスカバリー", "ひとつのアーティストページ、記事、スケジュール確認から、別のアーティストや音楽シーンへ自然につながる構造です。"],
      ["パートナーワークスペース", "アーティスト側のワークスペースでは、公式プロフィール管理と直接投稿をすでに利用できます。追加のパートナー機能は引き続き開発中です。"]
    ],
    roadmapHead: "次に開発しているもの",
    roadmapSub: "以下は現在開発中の領域です。",
    roadmap: [
      ["決済・コマース", "決済ゲートウェイと、パートナー向けのコマースフローを開発しています。"],
      ["有料ファンコミュニケーション", "アーティストとファンの有料ダイレクトコミュニケーションや関連する収益化機能を開発しています。"],
      ["ストリーミング・メディア", "本番運用のストリーミング機能と、HYPERSYNC RADIOを含むメディア連携を拡張しています。"],
      ["パートナー分析", "プロフィール閲覧、訪問地域、ディスカバリー経路、外部リンククリック、エンゲージメントなどを可視化するレポート機能を開発しています。"]
    ],
    partnerHead: "参加するだけでなく、一緒につくるパートナーへ",
    partnerSub: "HYPERSYNCは現在、初期ロールアウトの段階です。最初から何百組も受け入れるのではなく、公式アーティスト参加のあり方を実際の現場目線で一緒に形にしてくれる少数のローンチパートナーと始めたいと考えています。",
    partnership: [
      ["公式運用", "検証済みのHYPERSYNCアーティストプロフィールと承認された情報を直接管理します。"],
      ["ダイレクト投稿", "承認済みの最新情報やメディアを、アーティスト側のワークスペースから直接投稿します。"],
      ["プロダクトへの意見", "アーティスト向けツール、レポート、コミュニティ、運用フローに本当に必要なものを教えてください。"],
      ["ディスカバリー参加", "HYPERSYNCのシーン横断ディスカバリー構造の中で、アーティストの存在を早い段階から一緒につくります。"],
      ["開発優先度への反映", "ローンチパートナーの実際のニーズは、HYPERSYNCの次の開発優先度に反映される可能性があります。"],
      ["拡張開発オプション", "特定機能の優先開発、カスタム連携、より大きな実装が必要な場合は、スポンサー型の開発や商用案件として別途スコープを相談できます。"]
    ],
    discoveryHead: "次のファンは、今日まだ別のアーティストのファンかもしれない",
    discoveryBody: "HYPERSYNCは、異なる音楽シーンの間をファンが移動できることを前提に設計しています。K-POPのファンがP-POPに出会い、P-POPのファンがカザフのラップを知り、日本の音楽ファンがオーストラリアのアーティストまでたどり着く。目的はシーンをひとつのジャンルに混ぜることではなく、その間にもっと多くの道をつくることです。",
    systemHead: "手間を増やさず、いつでも最新に",
    systemBody: "公開画面の裏側で、HYPERSYNCはエンターテインメントニュースの整理、アーティスト活動の確認、スケジュールの維持、一部のアーティストデータ更新、プロフィール情報の同期を繰り返し行っています。反復的な保守は自動化が担い、正確さが重要な部分には確認と編集の管理を残しています。",
    systemBold: "目指しているのはシンプルです。アーティストが動くたびに、パートナーチームが同じ情報を毎回手作業で作り直さなくていい状態です。",
    termsHead: "小さく始めて、価値を確かめ、そこから広げる",
    terms: [
      ["パイロット期間の月額利用料なし", "合意したパイロット期間中は、現在のHYPERSYNCを継続的なプラットフォーム利用料なしで評価できます。"],
      ["投稿ノルマなし", "参加の頻度や使い方はパートナーが決めます。パイロット参加を維持するための投稿義務はありません。"],
      ["既存チャネルと併用可能", "公式サイト、SNS、ファンコミュニティなど既存の仕組みを置き換える必要はなく、並行して利用できます。"],
      ["カスタム開発は別途相談", "特定機能の優先開発やプロジェクト専用機能が必要な場合は、範囲、スケジュール、商用条件を別途相談します。"]
    ],
    onboardHead: "ローンチパートナーシップの進め方",
    onboarding: [
      ["まず話す", "アーティストやプロジェクトについて、そしてファンプラットフォームに求めていることを教えてください。"],
      ["デモ", "HYPERSYNCで現在できることと、まだ開発中のことをそのままお見せします。"],
      ["パイロットを決める", "今ある機能の中で何が必要か、パートナー向けの追加開発が必要かを一緒に整理します。"],
      ["一緒につくる", "アーティストの公式HYPERSYNC拠点をつくり、パイロットから得たフィードバックをプロダクトに反映します。"]
    ],
    finalA: "次のファン体験を、",
    finalB: "HYPERSYNCと一緒につくる",
    finalBody: "HYPERSYNCを単に利用するのではなく、アーティストとファンの体験を一緒に形にしていく少数のアーティスト、レーベル、事務所を探しています。",
    formName: "お名前",
    formOrg: "事務所、レーベルまたはマネジメント",
    formArtist: "アーティスト名またはプロジェクト",
    formEmail: "メールアドレス",
    formMessage: "ご用件",
    tagline: "TUNE IN TO EVERYTHING",
  },
}

// Korean: never split a word across lines. Japanese: allow breaks but keep
// the line from ending on a single orphaned character.
const breakStyle = (lang) => (
  lang === 'ko' ? { wordBreak: 'keep-all', overflowWrap: 'break-word' }
  : lang === 'ja' ? { lineBreak: 'strict', overflowWrap: 'anywhere' }
  : {}
)

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

// Japanese headlines break between clauses, never inside one. Splitting on
// the ideographic comma keeps 〜へ and 〜なる attached to their own clause.
function JaHead({ text }) {
  const parts = String(text).split('、')
  return parts.map((p, i) => (
    <span key={i} style={{ whiteSpace: 'nowrap' }}>
      {p}{i < parts.length - 1 ? '、' : ''}
    </span>
  ))
}

// English headlines: bind the final two words so a line never ends on a
// single orphaned word.
function EnHead({ text }) {
  const w = String(text).trim().split(' ')
  if (w.length < 3) return text
  const head = w.slice(0, -2).join(' ')
  const tail = w.slice(-2).join('\u00A0')
  return `${head} ${tail}`
}

function SectionHead({ children, sub, lang }) {
  return (
    <>
      <h2 className="display" style={{
        fontSize: 'clamp(1.6rem, 4.5vw, 2.8rem)', lineHeight: 1.08,
        maxWidth: 900, marginBottom: sub ? 16 : 28,
        ...breakStyle(lang),
      }}>{
        lang === 'ja' && typeof children === 'string' ? <JaHead text={children} />
        : lang === 'en' && typeof children === 'string' ? EnHead({ text: children })
        : children
      }</h2>
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
          ...breakStyle(lang),
        }}>
          {lang === 'ja' ? <JaHead text={t.heroA} /> : t.heroA}
          {lang === 'en' ? null : <br />}
          <span className="volt-text" style={lang === 'ja' ? { whiteSpace: 'nowrap' } : undefined}>{t.heroB}</span>
        </h1>
        <p style={{
          color: 'var(--dim)', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
          lineHeight: 1.75, maxWidth: 760, marginTop: 26, ...breakStyle(lang),
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
          <SectionHead lang={lang}>{t.whyHead}</SectionHead>
          <div style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85 }}>
            <p style={{ marginBottom: 18 }}>{t.whyBody}</p>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>{t.whyBold}</p>
          </div>
        </div>
      </section>

      {/* WORKING CORE */}
      <section className="wrap section">
        <SectionHead lang={lang} sub={t.networkSub}>{t.networkHead}</SectionHead>
        <div style={{
          display: 'grid', gap: 1, background: 'var(--line)',
          gridTemplateColumns: 'repeat(3, 1fr)',
        }} className="grid-3">
          {t.network.map(([title, bodyText]) => (
            <div key={title} style={{ background: 'var(--ink, #0C0C11)', padding: 'clamp(22px, 3vw, 32px)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', marginBottom: 10 }}>{title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--dim)', lineHeight: 1.7 }}>{bodyText}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ROADMAP */}
      <section className="wrap section">
        <SectionHead lang={lang} sub={t.roadmapSub}>{t.roadmapHead}</SectionHead>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(2, 1fr)',
        }} className="grid-2">
          {t.roadmap.map(([title, bodyText]) => (
            <div key={title} className="card" style={{ padding: 'clamp(20px, 3vw, 28px)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: 10, lineHeight: 1.4 }}>{title}</div>
              <div style={{ fontSize: '0.84rem', color: 'var(--dim)', lineHeight: 1.7 }}>{bodyText}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PARTNERSHIP */}
      <section className="wrap section">
        <SectionHead lang={lang} sub={t.partnerSub}>{t.partnerHead}</SectionHead>
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
          <SectionHead lang={lang}>{t.discoveryHead}</SectionHead>
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
          <SectionHead lang={lang}>{t.systemHead}</SectionHead>
          <div style={{ color: 'var(--dim)', fontSize: '0.95rem', lineHeight: 1.85 }}>
            <p style={{ marginBottom: 18 }}>{t.systemBody}</p>
            <p style={{ color: 'var(--text)', fontWeight: 600 }}>{t.systemBold}</p>
          </div>
        </div>
      </section>

      {/* PILOT */}
      <section className="wrap section">
        <SectionHead lang={lang}>{t.termsHead}</SectionHead>
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(2, 1fr)',
        }} className="grid-2">
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
        <SectionHead lang={lang}>{t.onboardHead}</SectionHead>
        <div style={{
          display: 'grid', gap: 1, background: 'var(--line)',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }} className="grid-4">
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
            ...breakStyle(lang),
          }}>
            {t.finalA}<span className="volt-text" style={lang === 'ja' ? { whiteSpace: 'nowrap' } : undefined}>{t.finalB}</span>
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
      <style>{`
        @media (max-width: 900px) {
          .grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
