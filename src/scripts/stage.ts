import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { baseScreen, buildPhone, clamp01, easeOutCubic, lerp, roundedShape, rr, screenGeometry, smooth, text } from './scene';

export type Kind = 'laptop' | 'cards' | 'stack' | 'chat' | 'saas';

export interface Stage {
  setProgress(p: number): void;
  setRunning(on: boolean): void;
  /** Dev helper: jump to a state and render one frame (works in background tabs). */
  snap(p: number): void;
  /** Dev helper: render a transparent PNG of the object at a fixed size. */
  capture(w: number, h: number, p?: number, lay?: Partial<Layout>): string;
  destroy(): void;
}

export interface Layout { x: number; y: number; s: number }
export interface Built {
  root: Group;
  update(p: number, t: number): void;
  wide: Layout;
  narrow: Layout;
  still: Layout & { p: number };
}

export interface Ctx {
  renderer: WebGLRenderer;
  geos: BufferGeometry[];
  mats: (MeshPhysicalMaterial | MeshBasicMaterial)[];
  textures: CanvasTexture[];
  aniso: number;
}

const geo = <T extends BufferGeometry>(c: Ctx, g: T) => (c.geos.push(g), g);
const mat = <T extends MeshPhysicalMaterial | MeshBasicMaterial>(c: Ctx, m: T) => (c.mats.push(m), m);
const flat = (c: Ctx, map: CanvasTexture, transparent = false) => mat(c, new MeshBasicMaterial({ map, transparent, toneMapped: false }));

function tex(c: Ctx, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = c.aniso;
  c.textures.push(t);
  return t;
}

function wrap(g: CanvasRenderingContext2D, str: string, maxW: number) {
  const words = str.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxW && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ============================================================================
// Laptop (software development): lid opens on scroll, code editor on screen
// ============================================================================
function drawEditor(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2c2c2e'; g.fillRect(0, 0, w, 46);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { g.beginPath(); g.arc(28 + i * 26, 23, 7, 0, Math.PI * 2); g.fillStyle = col; g.fill(); });
  text(g, 'sync-call.ts', w / 2, 30, 17, '#98989d', 500, 'center');
  g.fillStyle = '#252527'; g.fillRect(0, 46, 250, h - 46 - 30);
  text(g, 'EXPLORER', 24, 86, 13, '#8e8e93', 600);
  ['sync-call.ts', 'presign.ts', 'upload.ts', 'crm.ts', 'types.ts'].forEach((f, i) => {
    if (i === 0) { g.fillStyle = '#37373d'; g.fillRect(0, 104, 250, 34); }
    text(g, f, 44, 128 + i * 34, 17, i === 0 ? '#fff' : '#b0b0b5', 400);
  });
  g.fillStyle = '#2a2a2c'; g.fillRect(250, 46, w - 250, 38);
  text(g, 'sync-call.ts', 280, 71, 16, '#fff', 500);
  const K = '#ff7ab2', F = '#4fc1ff', S = '#fc6a5d', C = '#7f8c98', T = '#e6e6e6';
  const lines: [string, string][][] = [
    [['export async function ', K], ['syncCall', F], ['(call: Call) {', T]],
    [['  const ', K], ['url = ', T], ['await ', K], ['presign', F], ['(call.id);', T]],
    [['  await ', K], ['upload', F], ['(call.audio, url);', T]],
    [['  await ', K], ['crm.', T], ['log', F], ['({', T]],
    [['    lead: ', T], ['call.leadId', T], [',', T]],
    [['    recording: ', T], ['url', T], [',', T]],
    [['    agent: ', T], ["'Priya S.'", S], [',', T]],
    [['    seconds: ', T], ['call.duration', T], [',', T]],
    [['  });', T]],
    [['  // visible to managers in seconds', C]],
    [['}', T]],
  ];
  g.font = "500 22px ui-monospace, Menlo, monospace";
  lines.forEach((ln, i) => {
    const y = 130 + i * 38;
    text(g, String(i + 1), 296, y, 18, '#5a5a5e', 400, 'right');
    let x = 324;
    g.font = "500 22px ui-monospace, Menlo, monospace";
    for (const [s, col] of ln) { g.fillStyle = col; g.textAlign = 'left'; g.fillText(s, x, y); x += g.measureText(s).width; }
  });
  g.fillStyle = '#0a84ff'; g.fillRect(0, h - 30, w, 30);
  text(g, 'main', 16, h - 10, 14, '#fff', 500);
  text(g, 'TypeScript', w - 16, h - 10, 14, '#fff', 500, 'right');
}

function drawKeys(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  const cols = 14, rows = 5, gap = 8, kw = (w - gap * (cols + 1)) / cols, kh = 66;
  for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
    rr(g, gap + cI * (kw + gap), 12 + r * (kh + gap), kw, kh, 9); g.fillStyle = '#18181b'; g.fill();
  }
  rr(g, w / 2 - 210, h - 150, 420, 128, 14); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3; g.stroke();
}

