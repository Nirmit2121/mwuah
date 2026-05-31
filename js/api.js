// Mwuah — dual-mode data layer. Same interface for Supabase (cloud) and localStorage (demo).
import { isConfigured, getSb } from './supabase.js';

const DEMO_KEY = 'mwuah-demo-data';
const TABLES = ['expenses', 'cycles', 'notes', 'bucket', 'moods', 'taps', 'memories', 'answers', 'events'];

// ---------- demo store ----------
function readDemo() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || {}; }
  catch { return {}; }
}
function writeDemo(data) { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); }
function demoTable(table) {
  const d = readDemo();
  return Array.isArray(d[table]) ? d[table] : [];
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO() { return new Date().toISOString(); }

function applyFilters(rows, filters) {
  return rows.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
}
function applySort(rows, orderBy, ascending) {
  const sorted = [...rows].sort((a, b) => {
    const av = a[orderBy], bv = b[orderBy];
    if (av === bv) return 0;
    return av > bv ? 1 : -1;
  });
  return ascending ? sorted : sorted.reverse();
}

// ---------- generic CRUD ----------
async function list(table, { filters = {}, orderBy = 'created_at', ascending = false } = {}) {
  if (!isConfigured) return applySort(applyFilters(demoTable(table), filters), orderBy, ascending);
  const sb = await getSb();
  let q = sb.from(table).select('*');
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  q = q.order(orderBy, { ascending });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function insert(table, row) {
  if (!isConfigured) {
    const d = readDemo();
    const rec = { id: uuid(), created_at: nowISO(), ...row };
    d[table] = [rec, ...(d[table] || [])];
    writeDemo(d);
    return rec;
  }
  const sb = await getSb();
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function update(table, id, patch) {
  if (!isConfigured) {
    const d = readDemo();
    d[table] = (d[table] || []).map((r) => (r.id === id ? { ...r, ...patch } : r));
    writeDemo(d);
    return d[table].find((r) => r.id === id);
  }
  const sb = await getSb();
  const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function remove(table, id) {
  if (!isConfigured) {
    const d = readDemo();
    d[table] = (d[table] || []).filter((r) => r.id !== id);
    writeDemo(d);
    return true;
  }
  const sb = await getSb();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}

function makeRepo(table) {
  return {
    list:   (opts) => list(table, opts),
    create: (row) => insert(table, row),
    update: (id, patch) => update(table, id, patch),
    remove: (id) => remove(table, id),
  };
}

export const expenses = makeRepo('expenses');
export const cycles   = makeRepo('cycles');
export const notes    = makeRepo('notes');
export const bucket   = makeRepo('bucket');
export const moods    = makeRepo('moods');
export const taps     = makeRepo('taps');
export const memories = makeRepo('memories');
export const answers  = makeRepo('answers');
export const events   = makeRepo('events');

// ---------- photo upload ----------
const MAX_DEMO_BYTES = 1.6 * 1024 * 1024; // ~1.6 MB data-URL cap for demo mode

export async function uploadPhoto(file) {
  if (!isConfigured) {
    if (file.size > MAX_DEMO_BYTES) {
      throw new Error('Photo too big for demo mode (max ~1.5 MB). Turn on Supabase for full-size uploads.');
    }
    return await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error('Could not read photo'));
      fr.readAsDataURL(file);
    });
  }
  const sb = await getSb();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from('memories').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('memories').getPublicUrl(path);
  return data.publicUrl;
}

export function resetDemoData() {
  localStorage.removeItem(DEMO_KEY);
}
export { TABLES };
