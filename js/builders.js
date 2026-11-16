// Modelos 3D do quarto e dos móveis. Tudo em centímetros.
// Cada móvel tem origem no centro da sua "pegada" no chão, largura no eixo x,
// profundidade no eixo z, costas em -z e frente em +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { doorInfo } from './data.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function screenTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const x = c.getContext('2d');
  const R = rng(kind === 'monitor' ? 3 : 11);
  if (kind === 'monitor') {
    x.fillStyle = '#f3f5f9'; x.fillRect(0, 0, 256, 160);
    x.fillStyle = '#dde3ec'; x.fillRect(0, 0, 256, 12);
    for (let i = 0; i < 9; i++) { x.fillStyle = '#c3cad6'; x.fillRect(10, 24 + i * 13, 20 + R() * 25, 4); }
    x.fillStyle = '#1f2a44'; x.fillRect(66, 26, 176, 112);
    const cols = ['#7fd1ff', '#ffd479', '#c39bff', '#9be7a0', '#ff9db0', '#e5e9f0'];
    for (let i = 0; i < 12; i++) {
      let px = 74 + (i % 3) * 8;
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const w = 12 + R() * 40;
        x.fillStyle = cols[Math.floor(R() * cols.length)];
        x.fillRect(px, 32 + i * 8.6, w, 3.6);
        px += w + 5;
      }
    }
  } else {
    x.fillStyle = '#0d2b63'; x.fillRect(0, 0, 256, 160);
    for (let i = 0; i < 14; i++) {
      x.fillStyle = i % 4 === 0 ? '#ffffff' : '#8fb8ff';
      x.fillRect(10, 10 + i * 10.5, 30 + R() * 160, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let floorTex = null;
function floorTexture() {
  if (floorTex) return floorTex;
  const c = document.createElement('canvas');
  c.width = 1024; // 240 cm
  c.height = 512; // 120 cm -> 6 tábuas de 20 cm
  const x = c.getContext('2d');
  const R = rng(7);
  const rows = 6;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let px = -R() * 300;
    while (px < 1024) {
      const len = 300 + R() * 260;
      const base = [178 + R() * 24 - 12, 124 + R() * 20 - 10, 82 + R() * 16 - 8].map(Math.round);
      x.fillStyle = `rgb(${base})`;
      x.fillRect(px, r * rh, len, rh);
      for (let k = 0; k < 16; k++) {
        x.strokeStyle = R() < 0.55 ? `rgba(95,58,32,${0.05 + R() * 0.09})` : `rgba(226,186,146,${0.05 + R() * 0.08})`;
        x.lineWidth = 0.8 + R() * 1.6;
        x.beginPath();
        const y0 = r * rh + 3 + R() * (rh - 6);
        x.moveTo(px, y0);
        for (let s = 1; s <= 10; s++) x.lineTo(px + (len * s) / 10, y0 + Math.sin(s * 0.8 + k) * R() * 2.5);
        x.stroke();
      }
      x.fillStyle = 'rgba(64,38,22,.5)';
      x.fillRect(Math.max(0, px), r * rh, 2, rh);
      px += len;
    }
    x.fillStyle = 'rgba(64,38,22,.45)';
    x.fillRect(0, r * rh, 1024, 2);
    x.fillRect(0, r * rh, 2, rh);
  }
  floorTex = new THREE.CanvasTexture(c);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.anisotropy = 8;
  return floorTex;
}

export const MAT = {
  wall: std(0xf0ece6, { roughness: 0.95 }),
  ceiling: std(0xf7f5f2, { roughness: 1 }),
  trim: std(0xfbfaf8, { roughness: 0.6 }),
  white: std(0xf4f3f0, { roughness: 0.5 }),
  whiteSoft: std(0xe9e7e2, { roughness: 0.55 }),
  cubby: std(0xd9d6cf, { roughness: 0.7 }),
  backPanel: std(0xe6e2db, { roughness: 0.9 }),
  stub: std(0x4b4447, { roughness: 0.9 }),
  windowStub: std(0x9fd0f0, { roughness: 0.4 }),
  headboard: std(0x2c2528, { roughness: 0.75 }),
  bedBase: std(0xdcd2cc, { roughness: 1 }),
  mattress: std(0xf6f2ee, { roughness: 1 }),
  duvet: std(0xd3be9f, { roughness: 1 }),
  throw: std(0xe9b9c4, { roughness: 1 }),
  pillowPink: std(0xf2b7c5, { roughness: 1 }),
  pillowCream: std(0xe8dbc9, { roughness: 1 }),
  black: std(0x1d1c20, { roughness: 0.45 }),
  fabricBlack: std(0x2a2a30, { roughness: 1 }),
  mesh: std(0x34343b, { roughness: 1 }),
  keyboard: std(0x2b2b31, { roughness: 0.6 }),
  laptop: std(0x3a3d44, { roughness: 0.4, metalness: 0.3 }),
  metal: std(0xb9bcc2, { roughness: 0.35, metalness: 0.8 }),
  doorWood: std(0x5c3523, { roughness: 0.32 }),
  wardrobe: std(0xe8dfd3, { roughness: 0.55 }),
  wardrobeDoor: std(0xefe8de, { roughness: 0.45 }),
  wardrobeDark: std(0xcfc4b6, { roughness: 0.7 }),
  tvScreen: std(0x0b0f17, { roughness: 0.12, metalness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xcfe6f5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
  curtain: std(0xa9afb6, { roughness: 1, side: THREE.DoubleSide }),
  dog: std(0xd9b17f, { roughness: 1 }),
  dogDark: std(0xb98955, { roughness: 1 }),
  lampShade: std(0xfff6e8, { emissive: 0xffe0a8, emissiveIntensity: 0.45, side: THREE.DoubleSide }),
  lampCeil: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.4 }),
  sky: new THREE.MeshBasicMaterial({ color: 0xd4e8f8 }),
  book: std(0xffffff, { roughness: 0.75 }),
  redBox: std(0xc8343a, { roughness: 0.6 }),
  helmet: std(0xf6f6f6, { roughness: 0.2 }),
  visor: std(0x15171c, { roughness: 0.08, metalness: 0.4 }),
  photo: std(0xd9c6b0, { roughness: 0.6 }),
  leaf: std(0x5f8f4e, { roughness: 0.9 }),
  flowerA: std(0xf4a6b8, { roughness: 0.8 }),
  flowerB: std(0xfff1e0, { roughness: 0.8 }),
  vase: std(0xdfeef0, { roughness: 0.1, transparent: true, opacity: 0.6 }),
  mug: std(0xf2f0ec, { roughness: 0.3 }),
  monitor: new THREE.MeshBasicMaterial({ map: screenTexture('monitor') }),
  laptopScreen: new THREE.MeshBasicMaterial({ map: screenTexture('laptop') }),
};

// ---------- helpers ----------
export function box(g, w, h, d, x, y, z, m, o = {}) {
  let geo;
  if (o.r > 0) {
    const r = Math.min(o.r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
    geo = new RoundedBoxGeometry(w, h, d, o.seg || 2, r);
  } else {
    geo = new THREE.BoxGeometry(w, h, d);
  }
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = o.cast !== false;
  mesh.receiveShadow = o.recv !== false;
  g.add(mesh);
  return mesh;
}

function cyl(g, rt, rb, h, x, y, z, m, o = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 20, 1, !!o.open), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = o.cast !== false;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

function sph(g, r, x, y, z, m, s = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  mesh.position.set(x, y, z);
  mesh.scale.set(...s);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

function cap(r, len, m) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Segmentos de [a, b] sem as aberturas dadas.
function segments(a, b, holes) {
  const out = [];
  let cur = a;
  for (const h of [...holes].sort((p, q) => p.u0 - q.u0)) {
    if (h.u0 > cur) out.push([cur, h.u0]);
    cur = Math.max(cur, h.u1);
  }
  if (b > cur) out.push([cur, b]);
  return out;
}

// ---------- quarto ----------
export function buildRoom(dims) {
  const { W, D, H } = dims.room;
  const door = doorInfo(dims);
  const win = dims.win;
  const root = new THREE.Group();

  // chão de madeira
  const tex = floorTexture();
  const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  floorMat.map = tex.clone();
  floorMat.map.needsUpdate = true;
  floorMat.map.repeat.set(W / 240, D / 120);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  floor.receiveShadow = true;
  root.add(floor);

  // paredes: plano interno + rodapé + moldura de gesso; "stub" = parede cortada (vista de fora/planta)
  const T = 12;
  const defs = {
    north: { len: W, pos: [0, 0, 0], rot: 0, ext: true },
    south: { len: W, pos: [W, 0, D], rot: Math.PI, ext: true },
    west: { len: D, pos: [0, 0, D], rot: Math.PI / 2, ext: false },
    east: { len: D, pos: [W, 0, 0], rot: -Math.PI / 2, ext: false },
  };
  const walls = {};
  for (const [name, df] of Object.entries(defs)) {
    const g = new THREE.Group();
    g.position.set(...df.pos);
    g.rotation.y = df.rot;
    const full = new THREE.Group();
    const stub = new THREE.Group();
    g.add(full, stub);
    const openings = [];
    if (name === 'west') openings.push({ type: 'door', u0: D - door.z1, u1: D - door.z0, v0: 0, v1: dims.door.height });
    if (name === 'east') openings.push({ type: 'win', u0: win.offset, u1: win.offset + win.width, v0: win.sill, v1: win.sill + win.height });
    const doors = openings.filter((o) => o.type === 'door');

    full.add(wallMesh(df.len, H, openings));
    for (const [a, b] of segments(0, df.len, doors)) box(full, b - a, 7, 1.5, (a + b) / 2, 0, 0.75, MAT.trim, { cast: false });
    box(full, df.len, 6, 4, df.len / 2, H - 6, 2, MAT.trim, { cast: false });
    const e0 = df.ext ? -T : 0;
    const e1 = df.ext ? df.len + T : df.len;
    box(full, e1 - e0, 1.5, T, (e0 + e1) / 2, H, -T / 2, MAT.stub, { cast: false });
    // espessura da parede nas pontas (aparece quando a parede vizinha está escondida)
    if (df.ext) {
      box(full, T, H, T, -T / 2, 0, -T / 2, MAT.stub, { cast: false });
      box(full, T, H, T, df.len + T / 2, 0, -T / 2, MAT.stub, { cast: false });
    } else {
      box(full, 1, H, T - 0.6, 0.5, 0, -T / 2, MAT.stub, { cast: false });
      box(full, 1, H, T - 0.6, df.len - 0.5, 0, -T / 2, MAT.stub, { cast: false });
    }

    const wins = openings.filter((o) => o.type === 'win');
    for (const [a, b] of segments(e0, e1, [...doors, ...wins])) box(stub, b - a, 10, T, (a + b) / 2, 0, -T / 2, MAT.stub, { cast: false });
    for (const w of wins) box(stub, w.u1 - w.u0, 10.5, 4, (w.u0 + w.u1) / 2, 0, -T / 2, MAT.windowStub, { cast: false });

    for (const o of openings) {
      if (o.type === 'win') addWindow(full, o, H);
      else addDoorFrame(full, o);
    }
    walls[name] = { group: g, full, stub };
    root.add(g);
  }

  // folha da porta (sempre visível), aberta ~75°
  const leafW = dims.door.width - 2;
  const pivot = new THREE.Group();
  pivot.position.set(1.8, 0, door.z1 - 1);
  box(pivot, 3.5, dims.door.height - 1, leafW, 0, 0.5, -leafW / 2, MAT.doorWood);
  for (const s of [-1, 1]) {
    sph(pivot, 2.2, s * 4.5, 100, -leafW + 6, MAT.metal);
    box(pivot, 3, 2, 1.5, s * 2.6, 99, -leafW + 6, MAT.metal, { cast: false });
  }
  pivot.rotation.y = -THREE.MathUtils.degToRad(75);
  root.add(pivot);

  // arco de abertura da porta no chão
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * (Math.PI / 2);
    pts.push(new THREE.Vector3(Math.sin(t) * door.r, 0.6, door.hingeZ - Math.cos(t) * door.r));
  }
  pts.push(new THREE.Vector3(0, 0.6, door.hingeZ));
  const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xc89200, dashSize: 5, gapSize: 4 }));
  arc.computeLineDistances();
  root.add(arc);

  // teto + luminária (só aparece na vista da porta)
  const ceiling = new THREE.Group();
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT.ceiling);
  cm.rotation.x = Math.PI / 2;
  cm.position.set(W / 2, H, D / 2);
  ceiling.add(cm);
  cyl(ceiling, 19, 19, 3, W / 2, H - 3, D / 2, MAT.lampCeil, { cast: false, seg: 32 });
  root.add(ceiling);

  return { root, walls, ceiling, floorMat, doorLeaf: pivot };
}

