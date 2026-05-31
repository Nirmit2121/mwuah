// Mwuah — shared bucket list & date ideas ✨
import { bucket } from '../api.js';
import { whoami } from '../auth.js';
import { PEOPLE } from '../config.js';
import { openModal, escapeHtml } from '../ui.js';
import { toast } from '../state.js';

const DATE_IDEAS = [
  'Cook a new recipe together 🍝', 'Sunset picnic 🌅', 'Movie marathon in pajamas 🍿',
  'Stargazing night 🌟', 'Visit a new café ☕', 'Take a dance class 💃',
  'Weekend road trip 🚗', 'Build a blanket fort 🏰', 'Paint each other 🎨',
  'Go to a beach 🏖️', 'Couples spa day 💆', 'Try a new cuisine 🍜',
  'Game night 🎲', 'Morning hike 🥾', 'Karaoke night 🎤', 'Plant a little garden 🌱',
];

export async function mountBucket({ content }) {
  const me = whoami();
  let rows = [];
  let tab = 'open';

  content.innerHTML = `<div class="loading">loading ✨</div>`;

  async function load() {
    rows = await bucket.list({ orderBy: 'created_at', ascending: false });
    render();
  }

  function render() {
    const open = rows.filter((r) => !r.done);
    const done = rows.filter((r) => r.done);
    const shown = tab === 'open' ? open : done;

    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Bucket list ✨</h1>
          <div class="page-head__sub">dreams & dates for us to do</div>
        </div>
        <button class="btn btn--primary" id="addBtn">+ Add idea</button>
      </div>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
        <div class="seg">
          <button data-tab="open" class="${tab === 'open' ? 'is-active' : ''}">To do (${open.length})</button>
          <button data-tab="done" class="${tab === 'done' ? 'is-active' : ''}">Done (${done.length})</button>
        </div>
        <button class="btn btn--grape btn--sm" id="diceBtn">🎲 Surprise idea</button>
      </div>

      <div class="card" id="listWrap"></div>`;

    const listWrap = content.querySelector('#listWrap');
    if (!shown.length) {
      listWrap.innerHTML = `<div class="empty"><div class="empty__emoji">${tab === 'open' ? '🌈' : '🏆'}</div>${tab === 'open' ? 'Add your first adventure!' : 'Nothing checked off yet — go make memories!'}</div>`;
    } else {
      listWrap.innerHTML = shown.map((r) => {
        const who = PEOPLE[r.author];
        return `<div class="bucket-item ${r.done ? 'is-done' : ''}">
          <button class="bucket-check" data-id="${r.id}" data-done="${r.done ? 1 : 0}">${r.done ? '✓' : ''}</button>
          <span class="t">${escapeHtml(r.title)}</span>
          ${who ? `<span class="who who--${r.author}" style="font-size:12px"><span class="who__dot"></span>${escapeHtml(who.name)}</span>` : ''}
          <button class="btn btn--icon btn--ghost del" data-id="${r.id}" title="Delete">🗑️</button>
        </div>`;
      }).join('');
    }

    content.querySelector('#addBtn').addEventListener('click', () => openForm(me, null, load));
    content.querySelector('#diceBtn').addEventListener('click', () => {
      const idea = DATE_IDEAS[Math.floor(rows.length * 7 + Date.now() / 1000) % DATE_IDEAS.length];
      openForm(me, idea, load);
    });
    content.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));

    listWrap.querySelectorAll('.bucket-check').forEach((b) => b.addEventListener('click', async () => {
      const nowDone = b.dataset.done !== '1';
      await bucket.update(b.dataset.id, { done: nowDone, done_at: nowDone ? new Date().toISOString() : null });
      if (nowDone) toast('Yay! Checked off 🎉', 'success');
      load();
    }));
    listWrap.querySelectorAll('.del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this idea?')) return;
      await bucket.remove(b.dataset.id);
      toast('Deleted', 'success');
      load();
    }));
  }

  await load();
  return { destroy() {} };
}

function openForm(me, prefill, onSaved) {
  openModal({
    title: 'Add to bucket list ✨',
    body: `
      <div class="field"><label>What do you want to do together?</label>
        <input class="input" id="bTitle" placeholder="watch the sunrise 🌅" value="${escapeHtml(prefill || '')}"></div>
      <button class="btn btn--primary btn--block" id="bSave">Add it ✨</button>`,
    onMount(body, close) {
      body.querySelector('#bSave').addEventListener('click', async () => {
        const title = body.querySelector('#bTitle').value.trim();
        if (!title) { toast('Type an idea first 💕', 'error'); return; }
        await bucket.create({ author: me.key, title, done: false });
        toast('Added ✨', 'success');
        close(); onSaved();
      });
      body.querySelector('#bTitle').focus();
    },
  });
}
