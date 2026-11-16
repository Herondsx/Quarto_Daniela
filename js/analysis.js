// Análise do layout: sobreposições, porta, janela, espaço de uso e passagens.
import { ITEMS, META, CHAIR_W, chairOffset, doorInfo, fsize, norm, oa } from './data.js';

export function footprint(dims, id, p) {
  const { fw, fd } = fsize(dims.items[id], p.rot);
  return { x0: p.x - fw / 2, x1: p.x + fw / 2, z0: p.z - fd / 2, z1: p.z + fd / 2 };
}

export function frontDir(rot) {
  switch (norm(rot)) {
    case 0: return [0, 1];
    case 90: return [1, 0];
    case 180: return [0, -1];
    default: return [-1, 0];
  }
}

// parede onde ficam as costas do móvel
export function backWall(rot) {
  return { 0: 'north', 90: 'west', 180: 'south', 270: 'east' }[norm(rot)];
}

export function frontZone(r, rot, c) {
  switch (norm(rot)) {
    case 0: return { x0: r.x0, x1: r.x1, z0: r.z1, z1: r.z1 + c };
    case 90: return { x0: r.x1, x1: r.x1 + c, z0: r.z0, z1: r.z1 };
    case 180: return { x0: r.x0, x1: r.x1, z0: r.z0 - c, z1: r.z0 };
    default: return { x0: r.x0 - c, x1: r.x0, z0: r.z0, z1: r.z1 };
  }
}

const overlap = (a, b) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
const clip = (r, W, D) => ({ x0: Math.max(0, r.x0), x1: Math.min(W, r.x1), z0: Math.max(0, r.z0), z1: Math.min(D, r.z1) });
const distPtRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

function frontGap(r, rot, o) {
  switch (norm(rot)) {
    case 0: return o.z0 - r.z1;
    case 90: return o.x0 - r.x1;
    case 180: return r.z0 - o.z1;
    default: return r.x0 - o.x1;
  }
}

// Parte da frente da mesa usada pela cadeira (em coordenadas do quarto).
function chairSpan(dims, r, rot) {
  const w = dims.items.desk.w;
  const half = Math.min(w, CHAIR_W) / 2;
  const co = chairOffset(w);
  const a = Math.max(-w / 2, co - half);
  const b = Math.min(w / 2, co + half);
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  switch (norm(rot)) {
    case 0: return { ...r, x0: cx + a, x1: cx + b };
    case 180: return { ...r, x0: cx - b, x1: cx - a };
    case 90: return { ...r, z0: cz - b, z1: cz - a };
    default: return { ...r, z0: cz + a, z1: cz + b };
  }
}

const DIRS = { E: ['x', 1], W: ['x', -1], S: ['z', 1], N: ['z', -1] };

// Distância livre a partir de um lado do retângulo até a parede ou o próximo móvel.
export function gapDir(r, key, others, W, D) {
  const [ax, s] = DIRS[key];
  const pa = ax === 'x' ? 'z' : 'x';
  const lo = r[pa + '0'];
  const hi = r[pa + '1'];
  const edge = s > 0 ? r[ax + '1'] : r[ax + '0'];
  const lim = ax === 'x' ? W : D;
  let best = s > 0 ? lim - edge : edge;
  let who = null;
  let mlo = lo;
  let mhi = hi;
  for (const [k, o] of others) {
    if (o[pa + '0'] >= hi - 0.5 || o[pa + '1'] <= lo + 0.5) continue;
    const g = s > 0 ? o[ax + '0'] - edge : edge - o[ax + '1'];
    if (g < -0.5) continue;
    if (g < best) {
      best = Math.max(0, g);
      who = k;
      mlo = Math.max(lo, o[pa + '0']);
      mhi = Math.min(hi, o[pa + '1']);
    }
  }
  best = Math.max(0, best);
  const m = (mlo + mhi) / 2;
  const a = ax === 'x' ? [edge, m] : [m, edge];
  const b = ax === 'x' ? [edge + s * best, m] : [m, edge + s * best];
  return { key, d: best, who, a, b };
}

// Altura do móvel encostado numa parede (a cama só é alta na cabeceira).
function heightAt(dims, id, rot, wall) {
  const it = dims.items[id];
  if (id === 'bed') return backWall(rot) === wall ? it.h : 60;
  return it.h;
}