function wallMesh(len, H, openings) {
  const s = new THREE.Shape();
  const door = openings.find((o) => o.type === 'door');
  s.moveTo(0, 0);
  if (door) {
    s.lineTo(door.u0, 0);
    s.lineTo(door.u0, door.v1);
    s.lineTo(door.u1, door.v1);
    s.lineTo(door.u1, 0);
  }
  s.lineTo(len, 0);
  s.lineTo(len, H);
  s.lineTo(0, H);
  s.lineTo(0, 0);
  for (const o of openings) {
    if (o.type !== 'win') continue;
    const p = new THREE.Path();
    p.moveTo(o.u0, o.v0);
    p.lineTo(o.u0, o.v1);
    p.lineTo(o.u1, o.v1);
    p.lineTo(o.u1, o.v0);
    p.lineTo(o.u0, o.v0);
    s.holes.push(p);
  }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), MAT.wall);
  m.receiveShadow = true;
  return m;
}

function addDoorFrame(g, o) {
  const h = o.v1;
  box(g, 6, h + 6, 16, o.u0 - 3, 0, -4, MAT.trim);
  box(g, 6, h + 6, 16, o.u1 + 3, 0, -4, MAT.trim);
  box(g, o.u1 - o.u0, 6, 16, (o.u0 + o.u1) / 2, h, -4, MAT.trim);
}

