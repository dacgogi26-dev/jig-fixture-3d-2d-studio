/**
 * V4.0 현업 생산기술·기구설계 자연어 해석 + 지구 물리·재료역학 임계선(CAE) 솔버 +
 * 미스미(MISUMI) 표준 부품 매칭 & 5대 정밀 어셈블리 합성 엔진
 *
 * 반영된 물리 법칙:
 * - 표준 중력가속도 g0 = 9.80665 m/s² 및 이송 가감속 관성하중 F_dyn = m·g0·(1 + a_G)
 * - 코일 스프링 전단 탄성계수(G = 78.5 GPa), Wahl 응력집중계수(Kw), 허용전단응력(680 MPa), 밀착장(Solid Height) 물리 한계
 * - 리니어 가이드축 오일러-베르누이 굽힘 처짐(δ = F·L³ / 192·E·I) 및 볼부쉬 고착 임계치(25 μm)
 * - SCM435(10.9) 육각렌치볼트 보증하중(830 MPa) 및 위치결정핀 이중전단 항복 한계
 * - 공장 표준 공압(0.5 MPa = 5 bar) 실린더 보어별 이론 추력 포화 한계
 */

const G0 = 9.80665; // 지구 표준 중력가속도 (m/s²)

const WORKPIECE_PROFILES = [
  { rx: /파이프|원통|봉|환봉|샤프트|실린더\s*모재|배관/, name: "SUS304 원통 파이프/샤프트 모재", shape: "cylinder", w: 42, d: 42, h: 110, defaultKg: 35 },
  { rx: /파우치|배터리|셀|각형|모듈/, name: "이차전지 파우치/각형 셀", shape: "box", w: 68, d: 24, h: 104, defaultKg: 8 },
  { rx: /pcb|기판|보드|포고핀|검사\s*지그|실장/, name: "전장 PCB 어셈블리 기판", shape: "box", w: 130, d: 90, h: 14, defaultKg: 28 },
  { rx: /하우징|다이캐스팅|알루미늄\s*케이스|블록|절삭|밀링|드릴링/, name: "AL 다이캐스팅 가공 하우징", shape: "box", w: 84, d: 64, h: 52, defaultKg: 45 },
  { rx: /인덱스|턴테이블|분할|스톱|핀/, name: "인덱스 회전 테이블 팔레트", shape: "box", w: 90, d: 70, h: 28, defaultKg: 60 },
];

const CONTACT_SURFACES = {
  urethane: {
    id: "urethane",
    name: "미스미 우레탄 패드 (Shore A90 · 비손상 고마찰)",
    mu: 0.48,
    maxCompressiveMpa: 18.0,
    color: "#ea580c",
    skus: { best: "UTAA90-T6", fast: "UTAA90-Q6", cheap: "C-UTB90-6" },
    prices: { best: 12400, fast: 14200, cheap: 7100 },
  },
  silicone: {
    id: "silicone",
    name: "실리콘 탄성 보호 패드 (박막·취성 부품용)",
    mu: 0.55,
    maxCompressiveMpa: 8.5,
    color: "#0284c7",
    skus: { best: "SRGS50-T6", fast: "SRGS50-Q6", cheap: "C-SRG50-6" },
    prices: { best: 15200, fast: 17400, cheap: 8900 },
  },
  carbide_jaw: {
    id: "carbide_jaw",
    name: "SKD11 열처리 세레이션 그리퍼 조우 (절삭 중하중용)",
    mu: 0.32,
    maxCompressiveMpa: 650.0,
    color: "#475569",
    skus: { best: "SJAW-SKD11-16", fast: "SJAW-Q16", cheap: "C-SJAW-16" },
    prices: { best: 28500, fast: 33000, cheap: 16800 },
  },
};

/**
 * 실제 피아노선/실리콘크롬강(SWOSC-V, G = 78,500 MPa, 허용전단응력 τ_allow = 680 MPa) 물성 기반
 * 미스미 표준 사각/원형 코일 스프링 시리즈
 */
const SPRING_SERIES = [
  {
    seriesId: "LIGHT_SWF18",
    od: 18.0,
    wireD: 2.3,
    activeCoils: 12.5,
    shearModulusMpa: 78500,
    tauAllowMpa: 650,
    freeLengths: [70, 85, 100, 120],
    skus: { best: "SWF18", fast: "SWU18", cheap: "C-SWF18" },
    prices: { best: 5200, fast: 6100, cheap: 2800 },
  },
  {
    seriesId: "MED_SWU22",
    od: 22.0,
    wireD: 3.2,
    activeCoils: 7.5,
    shearModulusMpa: 78500,
    tauAllowMpa: 680,
    freeLengths: [65, 75, 90, 105],
    skus: { best: "SWU22", fast: "SWF22", cheap: "C-SWU22" },
    prices: { best: 7400, fast: 8600, cheap: 3900 },
  },
  {
    seriesId: "HEAVY_SWM27",
    od: 27.0,
    wireD: 4.5,
    activeCoils: 7.0,
    shearModulusMpa: 78500,
    tauAllowMpa: 680,
    freeLengths: [75, 90, 105, 120],
    skus: { best: "SWM27", fast: "SWU27", cheap: "C-SWM27" },
    prices: { best: 10800, fast: 12600, cheap: 5800 },
  },
  {
    seriesId: "EXTRA_SWB34",
    od: 34.0,
    wireD: 6.0,
    activeCoils: 6.5,
    shearModulusMpa: 78500,
    tauAllowMpa: 700,
    freeLengths: [85, 100, 120, 140],
    skus: { best: "SWB34", fast: "SWM34", cheap: "C-SWB34" },
    prices: { best: 16200, fast: 18900, cheap: 8900 },
  },
];

// 공장 표준 0.5 MPa 에어 공급 기준 실린더 규격표
const PNEUMATIC_CYLINDERS = [
  { bore: 20, skus: { best: "MGPM20", fast: "CQ2B20", cheap: "C-MGPM20" }, prices: { best: 62000, fast: 69000, cheap: 31000 } },
  { bore: 25, skus: { best: "MGPM25", fast: "CQ2B25", cheap: "C-MGPM25" }, prices: { best: 71000, fast: 78000, cheap: 36000 } },
  { bore: 32, skus: { best: "MGPM32", fast: "CQ2B32", cheap: "C-MGPM32" }, prices: { best: 84000, fast: 93000, cheap: 42000 } },
  { bore: 40, skus: { best: "MGPM40", fast: "CQ2B40", cheap: "C-MGPM40" }, prices: { best: 98000, fast: 112000, cheap: 49000 } },
  { bore: 50, skus: { best: "MGPM50", fast: "CQ2B50", cheap: "C-MGPM50" }, prices: { best: 124000, fast: 139000, cheap: 64000 } },
  { bore: 63, skus: { best: "MGPM63", fast: "CQ2B63", cheap: "C-MGPM63" }, prices: { best: 152000, fast: 171000, cheap: 79000 } },
];

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function calcSpringMechanics(sp) {
  const dm = sp.od - sp.wireD;
  const cIdx = dm / sp.wireD;
  const wahlKw = (4 * cIdx - 1) / (4 * cIdx - 4) + 0.615 / cIdx;
  const kRate =
    (sp.shearModulusMpa * Math.pow(sp.wireD, 4)) /
    (8 * Math.pow(dm, 3) * sp.activeCoils);
  const totalCoils = sp.activeCoils + 2;
  const solidHeight = (totalCoils + 0.5) * sp.wireD;
  return {
    ...sp,
    dm: Number(dm.toFixed(2)),
    cIdx: Number(cIdx.toFixed(2)),
    wahlKw: Number(wahlKw.toFixed(3)),
    k: Number(kRate.toFixed(2)),
    totalCoils,
    solidHeight: Number(solidHeight.toFixed(1)),
  };
}

const COMPUTED_SPRINGS = SPRING_SERIES.map(calcSpringMechanics);

/**
 * 현업 기구설계·생산기술 실무 말투 정밀 파서
 * ("절삭부하 80kgf", "포고핀 반력 35kg", "가감속 2G", "파이 42", "브이블록", "2백 이내", "공압 0.5MPa" 등)
 */