export function buildLaptop(c: Ctx): Built {
  const root = new Group();
  const metal = mat(c, new MeshPhysicalMaterial({ color: '#c9cace', metalness: 0.85, roughness: 0.33, clearcoat: 0.15 }));
  const base = new Mesh(geo(c, new RoundedBoxGeometry(4.8, 0.14, 3.2, 5, 0.06)), metal);
  base.position.y = -0.07;
  root.add(base);

  const keys = new Mesh(geo(c, new PlaneGeometry(4.4, 2.2)), flat(c, tex(c, 1100, 550, drawKeys), true));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.002, 0.02);
  root.add(keys);

  const hinge = new Group();
  hinge.position.set(0, 0, -1.6);
  root.add(hinge);
  const lid = new Mesh(geo(c, new RoundedBoxGeometry(4.8, 0.1, 3.2, 5, 0.045)), metal);
  lid.position.set(0, 0.052, 1.6);
  hinge.add(lid);

  const bezel = new Mesh(geo(c, screenGeometry(4.66, 3.06, 0.1)), mat(c, new MeshBasicMaterial({ color: 0x000000, toneMapped: false })));
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, -0.002, 1.6);
  hinge.add(bezel);
  const screen = new Mesh(geo(c, screenGeometry(4.5, 2.9, 0.06)), flat(c, tex(c, 1160, 748, drawEditor)));
  screen.rotation.x = Math.PI / 2;
  screen.position.set(0, -0.004, 1.6);
  hinge.add(screen);

  return {
    root,
    update(p) {
      const open = smooth(clamp01(p / 0.5));
      hinge.rotation.x = -lerp(0, 1.85, open);
      root.rotation.y = lerp(0.6, -0.32, smooth(p));
      root.rotation.x = lerp(0.34, 0.1, smooth(clamp01(p / 0.6)));
    },
    wide: { x: 3.0, y: -1.05, s: 0.86 },
    narrow: { x: 0, y: -1.8, s: 0.68 },
    still: { x: 0, y: -1.2, s: 0.95, p: 0.75 },
  };
}

// ============================================================================
// Cards (SEO & digital marketing): search result, traffic, keywords
// ============================================================================

/** A thin white card with a drawn face, used for floating UI panels. */
function makeCard(c: Ctx, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, tw: number, th: number) {
  const g = new Group();
  const body = new Mesh(geo(c, new ExtrudeGeometry(roundedShape(w - 0.04, h - 0.04, 0.2), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 4, curveSegments: 24 })), mat(c, new MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.4 })));
  body.geometry.translate(0, 0, -0.02);
  g.add(body);
  const face = new Mesh(geo(c, screenGeometry(w - 0.1, h - 0.1, 0.17)), flat(c, tex(c, tw, th, draw)));
  face.position.z = 0.042;
  g.add(face);
  return g;
}

const CARD_W = 3.4, CARD_H = 2.2, TW = 1020, TH = 660;

