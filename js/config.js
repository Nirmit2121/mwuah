// Mwuah — configuration.
// Leave SUPABASE_* empty to run in DEMO mode (data stored in this browser only).
// Fill them in to turn on real shared sync between both of you. See README.md.

export const SUPABASE_URL = 'https://mcezcsomugziqbhgxarg.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZXpjc29tdWd6aXFiaGd4YXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjQyNzIsImV4cCI6MjA5NTgwMDI3Mn0.FiqAskw27bkjxXsXBAYNUexBQ__37tLntcdpph0ZSLg';

// When Supabase is configured, both phones sign into ONE shared account.
// Create this user once in your Supabase dashboard (Authentication → Add user).
// Its PASSWORD is your secret passcode — set it there, never written here.
export const SHARED_EMAIL = 'akkshitabadola2004@gmail.com';

// Passcode used ONLY in demo mode (no Supabase). In cloud mode the passcode is the
// shared account's password, verified by Supabase — so this value is ignored.
export const APP_PASSCODE = '13may';

// The two of you 💞 — rename freely.
export const PEOPLE = {
  nirmit: { key: 'nirmit', name: 'Nirmit', color: '#38bdf8', emoji: '🐻' },
  akkshita: { key: 'akkshita', name: 'Akkshita', color: '#ff5fa2', emoji: '🌸' },
};

// The day your story began (YYYY-MM-DD) — powers the "days together" counter.
export const ANNIVERSARY = '2026-05-13';

// Currency symbol for expenses.
export const CURRENCY = '₹';
