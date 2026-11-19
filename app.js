import {
  TIER_LEVEL,
  clearPersistedSession,
  enforceAntiCloneGuard,
  loadPersistedSession,
  redactEngineeringResult,
  savePersistedSession,
  sha256HexWeb,
  verifyInviteCodeClient,
} from "./security-shield.js";
import {
  computeAutoReinforcedParams,
  generateMakeBlueprintJson,
  generateRealCadEngineering,
} from "./engineering-engine.js";
import { compileUniversalAp214Step } from "./step-ap214-compiler.js";
import { EngineeringCadStudioViewer } from "./viewer3d.js";

// 무단 웹 복제기(REA/HTTrack/SingleFile) 및 비인가 미러 도메인 실행 즉시 차단
enforceAntiCloneGuard();

const els = {
  gateView: document.getElementById("gateView"),
  studioView: document.getElementById("studioView"),
  navAuthArea: document.getElementById("navAuthArea"),
  customerMaskToggleBtn: document.getElementById("customerMaskToggleBtn"),
  customerMaskLabel: document.getElementById("customerMaskLabel"),
  tierBadge: document.getElementById("tierBadge"),
  userLabel: document.getElementById("userLabel"),
  logoutBtn: document.getElementById("logoutBtn"),
  inviteInput: document.getElementById("inviteInput"),
  loginBtn: document.getElementById("loginBtn"),
  gateMsg: document.getElementById("gateMsg"),

  makeStatusDot: document.getElementById("makeStatusDot"),
  makeStatusText: document.getElementById("makeStatusText"),
  promptInput: document.getElementById("promptInput"),
  micBtn: document.getElementById("micBtn"),
  micBtnLabel: document.getElementById("micBtnLabel"),
  solveBtn: document.getElementById("solveBtn"),

  loadSlider: document.getElementById("loadSlider"),
  loadValLabel: document.getElementById("loadValLabel"),
  accelSlider: document.getElementById("accelSlider"),
  accelValLabel: document.getElementById("accelValLabel"),
  widthSlider: document.getElementById("widthSlider"),
  widthValLabel: document.getElementById("widthValLabel"),
  strokeSlider: document.getElementById("strokeSlider"),
  strokeValLabel: document.getElementById("strokeValLabel"),
  actuationSelect: document.getElementById("actuationSelect"),
  padSelect: document.getElementById("padSelect"),

  designTitle: document.getElementById("designTitle"),
  designSubtitle: document.getElementById("designSubtitle"),
  viewportContainer: document.getElementById("viewportContainer"),
  blueprintCanvas: document.getElementById("blueprintCanvas"),
  partInspectorPill: document.getElementById("partInspectorPill"),
  watermarkOverlay: document.getElementById("watermarkOverlay"),
  wireframeBtn: document.getElementById("wireframeBtn"),
  mobileExpandBtn: document.getElementById("mobileExpandBtn"),
  resetCamBtn: document.getElementById("resetCamBtn"),

  simStrokeSlider: document.getElementById("simStrokeSlider"),
  simStrokeLabel: document.getElementById("simStrokeLabel"),
  explodeSlider: document.getElementById("explodeSlider"),
  explodeLabel: document.getElementById("explodeLabel"),
  autoCycleBtn: document.getElementById("autoCycleBtn"),
  workpieceToggleBtn: document.getElementById("workpieceToggleBtn"),

  tabPhysics: document.getElementById("tabPhysics"),
  tabBom: document.getElementById("tabBom"),
  tabMake: document.getElementById("tabMake"),

  kpiDynLoad: document.getElementById("kpiDynLoad"),
  kpiActForce: document.getElementById("kpiActForce"),
  kpiMaxHold: document.getElementById("kpiMaxHold"),
  kpiSafety: document.getElementById("kpiSafety"),
  reinforceAlertBox: document.getElementById("reinforceAlertBox"),
  reinforceWarningText: document.getElementById("reinforceWarningText"),
  autoReinforceBtn: document.getElementById("autoReinforceBtn"),
  limitCardsContainer: document.getElementById("limitCardsContainer"),
  reasoningList: document.getElementById("reasoningList"),
  equationBox: document.getElementById("equationBox"),

  priceBest: document.getElementById("priceBest"),
  priceFast: document.getElementById("priceFast"),
  priceCheap: document.getElementById("priceCheap"),
  bomTableBody: document.getElementById("bomTableBody"),
  downloadBomBtn: document.getElementById("downloadBomBtn"),

  exportSpecJsonBtn: document.getElementById("exportSpecJsonBtn"),
  importSpecJsonBtn: document.getElementById("importSpecJsonBtn"),
  importSpecFileInput: document.getElementById("importSpecFileInput"),
  copySpecSummaryBtn: document.getElementById("copySpecSummaryBtn"),

  makeWebhookInput: document.getElementById("makeWebhookInput"),
  saveMakeUrlBtn: document.getElementById("saveMakeUrlBtn"),
  clearMakeUrlBtn: document.getElementById("clearMakeUrlBtn"),
  downloadMakeBpBtn: document.getElementById("downloadMakeBpBtn"),
  makeMsg: document.getElementById("makeMsg"),

  downloadStepBtn: document.getElementById("downloadStepBtn"),
  exportMsg: document.getElementById("exportMsg"),
};

