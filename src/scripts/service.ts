import type { Kind, Stage } from './stage';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const svc = document.getElementById('svc');
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

async function boot() {
  if (!canvas || !svc || !document.documentElement.classList.contains('svc-on')) return;
  const { mountStage } = await import('./stage');
  const stage: Stage | null = mountStage(canvas, canvas.dataset.kind as Kind);
  if (!stage) {
    document.documentElement.classList.remove('svc-on');
    return;
  }
  if (import.meta.env.DEV) (window as unknown as { __stage: Stage }).__stage = stage;

  const onScroll = () => {
    const total = svc.offsetHeight - innerHeight;
    stage.setProgress(total > 0 ? clamp01(-svc.getBoundingClientRect().top / total) : 0);
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
  new IntersectionObserver(([entry]) => stage.setRunning(entry.isIntersecting)).observe(svc);
  canvas.style.opacity = '1';
}

boot();
