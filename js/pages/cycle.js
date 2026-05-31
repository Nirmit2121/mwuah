// Mwuah — period / cycle tracking for Akkshita 🌸
import { cycles } from '../api.js';
import { openModal, todayStr, ymd, parseYmd, daysBetween, prettyDate, escapeHtml } from '../ui.js';
import { toast } from '../state.js';

const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;
const SYMPTOMS = ['🩹 cramps', '🤕 headache', '😴 tired', '🍫 cravings', '😢 emotional', '🤢 nausea', '🌡️ bloating', '😣 backache'];

// Compute a summary from logged period start dates.
// A cycle row = { start_date, end_date?, flow?, symptoms?, notes? }
export function summarize(rows) {
  const starts = rows
    .filter((r) => r.start_date)
    .map((r) => r.start_date.slice(0, 10))
    .sort();
  if (!starts.length) return { hasData: false, avgCycle: DEFAULT_CYCLE, avgPeriod: DEFAULT_PERIOD };

  // average gap between consecutive starts
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    gaps.push(daysBetween(parseYmd(starts[i]), parseYmd(starts[i - 1])));
  }
  const avgCycle = gaps.length
    ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    : DEFAULT_CYCLE;

  // average period length from rows that have an end_date
  const lengths = rows
    .filter((r) => r.start_date && r.end_date)
    .map((r) => daysBetween(parseYmd(r.end_date.slice(0, 10)), parseYmd(r.start_date.slice(0, 10))) + 1)
    .filter((n) => n > 0 && n < 15);
  const avgPeriod = lengths.length
    ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
    : DEFAULT_PERIOD;

  const lastStart = parseYmd(starts[starts.length - 1]);
  const nextStart = new Date(lastStart); nextStart.setDate(nextStart.getDate() + avgCycle);
  const today = parseYmd(todayStr());
  const daysUntil = daysBetween(nextStart, today);
  // ovulation ≈ 14 days before next period
  const ovulation = new Date(nextStart); ovulation.setDate(ovulation.getDate() - 14);

  return {
    hasData: true, avgCycle, avgPeriod,
    lastStart, nextStart, daysUntil, ovulation,
    cycleDay: daysBetween(today, lastStart) + 1,
  };
}

export async function mountCycle({ content }) {
  content.innerHTML = `<div class="loading">loading 🌸</div>`;
  let rows = [];

  async function load() {
    rows = await cycles.list({ orderBy: 'start_date', ascending: true });
    render();
  }

  function render() {
    const s = summarize(rows);
    const pct = s.hasData ? Math.min(100, Math.round((s.cycleDay / s.avgCycle) * 100)) : 0;

    const nextLine = s.hasData
      ? (s.daysUntil >= 0
          ? `<b>${s.daysUntil}</b> day${s.daysUntil === 1 ? '' : 's'} until next period`
          : `period was expected ${Math.abs(s.daysUntil)} day${Math.abs(s.daysUntil) === 1 ? '' : 's'} ago`)
      : 'Log a period to see predictions';

    content.innerHTML = `
      <div class="page-head">
        <div class="page-head__titles">
          <h1>Cycle 🌸</h1>
          <div class="page-head__sub">Akkshita's rhythm, gently tracked</div>
        </div>
        <button class="btn btn--primary" id="logBtn">+ Log period</button>
      </div>

      <div class="grid grid--2">
        <div class="card cycle-ring">
          <div class="ring" style="--p:${pct}%">
            <div class="ring__inner">
              <div class="d">${s.hasData ? 'Day ' + Math.max(1, s.cycleDay) : '—'}</div>
              <div class="l">of ~${s.avgCycle} day cycle</div>
            </div>
          </div>
          <p style="margin-top:14px;font-weight:700">${nextLine}</p>
        </div>

        <div class="card">
          <h3 style="margin-bottom:12px">At a glance</h3>
          <div class="grid" style="gap:10px">
            ${statRow('🩸', 'Next period', s.hasData ? prettyDate(ymd(s.nextStart)) : '—')}
            ${statRow('💜', 'Fertile window', s.hasData ? prettyDate(ymd(s.ovulation)) : '—')}
            ${statRow('🔁', 'Avg cycle', s.avgCycle + ' days')}
            ${statRow('⏳', 'Avg period', s.avgPeriod + ' days')}
          </div>
          <p class="muted" style="font-size:13px;margin-top:12px">Predictions are estimates from your logs — every body is different 💞</p>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3 style="margin-bottom:12px">This month</h3>
        <div id="calWrap"></div>
        <div class="legend">
          <span><i style="background:var(--pink)"></i>Period</span>
          <span><i style="background:var(--pink-soft);border:2px dashed var(--pink)"></i>Predicted</span>
          <span><i style="background:var(--grape-soft)"></i>Fertile</span>
          <span><i style="background:#fff;box-shadow:0 0 0 3px var(--sun)"></i>Today</span>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3 style="margin-bottom:8px">History</h3>
        <div id="historyWrap"></div>
      </div>`;

    renderCalendar(content.querySelector('#calWrap'), rows, s);
    renderHistory(content.querySelector('#historyWrap'), rows);
    content.querySelector('#logBtn').addEventListener('click', () => openLogForm(load));
  }

  await load();
  return { destroy() {} };
}

