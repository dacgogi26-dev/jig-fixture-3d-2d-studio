import {
  TIER_LEVEL,
  clearPersistedSession,
  createDemoBuyerSession,
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

const VAULT_STORAGE_KEY = "formech_project_vault_v6";

const els = {
  gateView: document.getElementById("gateView"),
  studioView: document.getElementById("studioView"),
  navAuthArea: document.getElementById("navAuthArea"),
  openPricingModalBtn: document.getElementById("openPricingModalBtn"),
  openQuoteModalBtn: document.getElementById("openQuoteModalBtn"),
  customerMaskToggleBtn: document.getElementById("customerMaskToggleBtn"),
  customerMaskLabel: document.getElementById("customerMaskLabel"),
  tierBadge: document.getElementById("tierBadge"),
  userLabel: document.getElementById("userLabel"),
  logoutBtn: document.getElementById("logoutBtn"),

  demoPreviewBtn: document.getElementById("demoPreviewBtn"),
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
  workpieceMatSelect: document.getElementById("workpieceMatSelect"),

  designTitle: document.getElementById("designTitle"),
  designSubtitle: document.getElementById("designSubtitle"),
  viewportContainer: document.getElementById("viewportContainer"),
  blueprintCanvas: document.getElementById("blueprintCanvas"),
  partInspectorPill: document.getElementById("partInspectorPill"),
  watermarkOverlay: document.getElementById("watermarkOverlay"),
  wireframeBtn: document.getElementById("wireframeBtn"),
  envelopeBtn: document.getElementById("envelopeBtn"),
  snapshotBtn: document.getElementById("snapshotBtn"),
  mobileExpandBtn: document.getElementById("mobileExpandBtn"),
  resetCamBtn: document.getElementById("resetCamBtn"),

  simStrokeSlider: document.getElementById("simStrokeSlider"),
  simStrokeLabel: document.getElementById("simStrokeLabel"),
  explodeSlider: document.getElementById("explodeSlider"),
  explodeLabel: document.getElementById("explodeLabel"),
  autoCycleBtn: document.getElementById("autoCycleBtn"),
  workpieceToggleBtn: document.getElementById("workpieceToggleBtn"),

  roiSavedKrw: document.getElementById("roiSavedKrw"),
  roiSavedHours: document.getElementById("roiSavedHours"),
  roiTurnkeyKrw: document.getElementById("roiTurnkeyKrw"),

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
  bomOpenQuoteBtn: document.getElementById("bomOpenQuoteBtn"),
  downloadBomBtn: document.getElementById("downloadBomBtn"),

  saveToVaultBtn: document.getElementById("saveToVaultBtn"),
  vaultListContainer: document.getElementById("vaultListContainer"),
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

  quoteModal: document.getElementById("quoteModal"),
  quoteClientInput: document.getElementById("quoteClientInput"),
  printQuoteBtn: document.getElementById("printQuoteBtn"),
  closeQuoteModalBtn: document.getElementById("closeQuoteModalBtn"),
  quoteSheetBody: document.getElementById("quoteSheetBody"),

  pricingModal: document.getElementById("pricingModal"),
  closePricingModalBtn: document.getElementById("closePricingModalBtn"),
  pocMonthlySlider: document.getElementById("pocMonthlySlider"),
  pocMonthlyCountLabel: document.getElementById("pocMonthlyCountLabel"),
  pocAnnualSaveLabel: document.getElementById("pocAnnualSaveLabel"),
  pocAnnualHoursLabel: document.getElementById("pocAnnualHoursLabel"),
  pocLeadForm: document.getElementById("pocLeadForm"),
  pocCompany: document.getElementById("pocCompany"),
  pocManager: document.getElementById("pocManager"),
  pocContact: document.getElementById("pocContact"),
  pocPlanSelect: document.getElementById("pocPlanSelect"),
  pocFormMsg: document.getElementById("pocFormMsg"),
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
  workpieceMat: "sus304",
  priority: "best",
  shaftDia: null,
  springTierBoost: 0,
};

let isRecording = false;
let recognition = null;
let isAutoCycling = false;
let isWorkpieceShown = true;
let isWireframe = false;
let isEnvelopeShown = false;
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

function isProUnlocked() {
  return (TIER_LEVEL[getEffectiveTier()] || 0) >= TIER_LEVEL.pro;
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
  renderVaultItems();

  if (!viewer) {
    viewer = new EngineeringCadStudioViewer({
      containerEl: els.viewportContainer,
      blueprintCanvasEl: els.blueprintCanvas,
      onPartSelected: (part) => {
        if (!part) {
          els.partInspectorPill.classList.add("hidden");
          return;
        }
        const codeInfo = isProUnlocked()
          ? part.stepName
          : "STEP-ID [PRO 공개]";
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
  els.tierBadge.textContent = session?.isDemoGuest
    ? "DEMO SANDBOX"
    : simulateCustomerMask
    ? "PREVIEW · MASK"
    : effTier.toUpperCase();
  els.userLabel.textContent = session?.userId || "";
  if (els.customerMaskLabel) {
    els.customerMaskLabel.textContent = simulateCustomerMask
      ? "전체공개 복귀"
      : "고객 시점";
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
    workpieceMat: p.workpieceMat || "al6061",
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
  if (els.workpieceMatSelect) {
    els.workpieceMatSelect.value = p.workpieceMat || "al6061";
  }

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

  // 상단 B2B ROI 요약 배너 업데이트
  if (currentDesign.b2bMetrics) {
    const bm = currentDesign.b2bMetrics;
    els.roiSavedKrw.textContent = formatKrw(bm.netDesignSavingsKrw);
    els.roiSavedHours.textContent = `${bm.manualDesignHours}h → 3m`;
    els.roiTurnkeyKrw.textContent = formatKrw(bm.turnkeyTotalKrw);
  }

  // KPI 업데이트
  const ph = view.physics;
  els.kpiDynLoad.textContent = `${ph.dynamicLoadN.toLocaleString("ko-KR")} N`;
  els.kpiActForce.textContent = `${ph.actuatorForceN.toLocaleString("ko-KR")} N`;
  els.kpiMaxHold.textContent = `${ph.actualHoldKgf.toLocaleString("ko-KR")} kgf`;
  els.kpiSafety.textContent = `${ph.safetyFactor}x`;
  els.kpiSafety.style.color =
    ph.safetyFactor >= 2.0 ? "#10b981" : ph.safetyFactor >= 1.3 ? "#f59e0b" : "#ef4444";

  // 물리·모재 임계치 초과 경보 & 1클릭 자동 보강 노출
  const failedLimits = currentDesign.criticalLimits.filter((l) => l.pct >= 85);
  if (failedLimits.length > 0) {
    const msgs = failedLimits
      .map((l) => l.warningMsg || `${l.title} 임계 근접(${l.pct}%)`)
      .join(" / ");
    els.reinforceWarningText.textContent = `물리·모재 한계 경고: ${msgs}`;
    els.reinforceAlertBox.classList.remove("hidden");
  } else {
    els.reinforceAlertBox.classList.add("hidden");
  }

  // 5대 재료역학 및 피가공물 압흔 임계 바 렌더링
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

  // AI 수석 설계 추론 로그 렌더링 (선명한 가독성)
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

  // BOM 테이블 렌더링
  els.bomTableBody.innerHTML = "";
  for (const row of view.bom) {
    const tr = document.createElement("tr");
    tr.className = "bom-row";
    const skuClass = view.isRedacted ? "sku-badge sku-locked" : "sku-badge";
    const costText =
      row.totalPriceKrw === null
        ? `<span style="color:#fcd34d;">PRO 공개</span>`
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

function promptUpgradeModal(reasonText) {
  showBanner(els.exportMsg, reasonText, true);
  openPricingModal();
}

async function handleExportStep() {
  if (!currentDesign) return;
  if (!isProUnlocked()) {
    promptUpgradeModal(
      "무료 데모(Preview) 시점에서는 .STEP 원본 추출이 잠겨 있습니다. PRO 구독 또는 14일 무상 실증(PoC)을 신청해 주세요."
    );
    return;
  }

  els.downloadStepBtn.disabled = true;
  try {
    const effTier = getEffectiveTier();
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
  if (!isProUnlocked()) {
    promptUpgradeModal("미스미 실형번·단가가 포함된 발주용 CSV 추출은 PRO 시트에서 활성화됩니다.");
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

function handleCaptureSnapshot() {
  if (!currentDesign || !viewer) return;
  if (!isProUnlocked()) {
    promptUpgradeModal("제안서용 고해상도 3D 스냅샷(.PNG) 추출은 PRO 시트 이상에서 지원됩니다.");
    return;
  }
  const dataUrl = viewer.captureProposalSnapshotDataUrl({
    titleText: `${currentDesign.titleKo} (${currentDesign.dims.w}×${currentDesign.dims.d}×${currentDesign.dims.h}mm)`,
    metaText: `DWG: ${currentDesign.projectId} · SAFETY ${currentDesign.physics.safetyFactor}x · STAMP: ${session.userId}`,
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${currentDesign.projectId}_PROPOSAL_3D.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showBanner(els.exportMsg, "제안서·품의서 첨부용 3D 스냅샷(.PNG)을 저장했습니다.");
}

// ============================================================================
// 공식 A4 B2B 기술검토 승인서 & 표준 원가 견적서 (PDF 인쇄 대응)
// ============================================================================
function renderQuoteDocument() {
  if (!currentDesign || !els.quoteSheetBody) return;
  const effTier = getEffectiveTier();
  const view = redactEngineeringResult(currentDesign, effTier);
  const bm = currentDesign.b2bMetrics;
  const today = new Date().toISOString().slice(0, 10);
  const docNo = `QT-${today.replace(/-/g, "")}-${view.projectId}`;
  const clientName = els.quoteClientInput?.value.trim() || "귀사 생산기술·구매팀 귀중";

  const limitRowsHtml = currentDesign.criticalLimits
    .map((l) => {
      const passBadge =
        l.status === "SAFE"
          ? `<strong style="color:#059669;">적합 (PASS · ${l.pct}%)</strong>`
          : l.status === "CAUTION"
          ? `<strong style="color:#d97706;">주의 (${l.pct}%)</strong>`
          : `<strong style="color:#dc2626;">보강필요 (${l.pct}%)</strong>`;
      return `
        <tr>
          <td>${escapeHtml(l.title)}</td>
          <td>${escapeHtml(l.materialSpec)}</td>
          <td>${escapeHtml(l.currentText)} / 허용 ${escapeHtml(l.limitText)}</td>
          <td>${passBadge}</td>
        </tr>
      `;
    })
    .join("");

  const bomRowsHtml = view.bom
    .map((r) => {
      const unitStr = r.unitPriceKrw === null ? "[PRO 공개]" : formatKrw(r.unitPriceKrw);
      const sumStr = r.totalPriceKrw === null ? "[PRO 공개]" : formatKrw(r.totalPriceKrw);
      return `
        <tr>
          <td>${r.no}</td>
          <td>${escapeHtml(r.partName)}</td>
          <td style="font-family:monospace;font-weight:700;">${escapeHtml(r.partNumber)}</td>
          <td>${r.qty}</td>
          <td>${escapeHtml(r.leadTime)}</td>
          <td style="text-align:right;">${unitStr}</td>
          <td style="text-align:right;font-weight:700;">${sumStr}</td>
        </tr>
      `;
    })
    .join("");

  els.quoteSheetBody.innerHTML = `
    <div class="q-doc-header">
      <div>
        <div style="font-size:11px;font-weight:700;color:#2563eb;letter-spacing:0.06em;">FORMECH CAE ENGINEERING &amp; QUOTATION</div>
        <div class="q-doc-title">치공구 기술검토 승인서 및 표준 제작 견적서</div>
        <div style="font-size:12px;color:#475569;margin-top:4px;">수신: <strong>${escapeHtml(clientName)}</strong></div>
      </div>
      <div style="text-align:right;font-size:11.5px;color:#334155;line-height:1.6;">
        <div><strong>문서번호:</strong> ${escapeHtml(docNo)}</div>
        <div><strong>도면번호:</strong> ${escapeHtml(view.projectId)}</div>
        <div><strong>발행일자:</strong> ${today}</div>
      </div>
    </div>

    <div class="q-grid-2">
      <div class="q-box">
        <div style="font-weight:700;margin-bottom:4px;">1. 설계 어셈블리 개요</div>
        <div>• 품명: <strong>${escapeHtml(view.titleKo)}</strong></div>
        <div>• 외곽 치수(L×W×H): ${view.dims.w} × ${view.dims.d} × ${view.dims.h} mm</div>
        <div>• 적용 공차: ${escapeHtml(view.drawingSpec.tolerance)}</div>
        <div>• 파일 규격: ISO-10303-21 AP214 (.STEP)</div>
      </div>
      <div class="q-box">
        <div style="font-weight:700;margin-bottom:4px;">2. 총괄 납품 견적 요약 (VAT 10% 포함)</div>
        <div>• 표준품·가공비 소계: <strong>${formatKrw(bm.selectedPartsKrw)}</strong></div>
        <div>• 정밀 조립·셋업 공임: <strong>${formatKrw(bm.assemblySetupFeeKrw)}</strong></div>
        <div>• 부가가치세 (10%): ${formatKrw(bm.vatKrw)}</div>
        <div style="font-size:14px;color:#1d4ed8;margin-top:3px;">• <strong>총 합계금액: ${formatKrw(bm.turnkeyTotalKrw)}</strong></div>
      </div>
    </div>

    <div style="font-size:12.5px;font-weight:800;margin-bottom:6px;">제1절. 고체역학 및 피가공물 표면 보호 적합성 판정 (g = 9.807 m/s²)</div>
    <table class="q-table">
      <thead>
        <tr>
          <th>검증 항목</th>
          <th>적용 재질 · 기준</th>
          <th>해석치 / 임계 허용치</th>
          <th>적합 판정</th>
        </tr>
      </thead>
      <tbody>${limitRowsHtml}</tbody>
    </table>

    <div style="font-size:12.5px;font-weight:800;margin-bottom:6px;">제2절. 표준 부품(MISUMI) 및 정밀 가공품 원가 명세표</div>
    <table class="q-table">
      <thead>
        <tr>
          <th>No</th>
          <th>품명</th>
          <th>규격 / 형번</th>
          <th>수량</th>
          <th>표준납기</th>
          <th style="text-align:right;">단가</th>
          <th style="text-align:right;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${bomRowsHtml}
        <tr>
          <td colspan="6" style="text-align:right;font-weight:700;">조립·정밀 측정 셋업비</td>
          <td style="text-align:right;font-weight:700;">${formatKrw(bm.assemblySetupFeeKrw)}</td>
        </tr>
        <tr>
          <td colspan="6" style="text-align:right;font-weight:800;background:#f1f5f9;">부가세 포함 최종 납품 합계 (VAT 포함)</td>
          <td style="text-align:right;font-weight:800;background:#f1f5f9;color:#1d4ed8;">${formatKrw(bm.turnkeyTotalKrw)}</td>
        </tr>
      </tbody>
    </table>

    <div class="q-box" style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;">
      <div>
        <strong>도입 경제성(ROI) 검토 소견:</strong> 기존 수작업 외주 설계(약 ${bm.manualDesignHours} M/H · 평균 ${formatKrw(bm.outsourcedDesignFeeKrw)}) 대비 초기 설계비 <strong>${formatKrw(bm.netDesignSavingsKrw)} 절감</strong> 및 발주 리드타임 <strong>${bm.leadTimeSavedDays}일 단축</strong> 효과가 확인됨.
      </div>
      <div style="font-weight:800;color:#059669;white-space:nowrap;margin-left:12px;">FORMECH CAE 검증필</div>
    </div>
  `;
}

function openQuoteModal() {
  renderQuoteDocument();
  els.quoteModal.classList.remove("hidden");
}

function openPricingModal() {
  updateRoiSimulator();
  els.pricingModal.classList.remove("hidden");
}

function updateRoiSimulator() {
  const monthly = Number(els.pocMonthlySlider?.value || 8);
  if (els.pocMonthlyCountLabel) els.pocMonthlyCountLabel.textContent = `월 ${monthly}건 설계`;
  // 건당 평균 외주 설계비 85만 원 × 12개월 - PRO 월 구독료 19만 원 × 12개월
  const grossSaved = monthly * 850000 * 12;
  const subCost = 190000 * 12;
  const netSaved = Math.max(0, grossSaved - subCost);
  const savedHours = monthly * 22 * 12;
  if (els.pocAnnualSaveLabel) els.pocAnnualSaveLabel.textContent = `${formatKrw(netSaved)} / 년`;
  if (els.pocAnnualHoursLabel) els.pocAnnualHoursLabel.textContent = `${savedHours.toLocaleString("ko-KR")} M/H 단축`;
}

// ============================================================================
// 다중 설계안 비교 보관함 (Project History Vault)
// ============================================================================
function loadVaultList() {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveVaultList(list) {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {}
}

function renderVaultItems() {
  if (!els.vaultListContainer) return;
  const items = loadVaultList();
  if (items.length === 0) {
    els.vaultListContainer.innerHTML = `<div style="font-size:11px;color:#64748b;padding:4px 0;">보관된 비교 설계안이 없습니다. 상단 [+ 현재 설계안 보관]을 눌러 저장하세요.</div>`;
    return;
  }

  els.vaultListContainer.innerHTML = "";
  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "vault-item";
    div.innerHTML = `
      <div style="min-width:0;">
        <div class="vault-item-title">${escapeHtml(item.titleKo)}</div>
        <div class="vault-item-meta">${escapeHtml(item.projectId)} · 안전율 ${item.safetyFactor}x · ${formatKrw(item.turnkeyTotalKrw)}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button class="btn btn-compact" type="button" data-vload="${idx}">복원</button>
        <button class="btn btn-compact" type="button" data-vdel="${idx}">삭제</button>
      </div>
    `;
    els.vaultListContainer.appendChild(div);
  });

  els.vaultListContainer.querySelectorAll("[data-vload]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = loadVaultList()[Number(btn.dataset.vload)];
      if (!item) return;
      els.promptInput.value = item.prompt || "";
      currentDesign = generateRealCadEngineering(els.promptInput.value, item.overrides || {});
      syncControlsFromParams(currentDesign.params);
      renderAllPanels();
      showBanner(els.makeMsg, `보관함 설계안 복원 완료: ${currentDesign.titleKo}`);
    });
  });

  els.vaultListContainer.querySelectorAll("[data-vdel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = loadVaultList();
      list.splice(Number(btn.dataset.vdel), 1);
      saveVaultList(list);
      renderVaultItems();
    });
  });
}

function handleSaveToVault() {
  if (!currentDesign) return;
  const list = loadVaultList();
  list.unshift({
    savedAt: new Date().toISOString(),
    projectId: currentDesign.projectId,
    titleKo: currentDesign.titleKo,
    safetyFactor: currentDesign.physics.safetyFactor,
    turnkeyTotalKrw: currentDesign.b2bMetrics.turnkeyTotalKrw,
    prompt: els.promptInput.value.trim(),
    overrides: { ...activeOverrides },
  });
  saveVaultList(list);
  renderVaultItems();
  showBanner(els.makeMsg, `현재 설계안(${currentDesign.projectId})을 비교 보관함에 저장했습니다.`);
}

// GitHub 무설정 사양 허브: .formech.json 저장 / 불러오기 / 요약 복사
function handleExportSpecJson() {
  if (!currentDesign) return;
  const specPayload = {
    schema: "formech-cae-spec-v6",
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
  const bm = currentDesign.b2bMetrics;
  const lines = [
    `[FORMECH CAE V6 설계 검토 & 견적 요약]`,
    `• 도면번호: ${view.projectId}`,
    `• 어셈블리: ${view.titleKo} (${view.dims.w}×${view.dims.d}×${view.dims.h}mm)`,
    `• 동적부하: ${view.physics.dynamicLoadN} N (정하중 ${view.physics.loadKg}kgf, 가감속 ${view.physics.accelG}G)`,
    `• 클램핑력: ${view.physics.actuatorForceN} N · 안전율 ${view.physics.safetyFactor}x · 접촉면압 ${view.physics.contactPressureMpa}MPa`,
    `• 턴키 예상가(VAT 포함): ${formatKrw(bm.turnkeyTotalKrw)} (외주 설계비 절감 ${formatKrw(bm.netDesignSavingsKrw)})`,
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    showBanner(els.makeMsg, "설계 검토 및 견적 요약서를 클립보드에 복사했습니다.");
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
    showBanner(els.gateMsg, "유효하지 않은 라이선스 코드입니다. 바이어 체험은 좌측 [무료 데모 입장]을 이용해 주세요.", true);
    return;
  }
  els.gateMsg.innerHTML = "";
  enterStudio(verified);
}

els.demoPreviewBtn?.addEventListener("click", () => {
  enterStudio(createDemoBuyerSession());
});

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

els.workpieceMatSelect?.addEventListener("change", (e) => {
  activeOverrides.workpieceMat = e.target.value;
  executeSliderSolve();
});

els.autoReinforceBtn.addEventListener("click", () => {
  if (!currentDesign) return;
  const upgraded = computeAutoReinforcedParams(currentDesign);
  currentDesign = generateRealCadEngineering(els.promptInput.value, upgraded);
  syncControlsFromParams(currentDesign.params);
  renderAllPanels();
  showBanner(
    els.exportMsg,
    "물리·모재 임계치 보강 완료: 가이드축 직경·접촉 보호 패드·구동 배력을 안전 범위로 자동 승격했습니다."
  );
});

document.querySelectorAll(".seg-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setInspectorTab(tab.dataset.tab);
  });
});

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

// 보관함 · 사양 허브 · Make 이벤트
els.saveToVaultBtn?.addEventListener("click", handleSaveToVault);
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
  showBanner(els.makeMsg, "Make.com 웹훅이 연결되었습니다.");
});

els.clearMakeUrlBtn.addEventListener("click", () => {
  localStorage.removeItem("formech_make_webhook");
  els.makeWebhookInput.value = "";
  updateMakeIndicator();
  showBanner(els.makeMsg, "Make 웹훅을 해제하고 내장 고속 CAE 솔버 모드로 전환했습니다.");
});

els.downloadMakeBpBtn.addEventListener("click", () => {
  const json = generateMakeBlueprintJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "formech-v6-make-scenario-blueprint.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showBanner(els.makeMsg, "Make.com 시나리오 블루프린트(.JSON)가 다운로드되었습니다.");
});

// 모달 바인딩 (품의 견적서 & 요금제/PoC)
els.openQuoteModalBtn?.addEventListener("click", openQuoteModal);
els.bomOpenQuoteBtn?.addEventListener("click", openQuoteModal);
els.closeQuoteModalBtn?.addEventListener("click", () => els.quoteModal.classList.add("hidden"));
els.quoteClientInput?.addEventListener("input", renderQuoteDocument);
els.printQuoteBtn?.addEventListener("click", () => window.print());

els.openPricingModalBtn?.addEventListener("click", openPricingModal);
els.closePricingModalBtn?.addEventListener("click", () => els.pricingModal.classList.add("hidden"));
els.pocMonthlySlider?.addEventListener("input", updateRoiSimulator);

els.pocLeadForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const receiptId = "POC-" + Math.floor(100000 + Math.random() * 900000);
  const payload = {
    type: "B2B_POC_REQUEST",
    receiptId,
    company: els.pocCompany.value.trim(),
    manager: els.pocManager.value.trim(),
    contact: els.pocContact.value.trim(),
    plan: els.pocPlanSelect.value,
    monthlyJigs: Number(els.pocMonthlySlider.value),
    submittedAt: new Date().toISOString(),
  };

  try {
    const leads = JSON.parse(localStorage.getItem("formech_poc_leads_v6") || "[]");
    leads.unshift(payload);
    localStorage.setItem("formech_poc_leads_v6", JSON.stringify(leads.slice(0, 20)));
  } catch {}

  const makeUrl = getSavedMakeUrl();
  if (makeUrl && /^https:\/\/hook\.[a-z0-9-]+\.make\.com\//i.test(makeUrl)) {
    try {
      await fetch(makeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  showBanner(
    els.pocFormMsg,
    `접수 완료 [${receiptId}]: ${payload.company} (${payload.manager}님) 기업 실증(PoC) 및 라이선스 안내가 등록되었습니다.`
  );
  els.pocLeadForm.reset();
});

// 뷰포트 컨트롤
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

els.envelopeBtn?.addEventListener("click", () => {
  isEnvelopeShown = !isEnvelopeShown;
  els.envelopeBtn.classList.toggle("active", isEnvelopeShown);
  viewer?.setEnvelopeVisible(isEnvelopeShown);
});

els.snapshotBtn?.addEventListener("click", handleCaptureSnapshot);

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
