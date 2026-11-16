import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { DEFAULT_DIMS, ITEMS, META, PRESETS, DOOR_COLOR, WINDOW_COLOR, doorInfo, wardrobePos, fsize, norm } from './data.js';
import { analyze, footprint, gapDir } from './analysis.js';
import { buildRoom, buildItem, setTVElevation } from './builders.js';

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtM = (cm) => (cm / 100).toFixed(2).replace('.', ',') + ' m';
const fmtM1 = (cm) => (cm / 100).toFixed(1).replace('.', ',');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const coarse = matchMedia('(pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileMQ = matchMedia('(max-width: 899px)');
const STORE = 'quartoDaniela.v1';
const HINT_KEY = 'quartoDaniela.hint';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };
const b64e = (s) => {
  let bin = '';
  new TextEncoder().encode(s).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

const ICON = {
  rotate: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  wall: '<svg viewBox="0 0 24 24"><path d="M4 3v18"/><path d="M20 12H8m0 0 4-4m-4 4 4 4"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4m0 3v.01"/></svg>',
  space: '<svg viewBox="0 0 24 24"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>',
};
const ARROW = { N: '↑', E: '→', S: '↓', W: '←' };

// ---------- estado ----------
const state = {
  dims: clone(DEFAULT_DIMS),
  positions: null,
  layoutId: 'atual',
  layoutName: PRESETS[0].name,
  saved: [],
  view: '3d',
  showClear: true,
  showLabels: true,
  selected: null,
  analysis: null,
  tab: 'layouts',
};
let pendingToast = null;

function mergeDims(src) {
  if (!src || typeof src !== 'object') return;
  const walk = (dst, s) => {
    for (const k of Object.keys(dst)) {
      if (s[k] === undefined || s[k] === null) continue;
      if (typeof dst[k] === 'object') walk(dst[k], s[k]);
      else {
        const v = Number(s[k]);
        if (Number.isFinite(v) && v >= 0 && v < 2000) dst[k] = v;
      }
    }
  };
  walk(state.dims, src);
}
const validPositions = (p) => p && ITEMS.every((it) => p[it.id] && ['x', 'z', 'rot'].every((k) => Number.isFinite(p[it.id][k])));

function loadState() {
  try {
    const s = JSON.parse(lsGet(STORE) || 'null');
    if (s && s.v === 1) {
      mergeDims(s.dims);
      if (validPositions(s.positions)) {
        state.positions = s.positions;
        state.layoutId = s.layoutId || 'custom';
        state.layoutName = s.layoutName || 'Meu layout';
      }
      state.saved = Array.isArray(s.saved) ? s.saved.filter((x) => x && x.id && validPositions(x.positions)) : [];
      state.showClear = s.showClear !== false;
      state.showLabels = s.showLabels !== false;
    }
  } catch { /* estado inválido: começa do zero */ }
  const m = location.hash.match(/^#l=([\w-]+)/);
  if (m) {
    try {
      const o = JSON.parse(b64d(m[1]));
      if (o.d) mergeDims(o.d);
      if (validPositions(o.p)) {
        state.positions = o.p;
        state.layoutId = 'shared';
        state.layoutName = o.n ? String(o.n).slice(0, 60) : 'Layout compartilhado';
        pendingToast = 'Layout compartilhado carregado!';
      }
    } catch {
      pendingToast = 'Não consegui ler o link compartilhado.';
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
  const pre = PRESETS.find((p) => p.id === state.layoutId);
  if (!state.positions) {
    state.positions = PRESETS[0].build(state.dims);
    state.layoutId = 'atual';
    state.layoutName = PRESETS[0].name;
  } else if (pre) {
    state.positions = pre.build(state.dims);
  }
  state.positions.wardrobe = wardrobePos(state.dims);
  if (!Number.isFinite(state.positions.tv.y)) state.positions.tv.y = 85;
}

let saveT = 0;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    lsSet(STORE, JSON.stringify({
      v: 1, dims: state.dims, positions: state.positions, layoutId: state.layoutId, layoutName: state.layoutName,
      saved: state.saved, showClear: state.showClear, showLabels: state.showLabels,
    }));
  }, 300);
}

// ---------- three.js ----------
const stage = $('#stage');
const canvas = $('#c');
const panel = $('#panel');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const world = new THREE.Group();
world.scale.setScalar(0.01); // cm -> m
scene.add(world);

scene.add(new THREE.HemisphereLight(0xffffff, 0xcbb6a2, 1.55));
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xfff2e2, 2.1);
sun.castShadow = true;
const sm = coarse ? 1024 : 2048;
sun.shadow.mapSize.set(sm, sm);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.015;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const lamp = new THREE.PointLight(0xfff1dc, 2.2, 0, 2);
scene.add(lamp);

const cam3d = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
const camDoor = new THREE.PerspectiveCamera(70, 1, 0.02, 100);
const camPlan = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camPlan.up.set(0, 0, -1);

function mkCtl(cam) {
  const c = new OrbitControls(cam, canvas);
  c.enableDamping = true;
  c.dampingFactor = 0.1;
  c.enabled = false;
  return c;
}
const ctl3d = mkCtl(cam3d);
ctl3d.minDistance = 1.2;
ctl3d.maxDistance = 14;
ctl3d.maxPolarAngle = THREE.MathUtils.degToRad(84);
ctl3d.screenSpacePanning = true;
ctl3d.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
const ctlDoor = mkCtl(camDoor);
ctlDoor.enableZoom = false;
ctlDoor.enablePan = false;
ctlDoor.rotateSpeed = -0.35;
ctlDoor.minPolarAngle = 0.5;
ctlDoor.maxPolarAngle = Math.PI - 0.5;
const ctlPlan = mkCtl(camPlan);
ctlPlan.enableRotate = false;
ctlPlan.screenSpacePanning = true;
ctlPlan.minZoom = 0.6;
ctlPlan.maxZoom = 6;
ctlPlan.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
ctlPlan.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
const CAM = { '3d': cam3d, door: camDoor, plan: camPlan };
const CTL = { '3d': ctl3d, door: ctlDoor, plan: ctlPlan };
let userMoved3d = false;
ctl3d.addEventListener('start', () => { userMoved3d = true; });

// ---------- quarto e móveis ----------
let room = null;
const items = {};
const disp = {}; // posições mostradas (animadas)

function disposeTree(o) {
  o.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
}