function drawSerp(g: CanvasRenderingContext2D) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, TW, TH);
  rr(g, 40, 40, 940, 76, 38); g.fillStyle = '#f2f2f4'; g.fill();
  g.strokeStyle = '#6e6e73'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.arc(90, 76, 13, 0, Math.PI * 2); g.moveTo(100, 87); g.lineTo(112, 99); g.stroke();
  text(g, 'accounting software for small business', 132, 90, 29, '#6e6e73', 400);
  rr(g, 40, 148, 940, 214, 26); g.fillStyle = '#f5faff'; g.fill(); g.strokeStyle = '#0071e3'; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.arc(92, 206, 22, 0, Math.PI * 2); g.fillStyle = '#1d1d1f'; g.fill();
  text(g, '1', 92, 216, 26, '#fff', 600, 'center');
  text(g, 'yourbusiness.com', 136, 200, 23, '#6e6e73', 400);
  text(g, 'Accounting software built for small teams', 136, 246, 34, '#0066cc', 600);
  g.font = '400 25px system-ui, sans-serif';
  wrap(g, 'Send invoices, track expenses and file taxes without a spreadsheet.', 800).forEach((l, i) => text(g, l, 136, 292 + i * 34, 25, '#6e6e73', 400));
  g.globalAlpha = 0.5;
  [['2', 'competitor-one.com', 'Best accounting tools compared', 398], ['3', 'competitor-two.com', 'Small business finance guide', 510]].forEach(([n, u, t, y]) => {
    g.beginPath(); g.arc(92, (y as number) + 30, 20, 0, Math.PI * 2); g.fillStyle = '#6e6e73'; g.fill();
    text(g, n as string, 92, (y as number) + 39, 23, '#fff', 600, 'center');
    text(g, u as string, 136, (y as number) + 24, 22, '#6e6e73', 400);
    text(g, t as string, 136, (y as number) + 64, 30, '#0066cc', 600);
  });
  g.globalAlpha = 1;
}

function drawChart(g: CanvasRenderingContext2D) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, TW, TH);
  text(g, 'Organic traffic', 52, 84, 38, '#1d1d1f', 600);
  text(g, 'Last six months', 52, 124, 24, '#6e6e73', 400);
  const x0 = 60, x1 = 960, y0 = 170, y1 = 540;
  g.strokeStyle = '#ececf0'; g.lineWidth = 2;
  for (let i = 0; i < 4; i++) { const y = y0 + ((y1 - y0) / 3) * i; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].forEach((m, i) => text(g, m, x0 + ((x1 - x0) / 5) * i, 592, 22, '#8e8e93', 400, 'center'));
  const pts = [0.1, 0.18, 0.3, 0.42, 0.6, 0.9].map((v, i) => [x0 + ((x1 - x0) / 5) * i, y1 - v * (y1 - y0)]);
  const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const [px, py] = pts[i - 1], [cx, cy] = pts[i]; g.bezierCurveTo((px + cx) / 2, py, (px + cx) / 2, cy, cx, cy); } };
  path(); g.lineTo(x1, y1); g.lineTo(x0, y1); g.closePath();
  const grad = g.createLinearGradient(0, y0, 0, y1); grad.addColorStop(0, 'rgba(0,113,227,.28)'); grad.addColorStop(1, 'rgba(0,113,227,0)');
  g.fillStyle = grad; g.fill();
  path(); g.strokeStyle = '#0071e3'; g.lineWidth = 8; g.lineCap = 'round'; g.stroke();
  const [ex, ey] = pts[pts.length - 1];
  g.beginPath(); g.arc(ex, ey, 15, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 7; g.stroke();
  rr(g, ex - 150, ey - 30, 118, 50, 25); g.fillStyle = '#1d1d1f'; g.fill();
  text(g, 'Page one', ex - 91, ey + 4, 23, '#fff', 600, 'center');
}

