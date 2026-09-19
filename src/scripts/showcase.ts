import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCards, buildLaptop, buildSaas, makeCtx, type Built, type Ctx } from './stage';
import { buildPhone, clamp01, drawDetected, drawRecording, drawSynced, easeOutCubic, lerp, smooth, through } from './scene';
import { phases, type Section } from './timeline';

export interface Showcase {
  setScroll(sy: number, vh: number, sections: Section[]): void;
  setRunning(on: boolean): void;
  /** Dev helper: render one frame at the current scroll position (works in background tabs). */
  snap(): void;
  destroy(): void;
}

function buildCore(c: Ctx): Built {
  const { phone, screenMat, textures } = buildPhone(c.renderer, [drawDetected, drawRecording, drawSynced], c.geos, c.mats);
  textures.forEach((t) => c.textures.push(t));
  let shown = 0;
  return {
    root: phone,
    update(a) {
      const idx = Math.min(2, Math.floor(a * 3));
      if (idx !== shown) { shown = idx; screenMat.map = textures[idx]; }
      phone.rotation.y = through([-0.5, 0.42, -0.1], a);
      phone.rotation.x = through([0.05, -0.05, 0.04], a);
      phone.rotation.z = through([0.03, -0.03, 0.02], a);
    },
    wide: { x: 2.7, y: 0, s: 1 },
    narrow: { x: 0, y: -1.7, s: 0.74 },
    still: { x: 0, y: 0, s: 1, p: 0.5 },
  };
}

/** How far below its resting spot each object sits while centred. The first peeks in from the bottom; the rest rise to mid-screen. */
const DROP = [2.6, 0.7, 0.7, 0.7];

export function mountShowcase(canvas: HTMLCanvasElement): Showcase | null {
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

  const ctx = makeCtx(renderer);
  const objects = [buildSaas, buildCards, buildLaptop, buildCore].map((build) => {
    const built = build(ctx);
    const holder = new Group();
    holder.add(built.root);
    holder.visible = false;
    scene.add(holder);
    return { built, holder };
  });

  let sy = 0, syT = 0, vh = innerHeight;
  let sections: Section[] = [];
  let px = 0, py = 0, tx = 0, ty = 0;
  let wide = true, lastW = 0;
  let raf = 0, running = false, wanted = false, born = -1;

  function resize() {
    const w = innerWidth, h = innerHeight;
    if (w === lastW && Math.abs(h - canvas.clientHeight) < 140) return;
    lastW = w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wide = w / h > 1.2;
  }
  const onPointer = (e: PointerEvent) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; };

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    if (born === -1) born = t;
    const intro = 1 - easeOutCubic(clamp01((t - born) / 1.5));
    sy += (syT - sy) * 0.2;
    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    render(t, intro);
  }

  function render(t: number, intro: number) {
    objects.forEach(({ built, holder }, i) => {
      const sec = sections[i];
      if (!sec) { holder.visible = false; return; }
      const ph = phases(sy, vh, sec, i === 0);
      holder.visible = ph.visible;
      if (!ph.visible) return;

      const side = wide ? built.wide : built.narrow;
      const lowY = side.y - DROP[i] * (side.s / built.wide.s);
      const belowY = lowY - 5.8;

      let x = 0, y: number, s = side.s;
      if (ph.enter < 1) {
        y = lerp(belowY, lowY, 1 - Math.pow(1 - ph.enter, 2.4)); // fast at first, so it meets the outgoing object
      } else if (ph.move < 1) {
        const m = smooth(ph.move);
        x = lerp(0, side.x, m);
        y = lerp(lowY, side.y, m);
      } else {
        x = side.x; y = side.y;
      }
      if (ph.exit > 0) {
        const e = Math.pow(ph.exit, 2.2); // slow at first, then accelerates away
        y += 5.9 * e;
        s *= 1 - 0.12 * e;
      }
      if (i === 0) y -= intro * 1.8;

      holder.position.set(x, y + Math.sin(t * 0.8 + i) * 0.04, 0);
      holder.scale.setScalar(s);
      holder.rotation.y = px * 0.08;
      holder.rotation.x = py * 0.04;
      built.update(ph.a, t);
    });
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
    setScroll(scroll, viewH, secs) { syT = scroll; vh = viewH; sections = secs; },
    setRunning(on) { wanted = on; sync(); },
    snap() {
      sy = syT; born = -100;
      render(performance.now() / 1000, 0);
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