function rebuildAll() {
  if (room) {
    world.remove(room.root);
    disposeTree(room.root);
    room.floorMat.map?.dispose();
    room.floorMat.dispose();
  }
  room = buildRoom(state.dims);
  world.add(room.root);
  for (const it of ITEMS) {
    if (items[it.id]) {
      world.remove(items[it.id]);
      disposeTree(items[it.id]);
    }
    const g = buildItem(it.id, state.dims.items[it.id]);
    g.traverse((o) => { o.userData.itemId = it.id; });
    items[it.id] = g;
    world.add(g);
  }
  tween = null;
  overlay.visible = true;
  for (const it of ITEMS) {
    disp[it.id] = clone(state.positions[it.id]);
    place(it.id, disp[it.id]);
  }
  const { W, D, H } = state.dims.room;
  const cx = W / 200;
  const cz = D / 200;
  sun.position.set(cx + 1.6, 5, cz + 2.2);
  sun.target.position.set(cx, 0, cz);
  sun.target.updateMatrixWorld();
  const s = Math.max(W, D) / 200 + 0.8;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 14 });
  sun.shadow.camera.updateProjectionMatrix();
  lamp.position.set(cx, (H - 25) / 100, cz);
  dirty = true;
}

function place(id, p, lift = 0) {
  const g = items[id];
  g.position.set(p.x, lift, p.z);
  g.rotation.y = THREE.MathUtils.degToRad(p.rot);
  if (id === 'tv') setTVElevation(g, p.y ?? 85);
}

// ---------- animação entre layouts ----------
let tween = null;
function startTween() {
  const to = clone(state.positions);
  if (reduced) {
    for (const it of ITEMS) { disp[it.id] = clone(to[it.id]); place(it.id, to[it.id]); }
    dirty = true;
    return;
  }
  tween = { t0: performance.now(), dur: 750, from: clone(disp), to };
  overlay.visible = false;
  dirty = true;
}
function stepTween(now) {
  if (!tween) return false;
  const k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  for (const it of ITEMS) {
    const f = tween.from[it.id];
    const t = tween.to[it.id];
    const dr = ((((t.rot - f.rot) % 360) + 540) % 360) - 180;
    const fy = f.y ?? 85;
    const ty = t.y ?? 85;
    const p = { x: f.x + (t.x - f.x) * e, z: f.z + (t.z - f.z) * e, rot: f.rot + dr * e, y: fy + (ty - fy) * e };
    const moved = Math.hypot(t.x - f.x, t.z - f.z) > 5 || Math.abs(dr) > 1;
    const lift = moved && !it.wall && k < 1 ? Math.sin(Math.PI * e) * 10 : 0;
    place(it.id, p, lift);
    disp[it.id] = k >= 1 ? clone(t) : p;
  }
  if (k >= 1) {
    tween = null;
    overlay.visible = true;
  }
  return true;
}

// ---------- sobreposições (áreas de uso, seleção, medidas) ----------
const overlay = new THREE.Group();
const zoneG = new THREE.Group();
const ringG = new THREE.Group();
const gapG = new THREE.Group();
overlay.add(zoneG, ringG, gapG);
world.add(overlay);
const matCache = new Map();
function basicMat(color, opacity, depthTest = true) {
  const k = `m${color}|${opacity}|${depthTest}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest, side: THREE.DoubleSide }));
  return matCache.get(k);
}
function lineMat(color, opacity = 1, depthTest = true) {
  const k = `l${color}|${opacity}|${depthTest}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.LineBasicMaterial({ color, transparent: opacity < 1 || !depthTest, opacity, depthTest }));
  return matCache.get(k);
}
function clearG(g) {
  for (const c of [...g.children]) {
    g.remove(c);
    c.geometry?.dispose();
  }
}
function flat(g, x0, z0, x1, z1, y, m, order = 0) {
  if (x1 - x0 <= 0 || z1 - z0 <= 0) return;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  mesh.renderOrder = order;
  g.add(mesh);
}
function ringRect(g, r, pad, th, y, m) {
  const a = { x0: r.x0 - pad - th, x1: r.x1 + pad + th, z0: r.z0 - pad - th, z1: r.z1 + pad + th };
  flat(g, a.x0, a.z0, a.x1, a.z0 + th, y, m, 2);
  flat(g, a.x0, a.z1 - th, a.x1, a.z1, y, m, 2);
  flat(g, a.x0, a.z0 + th, a.x0 + th, a.z1 - th, y, m, 2);
  flat(g, a.x1 - th, a.z0 + th, a.x1, a.z1 - th, y, m, 2);
}
function rectLine(g, r, y, m) {
  const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1], [r.x0, r.z0]].map(([x, z]) => new THREE.Vector3(x, y, z));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
}
function selGaps(id) {
  const R = state.analysis.rects;
  const { W, D } = state.dims.room;
  const others = ITEMS.filter((i) => i.id !== id && !i.wall).map((i) => [i.id, R[i.id]]);
  return ['N', 'E', 'S', 'W'].map((k) => gapDir(R[id], k, others, W, D));
}

let gapInfo = [];
function updateOverlays() {
  clearG(zoneG);
  clearG(ringG);
  clearG(gapG);
  gapInfo = [];
  const A = state.analysis;
  if (!A) return;
  if (state.showClear) {
    for (const [id, z] of Object.entries(A.zones)) {
      const r = z.rect;
      if (r.x1 - r.x0 < 1 || r.z1 - r.z0 < 1) continue;
      const col = z.blocked ? '#e5484d' : META[id].color;
      flat(zoneG, r.x0, r.z0, r.x1, r.z1, 0.5, basicMat(col, z.blocked ? 0.32 : 0.2), 1);
      rectLine(zoneG, r, 0.7, lineMat(col, 0.85));
    }
  }
  const errIds = new Set(A.issues.filter((i) => i.level === 'erro').flatMap((i) => i.ids));
  for (const id of errIds) ringRect(ringG, A.rects[id], 2, 3, 1.2, basicMat('#e5484d', 0.95));
  const sel = state.selected;
  if (!sel) return;
  ringRect(ringG, A.rects[sel], 3, 4, 1.4, basicMat(errIds.has(sel) ? '#e5484d' : '#c8487a', 1));
  if (META[sel].wall) return;
  const pts = [];
  for (const g of selGaps(sel)) {
    if (g.d < 1.5) continue;
    const [ax, az] = g.a;
    const [bx, bz] = g.b;
    const y = 3;
    pts.push(ax, y, az, bx, y, bz);
    const vert = Math.abs(bx - ax) < 0.01;
    for (const [px, pz] of [[ax, az], [bx, bz]]) {
      if (vert) pts.push(px - 6, y, pz, px + 6, y, pz);
      else pts.push(px, y, pz - 6, px, y, pz + 6);
    }
    gapInfo.push({ x: (ax + bx) / 2, z: (az + bz) / 2, text: `${Math.round(g.d)} cm`, tight: g.d > 2 && g.d < 35 });
  }
  if (pts.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const ls = new THREE.LineSegments(geo, lineMat('#2b2530', 1, false));
    ls.renderOrder = 10;
    gapG.add(ls);
  }
}

