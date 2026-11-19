/**
 * V5.0 상용 CAD 전종 완벽 호환 ISO-10303-21 AP214 (AUTOMOTIVE_DESIGN) 정밀 B-Rep 컴파일러
 * 지원 형상:
 * - box: 정밀 가공 직육면체
 * - rotated_box: 임의 각도(예: 3조 척 120°/240° 방사형 조우) 회전 육면체 B-Rep
 * - cylinder: 해석적 진원 원기둥(CYLINDRICAL_SURFACE + 180° 분할 CIRCLE)
 * - bolt: 육각소켓 캡 볼트(헤드 + 섕크)
 * - spring: 다단 코일 링 세트
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
  const safeTitle = cleanStepStr(titleEn || "Precision Mechanical Assembly");
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

  /**
   * 임의 회전/직교 4각 단면 수직 돌출 육면체 B-Rep 솔리드 (V=8, E=12, F=6 => V-E+F=2)
   */
  const buildQuadPrismSolid = (name, quadCCW, z0, z1) => {
    const minZ = Math.min(z0, z1);
    const maxZ = Math.max(z0, z1);

    const botPts = quadCCW.map(([px, py]) =>
      add(`CARTESIAN_POINT('', (${fmt(px)}, ${fmt(py)}, ${fmt(minZ)}))`)
    );
    const topPts = quadCCW.map(([px, py]) =>
      add(`CARTESIAN_POINT('', (${fmt(px)}, ${fmt(py)}, ${fmt(maxZ)}))`)
    );
    const botVerts = botPts.map((id) => add(`VERTEX_POINT('', #${id})`));
    const topVerts = topPts.map((id) => add(`VERTEX_POINT('', #${id})`));

    const botEdges = [];
    const topEdges = [];
    const vertEdges = [];
    const sideNorms = [];
    const edgeDirs = [];

    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const dx = quadCCW[j][0] - quadCCW[i][0];
      const dy = quadCCW[j][1] - quadCCW[i][1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;

      const tDir = add(`DIRECTION('', (${fmt(ux)}, ${fmt(uy)}, 0.))`);
      const tVec = add(`VECTOR('', #${tDir}, 1.)`);
      const nDir = add(`DIRECTION('', (${fmt(uy)}, ${fmt(-ux)}, 0.))`);
      edgeDirs.push(tDir);
      sideNorms.push(nDir);

      botEdges.push(
        add(`EDGE_CURVE('', #${botVerts[i]}, #${botVerts[j]}, #${add(`LINE('', #${botPts[i]}, #${tVec})`)}, .T.)`)
      );
      topEdges.push(
        add(`EDGE_CURVE('', #${topVerts[i]}, #${topVerts[j]}, #${add(`LINE('', #${topPts[i]}, #${tVec})`)}, .T.)`)
      );
      vertEdges.push(
        add(`EDGE_CURVE('', #${botVerts[i]}, #${topVerts[i]}, #${add(`LINE('', #${botPts[i]}, #${vecPosZ})`)}, .T.)`)
      );
    }

    const faces = [];

    // Bottom (-Z)
    const botOE = [3, 2, 1, 0].map((i) => add(`ORIENTED_EDGE('', *, #${botEdges[i]}, .F.)`));
    faces.push(
      add(
        `ADVANCED_FACE('', (#${add(`FACE_OUTER_BOUND('', #${add(`EDGE_LOOP('', (${botOE.map((o) => `#${o}`).join(", ")}))`)}, .T.)`)}), #${add(`PLANE('', #${add(`AXIS2_PLACEMENT_3D('', #${botPts[0]}, #${dirNegZ}, #${dirPosX})`)})`)}, .T.)`
      )
    );

    // Top (+Z)
    const topOE = [0, 1, 2, 3].map((i) => add(`ORIENTED_EDGE('', *, #${topEdges[i]}, .T.)`));
    faces.push(
      add(
        `ADVANCED_FACE('', (#${add(`FACE_OUTER_BOUND('', #${add(`EDGE_LOOP('', (${topOE.map((o) => `#${o}`).join(", ")}))`)}, .T.)`)}), #${add(`PLANE('', #${add(`AXIS2_PLACEMENT_3D('', #${topPts[0]}, #${dirPosZ}, #${dirPosX})`)})`)}, .T.)`
      )
    );

    // 4 Side Faces
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const sOE = [
        add(`ORIENTED_EDGE('', *, #${botEdges[i]}, .T.)`),
        add(`ORIENTED_EDGE('', *, #${vertEdges[j]}, .T.)`),
        add(`ORIENTED_EDGE('', *, #${topEdges[i]}, .F.)`),
        add(`ORIENTED_EDGE('', *, #${vertEdges[i]}, .F.)`),
      ];
      faces.push(
        add(
          `ADVANCED_FACE('', (#${add(`FACE_OUTER_BOUND('', #${add(`EDGE_LOOP('', (${sOE.map((o) => `#${o}`).join(", ")}))`)}, .T.)`)}), #${add(`PLANE('', #${add(`AXIS2_PLACEMENT_3D('', #${botPts[i]}, #${sideNorms[i]}, #${edgeDirs[i]})`)})`)}, .T.)`
        )
      );
    }

    const shell = add(`CLOSED_SHELL('', (${faces.map((f) => `#${f}`).join(", ")}))`);
    return add(`MANIFOLD_SOLID_BREP('${cleanStepStr(name)}', #${shell})`);
  };

  const buildBoxSolid = (name, x0, y0, z0, x1, y1, z1) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    return buildQuadPrismSolid(
      name,
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ],
      z0,
      z1
    );
  };

  const buildRotatedBoxSolid = (name, cx, cy, z0, w, d, h, angleDeg) => {
    const rad = ((Number(angleDeg) || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = w / 2;
    const hd = d / 2;
    const localCorners = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
    const worldQuad = localCorners.map(([lx, ly]) => [
      cx + lx * cos - ly * sin,
      cy + lx * sin + ly * cos,
    ]);
    return buildQuadPrismSolid(name, worldQuad, z0, z0 + h);
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
        buildAnalyticalCylinderSolid(partLabel, p.axis || "z", p.cx, p.cy, p.cz, p.radius, p.length + mz),
        p.color
      );
    } else if (p.kind === "rotated_box") {
      registerSolid(
        buildRotatedBoxSolid(partLabel, p.cx, p.cy, p.z, p.w + mx, p.d + my, p.h + mz, p.angleDeg || 0),
        p.color
      );
    } else if (p.kind === "bolt") {
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
    `FILE_NAME('${safePid}.step', '${nowIso}', ('${safeOwner}'), ('FORMECH_CAE_V5'), 'AP214_KERNEL_V5', 'ZERO_TRUST_CAD', 'CONFIDENTIAL');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
    ...dataLines,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}
