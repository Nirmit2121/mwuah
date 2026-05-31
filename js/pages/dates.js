// Mwuah — important dates & countdowns 📅
import { events } from '../api.js';
import { openModal, escapeHtml, todayStr, parseYmd, daysBetween, prettyDate } from '../ui.js';
import { toast } from '../state.js';

const KINDS = {
  birthday:    { emoji: '🎂', label: 'Birthday' },
  anniversary: { emoji: '💞', label: 'Anniversary' },
  trip:        { emoji: '✈️', label: 'Trip' },
  event:       { emoji: '📅', label: 'Event' },
};
const kindOf = (k) => KINDS[k] || KINDS.event;

// Next occurrence of an event from today (handles yearly-recurring birthdays/anniversaries).
export function nextOccurrence(ev) {
  const today = parseYmd(todayStr());
  const base = parseYmd((ev.date || todayStr()).slice(0, 10));
  if (!ev.recurring) {
    return { date: base, daysUntil: daysBetween(base, today), past: base < today };
  }
  let next = new Date(today.getFullYear(), base.getMonth(), base.getDate());
  if (daysBetween(next, today) < 0) next = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
  return { date: next, daysUntil: daysBetween(next, today), past: false };
}

// Upcoming, soonest first (recurring dates always resurface; past one-offs drop away).
export function upcoming(rows) {
  return rows
    .map((ev) => ({ ev, ...nextOccurrence(ev) }))
    .filter((x) => x.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function mountDates({ content }) {
  let rows = [];
  content.innerHTML = `<div class="loading">loading 📅</div>`;

  async function load() {
    rows = await events.list({ orderBy: 'date', ascending: true });
    render();
  }

  function render() {
    const up = upcoming(rows);
    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Our dates 📅</h1>
          <div class="page-head__sub">birthdays, anniversaries & adventures</div>
        </div>
        <button class="btn btn--primary" id="addBtn">+ Add date</button>
      </div>
      <div id="list"></div>`;

    const list = content.querySelector('#list');
    if (!up.length) {
      list.innerHTML = `<div class="empty"><div class="empty__emoji">🗓️</div>No dates yet — add a birthday or your next trip!</div>`;
    } else {
      list.innerHTML = up.map(({ ev, date, daysUntil }) => {
        const k = kindOf(ev.kind);
        return `<div class="card date-card">
          <span class="date-card__emoji">${k.emoji}</span>
          <div class="date-card__meta">
            <div class="t">${escapeHtml(ev.title)}</div>
            <div class="muted" style="font-weight:700;font-size:13px">${prettyDate(toYmd(date))}${ev.recurring ? ' · yearly' : ''}</div>
            ${ev.note ? `<div class="muted" style="font-size:13px">${escapeHtml(ev.note)}</div>` : ''}
          </div>
          <div class="date-card__count">
            <div class="n">${daysUntil === 0 ? '🎉' : daysUntil}</div>
            <div class="l">${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'day' : 'days'}</div>
          </div>
          <button class="btn btn--icon btn--ghost del" data-id="${ev.id}" title="Delete">🗑️</button>
        </div>`;
      }).join('');
    }

    content.querySelector('#addBtn').addEventListener('click', () => openForm(load));
    list.querySelectorAll('.del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this date?')) return;
      await events.remove(b.dataset.id);
      toast('Deleted', 'success');
      load();
    }));
  }

  await load();
  return { destroy() {} };
}

function toYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openForm(onSaved) {
  openModal({
    title: 'Add an important date 📅',
    body: `
      <div class="field"><label>What is it?</label>
        <input class="input" id="dTitle" placeholder="Akkshita's birthday 🎂"></div>
      <div class="field"><label>Date</label>
        <input class="input" id="dDate" type="date" value="${todayStr()}"></div>
      <div class="field"><label>Type</label>
        <select class="select" id="dKind">
          ${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('')}
        </select></div>
      <label style="display:flex;align-items:center;gap:10px;font-weight:700;margin-bottom:16px;cursor:pointer">
        <input type="checkbox" id="dRec" checked style="width:20px;height:20px"> 🔁 Repeats every year</label>
      <div class="field"><label>Note <span class="muted">(optional)</span></label>
        <input class="input" id="dNote" placeholder="don't forget the cake!"></div>
      <button class="btn btn--primary btn--block" id="dSave">Save 💕</button>`,
    onMount(body, close) {
      body.querySelector('#dSave').addEventListener('click', async () => {
        const title = body.querySelector('#dTitle').value.trim();
        const date = body.querySelector('#dDate').value;
        if (!title || !date) { toast('Add a title and a date', 'error'); return; }
        await events.create({
          title, date,
          kind: body.querySelector('#dKind').value,
          recurring: body.querySelector('#dRec').checked,
          note: body.querySelector('#dNote').value.trim() || null,
        });
        toast('Date saved 📅', 'success');
        close(); onSaved();
      });
      body.querySelector('#dTitle').focus();
    },
  });
}
