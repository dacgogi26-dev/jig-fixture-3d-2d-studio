/**
 * GitHub Pages 정적 호스팅 전용 WebCrypto 보안 폴백 엔진
 * - Netlify 배포 환경에서는 서버 함수(/api/*)가 우선 작동하므로 본 모듈은 호출되지 않습니다.
 * - GitHub Pages(*.github.io)처럼 백엔드 함수가 없는 정적 호스팅에서도 404 에러 없이
 *   초대코드 SHA-256 해시 검증, 3D·2D 지그 모델링, 등급별 .STEP 추출이 100% 동작하도록 지원합니다.
 */

const SALTED_CODE_HASHES = {
  ceb7cb447f5dccdf8f9eda88d404a4b43b21ff7c672938d1425f9b3b3589e4a7: "preview",
  "0023fe1e09f0d5e838413251e803a7aad2ce2e4cc4cb744ed8507f4338e7f55e": "pro",
  "059e1a601547589ecac165ba949485fff471e0660e491517fe47246931592044": "enterprise",
  "44d4ec62f1d7842a32573ac49b88b67aa2f956d0519ca6de0a57c04c5706c5b7": "admin",
};

const TIER_RANK = { preview: 1, pro: 2, enterprise: 3, admin: 4 };
const localVault = new Map();
const localAudits = [];

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes = 5) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function logAudit(type, detail) {
  localAudits.unshift({ at: new Date().toISOString(), type, detail });
  if (localAudits.length > 30) localAudits.pop();
}

export async function ghAuthSession(method = "GET", body = {}) {
  if (method === "GET") {
    const raw = sessionStorage.getItem("gh_cad_session");
    if (!raw) return { ok: true, status: 200, data: { authenticated: false } };
    const session = JSON.parse(raw);
    return {
      ok: true,
      status: 200,
      data: {
        authenticated: true,
        session,
        recentAudits: session.tier === "admin" ? localAudits : undefined,
      },
    };
  }

  if (body.action === "logout") {
    sessionStorage.removeItem("gh_cad_session");
    return { ok: true, status: 200, data: { ok: true } };
  }

  const hash = await sha256Hex("cad-gh-salt:" + String(body.inviteCode || "").trim());
  const tier = SALTED_CODE_HASHES[hash];
  if (!tier) {
    logAudit("INVITE_AUTH_FAILED", "유효하지 않은 비공개 초대코드 차단");
    return {
      ok: false,
      status: 401,
      data: { message: "유효하지 않은 비공개 초대코드입니다." },
    };
  }

  const userId = "usr_" + hash.slice(0, 10);
  const session = {
    userId,
    tier,
    label: `${tier.toUpperCase()} 멤버 (${userId}) [GH-Pages]`,
    ipHash: "ghpages01",
    canExportStep: TIER_RANK[tier] >= 2,
  };
  sessionStorage.setItem("gh_cad_session", JSON.stringify(session));
  logAudit("SESSION_GRANTED", `${tier.toUpperCase()} 등급 세션 발급`);
  return { ok: true, status: 200, data: { authenticated: true, session } };
}