// ---------- etiquetas HTML ----------
const labelLayer = $('#labels');
function mkLabel(cls, html) {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  labelLayer.appendChild(el);
  return el;
}
const itemLabels = {};
for (const it of ITEMS) itemLabels[it.id] = mkLabel('tag', `<i style="background:${it.color}"></i>${it.short}`);
const roomLabels = { door: mkLabel('tag room', 'Porta'), win: mkLabel('tag room', 'Janela'), w: mkLabel('measure', ''), d: mkLabel('measure', '') };
const gapEls = [0, 1, 2, 3].map(() => mkLabel('dimtag', ''));
const v3 = new THREE.Vector3();
function placeLabel(el, x, y, z, cam) {
  v3.set(x / 100, y / 100, z / 100).project(cam);
  if (v3.z > 1 || Math.abs(v3.x) > 1.2 || Math.abs(v3.y) > 1.2) {
    el.style.visibility = 'hidden';
    return;
  }
  el.style.visibility = 'visible';
  el.style.transform = `translate(${(((v3.x + 1) / 2) * stageW).toFixed(1)}px,${(((1 - v3.y) / 2) * stageH).toFixed(1)}px) translate(-50%,-50%)`;
}
const hide = (el) => { el.style.visibility = 'hidden'; };
function updateLabels() {
  const cam = CAM[state.view];
  const plan = state.view === 'plan';
  for (const it of ITEMS) {
    const el = itemLabels[it.id];
    if (!(state.showLabels || state.selected === it.id)) { hide(el); continue; }
    el.classList.toggle('sel', state.selected === it.id);
    const p = disp[it.id];
    const dm = state.dims.items[it.id];
    let { x, z } = p;
    let y = plan ? dm.h : dm.h + 16;
    if (it.id === 'bed' && !plan) y = 80;
    if (it.id === 'tv') {
      y = (p.y ?? 85) + dm.h + (plan ? 0 : 10);
      if (plan) {
        const r = norm(p.rot);
        const f = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] }[r] || [0, 0];
        x += f[0] * 16;
        z += f[1] * 16;
      }
    }
    placeLabel(el, x, y, z, cam);
  }
  if (plan) {
    const { W, D } = state.dims.room;
    const di = doorInfo(state.dims);
    placeLabel(roomLabels.door, -30, 0, (di.z0 + di.z1) / 2, cam);
    placeLabel(roomLabels.win, W + 38, 0, state.dims.win.offset + state.dims.win.width / 2, cam);
    roomLabels.w.textContent = fmtM(W);
    roomLabels.d.textContent = fmtM(D);
    placeLabel(roomLabels.w, W / 2, 0, -30, cam);
    placeLabel(roomLabels.d, -30, 0, Math.min(D / 2, di.z0 / 2), cam);
  } else {
    Object.values(roomLabels).forEach(hide);
  }
  gapEls.forEach((el, i) => {
    const g = gapInfo[i];
    if (!g || !overlay.visible) { hide(el); return; }
    el.textContent = g.text;
    el.classList.toggle('tight', g.tight);
    placeLabel(el, g.x, 3, g.z, cam);
  });
}

// ---------- câmeras ----------
let stageW = 1;
let stageH = 1;
let dirty = true;
let planInit = false;
const VIEW_DIR = new THREE.Vector3(-0.15, 1.1, 0.8).normalize();
const roomCenter = () => new THREE.Vector3(state.dims.room.W / 200, 0, state.dims.room.D / 200);

function fit3d(dir = VIEW_DIR) {
  const { W, D, H } = state.dims.room;
  const target = roomCenter();
  target.y = (H / 100) * 0.3;
  const corners = [];
  for (const x of [0, W]) for (const y of [0, H]) for (const z of [0, D]) corners.push(new THREE.Vector3(x / 100, y / 100, z / 100));
  const v = new THREE.Vector3();
  let dist = 6;
  for (let i = 0; i < 6; i++) {
    cam3d.position.copy(target).addScaledVector(dir, dist);
    cam3d.lookAt(target);
    cam3d.updateMatrixWorld();
    let m = 0;
    for (const c of corners) {
      v.copy(c).project(cam3d);
      m = Math.max(m, Math.abs(v.x), Math.abs(v.y) * 1.08);
    }
    dist *= m / 0.94;
  }
  cam3d.position.copy(target).addScaledVector(dir, dist);
  ctl3d.target.copy(target);
  ctl3d.update();
  dirty = true;
}
function updateDoorFov() {
  const hf = THREE.MathUtils.degToRad(86);
  const vf = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / camDoor.aspect));
  camDoor.fov = clamp(vf, 52, 100);
  camDoor.updateProjectionMatrix();
}
function setDoorCam() {
  const { W, D } = state.dims.room;
  const di = doorInfo(state.dims);
  const eye = new THREE.Vector3(14, 158, (di.z0 + di.z1) / 2).multiplyScalar(0.01);
  const look = new THREE.Vector3(W - 20, 100, D * 0.45).multiplyScalar(0.01);
  camDoor.position.copy(eye);
  const dir = look.sub(eye).normalize();
  ctlDoor.target.copy(eye).addScaledVector(dir, 0.01);
  ctlDoor.update();
  updateDoorFov();
}
function fitPlan() {
  const { W, D } = state.dims.room;
  // deixa espaço para os botões flutuantes em cima e embaixo
  const padTop = 64;
  const padBot = 64;
  const padX = 12;
  const m = 56;
  const scale = Math.max(0.05, Math.min((stageW - 2 * padX) / (W + 2 * m), (stageH - padTop - padBot) / (D + 2 * m))); // px por cm
  const hw = stageW / 2 / scale / 100;
  const hh = stageH / 2 / scale / 100;
  const off = (padBot - padTop) / 2 / scale / 100; // centraliza na área livre
  camPlan.left = -hw;
  camPlan.right = hw;
  camPlan.top = hh + off;
  camPlan.bottom = -hh + off;
  camPlan.updateProjectionMatrix();
}
function resetPlan() {
  const c = roomCenter();
  camPlan.position.set(c.x, 20, c.z);
  camPlan.zoom = 1;
  ctlPlan.target.copy(c);
  fitPlan();
  ctlPlan.update();
}
function setView(v, reset = false) {
  for (const k of Object.keys(CTL)) CTL[k].enabled = k === v;
  state.view = v;
  $$('.views button').forEach((b) => {
    const on = b.dataset.view === v;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  if (v === 'door') setDoorCam();
  if (v === 'plan' && (reset || !planInit)) { resetPlan(); planInit = true; }
  if (v === '3d' && reset) { userMoved3d = false; fit3d(); }
  dirty = true;
}
function resize() {
  const r = stage.getBoundingClientRect();
  stageW = Math.max(1, r.width);
  stageH = Math.max(1, r.height);
  renderer.setSize(stageW, stageH, false);
  cam3d.aspect = camDoor.aspect = stageW / stageH;
  cam3d.updateProjectionMatrix();
  updateDoorFov();
  fitPlan();
  if (!userMoved3d) fit3d();
  dirty = true;
}

function updateVisibility() {
  const cam = CAM[state.view];
  const p = cam.position;
  const { W, D, H } = state.dims.room;
  const x = p.x * 100;
  const y = p.y * 100;
  const z = p.z * 100;
  for (const [name, w] of Object.entries(room.walls)) {
    let inside;
    if (state.view === 'plan') inside = false;
    else if (state.view === 'door') inside = true;
    else inside = name === 'north' ? z > 0 : name === 'south' ? z < D : name === 'west' ? x > 0 : x < W;
    w.full.visible = inside;
    w.stub.visible = !inside;
  }
  room.ceiling.visible = state.view === 'door' || (y < H && x > 0 && x < W && z > 0 && z < D);
  room.doorLeaf.visible = state.view === 'plan' || room.walls.west.full.visible;
}

function render() {
  updateVisibility();
  renderer.render(scene, CAM[state.view]);
  updateLabels();
}
let firstFrame = true;
function frame(now) {
  requestAnimationFrame(frame);
  const moved = CTL[state.view].update();
  const tw = stepTween(now);
  if (moved || tw || dirty) {
    dirty = false;
    render();
    if (firstFrame) {
      firstFrame = false;
      $('#loading').classList.add('done');
      showHint();
      if (pendingToast) toast(pendingToast);
    }
  }
}

// ---------- análise + interface ----------
let presetCache = null;
function presetData() {
  const key = JSON.stringify(state.dims);
  if (presetCache?.key === key) return presetCache.list;
  const list = PRESETS.map((p) => {
    const pos = p.build(state.dims);
    return { p, pos, a: analyze(state.dims, pos) };
  });
  presetCache = { key, list };
  return list;
}

function refresh({ light = false } = {}) {
  state.analysis = analyze(state.dims, state.positions);
  updateOverlays();
  updateStatus();
  updateSelbar();
  if (light) {
    const gb = $('#gapsBox');
    if (gb && state.selected) gb.innerHTML = gapsHTML(state.selected);
  } else {
    renderItems();
  }
  dirty = true;
  save();
}
let refreshQueued = false;
function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    refresh({ light: true });
  });
}

