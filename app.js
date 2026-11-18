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
import { generateRealCadEngineering } from "./engineering-engine.js";
import { compileUniversalAp214Step } from "./step-ap214-compiler.js";
import { EngineeringCadStudioViewer } from "./viewer3d.js";

// 0. REA 등 웹사이트 무단 복제기 및 비인가 도메인 실행 즉시 차단
enforceAntiCloneGuard();

const els = {
  gateView: document.getElementById("gateView"),
  studioView: document.getElementById("studioView"),
  navAuthArea: document.getElementById("navAuthArea"),
  customerMaskToggleBtn: document.getElementById("customerMaskToggleBtn"),
  tierBadge: document.getElementById("tierBadge"),
  userLabel: document.getElementById("userLabel"),
  logoutBtn: document.getElementById("logoutBtn"),
  inviteInput: document.getElementById("inviteInput"),
  loginBtn: document.getElementById("loginBtn"),
  gateMsg: document.getElementById("gateMsg"),

  micBtn: document.getElementById("micBtn"),
  promptInput: document.getElementById("promptInput"),
  solveBtn: document.getElementById("solveBtn"),
  loadSlider: document.getElementById("loadSlider"),
  loadValLabel: document.getElementById("loadValLabel"),
  widthSlider: document.getElementById("widthSlider"),
  widthValLabel: document.getElementById("widthValLabel"),
  strokeSlider: document.getElementById("strokeSlider"),
  strokeValLabel: document.getElementById("strokeValLabel"),
  padSelect: document.getElementById("padSelect"),

  designTitle: document.getElementById("designTitle"),
  designSubtitle: document.getElementById("designSubtitle"),
  viewportContainer: document.getElementById("viewportContainer"),
  blueprintCanvas: document.getElementById("blueprintCanvas"),
  liveForceHud: document.getElementById("liveForceHud"),
  liveDimHud: document.getElementById("liveDimHud"),
  watermarkOverlay: document.getElementById("watermarkOverlay"),

  simStrokeSlider: document.getElementById("simStrokeSlider"),
  simStrokeLabel: document.getElementById("simStrokeLabel"),
  explodeSlider: document.getElementById("explodeSlider"),
  explodeLabel: document.getElementById("explodeLabel"),
  autoCycleBtn: document.getElementById("autoCycleBtn"),
  workpieceToggleBtn: document.getElementById("workpieceToggleBtn"),

  safetyBadge: document.getElementById("safetyBadge"),
  statReqForce: document.getElementById("statReqForce"),
  statPreloadForce: document.getElementById("statPreloadForce"),
  statHoldKg: document.getElementById("statHoldKg"),
  statSpringRate: document.getElementById("statSpringRate"),
  formulaBanner: document.getElementById("formulaBanner"),

  priceBest: document.getElementById("priceBest"),
  priceFast: document.getElementById("priceFast"),
  priceCheap: document.getElementById("priceCheap"),
  bomTableBody: document.getElementById("bomTableBody"),
  downloadStepBtn: document.getElementById("downloadStepBtn"),
  downloadBomBtn: document.getElementById("downloadBomBtn"),
  exportMsg: document.getElementById("exportMsg"),
};

let session = null;
let simulateCustomerMask = false; // 관리자가 고객용 정보숨김 화면을 즉시 확인하는 토글
let currentRawDesign = null;
let viewer = null;

let activeOverrides = {
  mechanismType: "parallel_gripper",
  loadKg: 10,
  objWidthMm: 55,
  strokeMm: 28,
  padKey: "urethane",
  priority: "best",
};

let isRecording = false;
let recognition = null;
let isAutoCycling = false;
let isWorkpieceShown = true;

function formatKrw(n) {
  return "₩" + Number(n || 0).toLocaleString("ko-KR");
}

function showMsg(container, text, isErr = false) {
  container.innerHTML = `<div class="toast ${isErr ? "toast-err" : "toast-ok"}">${text}</div>`;
}

function getEffectiveTier() {
  if (!session) return "preview";
  if (simulateCustomerMask) return "preview";
  return session.tier;
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

  updateAuthHeaderUI();

  if (!viewer) {
    viewer = new EngineeringCadStudioViewer({
      containerEl: els.viewportContainer,
      blueprintCanvasEl: els.blueprintCanvas,
    });
    viewer.onLiveStrokeTick = (ratio) => {
      els.simStrokeSlider.value = String(Math.round(ratio * 100));
      updateLiveForceHud(ratio);
    };
  } else {
    viewer.resize();
  }

  if (!els.promptInput.value.trim()) {
    els.promptInput.value =
      "담뱃갑을 달걀 쥐듯이 잡아서 10kg까지 미끄러져서 떨어지지 않게 버티는 그리퍼 만들어줘";
  }
  runFullDesignFromPrompt();
}

