// Mwuah — sticky notes wall 📝
import { notes } from '../api.js';
import { whoami } from '../auth.js';
import { PEOPLE } from '../config.js';
import { openModal, escapeHtml } from '../ui.js';
import { toast } from '../state.js';

const COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'];
const COLOR_VAR = {
  yellow: 'var(--note-yellow)', pink: 'var(--note-pink)', blue: 'var(--note-blue)',
  green: 'var(--note-green)', purple: 'var(--note-purple)',
};

export async function mountNotes({ content }) {
  const me = whoami();
  let rows = [];

  content.innerHTML = `<div class="loading">loading our notes 💌</div>`;

  async function load() {
    rows = await notes.list({ orderBy: 'created_at', ascending: false });
    render();
  }

  function render() {
    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Sticky notes 📝</h1>
          <div class="page-head__sub">little love letters for each other</div>
        </div>
        <button class="btn btn--primary" id="addBtn">+ New note</button>
      </div>
      <div id="wall"></div>`;

    const wall = content.querySelector('#wall');
    if (!rows.length) {
      wall.innerHTML = `<div class="empty"><div class="empty__emoji">💌</div>No notes yet — leave the first cute message!</div>`;
    } else {
      wall.className = 'notes-wall';
      wall.innerHTML = rows.map((n, i) => {
        const who = PEOPLE[n.author];
        const rot = ((i % 5) - 2) * 1.4; // -2.8deg .. +2.8deg
        return `<div class="sticky" style="background:${COLOR_VAR[n.color] || COLOR_VAR.yellow};--rot:${rot}deg">
          <div class="body">${escapeHtml(n.body || '')}</div>
          <div class="foot">
            <span class="who who--${n.author || ''}"><span class="who__dot"></span>${who ? escapeHtml(who.name) : ''}</span>
            <button class="del" data-id="${n.id}" title="Remove">🗑️</button>
          </div>
        </div>`;
      }).join('');
    }

    content.querySelector('#addBtn').addEventListener('click', () => openForm(me, load));
    wall.querySelectorAll('.del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Remove this note?')) return;
      await notes.remove(b.dataset.id);
      toast('Removed', 'success');
      load();
    }));
  }

  await load();
  return { destroy() {} };
}

function openForm(me, onSaved) {
  let color = COLORS[0];
  openModal({
    title: 'New sticky note 💌',
    body: `
      <div class="field">
        <textarea class="textarea" id="nBody" maxlength="280" placeholder="write something cute…" style="min-height:120px"></textarea>
      </div>
      <div class="field"><label>Color</label>
        <div class="color-pick" id="nColor">
          ${COLORS.map((c, i) => `<button type="button" data-c="${c}" class="${i === 0 ? 'is-sel' : ''}" style="background:${COLOR_VAR[c]}"></button>`).join('')}
        </div>
      </div>
      <button class="btn btn--primary btn--block" id="nSave">Stick it 📌</button>`,
    onMount(body, close) {
      body.querySelectorAll('#nColor button').forEach((b) => b.addEventListener('click', () => {
        color = b.dataset.c;
        body.querySelectorAll('#nColor button').forEach((x) => x.classList.toggle('is-sel', x === b));
      }));
      body.querySelector('#nSave').addEventListener('click', async () => {
        const text = body.querySelector('#nBody').value.trim();
        if (!text) { toast('Write something first 💕', 'error'); return; }
        await notes.create({ author: me.key, body: text, color });
        toast('Note added 📌', 'success');
        close(); onSaved();
      });
      body.querySelector('#nBody').focus();
    },
  });
}