function addWindow(g, o, H) {
  const fw = 5;
  const w = o.u1 - o.u0;
  const h = o.v1 - o.v0;
  const cu = (o.u0 + o.u1) / 2;
  box(g, fw, h, 12, o.u0 + fw / 2, o.v0, -4, MAT.trim, { cast: false });
  box(g, fw, h, 12, o.u1 - fw / 2, o.v0, -4, MAT.trim, { cast: false });
  box(g, w, fw, 12, cu, o.v1 - fw, -4, MAT.trim, { cast: false });
  box(g, w + 10, 3, 14, cu, o.v0 - 3, 2, MAT.trim, { cast: false });
  box(g, 3, h - 2 * fw, 4, cu, o.v0 + fw, -6, MAT.trim, { cast: false });
  box(g, w - 2 * fw, 2.5, 4, cu, o.v0 + fw - 2.5, -6, MAT.trim, { cast: false });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * fw, h - 2 * fw), MAT.glass);
  glass.position.set(cu, o.v0 + h / 2, -7);
  g.add(glass);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(w + 30, h + 16), MAT.sky);
  sky.position.set(cu, o.v0 + h / 2, -18);
  g.add(sky);

  // varão, argolas e cortinas cinza (como na foto)
  const rodY = Math.min(H - 12, o.v1 + 20);
  const rodLen = w + 56;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, rodLen, 10), MAT.trim);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(cu, rodY, 9);
  g.add(rod);
  const pw = 44;
  const bottom = Math.max(55, o.v0 - 22);
  const ph = rodY - 3 - bottom;
  for (const side of [-1, 1]) {
    const pc = side < 0 ? o.u0 - 28 + pw / 2 : o.u1 + 28 - pw / 2;
    const geo = new THREE.PlaneGeometry(pw, ph, 36, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      pos.setZ(i, Math.sin(((u + pw / 2) / pw) * Math.PI * 2 * 5) * 2.6);
    }
    geo.computeVertexNormals();
    const panel = new THREE.Mesh(geo, MAT.curtain);
    panel.position.set(pc, bottom + ph / 2, 9);
    panel.castShadow = true;
    panel.receiveShadow = true;
    g.add(panel);
    for (let k = 0; k < 6; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.55, 6, 14), MAT.trim);
      ring.position.set(pc - pw / 2 + 3 + (k * (pw - 6)) / 5, rodY - 0.5, 9);
      g.add(ring);
    }
  }
}

