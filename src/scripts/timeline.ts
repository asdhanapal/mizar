export interface Section { start: number; len: number }

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const smooth = (t: number) => t * t * (3 - 2 * t);

export interface Phase {
  visible: boolean;
  /** 0 below the screen, 1 centred at the bottom */
  enter: number;
  /** 0 centred, 1 settled on the right */
  move: number;
  /** progress of the object's own animation while it holds on the right */
  a: number;
  /** 0 holding, 1 gone off the top */
  exit: number;
  /** text opacity for the section */
  text: number;
}

/**
 * Where one showcase object is in its life, from the scroll position.
 * Object i enters in the last stretch of section i-1, so the hand-off overlaps.
 */
export function phases(sy: number, vh: number, sec: Section, first: boolean): Phase {
  const enterLen = 0.6 * vh, moveLen = 0.5 * vh, exitLen = 0.6 * vh;
  const t0 = first ? -Infinity : sec.start - enterLen;
  const t1 = first ? 0 : sec.start;
  const t2 = first ? sec.start : sec.start + moveLen;
  const t3 = sec.start + sec.len - exitLen;
  const t4 = sec.start + sec.len;
  const from = first ? 0.75 : 0.1;
  const fadeIn = smooth(clamp01((sy - (t1 + (t2 - t1) * from)) / ((t2 - t1) * (1 - from) || 1)));
  // the text stays fully readable while the object starts to leave, then fades
  const fadeOut = 1 - smooth(clamp01((sy - (t3 + exitLen * 0.3)) / (exitLen * 0.5)));
  return {
    visible: sy > t0 && sy < t4,
    enter: first ? 1 : clamp01((sy - t0) / (t1 - t0)),
    move: clamp01((sy - t1) / (t2 - t1 || 1)),
    a: clamp01((sy - t2) / (t3 - t2 || 1)),
    exit: clamp01((sy - t3) / (t4 - t3 || 1)),
    text: fadeIn * fadeOut,
  };
}

/**
 * Which chapter is showing, for progress `a` (0..1) through a section's hold.
 * The last chapter gets a longer share, so a swipe that lands on it does not carry straight through to the exit.
 */
export function chapterAt(a: number, n: number): number {
  if (n <= 1) return 0;
  const weights = Array.from({ length: n }, (_, i) => (i === n - 1 ? 1.6 : 1));
  const total = weights.reduce((x, y) => x + y, 0);
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    acc += weights[i] / total;
    if (a + 0.03 < acc) return i;
  }
  return n - 1;
}