let session = null;
let simulateCustomerMask = false;
let currentDesign = null;
let viewer = null;

let activeOverrides = {
  mechanismType: "vblock_clamp",
  loadKg: 45,
  accelG: 0.5,
  objWidthMm: 42,
  strokeMm: 24,
  actuation: "spring",
  padKey: "carbide_jaw",
  priority: "best",
  shaftDia: null,
  springTierBoost: 0,
};

let isRecording = false;
let recognition = null;
let isAutoCycling = false;
let isWorkpieceShown = true;
let isWireframe = false;
let isMobileStageExpanded = false;

function formatKrw(n) {
  return "₩" + Number(n || 0).toLocaleString("ko-KR");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showBanner(el, text, isErr = false) {
  if (!el) return;
  el.innerHTML = `<div class="msg-banner ${isErr ? "msg-err" : "msg-ok"}">${escapeHtml(text)}</div>`;
}

function getEffectiveTier() {
  if (!session) return "preview";
  return simulateCustomerMask ? "preview" : session.tier;
}

function getSavedMakeUrl() {
  try {
    return localStorage.getItem("formech_make_webhook") || "";
  } catch {
    return "";
  }
}

function updateMakeIndicator() {
  const url = getSavedMakeUrl();
  if (url) {
    els.makeStatusText.textContent = "Make AI 연동됨";
    els.makeStatusText.style.color = "#6ee7b7";
    els.makeWebhookInput.value = url;
  } else {
    els.makeStatusText.textContent = "내장 CAE 코어";
    els.makeStatusText.style.color = "#94a3b8";
  }
}

function setInspectorTab(tabKey) {
  document.querySelectorAll(".seg-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tabKey);
  });
  els.tabPhysics.classList.toggle("hidden", tabKey !== "physics");
  els.tabBom.classList.toggle("hidden", tabKey !== "bom");
  els.tabMake.classList.toggle("hidden", tabKey !== "make");
}

function setMobileWorkspaceTab(mnavKey) {
  els.studioView.dataset.mobileTab = mnavKey;
  document.querySelectorAll(".m-nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mnav === mnavKey);
  });

  if (mnavKey === "physics") setInspectorTab("physics");
  else if (mnavKey === "bom") setInspectorTab("bom");
  else if (mnavKey === "hub") setInspectorTab("make");

  requestAnimationFrame(() => viewer?.resize());
}

