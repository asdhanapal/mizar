import type { Showcase } from './showcase';
import { phases, type Section } from './timeline';

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

  // Statement: words light up from grey to black as you scroll
  const words = document.querySelectorAll('#statement .word');
  if (words.length) {
    gsap.fromTo(
      words,
      { color: '#c7c7cc' },
      { color: '#1d1d1f', ease: 'none', stagger: 0.12, scrollTrigger: { trigger: '#statement', start: 'top 74%', end: 'bottom 58%', scrub: true } },
    );
  }

  const zone = document.getElementById('scene-zone');
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  const blocks = [...document.querySelectorAll<HTMLElement>('[data-svc]')];
  if (lowPower || !zone || !canvas || !blocks.length) return;

  const start = async () => {
    const { mountShowcase } = await import('./showcase');
    const showcase: Showcase | null = mountShowcase(canvas);
    if (!showcase) return;
    if (import.meta.env.DEV) (window as unknown as { __showcase: Showcase }).__showcase = showcase;

    // Switch to the pinned scroll layout only once WebGL is really running
    document.documentElement.classList.add('story-on');

    const core = blocks.find((b) => b.dataset.svc === 'core');
    const chapters = core ? [...core.querySelectorAll<HTMLElement>('[data-chapter]')] : [];
    let activeChapter = -1;
    let sections: Section[] = [];

    const measure = () => {
      sections = blocks.map((b) => ({ start: b.getBoundingClientRect().top + scrollY, len: b.offsetHeight }));
      update();
    };
    const update = () => {
      const sy = scrollY, vh = innerHeight;
      blocks.forEach((b, i) => {
        if (!sections[i]) return;
        const ph = phases(sy, vh, sections[i], i === 0);
        b.style.setProperty('--o', ph.text.toFixed(3));
        if (b === core && chapters.length) {
          const idx = Math.min(chapters.length - 1, Math.floor(ph.a * chapters.length));
          if (idx !== activeChapter) {
            chapters.forEach((c, k) => c.classList.toggle('is-active', k === idx));
            activeChapter = idx;
          }
        }
      });
      showcase.setScroll(sy, vh, sections);
    };

    measure();
    ScrollTrigger.refresh();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', measure, { passive: true });
    lenis.on('scroll', update);

    canvas.style.opacity = '1';
    new IntersectionObserver(([entry]) => {
      showcase.setRunning(entry.isIntersecting);
      canvas.style.opacity = entry.isIntersecting ? '1' : '0';
    }).observe(zone);
  };
  'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 300);
}

if (!reduce) boot();