function drawKeywords(g: CanvasRenderingContext2D) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, TW, TH);
  text(g, 'Keywords', 52, 84, 38, '#1d1d1f', 600);
  const rows: [string, string][] = [['accounting software', '1'], ['invoice app for small business', '2'], ['gst billing software', '3'], ['expense tracker', '4']];
  rows.forEach(([k, n], i) => {
    const y = 130 + i * 118;
    rr(g, 40, y, 940, 96, 22); g.fillStyle = '#f5f5f7'; g.fill();
    text(g, k, 76, y + 60, 31, '#1d1d1f', 500);
    rr(g, 840, y + 22, 100, 52, 26); g.fillStyle = i === 0 ? '#0071e3' : '#e8e8ed'; g.fill();
    text(g, `#${n}`, 890, y + 58, 27, i === 0 ? '#fff' : '#1d1d1f', 600, 'center');
    g.fillStyle = '#30d158'; g.beginPath(); g.moveTo(800, y + 60); g.lineTo(814, y + 34); g.lineTo(828, y + 60); g.closePath(); g.fill();
  });
}

export function buildCards(c: Ctx): Built {
  const root = new Group();
  const bodyMat = mat(c, new MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.4 }));
  const cards: Group[] = [drawSerp, drawChart, drawKeywords].map((draw) => {
    const g = new Group();
    const body = new Mesh(geo(c, new ExtrudeGeometry(roundedShape(CARD_W - 0.04, CARD_H - 0.04, 0.2), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 4, curveSegments: 24 })), bodyMat);
    body.geometry.translate(0, 0, -0.02);
    g.add(body);
    const face = new Mesh(geo(c, screenGeometry(CARD_W - 0.1, CARD_H - 0.1, 0.17)), flat(c, tex(c, TW, TH, draw)));
    face.position.z = 0.042;
    g.add(face);
    root.add(g);
    return g;
  });
  const P0 = [[-0.5, 0.75, 0.9], [0, 0, 0], [0.5, -0.75, -0.9]];
  const P1 = [[-1.6, 1.2, 0.5], [1.5, 0.15, 0], [-0.9, -1.4, -0.5]];
  const RY0 = [-0.45, -0.45, -0.45], RY1 = [0.2, -0.22, 0.12];

  return {
    root,
    update(p, t) {
      const e = smooth(clamp01(p / 0.8));
      cards.forEach((card, i) => {
        card.position.set(lerp(P0[i][0], P1[i][0], e), lerp(P0[i][1], P1[i][1], e) + Math.sin(t * 0.9 + i * 1.7) * 0.05, lerp(P0[i][2], P1[i][2], e));
        card.rotation.y = lerp(RY0[i], RY1[i], e);
        card.rotation.x = lerp(0.06, 0, e);
      });
    },
    wide: { x: 3.2, y: 0, s: 0.78 },
    narrow: { x: 0, y: -1.4, s: 0.52 },
    still: { x: 0, y: 0, s: 0.9, p: 1 },
  };
}

// ============================================================================
// Stack (cloud & AWS): chip-style layers that explode apart on scroll
// ============================================================================
function drawSlab(label: string, accent: boolean) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = accent ? 'rgba(255,255,255,.35)' : 'rgba(29,29,31,.14)'; g.lineWidth = 3;
    for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * (w / 10), 40); g.lineTo(i * (w / 10), h - 40); g.moveTo(40, i * (h / 10)); g.lineTo(w - 40, i * (h / 10)); g.stroke(); }
    rr(g, 40, 40, w - 80, h - 80, 46); g.stroke();
    rr(g, w / 2 - 190, h / 2 - 62, 380, 124, 30); g.fillStyle = accent ? 'rgba(255,255,255,.18)' : '#fff'; g.fill();
    text(g, label, w / 2, h / 2 + 22, 62, accent ? '#fff' : '#1d1d1f', 600, 'center');
  };
}