function enterStudio(authSession) {
  session = authSession;
  savePersistedSession(authSession);

  els.gateView.classList.add("hidden");
  els.studioView.classList.remove("hidden");
  els.navAuthArea.classList.remove("hidden");

  if (TIER_LEVEL[session.tier] >= TIER_LEVEL.pro) {
    els.customerMaskToggleBtn.classList.remove("hidden");
  } else {
    els.customerMaskToggleBtn.classList.add("hidden");
  }

  updateHeaderAuthState();
  updateMakeIndicator();

  if (!viewer) {
    viewer = new EngineeringCadStudioViewer({
      containerEl: els.viewportContainer,
      blueprintCanvasEl: els.blueprintCanvas,
      onPartSelected: (part) => {
        if (!part) {
          els.partInspectorPill.classList.add("hidden");
          return;
        }
        const effTier = getEffectiveTier();
        const codeInfo =
          TIER_LEVEL[effTier] >= TIER_LEVEL.pro
            ? part.stepName
            : "STEP-ID [PRO 전용]";
        els.partInspectorPill.innerHTML = `
          <div style="font-weight:700;color:#38bdf8;">${escapeHtml(part.labelKo)}</div>
          <div class="num" style="color:#cbd5e1;margin-top:2px;">재질: ${escapeHtml(part.material || "표준합금")} · ID: ${escapeHtml(codeInfo)}</div>
        `;
        els.partInspectorPill.classList.remove("hidden");
      },
    });

    viewer.onLiveStrokeTick = (ratio) => {
      els.simStrokeSlider.value = String(Math.round(ratio * 100));
      updateStrokeTelemetry(ratio);
    };
  } else {
    viewer.resize();
  }

  if (!els.promptInput.value.trim()) {
    els.promptInput.value =
      "원통 서스 파이프 Ø42 CNC 드릴링 치는데 절삭부하 45kgf 걸려도 회전 안 하게 90도 브이블록 상부 가압 지그 짜줘";
  }
  executePromptSolve();
}

function updateHeaderAuthState() {
  const effTier = getEffectiveTier();
  els.tierBadge.className = `tier-chip tier-${effTier}`;
  els.tierBadge.textContent = simulateCustomerMask
    ? "PREVIEW · MASK"
    : effTier.toUpperCase();
  els.userLabel.textContent = session?.userId || "";
  if (els.customerMaskLabel) {
    els.customerMaskLabel.textContent = simulateCustomerMask
      ? "전체공개 복귀"
      : "고객 시점 마스킹";
  }
}

function syncControlsFromParams(p) {
  activeOverrides = {
    mechanismType: p.mechanismType,
    loadKg: p.loadKg,
    accelG: p.accelG,
    objWidthMm: p.objWidthMm,
    strokeMm: p.strokeMm,
    actuation: p.actuation,
    padKey: p.padKey,
    priority: p.priority,
    shaftDia: p.shaftDiameterOverride || null,
    springTierBoost: p.springTierBoost || 0,
  };

  els.loadSlider.value = String(Math.round(p.loadKg));
  els.loadValLabel.textContent = `${p.loadKg} kgf`;

  els.accelSlider.value = String(p.accelG);
  els.accelValLabel.textContent = `${Number(p.accelG).toFixed(1)} G`;

  els.widthSlider.value = String(Math.round(p.objWidthMm));
  els.widthValLabel.textContent = `${p.objWidthMm} mm`;

  els.strokeSlider.value = String(Math.round(p.strokeMm));
  els.strokeValLabel.textContent = `${p.strokeMm} mm`;

  els.actuationSelect.value = p.actuation;
  els.padSelect.value = p.padKey;

  document.querySelectorAll(".mech-pill").forEach((b) => {
    b.classList.toggle("active", b.dataset.mech === p.mechanismType);
  });

  document.querySelectorAll(".tier-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.prio === p.priority);
  });
}

async function executePromptSolve() {
  els.exportMsg.innerHTML = "";
  els.partInspectorPill.classList.add("hidden");
  const promptText = els.promptInput.value.trim();

  let makeOverrides = {};
  const makeUrl = getSavedMakeUrl();

  if (makeUrl && /^https:\/\/hook\.[a-z0-9-]+\.make\.com\//i.test(makeUrl)) {
    els.solveBtn.disabled = true;
    try {
      const res = await fetch(makeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          requestedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && typeof json === "object") {
          makeOverrides = json;
        }
      }
    } catch {
      // Make 웹훅 미응답 시 내장 CAE 코어가 무중단 처리
    } finally {
      els.solveBtn.disabled = false;
    }
  }

  currentDesign = generateRealCadEngineering(promptText, makeOverrides);
  syncControlsFromParams(currentDesign.params);
  renderAllPanels();
}

