// Mwuah — Web Push: subscribe a phone, and ping the partner after an action.
import { isConfigured, getSb } from './supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './config.js';
import { whoami } from './auth.js';
import { toast } from './state.js';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iOS only allows push when the app is installed to the Home Screen.
function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function pushState() {
  if (!isConfigured || !supported()) return 'unsupported';
  if (isIOS() && !isStandalone()) return 'needs-install';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Turn on notifications for THIS phone (must be called from a tap/click).
export async function enablePush() {
  if (!isConfigured) { toast('Turn on cloud sync first', 'error'); return false; }
  if (!supported()) { toast('This device can’t do notifications 😔', 'error'); return false; }
  if (isIOS() && !isStandalone()) {
    toast('On iPhone: tap Share → Add to Home Screen, open that, then enable 🔔', 'error');
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notifications blocked — allow them in settings', 'error'); return false; }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const sb = await getSb();
  const me = whoami();
  await sb.from('push_subscriptions').upsert(
    { profile: me.key, endpoint: sub.endpoint, subscription: sub.toJSON() },
    { onConflict: 'endpoint' }
  );
  toast('Notifications on 🔔💞', 'success');
  return true;
}

// After a notifiable action, ask the Edge Function to push the partner.
export async function notifyPartner(type, extra = {}) {
  if (!isConfigured) return;
  try {
    const sb = await getSb();
    const { data: { session } } = await sb.auth.getSession();
    const token = (session && session.access_token) || SUPABASE_ANON_KEY;
    await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, actor: whoami()?.key, extra }),
    });
  } catch { /* notifications are best-effort */ }
}

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
