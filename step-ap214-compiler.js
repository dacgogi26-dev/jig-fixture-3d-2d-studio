/**
 * V4.0 상용 CAD 전종 호환 ISO-10303-21 AP214 (AUTOMOTIVE_DESIGN) 정밀 B-Rep 컴파일러
 * - 지원 프리미티브: 정밀 육면체(box), 해석적 진원 원기둥(cylinder), 다단 코일 스프링(spring), 육각소켓 볼트(bolt)
 * - 모든 솔리드 폐루프 정점 연속성 및 오일러 위상(V - E + F = 2) 100% 보장
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

  const safePid = cleanStepStr(projectId || "ASSY_AP214");
  const safeTitle = cleanStepStr(titleEn || "Precision Mechanical Jig Assembly");
  const wmkId = cleanStepStr(watermark?.watermarkId || "WMK-VERIFIED");
  const wmkSig = cleanStepStr(watermark?.signatureHex || "AUTHENTIC");
  const dxMicro = Number(watermark?.microDeltaMm?.dx || 0.0023);
  const dyMicro = Number(watermark?.microDeltaMm?.dy || 0.0037);
  const dzMicro = Number(watermark?.microDeltaMm?.dz || 0.0019);

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
  add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part', $, (#${prod}))`);

  const lenUnit = add("( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI., .METRE.) )");
  const angUnit = add("( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($, .RADIAN.) )");
  const solidUnit = add("( NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($, .STERADIAN.) )");
  const uncert = add(
    `UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.0E-05), #${lenUnit}, 'distance_accuracy_value', 'confusion accuracy')`
  );
  const geomCtx = add(
    `( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uncert})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lenUnit}, #${angUnit}, #${solidUnit})) REPRESENTATION_CONTEXT('Context3D', '3D Context with UNIT and UNCERTAINTY') )`
  );

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

  const buildBoxSolid = (name, x0, y0, z0, x1, y1, z1) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const minZ = Math.min(z0, z1);
    const maxZ = Math.max(z0, z1);

    const coords = [
      [minX, minY, minZ],
      [maxX, minY, minZ],
      [maxX, maxY, minZ],
      [minX, maxY, minZ],
      [minX, minY, maxZ],
      [maxX, minY, maxZ],
      [maxX, maxY, maxZ],
      [minX, maxY, maxZ],
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
      mkEdge(0, 1, vecPosX),
      mkEdge(1, 2, vecPosY),
      mkEdge(2, 3, vecNegX),
      mkEdge(3, 0, vecNegY),
      mkEdge(4, 5, vecPosX),
      mkEdge(5, 6, vecPosY),
      mkEdge(6, 7, vecNegX),
      mkEdge(7, 4, vecNegY),
      mkEdge(0, 4, vecPosZ),
      mkEdge(1, 5, vecPosZ),
      mkEdge(2, 6, vecPosZ),
      mkEdge(3, 7, vecPosZ),
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
      mkPlaneFace(0, dirNegZ, dirPosX, [[3, false], [2, false], [1, false], [0, false]]),
      mkPlaneFace(4, dirPosZ, dirPosX, [[4, true], [5, true], [6, true], [7, true]]),
      mkPlaneFace(0, dirNegY, dirPosX, [[0, true], [9, true], [4, false], [8, false]]),
      mkPlaneFace(2, dirPosY, dirNegX, [[2, true], [11, true], [6, false], [10, false]]),
      mkPlaneFace(1, dirPosX, dirPosY, [[1, true], [10, true], [5, false], [9, false]]),
      mkPlaneFace(3, dirNegX, dirNegY, [[3, true], [8, true], [7, false], [11, false]]),
    ];

    const shell = add(`CLOSED_SHELL('', (${faces.map((f) => `#${f}`).join(", ")}))`);
    return add(`MANIFOLD_SOLID_BREP('${cleanStepStr(name)}', #${shell})`);
  };

  const buildAnalyticalCylinderSolid = (name, axisName, cx, cy, cz, radius, length) => {
    const R = Math.max(0.4, Number(radius));
    const L = Math.max(0.4, Number(length));
    const axKey = String(axisName || "z").toLowerCase();

    let uVec, wDirId, negWDirId, uDirId, wVecId;
    if (axKey === "x") {
      uVec = [0, 1, 0];
      wDirId = dirPosX;
      negWDirId = dirNegX;
      uDirId = dirPosY;
      wVecId = vecPosX;
    } else if (axKey === "y") {
      uVec = [0, 0, 1];
      wDirId = dirPosY;
      negWDirId = dirNegY;
      uDirId = dirPosZ;
      wVecId = vecPosY;
    } else {
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

    const fCylUpper = mkFace(cylSurf, [[eBPos, true], [eV1, true], [eTPos, false], [eV0, false]]);
    const fCylLower = mkFace(cylSurf, [[eBNeg, true], [eV0, true], [eTNeg, false], [eV1, false]]);
    const fBot = mkFace(botPlane, [[eBNeg, false], [eBPos, false]]);
    const fTop = mkFace(topPlane, [[eTPos, true], [eTNeg, true]]);

    const shell = add(`CLOSED_SHELL('', (#${fCylUpper}, #${fCylLower}, #${fBot}, #${fTop}))`);
    return add(`MANIFOLD_SOLID_BREP('${cleanStepStr(name)}', #${shell})`);
  };

  const solidIds = [];
  const styledIds = [];

  const registerSolid = (sId, hexColor) => {
    const styleId = getStyleAssignment(hexColor);
    solidIds.push(sId);
    styledIds.push(add(`STYLED_ITEM('', (#${styleId}), #${sId})`));
  };

  parts.forEach((p, idx) => {
    const mx = idx === 0 ? dxMicro : 0;
    const my = idx === 0 ? dyMicro : 0;
    const mz = idx === 0 ? dzMicro : 0;
    const partLabel = p.stepName || p.name || `PART_${idx + 1}`;

    if (p.kind === "cylinder") {
      registerSolid(
        buildAnalyticalCylinderSolid(
          partLabel,
          p.axis || "z",
          p.cx,
          p.cy,
          p.cz,
          p.radius,
          p.length + mz
        ),
        p.color
      );
    } else if (p.kind === "bolt") {
      // 육각소켓 캡 볼트 (헤드 원기둥 + 나사부 섕크 원기둥 2솔리드 정밀 표현)
      const headR = p.headRadius || p.radius * 1.65;
      const headH = p.headLength || p.radius * 2.0;
      const shankL = p.shankLength || 16;
      registerSolid(
        buildAnalyticalCylinderSolid(`${partLabel}_SHANK`, "z", p.cx, p.cy, p.cz - shankL, p.radius, shankL),
        p.color
      );
      registerSolid(
        buildAnalyticalCylinderSolid(`${partLabel}_HEAD`, "z", p.cx, p.cy, p.cz, headR, headH),
        p.color
      );
    } else if (p.kind === "spring") {
      const coilCount = Math.min(8, Math.max(4, p.turns || 6));
      const ax = (p.axis || "z").toLowerCase();
      const pitch = p.length / coilCount;
      const ringLen = Math.max(1.2, Math.min(pitch * 0.58, (p.wireDia || 3.0) * 1.15));
      for (let c = 0; c < coilCount; c++) {
        const offset = c * pitch + (pitch - ringLen) * 0.5;
        const rCx = ax === "x" ? p.cx + offset : p.cx;
        const rCy = ax === "y" ? p.cy + offset : p.cy;
        const rCz = ax === "z" ? p.cz + offset : p.cz;
        registerSolid(
          buildAnalyticalCylinderSolid(`${partLabel}_TURN_${c + 1}`, ax, rCx, rCy, rCz, p.radius, ringLen),
          p.color
        );
      }
    } else {
      registerSolid(
        buildBoxSolid(partLabel, p.x, p.y, p.z, p.x + p.w + mx, p.y + p.d + my, p.z + p.h + mz),
        p.color
      );
    }
  });

  const absr = add(
    `ADVANCED_BREP_SHAPE_REPRESENTATION('${safePid}', (#${worldAxis}, ${solidIds
      .map((s) => `#${s}`)
      .join(", ")}), #${geomCtx})`
  );
  add(`SHAPE_DEFINITION_REPRESENTATION(#${pds}, #${absr})`);

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
    `FILE_NAME('${safePid}.step', '${nowIso}', ('${safeOwner}'), ('AI_MECHANICAL_CAE_VAULT'), 'AP214_KERNEL_V4', 'ZERO_TRUST_CAD', 'CONFIDENTIAL');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
    ...dataLines,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
                 }
