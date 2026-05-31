// Mwuah — passcode gate + "who am I" profile. Works in demo and cloud mode.
import { isConfigured, getSb } from './supabase.js';
import { APP_PASSCODE, SHARED_EMAIL, SHARED_PASSWORD, PEOPLE } from './config.js';

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

// Validate passcode (and sign into the shared Supabase account if configured).
export async function unlock(passcode) {
  if (passcode !== APP_PASSCODE) throw new Error('Wrong passcode 🙈');
  if (isConfigured) {
    if (!SHARED_EMAIL || !SHARED_PASSWORD) {
      throw new Error('Shared account not set in config.js');
    }
    const sb = await getSb();
    const { error } = await sb.auth.signInWithPassword({ email: SHARED_EMAIL, password: SHARED_PASSWORD });
    if (error) throw new Error('Could not reach the shared account. Check config.js / Supabase.');
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