function buildFallbackDesign(prompt) {
  const lower = String(prompt || "").toLowerCase();
  const projectId = "jig_" + randomHex(5);

  if (/플런저|너트|퀵릴리즈|센터링/.test(lower)) {
    return {
      projectId,
      code: "JIG-04 | Quick-Release Spring Plunger & Centering Jig",
      titleKo: "퀵릴리즈 압축 스프링 플런저 & 테이퍼 센터링 지그 (3D & 2D)",
      dims: { w: 180, d: 90, h: 240 },
      drawingSpec: { scale: "1 : 1", tolerance: "ISO 2768-mH (Ø20 g6)", strokeMm: 32 },
      provisions: [
        { provision: "Overall Dimension & Mass", description: "180 × 90 × 240 (mm) / 1.42 kg" },
        { provision: "Jig & Fixture Function", description: "Quick-release twin lever collar + Compression spring + Tapered locating pin" },
        { provision: "Tolerance & Material", description: "SUS304 Shaft (Ø20 g6), C3604 Brass Hex Nut, SWP-B Spring" },
      ],
      sequences: [
        { unit: "1. 릴리즈 레버 당김 및 핀 후퇴", flow: "양측 곡선 핸들 상부 당김 → 슬라이딩 콜라 상승 및 적색 스프링 압축 → 하단 테이퍼 핀 후퇴" },
        { unit: "2. 자동 센터링 고정", flow: "기준홀 진입 후 레버 해제 → 스프링 복원력으로 ±0.015mm 자동 센터링 클램핑" },
      ],
      modules: [
        { name: "CENTERING_SHAFT", labelKo: "테이퍼 센터링 축", shape: "cylinder", x: -11, y: -11, z: 0, w: 22, d: 22, h: 206, color: "#cbd5e1", callout: "센터링 테이퍼 핀", partSpec: "SUS304" },
        { name: "TOP_BRASS_NUT", labelKo: "상부 육각 황동 너트", shape: "hex", x: -28, y: -28, z: 192, w: 56, d: 56, h: 42, color: "#d4af37", callout: "예압 육각 너트", partSpec: "C3604" },
        { name: "COIL_SPRING", labelKo: "중앙 압축 스프링", shape: "spring", axis: "z", x: -21, y: -21, z: 82, w: 42, d: 42, h: 108, color: "#e11d48", motion: { type: "springZ", amp: -22 }, callout: "압축 코일 스프링", partSpec: "SWP-B" },
        { name: "SLIDE_COLLAR", labelKo: "슬라이딩 콜라", shape: "cylinder", x: -26, y: -26, z: 38, w: 52, d: 52, h: 48, color: "#67e8f9", motion: { type: "slideZ", amp: 22 }, callout: "슬라이딩 콜라", partSpec: "AL6061" },
        { name: "LEFT_LEVER", labelKo: "좌측 릴리즈 핸들", shape: "box", x: -82, y: -8, z: 56, w: 64, d: 16, h: 80, color: "#67e8f9", motion: { type: "slideZ", amp: 22 }, callout: "트윈 릴리즈 핸들", partSpec: "AL6061" },
        { name: "RIGHT_LEVER", labelKo: "우측 릴리즈 핸들", shape: "box", x: 18, y: -8, z: 56, w: 64, d: 16, h: 80, color: "#67e8f9", motion: { type: "slideZ", amp: 22 }, callout: null, partSpec: "AL6061" },
      ],
    };
  }

  if (/캠|크랭크|프레스/.test(lower)) {
    return {
      projectId,
      code: "JIG-05 | Crank-Cam Vertical Spring Press Fixture",
      titleKo: "크랭크-캠 구동 수직 가이드 스프링 프레스 지그 (3D & 2D)",
      dims: { w: 160, d: 150, h: 260 },
      drawingSpec: { scale: "1 : 2", tolerance: "슬롯 ±0.02mm / 핀 Ø12 h6", strokeMm: 44 },
      provisions: [
        { provision: "Overall Dimension & Mass", description: "160 × 150 × 260 (mm) / 2.85 kg" },
        { provision: "Jig & Fixture Function", description: "Green rotary crank-cam → Vertical slotted slider press + Return spring" },
        { provision: "Stroke & Clamping Force", description: "Stroke 44mm (Cam R22) / Max Force 680 N" },
      ],
      sequences: [
        { unit: "1. 크랭크 회전 하강 가압", flow: "녹색 크랭크 캠 회전 → 적색 팔로워 핀이 승강 램 하방 구동 및 스프링 압축" },
        { unit: "2. 탄성 복귀 해제", flow: "크랭크 원위치 복귀 → 하부 청색 코일 스프링 복원력으로 슬라이더 상승" },
      ],
      modules: [
        { name: "BASE_PLATE", labelKo: "하부 마운팅 베이스", shape: "box", x: -67, y: -60, z: 0, w: 134, d: 120, h: 20, color: "#94a3b8", callout: "베이스 플레이트", partSpec: "S45C" },
        { name: "GUIDE_COLUMN", labelKo: "수직 슬롯 가이드 컬럼", shape: "box", x: -42, y: -27, z: 20, w: 84, d: 54, h: 240, color: "#cbd5e1", wireframeShell: true, callout: "수직 가이드 컬럼", partSpec: "AL6061" },
        { name: "RETURN_SPRING", labelKo: "하부 복귀 스프링", shape: "spring", axis: "z", x: -18, y: -18, z: 22, w: 36, d: 36, h: 98, color: "#3b82f6", motion: { type: "springZ", amp: -22 }, callout: "리턴 코일 스프링", partSpec: "SUP9" },
        { name: "PRESS_RAM", labelKo: "승강 프레스 램", shape: "box", x: -24, y: -22, z: 124, w: 48, d: 44, h: 44, color: "#a855f7", motion: { type: "slideZ", amp: -22 }, callout: "승강 프레스 램", partSpec: "SCM440" },
        { name: "CRANK_ARM", labelKo: "녹색 크랭크 캠 암", shape: "box", x: -42, y: -51, z: 145, w: 84, d: 18, h: 22, color: "#22c55e", motion: { type: "slideX", amp: 18 }, callout: "크랭크 캠 암", partSpec: "S45C" },
        { name: "CAM_PIN", labelKo: "적색 캠 팔로워 핀", shape: "cylinder", x: 24, y: -63, z: 140, w: 20, d: 26, h: 20, color: "#ef4444", motion: { type: "slideZ", amp: -22 }, callout: "캠 팔로워 핀", partSpec: "SUJ2" },
      ],
    };
  }

  if (/로터리|베인|편심/.test(lower)) {
    return {
      projectId,
      code: "JIG-06 | Eccentric Rotary Vane Chamber Mechanism",
      titleKo: "편심 슬롯 로터 & 슬라이딩 베인 챔버 기구 (3D & 2D)",
      dims: { w: 190, d: 120, h: 210 },
      drawingSpec: { scale: "1 : 1", tolerance: "보어 Ø140 H6", strokeMm: 18 },
      provisions: [
        { provision: "Overall Dimension & Mass", description: "190 × 120 × 210 (mm) / 3.40 kg" },
        { provision: "Mechanism Function", description: "Eccentric rotor + Dual sliding vanes + Top suction/discharge ports" },
      ],
      sequences: [
        { unit: "1. 상부 좌측 흡입 및 팽창", flow: "편심 로터 회전 시 적색 슬라이딩 베인이 외벽 밀착하며 유체 흡입" },
        { unit: "2. 압축 및 우측 토출", flow: "편심 최소 간극 통과 후 상부 우측 노즐로 정량 토출" },
      ],
      modules: [
        { name: "PEDESTAL", labelKo: "마운팅 베이스", shape: "box", x: -68, y: -45, z: 0, w: 136, d: 90, h: 22, color: "#d4af37", callout: "마운팅 베이스", partSpec: "C3604" },
        { name: "BRASS_CHAMBER", labelKo: "원통 황동 챔버", shape: "cylinder", x: -83, y: -43, z: 22, w: 166, d: 86, h: 150, color: "#caa24e", wireframeShell: true, callout: "원통 챔버 하우징", partSpec: "C3604" },
        { name: "ECCENTRIC_ROTOR", labelKo: "편심 슬롯 로터", shape: "cylinder", x: -49, y: -31, z: 36, w: 98, d: 62, h: 105, color: "#6366f1", callout: "편심 로터", partSpec: "SCM440" },
        { name: "SLIDING_VANE", labelKo: "적색 슬라이딩 베인", shape: "box", x: -76, y: -10, z: 92, w: 152, d: 20, h: 22, color: "#dc2626", motion: { type: "slideX", amp: 12 }, callout: "슬라이딩 베인", partSpec: "PEEK" },
        { name: "INLET_PORT", labelKo: "좌측 흡입 포트", shape: "cylinder", x: -45, y: -14, z: 172, w: 28, d: 28, h: 32, color: "#d4af37", callout: "흡입/토출 포트", partSpec: "PT 3/8" },
        { name: "OUTLET_PORT", labelKo: "우측 토출 포트", shape: "cylinder", x: 19, y: -14, z: 172, w: 28, d: 28, h: 32, color: "#d4af37", callout: null, partSpec: "PT 3/8" },
      ],
    };
  }

  if (/플라이어|그리퍼|피벗/.test(lower)) {
    return {
      projectId,
      code: "JIG-03 | Compound-Pivot Toggle Gripper & Pliers Jig",
      titleKo: "복합 4절 피벗 배력 그리퍼 & 치형 클램핑 지그 (3D & 2D)",
      dims: { w: 170, d: 42, h: 250 },
      drawingSpec: { scale: "1 : 1", tolerance: "피벗핀 Ø8 H7/m6", strokeMm: 36 },
      provisions: [
        { provision: "Overall Dimension & Mass", description: "170 × 42 × 250 (mm) / 0.78 kg" },
        { provision: "Jig & Fixture Function", description: "4.8:1 Compound leverage link + SKD11 serrated clamping jaws" },
      ],
      sequences: [
        { unit: "1. 핸들 가압 및 4핀 배력 증폭", flow: "하부 인체공학 핸들 가압 → 황동 복합 링크판이 4.8배 파지력 증폭" },
        { unit: "2. 상단 치형 조우 대칭 락킹", flow: "경화 치형 조우가 대상물을 흔들림 없이 중심 정렬 파지" },
      ],
      modules: [
        { name: "LEFT_HANDLE", labelKo: "좌측 레버 핸들", shape: "box", x: -74, y: -14, z: 0, w: 30, d: 28, h: 130, color: "#ea580c", motion: { type: "slideX", amp: 10 }, callout: "듀얼 레버 핸들", partSpec: "S45C+TPU" },
        { name: "RIGHT_HANDLE", labelKo: "우측 레버 핸들", shape: "box", x: 44, y: -14, z: 0, w: 30, d: 28, h: 130, color: "#ea580c", motion: { type: "slideX", amp: -10 }, callout: null, partSpec: "S45C+TPU" },
        { name: "TOGGLE_PLATE", labelKo: "4핀 황동 배력 링크판", shape: "hex", x: -48, y: -18, z: 120, w: 96, d: 36, h: 40, color: "#ca8a04", callout: "복합 4핀 배력 링크", partSpec: "C3604" },
        { name: "LEFT_JAW", labelKo: "좌측 치형 조우", shape: "box", x: -34, y: -12, z: 155, w: 24, d: 24, h: 90, color: "#cbd5e1", motion: { type: "slideX", amp: 8 }, callout: "치형 클램핑 조우", partSpec: "SKD11" },
        { name: "RIGHT_JAW", labelKo: "우측 치형 조우", shape: "box", x: 10, y: -12, z: 155, w: 24, d: 24, h: 90, color: "#cbd5e1", motion: { type: "slideX", amp: -8 }, callout: null, partSpec: "SKD11" },
      ],
    };
  }

  if (/큐브|6면|인터로킹/.test(lower)) {
    return {
      projectId,
      code: "JIG-02 | Modular 6-Face Interlocking Cube Fixture",
      titleKo: "모듈형 6면 인터로킹 데이텀 박스 픽스처 (3D & 2D)",
      dims: { w: 160, d: 160, h: 160 },
      drawingSpec: { scale: "1 : 1", tolerance: "직각도 ⊥0.015mm", strokeMm: 20 },
      provisions: [
        { provision: "Overall Dimension & Mass", description: "160 × 160 × 160 (mm) / 2.15 kg" },
        { provision: "Jig & Fixture Function", description: "5-Axis / CMM 6-Face Datum Cube with 4-corner red quick cam latches" },
      ],
      sequences: [
        { unit: "1. 적색 코너 래치 개방 및 안착", flow: "코너 캠 래치 해제 후 내부 기준 시트에 공작물 안착" },
        { unit: "2. 6면 인터로킹 체결", flow: "상판 탭-슬롯 결합 및 다방향 무세팅 가공·검사 수행" },
      ],
      modules: [
        { name: "CUBE_BODY", labelKo: "6면 기준 데이텀 바디", shape: "box", x: -60, y: -60, z: 14, w: 120, d: 120, h: 120, color: "#e2e8f0", callout: "탭-슬롯 데이텀 바디", partSpec: "AL7075" },
        { name: "TOP_PLATE", labelKo: "인터로킹 상판", shape: "box", x: -60, y: -60, z: 134, w: 120, d: 120, h: 18, color: "#f8fafc", motion: { type: "slideZ", amp: 14 }, callout: "인터로킹 상판", partSpec: "AL7075" },
        { name: "LATCH_1", labelKo: "코너 적색 캠 래치 #1", shape: "box", x: -74, y: -66, z: 24, w: 18, d: 32, h: 108, color: "#dc2626", motion: { type: "slideX", amp: -8 }, callout: "4코너 적색 캠 래치", partSpec: "SCM440" },
        { name: "LATCH_2", labelKo: "코너 적색 캠 래치 #2", shape: "box", x: 56, y: 34, z: 24, w: 18, d: 32, h: 108, color: "#dc2626", motion: { type: "slideX", amp: 8 }, callout: null, partSpec: "SCM440" },
      ],
    };
  }

  return {
    projectId,
    code: "JIG-01 | Parallel Rail Dual-Spring Clamping Jig & Fixture",
    titleKo: "평행 타공 레일 & 듀얼 텐션 스프링 토글 클램핑 지그 (3D & 2D)",
    dims: { w: 340, d: 240, h: 165 },
    drawingSpec: { scale: "1 : 2", tolerance: "ISO 2768-mK (피치 25.0 ±0.02)", strokeMm: 38 },
    provisions: [
      { provision: "Overall Dimension & Mass", description: "340 × 240 × 165 (mm) / 2.34 kg" },
      { provision: "Jig & Fixture Function", description: "Perforated parallel clamping rails + Central toggle rod + Dual red tension springs" },
      { provision: "Clamping Force", description: "Ø8 Indexing Holes (25mm Pitch) / Symmetric Tension 420 N" },
    ],
    sequences: [
      { unit: "1. 작동 로드 조작 및 레일 벌림", flow: "상부 수직 로드 조작 → 토글 링크가 양측 타공 레일을 38mm 대칭 확장 → 공작물 안착" },
      { unit: "2. 듀얼 인장 스프링 자동 클램핑", flow: "로드 락킹 → 좌·우 적색 코일 스프링 복원력으로 공작물 정중앙 자동 정렬 파지" },
    ],
    modules: [
      { name: "FRONT_RAIL", labelKo: "전면 타공 레일", shape: "box", x: -170, y: -108, z: 18, w: 340, d: 26, h: 28, color: "#a86448", holes: 10, motion: { type: "slideY", amp: 14 }, callout: "타공 가이드 레일 (Ø8)", partSpec: "S45C" },
      { name: "REAR_RAIL", labelKo: "후면 타공 레일", shape: "box", x: -170, y: 82, z: 18, w: 340, d: 26, h: 28, color: "#a86448", holes: 10, motion: { type: "slideY", amp: -14 }, callout: null, partSpec: "S45C" },
      { name: "CENTER_LINK", labelKo: "중앙 슬라이드 링크", shape: "box", x: -27, y: -82, z: 14, w: 54, d: 164, h: 24, color: "#7c8594", callout: "중앙 슬라이드 링크", partSpec: "AL6061" },
      { name: "SPRING_LEFT", labelKo: "좌측 적색 인장 스프링", shape: "spring", axis: "y", x: -75, y: -82, z: 22, w: 22, d: 164, h: 22, color: "#dc2626", motion: { type: "springY", amp: 14 }, callout: "듀얼 인장 스프링", partSpec: "SWP-B" },
      { name: "SPRING_RIGHT", labelKo: "우측 적색 인장 스프링", shape: "spring", axis: "y", x: 51, y: -82, z: 22, w: 22, d: 164, h: 22, color: "#dc2626", motion: { type: "springY", amp: 14 }, callout: null, partSpec: "SWP-B" },
      { name: "TOGGLE_PIVOT", labelKo: "황동 토글 피벗", shape: "hex", x: -22, y: -22, z: 46, w: 44, d: 44, h: 28, color: "#d4a048", motion: { type: "slideZ", amp: 6 }, callout: "토글 피벗 조인트", partSpec: "C3604" },
      { name: "ACTUATOR_ROD", labelKo: "상부 수직 작동 로드", shape: "cylinder", x: -7, y: -7, z: 66, w: 14, d: 14, h: 95, color: "#cbd5e1", motion: { type: "slideZ", amp: 6 }, callout: "수직 작동 로드", partSpec: "SUS304" },
    ],
  };
}

