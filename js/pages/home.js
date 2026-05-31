// Mwuah — home dashboard 🏠
import { expenses, moods, taps, notes, cycles, answers, events } from '../api.js';
import { whoami, partnerOf } from '../auth.js';
import { ANNIVERSARY, PEOPLE } from '../config.js';
import { summarize } from './cycle.js';
import { questionForDay } from '../questions.js';
import { saveTodayAnswer } from './daily.js';
import { upcoming } from './dates.js';
import { money, todayStr, parseYmd, daysBetween, timeAgo, escapeHtml, heartBurst, prettyDate } from '../ui.js';
import { toast } from '../state.js';
import { navigate } from '../router.js';

const MOODS = ['😍', '😊', '😌', '😐', '😴', '😢', '😣', '🥰'];
const MOOD_SCORE = { '😍': 6, '🥰': 6, '😊': 5, '😌': 4, '😐': 3, '😴': 3, '😣': 2, '😢': 1 };
const CYCLE_OWNER = 'akkshita'; // whose period the Cycle page tracks

export async function mountHome({ content }) {
  const me = whoami();
  const partner = partnerOf(me.key);
  content.innerHTML = `<div class="loading">loading our world 💞</div>`;

  let data = {};
  async function load() {
    const [exp, mds, tps, nts, cyc, ans, evs] = await Promise.all([
      expenses.list({ orderBy: 'spent_on', ascending: false }),
      moods.list({ orderBy: 'day', ascending: false }),
      taps.list({ orderBy: 'created_at', ascending: false }),
      notes.list({ orderBy: 'created_at', ascending: false }),
      cycles.list({ orderBy: 'start_date', ascending: true }),
      answers.list({ orderBy: 'day', ascending: false }),
      events.list({ orderBy: 'date', ascending: true }),
    ]);
    data = { exp, mds, tps, nts, cyc, ans, evs };
    render();
  }

  function render() {
    const { exp, mds, tps, nts, cyc, ans, evs } = data;
    const today = todayStr();
    const start = parseYmd(ANNIVERSARY);
    const together = Math.max(0, daysBetween(parseYmd(today), start));

    // month spend
    const month = today.slice(0, 7);
    const monthSpend = exp.filter((e) => (e.spent_on || '').slice(0, 7) === month)
      .reduce((a, e) => a + Number(e.amount || 0), 0);

    // moods today
    const myMood = mds.find((m) => m.author === me.key && (m.day || '') === today);
    const partnerMood = mds.find((m) => m.author === partner.key && (m.day || '') === today);

    // last tap from partner
    const lastFromPartner = tps.find((t) => t.author === partner.key);

    // cycle
    const cs = summarize(cyc);
    const cycleLine = cs.hasData
      ? (cs.daysUntil >= 0 ? `next period in ${cs.daysUntil}d` : `${Math.abs(cs.daysUntil)}d late`)
      : 'no data yet';

    // daily question
    const question = questionForDay(today);
    const myAnswer = ans.find((a) => a.author === me.key && a.day === today);
    const partnerAnswer = ans.find((a) => a.author === partner.key && a.day === today);

    // next important date
    const nextDate = upcoming(evs)[0];

    content.innerHTML = `
      <div class="hero-card">
        <div class="eyebrow" style="color:#fff;opacity:.85">${me.emoji} ${escapeHtml(me.name)} & ${escapeHtml(partner.name)} ${partner.emoji}</div>
        <div class="big-num">${together}</div>
        <div class="sub">days together and counting 💞</div>
      </div>

      ${careBanner(me, cs)}

      ${dailyCard(question, myAnswer, partnerAnswer, partner)}

      <div class="grid grid--2" style="margin-top:16px">
        <div class="card tap-card">
          <h3>Thinking of you</h3>
          <button class="tap-btn" id="tapBtn" aria-label="Send a love tap">💖</button>
          <p class="muted" style="font-weight:700">
            ${lastFromPartner
              ? `${partner.name} tapped you ${timeAgo(lastFromPartner.created_at)} 🥰`
              : `tap to let ${partner.name} know 💕`}
          </p>
        </div>

        <div class="card">
          <h3 style="margin-bottom:10px">Today's mood</h3>
          <div style="margin-bottom:6px;font-weight:700;font-size:14px">You ${me.emoji}</div>
          <div class="mood-faces" id="moodFaces">
            ${MOODS.map((m) => `<button class="mood-face ${myMood?.mood === m ? 'is-sel' : ''}" data-m="${m}">${m}</button>`).join('')}
          </div>
          <div style="margin-top:14px;font-weight:700;font-size:14px">${partner.name} ${partner.emoji}:
            <span style="font-size:22px">${partnerMood ? partnerMood.mood : '—'}</span></div>
        </div>
      </div>

      <div class="grid grid--2" style="margin-top:16px">
        ${moodTrendCard(mds, me, partner)}
        ${nextDateCard(nextDate)}
      </div>

      <div class="grid grid--3" style="margin-top:16px">
        ${tile('💸', money(monthSpend), 'spent this month', '/expenses')}
        ${tile('🌸', cycleLine, "Akkshita's cycle", '/cycle')}
        ${tile('📝', nts.length + '', 'sticky notes', '/notes')}
      </div>

      ${nts.length ? `
        <h3 style="margin:22px 0 12px">Latest notes 💌</h3>
        <div class="grid grid--3">
          ${nts.slice(0, 3).map((n) => miniNote(n)).join('')}
        </div>` : ''}
    `;

    // tap
    content.querySelector('#tapBtn').addEventListener('click', async (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      heartBurst(r.left + r.width / 2, r.top + r.height / 2);
      await taps.create({ author: me.key });
      toast(`Sent ${partner.name} some love 💕`, 'success');
    });

    // mood
    content.querySelectorAll('#moodFaces .mood-face').forEach((b) => {
      b.addEventListener('click', async () => {
        const mood = b.dataset.m;
        if (myMood) await moods.update(myMood.id, { mood });
        else await moods.create({ author: me.key, mood, day: today });
        toast('Mood saved ' + mood, 'success');
        await load();
      });
    });

    // daily question
    const saveBtn = content.querySelector('#dqSave');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const val = content.querySelector('#dqInput').value.trim();
      if (!val) { toast('Write a little something 💕', 'error'); return; }
      saveBtn.disabled = true;
      await saveTodayAnswer(me, val);
      await load();
    });

    content.querySelectorAll('[data-go]').forEach((c) =>
      c.addEventListener('click', () => navigate(c.dataset.go)));
  }

  await load();
  return { destroy() {} };
}

