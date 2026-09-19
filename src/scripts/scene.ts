import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
  WireframeGeometry,
} from 'three';

export interface SceneHandle {
  setProgress(p: number): void;
  setRunning(on: boolean): void;
  destroy(): void;
}

const STOPS = [new Color('#6366f1'), new Color('#22d3ee'), new Color('#34d399')];

function paletteAt(p: number, out: Color) {
  const s = Math.min(Math.max(p, 0), 1) * (STOPS.length - 1);
  const i = Math.min(Math.floor(s), STOPS.length - 2);
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], s - i);
}

export function mountScene(canvas: HTMLCanvasElement): SceneHandle | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }

  const small = innerWidth < 768;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.25 : 1.75));

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 7.5;
  const group = new Group();
  scene.add(group);

  // Fibonacci-sphere point cloud
  const count = small ? 900 : 2200;
  const pos = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const rad = 2.2 + (Math.random() - 0.5) * 0.14;
    pos.set([Math.cos(theta) * r * rad, y * rad, Math.sin(theta) * r * rad], i * 3);
  }
  const pointsGeo = new BufferGeometry();
  pointsGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const pointsMat = new PointsMaterial({ size: 0.035, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const points = new Points(pointsGeo, pointsMat);
  group.add(points);

  // Inner wireframe core
  const coreGeo = new WireframeGeometry(new IcosahedronGeometry(1.35, 1));
  const coreMat = new LineBasicMaterial({ transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false });
  const core = new LineSegments(coreGeo, coreMat);
  group.add(core);

  const color = new Color();
  let progress = 0;
  let target = 0;
  let px = 0, py = 0, tx = 0, ty = 0;
  let baseX = 0, baseScale = 1;
  let raf = 0;
  let running = false;
  let lastW = 0;

  function resize() {
    const w = innerWidth, h = innerHeight;
    if (w === lastW && Math.abs(h - canvas.height / renderer.getPixelRatio()) < 120) return;
    lastW = w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = w / h > 1.1;
    baseX = wide ? 2.3 : 0;
    baseScale = wide ? 1 : 0.72;
    camera.updateProjectionMatrix();
  }

  function onPointer(e: PointerEvent) {
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    progress += (target - progress) * 0.07;
    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;

    group.rotation.y = t * 0.08 + progress * Math.PI * 2 + px * 0.35;
    group.rotation.x = py * 0.25 + progress * 0.7;
    core.rotation.y = -t * 0.12;
    group.position.x = baseX;
    group.scale.setScalar(baseScale * (1 + Math.sin(progress * Math.PI) * 0.3));

    paletteAt(progress, color);
    pointsMat.color.copy(color);
    coreMat.color.copy(color);
    renderer.render(scene, camera);
  }

  function setRunning(on: boolean) {
    if (on === running) return;
    running = on;
    if (on) raf = requestAnimationFrame(frame);
    else cancelAnimationFrame(raf);
  }

  const onVisibility = () => { if (document.hidden) setRunning(false); };
  resize();
  addEventListener('resize', resize, { passive: true });
  addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setProgress: (p) => { target = p; },
    setRunning,
    destroy() {
      setRunning(false);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      pointsGeo.dispose(); pointsMat.dispose(); coreGeo.dispose(); coreMat.dispose();
      renderer.dispose();
    },
  };
}