const plural = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;
function updateStatus() {
  const A = state.analysis;
  const el = $('#status');
  let cls = 'ok';
  let html = `${ICON.check}<span>Tudo certo</span>`;
  if (A.errors) { cls = 'err'; html = `${ICON.alert}<span>${plural(A.errors, 'conflito')}</span>`; }
  else if (A.warnings) { cls = 'warn'; html = `${ICON.alert}<span>${plural(A.warnings, 'aviso')}</span>`; }
  el.className = 'status ' + cls;
  el.innerHTML = html;
  if (!$('#statusPop').hidden) renderPop();
}
function issueHTML(i) {
  const ic = { erro: '!', aviso: '!', dica: 'i' }[i.level];
  return `<button class="issue ${i.level}" data-ids="${i.ids.join(',')}"><span class="ic">${ic}</span><span>${esc(i.text)}</span></button>`;
}
function renderPop() {
  const A = state.analysis;
  const by = (l) => A.issues.filter((i) => i.level === l);
  let h = '';
  if (by('erro').length) h += '<h4>Precisa resolver</h4>' + by('erro').map(issueHTML).join('');
  if (by('aviso').length) h += '<h4>Atenção</h4>' + by('aviso').map(issueHTML).join('');
  if (by('dica').length) h += '<h4>Dicas</h4>' + by('dica').map(issueHTML).join('');
  if (A.good.length) h += '<h4>Pontos fortes</h4>' + A.good.map((g) => `<div class="issue good"><span class="ic">✓</span><span>${esc(g)}</span></div>`).join('');
  h += `<p class="muted">Maior espaço livre no chão: <b>${fmtM1(A.free.w)} × ${fmtM1(A.free.d)} m</b></p>`;
  $('#statusPop').innerHTML = h;
}
function togglePop(force) {
  const pop = $('#statusPop');
  const open = force ?? pop.hidden;
  if (open) renderPop();
  pop.hidden = !open;
  $('#status').setAttribute('aria-expanded', String(open));
}

let selbarId = undefined;
function updateSelbar() {
  const bar = $('#selbar');
  const id = state.selected;
  stage.classList.toggle('has-sel', !!id);
  if (id === selbarId) return;
  selbarId = id;
  if (!id) { bar.hidden = true; return; }
  const it = META[id];
  let h = `<span class="sw" style="background:${it.color}"></span><b>${it.name}</b>`;
  if (it.fixed) h += `<span class="lock">${ICON.lock}não sai do lugar</span>`;
  else if (it.wall) h += `<button data-act="up" aria-label="Subir a TV">${ICON.up}Subir</button><button data-act="down" aria-label="Descer a TV">${ICON.down}Descer</button>`;
  else h += `<button data-act="rotate">${ICON.rotate}Girar</button><button data-act="wall">${ICON.wall}Encostar</button>`;
  h += `<button class="x" data-act="close" aria-label="Fechar seleção">${ICON.close}</button>`;
  bar.innerHTML = h;
  bar.hidden = false;
}

function updateHeader() {
  $('#layoutName').textContent = state.layoutName;
}

function planSVG(pos) {
  const d = state.dims;
  const { W, D } = d.room;
  const di = doorInfo(d);
  const m = 16;
  let s = `<svg class="mini" viewBox="${-m} ${-m} ${W + 2 * m} ${D + 2 * m}" style="aspect-ratio:${W + 2 * m}/${D + 2 * m}" aria-hidden="true">`;
  s += `<rect x="0" y="0" width="${W}" height="${D}" fill="#fff" stroke="#4b4447" stroke-width="7"/>`;
  s += `<line x1="${W}" y1="${d.win.offset}" x2="${W}" y2="${d.win.offset + d.win.width}" stroke="${WINDOW_COLOR}" stroke-width="10"/>`;
  s += `<line x1="0" y1="${di.z0}" x2="0" y2="${di.z1}" stroke="#fff" stroke-width="10"/>`;
  s += `<path d="M0 ${di.z0} A${di.r} ${di.r} 0 0 1 ${di.r} ${di.hingeZ} L0 ${di.hingeZ}" fill="none" stroke="${DOOR_COLOR}" stroke-width="3.5"/>`;
  for (const it of ITEMS) {
    const r = footprint(d, it.id, pos[it.id]);
    s += `<rect x="${r.x0.toFixed(1)}" y="${r.z0.toFixed(1)}" width="${(r.x1 - r.x0).toFixed(1)}" height="${(r.z1 - r.z0).toFixed(1)}" rx="3" fill="${it.color}" fill-opacity="${it.wall ? 0.95 : 0.16}" stroke="${it.color}" stroke-width="${it.wall ? 0 : 4}"/>`;
  }
  return s + '</svg>';
}
function scoreHTML(a) {
  if (a.errors) return `<span class="score err">${plural(a.errors, 'conflito')}</span>`;
  if (a.warnings) return `<span class="score warn">${plural(a.warnings, 'aviso')}</span>`;
  return '<span class="score ok">sem avisos</span>';
}
const defaultSaveName = () => `Meu layout ${state.saved.length + 1}`;