function tile(emoji, big, label, go) {
  return `<div class="card" data-go="${go}" style="cursor:pointer">
    <div style="font-size:26px">${emoji}</div>
    <div class="stat-row"><span class="n">${escapeHtml(big)}</span></div>
    <div class="muted" style="font-weight:700">${label}</div>
  </div>`;
}

function miniNote(n) {
  const colors = { yellow: 'var(--note-yellow)', pink: 'var(--note-pink)', blue: 'var(--note-blue)', green: 'var(--note-green)', purple: 'var(--note-purple)' };
  return `<div class="card" style="background:${colors[n.color] || 'var(--note-yellow)'};border:none">
    <div style="font-weight:700;white-space:pre-wrap;word-break:break-word">${escapeHtml((n.body || '').slice(0, 120))}</div>
    <div class="muted" style="font-weight:700;font-size:12px;margin-top:8px">— ${escapeHtml(PEOPLE[n.author]?.name || n.author || '')}</div>
  </div>`;
}

// Gentle period-care nudge, shown only near term.
function careBanner(me, cs) {
  if (!cs.hasData || cs.daysUntil > 3 || cs.daysUntil < -2) return '';
  const owner = PEOPLE[CYCLE_OWNER];
  const msg = me.key === CYCLE_OWNER
    ? `Your period's near — rest up, hydrate & be kind to yourself 💗`
    : `${owner.name}'s period is near — be extra gentle, patient & sweet 🍫💗`;
  return `<div class="care-banner">${msg}</div>`;
}