// ---------- móveis ----------
export function buildItem(id, dim) {
  switch (id) {
    case 'wardrobe': return buildWardrobe(dim);
    case 'bed': return buildBed(dim);
    case 'nightstand': return buildNightstand(dim);
    case 'bookshelf': return buildBookshelf(dim);
    case 'desk': return buildDesk(dim);
    case 'tv': return buildTV(dim);
    default: return new THREE.Group();
  }
}

function buildWardrobe({ w, d, h }) {
  const g = new THREE.Group();
  box(g, w, h, d - 2.2, 0, 0, -1.1, MAT.wardrobe);
  box(g, w - 2, 8, 2, 0, 0, d / 2 - 3, MAT.wardrobeDark, { cast: false });
  const n = Math.max(2, Math.round(w / 55));
  const dw = w / n;
  const split = h - 48;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + dw * (i + 0.5);
    box(g, dw - 0.8, split - 9, 2, cx, 8, d / 2 - 1, MAT.wardrobeDoor, { r: 0.4 });
    box(g, dw - 0.8, h - split - 2.5, 2, cx, split + 0.8, d / 2 - 1, MAT.wardrobeDoor, { r: 0.4 });
    const hx = cx + (i % 2 === 0 ? dw / 2 - 6 : -dw / 2 + 6);
    box(g, 1.4, 30, 2, hx, 92, d / 2 + 1, MAT.metal, { cast: false });
    box(g, 12, 1.4, 2, cx, split + 6, d / 2 + 1, MAT.metal, { cast: false });
  }
  return g;
}