function buildStack(c: Ctx): Built {
  const root = new Group();
  const labels: [string, boolean][] = [['Network', false], ['Storage', false], ['Database', false], ['App', true]];
  const slabs = labels.map(([label, accent]) => {
    const m = mat(c, new MeshPhysicalMaterial({ color: accent ? '#0071e3' : '#f2f2f4', metalness: accent ? 0.1 : 0.2, roughness: 0.35, clearcoat: 0.3 }));
    const g = new Group();
    g.add(new Mesh(geo(c, new RoundedBoxGeometry(3.6, 0.24, 3.6, 6, 0.11)), m));
    const top = new Mesh(geo(c, new PlaneGeometry(3.4, 3.4)), flat(c, tex(c, 700, 700, drawSlab(label, accent)), true));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.123;
    g.add(top);
    root.add(g);
    return g;
  });
  return {
    root,
    update(p, t) {
      const gap = lerp(0.3, 1.3, smooth(clamp01(p / 0.85)));
      slabs.forEach((s, i) => { s.position.y = (i - 1.5) * gap + Math.sin(t * 0.9 + i) * 0.02; });
      root.rotation.x = lerp(0.6, 0.95, smooth(p));
      root.rotation.y = lerp(0.3, 0.75, smooth(p));
    },
    wide: { x: 3.0, y: 0, s: 0.78 },
    narrow: { x: 0, y: -1.5, s: 0.5 },
    still: { x: 0, y: 0, s: 0.85, p: 0.9 },
  };
}

// ============================================================================
// Chat phone (WhatsApp messaging)
// ============================================================================
function bubble(g: CanvasRenderingContext2D, x: number, y: number, w: number, lines: string[], out: boolean) {
  const h = 30 + lines.length * 36;
  rr(g, x, y, w, h, 26); g.fillStyle = out ? '#0a84ff' : '#2a2a2e'; g.fill();
  lines.forEach((l, i) => text(g, l, x + 24, y + 46 + i * 36, 26, '#fff', 400));
  return h;
}

function chatHeader(g: CanvasRenderingContext2D) {
  baseScreen(g);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 110, 540, 96);
  g.beginPath(); g.arc(72, 158, 30, 0, Math.PI * 2); g.fillStyle = '#f5f5f7'; g.fill();
  text(g, 'S', 72, 170, 32, '#1d1d1f', 600, 'center');
  text(g, 'Sunrise Bakery', 118, 154, 30, '#fff', 600);
  text(g, 'Business account', 118, 186, 21, '#98989d', 400);
}

const chat1 = (g: CanvasRenderingContext2D) => { chatHeader(g); const h = bubble(g, 34, 250, 400, ['Hi Anita, your order', '1042 is out for delivery', 'today.'], false); text(g, '10:02', 34, 250 + h + 32, 20, '#8e8e93', 400); };
const chat2 = (g: CanvasRenderingContext2D) => {
  chatHeader(g); bubble(g, 34, 250, 400, ['Hi Anita, your order', '1042 is out for delivery', 'today.'], false);
  ['Track order', 'Change time'].forEach((b, i) => { const x = 34 + i * 200; rr(g, x, 470, 184, 56, 28); g.strokeStyle = '#0a84ff'; g.lineWidth = 3; g.stroke(); text(g, b, x + 92, 506, 22, '#0a84ff', 500, 'center'); });
  bubble(g, 130, 570, 376, ['Thanks! Can it come', 'after 5 pm?'], true);
};
const chat3 = (g: CanvasRenderingContext2D) => {
  chatHeader(g); bubble(g, 34, 250, 400, ['Hi Anita, your order', '1042 is out for delivery', 'today.'], false);
  bubble(g, 130, 400, 376, ['Thanks! Can it come', 'after 5 pm?'], true);
  bubble(g, 34, 540, 420, ['Done. New window is', '5 to 7 pm.'], false);
  rr(g, 34, 760, 300, 54, 27); g.fillStyle = 'rgba(48,209,88,.18)'; g.fill();
  g.beginPath(); g.arc(68, 787, 8, 0, Math.PI * 2); g.fillStyle = '#30d158'; g.fill();
  text(g, 'Logged in your CRM', 90, 795, 22, '#30d158', 500);
};

function buildChat(c: Ctx): Built {
  const { phone, screenMat, textures } = buildPhone(c.renderer, [chat1, chat2, chat3], c.geos, c.mats);
  textures.forEach((t) => c.textures.push(t));
  let shown = 0;
  return {
    root: phone,
    update(p) {
      const idx = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
      if (idx !== shown) { shown = idx; screenMat.map = textures[idx]; }
      phone.rotation.y = lerp(-0.5, 0.35, smooth(p));
      phone.rotation.x = 0.04;
    },
    wide: { x: 2.4, y: 0, s: 1 },
    narrow: { x: 0, y: -1.3, s: 0.7 },
    still: { x: 0, y: 0, s: 0.95, p: 1 },
  };
}


