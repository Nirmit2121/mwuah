// Mwuah — minimal hash router.
import { pageEnter } from './effects.js';

const routes = [];
let current = null; // { destroy }

export function route(path, handler) { routes.push({ path, handler }); }

function currentPath() {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/';
}

async function resolve() {
  const path = currentPath();
  const match = routes.find((r) => r.path === path) || routes[0];
  if (current && typeof current.destroy === 'function') {
    try { current.destroy(); } catch {}
  }
  const content = document.getElementById('content');
  content.innerHTML = '';
  // active nav
  document.querySelectorAll('.navitem').forEach((el) => {
    el.classList.toggle('is-active', el.getAttribute('data-route') === match.path);
  });
  window.scrollTo({ top: 0 });
  current = (await match.handler({ content })) || null;
  pageEnter(content);
}

export function navigate(path) {
  const next = '#' + (path.startsWith('/') ? path : '/' + path);
  if (window.location.hash === next) resolve();
  else window.location.hash = next;
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