function updateAuthHeaderUI() {
  const effTier = getEffectiveTier();
  els.tierBadge.className = `badge-tier tier-${effTier}`;
  els.tierBadge.textContent = simulateCustomerMask
    ? "PREVIEW (고객 시점 테스트)"
    : effTier.toUpperCase();
  els.userLabel.textContent = session?.label || "";

  els.customerMaskToggleBtn.textContent = simulateCustomerMask
    ? "🔓 관리자 전체공개 시점으로 복귀"
    : "👁️ 고객용 정보숨김 시점 미리보기";
}

function syncControlsFromParams(params) {
  activeOverrides = {
    mechanismType: params.mechanismType,
    loadKg: params.loadKg,
    objWidthMm: params.objWidthMm,
    strokeMm: params.strokeMm,
    padKey: params.padKey,
    priority: params.priority,
    usePneumatic: params.usePneumatic,
  };

  els.loadSlider.value = String(Math.round(params.loadKg));
  els.loadValLabel.textContent = `${params.loadKg} kg`;

  els.widthSlider.value = String(Math.round(params.objWidthMm));
  els.widthValLabel.textContent = `${params.objWidthMm} mm`;

  els.strokeSlider.value = String(Math.round(params.strokeMm));
  els.strokeValLabel.textContent = `${params.strokeMm} mm`;

  els.padSelect.value = params.padKey;

  document.querySelectorAll(".mech-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mech === params.mechanismType);
  });

  document.querySelectorAll(".cost-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.prio === params.priority);
  });
}

function runFullDesignFromPrompt() {
  els.exportMsg.innerHTML = "";
  // 텍스트 입력 시에는 자연어 의도를 우선 분석
  const raw = generateRealCadEngineering(els.promptInput.value, {});
  currentRawDesign = raw;
  syncControlsFromParams(raw.params);
  renderCurrentDesign();
}

function runDesignFromSliders() {
  els.exportMsg.innerHTML = "";
  const raw = generateRealCadEngineering(els.promptInput.value, activeOverrides);
  currentRawDesign = raw;
  renderCurrentDesign();
}

function renderCurrentDesign() {
  if (!currentRawDesign) return;
  const effTier = getEffectiveTier();
  const viewData = redactEngineeringResult(currentRawDesign, effTier);

  els.designTitle.textContent = viewData.titleKo;
  els.designSubtitle.textContent = viewData.subtitleKo;

  const wmk = `${session.userId} • ${effTier.toUpperCase()} • DOMAIN-LOCKED`;
  els.watermarkOverlay.textContent = wmk;

  viewer.loadDesign(currentRawDesign, {
    isRedacted: viewData.isRedacted,
    watermarkText: wmk,
  });

  const strokeVal = Number(els.simStrokeSlider.value) / 100;
  viewer.setStrokeRatio(strokeVal);
  updateLiveForceHud(strokeVal);

  els.liveDimHud.textContent = `외형: ${viewData.dims.w} × ${viewData.dims.d} × ${viewData.dims.h} mm (${currentRawDesign.parts.length}개 부품)`;

  // 역학 리포트 업데이트
  const ph = viewData.physics;
  els.safetyBadge.textContent = `안전율 ${ph.safetyFactor}배 적합`;
  els.statReqForce.textContent = `${ph.requiredClampForceN} N`;
  els.statPreloadForce.textContent = `${ph.actualPreloadForceN} N`;
  els.statHoldKg.textContent = `최대 ${ph.achievedMaxHoldKg} kg`;
  els.statSpringRate.textContent = ph.exactSpringRateNmm;
  els.formulaBanner.textContent = ph.springFormulaDetail;

  // 3종 미스미 원가 비교 카드 업데이트
  const cc = viewData.costComparison;
  els.priceBest.textContent = formatKrw(cc.best.totalKrw);
  els.priceFast.textContent = formatKrw(cc.fast.totalKrw);
  els.priceCheap.textContent = formatKrw(cc.cheap.totalKrw);

  document.querySelectorAll(".cost-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.prio === activeOverrides.priority);
  });

  // 미스미 표준품 BOM 목차 렌더링 (Preview 시점에서는 형번 및 단가 보안 마스킹)
  els.bomTableBody.innerHTML = "";
  for (const row of viewData.bom) {
    const tr = document.createElement("tr");
    const codeClass = viewData.isRedacted
      ? "part-code-pill part-code-locked"
      : "part-code-pill";
    const priceStr =
      row.unitPriceKrw === null
        ? `<span style="color:#fcd34d;">잠김</span>`
        : formatKrw(row.totalPriceKrw);

    tr.innerHTML = `
      <td>
        <div style="font-weight:700;">${row.partName}</div>
        <div style="font-size:10.5px;color:#94a3b8;">${row.category} · ${row.brand}</div>
      </td>
      <td>
        <span class="${codeClass}">${row.partNumber}</span>
        <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${row.specSummary}</div>
      </td>
      <td style="font-weight:700;">${row.qty}</td>
      <td style="font-weight:600;white-space:nowrap;">
        ${priceStr}
        <div style="font-size:10px;color:#34d399;">${row.leadTime}</div>
      </td>
    `;
    els.bomTableBody.appendChild(tr);
  }
}