// Daily couple question card.
function dailyCard(question, myAnswer, partnerAnswer, partner) {
  let inner;
  if (myAnswer) {
    inner = `
      <div class="qa-line"><span class="who who--you"><span class="who__dot" style="background:var(--grape)"></span>You</span>
        <span class="qa-body">${escapeHtml(myAnswer.body)}</span></div>
      <div class="qa-line"><span class="who who--${partner.key}"><span class="who__dot"></span>${escapeHtml(partner.name)}</span>
        <span class="qa-body">${partnerAnswer ? escapeHtml(partnerAnswer.body) : `<span class="muted">waiting for ${escapeHtml(partner.name)}… 💭</span>`}</span></div>
      <a class="daily-link" data-go="/daily">see all our answers →</a>`;
  } else {
    inner = `
      <textarea class="textarea" id="dqInput" maxlength="400" placeholder="your answer…"></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px">
        <button class="btn btn--primary" id="dqSave">Answer 💌</button>
        <span class="muted" style="font-size:13px">answer to reveal ${escapeHtml(partner.name)}'s 💞</span>
      </div>
      <a class="daily-link" data-go="/daily" style="margin-top:10px">see past answers →</a>`;
  }
  return `<div class="card daily-card">
    <div class="eyebrow">💬 Question of the day</div>
    <h3 style="margin:6px 0 12px">${escapeHtml(question)}</h3>
    ${inner}
  </div>`;
}

// Inline-SVG sparkline of recent moods for both people.
function moodTrendCard(mds, me, partner) {
  const series = [me, partner].map((p) => ({
    p,
    pts: mds.filter((m) => m.author === p.key)
      .sort((a, b) => ((a.day || '') < (b.day || '') ? -1 : 1))
      .slice(-14)
      .map((m) => MOOD_SCORE[m.mood] ?? 3),
  }));
  const enough = series.some((s) => s.pts.length >= 2);
  let body;
  if (!enough) {
    body = `<div class="muted" style="font-weight:700;padding:14px 0">Log moods a few days to see your trend 📈</div>`;
  } else {
    const W = 280, H = 70, pad = 6;
    const line = (pts, color) => {
      if (pts.length < 2) return '';
      const stepX = (W - pad * 2) / Math.max(1, pts.length - 1);
      const y = (v) => H - pad - ((v - 1) / 5) * (H - pad * 2);
      const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(pad + i * stepX).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    };
    body = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="margin-top:6px">
      ${series.map((s) => line(s.pts, s.p.color)).join('')}
    </svg>
    <div class="legend" style="margin-top:8px">
      ${series.map((s) => `<span><i style="background:${s.p.color}"></i>${escapeHtml(s.p.name)}</span>`).join('')}
    </div>`;
  }
  return `<div class="card"><h3 style="margin-bottom:6px">Mood trends 📈</h3>${body}</div>`;
}

function nextDateCard(next) {
  if (!next) {
    return `<div class="card" data-go="/dates" style="cursor:pointer">
      <h3 style="margin-bottom:6px">Important dates 📅</h3>
      <div class="muted" style="font-weight:700">Add birthdays & trips to count down →</div>
    </div>`;
  }
  const d = next.daysUntil;
  return `<div class="card" data-go="/dates" style="cursor:pointer">
    <div class="eyebrow">📅 Next up</div>
    <div style="font-weight:800;font-family:var(--font-display);font-size:18px;margin:4px 0">${escapeHtml(next.ev.title)}</div>
    <div class="stat-row"><span class="n">${d === 0 ? '🎉 today' : d}</span>${d > 0 ? `<span class="muted" style="font-weight:700">days to go</span>` : ''}</div>
    <div class="muted" style="font-weight:700;font-size:13px">${prettyDate(toLocalYmd(next.date))}</div>
  </div>`;
}

function toLocalYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