function buildBed({ w, d, h }) {
  const g = new THREE.Group();
  const hb = 7;
  const zb = -d / 2;
  const bl = d - hb;
  const bz = zb + hb + bl / 2;
  box(g, w, h, hb, 0, 0, zb + hb / 2, MAT.headboard, { r: 1.5 });
  box(g, w - 2, 32, bl - 1, 0, 0, bz, MAT.bedBase, { r: 1 });
  box(g, w - 4, 24, bl - 4, 0, 30, bz, MAT.mattress, { r: 5 });
  const pz = zb + hb + 24;
  const p1 = box(g, w / 2 - 9, 14, 40, -w / 4 + 1, 52, pz, MAT.pillowPink, { r: 6, seg: 3 });
  p1.rotation.x = -0.18;
  const p2 = box(g, w / 2 - 9, 14, 40, w / 4 - 1, 52, pz + 2, MAT.pillowCream, { r: 6, seg: 3 });
  p2.rotation.x = -0.15;
  const dl = bl - 52;
  box(g, w + 5, 11, dl, 0, 45, zb + hb + 52 + dl / 2 - 1, MAT.duvet, { r: 5, seg: 3 });
  box(g, w + 6, 4, 32, 0, 55.5, zb + d - 48, MAT.throw, { r: 1.8 });
  const dog = buildDog();
  dog.position.set(-w / 2 + 42, 57, zb + d - 62);
  dog.rotation.y = -0.4;
  dog.scale.setScalar(0.95);
  g.add(dog);
  return g;
}