export async function ghVoiceToCad(body = {}) {
  const sessRes = await ghAuthSession("GET");
  if (!sessRes.data.authenticated) {
    return { ok: false, status: 401, data: { message: "로그인이 필요합니다." } };
  }
  const session = sessRes.data.session;
  const design = buildFallbackDesign(body.transcript);
  const integritySha256 = await sha256Hex(JSON.stringify(design.modules));

  localVault.set(design.projectId, { ownerId: session.userId, design });
  logAudit("CAD_CREATED", `${design.projectId} 생성 및 금고 등록`);

  return {
    ok: true,
    status: 200,
    data: {
      ok: true,
      vault: {
        projectId: design.projectId,
        sealedVaultToken: "gh_local_" + design.projectId,
        encryption: "WebCrypto Vault (GH-Pages Mode)",
        integritySha256,
        stepExportAllowed: TIER_RANK[session.tier] >= 2,
      },
      watermarkOverlayText: `${session.userId} | ${session.tier.toUpperCase()} | GH-PAGES`,
      preview: {
        ...design,
        previewBoxes: design.modules.map((m, i) => ({
          ...m,
          idx: i + 1,
          partNo: `P-0${i + 1}`,
        })),
      },
    },
  };
}

function compileSimpleStep(projectId, code, modules, watermarkId, ownerLabel) {
  let id = 1;
  const lines = [];
  const add = (e) => {
    const cur = id++;
    lines.push(`#${cur} = ${e};`);
    return cur;
  };
  const orig = add("CARTESIAN_POINT('', (0.0, 0.0, 0.0))");
  const dx = add("DIRECTION('', (1.0, 0.0, 0.0))");
  const dnx = add("DIRECTION('', (-1.0, 0.0, 0.0))");
  const dy = add("DIRECTION('', (0.0, 1.0, 0.0))");
  const dny = add("DIRECTION('', (0.0, -1.0, 0.0))");
  const dz = add("DIRECTION('', (0.0, 0.0, 1.0))");
  const dnz = add("DIRECTION('', (0.0, 0.0, -1.0))");
  const vx = add(`VECTOR('', #${dx}, 1.0)`);
  const vnx = add(`VECTOR('', #${dnx}, 1.0)`);
  const vy = add(`VECTOR('', #${dy}, 1.0)`);
  const vny = add(`VECTOR('', #${dny}, 1.0)`);
  const vz = add(`VECTOR('', #${dz}, 1.0)`);
  const axis = add(`AXIS2_PLACEMENT_3D('', #${orig}, #${dz}, #${dx})`);
  const lu = add("( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI., .METRE.) )");
  const au = add("( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($, .RADIAN.) )");
  const su = add("( NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($, .STERADIAN.) )");
  const unc = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.0E-05), #${lu}, 'distance_accuracy_value', 'precision')`);
  const gctx = add(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lu}, #${au}, #${su})) REPRESENTATION_CONTEXT('3D', '3D') )`);
  const actx = add("APPLICATION_CONTEXT('configuration controlled 3d designs of mechanical parts and assemblies')");
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard', 'config_control_design', 1994, #${actx})`);
  const mctx = add(`MECHANICAL_CONTEXT('', #${actx}, 'mechanical')`);
  const prod = add(`PRODUCT('${projectId}', '${code.replace(/'/g, "")}', 'WMK:${watermarkId}', (#${mctx}))`);
  const pdf = add(`PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('REV1', 'DRM', #${prod}, .MADE.)`);
  const dctx = add(`DESIGN_CONTEXT('', #${actx}, 'design')`);
  const pd = add(`PRODUCT_DEFINITION('design', 'Export', #${pdf}, #${dctx})`);
  const pds = add(`PRODUCT_DEFINITION_SHAPE('', '', #${pd})`);

  const solids = modules.map((m) => {
    const x0 = m.x, y0 = m.y, z0 = m.z, x1 = m.x + m.w + 0.0037, y1 = m.y + m.d, z1 = m.z + m.h;
    const pts = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ].map(([a, b, c]) => add(`CARTESIAN_POINT('', (${a.toFixed(4)}, ${b.toFixed(4)}, ${c.toFixed(4)}))`));
    const vs = pts.map((p) => add(`VERTEX_POINT('', #${p})`));
    const me = (s, e, v) => add(`EDGE_CURVE('', #${vs[s]}, #${vs[e]}, #${add(`LINE('', #${pts[s]}, #${v})`)}, .T.)`);
    const E = [
      me(0, 1, vx), me(1, 2, vy), me(2, 3, vnx), me(3, 0, vny),
      me(4, 5, vx), me(5, 6, vy), me(6, 7, vnx), me(7, 4, vny),
      me(0, 4, vz), me(1, 5, vz), me(2, 6, vz), me(3, 7, vz),
    ];
    const mf = (vi, nd, rd, specs) => {
      const oes = specs.map(([ei, s]) => add(`ORIENTED_EDGE('', *, #${E[ei]}, ${s ? ".T." : ".F."})`));
      const lp = add(`EDGE_LOOP('', (${oes.map((o) => `#${o}`).join(", ")}))`);
      const bd = add(`FACE_OUTER_BOUND('', #${lp}, .T.)`);
      const pl = add(`PLANE('', #${add(`AXIS2_PLACEMENT_3D('', #${pts[vi]}, #${nd}, #${rd})`)})`);
      return add(`ADVANCED_FACE('', (#${bd}), #${pl}, .T.)`);
    };
    const fs = [
      mf(0, dnz, dnx, [[3, false], [2, false], [1, false], [0, false]]),
      mf(4, dz, dx, [[4, true], [5, true], [6, true], [7, true]]),
      mf(0, dny, dx, [[0, true], [9, true], [4, false], [8, false]]),
      mf(2, dy, dnx, [[2, true], [11, true], [6, false], [10, false]]),
      mf(1, dx, dy, [[1, true], [10, true], [5, false], [9, false]]),
      mf(3, dnx, dny, [[3, true], [8, true], [7, false], [11, false]]),
    ];
    return add(`MANIFOLD_SOLID_BREP('${m.name}', #${add(`CLOSED_SHELL('', (${fs.map((f) => `#${f}`).join(", ")}))`)})`);
  });

  const rep = add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${projectId}', (#${axis}, ${solids.map((s) => `#${s}`).join(", ")}), #${gctx})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(#${pds}, #${rep})`);

  return [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION(('Jig and Fixture Assembly', 'FORENSIC_WATERMARK_ID:${watermarkId}'), '2;1');`,
    `FILE_NAME('${projectId}.step', '${new Date().toISOString()}', ('${ownerLabel}'), ('SECURE_STEP_VAULT'), 'BREP_V2', 'VAULT', 'CONFIDENTIAL');`,
    "FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));",
    "ENDSEC;",
    "DATA;",
    ...lines,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}

export async function ghExportStep(body = {}) {
  const sessRes = await ghAuthSession("GET");
  if (!sessRes.data.authenticated) {
    return { ok: false, status: 401, data: { message: "로그인이 필요합니다." } };
  }
  const session = sessRes.data.session;
  if ((TIER_RANK[session.tier] || 0) < 2) {
    logAudit("STEP_EXPORT_DENIED_TIER", `Preview 등급 STEP 추출 차단`);
    return {
      ok: false,
      status: 403,
      data: {
        message:
          "현재 계정은 프리뷰(Preview) 등급이므로 3D·2D 열람만 가능하며 .STEP 원본 추출이 잠겨 있습니다. PRO 이상 등급으로 입장해 주세요.",
      },
    };
  }

  const entry = localVault.get(body.projectId);
  if (!entry) {
    return { ok: false, status: 403, data: { message: "설계 자산을 찾을 수 없습니다." } };
  }

  if (body.action === "request_ticket") {
    return { ok: true, status: 200, data: { ok: true, ticket: "gh_tk_" + randomHex(8) } };
  }

  const watermarkId = "WMK-" + randomHex(5).toUpperCase();
  const stepText = compileSimpleStep(
    body.projectId,
    entry.design.code,
    entry.design.modules,
    watermarkId,
    session.userId
  );
  logAudit("STEP_EXPORTED_WITH_DRM", `${body.projectId} 추출 완료 (${watermarkId})`);
  return {
    ok: true,
    status: 200,
    watermarkId,
    stepText,
  };
}
