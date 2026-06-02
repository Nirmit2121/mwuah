// Mwuah — medications tracker + medicine info assistant 💊
import { meds, medLogs } from '../api.js';
import { whoami } from '../auth.js';
import { PEOPLE } from '../config.js';
import { fetchMedicineInfo } from '../medinfo.js';
import { openModal, escapeHtml, todayStr, parseYmd, daysBetween, prettyDate, ymd } from '../ui.js';
import { toast } from '../state.js';

const FREQS = ['Once a day', 'Twice a day', 'Thrice a day', 'Every 6 hours', 'As needed'];

// Course status for a medicine relative to today.
export function status(med, today) {
  const start = parseYmd((med.start_date || todayStr()).slice(0, 10));
  const dur = Math.max(1, Number(med.duration_days || 1));
  const end = new Date(start); end.setDate(end.getDate() + dur - 1);
  const t = parseYmd(today);
  const dayNum = daysBetween(t, start) + 1;
  const daysLeft = daysBetween(end, t); // 0 = last day
  let state = 'active';
  if (t < start) state = 'upcoming';
  else if (t > end) state = 'done';
  return { dayNum, dur, daysLeft, state, start, end };
}

export async function mountMeds({ content }) {
  const me = whoami();
  let rows = [];
  let takenToday = new Set();

  content.innerHTML = `<div class="loading">loading 💊</div>`;

  async function load() {
    const today = todayStr();
    const [m, logs] = await Promise.all([
      meds.list({ orderBy: 'start_date', ascending: false }),
      medLogs.list({ filters: { day: today } }),
    ]);
    rows = m;
    takenToday = new Set(logs.map((l) => l.med_id));
    render();
  }

  function render() {
    const today = todayStr();
    const withStatus = rows.map((m) => ({ m, s: status(m, today) }));
    const active = withStatus.filter((x) => x.s.state === 'active');
    const upcoming = withStatus.filter((x) => x.s.state === 'upcoming');
    const done = withStatus.filter((x) => x.s.state === 'done');

    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Medicines 💊</h1>
          <div class="page-head__sub">what to take, and for how long</div>
        </div>
        <button class="btn btn--primary" id="addBtn">+ Add medicine</button>
      </div>

      <div class="card med-info">
        <div class="eyebrow">💬 What's this medicine?</div>
        <p class="muted" style="font-weight:700;margin:6px 0 10px">Type a medicine name and I'll explain what it's for.</p>
        <div class="row" style="gap:8px">
          <input class="input" id="infoInput" placeholder="e.g. Paracetamol, Dolo 650, Azithromycin">
          <button class="btn btn--grape" id="infoBtn" style="flex:none">Ask 🔎</button>
        </div>
        <div id="infoResult"></div>
      </div>

      <h3 style="margin:22px 0 12px">Today 💊</h3>
      <div id="todayWrap"></div>

      ${upcoming.length ? `<h3 style="margin:22px 0 12px">Starting soon ⏳</h3><div id="upWrap"></div>` : ''}
      ${done.length ? `<h3 style="margin:22px 0 12px">Finished ✅</h3><div id="doneWrap"></div>` : ''}
    `;

    const todayWrap = content.querySelector('#todayWrap');
    if (!active.length) {
      todayWrap.innerHTML = `<div class="empty"><div class="empty__emoji">🌿</div>No medicines for today. Stay healthy!</div>`;
    } else {
      todayWrap.innerHTML = active.map((x) => medCard(x.m, x.s, takenToday.has(x.m.id), true)).join('');
    }
    if (upcoming.length) content.querySelector('#upWrap').innerHTML = upcoming.map((x) => medCard(x.m, x.s, false, false)).join('');
    if (done.length) content.querySelector('#doneWrap').innerHTML = done.map((x) => medCard(x.m, x.s, false, false)).join('');

    wire();
  }

  function wire() {
    content.querySelector('#addBtn').addEventListener('click', () => openMedForm(me, load));

    // info assistant
    const input = content.querySelector('#infoInput');
    const ask = () => runLookup(input.value, content.querySelector('#infoResult'));
    content.querySelector('#infoBtn').addEventListener('click', ask);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });

    // per-card actions
    content.querySelectorAll('.med-taken').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.id;
      if (takenToday.has(id)) {
        const log = (await medLogs.list({ filters: { med_id: id, day: todayStr() } }))[0];
        if (log) await medLogs.remove(log.id);
      } else {
        await medLogs.create({ med_id: id, day: todayStr() });
        toast('Marked as taken ✅', 'success');
      }
      await load();
    }));
    content.querySelectorAll('.med-info-btn').forEach((b) => b.addEventListener('click', () => {
      content.querySelector('#infoInput').value = b.dataset.name;
      runLookup(b.dataset.name, content.querySelector('#infoResult'));
      content.querySelector('.med-info').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    content.querySelectorAll('.med-del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this medicine?')) return;
      await Promise.all((await medLogs.list({ filters: { med_id: b.dataset.id } })).map((l) => medLogs.remove(l.id)));
      await meds.remove(b.dataset.id);
      toast('Deleted', 'success');
      load();
    }));
  }

  await load();
  return { destroy() {} };
}

async function runLookup(name, resultEl) {
  const q = (name || '').trim();
  if (!q) { resultEl.innerHTML = ''; return; }
  resultEl.innerHTML = `<div class="med-bubble">Looking up <b>${escapeHtml(q)}</b>… 🔎</div>`;
  try {
    const info = await fetchMedicineInfo(q);
    if (!info) {
      resultEl.innerHTML = `<div class="med-bubble">Hmm, I couldn't find clear info on <b>${escapeHtml(q)}</b>. Double-check the spelling, or try its generic name. 💭</div>`;
      return;
    }
    resultEl.innerHTML = `
      <div class="med-bubble">
        <div style="display:flex;gap:12px;align-items:flex-start">
          ${info.thumb ? `<img src="${info.thumb}" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex:none">` : ''}
          <div>
            <div style="font-weight:800;font-family:var(--font-display);margin-bottom:4px">${escapeHtml(info.title)}</div>
            <div>${escapeHtml(info.extract)}</div>
            <a href="${info.url}" target="_blank" rel="noopener" class="daily-link" style="color:var(--grape)">read more on Wikipedia →</a>
          </div>
        </div>
        <div class="med-disclaimer">ℹ️ General info from Wikipedia — not medical advice. Always follow your doctor or pharmacist. 💞</div>
      </div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="med-bubble">Couldn't reach the info service. Check your connection and try again. 🌐</div>`;
  }
}

