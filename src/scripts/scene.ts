import {
  BufferGeometry,
  CanvasTexture,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Phone proportions (world units)
export const W = 2.3, H = 4.75, R = 0.44, D = 0.2, BEV = 0.05;
const FRONT_Z = D / 2 + BEV;

export const smooth = (t: number) => t * t * (3 - 2 * t);
export const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Piecewise-smooth interpolation through three values placed at chapter centres. */
export function through(values: [number, number, number], p: number) {
  const k = [1 / 6, 1 / 2, 5 / 6];
  if (p <= k[0]) return values[0];
  if (p >= k[2]) return values[2];
  const seg = p < k[1] ? 0 : 1;
  return lerp(values[seg], values[seg + 1], smooth((p - k[seg]) / (k[seg + 1] - k[seg])));
}

export function roundedShape(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export function screenGeometry(w: number, h: number, r: number) {
  const g = new ShapeGeometry(roundedShape(w, h, r), 40);
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + w / 2) / w;
    uv[i * 2 + 1] = (pos.getY(i) + h / 2) / h;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

// ---- Screen artwork (drawn once, swapped per scroll chapter) -----------------
export const CW = 540, CH = 1189;

export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 500, align: CanvasTextAlign = 'left') {
  c.font = `${weight} ${size}px system-ui, -apple-system, 'Inter Variable', sans-serif`;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(s, x, y);
}

export function baseScreen(c: CanvasRenderingContext2D) {
  const g = c.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#0a0a10');
  g.addColorStop(1, '#1b1b26');
  c.fillStyle = g;
  c.fillRect(0, 0, CW, CH);
  text(c, '9:41', 62, 78, 27, '#fff', 600);
  rr(c, 400, 58, 46, 22, 6); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.stroke();
  rr(c, 404, 62, 32, 14, 3); c.fillStyle = '#fff'; c.fill();
  rr(c, CW / 2 - 88, 34, 176, 50, 25); c.fillStyle = '#000'; c.fill();
}

export function drawDetected(c: CanvasRenderingContext2D) {
  baseScreen(c);
  rr(c, CW / 2 - 150, 128, 300, 52, 26); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill();
  c.beginPath(); c.arc(CW / 2 - 110, 154, 8, 0, Math.PI * 2); c.fillStyle = '#30d158'; c.fill();
  text(c, 'CORE detected a call', CW / 2 + 12, 163, 24, '#fff', 500, 'center');
  text(c, 'Ravi Kumar', CW / 2, 360, 68, '#fff', 600, 'center');
  text(c, 'mobile  +91 98••• ••210', CW / 2, 414, 27, '#98989d', 400, 'center');
  text(c, 'calling…', CW / 2, 470, 28, '#98989d', 400, 'center');
  c.beginPath(); c.arc(CW / 2, 1010, 64, 0, Math.PI * 2); c.fillStyle = '#ff453a'; c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(CW / 2 - 22, 988); c.lineTo(CW / 2 + 22, 1032); c.moveTo(CW / 2 + 22, 988); c.lineTo(CW / 2 - 22, 1032); c.stroke();
}

export function drawRecording(c: CanvasRenderingContext2D) {
  baseScreen(c);
  rr(c, CW / 2 - 92, 128, 184, 50, 25); c.fillStyle = 'rgba(255,69,58,.18)'; c.fill();
  c.beginPath(); c.arc(CW / 2 - 52, 153, 8, 0, Math.PI * 2); c.fillStyle = '#ff453a'; c.fill();
  text(c, 'Recording', CW / 2 + 14, 162, 24, '#ff453a', 600, 'center');
  text(c, 'Ravi Kumar', CW / 2, 300, 58, '#fff', 600, 'center');
  text(c, '02:14', CW / 2, 352, 32, '#98989d', 400, 'center');
  const n = 28, bw = 8, gap = 10.5, x0 = (CW - (n * bw + (n - 1) * gap)) / 2;
  for (let i = 0; i < n; i++) {
    const h = 34 + Math.abs(Math.sin(i * 1.7) + Math.sin(i * 0.6 + 1)) * 105;
    rr(c, x0 + i * (bw + gap), 640 - h / 2, bw, h, 4); c.fillStyle = '#30d158'; c.fill();
  }
  rr(c, 36, 900, CW - 72, 170, 26); c.fillStyle = 'rgba(255,255,255,.09)'; c.fill();
  text(c, 'Uploading to your S3 bucket', 68, 970, 28, '#fff', 500);
  rr(c, 68, 1006, CW - 136, 10, 5); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill();
  rr(c, 68, 1006, (CW - 136) * 0.68, 10, 5); c.fillStyle = '#0a84ff'; c.fill();
}

export function drawSynced(c: CanvasRenderingContext2D) {
  baseScreen(c);
  text(c, 'Synced to CRM', 46, 196, 54, '#fff', 600);
  c.beginPath(); c.arc(CW - 70, 176, 24, 0, Math.PI * 2); c.fillStyle = '#30d158'; c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(CW - 82, 177); c.lineTo(CW - 73, 187); c.lineTo(CW - 57, 166); c.stroke();
  rr(c, 30, 250, CW - 60, 440, 30); c.fillStyle = 'rgba(255,255,255,.09)'; c.fill();
  const rows: [string, string, string][] = [['Lead', 'Lead 4821', '#fff'], ['Agent', 'Priya S.', '#fff'], ['Duration', '2 min 14 s', '#fff'], ['Recording', 'Play', '#0a84ff']];
  rows.forEach(([k, v, col], i) => {
    const y = 250 + i * 110 + 66;
    text(c, k, 64, y, 27, '#98989d', 400);
    text(c, v, CW - 64, y, 29, col, 500, 'right');
    if (i < rows.length - 1) { c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(64, y + 34, CW - 128, 1.5); }
  });
  text(c, 'Delivered to your CRM', 46, 780, 26, '#98989d', 500);
  ['Salesforce', 'Zoho', 'HubSpot'].forEach((n, i) => {
    const x = 46 + i * 155;
    rr(c, x, 812, 140, 54, 27); c.fillStyle = 'rgba(255,255,255,.1)'; c.fill();
    text(c, n, x + 70, 847, 22, '#fff', 500, 'center');
  });
}

export function makeTexture(draw: (c: CanvasRenderingContext2D) => void, anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  draw(canvas.getContext('2d')!);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export type ScreenDrawer = (c: CanvasRenderingContext2D) => void;

/** The phone body, bezel, screen and side buttons. Swap screens with `screenMat.map = textures[i]`. */
export function buildPhone(
  renderer: WebGLRenderer,
  drawers: ScreenDrawer[],
  geos: BufferGeometry[],
  mats: (MeshPhysicalMaterial | MeshBasicMaterial)[],
) {
  const track = <T extends BufferGeometry>(g: T) => (geos.push(g), g);
  const phone = new Group();

  const frameMat = new MeshPhysicalMaterial({ color: '#2b2b2f', metalness: 0.9, roughness: 0.32, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  mats.push(frameMat);
  const bodyGeo = track(new ExtrudeGeometry(roundedShape(W - 2 * BEV, H - 2 * BEV, R - BEV), {
    depth: D, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 10, curveSegments: 48,
  }));
  bodyGeo.translate(0, 0, -D / 2);
  phone.add(new Mesh(bodyGeo, frameMat));

  const bezelMat = new MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  mats.push(bezelMat);
  const bezel = new Mesh(track(screenGeometry(W - 0.16, H - 0.16, R - 0.08)), bezelMat);
  bezel.position.z = FRONT_Z + 0.001;
  phone.add(bezel);

  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textures = drawers.map((d) => makeTexture(d, aniso));
  const screenMat = new MeshBasicMaterial({ map: textures[0], toneMapped: false });
  mats.push(screenMat);
  const screen = new Mesh(track(screenGeometry(W - 0.26, H - 0.26, R - 0.13)), screenMat);
  screen.position.z = FRONT_Z + 0.003;
  phone.add(screen);

  // side buttons
  const button = (x: number, y: number, h: number) => {
    const m = new Mesh(track(new RoundedBoxGeometry(0.07, h, 0.13, 3, 0.03)), frameMat);
    m.position.set(x, y, 0);
    phone.add(m);
  };
  button(W / 2 + 0.005, 0.7, 0.85);      // power
  button(-W / 2 - 0.005, 1.15, 0.36);    // action
  button(-W / 2 - 0.005, 0.5, 0.62);     // volume up
  button(-W / 2 - 0.005, -0.28, 0.62);   // volume down
  return { phone, screenMat, textures };
}
