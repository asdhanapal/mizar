import type { Showcase } from './showcase';
import { chapterAt, phases, type Section } from './timeline';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
const nav = navigator as Navigator & { deviceMemory?: number };
const coarse = matchMedia('(pointer: coarse)').matches;
// Data-saver, very few cores, or a modest phone: keep the light layout instead of the 3D scene.
const lowPower = Boolean(conn?.saveData) || (nav.hardwareConcurrency ?? 8) <= 2 || (coarse && ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4));

async function boot() {
  // Native scrolling only: the pinned sections use CSS sticky, and a smooth-scroll library on top of it
  // fights the browser's own wheel, trackpad and touch handling.
  const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);

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
    const showcase: Showcase | null = await mountShowcase(canvas);
    if (!showcase) return;
    if (import.meta.env.DEV) (window as unknown as { __showcase: Showcase }).__showcase = showcase;

    // Switch to the pinned scroll layout only once WebGL is really running
    document.documentElement.classList.add('story-on');

    const aura = [...document.querySelectorAll<HTMLElement>('#aura i')];
    const groups = blocks.map((b) => ({ chapters: [...b.querySelectorAll<HTMLElement>('[data-chapter]')], active: -1 }));
    let sections: Section[] = [];

    // A fixed 100vh probe: unlike innerHeight it does not change when a phone's address bar shows or hides,
    // so the timeline (measured in viewport heights) stays put while you swipe.
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const stableVh = () => probe.offsetHeight || innerHeight;

    const measure = () => {
      sections = blocks.map((b) => ({ start: b.getBoundingClientRect().top + scrollY, len: b.offsetHeight }));
      update();
    };
    const update = () => {
      const sy = scrollY, vh = stableVh();
      blocks.forEach((b, i) => {
        if (!sections[i]) return;
        const ph = phases(sy, vh, sections[i], i === 0);
        b.style.setProperty('--o', ph.text.toFixed(3));
        const rise = i === 0 ? 1 : ph.enter * ph.enter * (3 - 2 * ph.enter);
        if (aura[i]) aura[i].style.opacity = (ph.visible ? rise * (1 - ph.exit) : 0).toFixed(3);
        const g = groups[i];
        if (g.chapters.length) {
          const idx = chapterAt(ph.a, g.chapters.length);
          if (idx !== g.active) {
            g.chapters.forEach((c, k) => c.classList.toggle('is-active', k === idx));
            g.active = idx;
          }
        }
      });
      showcase.setScroll(sy, vh, sections);
    };

    measure();
    ScrollTrigger.refresh();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', measure, { passive: true });
    addEventListener('orientationchange', measure, { passive: true });
    if (import.meta.env.DEV) (window as unknown as { __update: () => void }).__update = update;

    canvas.style.opacity = '1';
    new IntersectionObserver(([entry]) => {
      showcase.setRunning(entry.isIntersecting);
      canvas.style.opacity = entry.isIntersecting ? '1' : '0';
    }).observe(zone);
  };
  // Start after the page has fully loaded, so the 3D work never competes with the first paint.
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 800));
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}

if (!reduce) boot();
