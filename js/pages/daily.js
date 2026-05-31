// Mwuah — daily couple question history 💬
import { answers } from '../api.js';
import { whoami, partnerOf } from '../auth.js';
import { PEOPLE } from '../config.js';
import { questionForDay } from '../questions.js';
import { escapeHtml, prettyDate, todayStr } from '../ui.js';
import { toast } from '../state.js';
import { navigate } from '../router.js';

export async function mountDaily({ content }) {
  const me = whoami();
  const partner = partnerOf(me.key);
  content.innerHTML = `<div class="loading">loading 💬</div>`;

  let rows = [];
  async function load() {
    rows = await answers.list({ orderBy: 'day', ascending: false });
    render();
  }

  function render() {
    // group answers by day
    const byDay = new Map();
    rows.forEach((r) => {
      if (!byDay.has(r.day)) byDay.set(r.day, {});
      byDay.get(r.day)[r.author] = r;
    });
    const days = [...byDay.keys()].sort().reverse();

    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Daily questions 💬</h1>
          <div class="page-head__sub">our answers, day by day</div>
        </div>
        <button class="btn btn--ghost" id="homeBtn">← Home</button>
      </div>
      <div id="list"></div>`;

    const list = content.querySelector('#list');
    if (!days.length) {
      list.innerHTML = `<div class="empty"><div class="empty__emoji">💌</div>No answers yet — answer today's question on the home screen!</div>`;
    } else {
      list.innerHTML = days.map((day) => {
        const pair = byDay.get(day);
        const q = (pair[me.key] || pair[partner.key])?.question || questionForDay(day);
        return `<div class="card" style="margin-bottom:14px">
          <div class="muted" style="font-weight:800;font-size:12px">${prettyDate(day)}</div>
          <div style="font-weight:800;font-family:var(--font-display);margin:4px 0 12px">${escapeHtml(q)}</div>
          ${[me, partner].map((p) => answerLine(p, pair[p.key])).join('')}
        </div>`;
      }).join('');
    }

    content.querySelector('#homeBtn').addEventListener('click', () => navigate('/'));
  }

  await load();
  return { destroy() {} };
}

function answerLine(person, ans) {
  return `<div class="qa-line">
    <span class="who who--${person.key}"><span class="who__dot"></span>${escapeHtml(person.name)}</span>
    <span class="qa-body">${ans ? escapeHtml(ans.body) : '<span class="muted">— no answer yet —</span>'}</span>
  </div>`;
}

// Save (or update) my answer for today. Shared by the home card.
export async function saveTodayAnswer(me, body) {
  const day = todayStr();
  const q = questionForDay(day);
  const existing = (await answers.list({ filters: { author: me.key, day } }))[0];
  if (existing) await answers.update(existing.id, { body });
  else await answers.create({ author: me.key, day, question: q, body });
  toast('Answer saved 💌', 'success');
}
