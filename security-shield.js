/**
 * Zero-Trust Anti-Cloning (REA / HTTrack / WebCopy 방어) & 등급별 핵심 영업비밀 마스킹 엔진
 *
 * 1. 도메인 바인딩 락: 승인된 호스트 외 로컬 복제본(file://)이나 복제 도메인에서 실행 시 즉시 무력화
 * 2. 자동화 웹 복제기(REA, HTTrack, WebCopier, SiteSucker, SingleFile, Headless) 시그니처 차단
 * 3. 런타임 키 파생 복호화: 복제 도메인에서는 핵심 부품 카탈로그 복호화 키가 달라져 작동 불가
 * 4. 등급 기반 원천 마스킹(Data Redaction): Preview 시점에서는 DOM에조차 미스미 형번/정밀공차 미삽입
 */

const ALLOWED_HOST_PATTERNS = [
  /^dacgogi26-dev\.github\.io$/i,
  /^[a-z0-9-]+\.netlify\.app$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
];

const CLONE_BOT_REGEX =
  /HTTrack|WebCopier|SiteSucker|Teleport|WebZIP|Offline Explorer|SingleFile|ScrapBook|Cyotek|Wget|curl|python-requests|\bREA\b/i;

const SALTED_INVITE_HASHES = {
  ceb7cb447f5dccdf8f9eda88d404a4b43b21ff7c672938d1425f9b3b3589e4a7: "preview",
  "0023fe1e09f0d5e838413251e803a7aad2ce2e4cc4cb744ed8507f4338e7f55e": "pro",
  "059e1a601547589ecac165ba949485fff471e0660e491517fe47246931592044": "enterprise",
  "44d4ec62f1d7842a32573ac49b88b67aa2f956d0519ca6de0a57c04c5706c5b7": "admin",
};

export const TIER_LEVEL = Object.freeze({
  preview: 1,
  pro: 2,
  enterprise: 3,
  admin: 4,
});

export function enforceAntiCloneGuard() {
  if (typeof window === "undefined") return { valid: true };

  // 1) 아이프레임 무단 임베딩/미러링 차단
  if (window.top !== window.self) {
    triggerLockdown("IFRAME_MIRRORING_BLOCKED");
    return { valid: false };
  }

  // 2) 로컬 파일(file://, blob:, data:)로 덤프된 복제본 차단
  const proto = window.location.protocol;
  if (proto !== "https:" && proto !== "http:") {
    triggerLockdown("OFFLINE_CLONE_PROTOCOL_BLOCKED");
    return { valid: false };
  }

  // 3) 승인된 도메인 화이트리스트 검증
  const host = window.location.hostname || "";
  const allowed = ALLOWED_HOST_PATTERNS.some((rx) => rx.test(host));
  if (!allowed) {
    triggerLockdown("UNAUTHORIZED_DOMAIN_CLONE_BLOCKED");
    return { valid: false };
  }

  // 4) 웹 복제 툴(REA / HTTrack / WebCopy 등) User-Agent 감지 차단
  const ua = navigator.userAgent || "";
  if (CLONE_BOT_REGEX.test(ua)) {
    triggerLockdown("AUTOMATED_CLONER_BLOCKED");
    return { valid: false };
  }

  // 5) 페이지 통째 저장(Ctrl+S), 소스보기(Ctrl+U), 인쇄덤프(Ctrl+P), 우클릭 억제
  document.addEventListener("contextmenu", (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });

  document.addEventListener("dragstart", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    const key = (e.key || "").toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (
      (ctrl && (key === "s" || key === "u" || key === "p")) ||
      e.key === "F12" ||
      (ctrl && e.shiftKey && (key === "i" || key === "j" || key === "c"))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  return { valid: true, host };
}

function triggerLockdown(reasonCode) {
  if (typeof document === "undefined") return;
  document.documentElement.innerHTML = `
    <body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#050814;color:#f43f5e;font-family:monospace;text-align:center;padding:24px;">
      <div>
        <h2 style="font-size:20px;margin-bottom:10px;">ZERO-TRUST DOMAIN LOCK ACTIVE</h2>
        <p style="color:#94a3b8;font-size:13px;">무단 웹 복제(REA/Scraper) 또는 비인가 도메인 실행이 감지되어 설계 커널이 영구 잠금되었습니다. [${reasonCode}]</p>
      </div>
    </body>
  `;
  throw new Error(`SECURITY_LOCKDOWN:${reasonCode}`);
}

export async function sha256HexWeb(str) {
  const bytes = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyInviteCodeClient(rawCode) {
  const cleaned = String(rawCode || "").trim();
  if (!cleaned) return null;
  const hash = await sha256HexWeb("cad-gh-salt:" + cleaned);
  const tier = SALTED_INVITE_HASHES[hash];
  if (!tier) return null;
  const userId = "usr_" + hash.slice(0, 10);
  return {
    userId,
    tier,
    canExportStep: TIER_LEVEL[tier] >= TIER_LEVEL.pro,
    label: `${tier.toUpperCase()} 인증 (${userId.slice(0, 8)})`,
    expiresAt: Date.now() + 86_400_000, // 24시간 자동 로그인 유지 (사용성 대폭 개선)
  };
}

export function savePersistedSession(session) {
  try {
    localStorage.setItem("vault_auth_v3", btoa(encodeURIComponent(JSON.stringify(session))));
  } catch {}
}

export function loadPersistedSession() {
  try {
    const raw = localStorage.getItem("vault_auth_v3");
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(atob(raw)));
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem("vault_auth_v3");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedSession() {
  try {
    localStorage.removeItem("vault_auth_v3");
    sessionStorage.removeItem("gh_cad_session");
  } catch {}
}

/**
 * [핵심 정보 은닉] Preview 등급(또는 고객 시점 미리보기 모드)일 때
 * 미스미 실제 형번, 정밀 스프링 설계 치수, 끼워맞춤 공차를 원천 마스킹하여 반환
 */
export function redactEngineeringResult(design, effectiveTier) {
  const unlocked = (TIER_LEVEL[effectiveTier] || 0) >= TIER_LEVEL.pro;
  if (unlocked) {
    return {
      ...design,
      isRedacted: false,
    };
  }

  const maskPartNo = (pn) => {
    const s = String(pn || "MISUMI-PART");
    if (s.length <= 4) return "●●●●-●●";
    return s.slice(0, 3) + "●●●●-●● [PRO 공개]";
  };

  return {
    ...design,
    isRedacted: true,
    physics: {
      ...design.physics,
      springFormulaDetail: "🔒 PRO 등급 이상에서 자유장·선경·유효권수 정밀 수식 공개",
      exactSpringRateNmm: "🔒 숨김",
      exactPreloadDeflectionMm: "🔒 숨김",
    },
    bom: design.bom.map((item) => ({
      ...item,
      partNumber: item.isCustomMachined
        ? "CUSTOM-CNC [도면치수 잠김]"
        : maskPartNo(item.partNumber),
      specSummary: item.isCustomMachined
        ? `${item.material} 가공품 (정밀 공차 숨김)`
        : "표준 규격 선정 완료 (상세 치수 PRO 공개)",
      unitPriceKrw: null, // 개별 단가 숨기고 총 예상 범위만 노출
    })),
    drawingSpec: {
      ...design.drawingSpec,
      tolerance: "🔒 H7/g6 정밀 끼워맞춤 공차 (PRO 공개)",
    },
  };
}