// Grade 2,5 cm; passagem mínima de 40 cm (raio 20).
function reachability(dims, R, floorIds, door) {
  const { W, D } = dims.room;
  const cs = 2.5;
  const rad = 20;
  const nx = Math.ceil(W / cs);
  const nz = Math.ceil(D / cs);
  const free = new Uint8Array(nx * nz);
  const rects = floorIds.map((id) => R[id]);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * cs;
      const z = (j + 0.5) * cs;
      let ok = x > rad && x < W - rad && z > rad && z < D - rad;
      if (ok) for (const r of rects) if (distPtRect(x, z, r) < rad) { ok = false; break; }
      free[j * nx + i] = ok ? 1 : 0;
    }
  }
  const j0 = Math.min(nz - 1, Math.max(0, Math.floor((door.z0 + door.z1) / 2 / cs)));
  let start = -1;
  for (let i = 0; i < Math.ceil((rad + 20) / cs); i++) {
    if (free[j0 * nx + i]) { start = j0 * nx + i; break; }
  }
  const seen = new Uint8Array(nx * nz);
  if (start >= 0) {
    const q = new Int32Array(nx * nz);
    let h = 0;
    let t = 0;
    q[t++] = start;
    seen[start] = 1;
    while (h < t) {
      const c = q[h++];
      const i = c % nx;
      const j = (c / nx) | 0;
      const nb = [i > 0 ? c - 1 : -1, i < nx - 1 ? c + 1 : -1, j > 0 ? c - nx : -1, j < nz - 1 ? c + nx : -1];
      for (const n of nb) if (n >= 0 && free[n] && !seen[n]) { seen[n] = 1; q[t++] = n; }
    }
  }
  return {
    startFree: start >= 0,
    anyIn(rc) {
      const i0 = Math.max(0, Math.floor(rc.x0 / cs));
      const i1 = Math.min(nx - 1, Math.ceil(rc.x1 / cs) - 1);
      const k0 = Math.max(0, Math.floor(rc.z0 / cs));
      const k1 = Math.min(nz - 1, Math.ceil(rc.z1 / cs) - 1);
      for (let j = k0; j <= k1; j++) for (let i = i0; i <= i1; i++) if (seen[j * nx + i]) return true;
      return false;
    },
  };
}

// Maior retângulo de chão livre (grade de 5 cm), descontando a abertura da porta.
function largestFree(dims, R, floorIds, door) {
  const { W, D } = dims.room;
  const cs = 5;
  const nx = Math.floor(W / cs);
  const nz = Math.floor(D / cs);
  const hgt = new Int32Array(nx);
  let best = { a: 0, w: 0, d: 0 };
  for (let j = 0; j < nz; j++) {
    const z = (j + 0.5) * cs;
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * cs;
      let occ = Math.hypot(x, z - door.hingeZ) < door.r && z < door.hingeZ;
      if (!occ) for (const id of floorIds) { const r = R[id]; if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) { occ = true; break; } }
      hgt[i] = occ ? 0 : hgt[i] + 1;
    }
    const st = [];
    for (let i = 0; i <= nx; i++) {
      const hh = i < nx ? hgt[i] : 0;
      let s = i;
      while (st.length && st[st.length - 1][1] >= hh) {
        const [si, sh] = st.pop();
        const a = sh * (i - si);
        if (a > best.a) best = { a, w: (i - si) * cs, d: sh * cs };
        s = si;
      }
      st.push([s, hh]);
    }
  }
  return best;
}

