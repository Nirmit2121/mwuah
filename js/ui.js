// Mwuah — UI helpers: modals, formatting, dates.
import { CURRENCY } from './config.js';

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Open a modal with arbitrary inner HTML. Returns { close }.
export function openModal({ title, body, onMount }) {
  const backdrop = el(`<div class="modal-backdrop"></div>`);
  const modal = el(`
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h2>${escapeHtml(title || '')}</h2>
        <button class="modal__close" aria-label="Close">×</button>
      </div>
      <div class="modal__body"></div>
    </div>`);
  modal.querySelector('.modal__body').innerHTML = body || '';
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close() { backdrop.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }

  modal.querySelector('.modal__close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);

  if (onMount) onMount(modal.querySelector('.modal__body'), close);
  return { close, root: modal };
}

export function confirmDelete(message = 'Delete this?') {
  return window.confirm(message);
}

// ---------- formatting ----------
export function money(n) {
  const v = Number(n || 0);
  return CURRENCY + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function todayStr() {
  const d = new Date();
  return ymd(d);
}
export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseYmd(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function daysBetween(a, b) {
  return Math.round((a - b) / 86400000);
}
export function prettyDate(s) {
  if (!s) return '';
  const d = parseYmd(s.slice(0, 10));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function shortDate(s) {
  if (!s) return '';
  const d = parseYmd(s.slice(0, 10));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ---------- heart burst from a point ----------
export function heartBurst(x, y) {
  const hearts = ['💖', '💕', '💗', '💞', '💘'];
  for (let i = 0; i < 6; i++) {
    const h = el(`<div class="heart-burst">${hearts[i % hearts.length]}</div>`);
    h.style.left = (x - 14 + (Math.random() * 40 - 20)) + 'px';
    h.style.top = (y - 14) + 'px';
    h.style.animationDelay = (i * 60) + 'ms';
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1300);
  }
}

export function whoTag(person) {
  if (!person) return '';
  return `<span class="who who--${person.key}"><span class="who__dot"></span>${escapeHtml(person.name)}</span>`;
}
