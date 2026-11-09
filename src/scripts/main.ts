/* Cliqplace – interactions & animations (vanilla, progressive enhancement) */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ header */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const label = toggle?.querySelector('.sr-only');

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setOpen = (open: boolean) => {
    header.classList.toggle('menu-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Zavřít menu' : 'Otevřít menu';
    document.documentElement.style.overflow = open ? 'hidden' : '';
  };
  toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  header.querySelectorAll('.site-nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) { setOpen(false); toggle?.focus(); }
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ------------------------------------------------------------------ reveal */
function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ count up */
function initCounters() {
  const els = document.querySelectorAll<HTMLElement>('[data-count-to]');
  const fmt = new Intl.NumberFormat('cs-CZ');
  const run = (el: HTMLElement) => {
    const to = Number(el.dataset.countTo || 0);
    const out = el.querySelector<HTMLElement>('[data-count-value]') || el;
    if (reduceMotion) { out.textContent = fmt.format(to); return; }
    const dur = 1800; const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      out.textContent = fmt.format(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { run(en.target as HTMLElement); io.unobserve(en.target); } });
  }, { threshold: 0.4 });
  els.forEach((el) => { const out = el.querySelector<HTMLElement>('[data-count-value]'); if (out) out.textContent = '0'; io.observe(el); });
}

/* ------------------------------------------------------------------ loops (reviews + steps) */
function initLoops() {
  document.querySelectorAll<HTMLElement>('[data-loop]').forEach((root) => {
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-loop-item]'));
    const n = items.length;
    if (!n) return;
    const range = root.querySelector<HTMLInputElement>('[data-loop-range]');
    const stage = root.querySelector<HTMLElement>('[data-loop-stage]');
    const live = root.querySelector<HTMLElement>('[data-loop-live]');
    const list = root.querySelector<HTMLElement>('.steps__list');
    const progress = root.hasAttribute('data-progress');
    const interval = Number(root.dataset.interval || 6000);
    let active = 0;
    let timer: number | undefined;
    let visible = false;
    let hovering = false;
    let userPausedUntil = 0;

    const render = (announce = false) => {
      items.forEach((el, i) => {
        if (progress) {
          el.dataset.state = i < active ? 'done' : i === active ? 'active' : 'next';
        } else {
          let d = i - active;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          el.dataset.pos = String(Math.abs(d) <= 1 ? d : d > 0 ? 2 : -2);
          const hidden = d !== 0;
          el.setAttribute('aria-hidden', String(hidden));
        }
      });
      if (list) list.style.transform = `translateX(${-active * 100}%)`;
      if (range) {
        range.value = String(active);
        range.style.setProperty('--p', `${n > 1 ? (active / (n - 1)) * 100 : 0}%`);
        const name = items[active].querySelector('h3')?.textContent?.trim() || `${active + 1}`;
        range.setAttribute('aria-valuetext', `${active + 1} z ${n}: ${name}`);
        if (announce && live) live.textContent = `${active + 1} z ${n}: ${name}`;
      }
    };

    const go = (i: number, announce = false) => { active = ((i % n) + n) % n; render(announce); };
    const tick = () => {
      if (!visible || hovering || Date.now() < userPausedUntil || document.hidden) return;
      go(active + 1);
    };
    const userAction = () => { userPausedUntil = Date.now() + interval * 2; };

    range?.addEventListener('input', () => { userAction(); go(Number(range.value), true); });

    // click on side review card
    items.forEach((el, i) => el.addEventListener('click', () => { if (i !== active) { userAction(); go(i, true); } }));

    // swipe
    if (stage) {
      let x0: number | null = null; let y0 = 0;
      stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; }, { passive: true });
      stage.addEventListener('pointerup', (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0; const dy = e.clientY - y0; x0 = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { userAction(); go(active + (dx < 0 ? 1 : -1), true); }
      });
      stage.addEventListener('pointercancel', () => { x0 = null; });
    }

    root.addEventListener('mouseenter', () => { hovering = true; });
    root.addEventListener('mouseleave', () => { hovering = false; });
    root.addEventListener('focusin', () => { hovering = true; });
    root.addEventListener('focusout', () => { hovering = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.35 }).observe(root);
    }
    render();
    if (!reduceMotion) timer = window.setInterval(tick, interval);
    void timer;
  });
}

/* ------------------------------------------------------------------ neon cable drawn on scroll */
function initCables() {
  const cables = Array.from(document.querySelectorAll<SVGSVGElement>('[data-cable]'));
  if (!cables.length) return;
  const paths = cables.map((svg) => {
    const ps = Array.from(svg.querySelectorAll<SVGPathElement>('[data-cable-path]'));
    ps.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = reduceMotion ? '0' : `${len}`; p.dataset.len = String(len); });
    return { svg, ps, section: svg.closest('section') as HTMLElement };
  });
  if (reduceMotion) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    paths.forEach(({ ps, section }) => {
      const r = section.getBoundingClientRect();
      // 0 when section top hits 85% of viewport, 1 when section bottom reaches 70%
      const start = vh * 0.85; const total = r.height + start - vh * 0.7;
      const p = Math.min(1, Math.max(0, (start - r.top) / total));
      ps.forEach((path) => { const len = Number(path.dataset.len); path.style.strokeDashoffset = String(len * (1 - p)); });
    });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/* ------------------------------------------------------------------ videos: play only when visible */
function initVideos() {
  const vids = document.querySelectorAll<HTMLVideoElement>('video[data-inview]');
  if (!vids.length) return;
  if (reduceMotion) { vids.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); }); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const v = en.target as HTMLVideoElement;
      if (en.isIntersecting) {
        if (v.preload === 'none') { v.preload = 'auto'; }
        v.play().catch(() => {});
      } else v.pause();
    });
  }, { threshold: 0.2 });
  vids.forEach((v) => io.observe(v));
}

initHeader();
initReveal();
initCounters();
initLoops();
initCables();
initVideos();