function renderLayouts() {
  const list = presetData();
  let h = '<div class="note">📏 As medidas são <b>estimadas</b> pela foto e pelo desenho (a única medida informada foi os 50 cm no pé da cama). Confira com uma trena na aba <a data-goto="dims">Medidas</a> — as sugestões se ajustam sozinhas.</div>';
  h += '<h3 class="sec">Sugestões de layout</h3><div class="cards">';
  for (const { p, pos, a } of list) {
    const on = state.layoutId === p.id;
    h += `<article class="card${on ? ' on' : ''}" data-layout="${p.id}" tabindex="0" role="button" aria-pressed="${on}">
      <div class="card-head">${planSVG(pos)}<div class="card-main">
        <div class="card-top"><span class="pill${p.id === 'atual' ? ' now' : ''}">${p.tag}</span>${scoreHTML(a)}</div>
        <h4>${p.name}</h4><p>${p.desc}</p></div></div>
      <ul class="pc">${p.pros.map((x) => `<li class="pro">${x}</li>`).join('')}${p.cons.map((x) => `<li class="con">${x}</li>`).join('')}</ul>
      <div class="metric">${ICON.space}Maior espaço livre no chão: <b>${fmtM1(a.free.w)} × ${fmtM1(a.free.d)} m</b></div>
    </article>`;
  }
  h += '</div><h3 class="sec">Meus layouts</h3>';
  if (state.saved.length) {
    h += '<div class="saved">' + state.saved.map((s) => `<div class="saved-row${state.layoutId === s.id ? ' on' : ''}">
      <span class="nm" data-load="${s.id}" role="button" tabindex="0">${esc(s.name)}</span>
      <button class="btn sm ghost" data-del="${s.id}" aria-label="Apagar ${esc(s.name)}">${ICON.trash}</button></div>`).join('') + '</div>';
  } else {
    h += '<p class="muted">Mude os móveis de lugar (arrastando no 3D ou na planta) e salve aqui para comparar depois.</p>';
  }
  h += `<form class="saveform" id="saveForm"><input id="saveName" maxlength="40" aria-label="Nome do layout" placeholder="Nome do layout" value="${esc(defaultSaveName())}"><button class="btn primary" type="submit">${ICON.save}Salvar</button></form>`;
  $('#tab-layouts').innerHTML = h;
}

function gapsHTML(id) {
  return selGaps(id).map((g) => {
    const who = g.who ? oaShort(g.who) : 'a parede';
    const tight = g.d > 2 && g.d < 35;
    return `<div class="${tight ? 'tight' : ''}"><small>${ARROW[g.key]} até ${who}</small><b>${g.d < 1.5 ? 'encostado' : `${Math.round(g.d)} cm`}</b></div>`;
  }).join('');
}
const oaShort = (id) => (META[id].g === 'f' ? 'a ' : 'o ') + META[id].low;

function renderItems() {
  const id = state.selected;
  let h = '';
  if (id) {
    const it = META[id];
    const dm = state.dims.items[id];
    const p = state.positions[id];
    h += `<div class="detail"><div class="detail-head"><span class="sw" style="background:${it.color}"></span><h4>${it.name}</h4>${it.fixed ? '<span class="pill now">fixo</span>' : ''}</div>`;
    h += `<div class="size">${dm.w} × ${dm.d} cm · ${it.wall ? `a ${Math.round(p.y ?? 85)} cm do chão` : `${dm.h} cm de altura`}</div>`;
    if (!it.wall) h += `<div class="gaps" id="gapsBox">${gapsHTML(id)}</div>`;
    if (it.fixed) {
      h += '<p class="muted">O armário não sai do lugar — ele é a referência do quarto.</p>';
    } else if (it.wall) {
      h += `<div class="btnrow" style="margin-top:12px"><button class="btn" data-act="up">${ICON.up}Subir</button><button class="btn" data-act="down">${ICON.down}Descer</button></div>`;
      h += '<p class="muted">Arraste a TV para levá-la para outra parede.</p>';
    } else {
      h += `<div class="btnrow"><button class="btn" data-act="rotate">${ICON.rotate}Girar 90°</button><button class="btn" data-act="wall">${ICON.wall}Encostar na parede</button></div>`;
      h += `<div class="nudge"><button class="up" data-nudge="0,-5" aria-label="Mover 5 cm para cima">${ICON.up}</button><button class="lf" data-nudge="-5,0" aria-label="Mover 5 cm para a esquerda">${ICON.left}</button><button class="dn" data-nudge="0,5" aria-label="Mover 5 cm para baixo">${ICON.down}</button><button class="rt" data-nudge="5,0" aria-label="Mover 5 cm para a direita">${ICON.right}</button></div>`;
      h += '<div class="nudge-cap">Ajuste fino de 5 cm (direções da planta)</div>';
    }
    h += '</div>';
  }
  h += '<h3 class="sec">Móveis do quarto</h3><ul class="items">';
  h += ITEMS.map((it) => `<li data-sel="${it.id}" class="${state.selected === it.id ? 'on' : ''}" role="button" tabindex="0"><span class="sw" style="background:${it.color}"></span><span class="nm">${it.name}</span><small>${state.dims.items[it.id].w}×${state.dims.items[it.id].d}</small>${it.fixed ? ICON.lock : ''}</li>`).join('');
  h += `</ul><div class="legend"><span><i style="background:${DOOR_COLOR}"></i>Porta (fixa)</span><span><i style="background:${WINDOW_COLOR}"></i>Janela (fixa)</span></div>`;
  h += `<p class="muted" style="margin-top:14px">${coarse
    ? 'No 3D ou na planta: toque num móvel para selecionar e depois arraste com o dedo.'
    : 'No 3D ou na planta: clique e arraste um móvel. <b>R</b> gira, as <b>setas</b> movem e <b>Esc</b> solta.'}</p>`;
  $('#tab-items').innerHTML = h;
}