function executeSliderSolve() {
  els.exportMsg.innerHTML = "";
  currentDesign = generateRealCadEngineering(els.promptInput.value, activeOverrides);
  renderAllPanels();
}

function renderAllPanels() {
  if (!currentDesign) return;
  const effTier = getEffectiveTier();
  const view = redactEngineeringResult(currentDesign, effTier);

  els.designTitle.textContent = `${view.titleKo} (${view.dims.w}×${view.dims.d}×${view.dims.h}mm)`;
  els.designSubtitle.textContent = view.subtitleKo;
  els.watermarkOverlay.textContent = `VAULT LOCKED · ${session.userId} · ${effTier.toUpperCase()}`;

  viewer.loadDesign(currentDesign, { isRedacted: view.isRedacted });

  const sRatio = Number(els.simStrokeSlider.value) / 100;
  viewer.setStrokeRatio(sRatio);
  updateStrokeTelemetry(sRatio);

  // KPI 업데이트
  const ph = view.physics;
  els.kpiDynLoad.textContent = `${ph.dynamicLoadN.toLocaleString("ko-KR")} N`;
  els.kpiActForce.textContent = `${ph.actuatorForceN.toLocaleString("ko-KR")} N`;
  els.kpiMaxHold.textContent = `${ph.actualHoldKgf.toLocaleString("ko-KR")} kgf`;
  els.kpiSafety.textContent = `${ph.safetyFactor}x`;
  els.kpiSafety.style.color =
    ph.safetyFactor >= 2.0 ? "#10b981" : ph.safetyFactor >= 1.3 ? "#f59e0b" : "#ef4444";

  // 물리 임계치 초과 경보 & 1클릭 자동 보강 노출
  const failedLimits = currentDesign.criticalLimits.filter((l) => l.pct >= 85);
  if (failedLimits.length > 0) {
    const msgs = failedLimits
      .map((l) => l.warningMsg || `${l.title} 임계 근접(${l.pct}%)`)
      .join(" / ");
    els.reinforceWarningText.textContent = `물리 한계 경고: ${msgs}`;
    els.reinforceAlertBox.classList.remove("hidden");
  } else {
    els.reinforceAlertBox.classList.add("hidden");
  }

  // 4대 재료역학 임계 바 렌더링
  els.limitCardsContainer.innerHTML = "";
  for (const lim of currentDesign.criticalLimits) {
    const card = document.createElement("div");
    card.className = `limit-card status-${lim.status}`;
    const barW = Math.min(100, Math.max(4, lim.pct));
    const pctColor =
      lim.status === "CRITICAL"
        ? "#ef4444"
        : lim.status === "CAUTION"
        ? "#f59e0b"
        : "#10b981";

    card.innerHTML = `
      <div class="limit-top">
        <span>${escapeHtml(lim.title)}</span>
        <span class="num" style="color:${pctColor};">${lim.pct}%</span>
      </div>
      <div class="limit-sub">
        <span>${escapeHtml(lim.materialSpec)}</span>
        <span class="num">${escapeHtml(lim.currentText)} / ${escapeHtml(lim.limitText)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill fill-${lim.status}" style="width:${barW}%;"></div>
      </div>
    `;
    els.limitCardsContainer.appendChild(card);
  }

  // AI 수석 설계 추론 로그 렌더링
  if (els.reasoningList) {
    els.reasoningList.innerHTML = "";
    const steps = view.reasoningSteps || [];
    steps.forEach((stepText, idx) => {
      const row = document.createElement("div");
      row.className = "reason-step";
      row.innerHTML = `
        <span class="reason-idx">0${idx + 1}</span>
        <span>${escapeHtml(stepText)}</span>
      `;
      els.reasoningList.appendChild(row);
    });
  }

  els.equationBox.innerHTML = `
    <div>${escapeHtml(ph.formulaEquation)}</div>
    <div style="margin-top:4px;color:#38bdf8;">${escapeHtml(ph.springSpecDetail)}</div>
  `;

  // 미스미 3종 원가 비교 업데이트
  const cc = view.costComparison;
  els.priceBest.textContent = formatKrw(cc.best.totalKrw);
  els.priceFast.textContent = formatKrw(cc.fast.totalKrw);
  els.priceCheap.textContent = formatKrw(cc.cheap.totalKrw);

  document.querySelectorAll(".tier-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.prio === activeOverrides.priority);
  });

  // BOM 테이블 렌더링 (행 클릭 시 3D 파트 하이라이트 연동)
  els.bomTableBody.innerHTML = "";
  for (const row of view.bom) {
    const tr = document.createElement("tr");
    tr.className = "bom-row";
    const skuClass = view.isRedacted ? "sku-badge sku-locked" : "sku-badge";
    const costText =
      row.totalPriceKrw === null
        ? `<span style="color:#fcd34d;">비공개</span>`
        : formatKrw(row.totalPriceKrw);

    tr.innerHTML = `
      <td>
        <div style="font-weight:600;color:#f1f5f9;">${escapeHtml(row.partName)}</div>
        <div style="font-size:10px;color:#64748b;">${escapeHtml(row.category)} · ${escapeHtml(row.brand)}</div>
      </td>
      <td>
        <span class="${skuClass}">${escapeHtml(row.partNumber)}</span>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escapeHtml(row.specSummary)}</div>
      </td>
      <td class="num" style="font-weight:700;">${row.qty}</td>
      <td class="num" style="white-space:nowrap;">
        <div>${costText}</div>
        <div style="font-size:9.5px;color:#10b981;">${escapeHtml(row.leadTime)}</div>
      </td>
    `;
    tr.addEventListener("click", () => {
      document.querySelectorAll(".bom-row").forEach((r) => r.classList.remove("selected-row"));
      tr.classList.add("selected-row");
      if (row.partId && viewer) {
        viewer.highlightPartById(row.partId);
      }
    });
    els.bomTableBody.appendChild(tr);
  }
}