// ============================================================================
// SaaS: a studio display showing an app dashboard, with panels that pop out
// ============================================================================
function drawDashboard(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f5f5f7'; g.fillRect(0, 0, 250, h);
  rr(g, 30, 34, 44, 44, 12); g.fillStyle = '#0071e3'; g.fill();
  text(g, 'YourApp', 90, 66, 28, '#1d1d1f', 600);
  ['Overview', 'Customers', 'Billing', 'Reports', 'Settings'].forEach((n, i) => {
    const y = 130 + i * 62;
    if (i === 0) { rr(g, 18, y - 6, 214, 50, 14); g.fillStyle = 'rgba(0,113,227,.12)'; g.fill(); }
    g.beginPath(); g.arc(50, y + 19, 9, 0, Math.PI * 2); g.fillStyle = i === 0 ? '#0071e3' : '#c7c7cc'; g.fill();
    text(g, n, 78, y + 28, 24, i === 0 ? '#0071e3' : '#424245', i === 0 ? 600 : 400);
  });
  text(g, 'Overview', 290, 78, 38, '#1d1d1f', 600);
  rr(g, w - 520, 36, 340, 56, 28); g.fillStyle = '#f2f2f4'; g.fill();
  text(g, 'Search', w - 480, 72, 22, '#8e8e93', 400);
  g.beginPath(); g.arc(w - 120, 64, 28, 0, Math.PI * 2); g.fillStyle = '#ff9f0a'; g.fill();
  text(g, 'P', w - 120, 74, 26, '#fff', 600, 'center');
  const kpis: [string, string, string][] = [['Active users', '12,480', '+12%'], ['Monthly revenue', '$48.2k', '+8%'], ['Trial conversions', '24%', '+3%']];
  kpis.forEach(([label, val, d], i) => {
    const x = 290 + i * 366;
    rr(g, x, 120, 340, 150, 24); g.fillStyle = '#f5f5f7'; g.fill();
    text(g, label, x + 26, 164, 21, '#6e6e73', 400);
    text(g, val, x + 26, 224, 52, '#1d1d1f', 600);
    text(g, d, x + 314, 224, 22, '#30d158', 600, 'right');
  });
  rr(g, 290, 296, 1064, 330, 26); g.fillStyle = '#f5f5f7'; g.fill();
  text(g, 'Active users', 322, 346, 26, '#1d1d1f', 600);
  const pts = [0.3, 0.4, 0.36, 0.52, 0.6, 0.58, 0.74, 0.84].map((v, i) => [322 + i * (1000 / 7), 590 - v * 210]);
  const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const [px, py] = pts[i - 1], [cx, cy] = pts[i]; g.bezierCurveTo((px + cx) / 2, py, (px + cx) / 2, cy, cx, cy); } };
  path(); g.lineTo(pts[7][0], 600); g.lineTo(pts[0][0], 600); g.closePath();
  const grad = g.createLinearGradient(0, 380, 0, 600); grad.addColorStop(0, 'rgba(0,113,227,.3)'); grad.addColorStop(1, 'rgba(0,113,227,0)');
  g.fillStyle = grad; g.fill();
  path(); g.strokeStyle = '#0071e3'; g.lineWidth = 6; g.lineCap = 'round'; g.stroke();
  text(g, 'Recent signups', 290, 682, 26, '#1d1d1f', 600);
  [['Anita M.', 'Pro', 'Active'], ['Ravi K.', 'Team', 'Trial'], ['Sunrise Bakery', 'Pro', 'Active']].forEach(([n, plan, st], i) => {
    const y = 700 + i * 56;
    g.fillStyle = '#ececf0'; g.fillRect(290, y, 1064, 1.5);
    text(g, n, 300, y + 38, 22, '#1d1d1f', 500);
    text(g, plan, 820, y + 38, 22, '#6e6e73', 400);
    rr(g, 1200, y + 8, 130, 40, 20); g.fillStyle = st === 'Active' ? 'rgba(48,209,88,.18)' : 'rgba(255,159,10,.2)'; g.fill();
    text(g, st, 1265, y + 36, 20, st === 'Active' ? '#1a9b3c' : '#b36b00', 600, 'center');
  });
}

