# Mwuah 💋

A tiny, cute web app for two — built for **Nirmit & Akkshita**. Track your shared
spendings, gently follow Akkshita's cycle, leave each other sticky love-notes, keep a
bucket list of dates, send "thinking of you" taps, collect photo memories, answer a
**daily couple question**, watch your **mood trends**, get gentle **period-care reminders**,
and count down to **important dates** — all wrapped in drifting petals & soft motion.

Pure HTML/CSS/JS — no build step, no install. Runs in **demo mode** out of the box and
flips to **live shared sync** the moment you add Supabase keys. It's also an installable
**PWA** — add it to your home screen and it opens fullscreen like a native app.

### Install on your phone (PWA)
- **iPhone (Safari):** open the site → Share → **Add to Home Screen**.
- **Android (Chrome):** open the site → menu (⋮) → **Install app / Add to Home screen**.

## Run it

```bash
cd mwuah
python3 -m http.server 8080
# open http://localhost:8080/login.html
```

Passcode (demo default): **`mwuah`** — change it in `js/config.js`.

> ⚠️ Open it through a local server (not `file://`) — the app uses ES modules.

## Demo vs. shared sync

- **Demo mode (default):** all data lives in *this browser only* via `localStorage`.
  Great to play with, but your two phones won't see each other's data.
- **Shared sync:** add your Supabase keys and you both see the same live data.

### Turn on shared sync

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query →** paste all of [`db/schema.sql`](db/schema.sql) → **Run**.
   (Creates the tables, security rules, and the `memories` photo bucket.)
3. **Authentication → Users → Add user:** make ONE shared account
   (e.g. `us@mwuah.app` + a password). This is the account both of you sign in through.
4. **Project Settings → API:** copy the **Project URL** and **anon public** key.
5. Fill in [`js/config.js`](js/config.js):

   ```js
   export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
   export const SUPABASE_ANON_KEY = 'your-anon-key';
   export const SHARED_EMAIL = 'us@mwuah.app';
   export const SHARED_PASSWORD = 'the-password-you-set';
   export const APP_PASSCODE = 'pick-your-secret';
   ```

That's it — reload and the "DEMO" tag disappears. Everything now syncs. 💞

## Make it yours

All in [`js/config.js`](js/config.js):

- `PEOPLE` — names, colors, emojis for each of you.
- `ANNIVERSARY` — the date your "days together" counter counts from.
- `CURRENCY` — symbol for spends (default `₹`).
- `APP_PASSCODE` — the secret to enter.

## Deploy

Drop the `mwuah/` folder on any static host (Vercel, Netlify, GitHub Pages). Supabase is
the backend, so no server needed. Set `login.html` as the entry page.

## What's inside

| File | What it does |
|------|--------------|
| `login.html` | Passcode gate + "who am I" picker |
| `index.html` | App shell + bottom nav |
| `js/config.js` | **All your settings** |
| `js/api.js` | Dual-mode data layer (Supabase ⇄ localStorage) |
| `js/auth.js` | Passcode + profile + shared sign-in |
| `js/pages/*.js` | One module per screen |
| `js/effects.js` | Drifting petals + page transitions |
| `js/questions.js` | Daily-question pool |
| `styles/*.css` | tokens · base · components · layout · pages |
| `manifest.webmanifest`, `sw.js` | PWA install + offline shell |
| `db/schema.sql` | Supabase tables + security + storage |

Made with 💖
