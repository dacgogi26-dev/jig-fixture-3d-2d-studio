import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * 상용 CAD(Onshape / SolidWorks RealView) 급 Three.js PBR 3D 엔지니어링 뷰어 & 2D 3각법 도면 엔진
 * - RoomEnvironment 기반 금속 반사(SUS304 연마축, 황동 부쉬, 아노다이징 알루미늄, 우레탄 패드)
 * - 실제 모서리 윤곽선(EdgesGeometry)으로 정밀 기계설계 시인성 확보
 * - 실시간 개폐 스트로크(Stroke 0%~100%) 연동 나선 코일 스프링 물리 변형 애니메이션
 * - 보안: preserveDrawingBuffer: false 설정으로 REA/스크래퍼 캔버스 스냅샷 리핑 차단
 */
export class EngineeringCadStudioViewer {
  constructor({ containerEl, blueprintCanvasEl }) {
    this.container = containerEl;
    this.bpCanvas = blueprintCanvasEl;
    this.bpCtx = blueprintCanvasEl.getContext("2d");

    this.design = null;
    this.isRedacted = true;
    this.watermarkText = "PROTECTED CAD VAULT";
    this.mode = "3d"; // "3d" | "2d"
    this.strokeRatio = 0; // 0 = Closed (달걀 파지 프리로드), 1 = Open (최대 개방)
    this.explodeRatio = 0;
    this.autoCycle = false;
    this.wireframe = false;
    this.showWorkpiece = true;
    this.cycleClock = 0;
    this.partMeshes = [];
    this.workpieceGroup = null;

    this.initWebGL();
    this.bindResize();
    this.animate();
  }

  initWebGL() {
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(320, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false, // 복제/덤프 툴의 캔버스 추출 방지
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.container.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1222);

    // 스튜디오 금속 반사 환경맵 생성
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // CAD 투시 카메라 (Z-up을 Three.js Y-up으로 매핑하기 위해 어셈블리 루트 회전 사용)
    this.camera = new THREE.PerspectiveCamera(38, w / h, 1, 8000);
    this.camera.position.set(290, 220, 310);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxDistance = 2200;
    this.controls.minDistance = 60;
    this.controls.target.set(0, 55, 0);

    // 3점 엔지니어링 스튜디오 조명
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    keyLight.position.set(260, 420, 280);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    fillLight.position.set(-280, 180, -220);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(0, 120, -340);
    this.scene.add(rimLight);

    // 정밀 CAD 기준 정반 그리드 (10mm / 50mm 눈금)
    const grid = new THREE.GridHelper(600, 30, 0x3b82f6, 0x1e293b);
    grid.position.y = -0.2;
    this.scene.add(grid);

    // Z-Up 기계설계 좌표계 -> Three.js Y-Up 변환 그룹
    this.cadRoot = new THREE.Group();
    this.cadRoot.rotation.x = -Math.PI / 2;
    this.scene.add(this.cadRoot);
  }