function updateStrokeTelemetry(ratio01) {
  if (!currentDesign) return;
  const pct = Math.round(ratio01 * 100);
  const baseF = currentDesign.physics.actuatorForceN;
  const liveF = baseF * (1 + 0.36 * ratio01);
  els.simStrokeLabel.textContent = `${pct}% · ${liveF.toFixed(1)} N`;
}

async function handleExportStep() {
  if (!currentDesign) return;
  const effTier = getEffectiveTier();
  if ((TIER_LEVEL[effTier] || 0) < TIER_LEVEL.pro) {
    showBanner(
      els.exportMsg,
      "현재 고객 열람(Preview) 시점에서는 핵심 설계 보호를 위해 .STEP 추출이 차단되어 있습니다. (PRO 이상 승인 필요)",
      true
    );
    return;
  }

  els.downloadStepBtn.disabled = true;
  try {
    const seed = `${session.userId}|${currentDesign.projectId}|${Date.now()}`;
    const hash = await sha256HexWeb(seed);
    const watermarkId = "WMK-" + hash.slice(0, 10).toUpperCase();

    const stepAscii = compileUniversalAp214Step({
      projectId: currentDesign.projectId,
      titleEn: currentDesign.titleEn,
      parts: currentDesign.parts,
      watermark: {
        watermarkId,
        signatureHex: hash.slice(10, 34).toUpperCase(),
        microDeltaMm: {
          dx: Number((0.0012 + (parseInt(hash.slice(0, 2), 16) / 255) * 0.006).toFixed(6)),
          dy: Number((0.0012 + (parseInt(hash.slice(2, 4), 16) / 255) * 0.006).toFixed(6)),
          dz: Number((0.0012 + (parseInt(hash.slice(4, 6), 16) / 255) * 0.006).toFixed(6)),
        },
      },
      ownerTag: `${session.userId}_${effTier.toUpperCase()}`,
    });

    const blob = new Blob([stepAscii], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const filename = `${currentDesign.projectId}_${watermarkId}.step`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    showBanner(
      els.exportMsg,
      `추출 완료: ${filename} (ISO-10303-21 AP214 정식 규격 · 진원 곡면 및 포렌식 워터마크 각인)`
    );
  } finally {
    els.downloadStepBtn.disabled = false;
  }
}

function handleExportBomCsv() {
  if (!currentDesign) return;
  const effTier = getEffectiveTier();
  if ((TIER_LEVEL[effTier] || 0) < TIER_LEVEL.pro) {
    showBanner(els.exportMsg, "미스미 구매 형번이 포함된 BOM 추출은 PRO 이상 등급에서만 허용됩니다.", true);
    return;
  }

  const head = "No,분류,부품명,브랜드,미스미/가공 형번,사양,재질,수량,납기,단가(KRW),합계(KRW)\n";
  const body = currentDesign.bom
    .map((r) =>
      [
        r.no,
        r.category,
        `"${r.partName}"`,
        r.brand,
        r.partNumber,
        `"${r.specSummary}"`,
        `"${r.material}"`,
        r.qty,
        r.leadTime,
        r.unitPriceKrw,
        r.totalPriceKrw,
      ].join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + head + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentDesign.projectId}_MISUMI_BOM.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  showBanner(els.exportMsg, "미스미(MISUMI) 발주 규격서(.CSV)를 다운로드했습니다.");
}

// GitHub 무설정 사양 허브: .formech.json 저장 / 불러오기 / 요약 복사
function handleExportSpecJson() {
  if (!currentDesign) return;
  const specPayload = {
    schema: "formech-cae-spec-v5",
    savedAt: new Date().toISOString(),
    projectId: currentDesign.projectId,
    titleKo: currentDesign.titleKo,
    prompt: els.promptInput.value.trim(),
    overrides: { ...activeOverrides },
  };
  const blob = new Blob([JSON.stringify(specPayload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentDesign.projectId}.formech.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showBanner(els.makeMsg, `설계 사양 파일(${currentDesign.projectId}.formech.json)을 저장했습니다.`);
}

function handleImportSpecFile(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      if (!parsed || typeof parsed !== "object" || !parsed.overrides) {
        throw new Error("INVALID_SPEC");
      }
      if (typeof parsed.prompt === "string" && parsed.prompt.trim()) {
        els.promptInput.value = parsed.prompt;
      }
      currentDesign = generateRealCadEngineering(els.promptInput.value, parsed.overrides);
      syncControlsFromParams(currentDesign.params);
      renderAllPanels();
      showBanner(els.makeMsg, `사양 복원 완료: ${currentDesign.titleKo}`);
    } catch {
      showBanner(els.makeMsg, "올바른 .formech.json 설계 사양 파일이 아닙니다.", true);
    } finally {
      ev.target.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

async function handleCopySpecSummary() {
  if (!currentDesign) return;
  const effTier = getEffectiveTier();
  const view = redactEngineeringResult(currentDesign, effTier);
  const lines = [
    `[FORMECH CAE V5 설계 검토 요약]`,
    `• 도면번호: ${view.projectId}`,
    `• 어셈블리: ${view.titleKo} (${view.dims.w}×${view.dims.d}×${view.dims.h}mm)`,
    `• 동적부하: ${view.physics.dynamicLoadN} N (정하중 ${view.physics.loadKg}kgf, 가감속 ${view.physics.accelG}G)`,
    `• 클램핑력: ${view.physics.actuatorForceN} N · 안전율 ${view.physics.safetyFactor}x`,
    `• 표준견적: ${formatKrw(view.costComparison.best.totalKrw)} (C-Value 양산형 ${formatKrw(view.costComparison.cheap.totalKrw)})`,
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    showBanner(els.makeMsg, "설계 검토 요약서를 클립보드에 복사했습니다.");
  } catch {
    showBanner(els.makeMsg, "브라우저 클립보드 권한을 확인해 주세요.", true);
  }
}

// 음성 지시 입력
function toggleVoice() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showBanner(els.exportMsg, "음성 인식은 Chrome, Edge 또는 최신 모바일 브라우저에서 지원됩니다.", true);
    return;
  }
  if (isRecording) {
    isRecording = false;
    els.micBtn.classList.remove("recording");
    if (els.micBtnLabel) els.micBtnLabel.textContent = "음성 지시";
    try { recognition?.stop(); } catch {}
    executePromptSolve();
    return;
  }

  isRecording = true;
  els.micBtn.classList.add("recording");
  if (els.micBtnLabel) els.micBtnLabel.textContent = "듣는 중...";
  recognition = new SpeechRec();
  recognition.lang = "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (ev) => {
    let txt = "";
    for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
    els.promptInput.value = txt;
  };
  recognition.onerror = () => {
    isRecording = false;
    els.micBtn.classList.remove("recording");
    if (els.micBtnLabel) els.micBtnLabel.textContent = "음성 지시";
  };
  recognition.start();
}

// 인증 및 전체 이벤트 바인딩
async function handleLogin() {
  const verified = await verifyInviteCodeClient(els.inviteInput.value);
  if (!verified) {
    showBanner(els.gateMsg, "유효하지 않은 초대코드입니다.", true);
    return;
  }
  els.gateMsg.innerHTML = "";
  enterStudio(verified);
}

els.loginBtn.addEventListener("click", handleLogin);
els.inviteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});