const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
function setPath(o, p, v) {
  const ks = p.split('.');
  const last = ks.pop();
  ks.reduce((a, k) => a[k], o)[last] = v;
}
const DIM_GROUPS = [
  { title: 'Quarto', color: '#4b4447', fields: [
    ['room.W', 'Comprimento', 'da parede do armário até a janela', 200, 800],
    ['room.D', 'Largura', 'da parede da cabeceira até a da TV', 180, 700],
    ['room.H', 'Altura do teto', '', 200, 400],
  ] },
  { title: 'Porta', color: DOOR_COLOR, fields: [
    ['door.width', 'Largura da porta', '', 50, 120],
    ['door.gap', 'Distância até a parede da TV', 'do batente até o canto', 0, 300],
    ['door.height', 'Altura da porta', '', 180, 260],
  ] },
  { title: 'Janela', color: WINDOW_COLOR, fields: [
    ['win.offset', 'Distância da parede da cabeceira', 'até onde começa a janela', 0, 600],
    ['win.width', 'Largura da janela', '', 30, 400],
    ['win.sill', 'Altura do peitoril', 'do chão até a janela', 0, 200],
    ['win.height', 'Altura da janela', '', 30, 250],
  ] },
  ...ITEMS.map((it) => ({
    title: it.name,
    color: it.color,
    lock: it.fixed,
    fields: [
      [`items.${it.id}.w`, 'Largura', it.id === 'wardrobe' ? 'ao longo da parede' : it.id === 'bed' ? 'lado da cabeceira' : 'vista de frente', 10, 400],
      ...(it.wall ? [] : [[`items.${it.id}.d`, it.id === 'bed' ? 'Comprimento' : 'Profundidade', it.id === 'bed' ? 'contando a cabeceira' : '', 10, 300]]),
      [`items.${it.id}.h`, it.id === 'bed' ? 'Altura da cabeceira' : 'Altura', '', 10, 300],
    ],
  })),
];
function renderDims() {
  let h = '<div class="note">📏 Valores em centímetros. Os números atuais são <b>estimativas</b> — meça com uma trena e corrija aqui. As sugestões e os avisos se recalculam sozinhos.</div>';
  for (const g of DIM_GROUPS) {
    h += `<fieldset><legend><i style="background:${g.color}"></i>${g.title}${g.lock ? ' (fixo)' : ''}</legend>`;
    for (const [path, label, sub, min, max] of g.fields) {
      h += `<label class="field"><span class="lb">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="in"><input type="number" inputmode="numeric" data-path="${path}" min="${min}" max="${max}" step="1" value="${getPath(state.dims, path)}">cm</span></label>`;
    }
    h += '</fieldset>';
  }
  h += `<button class="btn" id="resetDims" type="button">${ICON.reset}Voltar às medidas estimadas</button>`;
  $('#tab-dims').innerHTML = h;
}

// ---------- ações ----------
const undoStack = [];
const snapshot = () => ({ positions: clone(state.positions), layoutId: state.layoutId, layoutName: state.layoutName });
function pushUndo(s = snapshot()) {
  undoStack.push(s);
  if (undoStack.length > 80) undoStack.shift();
  $('#btnUndo').disabled = false;
}
function undo() {
  const s = undoStack.pop();
  $('#btnUndo').disabled = !undoStack.length;
  if (!s) return;
  state.positions = s.positions;
  state.positions.wardrobe = wardrobePos(state.dims);
  state.layoutId = s.layoutId;
  state.layoutName = s.layoutName;
  startTween();
  refresh();
  renderLayouts();
  updateHeader();
}

function markEdited() {
  if (state.layoutId === 'custom') return;
  state.layoutId = 'custom';
  state.layoutName = state.layoutName.replace(/ \(editado\)$/, '') + ' (editado)';
  updateHeader();
  renderLayouts();
}

function applyLayout(id) {
  const pre = PRESETS.find((p) => p.id === id);
  const sv = state.saved.find((s) => s.id === id);
  if (!pre && !sv) return;
  pushUndo();
  if (pre) {
    state.positions = pre.build(state.dims);
    state.layoutName = pre.name;
  } else {
    state.positions = clone(sv.positions);
    state.layoutName = sv.name;
    clampAll();
  }
  state.positions.wardrobe = wardrobePos(state.dims);
  state.layoutId = id;
  startTween();
  refresh();
  renderLayouts();
  updateHeader();
}

function snapXZ(id, cx, cz, rot, magnet = true) {
  const { W, D } = state.dims.room;
  const { fw, fd } = fsize(state.dims.items[id], rot);
  let x0 = clamp(cx - fw / 2, 0, Math.max(0, W - fw));
  let z0 = clamp(cz - fd / 2, 0, Math.max(0, D - fd));
  if (magnet) {
    const th = 7;
    const xs = [0, W - fw];
    const zs = [0, D - fd];
    for (const it of ITEMS) {
      if (it.id === id || it.wall) continue;
      const o = footprint(state.dims, it.id, state.positions[it.id]);
      const zNear = Math.min(z0 + fd, o.z1) - Math.max(z0, o.z0) > -th;
      const xNear = Math.min(x0 + fw, o.x1) - Math.max(x0, o.x0) > -th;
      if (zNear) xs.push(o.x1, o.x0 - fw, o.x0, o.x1 - fw);
      if (xNear) zs.push(o.z1, o.z0 - fd, o.z0, o.z1 - fd);
    }
    const near = (v, list) => list.reduce((b, c) => (Math.abs(c - v) < Math.abs(b - v) && Math.abs(c - v) < th ? c : b), v);
    x0 = clamp(near(x0, xs), 0, Math.max(0, W - fw));
    z0 = clamp(near(z0, zs), 0, Math.max(0, D - fd));
  }
  x0 = Math.round(x0);
  z0 = Math.round(z0);
  return { x: x0 + fw / 2, z: z0 + fd / 2 };
}
function wallSnap(id, fp, p) {
  const { W, D } = state.dims.room;
  const it = state.dims.items[id];
  const dist = { north: fp.z, south: D - fp.z, west: fp.x, east: W - fp.x };
  const wall = Object.keys(dist).reduce((a, b) => (dist[a] <= dist[b] ? a : b));
  const rot = { north: 0, south: 180, west: 90, east: 270 }[wall];
  const half = it.w / 2;
  if (wall === 'north' || wall === 'south') {
    return { ...p, rot, x: Math.round(clamp(fp.x, half, W - half)), z: wall === 'north' ? it.d / 2 : D - it.d / 2 };
  }
  return { ...p, rot, z: Math.round(clamp(fp.z, half, D - half)), x: wall === 'west' ? it.d / 2 : W - it.d / 2 };
}
function clampAll() {
  for (const it of ITEMS) {
    if (it.fixed) continue;
    const p = state.positions[it.id];
    if (it.wall) state.positions[it.id] = wallSnap(it.id, { x: p.x, z: p.z }, p);
    else Object.assign(p, snapXZ(it.id, p.x, p.z, p.rot, false));
  }
}
function setPos(id, np, animate) {
  state.positions[id] = np;
  markEdited();
  if (animate) startTween();
  else {
    disp[id] = clone(np);
    place(id, np);
  }
  refresh();
}
function backToWall(id, p) {
  const { W, D } = state.dims.room;
  const { fw, fd } = fsize(state.dims.items[id], p.rot);
  switch (norm(p.rot)) {
    case 0: return { z: fd / 2 };
    case 90: return { x: fw / 2 };
    case 180: return { z: D - fd / 2 };
    default: return { x: W - fw / 2 };
  }
}
function act(a) {
  const id = state.selected;
  if (!id) return;
  if (a === 'close') { select(null); return; }
  const it = META[id];
  if (it.fixed) return;
  const p = state.positions[id];
  if (a === 'rotate' && !it.wall) {
    pushUndo();
    const rot = norm(p.rot + 90);
    setPos(id, { ...p, ...snapXZ(id, p.x, p.z, rot, false), rot }, true);
  } else if (a === 'wall' && !it.wall) {
    pushUndo();
    setPos(id, { ...p, ...backToWall(id, p) }, true);
  } else if ((a === 'up' || a === 'down') && it.wall) {
    pushUndo();
    const y = clamp((p.y ?? 85) + (a === 'up' ? 5 : -5), 10, state.dims.room.H - state.dims.items.tv.h - 5);
    setPos(id, { ...p, y }, false);
  }
}
function nudge(dx, dz) {
  const id = state.selected;
  if (!id || META[id].fixed) return;
  pushUndo();
  const p = state.positions[id];
  if (META[id].wall) {
    const { W, D } = state.dims.room;
    const half = state.dims.items.tv.w / 2;
    const r = norm(p.rot);
    const np = { ...p };
    if (r === 0 || r === 180) np.x = clamp(p.x + dx, half, W - half);
    else np.z = clamp(p.z + dz, half, D - half);
    setPos(id, np, false);
  } else {
    setPos(id, { ...p, ...snapXZ(id, p.x + dx, p.z + dz, p.rot, false) }, false);
  }
}
function select(id) {
  id = id || null;
  if (state.selected === id) return;
  state.selected = id;
  updateOverlays();
  updateSelbar();
  renderItems();
  dirty = true;
}

