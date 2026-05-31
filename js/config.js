// Mwuah — configuration.
// Leave SUPABASE_* empty to run in DEMO mode (data stored in this browser only).
// Fill them in to turn on real shared sync between both of you. See README.md.

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// When Supabase is configured, both phones sign into ONE shared account.
// Create this user once in your Supabase dashboard (Authentication → Add user)
// and put the same credentials here.
export const SHARED_EMAIL = '';
export const SHARED_PASSWORD = '';

// Passcode to enter the app (works in demo AND cloud mode). Change it to your own secret.
export const APP_PASSCODE = 'mwuah';

// The two of you 💞 — rename freely.
export const PEOPLE = {
  nirmit:   { key: 'nirmit',   name: 'Nirmit',   color: '#38bdf8', emoji: '🐻' },
  akkshita: { key: 'akkshita', name: 'Akkshita', color: '#ff5fa2', emoji: '🌸' },
};

// The day your story began (YYYY-MM-DD) — powers the "days together" counter.
export const ANNIVERSARY = '2026-05-13';

// Currency symbol for expenses.
export const CURRENCY = '₹';