export function parseFieldEngineeringIntent(rawText = "", overrides = {}) {
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();

  let mechanismType = overrides.mechanismType || "";
  if (!mechanismType) {
    if (/v\s*블록|브이\s*블록|v-block|원통.*드릴|파이프.*고정|환봉/.test(lower)) {
      mechanismType = "vblock_clamp";
    } else if (/포고핀|프레스|압입|수직\s*가압|열융착|검사\s*지그/.test(lower)) {
      mechanismType = "vertical_press";
    } else if (/인덱스|인덱싱|플런저|분할|스톱\s*핀|위치\s*결정/.test(lower)) {
      mechanismType = "indexing_plunger";
    } else if (/토글|원터치\s*잠금|배력|사점|용접\s*지그/.test(lower)) {
      mechanismType = "toggle_clamp";
    } else {
      mechanismType = "parallel_gripper";
    }
  }

  const wpProfile =
    WORKPIECE_PROFILES.find((w) => w.rx.test(lower)) ||
    (mechanismType === "vblock_clamp" ? WORKPIECE_PROFILES[0] : WORKPIECE_PROFILES[1]);

  const tripleMatch = text.match(/(\d{2,4})\s*[xX*×]\s*(\d{2,4})(?:\s*[xX*×]\s*(\d{2,4}))?/);
  const diaMatch = text.match(/(?:직경|지름|외경|파이|Ø|ø)\s*(\d{2,3})/i);

  const objWidthMm = overrides.objWidthMm
    ? clamp(overrides.objWidthMm, 16, 200)
    : diaMatch
    ? clamp(Number(diaMatch[1]), 16, 200)
    : tripleMatch
    ? clamp(Number(tripleMatch[1]), 16, 200)
    : wpProfile.w;

  const objDepthMm = diaMatch
    ? objWidthMm
    : tripleMatch
    ? clamp(Number(tripleMatch[2]), 12, 180)
    : wpProfile.d;

  const objHeightMm =
    tripleMatch && tripleMatch[3] ? clamp(Number(tripleMatch[3]), 14, 220) : wpProfile.h;

  // 하중/부하 추출 (kgf, kg, N 모두 지원)
  let loadKg = overrides.loadKg !== undefined ? Number(overrides.loadKg) : null;
  if (loadKg === null || Number.isNaN(loadKg)) {
    const kgfMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kgf|kg|킬로|키로)/i);
    const nMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:n|뉴턴)/i);
    if (kgfMatch) loadKg = Number(kgfMatch[1]);
    else if (nMatch) loadKg = Number(nMatch[1]) / G0;
    else loadKg = wpProfile.defaultKg;
  }
  loadKg = clamp(loadKg, 1, 250);

  // 설비 이송 가감속 G-Force 추출 (예: "가감속 2G", "고속 이송")
  let accelG = overrides.accelG !== undefined ? Number(overrides.accelG) : null;
  if (accelG === null || Number.isNaN(accelG)) {
    const gMatch = text.match(/(\d+(?:\.\d+)?)\s*[gG](?:\b|가속|충격)/);
    if (gMatch) accelG = Number(gMatch[1]);
    else if (/고속|픽앤플레이스|이송/.test(lower)) accelG = 1.5;
    else accelG = 0.2;
  }
  accelG = clamp(accelG, 0, 4.0);

  // 스트로크 추출
  let strokeMm = overrides.strokeMm !== undefined ? Number(overrides.strokeMm) : null;
  if (strokeMm === null || Number.isNaN(strokeMm)) {
    const stMatch = text.match(/스트로크\s*[:=]?\s*(\d{1,3})/i);
    strokeMm = stMatch ? Number(stMatch[1]) : Math.round(clamp(objWidthMm * 0.42, 16, 56));
  }
  strokeMm = clamp(strokeMm, 10, 90);

  // 접촉면 패드
  let padKey = overrides.padKey || "";
  if (!padKey) {
    if (/찍힘\s*방지|스크래치|박막|유리|실리콘/.test(lower)) padKey = "silicone";
    else if (/절삭|밀링|드릴링|세레이션|금속\s*조우|강력/.test(lower)) padKey = "carbide_jaw";
    else padKey = "urethane";
  }

  // 구동원 (spring / pneumatic / toggle)
  let actuation = overrides.actuation || "";
  if (!actuation) {
    if (mechanismType === "toggle_clamp") actuation = "toggle";
    else if (/공압|에어|실린더|0\.5\s*mpa|척/.test(lower)) actuation = "pneumatic";
    else if (loadKg >= 35 && (mechanismType === "vblock_clamp" || mechanismType === "vertical_press")) actuation = "pneumatic";
    else actuation = "spring";
  }

  // 조달 우선순위
  let priority = overrides.priority || "";
  if (!priority) {
    if (/당일|단납기|급행|급해|빠른/.test(lower)) priority = "fast";
    else if (/원가|저렴|가성비|최저가|c-value|양산\s*단가/.test(lower)) priority = "cheap";
    else priority = "best";
  }

  // 샤프트 강성 수동 보강 단계 (0=자동기본, 1=보강업그레이드)
  const shaftDiameterOverride = overrides.shaftDia ? Number(overrides.shaftDia) : null;
  const springTierBoost = Number(overrides.springTierBoost || 0);

  return {
    rawPrompt:
      text ||
      `${wpProfile.name} ${loadKg}kgf 부하 대응 정밀 지그 설계`,
    mechanismType,
    objectName: wpProfile.name,
    objectShape: diaMatch || mechanismType === "vblock_clamp" ? "cylinder" : wpProfile.shape,
    objWidthMm,
    objDepthMm,
    objHeightMm,
    loadKg,
    accelG,
    strokeMm,
    padKey,
    actuation,
    priority,
    shaftDiameterOverride,
    springTierBoost,
  };
}

/**
 * 실제 고체역학·기계요소설계 임계치 검증 및 3D 어셈블리 합성
 */
