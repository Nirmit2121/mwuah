// Mwuah — photo memories & milestones 📸
import { memories, uploadPhoto } from '../api.js';
import { whoami } from '../auth.js';
import { openModal, escapeHtml, prettyDate, todayStr } from '../ui.js';
import { toast } from '../state.js';

export async function mountMemories({ content }) {
  const me = whoami();
  let rows = [];

  content.innerHTML = `<div class="loading">loading our memories 📸</div>`;

  async function load() {
    rows = await memories.list({ orderBy: 'taken_on', ascending: false });
    render();
  }

  function render() {
    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Memories 📸</h1>
          <div class="page-head__sub">our favourite moments & milestones</div>
        </div>
        <button class="btn btn--primary" id="addBtn">+ Add memory</button>
      </div>
      <div id="grid"></div>`;

    const grid = content.querySelector('#grid');
    if (!rows.length) {
      grid.innerHTML = `<div class="empty"><div class="empty__emoji">🖼️</div>No memories yet — add your first photo!</div>`;
    } else {
      grid.className = 'mem-grid';
      grid.innerHTML = rows.map((m) => `
        <div class="mem">
          ${m.is_milestone ? `<span class="mem__milestone">⭐ Milestone</span>` : ''}
          <button class="del" data-id="${m.id}" title="Delete">×</button>
          ${m.photo_url
            ? `<img class="mem__img" src="${m.photo_url}" alt="${escapeHtml(m.title || '')}" loading="lazy">`
            : `<div class="mem__noimg">📷</div>`}
          <div class="mem__body">
            <div class="t">${escapeHtml(m.title || 'Untitled')}</div>
            <div class="d">${m.taken_on ? prettyDate(m.taken_on) : ''}</div>
            ${m.note ? `<div class="muted" style="font-size:13px;margin-top:4px">${escapeHtml(m.note)}</div>` : ''}
          </div>
        </div>`).join('');
    }

    content.querySelector('#addBtn').addEventListener('click', () => openForm(me, load));
    grid.querySelectorAll('.del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this memory?')) return;
      await memories.remove(b.dataset.id);
      toast('Deleted', 'success');
      load();
    }));
  }

  await load();
  return { destroy() {} };
}

function openForm(me, onSaved) {
  openModal({
    title: 'Add a memory 📸',
    body: `
      <div class="field"><label>Photo <span class="muted">(optional)</span></label>
        <input class="input" id="mPhoto" type="file" accept="image/*"></div>
      <div id="mPreviewWrap"></div>
      <div class="field"><label>Title</label>
        <input class="input" id="mTitle" placeholder="our trip to the hills 🏔️"></div>
      <div class="field"><label>When</label>
        <input class="input" id="mDate" type="date" value="${todayStr()}"></div>
      <div class="field"><label>A little note <span class="muted">(optional)</span></label>
        <textarea class="textarea" id="mNote" placeholder="what made this special…"></textarea></div>
      <label style="display:flex;align-items:center;gap:10px;font-weight:700;margin-bottom:16px;cursor:pointer">
        <input type="checkbox" id="mMile" style="width:20px;height:20px"> ⭐ Mark as a milestone</label>
      <button class="btn btn--primary btn--block" id="mSave">Save 💕</button>`,
    onMount(body, close) {
      let file = null;
      const preview = body.querySelector('#mPreviewWrap');
      body.querySelector('#mPhoto').addEventListener('change', (e) => {
        file = e.target.files[0] || null;
        if (file) {
          const url = URL.createObjectURL(file);
          preview.innerHTML = `<img src="${url}" style="border-radius:14px;max-height:180px;margin-bottom:14px;object-fit:cover;width:100%">`;
        } else preview.innerHTML = '';
      });
      body.querySelector('#mSave').addEventListener('click', async () => {
        const title = body.querySelector('#mTitle').value.trim();
        if (!title && !file) { toast('Add a title or a photo 💕', 'error'); return; }
        const btn = body.querySelector('#mSave');
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
          let photo_url = null;
          if (file) photo_url = await uploadPhoto(file);
          await memories.create({
            author: me.key,
            title: title || 'Untitled',
            photo_url,
            taken_on: body.querySelector('#mDate').value || todayStr(),
            note: body.querySelector('#mNote').value.trim() || null,
            is_milestone: body.querySelector('#mMile').checked,
          });
          toast('Memory saved 📸', 'success');
          close(); onSaved();
        } catch (ex) {
          toast(ex.message || 'Could not save', 'error');
          btn.disabled = false; btn.textContent = 'Save 💕';
        }
      });
    },
  });
}
