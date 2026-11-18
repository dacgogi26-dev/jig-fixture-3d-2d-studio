/**
 * 지그 앤 픽스처 3D 기구 동작 뷰어 & 2D KS/ISO 3각법 정밀 도면 렌더러
 * - 3D 모드: 원통(Cylinder), 육각너트(Hex), 나선 코일 스프링(Helical Spring), 타공 레일 + 실시간 기구 동작 애니메이션
 * - 2D 모드: 정면도(Front) / 평면도(Top) / 우측면도(Right) + 중심선 + 치수선 + 부품표(BOM) + 표제란(Title Block)
 * - 보안: 우클릭·드래그 차단 + 프레임버퍼 직접 합성 대각선 포렌식 워터마크
 */
export class SecureCadViewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.boxes = [];
    this.dims = { w: 340, d: 240, h: 165 };
    this.drawingSpec = {};
    this.code = "JIG-01";
    this.titleKo = "";
    this.watermarkText = "CONFIDENTIAL VAULT PREVIEW";
    this.mode = "3d"; // "3d" | "2d"
    this.playing = true;
    this.phase = 0;
    this.rafId = null;

    this.yaw = -0.66;
    this.pitch = 0.48;
    this.zoom = 1.0;
    this.explodeRatio = 0.0;
    this.xrayMode = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.bindEvents();
    this.resize();
    this.startLoop();
  }

  bindEvents() {
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("dragstart", (e) => e.preventDefault());

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this.mode !== "3d") return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging || this.mode !== "3d") return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.yaw += dx * 0.0085;
      this.pitch = Math.max(-1.15, Math.min(1.25, this.pitch + dy * 0.0085));
      if (!this.playing) this.render();
    });

    const stopDrag = () => {
      this.dragging = false;
    };
    this.canvas.addEventListener("pointerup", stopDrag);
    this.canvas.addEventListener("pointercancel", stopDrag);

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        this.zoom = Math.max(0.5, Math.min(2.3, this.zoom * factor));
        if (!this.playing || this.mode === "2d") this.render();
      },
      { passive: false }
    );

    window.addEventListener("resize", () => this.resize());
  }

  startLoop() {
    const tick = () => {
      if (this.playing && this.mode === "3d" && this.boxes.length > 0) {
        this.phase += 0.045;
        this.render();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  setMode(mode) {
    this.mode = mode === "2d" ? "2d" : "3d";
    this.render();
  }

  setPlaying(playing) {
    this.playing = Boolean(playing);
    this.render();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(260, Math.floor(rect.height * dpr));
    this.dpr = dpr;
    this.render();
  }

  setScene({ previewBoxes, dims, drawingSpec, code, titleKo, watermarkText }) {
    this.boxes = Array.isArray(previewBoxes) ? previewBoxes : [];
    this.dims = dims || { w: 340, d: 240, h: 165 };
    this.drawingSpec = drawingSpec || {};
    this.code = code || "JIG-01";
    this.titleKo = titleKo || "";
    if (watermarkText) this.watermarkText = watermarkText;
    this.render();
  }

  setExplode(ratio) {
    this.explodeRatio = Number(ratio) || 0;
    this.render();
  }

  setXray(enabled) {
    this.xrayMode = Boolean(enabled);
    this.render();
  }

  resetCamera() {
    this.yaw = -0.66;
    this.pitch = 0.48;
    this.zoom = 1.0;
    this.render();
  }

  projectPoint(x, y, z, scale, cx, cy, centerZ) {
    const pz = z - centerZ;
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const rx = x * cosY - y * sinY;
    const ry = x * sinY + y * cosY;

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    return {
      x: cx + rx * scale,
      y: cy - (pz * cosP - ry * sinP) * scale,
      depth: ry * cosP + pz * sinP,
    };
  }

  shadeColor(hex, factor) {
    const clean = String(hex || "#60a5fa").replace("#", "");
    const num = parseInt(clean, 16) || 0x60a5fa;
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
    return `rgb(${r}, ${g}, ${b})`;
  }

  computeAnimatedBox(box, idx) {
    let x = box.x;
    let y = box.y;
    let z = box.z;
    let w = box.w;
    let d = box.d;
    let h = box.h;

    const wave = this.playing ? Math.sin(this.phase) : 0;
    if (box.motion && this.playing) {
      const amp = box.motion.amp || 0;
      if (box.motion.type === "slideX") x += wave * amp;
      if (box.motion.type === "slideY") y += wave * amp;
      if (box.motion.type === "slideZ") z += wave * amp;
      if (box.motion.type === "springY") {
        y -= wave * amp;
        d += wave * amp * 2;
      }
      if (box.motion.type === "springZ") {
        h = Math.max(12, h + wave * amp);
      }
    }

    const midX = x + w / 2;
    const midY = y + d / 2;
    const midZ = z + h / 2;
    const ex = midX * this.explodeRatio * 0.45;
    const ey = midY * this.explodeRatio * 0.45;
    const ez = (idx * 0.11 + (midZ / Math.max(1, this.dims.h)) * 0.45) * this.dims.h * this.explodeRatio * 0.42;

    return {
      ...box,
      x0: x + ex,
      y0: y + ey,
      z0: z + ez,
      x1: x + w + ex,
      y1: y + d + ey,
      z1: z + h + ez,
    };
  }

  render() {
    if (this.mode === "2d") {
      this.render2DBlueprint();
    } else {
      this.render3DScene();
    }
  }

  render3DScene() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const maxSpan = Math.max(this.dims.w, this.dims.d, this.dims.h, 120);
    const baseScale = (Math.min(W, H) * 0.56) / maxSpan;
    const scale = baseScale * this.zoom;
    const cx = W * 0.5;
    const cy = H * 0.56;
    const centerZ = this.dims.h * 0.46;

    // 1. 작업 정반 그리드
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1 * this.dpr;
    const gridExtent = maxSpan * 0.72;
    const steps = 6;
    for (let i = -steps; i <= steps; i++) {
      const pos = (i / steps) * gridExtent;
      const a1 = this.projectPoint(-gridExtent, pos, 0, scale, cx, cy, centerZ);
      const a2 = this.projectPoint(gridExtent, pos, 0, scale, cx, cy, centerZ);
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();

      const b1 = this.projectPoint(pos, -gridExtent, 0, scale, cx, cy, centerZ);
      const b2 = this.projectPoint(pos, gridExtent, 0, scale, cx, cy, centerZ);
      ctx.beginPath();
      ctx.moveTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
    }
    ctx.restore();

    const drawItems = [];
    const calloutAnchors = [];

    this.boxes.forEach((rawBox, idx) => {
      const b = this.computeAnimatedBox(rawBox, idx);

      if (b.shape === "spring") {
        // 3D 나선형 코일 스프링 직접 생성
        const turns = 8;
        const samples = turns * 14;
        const pts = [];
        const cxMid = (b.x0 + b.x1) / 2;
        const cyMid = (b.y0 + b.y1) / 2;
        const czMid = (b.z0 + b.z1) / 2;
        let depthSum = 0;

        for (let s = 0; s <= samples; s++) {
          const t = s / samples;
          const ang = t * Math.PI * 2 * turns;
          let px, py, pz;
          if (b.axis === "y") {
            const rx = Math.max(4, (b.x1 - b.x0) / 2);
            const rz = Math.max(4, (b.z1 - b.z0) / 2);
            px = cxMid + Math.cos(ang) * rx;
            py = b.y0 + t * (b.y1 - b.y0);
            pz = czMid + Math.sin(ang) * rz;
          } else {
            const rx = Math.max(4, (b.x1 - b.x0) / 2);
            const ry = Math.max(4, (b.y1 - b.y0) / 2);
            px = cxMid + Math.cos(ang) * rx;
            py = cyMid + Math.sin(ang) * ry;
            pz = b.z0 + t * (b.z1 - b.z0);
          }
          const pr = this.projectPoint(px, py, pz, scale, cx, cy, centerZ);
          pts.push(pr);
          depthSum += pr.depth;
        }
        drawItems.push({
          kind: "spring",
          pts,
          avgDepth: depthSum / pts.length,
          color: b.color,
        });
      } else {
        // 다각형 기둥 (box=4, hex=6, cylinder=14)
        const sides = b.shape === "cylinder" ? 14 : b.shape === "hex" ? 6 : 4;
        const poly = [];
        if (sides === 4) {
          poly.push([b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]);
        } else {
          const mx = (b.x0 + b.x1) / 2;
          const my = (b.y0 + b.y1) / 2;
          const rx = (b.x1 - b.x0) / 2;
          const ry = (b.y1 - b.y0) / 2;
          for (let s = 0; s < sides; s++) {
            const ang = (Math.PI * 2 * s) / sides;
            poly.push([mx + Math.cos(ang) * rx, my + Math.sin(ang) * ry]);
          }
        }

        const bot = poly.map(([px, py]) =>
          this.projectPoint(px, py, b.z0, scale, cx, cy, centerZ)
        );
        const top = poly.map(([px, py]) =>
          this.projectPoint(px, py, b.z1, scale, cx, cy, centerZ)
        );

        const pushFace = (pts, shade) => {
          const avgDepth = pts.reduce((a, p) => a + p.depth, 0) / pts.length;
          drawItems.push({
            kind: "face",
            pts,
            avgDepth,
            color: b.color,
            shade,
            wireframeOnly: b.wireframeShell || this.xrayMode,
          });
        };

        pushFace(bot, 0.58);
        pushFace(top, 1.14);
        for (let s = 0; s < sides; s++) {
          const n = (s + 1) % sides;
          const shade = 0.72 + 0.28 * Math.cos((Math.PI * 2 * s) / sides - 0.6);
          pushFace([bot[s], bot[n], top[n], top[s]], shade);
        }

        // 타공 레일 홀 표현
        if (b.holes > 0 && !this.xrayMode) {
          const holeZ = (b.z0 + b.z1) / 2;
          const faceY = b.y0;
          for (let hIdx = 1; hIdx <= b.holes; hIdx++) {
            const hx = b.x0 + ((b.x1 - b.x0) * hIdx) / (b.holes + 1);
            const hp = this.projectPoint(hx, faceY - 1, holeZ, scale, cx, cy, centerZ);
            drawItems.push({
              kind: "hole",
              pt: hp,
              avgDepth: hp.depth + 2,
            });
          }
        }
      }

      if (b.callout) {
        const anchor = this.projectPoint(
          (b.x0 + b.x1) / 2,
          (b.y0 + b.y1) / 2,
          b.z1,
          scale,
          cx,
          cy,
          centerZ
        );
        calloutAnchors.push({
          text: b.callout,
          ax: anchor.x,
          ay: anchor.y,
          side: (b.x0 + b.x1) / 2 >= 0 ? 1 : -1,
          order: idx,
        });
      }
    });

    drawItems.sort((a, b) => a.avgDepth - b.avgDepth);

    for (const item of drawItems) {
      if (item.kind === "spring") {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
        ctx.lineWidth = 5.2 * this.dpr;
        ctx.beginPath();
        item.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();

        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3.4 * this.dpr;
        ctx.stroke();
        ctx.restore();
      } else if (item.kind === "hole") {
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(item.pt.x, item.pt.y, 2.6 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        item.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();

        if (item.wireframeOnly) {
          ctx.fillStyle = "rgba(148, 163, 184, 0.10)";
          ctx.fill();
          ctx.strokeStyle = "rgba(226, 232, 240, 0.55)";
          ctx.lineWidth = 1.2 * this.dpr;
          ctx.stroke();
        } else {
          ctx.fillStyle = this.shadeColor(item.color, item.shade);
          ctx.fill();
          ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
          ctx.lineWidth = 0.95 * this.dpr;
          ctx.stroke();
        }
      }
    }

    // 적색 콜아웃 렌더링
    ctx.save();
    ctx.font = `600 ${Math.round(11.5 * this.dpr)}px Pretendard, Malgun Gothic, sans-serif`;
    calloutAnchors.forEach((c, i) => {
      const targetX =
        c.side > 0
          ? Math.min(W - 165 * this.dpr, c.ax + (58 + (i % 2) * 26) * this.dpr)
          : Math.max(165 * this.dpr, c.ax - (58 + (i % 2) * 26) * this.dpr);
      const targetY = Math.max(
        26 * this.dpr,
        Math.min(H - 60 * this.dpr, c.ay - (24 + (i % 3) * 20) * this.dpr)
      );

      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(c.ax, c.ay, 3.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.6 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(c.ax, c.ay);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      const tw = ctx.measureText(c.text).width;
      const padX = 7 * this.dpr;
      const boxW = tw + padX * 2;
      const boxH = 21 * this.dpr;
      const drawX = c.side > 0 ? targetX : targetX - boxW;
      const drawY = targetY - boxH / 2;

      ctx.fillStyle = "rgba(9, 14, 34, 0.9)";
      ctx.strokeStyle = "rgba(239, 68, 68, 0.78)";
      ctx.lineWidth = 1 * this.dpr;
      ctx.fillRect(drawX, drawY, boxW, boxH);
      ctx.strokeRect(drawX, drawY, boxW, boxH);

      ctx.fillStyle = "#f8fafc";
      ctx.textBaseline = "middle";
      ctx.fillText(c.text, drawX + padX, targetY);
    });
    ctx.restore();

    this.drawForensicStamp();
  }

  /**
   * 2D 정밀 제도 도면 (KS B ISO 128 3각법: 정면도 / 평면도 / 우측면도 + 치수선 + 표제란)
   */
  render2DBlueprint() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = this.dpr;

    ctx.fillStyle = "#071426";
    ctx.fillRect(0, 0, W, H);

    // 외곽 도면 윤곽선
    const m = 12 * dpr;
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1.6 * dpr;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);

    const { w, d, h } = this.dims;
    const fitScale =
      Math.min((W * 0.34) / Math.max(w, 40), (H * 0.30) / Math.max(h + d * 0.6, 40)) *
      Math.min(1.35, Math.max(0.75, this.zoom));

    // 3각법 배치 중심 좌표
    const topCx = W * 0.28;
    const topCy = H * 0.27;
    const frontCx = W * 0.28;
    const frontBaseY = H * 0.78;
    const sideCx = W * 0.66;
    const sideBaseY = H * 0.78;

    const drawCenterLines = (x1, y1, x2, y2) => {
      ctx.save();
      ctx.strokeStyle = "rgba(244, 63, 94, 0.65)";
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([10 * dpr, 3 * dpr, 2 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    // 1. TOP VIEW (평면도: X-Y)
    drawCenterLines(topCx - w * fitScale * 0.62, topCy, topCx + w * fitScale * 0.62, topCy);
    drawCenterLines(topCx, topCy - d * fitScale * 0.62, topCx, topCy + d * fitScale * 0.62);

    // 2. FRONT VIEW (정면도: X-Z)
    drawCenterLines(
      frontCx,
      frontBaseY + 12 * dpr,
      frontCx,
      frontBaseY - h * fitScale - 14 * dpr
    );

    // 3. RIGHT SIDE VIEW (우측면도: Y-Z)
    drawCenterLines(
      sideCx,
      sideBaseY + 12 * dpr,
      sideCx,
      sideBaseY - h * fitScale - 14 * dpr
    );

    ctx.lineWidth = 1.35 * dpr;
    for (const b of this.boxes) {
      ctx.strokeStyle = b.shape === "spring" ? "#fb7185" : "#e2e8f0";
      ctx.fillStyle = "rgba(56, 189, 248, 0.06)";

      // Top View 투영
      const tx = topCx + b.x * fitScale;
      const ty = topCy + b.y * fitScale;
      const tw = b.w * fitScale;
      const td = b.d * fitScale;
      if (b.shape === "cylinder" || b.shape === "hex") {
        ctx.beginPath();
        ctx.ellipse(tx + tw / 2, ty + td / 2, tw / 2, td / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(tx, ty, tw, td);
        ctx.strokeRect(tx, ty, tw, td);
      }

      // Front View 투영
      const fx = frontCx + b.x * fitScale;
      const fy = frontBaseY - (b.z + b.h) * fitScale;
      const fw = b.w * fitScale;
      const fh = b.h * fitScale;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeRect(fx, fy, fw, fh);

      if (b.shape === "spring") {
        ctx.beginPath();
        const segs = 6;
        for (let s = 0; s <= segs; s++) {
          const sx = fx + (s % 2 === 0 ? 0 : fw);
          const sy = fy + (fh * s) / segs;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // Right Side View 투영
      const rx = sideCx + b.y * fitScale;
      const ry = sideBaseY - (b.z + b.h) * fitScale;
      const rw = b.d * fitScale;
      const rh = b.h * fitScale;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }

    // 치수 보조선 및 수치 표기
    const drawDimH = (x1, x2, y, label) => {
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.fillStyle = "#38bdf8";
      ctx.lineWidth = 1.1 * dpr;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.font = `600 ${Math.round(11 * dpr)}px Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(label, (x1 + x2) / 2, y - 5 * dpr);
      ctx.restore();
    };

    const drawDimV = (x, y1, y2, label) => {
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.fillStyle = "#38bdf8";
      ctx.lineWidth = 1.1 * dpr;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
      ctx.font = `600 ${Math.round(11 * dpr)}px Consolas, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(label, x + 6 * dpr, (y1 + y2) / 2);
      ctx.restore();
    };

    drawDimH(
      frontCx - (w * fitScale) / 2,
      frontCx + (w * fitScale) / 2,
      frontBaseY + 22 * dpr,
      `${w}.0 ±0.05`
    );
    drawDimV(
      frontCx + (w * fitScale) / 2 + 16 * dpr,
      frontBaseY,
      frontBaseY - h * fitScale,
      `H ${h}.0`
    );
    drawDimH(
      sideCx - (d * fitScale) / 2,
      sideCx + (d * fitScale) / 2,
      sideBaseY + 22 * dpr,
      `W ${d}.0`
    );

    // 뷰 타이틀
    ctx.fillStyle = "#93c5fd";
    ctx.font = `700 ${Math.round(11.5 * dpr)}px Consolas, Pretendard, sans-serif`;
    ctx.fillText("TOP VIEW (평면도)", topCx - 48 * dpr, topCy - (d * fitScale) / 2 - 14 * dpr);
    ctx.fillText("FRONT VIEW (정면도)", frontCx - 54 * dpr, frontBaseY + 38 * dpr);
    ctx.fillText("RIGHT VIEW (우측면도)", sideCx - 56 * dpr, sideBaseY + 38 * dpr);

    // 우측 상단 부품표(BOM) & 우측 하단 KS/ISO 표제란(Title Block)
    const tbW = Math.min(295 * dpr, W * 0.36);
    const tbX = W - m - tbW;
    const bomY = m + 10 * dpr;

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1.1 * dpr;
    const bomRows = Math.min(6, this.boxes.length);
    const rowH = 19 * dpr;
    ctx.fillRect(tbX, bomY, tbW, (bomRows + 1) * rowH);
    ctx.strokeRect(tbX, bomY, tbW, (bomRows + 1) * rowH);

    ctx.fillStyle = "#38bdf8";
    ctx.font = `700 ${Math.round(10.5 * dpr)}px Pretendard, sans-serif`;
    ctx.fillText("NO   부품명 (PART NAME)              재질", tbX + 8 * dpr, bomY + 13 * dpr);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `500 ${Math.round(10 * dpr)}px Pretendard, sans-serif`;
    this.boxes.slice(0, bomRows).forEach((b, i) => {
      const y = bomY + (i + 1) * rowH + 13 * dpr;
      const shortName = b.labelKo.length > 14 ? b.labelKo.slice(0, 14) + ".." : b.labelKo;
      ctx.fillText(`0${i + 1}   ${shortName}   [${b.partSpec}]`, tbX + 8 * dpr, y);
    });

    // 우측 하단 표제란
    const titleH = 86 * dpr;
    const titleY = H - m - titleH;
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.fillRect(tbX, titleY, tbW, titleH);
    ctx.strokeRect(tbX, titleY, tbW, titleH);

    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 ${Math.round(11 * dpr)}px Pretendard, sans-serif`;
    ctx.fillText(`도번: ${this.code.slice(0, 32)}`, tbX + 8 * dpr, titleY + 18 * dpr);
    ctx.font = `500 ${Math.round(10 * dpr)}px Pretendard, sans-serif`;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(
      `척도: ${this.drawingSpec.scale || "1:2"} | 작동 스트로크: ${this.drawingSpec.strokeMm || 35}mm`,
      tbX + 8 * dpr,
      titleY + 37 * dpr
    );
    ctx.fillText(
      `일반공차: ${this.drawingSpec.tolerance || "ISO 2768-mH"}`,
      tbX + 8 * dpr,
      titleY + 55 * dpr
    );
    ctx.fillStyle = "#34d399";
    ctx.fillText(
      `투상법: KS B ISO 128 제3각법 | DRM SEALED`,
      tbX + 8 * dpr,
      titleY + 73 * dpr
    );

    this.drawForensicStamp();
  }

  drawForensicStamp() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.30);
    ctx.font = `700 ${Math.round(12.5 * this.dpr)}px Consolas, monospace`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.075)";
    ctx.textAlign = "center";
    const stamp = `JIG & FIXTURE VAULT • ${this.watermarkText} • RAW STEP PROTECTED`;
    for (let y = -H; y <= H; y += 94 * this.dpr) {
      ctx.fillText(stamp, 0, y);
    }
    ctx.restore();
  }
}
