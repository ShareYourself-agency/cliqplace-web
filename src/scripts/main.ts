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
    const dur = 2600; const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 2.2);
      out.textContent = fmt.format(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
      else out.classList.add('fx-done');
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { run(en.target as HTMLElement); io.unobserve(en.target); } });
  }, { threshold: 0.6, rootMargin: '0px 0px -10% 0px' });
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
      if (!progress && stage) stage.style.setProperty('--stage-h', `${items[active].offsetHeight}px`);
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
    if (!progress && stage && 'ResizeObserver' in window) new ResizeObserver(() => render()).observe(stage);

    // steps: driven by scroll position (1 → 4 while the pinned box is on screen)
    if (root.hasAttribute('data-scroll-steps')) {
      const wrap = root.closest('section') as HTMLElement;
      const pinTop = () => parseFloat(getComputedStyle(wrap.querySelector('.container')!).top) || 0;
      const progressOf = () => {
        const r = wrap.getBoundingClientRect();
        const travel = r.height - (root.offsetHeight + pinTop());
        return travel > 0 ? Math.min(1, Math.max(0, (pinTop() - r.top) / travel)) : 0;
      };
      let ticking = false;
      const onScroll = () => {
        ticking = false;
        const i = Math.min(n - 1, Math.floor(progressOf() * n));
        if (i !== active) go(i, true);
      };
      addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
      onScroll();
      // dragging the slider scrolls the page to that step
      range?.addEventListener('change', () => {
        const r = wrap.getBoundingClientRect();
        const travel = r.height - (root.offsetHeight + pinTop());
        const target = scrollY + r.top - pinTop() + travel * ((Number(range.value) + 0.5) / n);
        scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      return;
    }
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


/* ================================================================== FX */
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function initProgress() {
  const bar = document.createElement('div');
  bar.className = 'fx-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  let ticking = false;
  const upd = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', String(max > 0 ? Math.min(1, scrollY / max) : 0));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
}

function initSplit() {
  const heads = document.querySelectorAll<HTMLElement>('main .h1, main .h2');
  heads.forEach((h) => {
    let wi = 0;
    const walk = (node: Node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = (child.textContent || '').split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'fx-w'; w.style.setProperty('--wi', String(wi++)); w.textContent = part;
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== 'BR') {
          walk(child);
        }
      });
    };
    h.setAttribute('aria-label', h.textContent?.replace(/\s+/g, ' ').trim() || '');
    walk(h);
    h.querySelectorAll('.fx-w').forEach((w) => w.setAttribute('aria-hidden', 'true'));
    h.classList.add('fx-split');
  });
  if (reduceMotion) { heads.forEach((h) => h.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: 0.2, rootMargin: '0px 0px -5% 0px' });
  heads.forEach((h) => io.observe(h));
}

function initShine() {
  // calm hover: soft lime edge glow (no white sweep)
  document.querySelectorAll('.btn, .trio__card, .audience, .pillar, .faq__item, .how-card, .how-cta, .glass, .bcard, .review').forEach((el) => el.classList.add('fx-glow'));
  document.querySelectorAll('.glass, .bcard--cta, .final-cta__card, .hw-more, .pt-data').forEach((el) => el.classList.add('fx-neon'));
  document.querySelectorAll('.audience, .trio__card').forEach((el) => el.classList.add('fx-lift'));
}

