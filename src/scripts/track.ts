/** Sends an event to whichever analytics is switched on in site.ts. Does nothing if none is. */
type Gtag = (cmd: string, name: string, params?: Record<string, unknown>) => void;
type Plausible = (name: string, opts?: { props?: Record<string, unknown> }) => void;

export function track(name: string, params: Record<string, unknown> = {}) {
  const w = window as unknown as { gtag?: Gtag; plausible?: Plausible };
  try {
    w.gtag?.('event', name, params);
    w.plausible?.(name, { props: params });
  } catch {
    /* analytics must never break the page */
  }
}

// Any element with data-track="event_name", plus every "book a consultation / demo" link.
document.addEventListener('click', (e) => {
  const el = (e.target as Element | null)?.closest<HTMLElement>('[data-track], a[href^="/contact/"]');
  if (!el) return;
  track(el.dataset.track || 'cta_contact_click', { page: location.pathname });
});