export function generateRealCadEngineering(rawText, overrides = {}) {
  const p = parseFieldEngineeringIntent(rawText, overrides);
  const surf = CONTACT_SURFACES[p.padKey] || CONTACT_SURFACES.urethane;

  // 1. 지구 중력 + 이송 가감속 관성 부하 산출
  const staticLoadN = p.loadKg * G0;
  const dynamicLoadN = staticLoadN * (1 + p.accelG);
  const safetyFactorTarget = 2.0;

  // 기구별 필요 법선 클램핑력 산출
  let requiredClampN;
  if (p.mechanismType === "parallel_gripper") {
    // 양측 마찰 파지: 2 * mu * F_normal >= F_dyn * Sf
    requiredClampN = (dynamicLoadN * safetyFactorTarget) / (2 * surf.mu);
  } else if (p.mechanismType === "vblock_clamp") {
    // 90° V-블록 쐐기 효과(sin 45° 보정) + 절삭 회전 토크 저항
    requiredClampN = (dynamicLoadN * safetyFactorTarget) / (1.414 * surf.mu + 0.35);
  } else if (p.mechanismType === "indexing_plunger") {
    // 핀 전단 저항 + 테이퍼 이탈 방지 축력(tan 15° = 0.27)
    requiredClampN = dynamicLoadN * 0.35 * safetyFactorTarget;
  } else {
    requiredClampN = dynamicLoadN * safetyFactorTarget;
  }

  const springCount =
    p.mechanismType === "parallel_gripper" || p.mechanismType === "vblock_clamp"
      ? 2
      : 1;
  const travelActiveMm =
    p.mechanismType === "parallel_gripper" ? p.strokeMm / 2 : p.strokeMm;

  // 2. 스프링 규격 선정 및 Wahl 전단응력 / 밀착장 한계 검증
  // 공압/토글 구동 시 스프링은 복귀(Return) 역할이므로 과강성 스프링으로 인한 밀착 파단을 피함
  const springTargetLoadN =
    p.actuation === "pneumatic" || p.actuation === "toggle"
      ? Math.min(140, requiredClampN * 0.18)
      : requiredClampN;

  let selectedIdx = COMPUTED_SPRINGS.findIndex(
    (s) => s.k * 16 * springCount >= springTargetLoadN
  );
  if (selectedIdx === -1) selectedIdx = COMPUTED_SPRINGS.length - 1;
  selectedIdx = clamp(selectedIdx + p.springTierBoost, 0, COMPUTED_SPRINGS.length - 1);
  const sp = COMPUTED_SPRINGS[selectedIdx];

  // 목표 프리로드 변위 δ1
  const reqPerSpringN = springTargetLoadN / springCount;

  const preloadDeflectMm = Number(
    clamp(reqPerSpringN / sp.k, 4.0, 38.0).toFixed(1)
  );
  const maxDeflectMm = Number((preloadDeflectMm + travelActiveMm).toFixed(1));

  // 밀착장 여유를 고려한 표준 자유장 선정
  const idealFreeLen = sp.solidHeight + maxDeflectMm / 0.72;
  const freeLenMm =
    sp.freeLengths.find((fl) => fl >= idealFreeLen) ||
    sp.freeLengths[sp.freeLengths.length - 1];

  const maxPhysicalStrokeBeforeSolid = Math.max(4, freeLenMm - sp.solidHeight);
  const solidUsagePct = Math.round((maxDeflectMm / (maxPhysicalStrokeBeforeSolid * 0.85)) * 100);

  const springPreloadTotalN = springCount * sp.k * preloadDeflectMm;
  const springPeakTotalN = springCount * sp.k * maxDeflectMm;
  const peakSingleSpringN = springPeakTotalN / springCount;

  // Wahl 비틀림 전단응력 τ_max (MPa)
  const tauMaxMpa = Number(
    (
      (sp.wahlKw * 8 * peakSingleSpringN * sp.dm) /
      (Math.PI * Math.pow(sp.wireD, 3))
    ).toFixed(1)
  );
  const springStressPct = Math.round(Math.max((tauMaxMpa / sp.tauAllowMpa) * 100, solidUsagePct));

  // 3. 공압(0.5 MPa) 또는 토글 배력 구동력 합산
  const shopAirMpa = 0.5; // 공장 표준 공압 5 bar
  let cylSpec = PNEUMATIC_CYLINDERS[1];
  let actuatorForceN = springPreloadTotalN;

  if (p.actuation === "pneumatic") {
    cylSpec =
      PNEUMATIC_CYLINDERS.find(
        (c) => shopAirMpa * (Math.PI * c.bore * c.bore * 0.25) * 0.68 >= requiredClampN
      ) || PNEUMATIC_CYLINDERS[PNEUMATIC_CYLINDERS.length - 1];
    actuatorForceN = Number(
      (shopAirMpa * (Math.PI * cylSpec.bore * cylSpec.bore * 0.25) * 0.68).toFixed(1)
    );
  } else if (p.actuation === "toggle") {
    // 작업자 최대 권장 조작력 180N × 4.8배 사점 배력 링크 = 864N (기구적 상한 반영)
    const humanErgonomicInputN = Math.min(220, Math.max(65, requiredClampN / 4.8));
    actuatorForceN = Number((humanErgonomicInputN * 4.8).toFixed(1));
  }

  // 4. 가이드 샤프트 오일러-베르누이 굽힘 처짐 & 부쉬 고착 임계선 계산
  const defaultShaftDia = sp.od >= 32 ? 20 : sp.od >= 26 ? 16 : 12;
  const shaftDia = p.shaftDiameterOverride || defaultShaftDia;
  const spanMm = Math.max(130, p.objWidthMm + p.strokeMm + 75);
  const youngsModulusMpa = 206000; // SUJ2 경화 연마축
  const areaInertiaMm4 = (Math.PI * Math.pow(shaftDia, 4)) / 64;
  const transverseLoadN = actuatorForceN * 0.38 + dynamicLoadN * 0.5;
  const shaftDeflectUm = Number(
    (
      ((transverseLoadN * Math.pow(spanMm, 3)) /
        (192 * youngsModulusMpa * areaInertiaMm4)) *
      1000
    ).toFixed(1)
  );
  const allowDeflectUm = 25.0; // 리니어 볼부쉬 편하중 허용한계 25 μm (2.5백)
  const shaftLimitPct = Math.round((shaftDeflectUm / allowDeflectUm) * 100);

  // 5. 체결 볼트 인장응력 & 핀 전단응력 임계선 계산
  const boltSize = shaftDia >= 16 ? "M8" : "M6";
  const boltAreaMm2 = boltSize === "M8" ? 36.6 : 20.1;
  const boltCountActive = 4;
  const boltTensileMpa = Number(
    ((Math.max(actuatorForceN, dynamicLoadN) * 1.35) / (boltCountActive * boltAreaMm2)).toFixed(1)
  );
  // 인덱싱 플런저일 경우 핀 이중전단 응력도 함께 평가
  const pinShearMpa = Number(
    (dynamicLoadN / (2 * (Math.PI * Math.pow(shaftDia, 2) * 0.25))).toFixed(1)
  );
  const effectiveFastenerMpa = Math.max(boltTensileMpa, pinShearMpa);
  const fastenerAllowMpa = 340.0; // SCM435 10.9 안전 설계응력
  const fastenerLimitPct = Math.round((effectiveFastenerMpa / fastenerAllowMpa) * 100);

  // 6. 파지 슬립 & 구동원 포화 한계 평가
  let actualHoldForceN;
  if (p.mechanismType === "parallel_gripper") {
    actualHoldForceN = actuatorForceN * 2 * surf.mu;
  } else if (p.mechanismType === "vblock_clamp") {
    actualHoldForceN = actuatorForceN * (1.414 * surf.mu + 0.35);
  } else if (p.mechanismType === "indexing_plunger") {
    actualHoldForceN = (Math.PI * Math.pow(shaftDia, 2) * 0.25) * 320;
  } else {
    actualHoldForceN = actuatorForceN;
  }

  const achievedSafetyFactor = Number((actualHoldForceN / Math.max(1, dynamicLoadN)).toFixed(2));
  const slipOrSourcePct = Math.round((requiredClampN / Math.max(1, actuatorForceN)) * 100);

  const classifyStatus = (pct) =>
    pct > 100 ? "CRITICAL" : pct >= 78 ? "CAUTION" : "SAFE";

  const criticalLimits = [
    {
      id: "spring_shear",
      title: "스프링 비틀림 전단·밀착 한계",
      materialSpec: `SWOSC-V 열처리강 (허용 ${sp.tauAllowMpa} MPa)`,
      currentText: `${tauMaxMpa} MPa (밀착율 ${Math.min(140, solidUsagePct)}%)`,
      limitText: `${sp.tauAllowMpa} MPa`,
      pct: Math.min(160, springStressPct),
      status: classifyStatus(springStressPct),
      warningMsg:
        springStressPct > 100
          ? `스프링 전단항복/밀착장 물리 한계 초과(${springStressPct}%) — 코일 영구 소성변형 또는 파단 발생!`
          : null,
    },
    {
      id: "shaft_deflection",
      title: "가이드축 굽힘 처짐·고착 한계",
      materialSpec: `SUJ2 Ø${shaftDia}g6 (스팬 ${spanMm}mm, E=206GPa)`,
      currentText: `${shaftDeflectUm} μm`,
      limitText: `${allowDeflectUm} μm (2.5백)`,
      pct: Math.min(160, shaftLimitPct),
      status: classifyStatus(shaftLimitPct),
      warningMsg:
        shaftLimitPct > 100
          ? `샤프트 처짐(${shaftDeflectUm}μm)이 리니어부쉬 허용치(25μm)를 넘어 편마모 및 이송 고착(Jamming) 발생!`
          : null,
    },
    {
      id: "fastener_yield",
      title: "체결 볼트 인장·핀 전단 한계",
      materialSpec: `SCM435 강도 10.9 (${boltSize}×4EA)`,
      currentText: `${effectiveFastenerMpa} MPa`,
      limitText: `${fastenerAllowMpa} MPa`,
      pct: Math.min(160, fastenerLimitPct),
      status: classifyStatus(fastenerLimitPct),
      warningMsg:
        fastenerLimitPct > 100
          ? `볼트/핀 응력(${effectiveFastenerMpa}MPa)이 설계 항복 임계선을 초과하여 체결부 파단 위험!`
          : null,
    },
    {
      id: "slip_saturation",
      title:
        p.actuation === "pneumatic"
          ? "공장 공압(0.5MPa) 추력 포화율"
          : "관성·마찰 슬립 임계 한계",
      materialSpec:
        p.actuation === "pneumatic"
          ? `0.5 MPa 표준 에어 (보어 Ø${cylSpec.bore})`
          : `마찰계수 μ=${surf.mu} · 가감속 ${p.accelG}G 반영`,
      currentText: `요구 ${Math.round(requiredClampN)}N / 출력 ${Math.round(actuatorForceN)}N`,
      limitText: `안전율 2.0배 기준`,
      pct: Math.min(160, slipOrSourcePct),
      status: classifyStatus(slipOrSourcePct),
      warningMsg:
        slipOrSourcePct > 100
          ? p.actuation === "pneumatic"
            ? `표준 0.5MPa 공장 에어 압력만으로는 요구 클램핑력(${Math.round(requiredClampN)}N)에 도달 불가 (추력 포화)!`
            : `단일 스프링/인력만으로 ${p.loadKg}kgf(${p.accelG}G 관성 포함) 슬립 방어 불가 — 배력 기구 또는 공압 전환 필요!`
          : null,
    },
  ];

  const hasCriticalWarning = criticalLimits.some((l) => l.pct >= 85);

  const projectId =
    "CAD_" +
    Math.abs(
      Array.from(`${p.mechanismType}|${p.loadKg}|${p.objWidthMm}|${p.strokeMm}|${shaftDia}|${p.actuation}`).reduce(
        (acc, c) => (acc * 33 + c.charCodeAt(0)) | 0,
        19
      )
    )
      .toString(16)
      .toUpperCase()
      .padStart(6, "0")
      .slice(0, 6);

  const installedSpringLen = Math.max(
    Math.round(sp.solidHeight + 4),
    Math.round(freeLenMm - preloadDeflectMm)
  );

  // 기구별 정밀 어셈블리 파트 및 미스미 BOM 생성
  const built = buildPrecisionAssembly({
    p,
    sp,
    cylSpec,
    surf,
    shaftDia,
    boltSize,
    freeLenMm,
    installedSpringLen,
    travelActiveMm,
    actuatorForceN,
  });

  const sumCost = (key) =>
    built.bom.reduce((s, row) => s + row.prices[key] * row.qty, 0);

  const leadMap = {
    best: "익일~2일",
    fast: "당일출고",
    cheap: "4~5일",
  };

  return {
    projectId,
    titleKo: built.titleKo,
    titleEn: built.titleEn,
    subtitleKo: built.subtitleKo,
    params: p,
    dims: built.dims,
    hasCriticalWarning,
    criticalLimits,
    physics: {
      selectedShaftDia: shaftDia,
      gravityMs2: G0,
      loadKg: p.loadKg,
      accelG: p.accelG,
      staticLoadN: Number(staticLoadN.toFixed(1)),
      dynamicLoadN: Number(dynamicLoadN.toFixed(1)),
      frictionMu: surf.mu,
      requiredClampN: Number(requiredClampN.toFixed(1)),
      actuatorForceN: Number(actuatorForceN.toFixed(1)),
      actualHoldKgf: Number((actualHoldForceN / G0).toFixed(1)),
      safetyFactor: achievedSafetyFactor,
      tauMaxMpa,
      shaftDeflectUm,
      springSpecDetail: `선경 d=${sp.wireD}mm · 중심경 Dm=${sp.dm}mm · k=${sp.k}N/mm · 자유장 L0=${freeLenMm}mm (밀착장 ${sp.solidHeight}mm)`,
      formulaEquation: `F_dyn = ${p.loadKg}kg × 9.81 × (1+${p.accelG}G) = ${dynamicLoadN.toFixed(1)}N | τ_max = ${tauMaxMpa}MPa (Kw=${sp.wahlKw}) | δ_shaft = ${shaftDeflectUm}μm`,
    },
    costComparison: {
      best: { label: "표준 베스트(MISUMI)", totalKrw: sumCost("best"), lead: "익일~2일" },
      fast: { label: "급행 단납기(당일출고)", totalKrw: sumCost("fast"), lead: "당일출고" },
      cheap: { label: "양산 원가절감(C-Value)", totalKrw: sumCost("cheap"), lead: "4~5일" },
      selectedKey: p.priority,
    },
    bom: built.bom.map((b, idx) => ({
      no: idx + 1,
      partId: b.targetPartId || "",
      category: b.category,
      partName: b.partName,
      brand: b.brand,
      partNumber: b.skus[p.priority],
      specSummary: b.specSummary,
      material: b.material,
      qty: b.qty,
      leadTime: b.isCustomMachined ? "가공 3일" : leadMap[p.priority],
      unitPriceKrw: b.prices[p.priority],
      totalPriceKrw: b.prices[p.priority] * b.qty,
      isCustomMachined: Boolean(b.isCustomMachined),
    })),
    drawingSpec: {
      scale: "1 : 2",
      projection: "KS B ISO 128 제3각법",
      tolerance: `가이드축 Ø${shaftDia} g6 / 부쉬 H7 / 평행도 0.015mm`,
    },
    workpiece: built.workpiece,
    parts: built.parts,
  };
}

/**
 * 물리 임계치(항복/밀착/처짐/추력 포화) 초과 시 1클릭 자동 보강 설계치 산출
 */
