import type { SceneHandle } from './scene';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
const lowPower = Boolean(conn?.saveData) || (navigator.hardwareConcurrency ?? 8) <= 2;

async function boot() {
  const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('lenis'),
  ]);
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const zone = document.getElementById('scene-zone');
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  const story = document.getElementById('story');
  const chapters = story ? [...story.querySelectorAll<HTMLElement>('[data-chapter]')] : [];
  let scene: SceneHandle | null = null;
  let progress = 0;

  if (story && chapters.length) {
    document.documentElement.classList.add('story-on');
    chapters[0].classList.add('is-active');
    let active = 0;
    ScrollTrigger.create({
      trigger: story,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        progress = self.progress;
        const next = Math.min(chapters.length - 1, Math.floor(self.progress * chapters.length));
        if (next !== active) {
          chapters[active].classList.remove('is-active');
          chapters[next].classList.add('is-active');
          active = next;
        }
        scene?.setProgress(progress);
      },
    });
    ScrollTrigger.refresh();
  }

  if (!lowPower && canvas && zone) {
    const start = async () => {
      const { mountScene } = await import('./scene');
      scene = mountScene(canvas);
      if (!scene) return;
      scene.setProgress(progress);
      canvas.style.opacity = '1';
      new IntersectionObserver(([entry]) => {
        scene?.setRunning(entry.isIntersecting && !document.hidden);
        canvas.style.opacity = entry.isIntersecting ? '1' : '0';
      }).observe(zone);
    };
    'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 400);
  }
}

if (!reduce) boot();
