import { SecureCadViewport } from "./viewer3d.js";

const els = {
  gateView: document.getElementById("gateView"),
  studioView: document.getElementById("studioView"),
  sessionBar: document.getElementById("sessionBar"),
  tierBadge: document.getElementById("tierBadge"),
  userLabel: document.getElementById("userLabel"),
  logoutBtn: document.getElementById("logoutBtn"),
  inviteCodeInput: document.getElementById("inviteCodeInput"),
  enterStudioBtn: document.getElementById("enterStudioBtn"),
  gateMsg: document.getElementById("gateMsg"),
  recordBtn: document.getElementById("recordBtn"),
  micStateLabel: document.getElementById("micStateLabel"),
  waveCanvas: document.getElementById("waveCanvas"),
  promptInput: document.getElementById("promptInput"),
  generateBtn: document.getElementById("generateBtn"),
  vaultPanel: document.getElementById("vaultPanel"),
  exportStepBtn: document.getElementById("exportStepBtn"),
  exportToast: document.getElementById("exportToast"),
  slideCode: document.getElementById("slideCode"),
  slideTitleKo: document.getElementById("slideTitleKo"),
  tab3dBtn: document.getElementById("tab3dBtn"),
  tab2dBtn: document.getElementById("tab2dBtn"),
  controls3d: document.getElementById("controls3d"),
  motionToggleBtn: document.getElementById("motionToggleBtn"),
  specTableBody: document.getElementById("specTableBody"),
  sequenceContainer: document.getElementById("sequenceContainer"),
  cadCanvas: document.getElementById("cadCanvas"),
  explodeRange: document.getElementById("explodeRange"),
  xrayToggle: document.getElementById("xrayToggle"),
  resetCamBtn: document.getElementById("resetCamBtn"),
  adminAuditCard: document.getElementById("adminAuditCard"),
  auditList: document.getElementById("auditList"),
  refreshAuditBtn: document.getElementById("refreshAuditBtn"),
};

let currentSession = null;
let currentProjectId = null;
let currentSealedVaultToken = null;
let viewport = null;
let isMotionPlaying = true;

let isRecording = false;
let recognition = null;
let mediaStream = null;
let audioCtx = null;
let animFrameId = null;
let recStartTime = 0;
let ghFallbackMod = null;

async function getGhFallback() {
  if (!ghFallbackMod) {
    ghFallbackMod = await import("./gh-pages-fallback.js");
  }
  return ghFallbackMod;
}