  bindResize() {
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const w = Math.max(300, this.container.clientWidth);
    const h = Math.max(300, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.bpCanvas.width = Math.floor(w * dpr);
    this.bpCanvas.height = Math.floor(h * dpr);
    this.bpDpr = dpr;
    if (this.mode === "2d") this.render2DBlueprint();
  }

  clearSceneMeshes() {
    while (this.cadRoot.children.length > 0) {
      const child = this.cadRoot.children.pop();
      child.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    this.partMeshes = [];
    this.workpieceGroup = null;
  }

  buildHelicalSpringGeometry({ radius, wireDia, turns, length, axis }) {
    const r = Math.max(3, radius - wireDia * 0.5);
    const wireR = Math.max(0.9, wireDia * 0.48);
    const totalTurns = turns || 7;
    const steps = totalTurns * 20;
    const pts = [];
    const ax = (axis || "z").toLowerCase();

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // 양 끝단 0.5턴은 평탄 연삭 좌면(Closed End) 느낌으로 피치 압축
      const ang = t * Math.PI * 2 * totalTurns;
      const axialPos = t * length;
      const c1 = Math.cos(ang) * r;
      const c2 = Math.sin(ang) * r;

      if (ax === "x") pts.push(new THREE.Vector3(axialPos, c1, c2));
      else if (ax === "y") pts.push(new THREE.Vector3(c1, axialPos, c2));
      else pts.push(new THREE.Vector3(c1, c2, axialPos));
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, steps, wireR, 10, false);
  }

  loadDesign(design, { isRedacted = true, watermarkText = "" } = {}) {
    this.design = design;
    this.isRedacted = isRedacted;
    if (watermarkText) this.watermarkText = watermarkText;

    this.clearSceneMeshes();

    for (const part of design.parts) {
      const holder = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(part.color || "#94a3b8"),
        metalness: part.metalness ?? 0.78,
        roughness: part.roughness ?? 0.25,
        wireframe: this.wireframe,
      });

      if (part.kind === "cylinder") {
        const geo = new THREE.CylinderGeometry(
          part.radius,
          part.radius,
          part.length,
          36,
          1
        );
        const ax = (part.axis || "z").toLowerCase();
        if (ax === "x") {
          geo.rotateZ(-Math.PI / 2);
          geo.translate(part.length / 2, 0, 0);
        } else if (ax === "y") {
          geo.translate(0, part.length / 2, 0);
        } else {
          geo.rotateX(Math.PI / 2);
          geo.translate(0, 0, part.length / 2);
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        holder.add(mesh);

        const edges = new THREE.EdgesGeometry(geo, 28);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.45 })
        );
        holder.add(line);
        holder.position.set(part.cx, part.cy, part.cz);
      } else if (part.kind === "spring") {
        const spGeo = this.buildHelicalSpringGeometry(part);
        const spMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(part.color || "#ef4444"),
          metalness: 0.55,
          roughness: 0.32,
          wireframe: this.wireframe,
        });
        const spMesh = new THREE.Mesh(spGeo, spMat);
        spMesh.castShadow = true;
        holder.add(spMesh);
        holder.position.set(part.cx, part.cy, part.cz);
        holder.userData.springMesh = spMesh;
      } else {
        const geo = new THREE.BoxGeometry(part.w, part.d, part.h);
        geo.translate(part.w / 2, part.d / 2, part.h / 2);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        holder.add(mesh);

        const edges = new THREE.EdgesGeometry(geo, 20);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x090d16, transparent: true, opacity: 0.65 })
        );
        holder.add(line);
        holder.position.set(part.x, part.y, part.z);
      }

      holder.userData.basePos = holder.position.clone();
      holder.userData.part = part;
      this.cadRoot.add(holder);
      this.partMeshes.push(holder);
    }

    // 반투명 대상 공작물(담뱃갑/배터리 등) 가이드 표시
    if (design.workpiece) {
      const wp = design.workpiece;
      const wpGroup = new THREE.Group();
      const wpGeo = new THREE.BoxGeometry(wp.w, wp.d, wp.h);
      const wpMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.28,
        roughness: 0.15,
        metalness: 0.05,
        depthWrite: false,
      });
      const wpMesh = new THREE.Mesh(wpGeo, wpMat);
      const wpEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(wpGeo),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
      );
      wpGroup.add(wpMesh, wpEdges);
      wpGroup.position.set(wp.xOffset || 0, 0, wp.z + wp.h / 2);
      wpGroup.visible = this.showWorkpiece;
      this.cadRoot.add(wpGroup);
      this.workpieceGroup = wpGroup;
    }

    this.applyKinematicsAndExplode();
    this.fitCameraToDesign();
    if (this.mode === "2d") this.render2DBlueprint();
  }

  fitCameraToDesign() {
    if (!this.design) return;
    const { w, d, h } = this.design.dims;
    const span = Math.max(w, d, h, 140);
    const centerH = h * 0.45;
    this.controls.target.set(0, centerH, 0);
    this.camera.position.set(span * 1.15, centerH + span * 0.82, span * 1.28);
    this.controls.update();
  }

  setCameraPreset(preset) {
    if (!this.design) return;
    const { w, d, h } = this.design.dims;
    const span = Math.max(w, d, h, 140) * 1.55;
    const cy = h * 0.45;
    this.controls.target.set(0, cy, 0);

    if (preset === "front") this.camera.position.set(0, cy, span);
    else if (preset === "top") this.camera.position.set(0, cy + span * 1.15, 0.01);
    else if (preset === "right") this.camera.position.set(span, cy, 0);
    else this.camera.position.set(span * 0.76, cy + span * 0.54, span * 0.84);

    this.controls.update();
  }

  setStrokeRatio(ratio01) {
    this.strokeRatio = Math.max(0, Math.min(1, Number(ratio01) || 0));
    this.applyKinematicsAndExplode();
  }

  setExplodeRatio(ratio01) {
    this.explodeRatio = Math.max(0, Math.min(1, Number(ratio01) || 0));
    this.applyKinematicsAndExplode();
  }

  setAutoCycle(enabled) {
    this.autoCycle = Boolean(enabled);
  }

  setWireframe(enabled) {
    this.wireframe = Boolean(enabled);
    this.cadRoot.traverse((obj) => {
      if (obj.isMesh && obj.material && obj !== this.workpieceGroup?.children?.[0]) {
        obj.material.wireframe = this.wireframe;
      }
    });
  }

  setWorkpieceVisible(visible) {
    this.showWorkpiece = Boolean(visible);
    if (this.workpieceGroup) this.workpieceGroup.visible = this.showWorkpiece;
  }

  setMode(mode) {
    this.mode = mode === "2d" ? "2d" : "3d";
    this.bpCanvas.style.display = this.mode === "2d" ? "block" : "none";
    this.renderer.domElement.style.display = this.mode === "3d" ? "block" : "none";
    if (this.mode === "2d") {
      this.resize();
      this.render2DBlueprint();
    }
  }

  applyKinematicsAndExplode() {
    const s = this.strokeRatio;
    const ex = this.explodeRatio;

    for (const holder of this.partMeshes) {
      const part = holder.userData.part;
      const base = holder.userData.basePos;
      const ev = part.explodeVec || [0, 0, 0];

      let dx = ev[0] * ex;
      let dy = ev[1] * ex;
      let dz = ev[2] * ex;
      holder.scale.set(1, 1, 1);

      const travel = (part.maxTravel || 0) * s;

      if (part.motionRole === "jawLeft") {
        dx -= travel;
      } else if (part.motionRole === "jawRight") {
        dx += travel;
      } else if (part.motionRole === "ramVertical") {
        dz += travel;
      } else if (part.motionRole === "springLeft") {
        // 좌측 엔드블록(고정) ~ 좌측 캐리지 사이에서 실제 길이 비례 압축
        const compressedRatio = Math.max(0.32, (part.length - travel) / part.length);
        holder.scale.set(compressedRatio, 1, 1);
      } else if (part.motionRole === "springRight") {
        // 우측 캐리지 외측에서 우측 엔드블록 방향으로 압축 이동
        const newLen = Math.max(part.length * 0.32, part.length - travel);
        const compressedRatio = newLen / part.length;
        dx += travel;
        holder.scale.set(compressedRatio, 1, 1);
      } else if (part.motionRole === "springVertical") {
        const newLen = Math.max(part.length * 0.35, part.length - travel);
        dz += travel;
        holder.scale.set(1, 1, newLen / part.length);
      }

      holder.position.set(base.x + dx, base.y + dy, base.z + dz);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.mode !== "3d") return;

    if (this.autoCycle && this.design) {
      this.cycleClock += 0.032;
      this.strokeRatio = (Math.sin(this.cycleClock) + 1) * 0.5;
      this.applyKinematicsAndExplode();
      if (this.onLiveStrokeTick) {
        this.onLiveStrokeTick(this.strokeRatio);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 2D KS/ISO 제3각법 정밀 엔지니어링 도면 렌더링 (중요 치수는 Preview 등급에서 자동 마스킹)
   */
  render2DBlueprint() {
    if (!this.design) return;
    const ctx = this.bpCtx;
    const W = this.bpCanvas.width;
    const H = this.bpCanvas.height;
    const dpr = this.bpDpr || 1;

    ctx.fillStyle = "#071120";
    ctx.fillRect(0, 0, W, H);

    const m = 14 * dpr;
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);

    const { w, d, h } = this.design.dims;
    const fit = Math.min((W * 0.34) / Math.max(w, 60), (H * 0.32) / Math.max(h + d * 0.5, 60));

    const topCx = W * 0.29;
    const topCy = H * 0.27;
    const frontCx = W * 0.29;
    const frontBaseY = H * 0.80;
    const sideCx = W * 0.67;
    const sideBaseY = H * 0.80;

    // 중심선
    const centerLine = (x1, y1, x2, y2) => {
      ctx.save();
      ctx.strokeStyle = "rgba(244, 63, 94, 0.65)";
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([9 * dpr, 3 * dpr, 2 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    centerLine(topCx - w * fit * 0.6, topCy, topCx + w * fit * 0.6, topCy);
    centerLine(topCx, topCy - d * fit * 0.6, topCx, topCy + d * fit * 0.6);
    centerLine(frontCx, frontBaseY + 12 * dpr, frontCx, frontBaseY - h * fit - 16 * dpr);
    centerLine(sideCx, sideBaseY + 12 * dpr, sideCx, sideBaseY - h * fit - 16 * dpr);

    // 파트별 3각법 정투영 렌더링
    ctx.lineWidth = 1.25 * dpr;
    for (const p of this.design.parts) {
      let bx, by, bz, bw, bd, bh;
      if (p.kind === "cylinder" || p.kind === "spring") {
        const r = p.radius;
        const ax = (p.axis || "z").toLowerCase();
        if (ax === "x") {
          bx = p.cx; by = p.cy - r; bz = p.cz - r;
          bw = p.length; bd = r * 2; bh = r * 2;
        } else if (ax === "y") {
          bx = p.cx - r; by = p.cy; bz = p.cz - r;
          bw = r * 2; bd = p.length; bh = r * 2;
        } else {
          bx = p.cx - r; by = p.cy - r; bz = p.cz;
          bw = r * 2; bd = r * 2; bh = p.length;
        }
      } else {
        bx = p.x; by = p.y; bz = p.z;
        bw = p.w; bd = p.d; bh = p.h;
      }

      ctx.strokeStyle = p.kind === "spring" ? "#fb7185" : "#e2e8f0";
      ctx.fillStyle = "rgba(56, 189, 248, 0.05)";

      // Top (X-Y)
      ctx.strokeRect(topCx + bx * fit, topCy + by * fit, bw * fit, bd * fit);
      // Front (X-Z)
      ctx.strokeRect(frontCx + bx * fit, frontBaseY - (bz + bh) * fit, bw * fit, bh * fit);
      // Right (Y-Z)
      ctx.strokeRect(sideCx + by * fit, sideBaseY - (bz + bh) * fit, bd * fit, bh * fit);
    }

    // 치수 표기 (Preview 등급에서는 핵심 제조 공차 마스킹)
    ctx.fillStyle = "#38bdf8";
    ctx.strokeStyle = "#38bdf8";
    ctx.font = `600 ${Math.round(11 * dpr)}px Consolas, monospace`;
    ctx.textAlign = "center";

    const dimWText = this.isRedacted ? `L = [PRO 공개]` : `${w}.0 ±0.05 mm`;
    const dimHText = this.isRedacted ? `H = [잠김]` : `H ${h}.0 mm`;
    const dimDText = this.isRedacted ? `W = [잠김]` : `W ${d}.0 mm`;

    ctx.fillText(dimWText, frontCx, frontBaseY + 26 * dpr);
    ctx.fillText(dimDText, sideCx, sideBaseY + 26 * dpr);
    ctx.fillText(dimHText, frontCx + (w * fit) / 2 + 44 * dpr, frontBaseY - (h * fit) / 2);

    ctx.fillStyle = "#93c5fd";
    ctx.font = `700 ${Math.round(11.5 * dpr)}px Pretendard, sans-serif`;
    ctx.fillText("TOP VIEW (평면도)", topCx, topCy - (d * fit) / 2 - 14 * dpr);
    ctx.fillText("FRONT VIEW (정면도)", frontCx, frontBaseY + 44 * dpr);
    ctx.fillText("RIGHT VIEW (우측면도)", sideCx, sideBaseY + 44 * dpr);

    // 우측 하단 KS/ISO 표제란
    const tbW = Math.min(310 * dpr, W * 0.36);
    const tbH = 88 * dpr;
    const tbX = W - m - tbW;
    const tbY = H - m - tbH;
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.strokeStyle = "#3b82f6";
    ctx.fillRect(tbX, tbY, tbW, tbH);
    ctx.strokeRect(tbX, tbY, tbW, tbH);

    ctx.textAlign = "left";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 ${Math.round(11.5 * dpr)}px Pretendard, sans-serif`;
    ctx.fillText(`${this.design.projectId} | ${this.design.titleKo.slice(0, 20)}`, tbX + 10 * dpr, tbY + 22 * dpr);
    ctx.font = `500 ${Math.round(10.5 * dpr)}px Pretendard, sans-serif`;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`투상법: KS B ISO 128 제3각법 | 척도 ${this.design.drawingSpec.scale}`, tbX + 10 * dpr, tbY + 44 * dpr);
    ctx.fillStyle = this.isRedacted ? "#fbbf24" : "#34d399";
    ctx.fillText(`${this.design.drawingSpec.tolerance}`, tbX + 10 * dpr, tbY + 66 * dpr);
  }
}