function updateLiveForceHud(ratio01) {
  if (!currentRawDesign) return;
  const ph = currentRawDesign.physics;
  const curForce =
    ph.actualPreloadForceN +
    (ph.actualMaxOpenForceN - ph.actualPreloadForceN) * ratio01;
  const curGap = ph.closedGapMm + ph.strokeMm * ratio01;
  const pct = Math.round(ratio01 * 100);
  const stateLabel =
    pct === 0
      ? "달걀 파지(Closed 프리로드)"
      : pct >= 95
      ? "보 형태 완전개방(Open)"
      : `개폐 이동 중 (${pct}%)`;

  els.simStrokeLabel.textContent = `${pct}% (${Math.round(curGap)}mm)`;
  els.liveForceHud.innerHTML = `상태: <strong>${stateLabel}</strong> • 실시간 스프링 반력: <strong style="color:#38bdf8;">${curForce.toFixed(
    1
  )} N</strong>`;
}

async function handleDownloadStep() {
  if (!currentRawDesign) return;
  const effTier = getEffectiveTier();
  if ((TIER_LEVEL[effTier] || 0) < TIER_LEVEL.pro) {
    showMsg(
      els.exportMsg,
      "🔒 현재 고객 미리보기(Preview) 등급에서는 .STEP 정밀 모델링 추출이 잠겨 있습니다. (PRO / ENTERPRISE / ADMIN 전용)",
      true
    );
    return;
  }

  els.downloadStepBtn.disabled = true;
  try {
    const randSeed = `${session.userId}|${currentRawDesign.projectId}|${Date.now()}`;
    const hash = await sha256HexWeb(randSeed);
    const watermarkId = "WMK-" + hash.slice(0, 10).toUpperCase();

    const stepAscii = compileUniversalAp214Step({
      projectId: currentRawDesign.projectId,
      titleEn: currentRawDesign.titleEn,
      parts: currentRawDesign.parts,
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
    const filename = `${currentRawDesign.projectId}_${watermarkId}.step`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    showMsg(
      els.exportMsg,
      `✅ 다운로드 완료: ${filename} (ISO-10303-21 AP214 정식 규격 — SolidWorks·Inventor·Fusion360·FreeCAD 완벽 호환 / 전자지문 ${watermarkId} 각인)`
    );
  } finally {
    els.downloadStepBtn.disabled = false;
  }
}

function handleDownloadBomCsv() {
  if (!currentRawDesign) return;
  const effTier = getEffectiveTier();
  if ((TIER_LEVEL[effTier] || 0) < TIER_LEVEL.pro) {
    showMsg(
      els.exportMsg,
      "🔒 미스미 실제 구매 형번이 포함된 발주서(.CSV)는 PRO 등급 이상에서만 다운로드할 수 있습니다.",
      true
    );
    return;
  }

  const header = "순번,분류,부품명,제조사,미스미/가공 형번,규격,재질,수량,납기,단가(원),합계(원)\n";
  const rows = currentRawDesign.bom
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

  // 한글 엑셀 깨짐 방지 UTF-8 BOM 추가
  const blob = new Blob(["\uFEFF" + header + rows], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentRawDesign.projectId}_MISUMI_BOM.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  showMsg(els.exportMsg, "✅ 미스미(MISUMI) 표준품 발주용 BOM 리스트(.CSV)를 다운로드했습니다.");
}

// 음성 인식(Web Speech API 한국어)
function toggleVoiceInput() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showMsg(els.exportMsg, "현재 브라우저에서는 음성 인식이 제한됩니다. 크롬/엣지 브라우저를 권장합니다.", true);
    return;
  }

  if (isRecording) {
    isRecording = false;
    els.micBtn.classList.remove("recording");
    els.micBtn.textContent = "🎤 음성 말하기";
    try { recognition?.stop(); } catch {}
    runFullDesignFromPrompt();
    return;
  }

  isRecording = true;
  els.micBtn.classList.add("recording");
  els.micBtn.textContent = "⏹ 말하기 완료 (클릭)";

  recognition = new SpeechRec();
  recognition.lang = "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (ev) => {
    let spoken = "";
    for (let i = 0; i < ev.results.length; i++) {
      spoken += ev.results[i][0].transcript;
    }
    els.promptInput.value = spoken;
  };
  recognition.onerror = () => {
    isRecording = false;
    els.micBtn.classList.remove("recording");
    els.micBtn.textContent = "🎤 음성 말하기";
  };
  recognition.start();
}