function buildDog() {
  const g = new THREE.Group();
  const F = MAT.dog;
  const Dk = MAT.dogDark;
  const B = MAT.black;
  const body = cap(10, 26, F);
  body.rotation.z = Math.PI / 2;
  body.position.set(-2, 9, 0);
  g.add(body);
  sph(g, 10.5, 13, 11, 0, F, [1, 1.05, 1]);
  sph(g, 7.8, 24, 20, 0, F, [1.1, 0.95, 0.95]);
  const snout = cap(3.7, 5, F);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(31.5, 17.5, 0);
  g.add(snout);
  sph(g, 1.7, 36.8, 18.3, 0, B);
  sph(g, 1.2, 29.6, 21.8, 3.6, B);
  sph(g, 1.2, 29.6, 21.8, -3.6, B);
  for (const s of [-1, 1]) {
    const ear = sph(g, 4, 20.5, 26, s * 5.6, Dk, [0.55, 1.15, 0.9]);
    ear.rotation.x = s * 0.55;
    ear.rotation.z = 0.5;
    const leg = cap(2.8, 13, F);
    leg.rotation.z = Math.PI / 2;
    leg.position.set(27, 3, s * 5.6);
    g.add(leg);
    sph(g, 3, 35, 3, s * 5.6, F, [1.3, 0.8, 1]);
    sph(g, 6.6, -14, 6, s * 8, F, [1.4, 0.9, 0.7]);
  }
  const tail = cap(1.8, 16, Dk);
  tail.rotation.set(0, 0.7, Math.PI / 2);
  tail.position.set(-28, 3, 6);
  g.add(tail);
  return g;
}

function buildNightstand({ w, d, h }) {
  const g = new THREE.Group();
  box(g, w, h - 2, d - 1, 0, 0, -0.5, MAT.white, { r: 0.6 });
  box(g, w + 1, 2, d, 0, h - 2, 0, MAT.white, { r: 0.6 });
  const fh = (h - 8) / 2;
  for (let k = 0; k < 2; k++) {
    const y = 3 + k * fh;
    box(g, w - 3, fh - 1.5, 1, 0, y + 0.75, d / 2 - 0.3, MAT.whiteSoft, { r: 0.4 });
    sph(g, 1.3, 0, y + fh / 2, d / 2 + 1, MAT.metal);
  }
  // abajur
  const lx = -w / 4;
  const lz = -d / 6;
  cyl(g, 5, 6, 2, lx, h, lz, MAT.white);
  cyl(g, 0.7, 0.7, 20, lx, h + 2, lz, MAT.metal);
  cyl(g, 6, 9, 14, lx, h + 18, lz, MAT.lampShade, { open: true, seg: 24 });
  // vaso com flores
  const vx = w / 4;
  cyl(g, 3.5, 3, 12, vx, h, 2, MAT.vase);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    cyl(g, 0.3, 0.3, 10, vx + Math.cos(a) * 1.5, h + 10, 2 + Math.sin(a) * 1.5, MAT.leaf, { cast: false, seg: 5 });
    sph(g, 2.4, vx + Math.cos(a) * 3, h + 21 + (i % 2) * 2, 2 + Math.sin(a) * 3, i % 2 ? MAT.flowerB : MAT.flowerA);
  }
  return g;
}

const BOOK_COLORS = ['#1f3a5f', '#2d5a3d', '#7a1f2b', '#1d1d1f', '#c9a227', '#ece6da', '#9c2f2f', '#3f4e8c', '#5b3a6e', '#2f6f73', '#d46a3a', '#14532d', '#8b5e34', '#26324a'];

