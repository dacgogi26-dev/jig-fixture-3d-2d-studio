/**
 * 상용 CAD 100% 호환 ISO-10303-21 AP214 (AUTOMOTIVE_DESIGN) 정밀 B-Rep 솔리드 컴파일러
 * 호환 검증 대상: SolidWorks (Parasolid), Autodesk Inventor, Fusion 360, CATIA, Creo, NX, Onshape, FreeCAD (OpenCASCADE)
 *
 * 핵심 설계:
 * 1. AP214 표준 스키마: AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }
 * 2. 필수 루트 엔티티 포함: PRODUCT_RELATED_PRODUCT_CATEGORY('part', $, (#prod))
 * 3. 해석적 원통 곡면(CYLINDRICAL_SURFACE + CIRCLE 180도 분할 2면 + PLANE 캡 2면)으로
 *    Parasolid/OpenCASCADE 주기적 이음매(Seam) 오류 원천 제거 및 진짜 원통 면 인식 보장
 * 4. 색상 메타데이터(MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION + COLOUR_RGB) 지원
 * 5. 포렌식 전자지문 헤더 + 0.001mm 급 초미세 기하학 스테가노그래피 각인
 */

function fmt(n) {
  const val = Number(n);
  if (!Number.isFinite(val) || Math.abs(val) < 1e-11) return "0.";
  const s = val.toFixed(6).replace(/0+$/, "");
  return s.endsWith(".") ? s : s;
}