function initTilt() {
  if (!finePointer || reduceMotion) return;
  const els = document.querySelectorAll<HTMLElement>('.pillar, .audience, .glass, .bcard, .trio__card, .final-cta__card, .how-card');
  els.forEach((el) => {
    el.classList.add('fx-tilt');
    const glare = document.createElement('span');
    glare.className = 'fx-glare'; glare.setAttribute('aria-hidden', 'true');
    el.appendChild(glare);
    const big = el.classList.contains('final-cta__card') || el.classList.contains('how-card');
    const max = big ? 2.5 : el.classList.contains('bcard') ? 3 : el.classList.contains('trio__card') || el.classList.contains('audience') ? 4 : 5;
    // target & current values, eased every frame → silky, no jumps
    let tx = 0, ty = 0, cx = 0, cy = 0, mx = 50, my = 50, raf = 0, rect: DOMRect | null = null;
    const loop = () => {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      el.style.setProperty('--rx', `${cy.toFixed(3)}deg`);
      el.style.setProperty('--ry', `${cx.toFixed(3)}deg`);
      el.style.setProperty('--mx', `${mx}%`);
      el.style.setProperty('--my', `${my}%`);
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.01 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener('pointerenter', () => { rect = el.getBoundingClientRect(); el.classList.add('is-tilting'); });
    el.addEventListener('pointermove', (e) => {
      if (!rect) rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width; const y = (e.clientY - rect.top) / rect.height;
      tx = (x - 0.5) * max * 2; ty = (0.5 - y) * max * 2;
      mx = Math.round(x * 100); my = Math.round(y * 100);
      kick();
    });
    el.addEventListener('pointerleave', () => { tx = 0; ty = 0; rect = null; el.classList.remove('is-tilting'); kick(); });
  });
}

function initMagnetic() {
  if (!finePointer || reduceMotion) return;
  document.querySelectorAll<HTMLElement>('.btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2); const dy = e.clientY - (r.top + r.height / 2);
      b.style.translate = `${dx * 0.18}px ${dy * 0.28 - 2}px`;
    });
    b.addEventListener('pointerleave', () => { b.style.translate = ''; });
  });
}

function initSpotlight() {
  if (!finePointer || reduceMotion) return;
  document.querySelectorAll<HTMLElement>('.dark-shell, .around__box, .steps, .site-footer').forEach((sec) => {
    const spot = document.createElement('div');
    spot.className = 'fx-spot'; spot.setAttribute('aria-hidden', 'true');
    sec.prepend(spot);
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.15; cy += (ty - cy) * 0.15;
      spot.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    sec.addEventListener('pointermove', (e) => {
      const r = sec.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (!spot.classList.contains('is-on')) { cx = tx; cy = ty; spot.classList.add('is-on'); }
      if (!raf) raf = requestAnimationFrame(loop);
    });
    sec.addEventListener('pointerleave', () => spot.classList.remove('is-on'));
  });
}

function initHeroParallax() {
  if (reduceMotion) return;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.hero-card'));
  const hero = document.querySelector<HTMLElement>('.home-hero');
  if (finePointer && cards.length && hero) {
    // smooth (lerped) parallax – no jumps when the cursor enters/leaves or crosses a card
    const depth = [14, 8, 18];
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      cards.forEach((c, i) => { c.style.translate = `${(-cx * depth[i]).toFixed(2)}px ${(-cy * depth[i]).toFixed(2)}px`; });
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    hero.addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; kick(); });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }
  // subpage hero visual: tilts back and straightens on scroll
  const vis = document.querySelector<HTMLElement>('.page-hero__visual');
  if (vis) {
    const target = vis.firstElementChild as HTMLElement | null;
    if (!target) return;
    target.style.transformOrigin = '50% 100%';
    target.style.willChange = 'transform';
    let ticking = false;
    const upd = () => {
      ticking = false;
      const p = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.55)));
      target.style.transform = `perspective(1400px) rotateX(${(1 - p) * 16}deg) scale(${0.93 + p * 0.07})`;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }
}

function initFloat() {
  if (reduceMotion) return;
  document.querySelectorAll<HTMLElement>('.glass__img, .how-cta__img').forEach((el, i) => {
    el.classList.add('fx-float');
    el.style.animationDelay = `${-i * 1.3}s`;
  });
}

initSplit();
initShine();
initTilt();
initSpotlight();
initHeroParallax();
initFloat();
initProgress();
initHeader();
initReveal();
initCounters();
initLoops();
initCables();
initVideos();