els.logoutBtn.addEventListener("click", () => {
  clearPersistedSession();
  session = null;
  simulateCustomerMask = false;
  els.studioView.classList.add("hidden");
  els.navAuthArea.classList.add("hidden");
  els.gateView.classList.remove("hidden");
});

els.customerMaskToggleBtn.addEventListener("click", () => {
  simulateCustomerMask = !simulateCustomerMask;
  updateHeaderAuthState();
  renderAllPanels();
});

els.solveBtn.addEventListener("click", executePromptSolve);
els.micBtn.addEventListener("click", toggleVoice);

document.querySelectorAll(".preset-row").forEach((btn) => {
  btn.addEventListener("click", () => {
    els.promptInput.value = btn.dataset.prompt || "";
    executePromptSolve();
  });
});

document.querySelectorAll(".mech-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    activeOverrides.mechanismType = pill.dataset.mech;
    activeOverrides.shaftDia = null;
    activeOverrides.springTierBoost = 0;
    document.querySelectorAll(".mech-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    executeSliderSolve();
  });
});

els.loadSlider.addEventListener("input", (e) => {
  activeOverrides.loadKg = Number(e.target.value);
  els.loadValLabel.textContent = `${activeOverrides.loadKg} kgf`;
  executeSliderSolve();
});

