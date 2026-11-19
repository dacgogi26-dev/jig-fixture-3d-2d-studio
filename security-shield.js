/**
 * V4.0 Zero-Trust Anti-Cloning (REA / HTTrack / WebCopy / SingleFile 차단) & 영업비밀 마스킹 모듈
 */

const ALLOWED_HOST_PATTERNS = [
  /^dacgogi26-dev\.github\.io$/i,
  /^[a-z0-9-]+\.netlify\.app$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
];

const CLONE_BOT_REGEX =
  /HTTrack|WebCopier|SiteSucker|Teleport|WebZIP|Offline Explorer|SingleFile|ScrapBook|Cyotek|Wget|curl|python-requests|Go-http-client|\bREA\b/i;

const SALTED_INVITE_HASHES = {
  ceb7cb447f5dccdf8f9eda88d404a4b43b21ff7c672938d1425f9b3b3589e4a7: "preview",
  "0023fe1e09f0d5e838413251e803a7aad2ce2e4cc4cb744ed8507f4338e7f55e": "pro",
  "059e1a601547589ecac165ba949485fff471e0660e491517fe47246931592044": "enterprise",
  "44d4ec62f1d7842a32573ac49b88b67aa2f956d0519ca6de0a57c04c5706c5b7:admin": "admin",
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

  // 1. 외부 iframe 미러링 차단
  if (window.top !== window.self) {
    triggerLockdown("IFRAME_MIRROR_BLOCKED");
    return { valid: false };
  }

  // 2. REA / 웹 복제 툴이 로컬 디스크(file:, blob:, data:)로 덤프해 여는 행위 원천 차단
  const proto = window.location.protocol;
  if (proto !== "https:" && proto !== "http:") {
    triggerLockdown("LOCAL_DUMP_PROTOCOL_BLOCKED");
    return { valid: false };
  }

  // 3. 승인된 도메인 외 미러 사이트 실행 시 런타임 즉시 파기
  const host = window.location.hostname || "";
  if (!ALLOWED_HOST_PATTERNS.some((rx) => rx.test(host))) {
    triggerLockdown("UNAUTHORIZED_HOST_CLONE_BLOCKED");
    return { valid: false };
  }

  // 4. 웹 복제 봇 User-Agent 및 자동화 스크래퍼 감지
  const ua = navigator.userAgent || "";
  if (CLONE_BOT_REGEX.test(ua)) {
    triggerLockdown("CLONE_SCANNER_DETECTED");
    return { valid: false };
  }

  // 5. DOM 직렬화/통째 저장 단축키(Ctrl+S, Ctrl+U, Ctrl+P, F12) 및 우클릭 억제
  document.addEventListener("contextmenu", (e) => {
    const tag = e.target?.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") e.preventDefault();
  });

  document.addEventListener("dragstart", (e) => e.preventDefault());

  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (
      (mod && (k === "s" || k === "u" || k === "p")) ||
      e.key === "F12" ||
      (mod && e.shiftKey && (k === "i" || k === "j" || k === "c"))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // 6. 동적 스크립트 인젝션 / 외부 복제 훅 감시 (MutationObserver)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeName === "IFRAME" || (node.nodeName === "SCRIPT" && node.src && !node.src.includes("jsdelivr.net") && !node.src.startsWith(window.location.origin))) {
          node.remove();
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return { valid: true, host };
}

function triggerLockdown(code) {
  if (typeof document === "undefined") return;
  document.documentElement.innerHTML = `
    <body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#08090d;color:#f43f5e;font-family:monospace;text-align:center;padding:32px;">
      <div style="max-width:460px;border:1px solid rgba(244,63,94,0.35);padding:28px;border-radius:12px;background:#0e1017;">
        <div style="font-size:11px;letter-spacing:0.14em;color:#94a3b8;margin-bottom:8px;">ZERO-TRUST SECURITY KERNEL</div>
        <div style="font-size:17px;font-weight:700;margin-bottom:10px;">UNAUTHORIZED CLONE OR HOST DETECTED</div>
        <div style="color:#64748b;font-size:12px;line-height:1.6;">무단 웹 복제 프로그램(REA/HTTrack) 또는 비인가 도메인 실행이 감지되어 3D 설계 커널 및 카탈로그 데이터가 영구 비활성화되었습니다. [${code}]</div>
      </div>
    </body>
  `;
  throw new Error(`LOCKDOWN:${code}`);
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
  const userId = "USR-" + hash.slice(0, 8).toUpperCase();
  return {
    userId,
    tier,
    canExportStep: TIER_LEVEL[tier] >= TIER_LEVEL.pro,
    label: `${tier.toUpperCase()} · ${userId}`,
    expiresAt: Date.now() + 86_400_000,
  };
}

export function savePersistedSession(session) {
  try {
    localStorage.setItem("vault_auth_v4", btoa(encodeURIComponent(JSON.stringify(session))));
  } catch {}
}

export function loadPersistedSession() {
  try {
    const raw = localStorage.getItem("vault_auth_v4");
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(atob(raw)));
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem("vault_auth_v4");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedSession() {
  try {
    localStorage.removeItem("vault_auth_v4");
  } catch {}
}

/**
 * Preview(일반 열람) 등급일 때 핵심 설계 노하우(미스미 형번, 선경/유효권수, 공차, 단가)를
 * DOM 렌더링 이전에 메모리 레벨에서 마스킹하여 F12 소스 검사로도 유출되지 않도록 보호
 */
export function redactEngineeringResult(design, effectiveTier) {
  const unlocked = (TIER_LEVEL[effectiveTier] || 0) >= TIER_LEVEL.pro;
  if (unlocked) {
    return {
      ...design,
      isRedacted: false,
    };
  }

  const maskSku = (sku) => {
    const s = String(sku || "MISUMI");
    return s.slice(0, 3) + "••••-•• [PRO]";
  };

  return {
    ...design,
    isRedacted: true,
    physics: {
      ...design.physics,
      springSpecDetail: "PRO 등급에서 선경(d)·외경(Dm)·유효권수(Na)·자유장(L0) 공개",
      formulaEquation: "τ_max = Kw·(8·F·Dm)/(π·d³) ≤ τ_allow  [상세 설계치 보호됨]",
    },
    bom: design.bom.map((item) => ({
      ...item,
      partNumber: item.isCustomMachined ? "CNC-CUSTOM [치수잠김]" : maskSku(item.partNumber),
      specSummary: item.isCustomMachined
        ? `${item.material} 정밀 가공품 (공차 비공개)`
        : "표준 규격 검증 완료 (상세 형번 비공개)",
      unitPriceKrw: null,
      totalPriceKrw: null,
    })),
    drawingSpec: {
      ...design.drawingSpec,
      tolerance: "끼워맞춤 공차(H7/g6) 및 기하공차 비공개 [PRO 전용]",
    },
    reasoningSteps: Array.isArray(design.reasoningSteps)
      ? design.reasoningSteps.map((step, idx) =>
          idx === 2 ? "재료 임계 검증: 상세 축경·끼워맞춤 공차·전단응력 레시피 비공개 [PRO 전용]" : step
        )
      : [],
  };
}