export function computeAutoReinforcedParams(currentDesign) {
  const next = { ...currentDesign.params };
  const limits = currentDesign.criticalLimits;

  const springBad = (limits.find((l) => l.id === "spring_shear")?.pct || 0) >= 82;
  const shaftBad = (limits.find((l) => l.id === "shaft_deflection")?.pct || 0) >= 82;
  const slipBad = (limits.find((l) => l.id === "slip_saturation")?.pct || 0) >= 82;

  const curD = currentDesign.physics.selectedShaftDia || next.shaftDiameterOverride || 12;
  if (shaftBad || slipBad) {
    next.shaftDia = curD < 16 ? 16 : curD < 20 ? 20 : curD < 25 ? 25 : 32;
  }
  if (springBad) {
    next.springTierBoost = Math.min(3, (next.springTierBoost || 0) + 1);
    if (next.actuation === "spring") {
      next.actuation = "pneumatic";
    }
  }
  if (slipBad) {
    if (next.actuation === "spring") {
      next.actuation = next.loadKg > 45 ? "pneumatic" : "toggle";
    } else if (next.padKey === "carbide_jaw") {
      next.padKey = "urethane";
    }
  }

  return next;
}

/**
 * 5대 현업 기구 어셈블리 상세 지오메트리 빌더 (볼트 헤드·섕크, V-블록, 부쉬 플랜지 포함)
 */