els.accelSlider.addEventListener("input", (e) => {
  activeOverrides.accelG = Number(e.target.value);
  els.accelValLabel.textContent = `${activeOverrides.accelG.toFixed(1)} G`;
  executeSliderSolve();
});

els.widthSlider.addEventListener("input", (e) => {
  activeOverrides.objWidthMm = Number(e.target.value);
  els.widthValLabel.textContent = `${activeOverrides.objWidthMm} mm`;
  executeSliderSolve();
});

els.strokeSlider.addEventListener("input", (e) => {
  activeOverrides.strokeMm = Number(e.target.value);
  els.strokeValLabel.textContent = `${activeOverrides.strokeMm} mm`;
  executeSliderSolve();
});

els.actuationSelect.addEventListener("change", (e) => {
  activeOverrides.actuation = e.target.value;
  executeSliderSolve();
});

els.padSelect.addEventListener("change", (e) => {
  activeOverrides.padKey = e.target.value;
  executeSliderSolve();
});

// 물리 임계치 초과 시 1클릭 AI 자동 강성·사양 보강
els.autoReinforceBtn.addEventListener("click", () => {
  if (!currentDesign) return;
  const upgraded = computeAutoReinforcedParams(currentDesign);
  currentDesign = generateRealCadEngineering(els.promptInput.value, upgraded);
  syncControlsFromParams(currentDesign.params);
  renderAllPanels();
  showBanner(
    els.exportMsg,
    "물리 임계치 보강 완료: 가이드축 직경·스프링 물성·구동 배력을 안전 한계 이내로 자동 승격했습니다."
  );
});

// 데스크톱 우측 3탭 전환
document.querySelectorAll(".seg-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setInspectorTab(tab.dataset.tab);
  });
});

// 모바일 하단 4탭 네이티브 시트 전환
document.querySelectorAll(".m-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMobileWorkspaceTab(btn.dataset.mnav);
  });
});

document.querySelectorAll(".tier-card").forEach((card) => {
  card.addEventListener("click", () => {
    activeOverrides.priority = card.dataset.prio;
    executeSliderSolve();
  });
});