function drawBilling(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  text(g, 'Billing', 44, 72, 34, '#6e6e73', 500);
  text(g, 'Pro', 44, 170, 76, '#1d1d1f', 600);
  text(g, '$49 / month', 44, 224, 30, '#6e6e73', 400);
  g.fillStyle = '#ececf0'; g.fillRect(44, 262, w - 88, 2);
  text(g, 'Next invoice on Oct 1', 44, 314, 26, '#6e6e73', 400);
  rr(g, 44, 340, 250, 62, 31); g.fillStyle = '#0071e3'; g.fill();
  text(g, 'Manage plan', 169, 381, 26, '#fff', 600, 'center');
}

function drawTeam(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  text(g, 'Team', 44, 72, 34, '#6e6e73', 500);
  [['Priya S.', 'Admin', '#0071e3'], ['Ravi K.', 'Editor', '#ff9f0a'], ['Anita M.', 'Viewer', '#30d158']].forEach(([n, r, col], i) => {
    const y = 120 + i * 92;
    g.beginPath(); g.arc(80, y + 34, 30, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    text(g, n[0], 80, y + 46, 30, '#fff', 600, 'center');
    text(g, n, 130, y + 30, 30, '#1d1d1f', 600);
    text(g, r, 130, y + 62, 22, '#6e6e73', 400);
  });
}

function drawUsage(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  text(g, 'API usage', 44, 72, 34, '#6e6e73', 500);
  const cx = w / 2, cy = 254, r = 112;
  g.lineWidth = 28; g.lineCap = 'round';
  g.strokeStyle = '#ececf0'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#0071e3'; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.72); g.stroke();
  text(g, '72%', cx, cy + 20, 62, '#1d1d1f', 600, 'center');
  text(g, 'of monthly limit', cx, 402, 24, '#6e6e73', 400, 'center');
}

export function buildSaas(c: Ctx): Built {
  const root = new Group();
  const metal = mat(c, new MeshPhysicalMaterial({ color: '#c9cace', metalness: 0.85, roughness: 0.33, clearcoat: 0.15 }));
  const display = new Group();
  display.position.y = 0.4;
  root.add(display);
  display.add(new Mesh(geo(c, new RoundedBoxGeometry(5.7, 3.6, 0.16, 6, 0.07)), metal));
  const bezel = new Mesh(geo(c, screenGeometry(5.56, 3.46, 0.06)), mat(c, new MeshBasicMaterial({ color: 0x000000, toneMapped: false })));
  bezel.position.z = 0.081;
  display.add(bezel);
  const screen = new Mesh(geo(c, screenGeometry(5.4, 3.3, 0.04)), flat(c, tex(c, 1400, 855, drawDashboard)));
  screen.position.z = 0.083;
  display.add(screen);
  const neck = new Mesh(geo(c, new RoundedBoxGeometry(0.8, 1.6, 0.12, 4, 0.05)), metal);
  neck.position.set(0, -2.05, -0.12);
  root.add(neck);
  const foot = new Mesh(geo(c, new RoundedBoxGeometry(2.2, 0.08, 1.3, 4, 0.035)), metal);
  foot.position.set(0, -2.86, 0.05);
  root.add(foot);

  const panels = [
    { g: makeCard(c, 2.2, 1.43, drawBilling, 660, 430), from: [-1.4, -0.7, 0.2], to: [-3.05, -1.05, 1.5], ry: 0.3 },
    { g: makeCard(c, 2.2, 1.43, drawTeam, 660, 430), from: [1.6, 0.7, 0.2], to: [3.1, 1.05, 1.15], ry: -0.28 },
    { g: makeCard(c, 2.2, 1.43, drawUsage, 660, 430), from: [1.4, -0.9, 0.2], to: [2.5, -1.85, 1.9], ry: -0.2 },
  ];
  panels.forEach((p) => { p.g.position.set(p.from[0], p.from[1] + 0.4, p.from[2]); display.add(p.g); });

  return {
    root,
    update(a, t) {
      const e = smooth(clamp01(a / 0.75));
      display.rotation.y = lerp(-0.42, 0.2, smooth(a));
      display.rotation.x = 0.03;
      panels.forEach((p, i) => {
        p.g.position.set(lerp(p.from[0], p.to[0], e), lerp(p.from[1], p.to[1], e) + 0.4 + Math.sin(t * 0.9 + i * 2) * 0.04 * e, lerp(p.from[2], p.to[2], e));
        p.g.rotation.y = p.ry * e;
        p.g.visible = e > 0.03;
        p.g.scale.setScalar(lerp(0.3, 1, e));
      });
    },
    wide: { x: 2.9, y: 0.1, s: 0.72 },
    narrow: { x: 0, y: -1.4, s: 0.48 },
    still: { x: 0, y: 0, s: 0.95, p: 1 },
  };
}

const builders: Record<Kind, (c: Ctx) => Built> = { laptop: buildLaptop, cards: buildCards, stack: buildStack, chat: buildChat, saas: buildSaas };

// ============================================================================
export function makeCtx(renderer: WebGLRenderer): Ctx {
  return { renderer, geos: [], mats: [], textures: [], aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) };
}

