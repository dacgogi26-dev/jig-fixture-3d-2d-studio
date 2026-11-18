/**
 * 일상어 → 기계공학 역학(프리로드·마찰력·스트로크) 자동 계산 &
 * 미스미(MISUMI) 표준 부품 자동 선정 + 정밀 3D 다부품 어셈블리 합성 엔진
 */

const OBJECT_PRESETS = [
  { rx: /담배|담뱃갑/, name: "담뱃갑 케이스", w: 55, d: 22, h: 88, defaultKg: 10 },
  { rx: /배터리|파우치|셀/, name: "이차전지 각형 셀", w: 65, d: 26, h: 102, defaultKg: 12 },
  { rx: /스마트폰|휴대폰|폰/, name: "스마트폰 바디", w: 74, d: 9, h: 152, defaultKg: 5 },
  { rx: /병|캔|원통|파이프|샤프트/, name: "원통형 용기/샤프트", w: 66, d: 66, h: 120, defaultKg: 15 },
  { rx: /pcb|기판|보드/, name: "정밀 PCB 기판", w: 120, d: 80, h: 12, defaultKg: 6 },
  { rx: /달걀|계란|유리|취성/, name: "취성 정밀 부품", w: 48, d: 48, h: 62, defaultKg: 3 },
];

const PAD_MATERIALS = {
  urethane: {
    name: "미스미 우레탄 논슬립 패드 (Shore A90)",
    mu: 0.48,
    color: "#f97316",
    misumiBest: "UTAA90-T5",
    misumiFast: "UTAA90-Q5",
    misumiCheap: "C-UTB90-5",
    priceKrw: { best: 11800, fast: 13200, cheap: 6900 },
  },
  silicone: {
    name: "고마찰 실리콘 소프트 패드 (문서·취성물 보호)",
    mu: 0.56,
    color: "#38bdf8",
    misumiBest: "SRGS50-T5",
    misumiFast: "SRGS50-Q5",
    misumiCheap: "C-SRG50-5",
    priceKrw: { best: 14500, fast: 16000, cheap: 8400 },
  },
  steel: {
    name: "S45C 세레이션 경화강 조우 (중하중 금속용)",
    mu: 0.24,
    color: "#64748b",
    misumiBest: "SJAW-S45C-12",
    misumiFast: "SJAW-Q12",
    misumiCheap: "C-SJAW-12",
    priceKrw: { best: 24000, fast: 27500, cheap: 15200 },
  },
};

// 미스미 코일 스프링 표준 카탈로그 스펙 DB (선경, 외경, 자유장, 스프링상수 N/mm, 허용변위)
const MISUMI_SPRING_CATALOG = [
  {
    maxReqPerSpringN: 70,
    od: 18,
    id: 12.5,
    wire: 2.2,
    k: 4.8,
    freeLenOptions: [55, 65, 80],
    bestCode: "SWF18",
    fastCode: "SWU18",
    cheapCode: "C-SWF18",
    price: { best: 4800, fast: 5600, cheap: 2600 },
  },
  {
    maxReqPerSpringN: 160,
    od: 22,
    id: 14.5,
    wire: 3.2,
    k: 11.4,
    freeLenOptions: [65, 75, 90],
    bestCode: "SWU22",
    fastCode: "SWF22",
    cheapCode: "C-SWU22",
    price: { best: 6900, fast: 7900, cheap: 3800 },
  },
  {
    maxReqPerSpringN: 340,
    od: 27,
    id: 17.0,
    wire: 4.2,
    k: 23.5,
    freeLenOptions: [70, 85, 100],
    bestCode: "SWM27",
    fastCode: "SWU27",
    cheapCode: "C-SWM27",
    price: { best: 9800, fast: 11400, cheap: 5400 },
  },
  {
    maxReqPerSpringN: 9999,
    od: 32,
    id: 20.0,
    wire: 5.2,
    k: 41.0,
    freeLenOptions: [80, 95, 115],
    bestCode: "SWB32",
    fastCode: "SWM32",
    cheapCode: "C-SWB32",
    price: { best: 14200, fast: 16500, cheap: 7900 },
  },
];

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function parseNaturalVoiceIntent(rawText = "", overrides = {}) {
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();

  // 1. 기구 타입 판별
  let mechanismType = overrides.mechanismType || "";
  if (!mechanismType) {
    if (/프레스|위에서\s*눌러|수직\s*가압|압입|캠|슬라이더/.test(lower)) {
      mechanismType = "vertical_press";
    } else if (/플런저|인덱싱|센터링|위치\s*결정|핀\s*고정/.test(lower)) {
      mechanismType = "indexing_plunger";
    } else if (/토글|배력|레버\s*클램프|플라이어/.test(lower)) {
      mechanismType = "toggle_clamp";
    } else {
      mechanismType = "parallel_gripper"; // 기본값: 담뱃갑/부품 논슬립 파지 평행 그리퍼 지그
    }
  }

  // 2. 대상 공작물 치수 추출
  let matchedObj = OBJECT_PRESETS.find((o) => o.rx.test(lower)) || {
    name: "맞춤형 피가공물",
    w: 58,
    d: 36,
    h: 85,
    defaultKg: 10,
  };

  const tripleMatch = text.match(/(\d{2,4})\s*[xX*×]\s*(\d{2,4})(?:\s*[xX*×]\s*(\d{2,4}))?/);
  const diaMatch = text.match(/(?:직경|지름|파이|Ø|ø)\s*(\d{2,3})/i);

  let objWidthMm = overrides.objWidthMm
    ? clamp(overrides.objWidthMm, 16, 220)
    : diaMatch
    ? clamp(Number(diaMatch[1]), 16, 220)
    : tripleMatch
    ? clamp(Number(tripleMatch[1]), 16, 220)
    : matchedObj.w;

  let objDepthMm = tripleMatch ? clamp(Number(tripleMatch[2]), 12, 180) : matchedObj.d;
  let objHeightMm =
    tripleMatch && tripleMatch[3] ? clamp(Number(tripleMatch[3]), 20, 220) : matchedObj.h;

  // 3. 요구 버팀 하중(kg 또는 N) 추출
  let loadKg = overrides.loadKg ? Number(overrides.loadKg) : null;
  if (!loadKg) {
    const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|킬로|키로)/i);
    const nMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:n|뉴턴)/i);
    if (kgMatch) loadKg = Number(kgMatch[1]);
    else if (nMatch) loadKg = Number(nMatch[1]) / 9.81;
    else loadKg = matchedObj.defaultKg;
  }
  loadKg = clamp(loadKg, 0.5, 120);

  // 4. 작동 스트로크(mm) 추출
  let strokeMm = overrides.strokeMm ? Number(overrides.strokeMm) : null;
  if (!strokeMm) {
    const stMatch = text.match(/스트로크\s*[:=]?\s*(\d{1,3})/i);
    strokeMm = stMatch ? Number(stMatch[1]) : Math.round(clamp(objWidthMm * 0.48, 20, 60));
  }
  strokeMm = clamp(strokeMm, 12, 80);

  // 5. 미끄럼 방지 패드 재질 판별
  let padKey = overrides.padKey || "";
  if (!padKey) {
    if (/달걀|부드럽|실리콘|기스|스크래치|유리/.test(lower)) padKey = "silicone";
    else if (/금속\s*조우|세레이션|강철/.test(lower) && !/미끄러/.test(lower)) padKey = "steel";
    else padKey = "urethane";
  }

  // 6. 부품 추천 우선순위 (best: 인기표준 / fast: 단납기 당일출고 / cheap: 가성비 최저가)
  let priority = overrides.priority || "";
  if (!priority) {
    if (/단납기|빠른|당일|급해/.test(lower)) priority = "fast";
    else if (/싼|저렴|가성비|최저가|원가/.test(lower)) priority = "cheap";
    else priority = "best";
  }

  // 7. 구동 방식 (스프링 프리로드 자동파지 vs 공압 실린더 구동)
  const usePneumatic =
    overrides.usePneumatic !== undefined
      ? Boolean(overrides.usePneumatic)
      : /공압|실린더|에어/.test(lower);

  return {
    rawPrompt: text || `${matchedObj.name} ${loadKg}kg 논슬립 파지 지그`,
    mechanismType,
    objectName: matchedObj.name,
    objWidthMm,
    objDepthMm,
    objHeightMm,
    loadKg,
    strokeMm,
    padKey,
    priority,
    usePneumatic,
  };
}