function buildBookshelf({ w, d, h }) {
  const g = new THREE.Group();
  const t = 2;
  const pl = 6;
  box(g, t, h, d, -w / 2 + t / 2, 0, 0, MAT.white);
  box(g, t, h, d, w / 2 - t / 2, 0, 0, MAT.white);
  box(g, w, t, d, 0, h - t, 0, MAT.white);
  box(g, w - 2 * t, pl, d - 3, 0, 0, -1.5, MAT.whiteSoft);
  box(g, w - 2 * t, h - pl - t, 0.8, 0, pl, -d / 2 + 0.4, MAT.backPanel, { cast: false });
  const n = Math.max(3, Math.round((h - pl - t) / 34));
  const ch = (h - pl - t) / n;
  for (let k = 0; k < n; k++) box(g, w - 2 * t, t, d - 1.5, 0, pl + k * ch, 0.5, MAT.white);

  const R = rng(42);
  const inner = w - 2 * t - 1;
  const books = [];
  for (let k = 0; k < n; k++) {
    const y0 = pl + k * ch + t;
    const ah = ch - t - 1.5;
    if (k === 0) {
      box(g, inner * 0.46, Math.min(ah, 20), d - 7, -inner / 4, y0, 1, MAT.redBox, { r: 0.6 });
      box(g, inner * 0.4, Math.min(ah, 16), d - 9, inner / 4 + 2, y0, 1, MAT.whiteSoft, { r: 0.6 });
      continue;
    }
    let x = -inner / 2 + 0.5;
    const fill = 0.75 + R() * 0.22;
    while (x < -inner / 2 + inner * fill) {
      const bw = 2 + R() * 3.2;
      if (x + bw > inner / 2) break;
      const bh = Math.min(ah - 0.5, ah * (0.62 + R() * 0.33));
      const bd = Math.min(d - 6, 15 + R() * 8);
      books.push({ x: x + bw / 2, y: y0 + bh / 2, z: d / 2 - 3 - bd / 2, w: bw, h: bh, d: bd, c: BOOK_COLORS[Math.floor(R() * BOOK_COLORS.length)] });
      x += bw + (R() < 0.08 ? 3 : 0.15);
    }
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.book, books.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  books.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    im.setMatrixAt(i, m4);
    im.setColorAt(i, col.set(b.c));
  });
  im.castShadow = true;
  im.receiveShadow = true;
  g.add(im);

  // capacete e porta-retrato em cima (como na foto)
  if (w >= 40) {
    const hx = -w / 2 + 20;
    sph(g, 12, hx, h + 11.5, 0, MAT.helmet, [1, 0.95, 1.12]);
    sph(g, 11.4, hx, h + 12.5, 3.2, MAT.visor, [0.9, 0.5, 1.08]);
    const fr = box(g, 18, 14, 2, w / 2 - 14, h, -d / 2 + 7, MAT.black);
    fr.rotation.x = -0.15;
    const ph = box(g, 15, 11, 0.4, w / 2 - 14, h + 1.6, -d / 2 + 8.3, MAT.photo, { cast: false });
    ph.rotation.x = -0.15;
  }
  return g;
}