async function callStudioApi(endpoint, method = "GET", body) {
  try {
    const res = await fetch(`./api/${endpoint}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get("content-type") || "";
    if (res.status !== 404 && (ct.includes("application/json") || ct.includes("application/step"))) {
      return { mode: "server", res };
    }
  } catch {
    // 정적 호스팅(GitHub Pages) 폴백 전환
  }

  const gh = await getGhFallback();
  if (endpoint === "auth-session") {
    return { mode: "gh", result: await gh.ghAuthSession(method, body) };
  }
  if (endpoint === "voice-to-cad") {
    return { mode: "gh", result: await gh.ghVoiceToCad(body) };
  }
  if (endpoint === "export-step") {
    return { mode: "gh", result: await gh.ghExportStep(body) };
  }
  throw new Error("UNKNOWN_ENDPOINT");
}

function showToast(container, message, isError = false) {
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = `status-toast ${isError ? "toast-err" : "toast-ok"}`;
  div.textContent = message;
  container.appendChild(div);
}

function applySessionUI(session, recentAudits) {
  currentSession = session;
  if (!session) {
    els.gateView.classList.remove("hidden");
    els.studioView.classList.add("hidden");
    els.sessionBar.classList.add("hidden");
    els.adminAuditCard.classList.add("hidden");
    return;
  }

  els.gateView.classList.add("hidden");
  els.studioView.classList.remove("hidden");
  els.sessionBar.classList.remove("hidden");

  els.tierBadge.className = `tier-pill tier-${session.tier}`;
  els.tierBadge.textContent = session.tier.toUpperCase();
  els.userLabel.textContent = session.label;

  if (!viewport) {
    viewport = new SecureCadViewport(els.cadCanvas);
  } else {
    viewport.resize();
  }

  if (session.tier === "admin") {
    els.adminAuditCard.classList.remove("hidden");
    renderAudits(recentAudits || []);
  } else {
    els.adminAuditCard.classList.add("hidden");
  }
}

function renderAudits(audits) {
  els.auditList.innerHTML = "";
  if (!audits.length) {
    els.auditList.innerHTML = `<div class="audit-row">아직 기록된 감사 이벤트가 없습니다.</div>`;
    return;
  }
  for (const a of audits) {
    const row = document.createElement("div");
    row.className = "audit-row";
    const timeStr = new Date(a.at).toLocaleTimeString("ko-KR");
    row.textContent = `[${timeStr}] ${a.type} — ${a.detail}`;
    els.auditList.appendChild(row);
  }
}

async function checkInitialSession() {
  try {
    const out = await callStudioApi("auth-session", "GET");
    const data = out.mode === "server" ? await out.res.json() : out.result.data;
    if (data.authenticated) {
      applySessionUI(data.session, data.recentAudits);
      if (!currentProjectId) {
        els.promptInput.value =
          "가로 340 세로 240 높이 165mm 평행 타공 레일과 듀얼 적색 인장 스프링, 중앙 슬라이드 링크 및 수직 작동 로드로 구성된 클램핑 지그 설계해줘";
        await generateDesign();
      }
    } else {
      applySessionUI(null);
    }
  } catch {
    applySessionUI(null);
  }
}

async function loginWithInviteCode() {
  const inviteCode = els.inviteCodeInput.value.trim();
  if (!inviteCode) {
    showToast(els.gateMsg, "초대코드를 입력하거나 아래 등급 버튼을 클릭해 주세요.", true);
    return;
  }
  els.enterStudioBtn.disabled = true;
  try {
    const out = await callStudioApi("auth-session", "POST", { inviteCode });
    const ok = out.mode === "server" ? out.res.ok : out.result.ok;
    const data = out.mode === "server" ? await out.res.json() : out.result.data;
    if (!ok || !data.authenticated) {
      showToast(els.gateMsg, data.message || "초대코드 인증에 실패했습니다.", true);
      return;
    }
    els.gateMsg.innerHTML = "";
    await checkInitialSession();
  } catch {
    showToast(els.gateMsg, "보안 서버 통신 오류가 발생했습니다.", true);
  } finally {
    els.enterStudioBtn.disabled = false;
  }
}

async function generateDesign() {
  const transcript = els.promptInput.value.trim();
  if (!transcript) {
    showToast(els.exportToast, "먼저 마이크 녹음 또는 텍스트로 필요한 지그·기구를 설명해 주세요.", true);
    return;
  }

  els.generateBtn.disabled = true;
  els.generateBtn.textContent = "3D·2D 합성 및 AES-256-GCM 금고 봉인 중...";
  els.exportToast.innerHTML = "";

  try {
    const audioDurationSec = recStartTime
      ? Math.round((Date.now() - recStartTime) / 1000)
      : 0;
    const out = await callStudioApi("voice-to-cad", "POST", {
      transcript,
      audioDurationSec,
    });
    const ok = out.mode === "server" ? out.res.ok : out.result.ok;
    const data = out.mode === "server" ? await out.res.json() : out.result.data;
    if (!ok) {
      showToast(els.exportToast, data.message || "설계 생성 중 오류가 발생했습니다.", true);
      return;
    }

    currentProjectId = data.vault.projectId;
    currentSealedVaultToken = data.vault.sealedVaultToken;
    renderGeneratedSlide(data.preview, data.vault, data.watermarkOverlayText);
    if (currentSession?.tier === "admin") {
      await refreshAudits();
    }
  } catch {
    showToast(els.exportToast, "설계 엔진 호출에 실패했습니다.", true);
  } finally {
    els.generateBtn.disabled = false;
    els.generateBtn.textContent = "3D & 2D 모델링 생성 + 즉시 암호화 금고 봉인";
  }
}

function renderGeneratedSlide(preview, vault, watermarkOverlayText) {
  els.slideCode.textContent = preview.code;
  els.slideTitleKo.textContent = `${preview.titleKo} (${preview.dims.w}×${preview.dims.d}×${preview.dims.h} mm)`;

  els.explodeRange.value = "0";
  viewport.setExplode(0);
  viewport.setScene({
    previewBoxes: preview.previewBoxes,
    dims: preview.dims,
    drawingSpec: preview.drawingSpec,
    code: preview.code,
    titleKo: preview.titleKo,
    watermarkText: watermarkOverlayText,
  });

  els.specTableBody.innerHTML = "";
  for (const row of preview.provisions) {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    td1.textContent = row.provision;
    td2.textContent = row.description;
    tr.append(td1, td2);
    els.specTableBody.appendChild(tr);
  }

  els.sequenceContainer.innerHTML = "";
  for (const seq of preview.sequences) {
    const wrap = document.createElement("div");
    wrap.className = "seq-item";
    const u = document.createElement("div");
    u.className = "seq-unit";
    u.textContent = seq.unit;
    const f = document.createElement("div");
    f.className = "seq-flow";
    f.textContent = seq.flow;
    wrap.append(u, f);
    els.sequenceContainer.appendChild(wrap);
  }

  els.vaultPanel.innerHTML = `
    <div class="vault-kv"><span>설계 자산 ID</span><span class="mono">${vault.projectId}</span></div>
    <div class="vault-kv"><span>금고 암호화</span><span class="mono">${vault.encryption}</span></div>
    <div class="vault-kv"><span>무결성 해시</span><span class="mono">${vault.integritySha256.slice(0, 20)}...</span></div>
    <div class="vault-kv"><span>브라우저 원본 노출</span><span style="color:#34d399;font-weight:700;">0 Byte (완전 차단됨)</span></div>
    <div class="vault-kv"><span>STEP 추출 권한</span><span style="color:${vault.stepExportAllowed ? "#38bdf8" : "#fbbf24"};font-weight:700;">${vault.stepExportAllowed ? "승인됨 (" + currentSession.tier.toUpperCase() + ")" : "잠김 (PRO 이상 필요)"}</span></div>
  `;

  els.exportStepBtn.disabled = false;
}

async function exportStepFile() {
  if (!currentProjectId) return;
  els.exportStepBtn.disabled = true;
  els.exportToast.innerHTML = "";

  try {
    const ticketOut = await callStudioApi("export-step", "POST", {
      action: "request_ticket",
      projectId: currentProjectId,
      sealedVaultToken: currentSealedVaultToken,
    });
    const ticketOk = ticketOut.mode === "server" ? ticketOut.res.ok : ticketOut.result.ok;
    const ticketData =
      ticketOut.mode === "server" ? await ticketOut.res.json() : ticketOut.result.data;

    if (!ticketOk) {
      showToast(
        els.exportToast,
        `[보안 차단] ${ticketData.message || "권한이 없습니다."}`,
        true
      );
      if (currentSession?.tier === "admin") await refreshAudits();
      return;
    }

    const stepOut = await callStudioApi("export-step", "POST", {
      action: "download_step",
      projectId: currentProjectId,
      sealedVaultToken: currentSealedVaultToken,
      ticket: ticketData.ticket,
    });

    let watermarkId = "DRM";
    let stepBlob;

    if (stepOut.mode === "server") {
      if (!stepOut.res.ok) {
        const errJson = await stepOut.res.json().catch(() => ({}));
        showToast(
          els.exportToast,
          errJson.message || "STEP 추출 중 보안 검증에 실패했습니다.",
          true
        );
        return;
      }
      watermarkId = stepOut.res.headers.get("X-Forensic-Watermark-Id") || "DRM";
      stepBlob = await stepOut.res.blob();
    } else {
      if (!stepOut.result.ok) {
        showToast(
          els.exportToast,
          stepOut.result.data?.message || "STEP 추출 권한이 없습니다.",
          true
        );
        return;
      }
      watermarkId = stepOut.result.watermarkId;
      stepBlob = new Blob([stepOut.result.stepText], { type: "application/step" });
    }

    const downloadUrl = URL.createObjectURL(stepBlob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${currentProjectId}_${watermarkId}.step`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

    showToast(
      els.exportToast,
      `추출 완료: ${currentProjectId}_${watermarkId}.step (원통·육각·박스 B-Rep 솔리드 어셈블리 / 포렌식 전자지문 ${watermarkId} 각인됨)`
    );

    if (currentSession?.tier === "admin") await refreshAudits();
  } catch {
    showToast(els.exportToast, "STEP 파일 다운로드 중 네트워크 오류가 발생했습니다.", true);
  } finally {
    els.exportStepBtn.disabled = false;
  }
}

async function refreshAudits() {
  const out = await callStudioApi("auth-session", "GET");
  const data = out.mode === "server" ? await out.res.json() : out.result.data;
  if (data.recentAudits) renderAudits(data.recentAudits);
}

async function toggleVoiceRecording() {
  if (isRecording) {
    stopVoiceRecording();
    return;
  }

  recStartTime = Date.now();
  isRecording = true;
  els.recordBtn.textContent = "녹음 종료";
  els.micStateLabel.textContent = "실시간 음성 인식 중...";
  els.micStateLabel.style.color = "#fb7185";

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(mediaStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    const dataArr = new Uint8Array(analyser.frequencyBinCount);
    const wCtx = els.waveCanvas.getContext("2d");

    const drawWave = () => {
      if (!isRecording) return;
      animFrameId = requestAnimationFrame(drawWave);
      analyser.getByteTimeDomainData(dataArr);
      wCtx.clearRect(0, 0, els.waveCanvas.width, els.waveCanvas.height);
      wCtx.strokeStyle = "#38bdf8";
      wCtx.lineWidth = 2;
      wCtx.beginPath();
      const slice = els.waveCanvas.width / dataArr.length;
      let x = 0;
      for (let i = 0; i < dataArr.length; i++) {
        const v = dataArr[i] / 128.0;
        const y = (v * els.waveCanvas.height) / 2;
        if (i === 0) wCtx.moveTo(x, y);
        else wCtx.lineTo(x, y);
        x += slice;
      }
      wCtx.stroke();
    };
    drawWave();
  } catch {
    els.micStateLabel.textContent = "마이크 권한 확인 필요 (텍스트 입력 가능)";
  }

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    recognition = new SpeechRec();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    const baseText = els.promptInput.value ? els.promptInput.value + " " : "";

    recognition.onresult = (event) => {
      let transcriptChunk = "";
      for (let i = 0; i < event.results.length; i++) {
        transcriptChunk += event.results[i][0].transcript;
      }
      els.promptInput.value = baseText + transcriptChunk;
    };
    recognition.onerror = () => stopVoiceRecording();
    recognition.start();
  }
}