// 로그인 및 세션 바인딩
async function doLogin() {
  const verified = await verifyInviteCodeClient(els.inviteInput.value);
  if (!verified) {
    showMsg(els.gateMsg, "승인되지 않은 초대코드입니다. 본인 전용 비공개 코드를 확인해 주세요.", true);
    return;
  }
  els.gateMsg.innerHTML = "";
  enterStudio(verified);
}

els.loginBtn.addEventListener("click", doLogin);
els.inviteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
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
  updateAuthHeaderUI();
  renderCurrentDesign();
});

els.solveBtn.addEventListener("click", runFullDesignFromPrompt);
els.micBtn.addEventListener("click", toggleVoiceInput);

document.querySelectorAll(".quick-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    els.promptInput.value = chip.dataset.prompt || "";
    runFullDesignFromPrompt();
  });
});

document.querySelectorAll(".mech-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeOverrides.mechanismType = tab.dataset.mech;
    document.querySelectorAll(".mech-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    runDesignFromSliders();
  });
});

els.loadSlider.addEventListener("input", (e) => {
  activeOverrides.loadKg = Number(e.target.value);
  els.loadValLabel.textContent = `${activeOverrides.loadKg} kg`;
  runDesignFromSliders();
});

els.widthSlider.addEventListener("input", (e) => {
  activeOverrides.objWidthMm = Number(e.target.value);
  els.widthValLabel.textContent = `${activeOverrides.objWidthMm} mm`;
  runDesignFromSliders();
});

els.strokeSlider.addEventListener("input", (e) => {
  activeOverrides.strokeMm = Number(e.target.value);
  els.strokeValLabel.textContent = `${activeOverrides.strokeMm} mm`;
  runDesignFromSliders();
});

els.padSelect.addEventListener("change", (e) => {
  activeOverrides.padKey = e.target.value;
  runDesignFromSliders();
});

document.querySelectorAll(".cost-card").forEach((card) => {
  card.addEventListener("click", () => {
    activeOverrides.priority = card.dataset.prio;
    runDesignFromSliders();
  });
});

// 뷰포트 툴바 이벤트
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

els.simStrokeSlider.addEventListener("input", (e) => {
  if (isAutoCycling) {
    isAutoCycling = false;
    viewer?.setAutoCycle(false);
    els.autoCycleBtn.textContent = "▶ 자동 개폐";
  }
  const ratio = Number(e.target.value) / 100;
  viewer?.setStrokeRatio(ratio);
  updateLiveForceHud(ratio);
});

els.explodeSlider.addEventListener("input", (e) => {
  const v = Number(e.target.value);
  els.explodeLabel.textContent = `${v}%`;
  viewer?.setExplodeRatio(v / 100);
});

els.autoCycleBtn.addEventListener("click", () => {
  isAutoCycling = !isAutoCycling;
  viewer?.setAutoCycle(isAutoCycling);
  els.autoCycleBtn.textContent = isAutoCycling ? "⏸ 정지" : "▶ 자동 개폐";
});

els.workpieceToggleBtn.addEventListener("click", () => {
  isWorkpieceShown = !isWorkpieceShown;
  viewer?.setWorkpieceVisible(isWorkpieceShown);
  els.workpieceToggleBtn.textContent = isWorkpieceShown ? "📦 대상물 ON" : "📦 대상물 OFF";
});

els.downloadStepBtn.addEventListener("click", handleDownloadStep);
els.downloadBomBtn.addEventListener("click", handleDownloadBomCsv);

// 초기 진입 시 24시간 유효 저장 세션 확인
const saved = loadPersistedSession();
if (saved) {
  enterStudio(saved);
}