function onDimsChanged() {
  state.positions.wardrobe = wardrobePos(state.dims);
  const pre = PRESETS.find((p) => p.id === state.layoutId);
  if (pre) state.positions = pre.build(state.dims);
  else clampAll();
  undoStack.length = 0;
  $('#btnUndo').disabled = true;
  presetCache = null;
  rebuildAll();
  fitPlan();
  if (!userMoved3d) fit3d();
  refresh();
  renderLayouts();
}

// ---------- arrastar móveis ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitV = new THREE.Vector3();
function setRay(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, CAM[state.view]);
}
function pick(cx, cy) {
  setRay(cx, cy);
  const hits = raycaster.intersectObjects(Object.values(items), true);
  for (const h of hits) {
    const id = h.object.userData.itemId;
    if (id) return id;
  }
  return null;
}
function floorPoint(cx, cy) {
  setRay(cx, cy);
  const p = raycaster.ray.intersectPlane(floorPlane, hitV);
  return p ? { x: p.x * 100, z: p.z * 100 } : null;
}
const isUI = (t) => t.closest('button, .pop, .selbar, .views, .toggles, .hint');

let drag = null;
let down = null;
stage.addEventListener('pointerdown', (e) => {
  if (isUI(e.target)) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  hideHint();
  togglePop(false);
  if (drag) {
    if (e.pointerId !== drag.pid) endDrag(); // segundo dedo: solta o móvel e deixa a câmera agir
    return;
  }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  const id = pick(e.clientX, e.clientY);
  if (!id || META[id].fixed) return;
  if (!(e.pointerType === 'mouse' || state.selected === id)) return;
  const fp = floorPoint(e.clientX, e.clientY);
  if (!fp) return;
  e.stopPropagation();
  e.preventDefault();
  const p = state.positions[id];
  drag = { id, pid: e.pointerId, off: { x: p.x - fp.x, z: p.z - fp.z }, moved: false, sx: e.clientX, sy: e.clientY, snap: snapshot() };
  select(id);
  stage.classList.add('dragging');
  try { stage.setPointerCapture(e.pointerId); } catch { /* ok */ }
}, true);

window.addEventListener('pointermove', (e) => {
  if (drag && e.pointerId === drag.pid) {
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    const fp = floorPoint(e.clientX, e.clientY);
    if (!fp) return;
    if (!drag.moved) {
      drag.moved = true;
      pushUndo(drag.snap);
      markEdited();
      togglePop(false);
    }
    const id = drag.id;
    const p = state.positions[id];
    const np = META[id].wall ? wallSnap(id, fp, p) : { ...p, ...snapXZ(id, fp.x + drag.off.x, fp.z + drag.off.z, p.rot, !e.altKey) };
    state.positions[id] = np;
    disp[id] = clone(np);
    if (tween) tween.to[id] = clone(np);
    place(id, np);
    scheduleRefresh();
    return;
  }
  if (e.pointerType === 'mouse' && !e.buttons && !drag) hoverCheck(e);
});
function endDrag() {
  if (!drag) return;
  const moved = drag.moved;
  try { stage.releasePointerCapture(drag.pid); } catch { /* ok */ }
  drag = null;
  stage.classList.remove('dragging');
  if (moved) refresh();
}
function onUp(e) {
  if (drag && e.pointerId === drag.pid) {
    endDrag();
    down = null;
    return;
  }
  if (down && e.pointerId === down.id && e.type === 'pointerup') {
    const quick = performance.now() - down.t < 600;
    const still = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
    if (quick && still && !isUI(e.target)) select(pick(e.clientX, e.clientY));
  }
  down = null;
}
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

let hoverRaf = 0;
let lastCursor = '';
function hoverCheck(e) {
  if (hoverRaf) return;
  const { clientX, clientY } = e;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    if (drag) return;
    const id = pick(clientX, clientY);
    const c = id ? (META[id].fixed ? 'pointer' : 'grab') : '';
    if (c !== lastCursor) {
      canvas.style.cursor = c;
      lastCursor = c;
    }
  });
}

// ---------- dicas / avisos rápidos ----------
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 2800);
}
let hintT = 0;
function showHint() {
  if (lsGet(HINT_KEY)) return;
  const h = $('#hint');
  h.innerHTML = coarse
    ? 'Toque num móvel para selecionar e depois arraste para mudar de lugar.<br>Um dedo gira a câmera · dois dedos dão zoom.'
    : 'Clique e arraste os móveis para mudar de lugar.<br>Arraste o fundo para girar · roda do mouse dá zoom.';
  h.hidden = false;
  hintT = setTimeout(hideHint, 10000);
}
function hideHint() {
  const h = $('#hint');
  if (h.hidden) return;
  clearTimeout(hintT);
  h.hidden = true;
  lsSet(HINT_KEY, '1');
}

function photo() {
  renderer.setClearColor(0xf7f1ee, 1);
  renderer.render(scene, CAM[state.view]);
  const url = canvas.toDataURL('image/png');
  renderer.setClearColor(0x000000, 0);
  dirty = true;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quarto-daniela.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Imagem salva!');
}