function stopVoiceRecording() {
  isRecording = false;
  els.recordBtn.textContent = "마이크 음성 녹음";
  els.micStateLabel.textContent = "녹음 완료";
  els.micStateLabel.style.color = "#34d399";

  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

// 3D / 2D 탭 전환 및 동작 제어
els.tab3dBtn.addEventListener("click", () => {
  els.tab3dBtn.classList.add("active");
  els.tab2dBtn.classList.remove("active");
  els.controls3d.classList.remove("hidden");
  if (viewport) viewport.setMode("3d");
});

els.tab2dBtn.addEventListener("click", () => {
  els.tab2dBtn.classList.add("active");
  els.tab3dBtn.classList.remove("active");
  els.controls3d.classList.add("hidden");
  if (viewport) viewport.setMode("2d");
});

els.motionToggleBtn.addEventListener("click", () => {
  isMotionPlaying = !isMotionPlaying;
  els.motionToggleBtn.textContent = isMotionPlaying
    ? "기구 동작 일시정지"
    : "기구 동작 재생";
  if (viewport) viewport.setPlaying(isMotionPlaying);
});

els.enterStudioBtn.addEventListener("click", loginWithInviteCode);
els.inviteCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginWithInviteCode();
});

document.querySelectorAll(".chip-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    els.inviteCodeInput.value = btn.dataset.code || "";
    loginWithInviteCode();
  });
});

els.logoutBtn.addEventListener("click", async () => {
  await callStudioApi("auth-session", "POST", { action: "logout" });
  currentProjectId = null;
  currentSealedVaultToken = null;
  applySessionUI(null);
});

document.querySelectorAll(".preset-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    els.promptInput.value = btn.dataset.prompt || "";
    generateDesign();
  });
});

els.recordBtn.addEventListener("click", toggleVoiceRecording);
els.generateBtn.addEventListener("click", generateDesign);
els.exportStepBtn.addEventListener("click", exportStepFile);
els.refreshAuditBtn.addEventListener("click", refreshAudits);

els.explodeRange.addEventListener("input", (e) => {
  if (viewport) viewport.setExplode(Number(e.target.value) / 100);
});
els.xrayToggle.addEventListener("change", (e) => {
  if (viewport) viewport.setXray(e.target.checked);
});
els.resetCamBtn.addEventListener("click", () => {
  if (viewport) viewport.resetCamera();
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "u")) {
    e.preventDefault();
  }
});

checkInitialSession();