export function analyze(dims, P) {
  const { W, D } = dims.room;
  const I = dims.items;
  const R = {};
  for (const it of ITEMS) R[it.id] = footprint(dims, it.id, P[it.id]);
  const floorIds = ITEMS.filter((i) => !i.wall).map((i) => i.id);
  const issues = [];
  const good = [];
  const zones = {};
  const N = (id) => META[id].name;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const add = (level, text, ids = []) => issues.push({ level, text, ids });
  const door = doorInfo(dims);

  // 1. dentro do quarto
  for (const it of ITEMS) {
    const r = R[it.id];
    if (r.x0 < -1 || r.z0 < -1 || r.x1 > W + 1 || r.z1 > D + 1) add('erro', `${N(it.id)} está saindo do quarto`, [it.id]);
  }

  // 2. móveis um em cima do outro
  for (let i = 0; i < floorIds.length; i++) {
    for (let j = i + 1; j < floorIds.length; j++) {
      const a = floorIds[i];
      const b = floorIds[j];
      if (overlap(R[a], R[b]) > 4) add('erro', `${cap(oa(a))} e ${oa(b)} estão um em cima do outro`, [a, b]);
    }
  }

  // 3. abertura da porta (quarto de círculo a partir da dobradiça)
  const q = { x0: 0, x1: door.r, z0: door.hingeZ - door.r, z1: door.hingeZ };
  for (const it of ITEMS) {
    if (it.wall && P.tv.y > dims.door.height) continue;
    const r = R[it.id];
    const c = { x0: Math.max(r.x0, q.x0), x1: Math.min(r.x1, q.x1), z0: Math.max(r.z0, q.z0), z1: Math.min(r.z1, q.z1) };
    if (c.x0 >= c.x1 - 0.5 || c.z0 >= c.z1 - 0.5) continue;
    if (distPtRect(0, door.hingeZ, c) < door.r - 1) add('erro', `${cap(oa(it.id))} bloqueia a porta (ela não abre inteira)`, [it.id]);
  }

  // 4. janela
  const wz0 = dims.win.offset;
  const wz1 = wz0 + dims.win.width;
  const sill = dims.win.sill;
  const wtop = sill + dims.win.height;
  for (const it of ITEMS) {
    const r = R[it.id];
    if (r.x1 < W - 15) continue;
    if (Math.min(r.z1, wz1) - Math.max(r.z0, wz0) < 5) continue;
    if (it.wall) {
      const p = P.tv;
      if (norm(p.rot) === 270 && p.y < wtop && p.y + I.tv.h > sill) add('aviso', 'A TV está na frente da janela', ['tv']);
      continue;
    }
    const top = heightAt(dims, it.id, P[it.id].rot, 'east');
    if (top > sill + 2) add('aviso', `${cap(oa(it.id))} tampa parte da janela`, [it.id]);
  }

  // 5. TV atrás de móvel alto
  {
    const t = R.tv;
    const p = P.tv;
    const tw = backWall(p.rot);
    const te = { x0: t.x0 - 2, x1: t.x1 + 2, z0: t.z0 - 2, z1: t.z1 + 2 };
    for (const id of floorIds) {
      if (overlap(te, R[id]) <= 0) continue;
      if (heightAt(dims, id, P[id].rot, tw) > p.y + 1) add('aviso', `A TV fica atrás d${META[id].g === 'f' ? 'a' : 'o'} ${META[id].low}`, ['tv', id]);
    }
  }

  // 5b. moldura de gesso na parede da TV: nada alto pode encostar ali
  {
    const mh = dims.room.molding;
    for (const id of floorIds) {
      if (META[id].fixed || R[id].z1 < D - 8) continue;
      if (heightAt(dims, id, P[id].rot, 'south') > mh - 3) {
        add('aviso', `Para encostar ${oa(id)} na parede da TV teria que tirar a moldura de gesso`, [id]);
      }
    }
    const p = P.tv;
    if (norm(p.rot) === 180 && p.y < mh + 3 && p.y + I.tv.h > mh - 3) add('aviso', 'A TV ficaria em cima da moldura de gesso', ['tv']);
  }

  // 6. espaço de uso na frente (cadeira, portas, gavetas)
  for (const it of ITEMS) {
    if (!it.clear) continue;
    const r = R[it.id];
    const rot = P[it.id].rot;
    const base = it.id === 'desk' ? chairSpan(dims, r, rot) : r;
    const zc = clip(frontZone(base, rot, it.clear), W, D);
    zones[it.id] = { rect: zc, blocked: false };
    const fd = frontDir(rot);
    const toWall = fd[0] > 0 ? W - r.x1 : fd[0] < 0 ? r.x0 : fd[1] > 0 ? D - r.z1 : r.z0;
    let minGap = toWall;
    const blockers = [];
    for (const id of floorIds) {
      if (id === it.id) continue;
      if (overlap(zc, R[id]) > 4) {
        blockers.push(id);
        minGap = Math.min(minGap, Math.max(0, frontGap(r, rot, R[id])));
      }
    }
    if (minGap < it.clear - 2) {
      zones[it.id].blocked = true;
      const g = Math.round(minGap);
      const qty = g <= 2 ? 'Sem espaço' : `Só ${g} cm`;
      if (!blockers.length) add('aviso', `${cap(oa(it.id))} está de frente para a parede: ${qty.toLowerCase()} ${it.clearText}`, [it.id]);
      else add('aviso', `${qty} ${it.clearText} (${blockers.map(oa).join(' e ')} no caminho; o ideal é ${it.clear} cm)`, [it.id, ...blockers]);
    }
  }

  // 7. acesso à cama (olhando o meio da lateral, sem contar a cabeceira)
  {
    const r = R.bed;
    const rot = norm(P.bed.rot);
    const d = I.bed.d;
    const mid = { ...r };
    if (rot === 0) { mid.z0 = r.z0 + 0.35 * d; mid.z1 = r.z0 + 0.85 * d; }
    if (rot === 180) { mid.z0 = r.z1 - 0.85 * d; mid.z1 = r.z1 - 0.35 * d; }
    if (rot === 90) { mid.x0 = r.x0 + 0.35 * d; mid.x1 = r.x0 + 0.85 * d; }
    if (rot === 270) { mid.x0 = r.x1 - 0.85 * d; mid.x1 = r.x1 - 0.35 * d; }
    const others = floorIds.filter((i) => i !== 'bed').map((i) => [i, R[i]]);
    const sides = rot === 0 || rot === 180 ? ['E', 'W'] : ['N', 'S'];
    const gs = sides.map((k) => gapDir(mid, k, others, W, D).d);
    const mx = Math.max(...gs);
    const mn = Math.min(...gs);
    if (mx < 35) add('aviso', `Pouco espaço para subir na cama (${Math.round(mx)} cm no lado mais livre)`, ['bed']);
    else if (mn < 15) add('dica', 'Cama encostada: só dá para subir por um lado', ['bed']);
    else if (mn >= 40) good.push('Dá para subir na cama pelos dois lados');
  }

  // 8. passagens (mín. 40 cm) a partir da porta
  const reach = reachability(dims, R, floorIds, door);
  if (!reach.startFree) {
    add('erro', 'Não sobra passagem logo na entrada da porta', []);
  } else {
    const targets = [];
    for (const id of ['wardrobe', 'desk', 'bookshelf']) if (zones[id] && !zones[id].blocked) targets.push([id, [zones[id].rect]]);
    const r = R.bed;
    targets.push(['bed', [
      clip({ x0: r.x0 - 30, x1: r.x0, z0: r.z0, z1: r.z1 }, W, D),
      clip({ x0: r.x1, x1: r.x1 + 30, z0: r.z0, z1: r.z1 }, W, D),
      clip({ x0: r.x0, x1: r.x1, z0: r.z0 - 30, z1: r.z0 }, W, D),
      clip({ x0: r.x0, x1: r.x1, z0: r.z1, z1: r.z1 + 30 }, W, D),
    ]]);
    for (const [id, rects] of targets) {
      if (!rects.some((rc) => rc.x1 - rc.x0 > 1 && rc.z1 - rc.z0 > 1 && reach.anyIn(rc))) {
        add('aviso', `Passagem apertada: difícil chegar até ${oa(id)} (menos de 40 cm livres no caminho)`, [id]);
      }
    }
  }

  // 9. TV vista da cama
  {
    const f = frontDir(P.bed.rot);
    const hx = P.bed.x - f[0] * (I.bed.d / 2 - 45);
    const hz = P.bed.z - f[1] * (I.bed.d / 2 - 45);
    const vx = P.tv.x - hx;
    const vz = P.tv.z - hz;
    const len = Math.hypot(vx, vz) || 1;
    const ang = Math.round((Math.acos(Math.max(-1, Math.min(1, (vx * f[0] + vz * f[1]) / len))) * 180) / Math.PI);
    const tn = frontDir(P.tv.rot);
    const facing = (tn[0] * -vx + tn[1] * -vz) / len > 0.64;
    if (!facing) add('dica', 'A tela da TV não fica virada para a cama', ['tv']);
    else if (ang <= 35) good.push('TV de frente para a cama');
    else add('dica', `TV fica de lado para quem está na cama (uns ${ang}°)`, ['tv', 'bed']);
  }

  // 10. pontos fortes
  {
    const r = R.desk;
    const dz = Math.max(0, wz0 - r.z1, r.z0 - wz1);
    if (Math.hypot(W - r.x1, dz) < 40) good.push('Mesa pertinho da janela (luz natural)');
  }
  if (zones.desk && !zones.desk.blocked) good.push('Cadeira com espaço livre');
  if (zones.wardrobe && !zones.wardrobe.blocked) good.push('Portas do armário livres');
  if (zones.bookshelf && !zones.bookshelf.blocked) good.push('Estante fácil de alcançar');

  const lf = largestFree(dims, R, floorIds, door);
  const order = { erro: 0, aviso: 1, dica: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  const count = (l) => issues.filter((i) => i.level === l).length;
  return { issues, good, zones, rects: R, free: lf, errors: count('erro'), warnings: count('aviso'), tips: count('dica') };
}