function buildPrecisionAssembly({
  p,
  sp,
  cylSpec,
  surf,
  shaftDia,
  boltSize,
  freeLenMm,
  installedSpringLen,
  travelActiveMm,
  actuatorForceN,
}) {
  const boltR = boltSize === "M8" ? 4.0 : 3.0;
  const addCornerBolts = (arr, bx, by, bz, prefix = "BOLT") => {
    const coords = [
      [-bx, -by],
      [bx, -by],
      [-bx, by],
      [bx, by],
    ];
    coords.forEach(([cx, cy], i) => {
      arr.push({
        id: `${prefix}_${i + 1}`,
        stepName: `FASTENER_${boltSize}_CAP_BOLT_${i + 1}`,
        labelKo: `육각소켓 렌치볼트 (${boltSize} SCM435 10.9)`,
        material: "SCM435 흑착색 (10.9)",
        kind: "bolt",
        cx,
        cy,
        cz: bz,
        radius: boltR,
        headRadius: boltR * 1.65,
        headLength: boltR * 1.9,
        shankLength: 14,
        color: "#1e293b",
        metalness: 0.85,
        roughness: 0.25,
        explodeVec: [0, 0, 52],
      });
    });
  };

  // [기구 1] V-블록 원통 파이프/샤프트 CNC 가공 클램핑 지그 (현업 필수 지그!)
  if (p.mechanismType === "vblock_clamp") {
    const pipeR = p.objWidthMm / 2;
    const baseW = Math.max(210, p.objWidthMm + 140);
    const baseD = Math.max(140, p.objHeightMm + 30);
    const baseH = 22;
    const vBlockW = Math.max(76, p.objWidthMm + 34);
    const vBlockH = Math.max(36, pipeR + 18);
    const postX = Math.round(baseW * 0.37);
    const postH = vBlockH + pipeR * 2 + p.strokeMm + 52;
    const bridgeZ = baseH + postH;
    const clampPadZ = baseH + vBlockH + pipeR * 1.42;

    const parts = [
      {
        id: "VB_BASE",
        stepName: "01_S45C_GROUND_SUBPLATE",
        labelKo: "S45C 정밀 평면연삭 서브플레이트",
        material: "S45C 열처리 연삭",
        kind: "box",
        x: -baseW / 2,
        y: -baseD / 2,
        z: 0,
        w: baseW,
        d: baseD,
        h: baseH,
        color: "#27303f",
        metalness: 0.8,
        roughness: 0.28,
        explodeVec: [0, 0, -45],
      },
      // 좌/우 경사 V-블록 지지대 (원통 모재 2선 접촉 자동 센터링)
      {
        id: "VB_JAW_L",
        stepName: "02_VBLOCK_LOCATOR_LEFT_SKD11",
        labelKo: "90° 정밀 연삭 V-블록 좌측 시트",
        material: "SKD11 (HRC 60)",
        kind: "box",
        x: -vBlockW / 2,
        y: -baseD * 0.36,
        z: baseH,
        w: vBlockW * 0.44,
        d: baseD * 0.72,
        h: vBlockH,
        color: "#64748b",
        metalness: 0.86,
        roughness: 0.18,
        explodeVec: [-24, 0, -12],
      },
      {
        id: "VB_JAW_R",
        stepName: "03_VBLOCK_LOCATOR_RIGHT_SKD11",
        labelKo: "90° 정밀 연삭 V-블록 우측 시트",
        material: "SKD11 (HRC 60)",
        kind: "box",
        x: vBlockW * 0.06,
        y: -baseD * 0.36,
        z: baseH,
        w: vBlockW * 0.44,
        d: baseD * 0.72,
        h: vBlockH,
        color: "#64748b",
        metalness: 0.86,
        roughness: 0.18,
        explodeVec: [24, 0, -12],
      },
      {
        id: "VB_POST_L",
        stepName: `04_MISUMI_GUIDE_POST_D${shaftDia}_L`,
        labelKo: `좌측 가이드 포스트 (Ø${shaftDia}g6)`,
        material: "SUJ2 고주파열처리",
        kind: "cylinder",
        axis: "z",
        cx: -postX,
        cy: 0,
        cz: baseH,
        radius: shaftDia / 2,
        length: postH,
        color: "#e2e8f0",
        metalness: 0.94,
        roughness: 0.12,
        explodeVec: [-38, 0, 10],
      },
      {
        id: "VB_POST_R",
        stepName: `05_MISUMI_GUIDE_POST_D${shaftDia}_R`,
        labelKo: `우측 가이드 포스트 (Ø${shaftDia}g6)`,
        material: "SUJ2 고주파열처리",
        kind: "cylinder",
        axis: "z",
        cx: postX,
        cy: 0,
        cz: baseH,
        radius: shaftDia / 2,
        length: postH,
        color: "#e2e8f0",
        metalness: 0.94,
        roughness: 0.12,
        explodeVec: [38, 0, 10],
      },
      {
        id: "VB_BRIDGE",
        stepName: "06_TOP_CLAMP_BRIDGE_BEAM",
        labelKo: "상부 고강성 클램프 브리지 빔",
        material: "SCM440 조질강",
        kind: "box",
        x: -baseW * 0.44,
        y: -26,
        z: bridgeZ,
        w: baseW * 0.88,
        d: 52,
        h: 22,
        color: "#334155",
        metalness: 0.78,
        roughness: 0.26,
        explodeVec: [0, 0, 58],
      },
      {
        id: "VB_CLAMP_SHOE",
        stepName: "07_TOP_FLOATING_CLAMP_SHOE",
        labelKo: "상부 플로팅 압착 슈 블록",
        material: surf.name,
        kind: "box",
        x: -p.objWidthMm * 0.42,
        y: -24,
        z: clampPadZ,
        w: p.objWidthMm * 0.84,
        d: 48,
        h: 16,
        color: surf.color,
        metalness: 0.25,
        roughness: 0.65,
        motionRole: "ramVertical",
        maxTravel: p.strokeMm,
        explodeVec: [0, 0, 22],
      },
      {
        id: "VB_SPRING",
        stepName: `08_MISUMI_SPRING_${sp.skus.best}`,
        labelKo: `가압 프리로드 코일 스프링 (${sp.skus.best})`,
        material: "SWOSC-V 밸브스프링강",
        kind: "spring",
        axis: "z",
        cx: 0,
        cy: 0,
        cz: clampPadZ + 16,
        radius: sp.od / 2,
        wireDia: sp.wireD,
        turns: Math.round(sp.activeCoils),
        length: Math.max(26, bridgeZ - (clampPadZ + 16)),
        color: "#ef4444",
        motionRole: "springVertical",
        maxTravel: p.strokeMm,
        explodeVec: [0, 28, 38],
      },
      {
        id: "VB_ACTUATOR",
        stepName: p.actuation === "pneumatic" ? `09_CYLINDER_${cylSpec.skus.best}` : "09_CLAMP_SCREW_SPINDLE",
        labelKo: p.actuation === "pneumatic" ? `공압 실린더 (Ø${cylSpec.bore})` : "사다리꼴 리드 클램프 스핀들",
        material: "SCM435 / AL",
        kind: "cylinder",
        axis: "z",
        cx: 0,
        cy: 0,
        cz: bridgeZ + 22,
        radius: p.actuation === "pneumatic" ? cylSpec.bore / 2 : 12,
        length: 42,
        color: p.actuation === "pneumatic" ? "#0ea5e9" : "#d4af37",
        metalness: 0.82,
        roughness: 0.22,
        explodeVec: [0, 0, 82],
      },
    ];

    addCornerBolts(parts, baseW * 0.42, baseD * 0.38, baseH, "VB_BOLT");

    const bom = [
      {
        targetPartId: "VB_JAW_L",
        category: "기준 위치결정",
        partName: "정밀 연삭 90° V-블록 세트",
        brand: "MISUMI",
        skus: { best: `VBLK-SKD-${p.objWidthMm}`, fast: `VBLK-Q-${p.objWidthMm}`, cheap: `C-VBLK-${p.objWidthMm}` },
        specSummary: `대응 외경 Ø${p.objWidthMm} / 동심·평행도 0.01mm`,
        material: "SKD11 HRC60",
        qty: 1,
        prices: { best: 64000, fast: 76000, cheap: 38000 },
      },
      {
        targetPartId: "VB_POST_L",
        category: "가이드 기구",
        partName: "고강성 수직 가이드 포스트",
        brand: "MISUMI",
        skus: { best: `GPF${shaftDia}-${Math.round(postH)}`, fast: `SFJ${shaftDia}-${Math.round(postH)}`, cheap: `C-GPF${shaftDia}-${Math.round(postH)}` },
        specSummary: `Ø${shaftDia} g6 × ${Math.round(postH)}mm`,
        material: "SUJ2",
        qty: 2,
        prices: { best: 19500, fast: 23000, cheap: 10800 },
      },
      {
        targetPartId: "VB_SPRING",
        category: "탄성 가압부",
        partName: "고응력 실리콘크롬 코일 스프링",
        brand: "MISUMI",
        skus: { best: `${sp.skus.best}-L${freeLenMm}`, fast: `${sp.skus.fast}-L${freeLenMm}`, cheap: `${sp.skus.cheap}-L${freeLenMm}` },
        specSummary: `Ø${sp.od} × L${freeLenMm} (k=${sp.k}N/mm)`,
        material: "SWOSC-V",
        qty: 1,
        prices: sp.prices,
      },
      {
        targetPartId: "VB_CLAMP_SHOE",
        category: "압착 패드",
        partName: surf.name,
        brand: "MISUMI",
        skus: surf.skus,
        specSummary: `마찰계수 μ=${surf.mu} / 모재 손상·회전 방지`,
        material: "Urethane / SKD11",
        qty: 1,
        prices: surf.prices,
      },
      {
        targetPartId: "VB_BASE",
        category: "베이스·브리지",
        partName: "연삭 서브플레이트 & 상부 브리지 가공품",
        brand: "Custom CNC",
        skus: { best: `CNC-VB-${baseW}`, fast: `CNC-QVB-${baseW}`, cheap: `CNC-EVB-${baseW}` },
        specSummary: `${baseW}×${baseD}×22T 정밀 머시닝`,
        material: "S45C + SCM440",
        qty: 1,
        prices: { best: 158000, fast: 198000, cheap: 118000 },
        isCustomMachined: true,
      },
    ];

    return {
      titleKo: `원통 모재(Ø${p.objWidthMm}) 90° V-블록 절삭·고정 클램핑 지그`,
      titleEn: `Precision V-Block Cylindrical Clamping Fixture (D${p.objWidthMm})`,
      subtitleKo: `절삭/회전 부하 ${p.loadKg}kgf 대응 • 4선 접촉 센터링 • 축 처짐 ${shaftDia}mm 강성 설계`,
      dims: { w: Math.round(baseW), d: Math.round(baseD), h: Math.round(bridgeZ + 64) },
      workpiece: {
        shape: "cylinder",
        axis: "y",
        radius: pipeR,
        length: Math.min(baseD * 0.85, p.objHeightMm),
        z: baseH + vBlockH * 0.65 + pipeR * 0.55,
      },
      bom,
      parts,
    };
  }

  // [기구 2] 수직 가이드 프레스 픽스처 (포고핀 검사 / 압입 지그)
  if (p.mechanismType === "vertical_press") {
    const baseW = Math.max(190, p.objWidthMm + 120);
    const baseD = Math.max(150, p.objDepthMm + 86);
    const baseH = 20;
    const postX = Math.round(baseW * 0.38);
    const postH = 135 + p.strokeMm;
    const topZ = baseH + postH;
    const ramZ = baseH + 34;

    const parts = [
      {
        id: "PR_BASE",
        stepName: "01_BASE_PLATE_S45C",
        labelKo: "하부 정밀 기준 플레이트",
        material: "S45C 평면연삭",
        kind: "box",
        x: -baseW / 2,
        y: -baseD / 2,
        z: 0,
        w: baseW,
        d: baseD,
        h: baseH,
        color: "#27303f",
        metalness: 0.8,
        roughness: 0.28,
        explodeVec: [0, 0, -45],
      },
      {
        id: "PR_NEST",
        stepName: "02_DATUM_NEST_BLOCK",
        labelKo: "피검사물 데이텀 안착 네스트",
        material: "AL7075 경질아노다이징",
        kind: "box",
        x: -(p.objWidthMm + 20) / 2,
        y: -(p.objDepthMm + 20) / 2,
        z: baseH,
        w: p.objWidthMm + 20,
        d: p.objDepthMm + 20,
        h: 16,
        color: "#ca8a04",
        metalness: 0.82,
        roughness: 0.24,
        explodeVec: [0, 0, -18],
      },
      {
        id: "PR_POST_L",
        stepName: `03_MISUMI_POST_D${shaftDia}_L`,
        labelKo: `좌측 정밀 가이드 포스트 (Ø${shaftDia}g6)`,
        material: "SUJ2",
        kind: "cylinder",
        axis: "z",
        cx: -postX,
        cy: 0,
        cz: baseH,
        radius: shaftDia / 2,
        length: postH,
        color: "#e2e8f0",
        metalness: 0.94,
        roughness: 0.12,
        explodeVec: [-38, 0, 8],
      },
      {
        id: "PR_POST_R",
        stepName: `04_MISUMI_POST_D${shaftDia}_R`,
        labelKo: `우측 정밀 가이드 포스트 (Ø${shaftDia}g6)`,
        material: "SUJ2",
        kind: "cylinder",
        axis: "z",
        cx: postX,
        cy: 0,
        cz: baseH,
        radius: shaftDia / 2,
        length: postH,
        color: "#e2e8f0",
        metalness: 0.94,
        roughness: 0.12,
        explodeVec: [38, 0, 8],
      },
      {
        id: "PR_BUSH_L",
        stepName: `05_MISUMI_BUSH_LHFR${shaftDia}_L`,
        labelKo: "좌측 플랜지 리니어 부쉬",
        material: "SUJ2",
        kind: "cylinder",
        axis: "z",
        cx: -postX,
        cy: 0,
        cz: ramZ + 6,
        radius: shaftDia / 2 + 5,
        length: 28,
        color: "#d4af37",
        metalness: 0.86,
        roughness: 0.22,
        motionRole: "ramVertical",
        maxTravel: p.strokeMm,
        explodeVec: [-25, 0, 26],
      },
      {
        id: "PR_BUSH_R",
        stepName: `06_MISUMI_BUSH_LHFR${shaftDia}_R`,
        labelKo: "우측 플랜지 리니어 부쉬",
        material: "SUJ2",
        kind: "cylinder",
        axis: "z",
        cx: postX,
        cy: 0,
        cz: ramZ + 6,
        radius: shaftDia / 2 + 5,
        length: 28,
        color: "#d4af37",
        metalness: 0.86,
        roughness: 0.22,
        motionRole: "ramVertical",
        maxTravel: p.strokeMm,
        explodeVec: [25, 0, 26],
      },
      {
        id: "PR_RAM",
        stepName: "07_MOVING_PRESS_PLATEN",
        labelKo: "승강 가압 플래튼 플레이트",
        material: "AL6061-T6",
        kind: "box",
        x: -baseW * 0.44,
        y: -baseD * 0.32,
        z: ramZ + 12,
        w: baseW * 0.88,
        d: baseD * 0.64,
        h: 18,
        color: "#94a3b8",
        metalness: 0.82,
        roughness: 0.22,
        motionRole: "ramVertical",
        maxTravel: p.strokeMm,
        explodeVec: [0, 0, 22],
      },
      {
        id: "PR_PAD",
        stepName: "08_PRESSURE_PAD_BLOCK",
        labelKo: "균일 하중 분포 압착 패드",
        material: surf.name,
        kind: "box",
        x: -p.objWidthMm * 0.46,
        y: -p.objDepthMm * 0.46,
        z: ramZ,
        w: p.objWidthMm * 0.92,
        d: p.objDepthMm * 0.92,
        h: 12,
        color: surf.color,
        metalness: 0.2,
        roughness: 0.7,
        motionRole: "ramVertical",
        maxTravel: p.strokeMm,
        explodeVec: [0, 0, 10],
      },
      {
        id: "PR_SPRING",
        stepName: `09_MISUMI_SPRING_${sp.skus.best}`,
        labelKo: `가압/복귀 코일 스프링 (${sp.skus.best})`,
        material: "SWOSC-V",
        kind: "spring",
        axis: "z",
        cx: 0,
        cy: 0,
        cz: ramZ + 30,
        radius: sp.od / 2,
        wireDia: sp.wireD,
        turns: Math.round(sp.activeCoils),
        length: Math.max(28, topZ - (ramZ + 30)),
        color: "#3b82f6",
        motionRole: "springVertical",
        maxTravel: p.strokeMm,
        explodeVec: [0, 25, 42],
      },
      {
        id: "PR_TOP",
        stepName: "10_TOP_CROWN_PLATE",
        labelKo: "상단 크라운 브리지 플레이트",
        material: "S45C",
        kind: "box",
        x: -baseW * 0.44,
        y: -baseD * 0.32,
        z: topZ,
        w: baseW * 0.88,
        d: baseD * 0.64,
        h: 20,
        color: "#334155",
        metalness: 0.78,
        roughness: 0.28,
        explodeVec: [0, 0, 62],
      },
      {
        id: "PR_CYL",
        stepName: `11_ACTUATOR_${cylSpec.skus.best}`,
        labelKo: p.actuation === "pneumatic" ? `컴팩트 가이드 실린더 (Ø${cylSpec.bore})` : "상단 캠/레버 액추에이터",
        material: "AL 아노다이징",
        kind: "cylinder",
        axis: "z",
        cx: 0,
        cy: 0,
        cz: topZ + 20,
        radius: cylSpec.bore / 2,
        length: 44,
        color: "#0ea5e9",
        metalness: 0.78,
        roughness: 0.26,
        explodeVec: [0, 0, 88],
      },
    ];

    addCornerBolts(parts, baseW * 0.42, baseD * 0.38, baseH, "PR_BOLT");

    const bom = [
      {
        targetPartId: "PR_CYL",
        category: "수직 구동원",
        partName: p.actuation === "pneumatic" ? `박형 실린더 (보어 Ø${cylSpec.bore})` : "수동 캠-토글 프레스 헤드",
        brand: "SMC / MISUMI",
        skus: cylSpec.skus,
        specSummary: `스트로크 ${p.strokeMm}mm / 출력 ${Math.round(actuatorForceN)}N`,
        material: "AL 합금",
        qty: 1,
        prices: cylSpec.prices,
      },
      {
        targetPartId: "PR_POST_L",
        category: "직선 안내부",
        partName: "정밀 가이드 포스트 & 플랜지 부쉬",
        brand: "MISUMI",
        skus: { best: `GPF${shaftDia}-${postH}`, fast: `SFJ${shaftDia}-${postH}`, cheap: `C-GPF${shaftDia}-${postH}` },
        specSummary: `Ø${shaftDia} g6 + LHFR${shaftDia} 부쉬 세트`,
        material: "SUJ2 HRC60",
        qty: 2,
        prices: { best: 28000, fast: 32500, cheap: 14900 },
      },
      {
        targetPartId: "PR_SPRING",
        category: "버퍼/리턴",
        partName: "사각단면 금형 코일 스프링",
        brand: "MISUMI",
        skus: { best: `${sp.skus.best}-L${freeLenMm}`, fast: `${sp.skus.fast}-L${freeLenMm}`, cheap: `${sp.skus.cheap}-L${freeLenMm}` },
        specSummary: `Ø${sp.od} × L${freeLenMm} (k=${sp.k}N/mm)`,
        material: "SWOSC-V",
        qty: 1,
        prices: sp.prices,
      },
      {
        targetPartId: "PR_BASE",
        category: "구조 가공품",
        partName: "상·하 플레이트 및 데이텀 네스트 세트",
        brand: "Custom CNC",
        skus: { best: `CNC-PRS-${baseW}`, fast: `CNC-QPRS-${baseW}`, cheap: `CNC-EPRS-${baseW}` },
        specSummary: `${baseW}×${baseD}mm 평행도 0.015mm 연삭`,
        material: "S45C + AL7075",
        qty: 1,
        prices: { best: 172000, fast: 218000, cheap: 129000 },
        isCustomMachined: true,
      },
    ];

    return {
      titleKo: `${p.objectName} ${p.loadKg}kgf 수직 정압 프레스·검사 픽스처`,
      titleEn: `Vertical Guide Post Press & Test Fixture (${p.loadKg}kgf)`,
      subtitleKo: `포고핀/압입 반력 ${p.loadKg}kgf 대응 • 축 처짐 ${shaftDia}mm 강성 확보 • 스트로크 ${p.strokeMm}mm`,
      dims: { w: Math.round(baseW), d: Math.round(baseD), h: Math.round(topZ + 64) },
      workpiece: { shape: "box", w: p.objWidthMm, d: p.objDepthMm, h: 16, z: baseH + 16 },
      bom,
      parts,
    };
  }

  // [기구 3] 정밀 인덱싱 플런저 지그 & [기구 4] 사점 배력 토글 클램프
  if (p.mechanismType === "indexing_plunger" || p.mechanismType === "toggle_clamp") {
    const isToggle = p.mechanismType === "toggle_clamp";
    const baseW = isToggle ? 230 : 160;
    const baseD = 115;
    const baseH = 20;
    const totalH = isToggle ? 190 : 195 + p.strokeMm;

    const parts = isToggle
      ? [
          {
            id: "TG_BASE",
            stepName: "01_TOGGLE_BASE_PLATE",
            labelKo: "고강성 베이스 플레이트",
            material: "S45C 흑착색",
            kind: "box",
            x: -115,
            y: -57,
            z: 0,
            w: baseW,
            d: baseD,
            h: baseH,
            color: "#27303f",
            metalness: 0.8,
            roughness: 0.28,
            explodeVec: [0, 0, -40],
          },
          {
            id: "TG_TOWER",
            stepName: "02_LINKAGE_PIVOT_BRACKET",
            labelKo: "4절 링크 지지 브래킷",
            material: "SCM440",
            kind: "box",
            x: -98,
            y: -26,
            z: baseH,
            w: 46,
            d: 52,
            h: 78,
            color: "#475569",
            metalness: 0.78,
            roughness: 0.26,
            explodeVec: [-35, 0, 12],
          },
          {
            id: "TG_PIVOT_PIN",
            stepName: `03_MISUMI_DOWEL_PIN_D${shaftDia}`,
            labelKo: `이중전단 피벗 다웰핀 (Ø${shaftDia}h6)`,
            material: "SUJ2 열처리",
            kind: "cylinder",
            axis: "y",
            cx: -75,
            cy: -30,
            cz: baseH + 62,
            radius: shaftDia / 2,
            length: 60,
            color: "#e2e8f0",
            metalness: 0.94,
            roughness: 0.12,
            explodeVec: [0, -42, 18],
          },
          {
            id: "TG_ARM",
            stepName: "04_FORGED_CLAMPING_ARM",
            labelKo: "4.8:1 사점 배력 클램핑 암",
            material: "S45C 단조강",
            kind: "box",
            x: -80,
            y: -16,
            z: 88,
            w: 162,
            d: 32,
            h: 18,
            color: "#cbd5e1",
            metalness: 0.85,
            roughness: 0.2,
            motionRole: "ramVertical",
            maxTravel: p.strokeMm,
            explodeVec: [18, 0, 36],
          },
          {
            id: "TG_SPINDLE",
            stepName: "05_SWIVEL_PRESSURE_SPINDLE",
            labelKo: "스위블 압착 스핀들 패드",
            material: surf.name,
            kind: "cylinder",
            axis: "z",
            cx: 58,
            cy: 0,
            cz: 52,
            radius: 15,
            length: 36,
            color: surf.color,
            metalness: 0.25,
            roughness: 0.65,
            motionRole: "ramVertical",
            maxTravel: p.strokeMm,
            explodeVec: [25, 0, 20],
          },
          {
            id: "TG_HANDLE",
            stepName: "06_OPERATING_LEVER_HANDLE",
            labelKo: "원터치 셀프락킹 조작 레버",
            material: "S45C + 우레탄 그립",
            kind: "cylinder",
            axis: "z",
            cx: -70,
            cy: 0,
            cz: 100,
            radius: 9,
            length: 88,
            color: "#ef4444",
            metalness: 0.35,
            roughness: 0.55,
            explodeVec: [-25, 0, 62],
          },
        ]
      : [
          {
            id: "PL_BASE",
            stepName: "01_INDEX_HOUSING_FLANGE",
            labelKo: "인덱싱 플랜지 하우징 블록",
            material: "SCM440",
            kind: "box",
            x: -80,
            y: -55,
            z: 0,
            w: 160,
            d: 110,
            h: 24,
            color: "#27303f",
            metalness: 0.8,
            roughness: 0.28,
            explodeVec: [0, 0, -40],
          },
          {
            id: "PL_PIN",
            stepName: `02_MISUMI_LOCATING_PIN_D${shaftDia}`,
            labelKo: `정밀 전단 저항 위치결정 핀 (Ø${shaftDia}g6)`,
            material: "SUS440C HRC58",
            kind: "cylinder",
            axis: "z",
            cx: 0,
            cy: 0,
            cz: 4,
            radius: shaftDia / 2,
            length: totalH - 22,
            color: "#e2e8f0",
            metalness: 0.94,
            roughness: 0.1,
            motionRole: "ramVertical",
            maxTravel: p.strokeMm,
            explodeVec: [0, 0, -18],
          },
          {
            id: "PL_SLEEVE",
            stepName: "03_GUIDE_BUSH_BODY",
            labelKo: "무급유 가이드 부쉬 바디",
            material: "C3604 고력황동",
            kind: "cylinder",
            axis: "z",
            cx: 0,
            cy: 0,
            cz: 24,
            radius: shaftDia / 2 + 11,
            length: 44,
            color: "#d4af37",
            metalness: 0.86,
            roughness: 0.22,
            explodeVec: [0, 0, 14],
          },
          {
            id: "PL_SPRING",
            stepName: `04_MISUMI_SPRING_${sp.skus.best}`,
            labelKo: "프리로드 복원 스프링",
            material: "SWOSC-V",
            kind: "spring",
            axis: "z",
            cx: 0,
            cy: 0,
            cz: 70,
            radius: sp.od / 2,
            wireDia: sp.wireD,
            turns: Math.round(sp.activeCoils),
            length: totalH - 102,
            color: "#ef4444",
            motionRole: "springVertical",
            maxTravel: p.strokeMm,
            explodeVec: [0, 28, 40],
          },
          {
            id: "PL_KNOB",
            stepName: "05_QUICK_PULL_T_BAR",
            labelKo: "록킹 노브 & T-풀 핸들",
            material: "SUS304",
            kind: "cylinder",
            axis: "x",
            cx: -65,
            cy: 0,
            cz: totalH - 22,
            radius: 7,
            length: 130,
            color: "#38bdf8",
            metalness: 0.8,
            roughness: 0.22,
            motionRole: "ramVertical",
            maxTravel: p.strokeMm,
            explodeVec: [0, 0, 72],
          },
        ];

    addCornerBolts(parts, baseW * 0.4, baseD * 0.36, baseH, "SUB_BOLT");

    const bom = [
      {
        targetPartId: isToggle ? "TG_ARM" : "PL_PIN",
        category: isToggle ? "배력 클램프" : "인덱싱 코어",
        partName: isToggle ? "사점 셀프락킹 중하중 토글 어셈블리" : `정밀 인덱싱 플런저 (핀 Ø${shaftDia})`,
        brand: "MISUMI",
        skus: isToggle
          ? { best: "MC01-3S", fast: "KC-42C", cheap: "C-TGL-350" }
          : { best: `PMXWL${shaftDia}`, fast: `PMXSL${shaftDia}`, cheap: `C-PMX${shaftDia}` },
        specSummary: isToggle
          ? `배력비 4.8:1 / 유지하중 ${Math.round(actuatorForceN)}N`
          : `전단 저항 핀 Ø${shaftDia} g6 / 반복정밀도 ±0.015mm`,
        material: "SCM440 / SUS440C",
        qty: 1,
        prices: { best: 31000, fast: 35500, cheap: 16200 },
      },
      {
        targetPartId: isToggle ? "TG_SPINDLE" : "PL_SPRING",
        category: isToggle ? "압착 스핀들" : "예압 스프링",
        partName: isToggle ? surf.name : "실리콘크롬 압축 스프링",
        brand: "MISUMI",
        skus: isToggle
          ? surf.skus
          : { best: `${sp.skus.best}-L${freeLenMm}`, fast: `${sp.skus.fast}-L${freeLenMm}`, cheap: `${sp.skus.cheap}-L${freeLenMm}` },
        specSummary: isToggle ? `마찰계수 μ=${surf.mu}` : `k=${sp.k}N/mm · L0=${freeLenMm}mm`,
        material: isToggle ? "Urethane" : "SWOSC-V",
        qty: 1,
        prices: isToggle ? surf.prices : sp.prices,
      },
      {
        targetPartId: isToggle ? "TG_BASE" : "PL_BASE",
        category: "마운팅 베이스",
        partName: "정밀 기준 베이스 브래킷 가공품",
        brand: "Custom CNC",
        skus: { best: `CNC-SUB-${baseW}`, fast: `CNC-QSUB-${baseW}`, cheap: `CNC-ESUB-${baseW}` },
        specSummary: `${baseW}×${baseD}mm 정밀 보링 및 평면연삭`,
        material: "S45C / SCM440",
        qty: 1,
        prices: { best: 94000, fast: 122000, cheap: 71000 },
        isCustomMachined: true,
      },
    ];

    return {
      titleKo: isToggle
        ? `사점(Over-Center) 4.8배력 원터치 토글 클램프 지그 (${p.loadKg}kgf)`
        : `전단하중 ${p.loadKg}kgf 정밀 인덱싱 플런저 스톱 지그`,
      titleEn: isToggle ? "Heavy-Duty Over-Center Toggle Clamp Fixture" : "Precision Zero-Backlash Indexing Plunger Jig",
      subtitleKo: isToggle
        ? `진동·외력 풀림 제로 사점 잠금 • 피벗 핀 전단 검증 완료`
        : `분할 위치결정 정밀도 ±0.015mm • SUS440C 열처리 핀`,
      dims: { w: baseW, d: baseD, h: totalH },
      workpiece: isToggle ? { shape: "box", w: 54, d: 46, h: 32, z: baseH, xOffset: 58 } : null,
      bom,
      parts,
    };
  }

  // [기본 주력 기구 5] 고속 이송·픽앤플레이스 대응 평행 그리퍼 지그
  const padThick = 6;
  const jawThick = 16;
  const wallThick = 18;
  const halfObj = p.objWidthMm / 2;
  const jawInnerX = halfObj + padThick;
  const endWallInnerX = jawInnerX + jawThick + installedSpringLen;
  const baseHalfW = endWallInnerX + wallThick;
  const totalW = Math.round(baseHalfW * 2);
  const totalD = Math.max(126, p.objDepthMm + 88);
  const baseH = 18;
  const shaftZ = baseH + 28;
  const shaftOffsetY = Math.round(totalD * 0.29);
  const fingerTopZ = shaftZ + 24 + Math.max(46, Math.round(p.objHeightMm * 0.62));
  const totalH = fingerTopZ;
  const shaftLen = totalW - 10;
  const shaftR = shaftDia / 2;
  const bushR = shaftR + 5.5;

  const parts = [
    {
      id: "PG_BASE",
      stepName: "01_AL6061_PRECISION_BASE_PLATE",
      labelKo: "AL6061-T6 경질아노다이징 베이스",
      material: "AL6061-T6 흑색 아노다이징",
      kind: "box",
      x: -baseHalfW,
      y: -totalD / 2,
      z: 0,
      w: totalW,
      d: totalD,
      h: baseH,
      color: "#27303f",
      metalness: 0.78,
      roughness: 0.3,
      explodeVec: [0, 0, -45],
    },
    {
      id: "PG_WALL_L",
      stepName: "02_LEFT_END_BLOCK",
      labelKo: "좌측 샤프트 홀더 & 반력 블록",
      material: "AL7075-T6",
      kind: "box",
      x: -baseHalfW,
      y: -totalD * 0.42,
      z: baseH,
      w: wallThick,
      d: totalD * 0.84,
      h: 52,
      color: "#475569",
      metalness: 0.76,
      roughness: 0.28,
      explodeVec: [-55, 0, 0],
    },
    {
      id: "PG_WALL_R",
      stepName: "03_RIGHT_END_BLOCK",
      labelKo: "우측 샤프트 홀더 & 반력 블록",
      material: "AL7075-T6",
      kind: "box",
      x: endWallInnerX,
      y: -totalD * 0.42,
      z: baseH,
      w: wallThick,
      d: totalD * 0.84,
      h: 52,
      color: "#475569",
      metalness: 0.76,
      roughness: 0.28,
      explodeVec: [55, 0, 0],
    },
    {
      id: "PG_SHAFT_F",
      stepName: `04_MISUMI_SHAFT_PSFR${shaftDia}_FRONT`,
      labelKo: `전면 리니어 가이드축 (Ø${shaftDia}g6)`,
      material: "SUJ2 HRC60+ 경질크롬",
      kind: "cylinder",
      axis: "x",
      cx: -shaftLen / 2,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: shaftR,
      length: shaftLen,
      color: "#e2e8f0",
      metalness: 0.94,
      roughness: 0.11,
      explodeVec: [0, -42, 18],
    },
    {
      id: "PG_SHAFT_R",
      stepName: `05_MISUMI_SHAFT_PSFR${shaftDia}_REAR`,
      labelKo: `후면 리니어 가이드축 (Ø${shaftDia}g6)`,
      material: "SUJ2 HRC60+ 경질크롬",
      kind: "cylinder",
      axis: "x",
      cx: -shaftLen / 2,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: shaftR,
      length: shaftLen,
      color: "#e2e8f0",
      metalness: 0.94,
      roughness: 0.11,
      explodeVec: [0, 42, 18],
    },
    {
      id: "PG_BUSH_LF",
      stepName: `06_MISUMI_BUSH_LHFR${shaftDia}_LF`,
      labelKo: `플랜지 리니어 부쉬 (LHFR${shaftDia})`,
      material: "SUJ2 베어링강",
      kind: "cylinder",
      axis: "x",
      cx: -jawInnerX - jawThick - 6,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.86,
      roughness: 0.22,
      motionRole: "jawLeft",
      maxTravel: travelActiveMm,
      explodeVec: [-25, -25, 16],
    },
    {
      id: "PG_BUSH_LR",
      stepName: `07_MISUMI_BUSH_LHFR${shaftDia}_LR`,
      labelKo: `플랜지 리니어 부쉬 (LHFR${shaftDia})`,
      material: "SUJ2 베어링강",
      kind: "cylinder",
      axis: "x",
      cx: -jawInnerX - jawThick - 6,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.86,
      roughness: 0.22,
      motionRole: "jawLeft",
      maxTravel: travelActiveMm,
      explodeVec: [-25, 25, 16],
    },
    {
      id: "PG_BUSH_RF",
      stepName: `08_MISUMI_BUSH_LHFR${shaftDia}_RF`,
      labelKo: `플랜지 리니어 부쉬 (LHFR${shaftDia})`,
      material: "SUJ2 베어링강",
      kind: "cylinder",
      axis: "x",
      cx: jawInnerX - 2,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.86,
      roughness: 0.22,
      motionRole: "jawRight",
      maxTravel: travelActiveMm,
      explodeVec: [25, -25, 16],
    },
    {
      id: "PG_BUSH_RR",
      stepName: `09_MISUMI_BUSH_LHFR${shaftDia}_RR`,
      labelKo: `플랜지 리니어 부쉬 (LHFR${shaftDia})`,
      material: "SUJ2 베어링강",
      kind: "cylinder",
      axis: "x",
      cx: jawInnerX - 2,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: bushR,
      length: jawThick + 8,
      color: "#d4af37",
      metalness: 0.86,
      roughness: 0.22,
      motionRole: "jawRight",
      maxTravel: travelActiveMm,
      explodeVec: [25, 25, 16],
    },
    {
      id: "PG_SPRING_L",
      stepName: `10_MISUMI_SPRING_${sp.skus.best}_L`,
      labelKo: `좌측 프리로드 스프링 (${sp.skus.best}-L${freeLenMm})`,
      material: "SWOSC-V 실리콘크롬강",
      kind: "spring",
      axis: "x",
      cx: -endWallInnerX,
      cy: -shaftOffsetY,
      cz: shaftZ,
      radius: sp.od / 2,
      wireDia: sp.wireD,
      turns: Math.round(sp.activeCoils),
      length: installedSpringLen,
      color: "#ef4444",
      motionRole: "springLeft",
      maxTravel: travelActiveMm,
      explodeVec: [-38, -22, 36],
    },
    {
      id: "PG_SPRING_R",
      stepName: `11_MISUMI_SPRING_${sp.skus.best}_R`,
      labelKo: `우측 프리로드 스프링 (${sp.skus.best}-L${freeLenMm})`,
      material: "SWOSC-V 실리콘크롬강",
      kind: "spring",
      axis: "x",
      cx: jawInnerX + jawThick,
      cy: shaftOffsetY,
      cz: shaftZ,
      radius: sp.od / 2,
      wireDia: sp.wireD,
      turns: Math.round(sp.activeCoils),
      length: installedSpringLen,
      color: "#ef4444",
      motionRole: "springRight",
      maxTravel: travelActiveMm,
      explodeVec: [38, 22, 36],
    },
    {
      id: "PG_CARRIER_L",
      stepName: "12_LEFT_JAW_CARRIER_BLOCK",
      labelKo: "좌측 무빙 캐리지 블록",
      material: "AL7075-T6",
      kind: "box",
      x: -jawInnerX - jawThick,
      y: -totalD * 0.38,
      z: baseH + 6,
      w: jawThick,
      d: totalD * 0.76,
      h: 46,
      color: "#94a3b8",
      metalness: 0.82,
      roughness: 0.24,
      motionRole: "jawLeft",
      maxTravel: travelActiveMm,
      explodeVec: [-20, 0, 28],
    },
    {
      id: "PG_CARRIER_R",
      stepName: "13_RIGHT_JAW_CARRIER_BLOCK",
      labelKo: "우측 무빙 캐리지 블록",
      material: "AL7075-T6",
      kind: "box",
      x: jawInnerX,
      y: -totalD * 0.38,
      z: baseH + 6,
      w: jawThick,
      d: totalD * 0.76,
      h: 46,
      color: "#94a3b8",
      metalness: 0.82,
      roughness: 0.24,
      motionRole: "jawRight",
      maxTravel: travelActiveMm,
      explodeVec: [20, 0, 28],
    },
    {
      id: "PG_FINGER_L",
      stepName: "14_LEFT_PRECISION_FINGER",
      labelKo: "좌측 고강성 그리퍼 핑거",
      material: "AL7075-T6",
      kind: "box",
      x: -jawInnerX - 13,
      y: -Math.max(24, p.objDepthMm * 0.45),
      z: baseH + 52,
      w: 13,
      d: Math.max(48, p.objDepthMm * 0.9),
      h: fingerTopZ - (baseH + 52),
      color: "#cbd5e1",
      metalness: 0.84,
      roughness: 0.2,
      motionRole: "jawLeft",
      maxTravel: travelActiveMm,
      explodeVec: [-18, 0, 58],
    },
    {
      id: "PG_FINGER_R",
      stepName: "15_RIGHT_PRECISION_FINGER",
      labelKo: "우측 고강성 그리퍼 핑거",
      material: "AL7075-T6",
      kind: "box",
      x: jawInnerX,
      y: -Math.max(24, p.objDepthMm * 0.45),
      z: baseH + 52,
      w: 13,
      d: Math.max(48, p.objDepthMm * 0.9),
      h: fingerTopZ - (baseH + 52),
      color: "#cbd5e1",
      metalness: 0.84,
      roughness: 0.2,
      motionRole: "jawRight",
      maxTravel: travelActiveMm,
      explodeVec: [18, 0, 58],
    },
    {
      id: "PG_PAD_L",
      stepName: "16_MISUMI_CONTACT_PAD_LEFT",
      labelKo: `좌측 파지 패드 (${surf.name})`,
      material: surf.name,
      kind: "box",
      x: -halfObj - padThick,
      y: -Math.max(20, p.objDepthMm * 0.4),
      z: baseH + 58,
      w: padThick,
      d: Math.max(40, p.objDepthMm * 0.8),
      h: Math.max(32, fingerTopZ - (baseH + 64)),
      color: surf.color,
      metalness: 0.18,
      roughness: 0.7,
      motionRole: "jawLeft",
      maxTravel: travelActiveMm,
      explodeVec: [-8, 0, 72],
    },
    {
      id: "PG_PAD_R",
      stepName: "17_MISUMI_CONTACT_PAD_RIGHT",
      labelKo: `우측 파지 패드 (${surf.name})`,
      material: surf.name,
      kind: "box",
      x: halfObj,
      y: -Math.max(20, p.objDepthMm * 0.4),
      z: baseH + 58,
      w: padThick,
      d: Math.max(40, p.objDepthMm * 0.8),
      h: Math.max(32, fingerTopZ - (baseH + 64)),
      color: surf.color,
      metalness: 0.18,
      roughness: 0.7,
      motionRole: "jawRight",
      maxTravel: travelActiveMm,
      explodeVec: [8, 0, 72],
    },
  ];

  if (p.actuation === "pneumatic") {
    parts.push({
      id: "PG_AIR_CYL",
      stepName: `18_SMC_CYLINDER_${cylSpec.skus.best}`,
      labelKo: `공압 구동 실린더 (보어 Ø${cylSpec.bore} · 0.5MPa)`,
      material: "AL 하드아노다이징",
      kind: "cylinder",
      axis: "z",
      cx: 0,
      cy: 0,
      cz: baseH,
      radius: cylSpec.bore / 2,
      length: 34,
      color: "#0ea5e9",
      metalness: 0.8,
      roughness: 0.25,
      explodeVec: [0, 0, -24],
    });
  }

  addCornerBolts(parts, baseHalfW - 9, totalD * 0.34, baseH + 52, "PG_BOLT");

  const bom = [
    {
      targetPartId: "PG_SPRING_L",
      category: "탄성/예압원",
      partName: "실리콘크롬 고응력 코일 스프링",
      brand: "MISUMI",
      skus: { best: `${sp.skus.best}-L${freeLenMm}`, fast: `${sp.skus.fast}-L${freeLenMm}`, cheap: `${sp.skus.cheap}-L${freeLenMm}` },
      specSummary: `Ø${sp.od} × L${freeLenMm} (d=${sp.wireD}, k=${sp.k}N/mm)`,
      material: "SWOSC-V",
      qty: 2,
      prices: sp.prices,
    },
    {
      targetPartId: "PG_SHAFT_F",
      category: "직선 가이드축",
      partName: "양단 탭 고주파열처리 리니어 샤프트",
      brand: "MISUMI",
      skus: { best: `PSFR${shaftDia}-${shaftLen}`, fast: `SFJ${shaftDia}-${shaftLen}`, cheap: `C-PSFR${shaftDia}-${shaftLen}` },
      specSummary: `Ø${shaftDia} g6 × ${shaftLen}mm (HRC60+)`,
      material: "SUJ2",
      qty: 2,
      prices: { best: shaftDia >= 16 ? 21500 : 16400, fast: shaftDia >= 16 ? 24800 : 18900, cheap: shaftDia >= 16 ? 11200 : 8900 },
    },
    {
      targetPartId: "PG_BUSH_LF",
      category: "베어링 부쉬",
      partName: "원형 플랜지형 리니어 볼 부쉬",
      brand: "MISUMI",
      skus: { best: `LHFR${shaftDia}`, fast: `LMFP${shaftDia}`, cheap: `C-LHFR${shaftDia}` },
      specSummary: `내경 Ø${shaftDia} H7 / 허용각변위 관리`,
      material: "SUJ2",
      qty: 4,
      prices: { best: shaftDia >= 16 ? 15800 : 12500, fast: shaftDia >= 16 ? 18200 : 14200, cheap: shaftDia >= 16 ? 7900 : 6200 },
    },
    {
      targetPartId: "PG_PAD_L",
      category: "파지 패드",
      partName: surf.name,
      brand: "MISUMI",
      skus: surf.skus,
      specSummary: `두께 ${padThick}T / 마찰계수 μ=${surf.mu}`,
      material: "Urethane / SKD11",
      qty: 2,
      prices: surf.prices,
    },
    ...(p.actuation === "pneumatic"
      ? [
          {
            targetPartId: "PG_AIR_CYL",
            category: "공압 구동부",
            partName: `박형 가이드 에어 실린더 (Ø${cylSpec.bore})`,
            brand: "SMC / MISUMI",
            skus: {
              best: `${cylSpec.skus.best}-${p.strokeMm}Z`,
              fast: `${cylSpec.skus.fast}-${p.strokeMm}DZ`,
              cheap: `${cylSpec.skus.cheap}-${p.strokeMm}`,
            },
            specSummary: `0.5MPa 추력 ${Math.round(actuatorForceN)}N`,
            material: "AL 합금",
            qty: 1,
            prices: cylSpec.prices,
          },
        ]
      : []),
    {
      targetPartId: "PG_BOLT_1",
      category: "고장력 체결",
      partName: `육각소켓 렌치볼트 (${boltSize} 강도 10.9)`,
      brand: "MISUMI",
      skus: { best: `CB${boltSize.slice(1)}-20`, fast: `CB${boltSize.slice(1)}-20-Q`, cheap: `C-CB${boltSize.slice(1)}-20` },
      specSummary: `보증응력 830 MPa 고장력 체결`,
      material: "SCM435",
      qty: 8,
      prices: { best: 480, fast: 550, cheap: 240 },
    },
    {
      targetPartId: "PG_BASE",
      category: "정밀 가공품",
      partName: "베이스·엔드블록·그리퍼 핑거 가공 세트",
      brand: "Custom CNC",
      skus: { best: `CNC-PG-${totalW}X${totalD}`, fast: `CNC-QPG-${totalW}`, cheap: `CNC-EPG-${totalW}` },
      specSummary: `${totalW}×${totalD}×${totalH}mm 머시닝`,
      material: "AL6061 + AL7075",
      qty: 1,
      prices: { best: 148000, fast: 192000, cheap: 114000 },
      isCustomMachined: true,
    },
  ];

  return {
    titleKo: `${p.objectName} 이송·파지용 정밀 평행 그리퍼 지그`,
    titleEn: `Precision Parallel Linear Gripper Assembly (${p.loadKg}kgf)`,
    subtitleKo: `정하중 ${p.loadKg}kgf + 가감속 ${p.accelG}G 관성 반영 • 가이드축 Ø${shaftDia}g6 • 스트로크 ${p.strokeMm}mm`,
    dims: { w: totalW, d: totalD, h: totalH },
    workpiece: {
      shape: p.objectShape,
      axis: "z",
      radius: p.objWidthMm / 2,
      length: p.objHeightMm,
      w: p.objWidthMm,
      d: p.objDepthMm,
      h: p.objHeightMm,
      z: baseH + 54,
    },
    bom,
    parts,
  };
}