export function mountStage(canvas: HTMLCanvasElement, kind: Kind): Stage | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.95;
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(-3, 5, 6);
  scene.add(key);

  const camera = new PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0.8, 10);
  camera.lookAt(0, 0, 0);

  const ctx: Ctx = { renderer, geos: [], mats: [], textures: [], aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()) };
  const built = builders[kind](ctx);
  const holder = new Group();
  holder.add(built.root);
  scene.add(holder);

  let prog = 0, progT = 0, px = 0, py = 0, tx = 0, ty = 0;
  let layout: Layout = built.wide;
  let raf = 0, running = false, wanted = false, born = -1, lastW = 0;

  function resize() {
    const w = innerWidth, h = innerHeight;
    if (w === lastW && Math.abs(h - canvas.clientHeight) < 140) return;
    lastW = w;
    const cw = canvas.clientWidth || w, ch = canvas.clientHeight || h;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    layout = cw / ch > 1.2 ? built.wide : built.narrow;
  }
  const onPointer = (e: PointerEvent) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; };

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    if (born === -1) born = t;
    const intro = 1 - easeOutCubic(clamp01((t - born) / 1.4));
    prog += (progT - prog) * 0.08;
    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    holder.position.set(layout.x, layout.y - intro * 1.4, 0);
    holder.scale.setScalar(layout.s);
    holder.rotation.y = px * 0.1;
    holder.rotation.x = py * 0.05;
    built.update(prog, t);
    renderer.render(scene, camera);
  }

  function sync() {
    const on = wanted && !document.hidden;
    if (on === running) return;
    running = on;
    if (on) raf = requestAnimationFrame(frame);
    else cancelAnimationFrame(raf);
  }

  resize();
  addEventListener('resize', resize, { passive: true });
  addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', sync);

  return {
    setProgress: (p) => { progT = p; },
    setRunning: (on) => { wanted = on; sync(); },
    snap(p) {
      prog = progT = p; born = -100;
      frame(performance.now());
      cancelAnimationFrame(raf); running = false;
    },
    capture(w, h, p, lay) {
      const prevRatio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const st = { ...built.still, ...lay };
      prog = progT = p ?? st.p; born = -100;
      holder.position.set(st.x, st.y, 0);
      holder.scale.setScalar(st.s);
      holder.rotation.set(0, 0, 0);
      built.update(prog, 0);
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      renderer.setPixelRatio(prevRatio);
      lastW = 0;
      resize();
      return url;
    },
    destroy() {
      wanted = false; sync();
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', sync);
      ctx.geos.forEach((g) => g.dispose());
      ctx.mats.forEach((m) => m.dispose());
      ctx.textures.forEach((t) => t.dispose());
      env.dispose(); pmrem.dispose(); renderer.dispose();
    },
  };
}
