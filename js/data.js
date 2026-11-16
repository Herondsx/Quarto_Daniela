// Dados do quarto: medidas (em cm), móveis e sugestões de layout.
//
// Sistema de coordenadas (visto de cima, igual ao desenho):
//   x = 0 na parede do armário/porta  ->  x = W na parede da janela
//   z = 0 na parede da cabeceira       ->  z = D na parede da TV
// "rot" é a direção para onde a FRENTE do móvel aponta:
//   0 = frente para a parede da TV (costas na parede da cabeceira)
//   90 = frente para a janela (costas na parede do armário)
//   180 = frente para a cabeceira (costas na parede da TV)
//   270 = frente para o armário (costas na parede da janela)

export const DEFAULT_DIMS = {
  // molding = altura da moldura de gesso (roda-meio) na parede da TV
  room: { W: 350, D: 250, H: 260, molding: 100 },
  // porta na parede do armário; "gap" = distância até a parede da TV
  door: { gap: 5, width: 75, height: 210 },
  // janela na parede oposta à porta; "offset" = distância da parede da cabeceira
  win: { offset: 105, width: 120, sill: 100, height: 110 },
  items: {
    wardrobe: { w: 165, d: 58, h: 235 },
    bed: { w: 140, d: 200, h: 95 },
    nightstand: { w: 45, d: 40, h: 55 },
    bookshelf: { w: 70, d: 35, h: 185 },
    desk: { w: 160, d: 55, h: 75 },
    tv: { w: 97, d: 6, h: 57 },
  },
};

// Cores iguais às do desenho 2D da Daniela.
export const ITEMS = [
  { id: 'wardrobe', name: 'Armário', short: 'Armário', low: 'armário', g: 'm', color: '#8B1A1A', fixed: true, clear: 50, clearText: 'na frente do armário' },
  { id: 'bed', name: 'Cama de casal', short: 'Cama', low: 'cama', g: 'f', color: '#E5262E' },
  { id: 'nightstand', name: 'Criado-mudo', short: 'Criado-mudo', low: 'criado-mudo', g: 'm', color: '#FF7F27', clear: 30, clearText: 'para abrir as gavetas do criado-mudo' },
  { id: 'bookshelf', name: 'Estante de livros', short: 'Estante', low: 'estante', g: 'f', color: '#00A2E8', clear: 40, clearText: 'na frente da estante' },
  { id: 'desk', name: 'Mesa + cadeira', short: 'Mesa', low: 'mesa', g: 'f', color: '#A349A4', clear: 70, clearText: 'para a cadeira da mesa' },
  { id: 'tv', name: 'TV', short: 'TV', low: 'TV', g: 'f', color: '#4B5563', wall: true },
];
export const META = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const DOOR_COLOR = '#E0A800';
export const WINDOW_COLOR = '#6BA414';

// "a cama", "o armário"
export const oa = (id) => (META[id].g === 'f' ? 'a ' : 'o ') + META[id].low;

// A cadeira fica um pouco à esquerda do meio da mesa (na frente do monitor).
// O espaço da cadeira considera só a largura dela, não a mesa inteira.
export const CHAIR_W = 80;
export const chairOffset = (w) => -w * 0.12 + 4;

export const norm = (r) => ((Math.round(r) % 360) + 360) % 360;

export function fsize(it, rot) {
  const r = norm(rot);
  const swap = r === 90 || r === 270;
  return { fw: swap ? it.d : it.w, fd: swap ? it.w : it.d };
}

export function doorInfo(dims) {
  const z1 = dims.room.D - dims.door.gap;
  const z0 = z1 - dims.door.width;
  return { z0, z1, hingeZ: z1, r: dims.door.width };
}

// Posiciona pelo canto (x0, z0) e devolve o centro.
function put(dims, id, rot, x0, z0, extra = {}) {
  const { fw, fd } = fsize(dims.items[id], rot);
  return { x: x0 + fw / 2, z: z0 + fd / 2, rot, ...extra };
}

export function wardrobePos(dims) {
  return put(dims, 'wardrobe', 90, 0, 0);
}

