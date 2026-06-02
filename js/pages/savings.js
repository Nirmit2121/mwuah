// Mwuah — shared savings goals 🐷
import { goals, savings } from '../api.js';
import { whoami } from '../auth.js';
import { PEOPLE } from '../config.js';
import { openModal, money, escapeHtml, todayStr, prettyDate } from '../ui.js';
import { toast } from '../state.js';

const EMOJIS = ['🐷', '🏖️', '✈️', '🏠', '💍', '🚗', '🎁', '📱', '💻', '🍼', '🎓', '💸'];

export async function mountSavings({ content }) {
  const me = whoami();
  let gs = [];
  let cont = [];

  content.innerHTML = `<div class="loading">loading 🐷</div>`;

  async function load() {
    [gs, cont] = await Promise.all([
      goals.list({ orderBy: 'created_at', ascending: false }),
      savings.list({ orderBy: 'saved_on', ascending: false }),
    ]);
    render();
  }

  const savedFor = (goalId) => cont.filter((c) => c.goal_id === goalId).reduce((a, c) => a + Number(c.amount || 0), 0);

  function render() {
    const totalSaved = cont.reduce((a, c) => a + Number(c.amount || 0), 0);
    const totalTarget = gs.reduce((a, g) => a + Number(g.target || 0), 0);

    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Savings 🐷</h1>
          <div class="page-head__sub">saving up for us, together</div>
        </div>
        <button class="btn btn--primary" id="newGoalBtn">+ New goal</button>
      </div>

      <div class="hero-card" style="background:linear-gradient(135deg,var(--mint),var(--grape))">
        <div class="eyebrow" style="color:#fff;opacity:.85">saved together</div>
        <div class="big-num">${money(totalSaved)}</div>
        <div class="sub">${totalTarget ? `of ${money(totalTarget)} in goals` : 'set a goal to start saving 💞'}</div>
      </div>

      <div id="goalsWrap" style="margin-top:18px"></div>`;

    const wrap = content.querySelector('#goalsWrap');
    if (!gs.length) {
      wrap.innerHTML = `<div class="empty"><div class="empty__emoji">🎯</div>No goals yet — create your first savings goal!</div>`;
    } else {
      wrap.innerHTML = gs.map((g) => goalCard(g, savedFor(g.id), cont.filter((c) => c.goal_id === g.id))).join('');
    }

    content.querySelector('#newGoalBtn').addEventListener('click', () => openGoalForm(me, load));
    wrap.querySelectorAll('.add-money').forEach((b) => b.addEventListener('click', () => openContribForm(me, b.dataset.id, load)));
    wrap.querySelectorAll('.del-goal').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this goal and all its savings?')) return;
      // remove contributions first (demo mode has no cascade), then the goal
      await Promise.all(cont.filter((c) => c.goal_id === b.dataset.id).map((c) => savings.remove(c.id)));
      await goals.remove(b.dataset.id);
      toast('Goal deleted', 'success');
      load();
    }));
    wrap.querySelectorAll('.del-contrib').forEach((b) => b.addEventListener('click', async () => {
      await savings.remove(b.dataset.id);
      toast('Removed', 'success');
      load();
    }));
  }

  await load();
  return { destroy() {} };
}

function goalCard(g, saved, contribs) {
  const target = Number(g.target || 0);
  const pct = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const remaining = Math.max(0, target - saved);
  const done = target && saved >= target;

  const recent = contribs.slice(0, 4).map((c) => {
    const who = PEOPLE[c.author];
    return `<div class="expense-row" style="padding:8px 0">
      <span class="emoji" style="width:36px;height:36px;font-size:16px">${who ? who.emoji : '💰'}</span>
      <span class="meta">
        <span class="t" style="font-size:14px">${money(c.amount)}${c.note ? ' · ' + escapeHtml(c.note) : ''}</span>
        <div class="muted" style="font-size:12px;font-weight:700">${prettyDate(c.saved_on)} · ${who ? escapeHtml(who.name) : ''}</div>
      </span>
      <button class="btn btn--icon btn--ghost del-contrib" data-id="${c.id}" title="Remove">🗑️</button>
    </div>`;
  }).join('');

  return `<div class="card goal-card">
    <div class="goal-card__head">
      <span class="goal-card__emoji">${escapeHtml(g.emoji || '🐷')}</span>
      <div style="flex:1;min-width:0">
        <div class="goal-card__title">${escapeHtml(g.title)} ${done ? '<span class="chip chip--mint">reached! 🎉</span>' : ''}</div>
        <div class="muted" style="font-weight:700;font-size:14px">${money(saved)} <span style="opacity:.6">/ ${money(target)}</span></div>
      </div>
      <button class="btn btn--icon btn--ghost del-goal" data-id="${g.id}" title="Delete goal">🗑️</button>
    </div>

    <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div>
    <div class="goal-card__meta">
      <span>${pct}% saved</span>
      <span>${done ? 'all done 💞' : money(remaining) + ' to go'}</span>
    </div>

    ${recent ? `<div style="margin-top:12px">${recent}</div>` : ''}
    <button class="btn btn--grape btn--sm add-money" data-id="${g.id}" style="margin-top:12px">+ Add money</button>
  </div>`;
}

function openGoalForm(me, onSaved) {
  let emoji = EMOJIS[0];
  openModal({
    title: 'New savings goal 🎯',
    body: `
      <div class="field"><label>What are you saving for?</label>
        <input class="input" id="gTitle" placeholder="Goa trip ✈️"></div>
      <div class="field"><label>Target amount</label>
        <input class="input" id="gTarget" type="number" inputmode="decimal" min="0" placeholder="40000"></div>
      <div class="field"><label>Pick an icon</label>
        <div class="color-pick" id="gEmoji" style="flex-wrap:wrap;gap:8px">
          ${EMOJIS.map((e, i) => `<button type="button" data-e="${e}" class="emoji-pick ${i === 0 ? 'is-sel' : ''}">${e}</button>`).join('')}
        </div></div>
      <button class="btn btn--primary btn--block" id="gSave">Create goal 💕</button>`,
    onMount(body, close) {
      body.querySelectorAll('#gEmoji button').forEach((b) => b.addEventListener('click', () => {
        emoji = b.dataset.e;
        body.querySelectorAll('#gEmoji button').forEach((x) => x.classList.toggle('is-sel', x === b));
      }));
      body.querySelector('#gSave').addEventListener('click', async () => {
        const title = body.querySelector('#gTitle').value.trim();
        const target = Number(body.querySelector('#gTarget').value);
        if (!title) { toast('Name your goal 💕', 'error'); return; }
        if (!target || target <= 0) { toast('Set a target amount', 'error'); return; }
        await goals.create({ author: me.key, title, target, emoji });
        toast('Goal created 🎯', 'success');
        close(); onSaved();
      });
      body.querySelector('#gTitle').focus();
    },
  });
}

function openContribForm(me, goalId, onSaved) {
  openModal({
    title: 'Add to savings 💰',
    body: `
      <div class="field"><label>Amount</label>
        <input class="input" id="sAmt" type="number" inputmode="decimal" min="0" placeholder="0"></div>
      <div class="field"><label>Note <span class="muted">(optional)</span></label>
        <input class="input" id="sNote" placeholder="this month's bit 💪"></div>
      <div class="field"><label>Date</label>
        <input class="input" id="sDate" type="date" value="${todayStr()}"></div>
      <button class="btn btn--primary btn--block" id="sSave">Add 💕</button>`,
    onMount(body, close) {
      body.querySelector('#sSave').addEventListener('click', async () => {
        const amount = Number(body.querySelector('#sAmt').value);
        if (!amount || amount <= 0) { toast('Enter an amount', 'error'); return; }
        await savings.create({
          goal_id: goalId,
          author: me.key,
          amount,
          note: body.querySelector('#sNote').value.trim() || null,
          saved_on: body.querySelector('#sDate').value || todayStr(),
        });
        toast('Added to savings 🐷', 'success');
        close(); onSaved();
      });
      body.querySelector('#sAmt').focus();
    },
  });
}
