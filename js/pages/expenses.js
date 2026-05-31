// Mwuah — shared spendings 💸
import { expenses } from '../api.js';
import { whoami } from '../auth.js';
import { PEOPLE } from '../config.js';
import { openModal, money, todayStr, prettyDate, escapeHtml } from '../ui.js';
import { toast } from '../state.js';

const CATEGORIES = [
  { key: 'food',    emoji: '🍕', label: 'Food' },
  { key: 'dates',   emoji: '💕', label: 'Dates' },
  { key: 'gifts',   emoji: '🎁', label: 'Gifts' },
  { key: 'travel',  emoji: '✈️', label: 'Travel' },
  { key: 'home',    emoji: '🏠', label: 'Home' },
  { key: 'shopping',emoji: '🛍️', label: 'Shopping' },
  { key: 'bills',   emoji: '🧾', label: 'Bills' },
  { key: 'other',   emoji: '✨', label: 'Other' },
];
const catOf = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[CATEGORIES.length - 1];

export async function mountExpenses({ content }) {
  const me = whoami();
  let rows = [];
  let filterMonth = todayStr().slice(0, 7);

  content.innerHTML = `<div class="loading">loading 💸</div>`;

  async function load() {
    rows = await expenses.list({ orderBy: 'spent_on', ascending: false });
    render();
  }

  function render() {
    const months = [...new Set(rows.map((r) => (r.spent_on || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    if (!months.includes(filterMonth) && months.length) filterMonth = months[0];

    const inMonth = rows.filter((r) => (r.spent_on || '').slice(0, 7) === filterMonth);
    const total = inMonth.reduce((a, r) => a + Number(r.amount || 0), 0);

    // split by who
    const byWho = {};
    Object.keys(PEOPLE).forEach((k) => byWho[k] = 0);
    inMonth.forEach((r) => { byWho[r.author] = (byWho[r.author] || 0) + Number(r.amount || 0); });

    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Spends 💸</h1>
          <div class="page-head__sub">what we spend, together</div>
        </div>
        <button class="btn btn--primary" id="addBtn">+ Add spend</button>
      </div>

      <div class="card hero-card" style="background:linear-gradient(135deg,var(--mint),var(--sky))">
        <div class="eyebrow" style="color:#fff;opacity:.85">${monthLabel(filterMonth)}</div>
        <div class="big-num">${money(total)}</div>
        <div class="sub">${Object.keys(PEOPLE).map((k) => `${PEOPLE[k].emoji} ${PEOPLE[k].name}: ${money(byWho[k] || 0)}`).join('   ·   ')}</div>
      </div>

      ${months.length > 1 ? `<div style="margin:16px 0"><select class="select" id="monthSel" style="max-width:220px">
        ${months.map((m) => `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}
      </select></div>` : '<div style="height:16px"></div>'}

      <div class="card" id="listWrap"></div>`;

    const listWrap = content.querySelector('#listWrap');
    if (!inMonth.length) {
      listWrap.innerHTML = `<div class="empty"><div class="empty__emoji">🪙</div>Nothing logged this month yet.</div>`;
    } else {
      listWrap.innerHTML = inMonth.map((r) => {
        const c = catOf(r.category);
        const who = PEOPLE[r.author];
        return `<div class="expense-row">
          <span class="emoji">${c.emoji}</span>
          <span class="meta">
            <span class="t">${escapeHtml(r.note || c.label)}</span>
            <div class="muted" style="font-size:13px;font-weight:700">${prettyDate(r.spent_on)} · ${who ? who.emoji + ' ' + escapeHtml(who.name) : ''}</div>
          </span>
          <span class="amt">${money(r.amount)}</span>
          <button class="btn btn--icon btn--ghost del" data-id="${r.id}" title="Delete">🗑️</button>
        </div>`;
      }).join('');
    }

    content.querySelector('#addBtn').addEventListener('click', () => openForm(me, load));
    content.querySelector('#monthSel')?.addEventListener('change', (e) => { filterMonth = e.target.value; render(); });
    listWrap.querySelectorAll('.del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this spend?')) return;
      await expenses.remove(b.dataset.id);
      toast('Deleted', 'success');
      load();
    }));
  }

  await load();
  return { destroy() {} };
}

function monthLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function openForm(me, onSaved) {
  openModal({
    title: 'Add a spend 💸',
    body: `
      <div class="field"><label>Amount</label>
        <input class="input" id="eAmt" type="number" inputmode="decimal" placeholder="0" min="0"></div>
      <div class="field"><label>What for?</label>
        <input class="input" id="eNote" placeholder="dinner at our spot 🍝"></div>
      <div class="field"><label>Category</label>
        <div class="color-pick" id="eCat" style="flex-wrap:wrap;gap:6px">
          ${CATEGORIES.map((c, i) => `<button type="button" class="btn btn--sm ${i === 0 ? 'is-cat-sel' : ''}" data-cat="${c.key}"
            style="${i === 0 ? 'background:var(--pink-soft);color:var(--pink)' : ''}">${c.emoji} ${c.label}</button>`).join('')}
        </div></div>
      <div class="field"><label>Date</label>
        <input class="input" id="eDate" type="date" value="${todayStr()}"></div>
      <button class="btn btn--primary btn--block" id="eSave">Save 💕</button>`,
    onMount(body, close) {
      let cat = CATEGORIES[0].key;
      body.querySelectorAll('#eCat button').forEach((b) => b.addEventListener('click', () => {
        cat = b.dataset.cat;
        body.querySelectorAll('#eCat button').forEach((x) => { x.style.background = ''; x.style.color = ''; });
        b.style.background = 'var(--pink-soft)'; b.style.color = 'var(--pink)';
      }));
      body.querySelector('#eSave').addEventListener('click', async () => {
        const amount = Number(body.querySelector('#eAmt').value);
        if (!amount || amount <= 0) { toast('Enter an amount', 'error'); return; }
        await expenses.create({
          author: me.key,
          amount,
          note: body.querySelector('#eNote').value.trim() || null,
          category: cat,
          spent_on: body.querySelector('#eDate').value || todayStr(),
        });
        toast('Saved 💸', 'success');
        close(); onSaved();
      });
      body.querySelector('#eAmt').focus();
    },
  });
}