function cleanStepStr(str) {
  return String(str || "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/'/g, "''")
    .replace(/\\/g, "/");
}

function hexToRgb01(hex) {
  const h = String(hex || "#94a3b8").replace("#", "");
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return [0.58, 0.64, 0.72];
  return [
    Number((((num >> 16) & 255) / 255).toFixed(4)),
    Number((((num >> 8) & 255) / 255).toFixed(4)),
    Number(((num & 255) / 255).toFixed(4)),
  ];
}

export function compileUniversalAp214Step({
  projectId,
  titleEn,
  parts,
  watermark,
  ownerTag,
}) {
  let nextId = 1;
  const dataLines = [];

  const add = (expr) => {
    const id = nextId++;
    dataLines.push(`#${id} = ${expr};`);
    return id;
  };

  const safePid = cleanStepStr(projectId || "JIG_ASM_01");
  const safeTitle = cleanStepStr(titleEn || "AI Precision Jig Assembly");
  const wmkId = cleanStepStr(watermark?.watermarkId || "WMK-VERIFIED");
  const wmkSig = cleanStepStr(watermark?.signatureHex || "AUTHENTIC");
  const dxMicro = Number(watermark?.microDeltaMm?.dx || 0.0023);
  const dyMicro = Number(watermark?.microDeltaMm?.dy || 0.0037);
  const dzMicro = Number(watermark?.microDeltaMm?.dz || 0.0019);

  // 1. AP214 Application Protocol & Product Definition (OpenCASCADE / SolidWorks 표준 구조)
  const appCtx = add(
    "APPLICATION_CONTEXT('core data for automotive mechanical design processes')"
  );
  add(
    `APPLICATION_PROTOCOL_DEFINITION('international standard', 'automotive_design', 2000, #${appCtx})`
  );
  const prodCtx = add(`PRODUCT_CONTEXT('', #${appCtx}, 'mechanical')`);
  const prod = add(
    `PRODUCT('${safePid}', '${safeTitle}', 'DRM:${wmkId}', (#${prodCtx}))`
  );
  const pdf = add(`PRODUCT_DEFINITION_FORMATION('1', 'Production', #${prod})`);
  const pdCtx = add(
    `PRODUCT_DEFINITION_CONTEXT('part definition', #${appCtx}, 'design')`
  );
  const pd = add(`PRODUCT_DEFINITION('design', '', #${pdf}, #${pdCtx})`);
  const pds = add(`PRODUCT_DEFINITION_SHAPE('', '', #${pd})`);

  // [핵심] SolidWorks / Fusion 360 / Inventor / FreeCAD STEP 리더가 루트 파트를 인식하는 필수 엔티티
  add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part', $, (#${prod}))`);

  // 2. 단위계 (mm, radian, steradian) 및 기하 표현 컨텍스트
  const lenUnit = add("( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI., .METRE.) )");
  const angUnit = add("( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($, .RADIAN.) )");
  const solidUnit = add("( NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($, .STERADIAN.) )");
  const uncert = add(
    `UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.0E-05), #${lenUnit}, 'distance_accuracy_value', 'confusion accuracy')`
  );
  const geomCtx = add(
    `( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uncert})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lenUnit}, #${angUnit}, #${solidUnit})) REPRESENTATION_CONTEXT('Context3D', '3D Context with UNIT and UNCERTAINTY') )`
  );

  // 3. 공용 방향 벡터 및 기준 좌표계
  const originPt = add("CARTESIAN_POINT('', (0., 0., 0.))");
  const dirPosX = add("DIRECTION('', (1., 0., 0.))");
  const dirNegX = add("DIRECTION('', (-1., 0., 0.))");
  const dirPosY = add("DIRECTION('', (0., 1., 0.))");
  const dirNegY = add("DIRECTION('', (0., -1., 0.))");
  const dirPosZ = add("DIRECTION('', (0., 0., 1.))");
  const dirNegZ = add("DIRECTION('', (0., 0., -1.))");

  const vecPosX = add(`VECTOR('', #${dirPosX}, 1.)`);
  const vecNegX = add(`VECTOR('', #${dirNegX}, 1.)`);
  const vecPosY = add(`VECTOR('', #${dirPosY}, 1.)`);
  const vecNegY = add(`VECTOR('', #${dirNegY}, 1.)`);
  const vecPosZ = add(`VECTOR('', #${dirPosZ}, 1.)`);

  const worldAxis = add(
    `AXIS2_PLACEMENT_3D('', #${originPt}, #${dirPosZ}, #${dirPosX})`
  );

  // 색상 캐시
  const styleCache = new Map();
  const getStyleAssignment = (hexColor) => {
    const key = String(hexColor || "#94a3b8").toLowerCase();
    if (styleCache.has(key)) return styleCache.get(key);
    const [r, g, b] = hexToRgb01(key);
    const colId = add(`COLOUR_RGB('', ${fmt(r)}, ${fmt(g)}, ${fmt(b)})`);
    const fasc = add(`FILL_AREA_STYLE_COLOUR('', #${colId})`);
    const fas = add(`FILL_AREA_STYLE('', (#${fasc}))`);
    const ssfa = add(`SURFACE_STYLE_FILL_AREA(#${fas})`);
    const sss = add(`SURFACE_SIDE_STYLE('', (#${ssfa}))`);
    const ssu = add(`SURFACE_STYLE_USAGE(.BOTH., #${sss})`);
    const psa = add(`PRESENTATION_STYLE_ASSIGNMENT((#${ssu}))`);
    styleCache.set(key, psa);
    return psa;
  };

  /**
   * 정밀 직육면체 B-Rep 솔리드 (V=8, E=12, F=6 => V-E+F=2)
   */
  const buildBoxSolid = (name, x0, y0, z0, x1, y1, z1) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const minZ = Math.min(z0, z1);
    const maxZ = Math.max(z0, z1);

    const coords = [
      [minX, minY, minZ], // 0
      [maxX, minY, minZ], // 1
      [maxX, maxY, minZ], // 2
      [minX, maxY, minZ], // 3
      [minX, minY, maxZ], // 4
      [maxX, minY, maxZ], // 5
      [maxX, maxY, maxZ], // 6
      [minX, maxY, maxZ], // 7
    ];

    const pts = coords.map(([px, py, pz]) =>
      add(`CARTESIAN_POINT('', (${fmt(px)}, ${fmt(py)}, ${fmt(pz)}))`)
    );
    const verts = pts.map((pId) => add(`VERTEX_POINT('', #${pId})`));

    const mkEdge = (sIdx, eIdx, vecId) => {
      const ln = add(`LINE('', #${pts[sIdx]}, #${vecId})`);
      return add(`EDGE_CURVE('', #${verts[sIdx]}, #${verts[eIdx]}, #${ln}, .T.)`);
    };

    const E = [
      mkEdge(0, 1, vecPosX), // 0
      mkEdge(1, 2, vecPosY), // 1
      mkEdge(2, 3, vecNegX), // 2
      mkEdge(3, 0, vecNegY), // 3
      mkEdge(4, 5, vecPosX), // 4
      mkEdge(5, 6, vecPosY), // 5
      mkEdge(6, 7, vecNegX), // 6
      mkEdge(7, 4, vecNegY), // 7
      mkEdge(0, 4, vecPosZ), // 8
      mkEdge(1, 5, vecPosZ), // 9
      mkEdge(2, 6, vecPosZ), // 10
      mkEdge(3, 7, vecPosZ), // 11
    ];

    const mkPlaneFace = (ptIdx, normDirId, refDirId, loopSpec) => {
      const oEdges = loopSpec.map(([eIdx, sense]) =>
        add(`ORIENTED_EDGE('', *, #${E[eIdx]}, ${sense ? ".T." : ".F."})`)
      );
      const loop = add(`EDGE_LOOP('', (${oEdges.map((i) => `#${i}`).join(", ")}))`);
      const bound = add(`FACE_OUTER_BOUND('', #${loop}, .T.)`);
      const ax = add(`AXIS2_PLACEMENT_3D('', #${pts[ptIdx]}, #${normDirId}, #${refDirId})`);
      const pl = add(`PLANE('', #${ax})`);
      return add(`ADVANCED_FACE('', (#${bound}), #${pl}, .T.)`);
    };

    const faces = [
      mkPlaneFace(0, dirNegZ, dirPosX, [
        [3, false],
        [2, false],
        [1, false],
        [0, false],
      ]),
      mkPlaneFace(4, dirPosZ, dirPosX, [
        [4, true],
        [5, true],
        [6, true],
        [7, true],
      ]),
      mkPlaneFace(0, dirNegY, dirPosX, [
        [0, true],
        [9, true],
        [4, false],
        [8, false],
      ]),
      mkPlaneFace(2, dirPosY, dirNegX, [
        [2, true],
        [11, true],
        [6, false],
        [10, false],
      ]),
      mkPlaneFace(1, dirPosX, dirPosY, [
        [1, true],
        [10, true],
        [5, false],
        [9, false],
      ]),
      mkPlaneFace(3, dirNegX, dirNegY, [
        [3, true],
        [8, true],
        [7, false],
        [11, false],
      ]),
    ];

    const shell = add(
      `CLOSED_SHELL('', (${faces.map((f) => `#${f}`).join(", ")}))`
    );
    return add(`MANIFOLD_SOLID_BREP('${cleanStepStr(name)}', #${shell})`);
  };

  /**
   * 해석적 진원 원기둥 B-Rep 솔리드 (CYLINDRICAL_SURFACE + 180도 분할 2면 + 상하 원판 PLANE)
   * X, Y, Z 어느 축 방향이든 완벽한 진원 곡면으로 SolidWorks/Inventor/Fusion360에서 동심 메이트 가능!
   */
  const buildAnalyticalCylinderSolid = (
    name,
    axisName,
    cx,
    cy,
    cz,
    radius,
    length
  ) => {
    const R = Math.max(0.5, Number(radius));
    const L = Math.max(0.5, Number(length));
    const axKey = String(axisName || "z").toLowerCase();

    // 오른손 직교 기저 (u x v = w, w = 원통 축 진행 방향)
    let uVec, wDirId, negWDirId, uDirId, wVecId;
    if (axKey === "x") {
      // w = +X, u = +Y, v = +Z
      uVec = [0, 1, 0];
      wDirId = dirPosX;
      negWDirId = dirNegX;
      uDirId = dirPosY;
      wVecId = vecPosX;
    } else if (axKey === "y") {
      // w = +Y, u = +Z, v = +X
      uVec = [0, 0, 1];
      wDirId = dirPosY;
      negWDirId = dirNegY;
      uDirId = dirPosZ;
      wVecId = vecPosY;
    } else {
      // w = +Z, u = +X, v = +Y
      uVec = [1, 0, 0];
      wDirId = dirPosZ;
      negWDirId = dirNegZ;
      uDirId = dirPosX;
      wVecId = vecPosZ;
    }

    const wVec = axKey === "x" ? [1, 0, 0] : axKey === "y" ? [0, 1, 0] : [0, 0, 1];
    const c0 = [cx, cy, cz];
    const c1 = [cx + wVec[0] * L, cy + wVec[1] * L, cz + wVec[2] * L];

    const ptC0 = add(`CARTESIAN_POINT('', (${fmt(c0[0])}, ${fmt(c0[1])}, ${fmt(c0[2])}))`);
    const ptC1 = add(`CARTESIAN_POINT('', (${fmt(c1[0])}, ${fmt(c1[1])}, ${fmt(c1[2])}))`);

    const ax0 = add(`AXIS2_PLACEMENT_3D('', #${ptC0}, #${wDirId}, #${uDirId})`);
    const ax1 = add(`AXIS2_PLACEMENT_3D('', #${ptC1}, #${wDirId}, #${uDirId})`);
    const ax0Cap = add(`AXIS2_PLACEMENT_3D('', #${ptC0}, #${negWDirId}, #${uDirId})`);

    const pB0 = [c0[0] + R * uVec[0], c0[1] + R * uVec[1], c0[2] + R * uVec[2]];
    const pB1 = [c0[0] - R * uVec[0], c0[1] - R * uVec[1], c0[2] - R * uVec[2]];
    const pT0 = [c1[0] + R * uVec[0], c1[1] + R * uVec[1], c1[2] + R * uVec[2]];
    const pT1 = [c1[0] - R * uVec[0], c1[1] - R * uVec[1], c1[2] - R * uVec[2]];

    const ptVB0 = add(`CARTESIAN_POINT('', (${fmt(pB0[0])}, ${fmt(pB0[1])}, ${fmt(pB0[2])}))`);
    const ptVB1 = add(`CARTESIAN_POINT('', (${fmt(pB1[0])}, ${fmt(pB1[1])}, ${fmt(pB1[2])}))`);
    const ptVT0 = add(`CARTESIAN_POINT('', (${fmt(pT0[0])}, ${fmt(pT0[1])}, ${fmt(pT0[2])}))`);
    const ptVT1 = add(`CARTESIAN_POINT('', (${fmt(pT1[0])}, ${fmt(pT1[1])}, ${fmt(pT1[2])}))`);

    const vB0 = add(`VERTEX_POINT('', #${ptVB0})`);
    const vB1 = add(`VERTEX_POINT('', #${ptVB1})`);
    const vT0 = add(`VERTEX_POINT('', #${ptVT0})`);
    const vT1 = add(`VERTEX_POINT('', #${ptVT1})`);

    const circB = add(`CIRCLE('', #${ax0}, ${fmt(R)})`);
    const circT = add(`CIRCLE('', #${ax1}, ${fmt(R)})`);

    const eBPos = add(`EDGE_CURVE('', #${vB0}, #${vB1}, #${circB}, .T.)`);
    const eBNeg = add(`EDGE_CURVE('', #${vB1}, #${vB0}, #${circB}, .T.)`);
    const eTPos = add(`EDGE_CURVE('', #${vT0}, #${vT1}, #${circT}, .T.)`);
    const eTNeg = add(`EDGE_CURVE('', #${vT1}, #${vT0}, #${circT}, .T.)`);

    const lnV0 = add(`LINE('', #${ptVB0}, #${wVecId})`);
    const lnV1 = add(`LINE('', #${ptVB1}, #${wVecId})`);
    const eV0 = add(`EDGE_CURVE('', #${vB0}, #${vT0}, #${lnV0}, .T.)`);
    const eV1 = add(`EDGE_CURVE('', #${vB1}, #${vT1}, #${lnV1}, .T.)`);

    const cylSurf = add(`CYLINDRICAL_SURFACE('', #${ax0}, ${fmt(R)})`);
    const botPlane = add(`PLANE('', #${ax0Cap})`);
    const topPlane = add(`PLANE('', #${ax1})`);

    const mkFace = (surfId, edgePairs) => {
      const oes = edgePairs.map(([eid, sense]) =>
        add(`ORIENTED_EDGE('', *, #${eid}, ${sense ? ".T." : ".F."})`)
      );
      const lp = add(`EDGE_LOOP('', (${oes.map((i) => `#${i}`).join(", ")}))`);
      const bnd = add(`FACE_OUTER_BOUND('', #${lp}, .T.)`);
      return add(`ADVANCED_FACE('', (#${bnd}), #${surfId}, .T.)`);
    };

    const fCylUpper = mkFace(cylSurf, [
      [eBPos, true],
      [eV1, true],
      [eTPos, false],
      [eV0, false],
    ]);
    const fCylLower = mkFace(cylSurf, [
      [eBNeg, true],
      [eV0, true],
      [eTNeg, false],
      [eV1, false],
    ]);
    const fBot = mkFace(botPlane, [
      [eBNeg, false],
      [eBPos, false],
    ]);
    const fTop = mkFace(topPlane, [
      [eTPos, true],
      [eTNeg, true],
    ]);

    const shell = add(
      `CLOSED_SHELL('', (#${fCylUpper}, #${fCylLower}, #${fBot}, #${fTop}))`
    );
    return add(`MANIFOLD_SOLID_BREP('${cleanStepStr(name)}', #${shell})`);
  };

  const solidIds = [];
  const styledIds = [];

  parts.forEach((p, idx) => {
    // 첫 번째 베이스 부품에 가공 공차(±0.05mm) 미만의 포렌식 전자지문 미세 오프셋 부여
    const mx = idx === 0 ? dxMicro : 0;
    const my = idx === 0 ? dyMicro : 0;
    const mz = idx === 0 ? dzMicro : 0;

    const partLabel = p.stepName || p.name || `PART_${idx + 1}`;
    const styleId = getStyleAssignment(p.color || "#94a3b8");

    if (p.kind === "cylinder") {
      const sId = buildAnalyticalCylinderSolid(
        partLabel,
        p.axis || "z",
        p.cx,
        p.cy,
        p.cz,
        p.radius,
        p.length + (idx === 0 ? mz : 0)
      );
      solidIds.push(sId);
      styledIds.push(add(`STYLED_ITEM('', (#${styleId}), #${sId})`));
    } else if (p.kind === "spring") {
      // 스프링은 CAD 프로그램 호환성과 시각적 직관성을 모두 확보하기 위해
      // 실제 외경/선경을 반영한 다단 코일 링 해석적 원기둥 세트로 출력
      const coilCount = Math.min(8, Math.max(4, p.turns || 6));
      const ax = (p.axis || "z").toLowerCase();
      const pitch = p.length / coilCount;
      const ringLen = Math.max(1.2, Math.min(pitch * 0.58, (p.wireDia || 3.0) * 1.15));

      for (let c = 0; c < coilCount; c++) {
        const offset = c * pitch + (pitch - ringLen) * 0.5;
        const rCx = ax === "x" ? p.cx + offset : p.cx;
        const rCy = ax === "y" ? p.cy + offset : p.cy;
        const rCz = ax === "z" ? p.cz + offset : p.cz;
        const sId = buildAnalyticalCylinderSolid(
          `${partLabel}_COIL_${c + 1}`,
          ax,
          rCx,
          rCy,
          rCz,
          p.radius,
          ringLen
        );
        solidIds.push(sId);
        styledIds.push(add(`STYLED_ITEM('', (#${styleId}), #${sId})`));
      }
    } else {
      // 기본 정밀 가공 직육면체 파트
      const sId = buildBoxSolid(
        partLabel,
        p.x,
        p.y,
        p.z,
        p.x + p.w + mx,
        p.y + p.d + my,
        p.z + p.h + mz
      );
      solidIds.push(sId);
      styledIds.push(add(`STYLED_ITEM('', (#${styleId}), #${sId})`));
    }
  });

  // 메인 B-Rep 형상 표현 연결
  const absr = add(
    `ADVANCED_BREP_SHAPE_REPRESENTATION('${safePid}', (#${worldAxis}, ${solidIds
      .map((s) => `#${s}`)
      .join(", ")}), #${geomCtx})`
  );
  add(`SHAPE_DEFINITION_REPRESENTATION(#${pds}, #${absr})`);

  // CAD 컬러 표현 연결 (SolidWorks / Fusion360 / FreeCAD 색상 자동 표시)
  if (styledIds.length > 0) {
    add(
      `MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('', (${styledIds
        .map((s) => `#${s}`)
        .join(", ")}), #${geomCtx})`
    );
  }

  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "");
  const safeOwner = cleanStepStr(ownerTag || "AUTHORIZED_VAULT_USER");

  return [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION(('STEP AP214 Precision Mechanical Assembly', 'FORENSIC_ID:${wmkId}', 'SIG:${wmkSig}'), '2;1');`,
    `FILE_NAME('${safePid}.step', '${nowIso}', ('${safeOwner}'), ('AI_JIG_FIXTURE_VAULT'), 'AP214_BREP_KERNEL_V3', 'SECURE_CAD_ENGINE', 'CONFIDENTIAL');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
    ...dataLines,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}
