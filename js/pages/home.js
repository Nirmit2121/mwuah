// Mwuah — home dashboard 🏠
import { expenses, moods, taps, notes, cycles, events, savings, meds } from '../api.js';
import { whoami, partnerOf } from '../auth.js';
import { ANNIVERSARY, PEOPLE } from '../config.js';
import { summarize } from './cycle.js';
import { upcoming } from './dates.js';
import { status as medStatus } from './meds.js';
import { money, todayStr, parseYmd, daysBetween, timeAgo, escapeHtml, heartBurst, prettyDate } from '../ui.js';
import { toast } from '../state.js';
import { navigate } from '../router.js';
import { notifyPartner, enablePush, pushState } from '../push.js';

const MOODS = ['😍', '😊', '😌', '😐', '😴', '😢', '😣', '🥰'];
const MOOD_SCORE = { '😍': 6, '🥰': 6, '😊': 5, '😌': 4, '😐': 3, '😴': 3, '😣': 2, '😢': 1 };
const CYCLE_OWNER = 'akkshita'; // whose period the Cycle page tracks

export async function mountHome({ content }) {
  const me = whoami();
  const partner = partnerOf(me.key);
  content.innerHTML = `<div class="loading">loading our world 💞</div>`;

  let data = {};
  async function load() {
    const [exp, mds, tps, nts, cyc, evs, sav, med] = await Promise.all([
      expenses.list({ orderBy: 'spent_on', ascending: false }),
      moods.list({ orderBy: 'day', ascending: false }),
      taps.list({ orderBy: 'created_at', ascending: false }),
      notes.list({ orderBy: 'created_at', ascending: false }),
      cycles.list({ orderBy: 'start_date', ascending: true }),
      events.list({ orderBy: 'date', ascending: true }),
      savings.list({ orderBy: 'saved_on', ascending: false }),
      meds.list({ orderBy: 'start_date', ascending: false }),
    ]);
    data = { exp, mds, tps, nts, cyc, evs, sav, med };
    render();
  }

  function render() {
    const { exp, mds, tps, nts, cyc, evs, sav, med } = data;
    const today = todayStr();
    const totalSaved = sav.reduce((a, s) => a + Number(s.amount || 0), 0);
    const medsToday = med.filter((m) => medStatus(m, today).state === 'active').length;
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

    // next important date
    const nextDate = upcoming(evs)[0];

    content.innerHTML = `
      <div class="hero-card">
        <div class="eyebrow" style="color:#fff;opacity:.85">${me.emoji} ${escapeHtml(me.name)} & ${escapeHtml(partner.name)} ${partner.emoji}</div>
        <div class="big-num">${together}</div>
        <div class="sub">days together and counting 💞</div>
      </div>

      ${careBanner(me, cs)}
      ${notifPrompt()}

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
        ${tile('🐷', money(totalSaved), 'saved together', '/savings')}
        ${tile('🌸', cycleLine, "Akkshita's cycle", '/cycle')}
        ${medsToday ? tile('💊', medsToday + '', medsToday === 1 ? 'medicine today' : 'medicines today', '/meds') : ''}
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
      notifyPartner('tap');
      toast(`Sent ${partner.name} some love 💕`, 'success');
    });

    // mood
    content.querySelectorAll('#moodFaces .mood-face').forEach((b) => {
      b.addEventListener('click', async () => {
        const mood = b.dataset.m;
        if (myMood) await moods.update(myMood.id, { mood });
        else await moods.create({ author: me.key, mood, day: today });
        notifyPartner('mood', { mood });
        toast('Mood saved ' + mood, 'success');
        await load();
      });
    });

    const notifBtn = content.querySelector('#notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', async () => {
      const ok = await enablePush();
      if (ok) render();
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

// Prompt to switch on phone notifications (hidden once granted / unsupported).
function notifPrompt() {
  const state = pushState();
  if (state === 'granted' || state === 'unsupported' || state === 'denied') return '';
  const msg = state === 'needs-install'
    ? `📲 To get notified when ${''}your partner taps or writes — tap <b>Share → Add to Home Screen</b>, then open Mwuah from your home screen and turn on 🔔.`
    : `🔔 Get a little buzz when your partner taps you, writes a note, or shares a mood.`;
  const btn = state === 'needs-install' ? '' : `<button class="btn btn--grape btn--sm" id="notifBtn" style="margin-top:10px">Turn on notifications</button>`;
  return `<div class="care-banner" style="background:linear-gradient(135deg,var(--sky-soft),var(--grape-soft))">
    <div>${msg}</div>${btn}
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