function statRow(emoji, label, val) {
  return `<div class="expense-row" style="border:none;padding:6px 0">
    <span class="emoji">${emoji}</span>
    <span class="meta"><span class="t">${label}</span></span>
    <span class="amt" style="font-size:15px">${escapeHtml(val)}</span>
  </div>`;
}

function renderCalendar(wrap, rows, s) {
  const today = parseYmd(todayStr());
  const year = today.getFullYear(), month = today.getMonth();
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // mark actual period days
  const periodDays = new Set();
  rows.forEach((r) => {
    if (!r.start_date) return;
    const st = parseYmd(r.start_date.slice(0, 10));
    const en = r.end_date ? parseYmd(r.end_date.slice(0, 10)) : new Date(st.getTime() + (s.avgPeriod - 1) * 86400000);
    for (let d = new Date(st); d <= en; d.setDate(d.getDate() + 1)) periodDays.add(ymd(d));
  });

  // predicted next period + fertile window
  const predicted = new Set();
  const fertile = new Set();
  if (s.hasData) {
    for (let i = 0; i < s.avgPeriod; i++) {
      const d = new Date(s.nextStart); d.setDate(d.getDate() + i); predicted.add(ymd(d));
    }
    for (let i = -2; i <= 2; i++) {
      const d = new Date(s.ovulation); d.setDate(d.getDate() + i); fertile.add(ymd(d));
    }
  }

  const dows = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let html = `<div class="cal">` + dows.map((d) => `<div class="cal__dow">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) html += `<div class="cal__cell is-empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const key = ymd(new Date(year, month, day));
    const cls = ['cal__cell'];
    if (periodDays.has(key)) cls.push('is-period');
    else if (predicted.has(key)) cls.push('is-predicted');
    else if (fertile.has(key)) cls.push('is-fertile');
    if (key === todayStr()) cls.push('is-today');
    html += `<div class="${cls.join(' ')}">${day}</div>`;
  }
  html += `</div>`;
  wrap.innerHTML = html;
}

function renderHistory(wrap, rows) {
  const sorted = [...rows].filter((r) => r.start_date).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  if (!sorted.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty__emoji">🌷</div>No periods logged yet.</div>`;
    return;
  }
  wrap.innerHTML = sorted.map((r) => {
    const len = r.end_date ? daysBetween(parseYmd(r.end_date.slice(0,10)), parseYmd(r.start_date.slice(0,10))) + 1 : null;
    const flow = r.flow ? `<span class="chip chip--pink">${escapeHtml(r.flow)}</span>` : '';
    return `<div class="expense-row">
      <span class="emoji">🩸</span>
      <span class="meta">
        <span class="t">${prettyDate(r.start_date)}${r.end_date ? ' – ' + prettyDate(r.end_date) : ''}</span>
        ${r.symptoms ? `<div class="muted" style="font-size:13px">${escapeHtml(r.symptoms)}</div>` : ''}
      </span>
      ${flow}
      ${len ? `<span class="muted" style="font-weight:700;font-size:13px">${len}d</span>` : ''}
      <button class="btn btn--icon btn--ghost del-cycle" data-id="${r.id}" title="Delete">🗑️</button>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.del-cycle').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this entry?')) return;
    await cycles.remove(b.dataset.id);
    toast('Removed', 'success');
    b.closest('.expense-row').remove();
  }));
}

function openLogForm(onSaved) {
  openModal({
    title: 'Log a period 🩸',
    body: `
      <div class="field"><label>Start date</label>
        <input class="input" id="cStart" type="date" value="${todayStr()}"></div>
      <div class="field"><label>End date <span class="muted">(optional)</span></label>
        <input class="input" id="cEnd" type="date"></div>
      <div class="field"><label>Flow</label>
        <select class="select" id="cFlow">
          <option value="">—</option><option>Light</option><option>Medium</option><option>Heavy</option>
        </select></div>
      <div class="field"><label>Symptoms / notes <span class="muted">(optional)</span></label>
        <div class="color-pick" id="cChips" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${SYMPTOMS.map((s) => `<button type="button" class="btn btn--sm" data-sym="${s}">${s}</button>`).join('')}
        </div>
        <textarea class="textarea" id="cSym" placeholder="cramps, mood, cravings…"></textarea></div>
      <button class="btn btn--primary btn--block" id="cSave">Save 💕</button>`,
    onMount(body, close) {
      const sym = body.querySelector('#cSym');
      body.querySelectorAll('#cChips button').forEach((b) => b.addEventListener('click', () => {
        const tag = b.dataset.sym;
        const has = b.classList.toggle('is-on');
        b.style.background = has ? 'var(--pink-soft)' : '';
        b.style.color = has ? 'var(--pink)' : '';
        const parts = sym.value.split(',').map((s) => s.trim()).filter(Boolean);
        if (has) { if (!parts.includes(tag)) parts.push(tag); }
        else { const i = parts.indexOf(tag); if (i >= 0) parts.splice(i, 1); }
        sym.value = parts.join(', ');
      }));
      body.querySelector('#cSave').addEventListener('click', async () => {
        const start_date = body.querySelector('#cStart').value;
        if (!start_date) { toast('Pick a start date', 'error'); return; }
        const end_date = body.querySelector('#cEnd').value || null;
        await cycles.create({
          start_date,
          end_date,
          flow: body.querySelector('#cFlow').value || null,
          symptoms: body.querySelector('#cSym').value.trim() || null,
        });
        toast('Logged 🌸', 'success');
        close();
        onSaved();
      });
    },
  });
}
