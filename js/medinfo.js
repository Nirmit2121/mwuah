// Mwuah — medicine info lookup. Resolves common Indian brand names to their generic
// (salt) name, then pulls a plain-language summary from Wikipedia (CORS via origin=*).
// Informational only — not medical advice.

// Common brand → generic/salt. Keys are lowercase, dosage-stripped (see normalize()).
const BRAND_ALIASES = {
  dolo: 'Paracetamol', crocin: 'Paracetamol', calpol: 'Paracetamol', dcold: 'Paracetamol',
  sinarest: 'Paracetamol', sumo: 'Paracetamol',
  combiflam: 'Ibuprofen', brufen: 'Ibuprofen',
  zerodol: 'Aceclofenac', hifenac: 'Aceclofenac',
  meftal: 'Mefenamic acid',
  pan: 'Pantoprazole', pantop: 'Pantoprazole', pantocid: 'Pantoprazole',
  omez: 'Omeprazole', omee: 'Omeprazole',
  rantac: 'Ranitidine', aciloc: 'Ranitidine',
  augmentin: 'Amoxicillin/clavulanic acid', clavam: 'Amoxicillin/clavulanic acid', amoxyclav: 'Amoxicillin/clavulanic acid',
  mox: 'Amoxicillin', novamox: 'Amoxicillin',
  azee: 'Azithromycin', azithral: 'Azithromycin', azimax: 'Azithromycin',
  cifran: 'Ciprofloxacin', ciplox: 'Ciprofloxacin',
  norflox: 'Norfloxacin',
  monocef: 'Ceftriaxone', zifi: 'Cefixime', taxim: 'Cefixime', cefix: 'Cefixime',
  metrogyl: 'Metronidazole', flagyl: 'Metronidazole',
  allegra: 'Fexofenadine',
  cetzine: 'Cetirizine', alerid: 'Cetirizine', okacet: 'Cetirizine',
  avil: 'Pheniramine',
  montek: 'Montelukast', montair: 'Montelukast',
  ondem: 'Ondansetron', emeset: 'Ondansetron', vomikind: 'Ondansetron',
  domstal: 'Domperidone',
  glycomet: 'Metformin',
  telma: 'Telmisartan', amlokind: 'Amlodipine', amlong: 'Amlodipine',
  ecosprin: 'Aspirin', disprin: 'Aspirin',
  thyronorm: 'Levothyroxine', eltroxin: 'Levothyroxine',
  shelcal: 'Calcium supplement', limcee: 'Vitamin C', becosules: 'B vitamins',
  volini: 'Diclofenac',
};

// Strip trailing dosage tokens (650, 500mg, DS, forte, etc.) → a clean key.
function normalize(name) {
  return name.toLowerCase().trim()
    .replace(/\b(\d+\s?(mg|ml|mcg|g|iu)?|ds|forte|plus|sr|xr|cr|od|spas|o)\b/g, '')
    .replace(/[^a-z\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DRUG_WORDS = /\b(medication|medicine|drug|used to treat|antibiotic|analgesic|antipyretic|anti-inflammatory|painkiller|tablet|capsule|antacid|antihistamine|antifungal|antiviral|\d+\s?mg)\b/i;

export async function fetchMedicineInfo(rawName) {
  const raw = (rawName || '').trim();
  if (!raw) return null;

  const key = normalize(raw);
  const aliasGeneric = BRAND_ALIASES[key] || BRAND_ALIASES[key.split(' ')[0]] || null;
  const term = aliasGeneric || raw;
  const brandNote = aliasGeneric ? `${raw} is a brand of ${aliasGeneric}.` : '';

  const url = 'https://en.wikipedia.org/w/api.php'
    + '?action=query&format=json&origin=*&redirects=1'
    + '&generator=search&gsrsearch=' + encodeURIComponent(term) + '&gsrlimit=5'
    + '&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=160';

  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not reach the info service');
  const data = await res.json();
  const pages = data && data.query && data.query.pages;
  if (!pages) return null;

  // Pick the most medicine-like result: prefer drug-keyword hits, then title match.
  const termLc = term.toLowerCase();
  let best = null, bestScore = 0;
  for (const p of Object.values(pages)) {
    const ex = p.extract || '';
    if (!ex) continue;
    let score = 0;
    if (DRUG_WORDS.test(ex)) score += 2;
    if (p.title.toLowerCase().includes(termLc) || termLc.includes(p.title.toLowerCase())) score += 1;
    if (typeof p.index === 'number') score += (5 - p.index) * 0.1; // gentle nudge toward top hits
    if (score > bestScore) { bestScore = score; best = p; }
  }
  if (!best || bestScore < 2) return null; // nothing that reads like a medicine

  return {
    title: best.title,
    brandNote,
    extract: trim(best.extract),
    url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(best.title.replace(/ /g, '_')),
    thumb: best.thumbnail ? best.thumbnail.source : null,
  };
}

// Keep it to the first ~3 sentences so the answer stays bite-sized.
function trim(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 480) return clean;
  const cut = clean.slice(0, 480);
  const lastStop = cut.lastIndexOf('. ');
  return (lastStop > 200 ? cut.slice(0, lastStop + 1) : cut) + ' …';
}
