// Mwuah — ambient motion: drifting petals + page-enter transitions.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

const PETALS = ['🌸', '💕', '🤍', '💗', '🌷'];

export function startPetals() {
  if (reduce.matches) return;
  let layer = document.getElementById('petalLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'petalLayer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  // spawn a petal every ~2.8s, never more than a handful on screen at once
  setInterval(() => {
    if (document.hidden || layer.childElementCount > 10) return;
    const p = document.createElement('span');
    p.className = 'petal';
    p.textContent = PETALS[Math.floor((Date.now() / 137) % PETALS.length)];
    p.style.left = Math.round(5 + ((Date.now() / 53) % 90)) + 'vw';
    p.style.fontSize = (16 + ((Date.now() / 31) % 16)) + 'px';
    const dur = 9000 + ((Date.now() / 17) % 6000);
    p.style.animationDuration = dur + 'ms';
    layer.appendChild(p);
    setTimeout(() => p.remove(), dur + 200);
  }, 2800);
}

export function pageEnter(el) {
  if (!el || reduce.matches) return;
  el.classList.remove('page-enter');
  // force reflow so the animation re-triggers on every route change
  void el.offsetWidth;
  el.classList.add('page-enter');
}
