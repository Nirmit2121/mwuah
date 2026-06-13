// Mwuah — 'notify' Edge Function.
// Receives { type, actor, extra } from the app after a tap/note/mood,
// then sends a Web Push to the PARTNER's subscribed phones.
//
// Deploy: Supabase Dashboard → Edge Functions → create "notify" → paste this → Deploy.
// Secrets needed (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:us@mwuah.app)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const NAMES: Record<string, string> = { nirmit: 'Nirmit', akkshita: 'Akkshita' };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:us@mwuah.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function buildMessage(type: string, actorName: string, extra: Record<string, unknown>) {
  switch (type) {
    case 'tap':
      return { title: `${actorName} 💖`, body: `${actorName} is thinking of you 🥰`, tag: 'tap' };
    case 'note':
      return { title: `${actorName} left you a note 📝`, body: String(extra.preview || 'Open Mwuah to read it 💌'), tag: 'note' };
    case 'mood':
      return { title: `${actorName}'s mood ${extra.mood || ''}`, body: `${actorName} just shared how they feel`, tag: 'mood' };
    default:
      return { title: 'Mwuah 💞', body: `${actorName} did something sweet`, tag: 'mwuah' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { type, actor, extra = {} } = await req.json();
    const partner = actor === 'nirmit' ? 'akkshita' : 'nirmit';
    const actorName = NAMES[actor] || 'Someone';
    const payload = JSON.stringify({ ...buildMessage(type, actorName, extra), url: './index.html' });

    const { data: subs } = await supabase
      .from('push_subscriptions').select('id, subscription').eq('profile', partner);

    let sent = 0;
    await Promise.all((subs || []).map(async (s: { id: string; subscription: unknown }) => {
      try {
        await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload);
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id); // gone — clean up
        }
      }
    }));

    return new Response(JSON.stringify({ sent }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
