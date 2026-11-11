/* Cliqplace CRM – instant navigation without a framework.
   Links + forms inside /admin are fetched and the <body> is swapped (no full reload),
   pages are prefetched on hover / touch, so clicks feel immediate. Everything works without JS too. */

const cache = new Map<string, { at: number; p: Promise<Response> }>();
const TTL = 20_000;
const progress = () => document.querySelector<HTMLElement>('[data-progress]');
let busy = 0;

function start() {
  busy++;
  const p = progress();
  if (!p) return;
  p.classList.add('is-on');
  p.style.width = '30%';
  requestAnimationFrame(() => (p.style.width = '70%'));
}
function done() {
  busy = Math.max(0, busy - 1);
  const p = progress();
  if (!p || busy) return;
  p.style.width = '100%';
  setTimeout(() => { p.classList.remove('is-on'); p.style.width = '0'; }, 220);
}

const isAdminUrl = (u: URL) => u.origin === location.origin && u.pathname.startsWith('/admin') && !u.pathname.endsWith('.csv') && !u.pathname.startsWith('/admin/zalohy/stahnout');

function prefetch(href: string) {
  const u = new URL(href, location.href);
  if (!isAdminUrl(u)) return;
  const key = u.pathname + u.search;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return;
  cache.set(key, { at: Date.now(), p: fetch(key, { credentials: 'same-origin', headers: { 'x-prefetch': '1' } }) });
}

async function swap(res: Response, push: 'push' | 'replace' | 'none', keepScroll = false) {
  const html = await res.text();
  const finalUrl = new URL(res.url || location.href);
  if (!res.headers.get('content-type')?.includes('text/html')) { location.href = finalUrl.href; return; }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const y = scrollY;
  document.title = doc.title;
  document.body.replaceWith(document.adoptNode(doc.body));
  if (push === 'push' && finalUrl.href !== location.href) history.pushState({}, '', finalUrl.href);
  else if (push !== 'none') history.replaceState({}, '', finalUrl.href);
  scrollTo(0, keepScroll ? y : 0);
  const auto = document.querySelector<HTMLElement>('[autofocus]');
  if (auto && !keepScroll) auto.focus();
  document.dispatchEvent(new CustomEvent('crm:load'));
}

async function navigate(href: string, push: 'push' | 'replace' | 'none' = 'push') {
  const u = new URL(href, location.href);
  const key = u.pathname + u.search;
  start();
  try {
    const hit = cache.get(key);
    const res = hit && Date.now() - hit.at < TTL ? (await hit.p).clone() : await fetch(key, { credentials: 'same-origin' });
    cache.delete(key);
    await swap(res, push);
    if (u.hash) document.getElementById(u.hash.slice(1))?.scrollIntoView();
  } catch {
    location.href = u.href;
  } finally {
    done();
  }
}

async function submit(form: HTMLFormElement, submitter: HTMLElement | null) {
  const method = (form.getAttribute('method') || 'get').toLowerCase();
  const action = new URL(form.getAttribute('action') || location.href, location.href);
  const fd = new FormData(form, submitter as HTMLButtonElement | null);
  if (method === 'get') {
    const q = new URLSearchParams();
    fd.forEach((v, k) => { if (String(v) !== '') q.append(k, String(v)); });
    action.search = q.toString();
    return navigate(action.href);
  }
  start();
  form.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    const body = new URLSearchParams();
    fd.forEach((v, k) => body.append(k, String(v)));
    const res = await fetch(action.pathname + action.search, { method: 'POST', body, credentials: 'same-origin', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    cache.clear();
    const samePage = new URL(res.url).pathname === location.pathname;
    await swap(res, samePage ? 'replace' : 'push', samePage);
  } catch {
    form.submit();
  } finally {
    done();
  }
}

/* ---------- events (delegated, survive body swaps) ---------- */
document.addEventListener('pointerover', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]:not([data-native])');
  if (a) prefetch(a.href);
  const row = (e.target as Element).closest<HTMLElement>('[data-href]');
  if (row) prefetch(row.dataset.href!);
}, { passive: true });
document.addEventListener('touchstart', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]:not([data-native]), [data-href]');
  if (a) prefetch((a as HTMLAnchorElement).href || (a as HTMLElement).dataset.href!);
}, { passive: true });

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const t = e.target as Element;
  const a = t.closest<HTMLAnchorElement>('a[href]');
  if (a) {
    if (a.hasAttribute('data-native') || a.target || a.hasAttribute('download')) return;
    const u = new URL(a.href);
    if (!isAdminUrl(u) || (u.pathname === location.pathname && u.search === location.search && u.hash)) return;
    e.preventDefault();
    document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]').forEach((d) => (d.open = false));
    navigate(u.href);
    return;
  }
  const row = t.closest<HTMLElement>('[data-href]');
  if (row && !t.closest('button, input, select, textarea, label, form')) {
    e.preventDefault();
    navigate(row.dataset.href!);
  }
  // close the user menu when clicking outside
  document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]').forEach((d) => { if (!d.contains(t)) d.open = false; });
});

document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  const msg = form.dataset.confirm;
  if (msg && !confirm(msg)) { e.preventDefault(); return; }
  if (form.hasAttribute('data-native')) return;
  const action = new URL(form.getAttribute('action') || location.href, location.href);
  if (!isAdminUrl(action)) return;
  e.preventDefault();
  submit(form, (e as SubmitEvent).submitter);
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLElement;
  if (el.matches('[data-autosubmit]')) (el as HTMLInputElement).form?.requestSubmit();
});

addEventListener('popstate', () => navigate(location.href, 'none'));

/* ---------- pipeline drag & drop ---------- */
let dragId = '';
document.addEventListener('dragstart', (e) => {
  const card = (e.target as Element).closest<HTMLElement>('[data-card]');
  if (!card) return;
  dragId = card.dataset.card!;
  card.classList.add('is-dragging');
  e.dataTransfer?.setData('text/plain', dragId);
});
document.addEventListener('dragend', (e) => {
  (e.target as Element).closest('[data-card]')?.classList.remove('is-dragging');
  document.querySelectorAll('.col.is-over').forEach((c) => c.classList.remove('is-over'));
});
document.addEventListener('dragover', (e) => {
  const col = (e.target as Element).closest<HTMLElement>('[data-stage]');
  if (!col || !dragId) return;
  e.preventDefault();
  document.querySelectorAll('.col.is-over').forEach((c) => c !== col && c.classList.remove('is-over'));
  col.classList.add('is-over');
});
document.addEventListener('drop', async (e) => {
  const col = (e.target as Element).closest<HTMLElement>('[data-stage]');
  if (!col || !dragId) return;
  e.preventDefault();
  const card = document.querySelector<HTMLElement>(`[data-card="${dragId}"]`);
  const list = col.querySelector('[data-list]');
  if (card && list && card.parentElement !== list) list.prepend(card);
  const body = new URLSearchParams({ action: 'stage', status: col.dataset.stage!, from: 'pipeline' });
  const id = dragId;
  dragId = '';
  start();
  try {
    await fetch(`/admin/lead/${id}`, { method: 'POST', body, credentials: 'same-origin', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    cache.clear();
    const res = await fetch(location.pathname + location.search, { credentials: 'same-origin' });
    await swap(res, 'none', true);
  } finally {
    done();
  }
});