// As sugestões são funções das medidas: se a Daniela corrigir as medidas,
// os layouts se recalculam sozinhos.
export const PRESETS = [
  {
    id: 'atual',
    tag: 'Hoje',
    name: 'Como está hoje',
    desc: 'O quarto como ele é agora: cabeceira na parede da esquerda (de quem entra), criado-mudo e estante no canto, a mesa grande embaixo da janela e a TV centralizada com a cama, logo acima da moldura de gesso.',
    pros: ['TV bem de frente para a cama', 'Mesa grande com luz natural da janela', 'Zero esforço: nada para carregar'],
    cons: ['Cadeira espremida entre a cama e a mesa', 'Passagem de só 50 cm no pé da cama', 'Criado-mudo tampa a parte de baixo da estante'],
    build(d) {
      const { W, D } = d.room;
      const I = d.items;
      const bx = I.wardrobe.d + 50;
      return {
        wardrobe: wardrobePos(d),
        bed: put(d, 'bed', 0, bx, 0),
        nightstand: put(d, 'nightstand', 0, bx + I.bed.w + 7, 0),
        bookshelf: put(d, 'bookshelf', 270, W - I.bookshelf.d, 0),
        desk: put(d, 'desk', 270, W - I.desk.d, I.bookshelf.w + 8),
        tv: put(d, 'tv', 180, bx + I.bed.w / 2 - I.tv.w / 2, D - I.tv.d, { y: d.room.molding + 4 }),
      };
    },
  },
  {
    id: 'estudos',
    tag: 'Sugestão 1',
    name: 'Cantinho de estudos',
    desc: 'Divide o quarto em duas zonas: estante e mesa juntas na parede da esquerda viram um cantinho de estudos, e a cama gira com a cabeceira embaixo da janela, encostada na parede da TV (abaixo da moldura).',
    pros: ['Área de estudo separada da área de dormir', 'Livros do lado da mesa', 'Não precisa mexer na moldura de gesso', 'Entrada do quarto bem livre'],
    cons: ['Cabeceira embaixo da janela (cortina e vento)', 'TV muda de parede e fica de lado para a cama', 'Cama encostada na parede: só se sai por um lado', 'Cadeira um pouco justa'],
    build(d) {
      const { W, D } = d.room;
      const I = d.items;
      const sx = I.wardrobe.d + 52;
      const deskX0 = sx + I.bookshelf.w + 5;
      return {
        wardrobe: wardrobePos(d),
        bed: put(d, 'bed', 270, W - I.bed.d, D - I.bed.w),
        nightstand: put(d, 'nightstand', 270, W - I.nightstand.d, D - I.bed.w - 3 - I.nightstand.w),
        bookshelf: put(d, 'bookshelf', 0, sx, 0),
        desk: put(d, 'desk', 0, deskX0, 0),
        tv: put(d, 'tv', 0, deskX0 + I.desk.w / 2 - I.tv.w / 2, 0, { y: 128 }),
      };
    },
  },
  {
    id: 'paredeTV',
    tag: 'Sugestão 2',
    name: 'Mesa embaixo da TV',
    desc: 'A cama gira e vai para o canto da janela, encostada na parede da esquerda. A mesa grande cabe embaixo da moldura de gesso, na parede da TV, e a estante fica no pé da cama, de frente para o armário.',
    pros: ['A mesa cabe embaixo da moldura, sem mexer no gesso', 'TV continua no mesmo lugar (sem furar parede)', 'Cama longe da porta (mais privacidade)', 'Janela livre, só com o criado-mudo embaixo'],
    cons: ['TV fica de lado para quem está na cama', 'Monitor fica embaixo da TV (ou a TV vira a tela do computador)', 'Cama encostada na parede', 'Cadeira um pouco justa'],
    build(d) {
      const { W, D } = d.room;
      const I = d.items;
      // a TV fica no mesmo furo de hoje (centralizada com a cama atual)
      const tvX = I.wardrobe.d + 50 + I.bed.w / 2;
      const deskX0 = Math.min(Math.max(d.door.width + 10, tvX - I.desk.w / 2), W - I.desk.w);
      return {
        wardrobe: wardrobePos(d),
        bed: put(d, 'bed', 270, W - I.bed.d, 0),
        nightstand: put(d, 'nightstand', 270, W - I.nightstand.d, I.bed.w + 3),
        bookshelf: put(d, 'bookshelf', 270, W - I.bed.d - I.bookshelf.d, 0),
        desk: put(d, 'desk', 180, deskX0, D - I.desk.d),
        tv: put(d, 'tv', 180, tvX - I.tv.w / 2, D - I.tv.d, { y: d.room.molding + 4 }),
      };
    },
  },
];