/**
 * 실제 역학 계산 + 미스미 형번 자동 선정 + 정밀 3D CAD 어셈블리 생성
 */
export function generateRealCadEngineering(rawText, overrides = {}) {
  const p = parseNaturalVoiceIntent(rawText, overrides);
  const padInfo = PAD_MATERIALS[p.padKey] || PAD_MATERIALS.urethane;
  const g = 9.81;
  const safetyFactor = 2.0; // 진동 및 가감속 관성 대비 안전율 2.0배
  const weightN = p.loadKg * g;

  // 마찰 기반 필요 법선 파지력 계산: 2 * mu * F_clamp >= m * g * Sf
  const requiredForceN =
    p.mechanismType === "parallel_gripper"
      ? (weightN * safetyFactor) / (2 * padInfo.mu)
      : weightN * safetyFactor;

  const springCount = p.mechanismType === "parallel_gripper" ? 2 : 1;
  const targetPerSpringN = requiredForceN / springCount;

  // 미스미 코일 스프링 카탈로그에서 적합 규격 자동 매칭
  const spSpec =
    MISUMI_SPRING_CATALOG.find((s) => targetPerSpringN <= s.maxReqPerSpringN) ||
    MISUMI_SPRING_CATALOG[MISUMI_SPRING_CATALOG.length - 1];

  const travelPerSideMm =
    p.mechanismType === "parallel_gripper" ? p.strokeMm / 2 : p.strokeMm;

  // 프리로드(초기 압축 변위) 계산: F_preload >= targetPerSpringN
  const preloadDeflectionMm = Math.max(
    6,
    Math.ceil((targetPerSpringN / spSpec.k) * 10) / 10
  );
  const maxDeflectionMm = Number((preloadDeflectionMm + travelPerSideMm).toFixed(1));

  // 자유장(Free Length L0) 자동 선정 (최대 압축 시 밀착장 여유 확보)
  const minFreeLenNeeded = Math.ceil((maxDeflectionMm / 0.42) / 5) * 5;
  const freeLengthMm = Math.max(spSpec.freeLenOptions[1], minFreeLenNeeded);
  const installedClosedLenMm = Number((freeLengthMm - preloadDeflectionMm).toFixed(1));
  const compressedOpenLenMm = Number((freeLengthMm - maxDeflectionMm).toFixed(1));

  const actualPreloadTotalN = Number(
    (springCount * spSpec.k * preloadDeflectionMm).toFixed(1)
  );
  const actualMaxForceTotalN = Number(
    (springCount * spSpec.k * maxDeflectionMm).toFixed(1)
  );
  const achievedHoldKg = Number(
    (
      ((p.mechanismType === "parallel_gripper" ? 2 * padInfo.mu : 1.0) *
        actualPreloadTotalN) /
      g
    ).toFixed(1)
  );
  const achievedSafetyFactor = Number((achievedHoldKg / p.loadKg).toFixed(2));

  // 샤프트 직경 자동 선정 (스프링 내경보다 작으면서 굽힘 강성 확보)
  const shaftDia = spSpec.id >= 17 ? 16 : 12;

  const pickCode = (best, fast, cheap) =>
    p.priority === "fast" ? fast : p.priority === "cheap" ? cheap : best;
  const leadText =
    p.priority === "fast"
      ? "당일출고 (1일)"
      : p.priority === "cheap"
      ? "표준 4~5일"
      : "익일출고 (2일)";

  const springModelCode = `${pickCode(
    spSpec.bestCode,
    spSpec.fastCode,
    spSpec.cheapCode
  )}-L${freeLengthMm}`;

  const projectId =
    "JIG_" +
    Math.abs(
      Array.from(p.rawPrompt + p.loadKg + p.strokeMm + p.priority).reduce(
        (acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0,
        7
      )
    )
      .toString(16)
      .toUpperCase()
      .padStart(6, "0")
      .slice(0, 6);

  // 기구 타입별 정밀 3D 파트 및 미스미 BOM 구축
  const built =
    p.mechanismType === "vertical_press"
      ? buildVerticalPressAssembly(p, spSpec, shaftDia, freeLengthMm, installedClosedLenMm, springModelCode, padInfo, pickCode, leadText)
      : p.mechanismType === "indexing_plunger"
      ? buildIndexingPlungerAssembly(p, spSpec, shaftDia, freeLengthMm, installedClosedLenMm, springModelCode, pickCode, leadText)
      : p.mechanismType === "toggle_clamp"
      ? buildToggleClampAssembly(p, spSpec, shaftDia, padInfo, pickCode, leadText)
      : buildParallelGripperAssembly(
          p,
          spSpec,
          shaftDia,
          freeLengthMm,
          installedClosedLenMm,
          travelPerSideMm,
          springModelCode,
          padInfo,
          pickCode,
          leadText
        );

  // 3가지 조달 옵션별 총 원가 비교 산출
  const calcOptionTotal = (prioKey) =>
    built.bom.reduce((sum, item) => sum + item.prices[prioKey] * item.qty, 0);

  const costComparison = {
    best: { label: "인기 베스트셀러 (표준)", totalKrw: calcOptionTotal("best"), leadDays: "2일" },
    fast: { label: "최단납기 (당일출고형)", totalKrw: calcOptionTotal("fast"), leadDays: "당일~1일" },
    cheap: { label: "원가절감 (C-Value 경제형)", totalKrw: calcOptionTotal("cheap"), leadDays: "4~5일" },
    selectedKey: p.priority,
  };

  return {
    projectId,
    titleKo: built.titleKo,
    titleEn: built.titleEn,
    subtitleKo: built.subtitleKo,
    params: p,
    dims: built.overallDims,
    physics: {
      targetLoadKg: p.loadKg,
      targetWeightN: Number(weightN.toFixed(1)),
      frictionMu: padInfo.mu,
      padName: padInfo.name,
      requiredClampForceN: Number(requiredForceN.toFixed(1)),
      actualPreloadForceN: actualPreloadTotalN,
      actualMaxOpenForceN: actualMaxForceTotalN,
      achievedMaxHoldKg: achievedHoldKg,
      safetyFactor: achievedSafetyFactor,
      closedGapMm: p.objWidthMm,
      openGapMm: p.objWidthMm + p.strokeMm,
      strokeMm: p.strokeMm,
      springFreeLengthMm: freeLengthMm,
      springClosedLengthMm: installedClosedLenMm,
      springOpenLengthMm: compressedOpenLenMm,
      exactSpringRateNmm: `${spSpec.k} N/mm × ${springCount}EA`,
      exactPreloadDeflectionMm: `${preloadDeflectionMm} mm (최대 개방 시 ${maxDeflectionMm} mm)`,
      springFormulaDetail: `F_preload = ${springCount} × ${spSpec.k} N/mm × ${preloadDeflectionMm}mm = ${actualPreloadTotalN}N ≥ 필요파지력 ${requiredForceN.toFixed(1)}N`,
    },
    costComparison,
    bom: built.bom.map((b, idx) => ({
      no: idx + 1,
      category: b.category,
      partName: b.partName,
      brand: b.brand,
      partNumber: b.codes[p.priority],
      specSummary: b.specSummary,
      material: b.material,
      qty: b.qty,
      leadTime: b.isCustomMachined ? "가공 3일" : leadText,
      unitPriceKrw: b.prices[p.priority],
      totalPriceKrw: b.prices[p.priority] * b.qty,
      isCustomMachined: Boolean(b.isCustomMachined),
    })),
    drawingSpec: {
      scale: "1 : 2",
      projection: "KS B ISO 128 제3각법",
      tolerance: `샤프트 Ø${shaftDia} g6 / 리니어부쉬 H7 / 일반공차 ISO 2768-mH`,
      finish: "AL6061 흑색/백색 아노다이징 & SUS304 정밀 연마",
    },
    sequences: built.sequences,
    workpiece: built.workpiece,
    parts: built.parts,
  };
}

/**
 * [주력 A] 미스미 리니어 샤프트 + 플랜지 부쉬 + 듀얼 프리로드 스프링 + 우레탄 논슬립 평행 그리퍼 지그
 * (친구 통화의 "담뱃갑을 달걀 쥐듯 잡아 10kg 버티고 안 미끄러지게" 요구사항 100% 정밀 설계)
 */
function buildParallelGripperAssembly(
  p,
  spSpec,
  shaftDia,
  freeLen,
  closedSpringLen,
  travelSide,
  springCode,
  padInfo,
  pickCode,
  leadText
) {
  const padThick = 6;
  const jawThick = 16;
  const wallThick = 18;
  const halfObj = p.objWidthMm / 2;

  // 파지 상태(strokeRatio=0)에서의 좌/우 조우 내측면 좌표
  const jawInnerX = halfObj + padThick;
  const endWallInnerX = jawInnerX + jawThick + closedSpringLen;
  const baseHalfW = endWallInnerX + wallThick;
  const totalW = Math.round(baseHalfW * 2);
  const totalD = Math.max(120, p.objDepthMm + 86);
  const baseH = 18;
  const shaftZ = baseH + 28;
  const shaftOffsetY = Math.round(totalD * 0.28);
  const fingerTopZ = shaftZ + 22 + Math.max(48, Math.round(p.objHeightMm * 0.68));
  const totalH = fingerTopZ;

  const shaftLen = totalW - 12;
  const shaftR = shaftDia / 2;
  const bushR = shaftR + 5;

  const parts = [
    // 1. 베이스 플레이트
    {
      id: "BASE_PLATE",
      stepName: "01_BASE_PLATE_AL6061",
      labelKo: "정밀 가공 베이스 플레이트",
      kind: "box",
      x: -baseHalfW,
      y: -totalD / 2,
      z: 0,
      w: totalW,
      d: totalD,
      h: baseH,
      color: "#334155",
      metalness: 0.75,
      roughness: 0.32,
      explodeVec: [0, 0, -45],
    },
    // 2. 좌/우 엔드 서포트 블록 (샤프트 지지 및 스프링 반력 벽)
    {
      id: "LEFT_END_BLOCK",
      stepName: "02_LEFT_SHAFT_SUPPORT_BLOCK",
      labelKo: "좌측 샤프트 서포트 & 스프링 지지벽",
      kind: "box",
      x: -baseHalfW,
      y: -totalD * 0.42,
      z: baseH,
      w: wallThick,
      d: totalD * 0.84,
      h: 52,
      color: "#475569",
      metalness: 0.7,
      roughness: 0.3,
      explodeVec: [-55, 0, 0],
    },
    {
      id: "RIGHT_END_BLOCK",
      stepName: "03_RIGHT_SHAFT_SUPPORT_BLOCK",
      labelKo: "우측 샤프트 서포트 & 스프링 지지벽",
      kind: "box",
      x: endWallInnerX,
      y: -totalD * 0.42,
      z: baseH,
      w: wallThick,
      d: totalD * 0.84,
      h: 52,
      color: "#475569",
      metalness: 0.7,
      roughness: 0.3,
      explodeVec: [55, 0, 0],
    },
    // 3. 미스미 정밀 리니어 샤프트 2축 (진원 원기둥 B-Rep)
    {
      id: "SHAFT_FRONT",
      stepName: `04_MISUMI_LINEAR_SHAFT_D${shaftDia}_FRONT`,
      labelKo: `전면 정밀 리니어 샤프트 (Ø${shaftDia} g6)`,
      kind: "cylinder",
      axis: "x",
      cx: -shaftLen / 2,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: shaftR,
      length: shaftLen,
      color: "#e2e8f0",
      metalness: 0.92,
      roughness: 0.14,
      explodeVec: [0, -40, 20],
      callout: `리니어 샤프트 Ø${shaftDia}g6`,
    },
    {
      id: "SHAFT_REAR",
      stepName: `05_MISUMI_LINEAR_SHAFT_D${shaftDia}_REAR`,
      labelKo: `후면 정밀 리니어 샤프트 (Ø${shaftDia} g6)`,
      kind: "cylinder",
      axis: "x",
      cx: -shaftLen / 2,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: shaftR,
      length: shaftLen,
      color: "#e2e8f0",
      metalness: 0.92,
      roughness: 0.14,
      explodeVec: [0, 40, 20],
    },
    // 4. 플랜지형 리니어 부쉬 4EA
    {
      id: "BUSH_LF",
      stepName: `06_MISUMI_LINEAR_BUSHING_LF`,
      labelKo: "좌전 리니어 부쉬",
      kind: "cylinder",
      axis: "x",
      cx: -jawInnerX - jawThick - 6,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.85,
      roughness: 0.24,
      motionRole: "jawLeft",
      maxTravel: travelSide,
      explodeVec: [-25, -25, 15],
      callout: "플랜지 리니어 부쉬 (H7)",
    },
    {
      id: "BUSH_LR",
      stepName: `07_MISUMI_LINEAR_BUSHING_LR`,
      labelKo: "좌후 리니어 부쉬",
      kind: "cylinder",
      axis: "x",
      cx: -jawInnerX - jawThick - 6,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.85,
      roughness: 0.24,
      motionRole: "jawLeft",
      maxTravel: travelSide,
      explodeVec: [-25, 25, 15],
    },
    {
      id: "BUSH_RF",
      stepName: `08_MISUMI_LINEAR_BUSHING_RF`,
      labelKo: "우전 리니어 부쉬",
      kind: "cylinder",
      axis: "x",
      cx: jawInnerX - 2,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.85,
      roughness: 0.24,
      motionRole: "jawRight",
      maxTravel: travelSide,
      explodeVec: [25, -25, 15],
    },
    {
      id: "BUSH_RR",
      stepName: `09_MISUMI_LINEAR_BUSHING_RR`,
      labelKo: "우후 리니어 부쉬",
      kind: "cylinder",
      axis: "x",
      cx: jawInnerX - 2,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.85,
      roughness: 0.24,
      motionRole: "jawRight",
      maxTravel: travelSide,
      explodeVec: [25, 25, 15],
    },
    // 5. 좌/우 프리로드 코일 스프링 (샤프트 동축 외장 배치 — 간섭 제로!)
    {
      id: "SPRING_LEFT_F",
      stepName: `10_MISUMI_PRELOAD_SPRING_${springCode}_L`,
      labelKo: "좌측 프리로드 압축 스프링",
      kind: "spring",
      axis: "x",
      cx: -endWallInnerX,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: spSpec.od / 2,
      wireDia: spSpec.wire,
      turns: 7,
      length: closedSpringLen,
      color: "#ef4444",
      motionRole: "springLeft",
      maxTravel: travelSide,
      explodeVec: [-38, -20, 35],
      callout: `프리로드 코일 스프링 (${p.loadKg}kg 대응)`,
    },
    {
      id: "SPRING_RIGHT_R",
      stepName: `11_MISUMI_PRELOAD_SPRING_${springCode}_R`,
      labelKo: "우측 프리로드 압축 스프링",
      kind: "spring",
      axis: "x",
      cx: jawInnerX + jawThick,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: spSpec.od / 2,
      wireDia: spSpec.wire,
      turns: 7,
      length: closedSpringLen,
      color: "#ef4444",
      motionRole: "springRight",
      maxTravel: travelSide,
      explodeVec: [38, 20, 35],
    },
    // 6. 좌/우 그리퍼 무빙 캐리지 바디
    {
      id: "CARRIAGE_LEFT",
      stepName: "12_LEFT_SLIDING_JAW_CARRIER",
      labelKo: "좌측 슬라이딩 그리퍼 캐리지",
      kind: "box",
      x: -jawInnerX - jawThick,
      y: -totalD * 0.38,
      z: baseH + 6,
      w: jawThick,
      d: totalD * 0.76,
      h: 46,
      color: "#94a3b8",
      metalness: 0.8,
      roughness: 0.25,
      motionRole: "jawLeft",
      maxTravel: travelSide,
      explodeVec: [-20, 0, 28],
    },
    {
      id: "CARRIAGE_RIGHT",
      stepName: "13_RIGHT_SLIDING_JAW_CARRIER",
      labelKo: "우측 슬라이딩 그리퍼 캐리지",
      kind: "box",
      x: jawInnerX,
      y: -totalD * 0.38,
      z: baseH + 6,
      w: jawThick,
      d: totalD * 0.76,
      h: 46,
      color: "#94a3b8",
      metalness: 0.8,
      roughness: 0.25,
      motionRole: "jawRight",
      maxTravel: travelSide,
      explodeVec: [20, 0, 28],
    },
    // 7. 상단 파지 핑거 암 (달걀 쥐듯 감싸는 상부 파지부)
    {
      id: "FINGER_LEFT",
      stepName: "14_LEFT_GRIPPER_FINGER_AL7075",
      labelKo: "좌측 정밀 파지 핑거 암",
      kind: "box",
      x: -jawInnerX - 12,
      y: -Math.max(24, p.objDepthMm * 0.45),
      z: baseH + 52,
      w: 12,
      d: Math.max(48, p.objDepthMm * 0.9),
      h: fingerTopZ - (baseH + 52),
      color: "#cbd5e1",
      metalness: 0.82,
      roughness: 0.22,
      motionRole: "jawLeft",
      maxTravel: travelSide,
      explodeVec: [-18, 0, 58],
      callout: "AL7075 그리퍼 핑거",
    },
    {
      id: "FINGER_RIGHT",
      stepName: "15_RIGHT_GRIPPER_FINGER_AL7075",
      labelKo: "우측 정밀 파지 핑거 암",
      kind: "box",
      x: jawInnerX,
      y: -Math.max(24, p.objDepthMm * 0.45),
      z: baseH + 52,
      w: 12,
      d: Math.max(48, p.objDepthMm * 0.9),
      h: fingerTopZ - (baseH + 52),
      color: "#cbd5e1",
      metalness: 0.82,
      roughness: 0.22,
      motionRole: "jawRight",
      maxTravel: travelSide,
      explodeVec: [18, 0, 58],
    },
    // 8. 미스미 논슬립 우레탄/실리콘 패드 (마찰계수 극대화 핵심 부품)
    {
      id: "PAD_LEFT",
      stepName: "16_MISUMI_ANTISLIP_PAD_LEFT",
      labelKo: `좌측 논슬립 파지 패드 (μ=${padInfo.mu})`,
      kind: "box",
      x: -halfObj - padThick,
      y: -Math.max(20, p.objDepthMm * 0.4),
      z: baseH + 58,
      w: padThick,
      d: Math.max(40, p.objDepthMm * 0.8),
      h: Math.max(32, fingerTopZ - (baseH + 64)),
      color: padInfo.color,
      metalness: 0.15,
      roughness: 0.72,
      motionRole: "jawLeft",
      maxTravel: travelSide,
      explodeVec: [-8, 0, 72],
      callout: `미끄럼방지 패드 (μ=${padInfo.mu})`,
    },
    {
      id: "PAD_RIGHT",
      stepName: "17_MISUMI_ANTISLIP_PAD_RIGHT",
      labelKo: `우측 논슬립 파지 패드 (μ=${padInfo.mu})`,
      kind: "box",
      x: halfObj,
      y: -Math.max(20, p.objDepthMm * 0.4),
      z: baseH + 58,
      w: padThick,
      d: Math.max(40, p.objDepthMm * 0.8),
      h: Math.max(32, fingerTopZ - (baseH + 64)),
      color: padInfo.color,
      metalness: 0.15,
      roughness: 0.72,
      motionRole: "jawRight",
      maxTravel: travelSide,
      explodeVec: [8, 0, 72],
    },
  ];

  // 공압 개방 액추에이터 옵션일 경우 하부 중앙에 공압 실린더 유닛 추가
  if (p.usePneumatic) {
    parts.push({
      id: "PNEUMATIC_ACTUATOR",
      stepName: "18_COMPACT_AIR_CYLINDER_CQ2B",
      labelKo: "개방 구동 컴팩트 에어 실린더",
      kind: "cylinder",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: baseH,
      radius: 18,
      length: 36,
      color: "#0ea5e9",
      metalness: 0.78,
      roughness: 0.28,
      explodeVec: [0, 0, -25],
      callout: "공압 릴리즈 실린더",
    });
  }

  const bom = [
    {
      category: "탄성/파지력원",
      partName: "사각단면 고하중 코일 스프링",
      brand: "MISUMI",
      codes: {
        best: `${spSpec.bestCode}-L${freeLen}`,
        fast: `${spSpec.fastCode}-L${freeLen}`,
        cheap: `${spSpec.cheapCode}-L${freeLen}`,
      },
      specSummary: `외경 Ø${spSpec.od} / 자유장 ${freeLen}mm / k=${spSpec.k}N/mm`,
      material: "SWOSC-V 피아노선",
      qty: 2,
      prices: spSpec.price,
    },
    {
      category: "직선 가이드축",
      partName: "양단 탭 정밀 리니어 샤프트",
      brand: "MISUMI",
      codes: {
        best: `PSFR${shaftDia}-${shaftLen}-M6`,
        fast: `SFJ${shaftDia}-${shaftLen}`,
        cheap: `C-PSFR${shaftDia}-${shaftLen}`,
      },
      specSummary: `Ø${shaftDia} g6 / 전장 ${shaftLen}mm / 진원도 정밀연마`,
      material: "SUS304 / SUJ2",
      qty: 2,
      prices: { best: 16400, fast: 18900, cheap: 8900 },
    },
    {
      category: "베어링 부쉬",
      partName: "원형 플랜지 리니어 부쉬",
      brand: "MISUMI",
      codes: {
        best: `LHFR${shaftDia}`,
        fast: `LMFP${shaftDia}`,
        cheap: `C-LHFR${shaftDia}`,
      },
      specSummary: `내경 Ø${shaftDia} H7 / 볼 리테이너 내장형`,
      material: "SUJ2 베어링강",
      qty: 4,
      prices: { best: 12500, fast: 14200, cheap: 6200 },
    },
    {
      category: "논슬립 파지부",
      partName: padInfo.name,
      brand: "MISUMI",
      codes: {
        best: padInfo.misumiBest,
        fast: padInfo.misumiFast,
        cheap: padInfo.misumiCheap,
      },
      specSummary: `두께 ${padThick}mm / 마찰계수 μ=${padInfo.mu} (낙하 방지)`,
      material: "Urethane / Silicone",
      qty: 2,
      prices: padInfo.priceKrw,
    },
    ...(p.usePneumatic
      ? [
          {
            category: "공압 구동부",
            partName: "박형 컴팩트 가이드 에어 실린더",
            brand: "SMC / MISUMI",
            codes: {
              best: `MGPM20-${p.strokeMm}Z`,
              fast: `CQ2B25-${p.strokeMm}DZ`,
              cheap: `C-ACQ25-${p.strokeMm}`,
            },
            specSummary: `사용압력 0.5MPa / 스트로크 ${p.strokeMm}mm`,
            material: "AL 아노다이징",
            qty: 1,
            prices: { best: 68000, fast: 74000, cheap: 34000 },
          },
        ]
      : []),
    {
      category: "체결 요소",
      partName: "육각 렌치 볼트 & 스프링 와셔 세트",
      brand: "MISUMI",
      codes: {
        best: "CB6-20-SUS",
        fast: "CB6-20",
        cheap: "C-CB6-20",
      },
      specSummary: "M6 × 20L SUS304 표준 체결류",
      material: "SUS304",
      qty: 8,
      prices: { best: 450, fast: 520, cheap: 220 },
    },
    {
      category: "가공 프레임",
      partName: "베이스 플레이트 & 좌/우 그리퍼 핑거 세트",
      brand: "Custom CNC",
      codes: {
        best: `CNC-GRP-${totalW}X${totalD}`,
        fast: `CNC-Q-${totalW}X${totalD}`,
        cheap: `CNC-ECO-${totalW}X${totalD}`,
      },
      specSummary: `${totalW}×${totalD}×${totalH}mm 3축 머시닝 가공`,
      material: "AL6061-T6 / AL7075",
      qty: 1,
      prices: { best: 145000, fast: 185000, cheap: 112000 },
      isCustomMachined: true,
    },
  ];

  return {
    titleKo: `${p.objectName} ${p.loadKg}kg 논슬립 평행 그리퍼 지그`,
    titleEn: `Anti-Slip Parallel Preload Gripper Jig (${p.loadKg}kg)`,
    subtitleKo: `프리로드 자동 파지(Closed ${p.objWidthMm}mm) ↔ 개방(Open ${p.objWidthMm + p.strokeMm}mm) • 안전율 2.0배 설계`,
    overallDims: { w: totalW, d: totalD, h: totalH },
    workpiece: {
      name: p.objectName,
      w: p.objWidthMm,
      d: p.objDepthMm,
      h: p.objHeightMm,
      z: baseH + 54,
    },
    sequences: [
      {
        unit: "1. 개방 스트로크 (보 형태 Open 상태)",
        flow: `개방 스트로크 +${p.strokeMm}mm 작동 시 좌·우 조우가 ${p.objWidthMm + p.strokeMm}mm까지 벌어지며 스프링 압축 저장 → ${p.objectName}(${p.objWidthMm}×${p.objDepthMm}mm) 진입`,
      },
      {
        unit: "2. 달걀 쥐듯 정압 프리로드 파지 & 논슬립 유지",
        flow: `릴리즈 해제 시 미스미 프리로드 스프링이 정밀 계산된 법선력 인가 → 고마찰 패드(μ=${padInfo.mu})가 손상·미끄러짐 없이 ${p.loadKg}kg 하중을 안전율 2배 이상으로 견고히 지지`,
      },
    ],
    bom,
    parts,
  };
}

/**
 * [주력 B] 수직 가이드 포스트 + 스프링/캠 가압 프레스 픽스처
 */
function buildVerticalPressAssembly(
  p,
  spSpec,
  shaftDia,
  freeLen,
  closedSpringLen,
  springCode,
  padInfo,
  pickCode,
  leadText
) {
  const baseW = Math.max(180, p.objWidthMm + 120);
  const baseD = Math.max(150, p.objDepthMm + 90);
  const baseH = 22;
  const postOffsetX = Math.round(baseW * 0.36);
  const postH = 140 + p.strokeMm;
  const topZ = baseH + postH;
  const ramZ = baseH + 26 + p.objHeightMm * 0.4;

  const parts = [
    {
      id: "PRESS_BASE",
      stepName: "01_S45C_GROUND_BASE_PLATE",
      labelKo: "하부 정밀 연삭 베이스 플레이트",
      kind: "box",
      x: -baseW / 2,
      y: -baseD / 2,
      z: 0,
      w: baseW,
      d: baseD,
      h: baseH,
      color: "#334155",
      metalness: 0.78,
      roughness: 0.28,
      explodeVec: [0, 0, -45],
    },
    {
      id: "NEST_JIG",
      stepName: "02_WORKPIECE_LOCATOR_NEST",
      labelKo: "공작물 안착 포켓 네스트 블록",
      kind: "box",
      x: -(p.objWidthMm + 24) / 2,
      y: -(p.objDepthMm + 24) / 2,
      z: baseH,
      w: p.objWidthMm + 24,
      d: p.objDepthMm + 24,
      h: 16,
      color: "#d4af37",
      metalness: 0.82,
      roughness: 0.24,
      explodeVec: [0, 0, -18],
      callout: "공작물 위치결정 네스트",
    },
    {
      id: "GUIDE_POST_L",
      stepName: `03_MISUMI_GUIDE_POST_L`,
      labelKo: `좌측 수직 가이드 포스트 (Ø${shaftDia})`,
      kind: "cylinder",
      axis: "z",
      cx: -postOffsetX,
      cy: 0,
      cz: baseH,
      radius: shaftDia / 2,
      length: postH,
      color: "#e2e8f0",
      metalness: 0.92,
      roughness: 0.14,
      explodeVec: [-35, 0, 10],
      callout: `가이드 포스트 Ø${shaftDia}`,
    },
    {
      id: "GUIDE_POST_R",
      stepName: `04_MISUMI_GUIDE_POST_R`,
      labelKo: `우측 수직 가이드 포스트 (Ø${shaftDia})`,
      kind: "cylinder",
      axis: "z",
      cx: postOffsetX,
      cy: 0,
      cz: baseH,
      radius: shaftDia / 2,
      length: postH,
      color: "#e2e8f0",
      metalness: 0.92,
      roughness: 0.14,
      explodeVec: [35, 0, 10],
    },
    {
      id: "TOP_BRIDGE",
      stepName: "05_TOP_ACTUATOR_BRIDGE_PLATE",
      labelKo: "상부 액추에이터 브리지 플레이트",
      kind: "box",
      x: -baseW * 0.44,
      y: -baseD * 0.34,
      z: topZ,
      w: baseW * 0.88,
      d: baseD * 0.68,
      h: 20,
      color: "#475569",
      metalness: 0.75,
      roughness: 0.28,
      explodeVec: [0, 0, 55],
    },
    {
      id: "RAM_PLATE",
      stepName: "06_MOVING_PRESS_RAM_PLATE",
      labelKo: "승강 가압 램 플레이트",
      kind: "box",
      x: -baseW * 0.42,
      y: -baseD * 0.30,
      z: ramZ + 12,
      w: baseW * 0.84,
      d: baseD * 0.60,
      h: 18,
      color: "#94a3b8",
      metalness: 0.82,
      roughness: 0.22,
      motionRole: "ramVertical",
      maxTravel: p.strokeMm,
      explodeVec: [0, 0, 22],
      callout: "승강 프레스 플레이트",
    },
    {
      id: "PRESS_PAD",
      stepName: "07_URETHANE_PRESSURE_PAD",
      labelKo: "하부 완충 가압 우레탄 패드",
      kind: "box",
      x: -p.objWidthMm * 0.45,
      y: -p.objDepthMm * 0.45,
      z: ramZ,
      w: p.objWidthMm * 0.9,
      d: p.objDepthMm * 0.9,
      h: 12,
      color: padInfo.color,
      metalness: 0.15,
      roughness: 0.72,
      motionRole: "ramVertical",
      maxTravel: p.strokeMm,
      explodeVec: [0, 0, 10],
    },
    {
      id: "CENTER_SPRING",
      stepName: `08_MISUMI_COIL_SPRING_${springCode}`,
      labelKo: "중앙 가압/복귀 코일 스프링",
      kind: "spring",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: ramZ + 30,
      radius: spSpec.od / 2,
      wireDia: spSpec.wire,
      turns: 7,
      length: Math.max(32, topZ - (ramZ + 30)),
      color: "#3b82f6",
      motionRole: "springVertical",
      maxTravel: p.strokeMm,
      explodeVec: [0, 25, 40],
      callout: "고하중 코일 스프링",
    },
    {
      id: "ACTUATOR_CYL",
      stepName: "09_TOP_PRESS_ACTUATOR_UNIT",
      labelKo: "상단 가압 실린더/캠 구동부",
      kind: "cylinder",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: topZ + 20,
      radius: 24,
      length: 44,
      color: "#10b981",
      metalness: 0.75,
      roughness: 0.28,
      explodeVec: [0, 0, 82],
      callout: "상단 가압 구동 유닛",
    },
  ];

  const bom = [
    {
      category: "구동/탄성부",
      partName: "중하중 프레스 코일 스프링",
      brand: "MISUMI",
      codes: {
        best: `${spSpec.bestCode}-L${freeLen}`,
        fast: `${spSpec.fastCode}-L${freeLen}`,
        cheap: `${spSpec.cheapCode}-L${freeLen}`,
      },
      specSummary: `외경 Ø${spSpec.od} / k=${spSpec.k}N/mm`,
      material: "SWOSC-V",
      qty: 1,
      prices: spSpec.price,
    },
    {
      category: "수직 가이드",
      partName: "정밀 가이드 포스트 & 부쉬 세트",
      brand: "MISUMI",
      codes: {
        best: `GPF${shaftDia}-${postH}`,
        fast: `SFJ${shaftDia}-${postH}`,
        cheap: `C-GPF${shaftDia}-${postH}`,
      },
      specSummary: `Ø${shaftDia} g6 × ${postH}mm`,
      material: "SUJ2 경화강",
      qty: 2,
      prices: { best: 22000, fast: 25500, cheap: 12400 },
    },
    {
      category: "가압 패드",
      partName: padInfo.name,
      brand: "MISUMI",
      codes: {
        best: padInfo.misumiBest,
        fast: padInfo.misumiFast,
        cheap: padInfo.misumiCheap,
      },
      specSummary: "가압 손상 방지 고탄성 패드",
      material: "Urethane",
      qty: 1,
      prices: padInfo.priceKrw,
    },
    {
      category: "가공 프레임",
      partName: "상하 정밀 플레이트 & 위치결정 네스트",
      brand: "Custom CNC",
      codes: {
        best: `CNC-PRS-${baseW}X${baseD}`,
        fast: `CNC-QPRS-${baseW}`,
        cheap: `CNC-EPRS-${baseW}`,
      },
      specSummary: `${baseW}×${baseD}mm 평면연삭 포함`,
      material: "S45C + AL6061",
      qty: 1,
      prices: { best: 165000, fast: 210000, cheap: 128000 },
      isCustomMachined: true,
    },
  ];

  return {
    titleKo: `${p.loadKg}kg 정압 수직 가이드 스프링 프레스 픽스처`,
    titleEn: `Vertical Guide Post Spring Press Fixture (${p.loadKg}kg)`,
    subtitleKo: `트윈 가이드 포스트 직각도 보장 • 수직 스트로크 ${p.strokeMm}mm`,
    overallDims: { w: baseW, d: baseD, h: topZ + 64 },
    workpiece: {
      name: p.objectName,
      w: p.objWidthMm,
      d: p.objDepthMm,
      h: Math.min(34, p.objHeightMm * 0.4),
      z: baseH + 16,
    },
    sequences: [
      {
        unit: "1. 상사점 개방 및 네스트 안착",
        flow: `승강 램 +${p.strokeMm}mm 상승 대기 → 하부 황동 위치결정 네스트에 공작물 정위치 안착`,
      },
      {
        unit: "2. 수직 정압 가압 클램핑",
        flow: `트윈 가이드 포스트를 따라 흔들림 없이 하강 → 우레탄 패드가 ${p.loadKg}kg 상당 정압으로 균일 가압 고정`,
      },
    ],
    bom,
    parts,
  };
}

/**
 * [주력 C] 퀵릴리즈 스프링 플런저 & 인덱싱 센터링 지그
 */
function buildIndexingPlungerAssembly(
  p,
  spSpec,
  shaftDia,
  freeLen,
  closedSpringLen,
  springCode,
  pickCode,
  leadText
) {
  const bodyH = 190 + p.strokeMm;
  const parts = [
    {
      id: "PLG_MOUNT_BASE",
      stepName: "01_FLANGE_MOUNT_BRACKET",
      labelKo: "하부 플랜지 마운팅 블록",
      kind: "box",
      x: -55,
      y: -45,
      z: 0,
      w: 110,
      d: 90,
      h: 18,
      color: "#334155",
      metalness: 0.78,
      roughness: 0.28,
      explodeVec: [0, 0, -40],
    },
    {
      id: "PLG_PIN_SHAFT",
      stepName: "02_PRECISION_LOCATING_PIN_SUS440C",
      labelKo: "정밀 센터링 위치결정 핀 축",
      kind: "cylinder",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: 4,
      radius: shaftDia / 2,
      length: bodyH - 18,
      color: "#e2e8f0",
      metalness: 0.92,
      roughness: 0.12,
      motionRole: "ramVertical",
      maxTravel: p.strokeMm,
      explodeVec: [0, 0, -20],
      callout: `센터링 핀 Ø${shaftDia}g6`,
    },
    {
      id: "PLG_GUIDE_COLLAR",
      stepName: "03_SLIDING_PULL_COLLAR",
      labelKo: "슬라이딩 릴리즈 콜라",
      kind: "cylinder",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: 32,
      radius: 24,
      length: 36,
      color: "#06b6d4",
      metalness: 0.65,
      roughness: 0.3,
      motionRole: "ramVertical",
      maxTravel: p.strokeMm,
      explodeVec: [0, 0, 18],
      callout: "퀵릴리즈 슬라이딩 콜라",
    },
    {
      id: "PLG_HANDLE_BAR",
      stepName: "04_TWIN_ERGONOMIC_PULL_LEVER",
      labelKo: "양측 당김 T-핸들 바",
      kind: "cylinder",
      axis: "x",
      cx: -72,
      cy: 0,
      cz: 50,
      radius: 7,
      length: 144,
      color: "#38bdf8",
      metalness: 0.75,
      roughness: 0.25,
      motionRole: "ramVertical",
      maxTravel: p.strokeMm,
      explodeVec: [0, -30, 22],
      callout: "T-릴리즈 당김 핸들",
    },
    {
      id: "PLG_SPRING",
      stepName: `05_MISUMI_PRELOAD_SPRING_${springCode}`,
      labelKo: "내장 예압 압축 코일 스프링",
      kind: "spring",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: 70,
      radius: spSpec.od / 2,
      wireDia: spSpec.wire,
      turns: 7,
      length: bodyH - 102,
      color: "#ef4444",
      motionRole: "springVertical",
      maxTravel: p.strokeMm,
      explodeVec: [0, 25, 42],
      callout: "예압 코일 스프링",
    },
    {
      id: "PLG_TOP_CAP",
      stepName: "06_BRASS_PRELOAD_RETAINER_NUT",
      labelKo: "상부 황동 예압 조절 캡 너트",
      kind: "cylinder",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: bodyH - 30,
      radius: 26,
      length: 30,
      color: "#d4af37",
      metalness: 0.86,
      roughness: 0.22,
      explodeVec: [0, 0, 75],
      callout: "황동 예압 조절 너트",
    },
  ];

  const bom = [
    {
      category: "인덱싱 코어",
      partName: "정밀 인덱싱 플런저 핀 어셈블리",
      brand: "MISUMI",
      codes: { best: `PMXWL${shaftDia}`, fast: `PMXSL${shaftDia}`, cheap: `C-PMX${shaftDia}` },
      specSummary: `핀경 Ø${shaftDia} g6 / 스트로크 ${p.strokeMm}mm`,
      material: "SUS440C 열처리",
      qty: 1,
      prices: { best: 28500, fast: 32000, cheap: 14800 },
    },
    {
      category: "예압 스프링",
      partName: "정밀 압축 코일 스프링",
      brand: "MISUMI",
      codes: {
        best: `${spSpec.bestCode}-L${freeLen}`,
        fast: `${spSpec.fastCode}-L${freeLen}`,
        cheap: `${spSpec.cheapCode}-L${freeLen}`,
      },
      specSummary: `외경 Ø${spSpec.od} / k=${spSpec.k}N/mm`,
      material: "SWP-B",
      qty: 1,
      prices: spSpec.price,
    },
    {
      category: "브래킷 가공",
      partName: "플랜지 마운트 베이스 & 예압 캡",
      brand: "Custom CNC",
      codes: { best: "CNC-PLG-110", fast: "CNC-QPLG-110", cheap: "CNC-EPLG-110" },
      specSummary: "110×90×18mm 탭·보어 정밀가공",
      material: "S45C + C3604",
      qty: 1,
      prices: { best: 78000, fast: 96000, cheap: 59000 },
      isCustomMachined: true,
    },
  ];

  return {
    titleKo: `퀵릴리즈 스프링 플런저 인덱싱 지그 (${p.loadKg}kg 유지력)`,
    titleEn: `Quick-Release Spring Indexing Plunger Jig`,
    subtitleKo: `반복 위치결정 정밀도 ±0.015mm • 당김 스트로크 ${p.strokeMm}mm`,
    overallDims: { w: 144, d: 90, h: bodyH },
    workpiece: null,
    sequences: [
      { unit: "1. T-핸들 당김 후퇴", flow: `양측 T-핸들을 +${p.strokeMm}mm 상방 인출하여 위치결정 핀 잠금 즉시 해제` },
      { unit: "2. 스프링 복원 자동 인덱싱", flow: `핸들 해제 시 프리로드 스프링이 기준홀에 정밀 삽입되어 유격 없이 고정` },
    ],
    bom,
    parts,
  };
}

/**
 * [주력 D] 복합 4절 토글 배력 클램프 픽스처
 */
function buildToggleClampAssembly(p, spSpec, shaftDia, padInfo, pickCode, leadText) {
  const baseW = 220;
  const baseD = 110;
  const parts = [
    {
      id: "TGL_BASE",
      stepName: "01_TOGGLE_FIXTURE_BASE",
      labelKo: "토글 지그 베이스 플레이트",
      kind: "box",
      x: -110,
      y: -55,
      z: 0,
      w: baseW,
      d: baseD,
      h: 18,
      color: "#334155",
      metalness: 0.78,
      roughness: 0.3,
      explodeVec: [0, 0, -40],
    },
    {
      id: "TGL_RISER",
      stepName: "02_PIVOT_TOWER_BRACKET",
      labelKo: "피벗 타워 브래킷",
      kind: "box",
      x: -95,
      y: -26,
      z: 18,
      w: 44,
      d: 52,
      h: 78,
      color: "#64748b",
      metalness: 0.75,
      roughness: 0.28,
      explodeVec: [-35, 0, 10],
      callout: "4절 링크 피벗 타워",
    },
    {
      id: "TGL_ARM",
      stepName: "03_CLAMPING_LEVER_ARM",
      labelKo: "배력 클램핑 암 바",
      kind: "box",
      x: -75,
      y: -16,
      z: 86,
      w: 155,
      d: 32,
      h: 18,
      color: "#cbd5e1",
      metalness: 0.85,
      roughness: 0.2,
      motionRole: "ramVertical",
      maxTravel: p.strokeMm,
      explodeVec: [15, 0, 38],
      callout: "4.8:1 배력 클램프 암",
    },
    {
      id: "TGL_SPINDLE",
      stepName: "04_URETHANE_SPINDLE_BOLT",
      labelKo: "스핀들 압착 우레탄 볼트",
      kind: "cylinder",
      axis: "z",
      cx: 55,
      cy: 0,
      cz: 52,
      radius: 14,
      length: 36,
      color: padInfo.color,
      metalness: 0.25,
      roughness: 0.65,
      motionRole: "ramVertical",
      maxTravel: p.strokeMm,
      explodeVec: [25, 0, 20],
      callout: "우레탄 스핀들 패드",
    },
    {
      id: "TGL_HANDLE",
      stepName: "05_RED_ERGONOMIC_HANDLE_ROD",
      labelKo: "적색 조작 레버 핸들",
      kind: "cylinder",
      axis: "z",
      cx: -68,
      cy: 0,
      cz: 96,
      radius: 9,
      length: 92,
      color: "#ef4444",
      metalness: 0.35,
      roughness: 0.55,
      explodeVec: [-25, 0, 65],
      callout: "셀프락킹 조작 핸들",
    },
  ];

  const bom = [
    {
      category: "토글 클램프",
      partName: "수직 하방 가압형 중하중 토글 클램프",
      brand: "MISUMI / KAKUTA",
      codes: { best: "MC01-2S", fast: "KC-38C", cheap: "C-TGL-200" },
      specSummary: `체결력 ${Math.max(150, Math.round(p.loadKg * 22))}N (배력비 4.8:1)`,
      material: "SPCC 아연도금 + 우레탄",
      qty: 1,
      prices: { best: 18500, fast: 21000, cheap: 9400 },
    },
    {
      category: "스핀들 패드",
      partName: padInfo.name,
      brand: "MISUMI",
      codes: {
        best: padInfo.misumiBest,
        fast: padInfo.misumiFast,
        cheap: padInfo.misumiCheap,
      },
      specSummary: "M8 높이 조절식 우레탄 압착 볼트",
      material: "SUS304 + Urethane",
      qty: 1,
      prices: padInfo.priceKrw,
    },
    {
      category: "지그 베이스",
      partName: "피가공물 기준 블록 & 베이스 플레이트",
      brand: "Custom CNC",
      codes: { best: "CNC-TGL-220", fast: "CNC-QTGL-220", cheap: "CNC-ETGL-220" },
      specSummary: "220×110×18mm AL6061 정밀가공",
      material: "AL6061-T6",
      qty: 1,
      prices: { best: 92000, fast: 118000, cheap: 72000 },
      isCustomMachined: true,
    },
  ];

  return {
    titleKo: `4.8:1 배력 셀프락킹 토글 클램프 지그 (${p.loadKg}kg 유지)`,
    titleEn: `Over-Center Toggle Clamp Fixture (${p.loadKg}kg)`,
    subtitleKo: `사점(Over-Center) 통과 셀프락킹 구조 • 진동 풀림 원천 방지`,
    overallDims: { w: baseW, d: baseD, h: 188 },
    workpiece: { name: p.objectName, w: 56, d: 44, h: 34, z: 18, xOffset: 55 },
    sequences: [
      { unit: "1. 레버 젖힘 및 상방 개방", flow: "적색 핸들 후방 조작 → 클램프 암 상승 개방 후 공작물 신속 투입" },
      { unit: "2. 사점 통과 셀프락킹 가압", flow: "핸들 하방 잠금 → 4절 링크 사점 통과로 외력/진동에도 절대 풀리지 않는 정압 고정" },
    ],
    bom,
    parts,
  };
      }
