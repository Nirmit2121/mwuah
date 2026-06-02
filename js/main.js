// Mwuah — app bootstrap.
import { requireAuth, whoami, lock } from './auth.js';
import { isConfigured } from './supabase.js';
import { route, start } from './router.js';
import { mountHome } from './pages/home.js';
import { mountExpenses } from './pages/expenses.js';
import { mountCycle } from './pages/cycle.js';
import { mountNotes } from './pages/notes.js';
import { mountBucket } from './pages/bucket.js';
import { mountMemories } from './pages/memories.js';
import { mountDaily } from './pages/daily.js';
import { mountDates } from './pages/dates.js';
import { mountSavings } from './pages/savings.js';
import { startPetals } from './effects.js';

function paintUserChip() {
  const me = whoami();
  const chip = document.getElementById('userchip');
  if (!chip || !me) return;
  chip.innerHTML = `
    <span>${me.name}</span>
    <span class="userchip__avatar" style="background:${me.color}">${me.emoji}</span>`;
}

function paintDemoPill() {
  if (isConfigured) return;
  const slot = document.getElementById('demoPill');
  if (slot) slot.innerHTML = `<span class="demo-pill" title="Data is stored only in this browser. Add Supabase keys to sync.">DEMO</span>`;
}

function wireTopbar() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await lock();
    window.location.href = 'login.html';
  });
}

function registerRoutes() {
  route('/',          mountHome);
  route('/expenses',  mountExpenses);
  route('/cycle',     mountCycle);
  route('/notes',     mountNotes);
  route('/bucket',    mountBucket);
  route('/memories',  mountMemories);
  route('/dates',     mountDates);
  route('/daily',     mountDaily);
  route('/savings',   mountSavings);
}

function boot() {
  if (!requireAuth()) return;
  paintUserChip();
  paintDemoPill();
  wireTopbar();
  registerRoutes();
  start();
  startPetals();
}

boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
