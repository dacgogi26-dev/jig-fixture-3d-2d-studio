import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * V5.0 Shapr3D × Onshape 급 Three.js PBR 3D 엔지니어링 스튜디오 뷰어
 * - 8대 현업 치공구(평행척·V블록·프레스·토글·인덱싱·볼스크류 스테이지·120° 3조 척·프로파일 가대) 완벽 지원
 * - Raycasting 부품 클릭 인스펙터 & BOM 양방향 하이라이트 연동
 * - 모바일 터치 제스처(Pinch-Zoom / Orbit) 및 ResizeObserver 반응형 뷰포트 지원
 * - KS B ISO 128 제3각법 진원(Arc)·회전 폴리곤 정밀 2D 도면 렌더링
 * - preserveDrawingBuffer: false 설정으로 웹 복제기 캔버스 덤프 원천 방지
 */
export class EngineeringCadStudioViewer {
  constructor({ containerEl, blueprintCanvasEl, onPartSelected }) {
    this.container = containerEl;
    this.bpCanvas = blueprintCanvasEl;
    this.bpCtx = blueprintCanvasEl.getContext("2d");
    this.onPartSelected = onPartSelected || null;

    this.design = null;
    this.isRedacted = true;
    this.mode = "3d";
    this.strokeRatio = 0;
    this.explodeRatio = 0;
    this.autoCycle = false;
    this.wireframe = false;
    this.showWorkpiece = true;
    this.showEnvelope = false;
    this.cycleClock = 0;

    this.partMeshes = [];
    this.pickableMeshes = [];
    this.selectedPartId = null;
    this.workpieceGroup = null;
    this.envelopeGroup = null;
    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = { x: 0, y: 0 };

    this.initWebGL();
    this.bindEvents();
    this.animate();
  }

  initWebGL() {
    const w = Math.max(280, this.container.clientWidth || 360);
    const h = Math.max(220, this.container.clientHeight || 300);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    this.container.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090e);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