function buildDesk({ w, d, h }) {
  const g = new THREE.Group();
  const t = 3;
  box(g, w, t, d, 0, h - t, 0, MAT.white, { r: 0.6 });
  box(g, 2.5, h - t, d - 2, -w / 2 + 1.25, 0, 0, MAT.white);
  box(g, 2.5, h - t, d - 2, w / 2 - 1.25, 0, 0, MAT.white);
  box(g, w - 5, 28, 1.5, 0, h - t - 28, -d / 2 + 4, MAT.whiteSoft);

  // gaveteiro com rodinhas
  const uw = Math.min(40, w * 0.33);
  const uh = h - t - 14;
  const ud = Math.min(45, d - 8);
  const ux = w / 2 - 2.5 - uw / 2 - 1.5;
  const uz = d / 2 - 4 - ud / 2;
  box(g, uw, uh, ud, ux, 4, uz, MAT.white, { r: 0.5 });
  const dh = (uh - 4) / 3;
  for (let i = 0; i < 3; i++) {
    const yy = 6 + i * dh;
    box(g, uw - 2.5, dh - 1.2, 1, ux, yy, uz + ud / 2 + 0.2, i === 2 ? MAT.cubby : MAT.whiteSoft, { cast: false });
    if (i < 2) box(g, 10, 1.2, 1.2, ux, yy + dh - 7, uz + ud / 2 + 1, MAT.metal, { cast: false });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) sph(g, 2, ux + sx * (uw / 2 - 4), 2, uz + sz * (ud / 2 - 4), MAT.black);

  // monitor + teclado
  const mx = -w * 0.12;
  const mz = -d / 2 + 12;
  box(g, 20, 1.2, 13, mx, h, mz, MAT.black);
  box(g, 4, 16, 2, mx, h + 1.2, mz - 2, MAT.black);
  const sw = Math.min(56, w * 0.48);
  const sh = sw * 0.58;
  box(g, sw + 2, sh + 2, 2.4, mx, h + 12, mz + 0.5, MAT.black);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), MAT.monitor);
  scr.position.set(mx, h + 13 + sh / 2, mz + 1.75);
  g.add(scr);
  box(g, 38, 1.6, 12, mx, h, mz + 22, MAT.keyboard, { r: 0.5 });

  // notebook
  const lx = w / 2 - 24;
  box(g, 32, 1.6, 22, lx, h, 0, MAT.laptop, { r: 0.6 });
  const piv = new THREE.Group();
  piv.position.set(lx, h + 1.6, -11);
  piv.rotation.x = -0.3;
  g.add(piv);
  box(piv, 32, 21, 0.9, 0, 0, 0, MAT.laptop);
  const ls = new THREE.Mesh(new THREE.PlaneGeometry(29, 18), MAT.laptopScreen);
  ls.position.set(0, 10.8, 0.5);
  piv.add(ls);

  // caneca e porta-lápis
  cyl(g, 4, 4, 9, -w / 2 + 10, h, 13, MAT.mug);
  cyl(g, 3.6, 3.6, 10, w / 2 - 7, h, -d / 2 + 8, MAT.white);
  const pc = [MAT.redBox, MAT.leaf, MAT.flowerA, MAT.black];
  for (let i = 0; i < 4; i++) {
    const p = cyl(g, 0.45, 0.45, 15, w / 2 - 7 + (i - 1.5) * 1.3, h + 2, -d / 2 + 8 + ((i % 2) - 0.5) * 1.4, pc[i], { seg: 6, cast: false });
    p.rotation.z = (i - 1.5) * 0.08;
  }

  const chair = buildChair();
  chair.position.set(mx + 4, 0, d / 2 + 24);
  chair.rotation.y = Math.PI + 0.18;
  g.add(chair);
  return g;
}

function buildChair() {
  const g = new THREE.Group();
  const K = MAT.black;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 26).translate(0, 0, 13), K);
    leg.position.y = 5;
    leg.rotation.y = a;
    leg.castShadow = true;
    g.add(leg);
    sph(g, 2.4, Math.sin(a) * 26, 2.4, Math.cos(a) * 26, K);
  }
  cyl(g, 2.2, 2.2, 32, 0, 5, 0, MAT.metal);
  box(g, 48, 7, 46, 0, 37, 0, MAT.fabricBlack, { r: 3 });
  const back = new THREE.Group();
  back.position.set(0, 44, -21);
  back.rotation.x = -0.12;
  g.add(back);
  box(back, 44, 50, 3.5, 0, 9, 0, MAT.mesh, { r: 1.5 });
  box(back, 6, 16, 2.5, 0, -6, -1, K);
  for (const s of [-1, 1]) {
    box(g, 2.5, 16, 2.5, s * 23, 44, -4, K);
    box(g, 5, 2.2, 24, s * 23, 60, -2, K, { r: 1 });
  }
  return g;
}

function buildTV({ w, d, h }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  g.userData.body = body;
  box(body, 14, Math.min(22, h * 0.5), 2.8, 0, h / 2 - 10, -d / 2 + 1.4, MAT.black, { cast: false });
  box(body, w, h, 3.2, 0, 0, d / 2 - 1.6, MAT.black, { r: 0.6 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.6, h - 1.6), MAT.tvScreen);
  s.position.set(0, h / 2, d / 2 + 0.05);
  body.add(s);
  return g;
}

export function setTVElevation(g, y) {
  if (g.userData.body) g.userData.body.position.y = y;
}