/**
 * Make.com "Import Blueprint" 메뉴에 즉시 넣을 수 있는 실전 시나리오 JSON 생성기
 */
export function generateMakeBlueprintJson() {
  return JSON.stringify(
    {
      name: "AI Mechanical Jig & MISUMI Engineering Pipeline V4",
      flow: [
        {
          id: 1,
          module: "gateway:CustomWebHook",
          version: 1,
          parameters: { name: "CAD Studio Field Prompt Receiver" },
          mapper: {},
        },
        {
          id: 2,
          module: "openai-gpt-3:CreateCompletion",
          version: 1,
          parameters: {},
          mapper: {
            model: "gpt-4o",
            response_format: "json_object",
            messages: [
              {
                role: "system",
                content:
                  "당신은 20년 경력의 기계설계·자동화 치공구 수석 엔지니어입니다. 현장 작업자의 요청에서 mechanismType(parallel_gripper|vblock_clamp|vertical_press|toggle_clamp|indexing_plunger), loadKg, accelG, objWidthMm, strokeMm, padKey(urethane|silicone|carbide_jaw), actuation(spring|pneumatic|toggle), priority(best|fast|cheap), engineerNote 필드를 가진 JSON만 반환하세요.",
              },
              {
                role: "user",
                content: "{{1.prompt}}",
              },
            ],
          },
        },
        {
          id: 3,
          module: "gateway:WebhookRespond",
          version: 1,
          parameters: {},
          mapper: {
            status: "200",
            headers: [{ name: "Content-Type", value: "application/json" }],
            body: "{{2.choices[].message.content}}",
          },
        },
      ],
    },
    null,
    2
  );
    }