async function share() {
  const r1 = (v) => Math.round(v * 10) / 10;
  const p = {};
  for (const it of ITEMS) {
    const q = state.positions[it.id];
    p[it.id] = { x: r1(q.x), z: r1(q.z), rot: norm(q.rot), ...(q.y !== undefined ? { y: r1(q.y) } : {}) };
  }
  const url = `${location.origin}${location.pathname}#l=${b64e(JSON.stringify({ v: 1, d: state.dims, p, n: state.layoutName }))}`;
  if (navigator.share && coarse) {
    try {
      await navigator.share({ title: 'Quarto da Daniela', text: `Layout: ${state.layoutName}`, url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copiado! Quem abrir vê este mesmo layout.');
  } catch {
    window.prompt('Copie o link deste layout:', url);
  }
}

// ---------- painel ----------
function setTab(t, expand = true) {
  state.tab = t;
  $$('.tabs button').forEach((b) => {
    const on = b.dataset.tab === t;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  for (const k of ['layouts', 'items', 'dims']) $('#tab-' + k).hidden = k !== t;
  if (expand && mobileMQ.matches) panel.classList.add('expanded');
}

function wire() {
  $$('.views button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view, state.view === b.dataset.view)));
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    if (mobileMQ.matches && state.tab === b.dataset.tab && panel.classList.contains('expanded')) panel.classList.remove('expanded');
    else setTab(b.dataset.tab);
  }));
  $('#grab').addEventListener('click', () => panel.classList.toggle('expanded'));
  $('#status').addEventListener('click', () => togglePop());
  $('#statusPop').addEventListener('click', (e) => {
    const b = e.target.closest('.issue[data-ids]');
    if (!b || !b.dataset.ids) return;
    const id = b.dataset.ids.split(',').find((x) => x && !META[x].fixed) || b.dataset.ids.split(',')[0];
    if (id) select(id);
    togglePop(false);
  });
  $('#selbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) act(b.dataset.act);
  });
  $('#tglClear').addEventListener('click', (e) => {
    state.showClear = !state.showClear;
    e.currentTarget.classList.toggle('on', state.showClear);
    e.currentTarget.setAttribute('aria-pressed', String(state.showClear));
    updateOverlays();
    dirty = true;
    save();
  });
  $('#tglLabels').addEventListener('click', (e) => {
    state.showLabels = !state.showLabels;
    e.currentTarget.classList.toggle('on', state.showLabels);
    e.currentTarget.setAttribute('aria-pressed', String(state.showLabels));
    dirty = true;
    save();
  });
  $('#tglClear').classList.toggle('on', state.showClear);
  $('#tglLabels').classList.toggle('on', state.showLabels);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnPhoto').addEventListener('click', photo);
  $('#btnShare').addEventListener('click', share);

  const tl = $('#tab-layouts');
  tl.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) { setTab(go.dataset.goto); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      const s = state.saved.find((x) => x.id === del.dataset.del);
      if (s && window.confirm(`Apagar "${s.name}"?`)) {
        state.saved = state.saved.filter((x) => x !== s);
        renderLayouts();
        save();
      }
      return;
    }
    const ld = e.target.closest('[data-load]');
    if (ld) { applyLayout(ld.dataset.load); return; }
    const card = e.target.closest('[data-layout]');
    if (card) applyLayout(card.dataset.layout);
  });
  tl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest('[data-layout], [data-load]');
    if (!el) return;
    e.preventDefault();
    applyLayout(el.dataset.layout || el.dataset.load);
  });
  tl.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = ($('#saveName').value || '').trim() || defaultSaveName();
    const id = 's' + Date.now().toString(36);
    state.saved.push({ id, name, positions: clone(state.positions) });
    state.layoutId = id;
    state.layoutName = name;
    renderLayouts();
    updateHeader();
    save();
    toast('Layout salvo!');
  });

  const ti = $('#tab-items');
  ti.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sel]');
    if (s) { select(state.selected === s.dataset.sel ? null : s.dataset.sel); return; }
    const a = e.target.closest('[data-act]');
    if (a) { act(a.dataset.act); return; }
    const n = e.target.closest('[data-nudge]');
    if (n) {
      const [dx, dz] = n.dataset.nudge.split(',').map(Number);
      nudge(dx, dz);
    }
  });
  ti.addEventListener('keydown', (e) => {
    const s = e.target.closest('[data-sel]');
    if (s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(s.dataset.sel); }
  });

  const td = $('#tab-dims');
  let dimT = 0;
  const applyInput = (inp, final) => {
    const v = Number(inp.value);
    if (!Number.isFinite(v) || inp.value === '') return;
    const c = clamp(Math.round(v), Number(inp.min), Number(inp.max));
    if (final) inp.value = c;
    if (c !== v && !final) return;
    if (getPath(state.dims, inp.dataset.path) === c) return;
    setPath(state.dims, inp.dataset.path, c);
    onDimsChanged();
  };
  td.addEventListener('input', (e) => {
    const inp = e.target.closest('input[data-path]');
    if (!inp) return;
    clearTimeout(dimT);
    dimT = setTimeout(() => applyInput(inp, false), 600);
  });
  td.addEventListener('change', (e) => {
    const inp = e.target.closest('input[data-path]');
    if (!inp) return;
    clearTimeout(dimT);
    applyInput(inp, true);
  });
  td.addEventListener('click', (e) => {
    if (!e.target.closest('#resetDims')) return;
    state.dims = clone(DEFAULT_DIMS);
    onDimsChanged();
    renderDims();
    toast('Medidas estimadas restauradas');
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.key === 'Escape') { select(null); togglePop(false); return; }
    if (!state.selected) return;
    if (e.key === 'r' || e.key === 'R') { act('rotate'); return; }
    const step = e.shiftKey ? 1 : 5;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[e.key]) {
      e.preventDefault();
      nudge(...map[e.key]);
    }
  });

  new ResizeObserver(resize).observe(stage);
}

// ---------- início ----------
loadState();
rebuildAll();
resize();
setView('3d', true);
state.analysis = analyze(state.dims, state.positions);
renderLayouts();
renderDims();
updateHeader();
refresh();
wire();
requestAnimationFrame(frame);

// para testes no console
window.__quarto = {
  state, applyLayout, setView, select, pick,
  fitDir: (x, y, z) => fit3d(new THREE.Vector3(x, y, z).normalize()),
  screenOf(id) {
    const p = disp[id];
    const r = canvas.getBoundingClientRect();
    v3.set(p.x / 100, (state.view === 'plan' ? 0 : state.dims.items[id].h * 0.6) / 100, p.z / 100).project(CAM[state.view]);
    return { x: r.left + ((v3.x + 1) / 2) * r.width, y: r.top + ((1 - v3.y) / 2) * r.height };
  },
};
