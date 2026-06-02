// Mwuah — passcode gate + "who am I" profile. Works in demo and cloud mode.
import { isConfigured, getSb } from './supabase.js';
import { APP_PASSCODE, SHARED_EMAIL, PEOPLE } from './config.js';

const PASS_KEY = 'mwuah-unlocked';
const WHO_KEY  = 'mwuah-who';

export function isUnlocked() { return sessionStorage.getItem(PASS_KEY) === '1'; }
export function whoami() {
  const k = localStorage.getItem(WHO_KEY);
  return PEOPLE[k] || null;
}
export function setWho(key) {
  if (!PEOPLE[key]) return;
  localStorage.setItem(WHO_KEY, key);
}
export function partnerOf(key) {
  const other = Object.keys(PEOPLE).find((k) => k !== key);
  return PEOPLE[other] || null;
}

// Validate the passcode. In cloud mode the passcode IS the shared account's password —
// it's verified by Supabase and never stored in the code.
export async function unlock(passcode) {
  if (isConfigured) {
    if (!SHARED_EMAIL) throw new Error('Shared account email not set in config.js');
    const sb = await getSb();
    const { error } = await sb.auth.signInWithPassword({ email: SHARED_EMAIL, password: passcode });
    if (error) throw new Error('Wrong passcode 🙈');
  } else {
    if (passcode !== APP_PASSCODE) throw new Error('Wrong passcode 🙈');
  }
  sessionStorage.setItem(PASS_KEY, '1');
}

export async function lock() {
  sessionStorage.removeItem(PASS_KEY);
  if (isConfigured) { try { (await getSb()).auth.signOut(); } catch {} }
}

// Guard for app pages — redirect to login if not unlocked or no profile chosen.
export function requireAuth() {
  if (!isUnlocked() || !whoami()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}