function medCard(m, s, taken, isToday) {
  const who = PEOPLE[m.author];
  const courseLine = s.state === 'done'
    ? 'course finished'
    : s.state === 'upcoming'
      ? `starts ${prettyDate(ymd(s.start))}`
      : `Day ${Math.max(1, s.dayNum)} of ${s.dur} · ${s.daysLeft === 0 ? 'last day' : s.daysLeft + ' day' + (s.daysLeft === 1 ? '' : 's') + ' left'}`;

  return `<div class="card med-card ${taken ? 'is-taken' : ''}">
    <div class="med-card__main">
      <div class="med-card__pill">💊</div>
      <div style="flex:1;min-width:0">
        <div class="med-card__name">${escapeHtml(m.name)} ${m.dose ? `<span class="chip chip--sky">${escapeHtml(m.dose)}</span>` : ''}</div>
        <div class="muted" style="font-weight:700;font-size:13px">
          ${m.frequency ? escapeHtml(m.frequency) + ' · ' : ''}${courseLine}${who ? ' · ' + who.emoji : ''}
        </div>
        ${m.notes ? `<div class="muted" style="font-size:13px;margin-top:2px">${escapeHtml(m.notes)}</div>` : ''}
      </div>
      <button class="btn btn--icon btn--ghost med-info-btn" data-name="${escapeHtml(m.name)}" title="What is this?">ℹ️</button>
      <button class="btn btn--icon btn--ghost med-del" data-id="${m.id}" title="Delete">🗑️</button>
    </div>
    ${isToday ? `<button class="btn btn--sm ${taken ? 'btn--primary' : 'btn--ghost'} med-taken" data-id="${m.id}" style="margin-top:10px">
      ${taken ? '✓ Taken today' : 'Mark as taken'}
    </button>` : ''}
  </div>`;
}

function openMedForm(me, onSaved) {
  openModal({
    title: 'Add a medicine 💊',
    body: `
      <div class="field"><label>Medicine name</label>
        <input class="input" id="mName" placeholder="Paracetamol / Dolo 650"></div>
      <div class="row">
        <div class="field"><label>Dose</label>
          <input class="input" id="mDose" placeholder="650 mg"></div>
        <div class="field"><label>Frequency</label>
          <select class="select" id="mFreq">${FREQS.map((f) => `<option>${f}</option>`).join('')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>Start date</label>
          <input class="input" id="mStart" type="date" value="${todayStr()}"></div>
        <div class="field"><label>For how many days?</label>
          <input class="input" id="mDays" type="number" min="1" value="5"></div>
      </div>
      <div class="field"><label>Notes <span class="muted">(optional)</span></label>
        <input class="input" id="mNotes" placeholder="after food, etc."></div>
      <button class="btn btn--primary btn--block" id="mSave">Save 💕</button>`,
    onMount(body, close) {
      body.querySelector('#mSave').addEventListener('click', async () => {
        const name = body.querySelector('#mName').value.trim();
        const days = Number(body.querySelector('#mDays').value);
        if (!name) { toast('Enter the medicine name', 'error'); return; }
        if (!days || days < 1) { toast('How many days?', 'error'); return; }
        await meds.create({
          author: me.key,
          name,
          dose: body.querySelector('#mDose').value.trim() || null,
          frequency: body.querySelector('#mFreq').value,
          start_date: body.querySelector('#mStart').value || todayStr(),
          duration_days: days,
          notes: body.querySelector('#mNotes').value.trim() || null,
        });
        toast('Medicine added 💊', 'success');
        close(); onSaved();
      });
      body.querySelector('#mName').focus();
    },
  });
}