// GitHub 사양 허브 & Make.com 연동 이벤트
els.exportSpecJsonBtn?.addEventListener("click", handleExportSpecJson);
els.importSpecJsonBtn?.addEventListener("click", () => els.importSpecFileInput?.click());
els.importSpecFileInput?.addEventListener("change", handleImportSpecFile);
els.copySpecSummaryBtn?.addEventListener("click", handleCopySpecSummary);

els.saveMakeUrlBtn.addEventListener("click", async () => {
  const url = els.makeWebhookInput.value.trim();
  if (!/^https:\/\/hook\.[a-z0-9-]+\.make\.com\//i.test(url)) {
    showBanner(els.makeMsg, "올바른 Make.com Webhook 주소(https://hook...make.com/...)를 입력해 주세요.", true);
    return;
  }
  localStorage.setItem("formech_make_webhook", url);
  updateMakeIndicator();
  showBanner(els.makeMsg, "Make.com 웹훅이 연결되었습니다. 이제 프롬프트 입력 시 Make 시나리오와 실시간 통신합니다.");
});

els.clearMakeUrlBtn.addEventListener("click", () => {
  localStorage.removeItem("formech_make_webhook");
  els.makeWebhookInput.value = "";
  updateMakeIndicator();
  showBanner(els.makeMsg, "Make 웹훅을 해제하고 GitHub 내장 고속 CAE 솔버 모드로 전환했습니다.");
});

els.downloadMakeBpBtn.addEventListener("click", () => {
  const json = generateMakeBlueprintJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "formech-v5-make-scenario-blueprint.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showBanner(els.makeMsg, "8종 기구 대응 Make.com 시나리오 블루프린트(.JSON)가 다운로드되었습니다.");
});

// 뷰포트 모드·카메라·와이어프레임·모바일 확장 컨트롤
document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    viewer?.setMode(btn.dataset.view);
  });
});

document.querySelectorAll("[data-cam]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector('[data-view="3d"]')?.click();
    viewer?.setCameraPreset(btn.dataset.cam);
  });
});

els.wireframeBtn?.addEventListener("click", () => {
  isWireframe = !isWireframe;
  els.wireframeBtn.classList.toggle("active", isWireframe);
  viewer?.setWireframe(isWireframe);
});

els.mobileExpandBtn?.addEventListener("click", () => {
  isMobileStageExpanded = !isMobileStageExpanded;
  els.studioView.classList.toggle("mobile-stage-expanded", isMobileStageExpanded);
  els.mobileExpandBtn.textContent = isMobileStageExpanded ? "화면 축소" : "화면 확대";
  els.mobileExpandBtn.classList.toggle("active", isMobileStageExpanded);
  setTimeout(() => viewer?.resize(), 240);
});

els.resetCamBtn?.addEventListener("click", () => {
  viewer?.fitCameraToDesign();
});

els.simStrokeSlider.addEventListener("input", (e) => {
  if (isAutoCycling) {
    isAutoCycling = false;
    viewer?.setAutoCycle(false);
    els.autoCycleBtn.textContent = "자동 왕복";
  }
  const r = Number(e.target.value) / 100;
  viewer?.setStrokeRatio(r);
  updateStrokeTelemetry(r);
});

els.explodeSlider.addEventListener("input", (e) => {
  const v = Number(e.target.value);
  els.explodeLabel.textContent = `${v}%`;
  viewer?.setExplodeRatio(v / 100);
});

els.autoCycleBtn.addEventListener("click", () => {
  isAutoCycling = !isAutoCycling;
  viewer?.setAutoCycle(isAutoCycling);
  els.autoCycleBtn.textContent = isAutoCycling ? "정지" : "자동 왕복";
});

els.workpieceToggleBtn.addEventListener("click", () => {
  isWorkpieceShown = !isWorkpieceShown;
  viewer?.setWorkpieceVisible(isWorkpieceShown);
  els.workpieceToggleBtn.textContent = isWorkpieceShown ? "모재 표시" : "모재 숨김";
});

els.downloadStepBtn.addEventListener("click", handleExportStep);
els.downloadBomBtn.addEventListener("click", handleExportBomCsv);

const saved = loadPersistedSession();
if (saved) {
  enterStudio(saved);
}