    this.camera = new THREE.PerspectiveCamera(35, w / h, 1, 12000);
    this.camera.position.set(300, 230, 320);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.rotateSpeed = 0.82;
    this.controls.zoomSpeed = 0.95;
    this.controls.panSpeed = 0.75;
    this.controls.maxDistance = 3200;
    this.controls.minDistance = 50;
    this.controls.target.set(0, 55, 0);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
    keyLight.position.set(310, 480, 340);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.52);
    fillLight.position.set(-320, 210, -250);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.36);
    rimLight.position.set(0, 160, -380);
    this.scene.add(rimLight);

    // 정밀 스튜디오 듀얼 피치 서브 그리드
    const subGrid = new THREE.GridHelper(800, 80, 0x131926, 0x0e131d);
    subGrid.position.y = -0.35;
    this.scene.add(subGrid);

    const majorGrid = new THREE.GridHelper(800, 16, 0x2563eb, 0x182032);
    majorGrid.position.y = -0.2;
    this.scene.add(majorGrid);

    // 원점 기준 축 표시기 (X: Red, Y: Green, Z: Blue)
    const axes = new THREE.AxesHelper(45);
    axes.rotation.x = -Math.PI / 2;
    axes.position.set(-160, 0.5, 160);
    this.scene.add(axes);

    this.cadRoot = new THREE.Group();
    this.cadRoot.rotation.x = -Math.PI / 2;
    this.scene.add(this.cadRoot);
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }

    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener("pointerup", (e) => {
      if (this.mode !== "3d") return;
      const dist = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y
      );
      if (dist > 6) return; // 드래그/터치 회전 시에는 선택 무시

      const rect = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.pickableMeshes, false);

      if (hits.length > 0) {
        const part = hits[0].object.userData.ownerPart;
        this.highlightPartById(part?.id || null);
        if (this.onPartSelected) this.onPartSelected(part);
      } else {
        this.highlightPartById(null);
        if (this.onPartSelected) this.onPartSelected(null);
      }
    });
  }

  highlightPartById(partId) {
    this.selectedPartId = partId;
    for (const mesh of this.pickableMeshes) {
      const p = mesh.userData.ownerPart;
      if (!mesh.material || !mesh.material.emissive) continue;
      if (partId && p && p.id === partId) {
        mesh.material.emissive.setHex(0x2563eb);
        mesh.material.emissiveIntensity = 0.58;
      } else {
        mesh.material.emissive.setHex(0x000000);
        mesh.material.emissiveIntensity = 0;
      }
    }
  }

  resize() {
    const w = Math.max(260, this.container.clientWidth || 320);
    const h = Math.max(200, this.container.clientHeight || 240);
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
    this.pickableMeshes = [];
    this.workpieceGroup = null;
    this.envelopeGroup = null;
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

  loadDesign(design, { isRedacted = true } = {}) {
    this.design = design;
    this.isRedacted = isRedacted;
    this.clearSceneMeshes();

    for (const part of design.parts) {
      const holder = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(part.color || "#94a3b8"),
        metalness: part.metalness ?? 0.8,
        roughness: part.roughness ?? 0.24,
        wireframe: this.wireframe,
      });

      const registerPickable = (m) => {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.ownerPart = part;
        this.pickableMeshes.push(m);
        holder.add(m);
      };

      if (part.kind === "cylinder") {
        const geo = new THREE.CylinderGeometry(part.radius, part.radius, part.length, 40, 1);
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
        registerPickable(new THREE.Mesh(geo, mat));
        holder.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(geo, 30),
            new THREE.LineBasicMaterial({ color: 0x090b10, transparent: true, opacity: 0.48 })
          )
        );
        holder.position.set(part.cx, part.cy, part.cz);
      } else if (part.kind === "bolt") {
        // 육각소켓 캡 볼트(헤드 + 나사 섕크 + 육각 소켓홈) 정밀 렌더링
        const shankLen = part.shankLength || 14;
        const shankGeo = new THREE.CylinderGeometry(part.radius, part.radius, shankLen, 18);
        shankGeo.rotateX(Math.PI / 2);
        shankGeo.translate(0, 0, -shankLen / 2);
        registerPickable(new THREE.Mesh(shankGeo, mat));

        const headGeo = new THREE.CylinderGeometry(part.headRadius, part.headRadius, part.headLength, 24);
        headGeo.rotateX(Math.PI / 2);
        headGeo.translate(0, 0, part.headLength / 2);
        registerPickable(new THREE.Mesh(headGeo, mat));

        const socketGeo = new THREE.CylinderGeometry(part.radius * 0.82, part.radius * 0.82, 1.2, 6);
        socketGeo.rotateX(Math.PI / 2);
        socketGeo.translate(0, 0, part.headLength + 0.1);
        const socketMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
        holder.add(new THREE.Mesh(socketGeo, socketMat));

        holder.position.set(part.cx, part.cy, part.cz);
      } else if (part.kind === "spring") {
        const spGeo = this.buildHelicalSpringGeometry(part);
        const spMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(part.color || "#ef4444"),
          metalness: 0.64,
          roughness: 0.26,
          wireframe: this.wireframe,
        });
        registerPickable(new THREE.Mesh(spGeo, spMat));
        holder.position.set(part.cx, part.cy, part.cz);
      } else if (part.kind === "rotated_box") {
        // 120° 방사형 3조 척 조우 등 임의 각도 직육면체 파트
        const geo = new THREE.BoxGeometry(part.w, part.d, part.h);
        geo.translate(0, 0, part.h / 2);
        registerPickable(new THREE.Mesh(geo, mat));
        holder.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(geo, 20),
            new THREE.LineBasicMaterial({ color: 0x06080d, transparent: true, opacity: 0.72 })
          )
        );
        holder.rotation.z = ((Number(part.angleDeg) || 0) * Math.PI) / 180;
        holder.position.set(part.cx, part.cy, part.z);
      } else {
        const geo = new THREE.BoxGeometry(part.w, part.d, part.h);
        geo.translate(part.w / 2, part.d / 2, part.h / 2);
        registerPickable(new THREE.Mesh(geo, mat));
        holder.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(geo, 20),
            new THREE.LineBasicMaterial({ color: 0x06080d, transparent: true, opacity: 0.68 })
          )
        );
        holder.position.set(part.x, part.y, part.z);
      }

      holder.userData.basePos = holder.position.clone();
      holder.userData.part = part;
      this.cadRoot.add(holder);
      this.partMeshes.push(holder);
    }

    // 반투명 피가공물(원통 파이프/샤프트 또는 박스 하우징) 렌더링
    if (design.workpiece) {
      const wp = design.workpiece;
      const wpGroup = new THREE.Group();
      let wpGeo;

      if (wp.shape === "cylinder") {
        wpGeo = new THREE.CylinderGeometry(wp.radius, wp.radius, wp.length, 38);
        if (wp.axis === "z") {
          wpGeo.rotateX(Math.PI / 2);
        }
        wpGroup.position.set(wp.xOffset || 0, 0, wp.z + (wp.axis === "z" ? wp.length / 2 : wp.radius * 0.4));
      } else {
        wpGeo = new THREE.BoxGeometry(wp.w, wp.d, wp.h);
        wpGroup.position.set(wp.xOffset || 0, 0, wp.z + wp.h / 2);
      }

      const wpMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        roughness: 0.12,
        metalness: 0.08,
        depthWrite: false,
      });
      const wpEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(wpGeo, 24),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
      );
      wpGroup.add(new THREE.Mesh(wpGeo, wpMat), wpEdges);
      wpGroup.visible = this.showWorkpiece;
      this.cadRoot.add(wpGroup);
      this.workpieceGroup = wpGroup;
    }

    // 설비 장착 간섭 확인용 3D 외곽 엔벨로프 박스 (L×W×H)
    if (design.dims) {
      const { w, d, h } = design.dims;
      const envGeo = new THREE.BoxGeometry(w, d, h);
      envGeo.translate(0, 0, h / 2);
      const envEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(envGeo),
        new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.65 })
      );
      envGeo.dispose();
      envEdges.visible = this.showEnvelope;
      this.cadRoot.add(envEdges);
      this.envelopeGroup = envEdges;
    }

    this.applyKinematicsAndExplode();
    this.fitCameraToDesign();
    if (this.mode === "2d") this.render2DBlueprint();
  }

  fitCameraToDesign() {
    if (!this.design) return;
    const { w, d, h } = this.design.dims;
    const span = Math.max(w, d, h, 140);
    const cy = h * 0.42;
    this.controls.target.set(0, cy, 0);
    this.camera.position.set(span * 1.1, cy + span * 0.76, span * 1.22);
    this.controls.update();
  }

  setCameraPreset(preset) {
    if (!this.design) return;
    const { w, d, h } = this.design.dims;
    const span = Math.max(w, d, h, 140) * 1.5;
    const cy = h * 0.42;
    this.controls.target.set(0, cy, 0);

    if (preset === "front") this.camera.position.set(0, cy, span);
    else if (preset === "top") this.camera.position.set(0, cy + span * 1.14, 0.01);
    else if (preset === "right") this.camera.position.set(span, cy, 0);
    else this.camera.position.set(span * 0.74, cy + span * 0.52, span * 0.82);

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

  setWorkpieceVisible(visible) {
    this.showWorkpiece = Boolean(visible);
    if (this.workpieceGroup) this.workpieceGroup.visible = this.showWorkpiece;
  }

  setWireframe(enabled) {
    this.wireframe = Boolean(enabled);
    for (const mesh of this.pickableMeshes) {
      if (mesh.material) {
        mesh.material.wireframe = this.wireframe;
      }
    }
  }

  setEnvelopeVisible(visible) {
    this.showEnvelope = Boolean(visible);
    if (this.envelopeGroup) this.envelopeGroup.visible = this.showEnvelope;
  }

  captureProposalSnapshotDataUrl({ titleText = "", metaText = "" } = {}) {
    const srcCanvas = this.mode === "2d" ? this.bpCanvas : this.renderer.domElement;
    if (this.mode === "3d") {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.render2DBlueprint();
    }

    const W = srcCanvas.width;
    const H = srcCanvas.height;
    const footerH = Math.max(54, Math.round(H * 0.085));
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H + footerH;
    const ctx = out.getContext("2d");

    ctx.fillStyle = "#07090e";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(srcCanvas, 0, 0);

    ctx.fillStyle = "#0d121d";
    ctx.fillRect(0, H, W, footerH);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W, H);
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 ${Math.max(13, Math.round(footerH * 0.31))}px sans-serif`;
    ctx.fillText(titleText || "FORMECH CAE STUDIO — 3D ENGINEERING SNAPSHOT", 18, H + Math.round(footerH * 0.44));

    ctx.fillStyle = "#38bdf8";
    ctx.font = `600 ${Math.max(11, Math.round(footerH * 0.24))}px Consolas, monospace`;
    ctx.fillText(metaText, 18, H + Math.round(footerH * 0.80));

    return out.toDataURL("image/png");
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
      } else if (part.motionRole === "stageX") {
        dx += travel;
      } else if (part.motionRole === "radialJaw") {
        const rad = ((Number(part.motionAngleDeg) || 0) * Math.PI) / 180;
        dx += Math.cos(rad) * travel;
        dy += Math.sin(rad) * travel;
      } else if (part.motionRole === "ramVertical") {
        dz += travel;
      } else if (part.motionRole === "springLeft") {
        const compressedRatio = Math.max(0.28, (part.length - travel) / part.length);
        holder.scale.set(compressedRatio, 1, 1);
      } else if (part.motionRole === "springRight") {
        const newLen = Math.max(part.length * 0.28, part.length - travel);
        dx += travel;
        holder.scale.set(newLen / part.length, 1, 1);
      } else if (part.motionRole === "springVertical") {
        const newLen = Math.max(part.length * 0.3, part.length - travel);
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
      if (this.onLiveStrokeTick) this.onLiveStrokeTick(this.strokeRatio);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  render2DBlueprint() {
    if (!this.design) return;
    const ctx = this.bpCtx;
    const W = this.bpCanvas.width;
    const H = this.bpCanvas.height;
    const dpr = this.bpDpr || 1;

    ctx.fillStyle = "#070a11";
    ctx.fillRect(0, 0, W, H);

    const m = 14 * dpr;
    ctx.strokeStyle = "rgba(59, 130, 246, 0.52)";
    ctx.lineWidth = 1.3 * dpr;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);

    const { w, d, h } = this.design.dims;
    const fit = Math.min(
      (W * 0.32) / Math.max(w, 60),
      (H * 0.30) / Math.max(h + d * 0.5, 60)
    );

    const topCx = W * 0.28;
    const topCy = H * 0.27;
    const frontCx = W * 0.28;
    const frontBaseY = H * 0.80;
    const sideCx = W * 0.67;
    const sideBaseY = H * 0.80;

    const centerLine = (x1, y1, x2, y2) => {
      ctx.save();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([8 * dpr, 3 * dpr, 2 * dpr, 3 * dpr]);
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

    ctx.lineWidth = 1.15 * dpr;
    for (const p of this.design.parts) {
      ctx.strokeStyle = p.kind === "spring" ? "#f43f5e" : "#cbd5e1";

      if (p.kind === "rotated_box") {
        const rad = ((Number(p.angleDeg) || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const hw = p.w / 2;
        const hd = p.d / 2;
        const corners = [
          [-hw, -hd],
          [hw, -hd],
          [hw, hd],
          [-hw, hd],
        ].map(([lx, ly]) => [
          p.cx + lx * cos - ly * sin,
          p.cy + lx * sin + ly * cos,
        ]);

        // 평면도(TOP VIEW): 실제 회전 폴리곤 투영
        ctx.beginPath();
        corners.forEach(([wx, wy], idx) => {
          const sx = topCx + wx * fit;
          const sy = topCy + wy * fit;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.stroke();

        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => c[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        ctx.strokeRect(
          frontCx + minX * fit,
          frontBaseY - (p.z + p.h) * fit,
          (maxX - minX) * fit,
          p.h * fit
        );
        ctx.strokeRect(
          sideCx + minY * fit,
          sideBaseY - (p.z + p.h) * fit,
          (maxY - minY) * fit,
          p.h * fit
        );
        continue;
      }

      if (p.kind === "cylinder" || p.kind === "spring" || p.kind === "bolt") {
        const r = p.headRadius || p.radius;
        const len = p.headLength || p.length;
        const ax = (p.axis || "z").toLowerCase();

        if (ax === "z") {
          // Z축 원통은 평면도(TOP VIEW)에서 해석적 진원으로 작도
          ctx.beginPath();
          ctx.arc(topCx + p.cx * fit, topCy + p.cy * fit, Math.max(1.2, r * fit), 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeRect(
            frontCx + (p.cx - r) * fit,
            frontBaseY - (p.cz + len) * fit,
            r * 2 * fit,
            len * fit
          );
          ctx.strokeRect(
            sideCx + (p.cy - r) * fit,
            sideBaseY - (p.cz + len) * fit,
            r * 2 * fit,
            len * fit
          );
          continue;
        }

        let bx, by, bz, bw, bd, bh;
        if (ax === "x") {
          bx = p.cx; by = p.cy - r; bz = p.cz - r;
          bw = len; bd = r * 2; bh = r * 2;
        } else {
          bx = p.cx - r; by = p.cy; bz = p.cz - r;
          bw = r * 2; bd = len; bh = r * 2;
        }
        ctx.strokeRect(topCx + bx * fit, topCy + by * fit, bw * fit, bd * fit);
        ctx.strokeRect(frontCx + bx * fit, frontBaseY - (bz + bh) * fit, bw * fit, bh * fit);
        ctx.strokeRect(sideCx + by * fit, sideBaseY - (bz + bh) * fit, bd * fit, bh * fit);
        continue;
      }

      ctx.strokeRect(topCx + p.x * fit, topCy + p.y * fit, p.w * fit, p.d * fit);
      ctx.strokeRect(frontCx + p.x * fit, frontBaseY - (p.z + p.h) * fit, p.w * fit, p.h * fit);
      ctx.strokeRect(sideCx + p.y * fit, sideBaseY - (p.z + p.h) * fit, p.d * fit, p.h * fit);
    }

    ctx.fillStyle = "#38bdf8";
    ctx.font = `600 ${Math.round(10.5 * dpr)}px Consolas, monospace`;
    ctx.textAlign = "center";

    const dimW = this.isRedacted ? `L = [PRO 전용]` : `${w}.0 ±0.02 mm`;
    const dimD = this.isRedacted ? `W = [잠김]` : `${d}.0 mm`;
    const dimH = this.isRedacted ? `H = [잠김]` : `${h}.0 mm`;

    ctx.fillText(dimW, frontCx, frontBaseY + 24 * dpr);
    ctx.fillText(dimD, sideCx, sideBaseY + 24 * dpr);
    ctx.fillText(dimH, frontCx + (w * fit) / 2 + 38 * dpr, frontBaseY - (h * fit) / 2);

    ctx.fillStyle = "#64748b";
    ctx.font = `700 ${Math.round(10 * dpr)}px sans-serif`;
    ctx.fillText("TOP VIEW", topCx, topCy - (d * fit) / 2 - 12 * dpr);
    ctx.fillText("FRONT VIEW", frontCx, frontBaseY + 40 * dpr);
    ctx.fillText("RIGHT VIEW", sideCx, sideBaseY + 40 * dpr);

    // KS/ISO 정밀 표제란 (모바일 소형 캔버스 자동 대응)
    const tbW = Math.min(310 * dpr, W * 0.44);
    const tbH = 78 * dpr;
    const tbX = W - m - tbW;
    const tbY = H - m - tbH;
    ctx.fillStyle = "#0d111a";
    ctx.strokeStyle = "rgba(59, 130, 246, 0.52)";
    ctx.fillRect(tbX, tbY, tbW, tbH);
    ctx.strokeRect(tbX, tbY, tbW, tbH);

    ctx.textAlign = "left";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 ${Math.round(10.5 * dpr)}px sans-serif`;
    ctx.fillText(`DWG: ${this.design.projectId} · ${this.design.drawingSpec.scale}`, tbX + 10 * dpr, tbY + 20 * dpr);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `500 ${Math.round(9.5 * dpr)}px sans-serif`;
    ctx.fillText(`${this.design.titleKo.slice(0, 24)}`, tbX + 10 * dpr, tbY + 40 * dpr);
    ctx.fillStyle = this.isRedacted ? "#f59e0b" : "#10b981";
    ctx.fillText(`${this.design.drawingSpec.tolerance.slice(0, 32)}`, tbX + 10 * dpr, tbY + 60 * dpr);
  }
  }
