// Tijmens Ruimte-Flipperkast (staand)
(() => {
'use strict';

// ---------- Instellingen ----------
const W = 540, H = 960;          // tafelgrootte (logische eenheden)
const R = 11;                    // straal van de bal
const G = 720;                   // zwaartekracht
const SUB = 10;                  // fysica-stappen per beeld
const MAXV = 1700;               // maximale snelheid
const FLIP_SNELHEID = 26;        // rad/s
const START_BALLEN = 3;
const FEEST_SECONDEN = 12;
const TAU = Math.PI * 2;

const $ = id => document.getElementById(id);
const cv = $('tafel'), ctx = cv.getContext('2d');

// ---------- Tafel opbouwen ----------
const segs = [];                 // muren
const addSeg = (ax, ay, bx, by, rad = 3, e = 0.45, groep = 'muur') => segs.push({ ax, ay, bx, by, rad, e, groep });

// Boog bovenin
const CX = 270, CY = 290, CR = 250, N = 48;
const boog = [[CX - CR, CY]];
for (let i = 1; i <= N; i++) {
  const t = Math.PI + Math.PI * i / N;
  boog.push([CX + CR * Math.cos(t), CY + CR * Math.sin(t)]);
}
for (let i = 0; i < N; i++) addSeg(boog[i][0], boog[i][1], boog[i + 1][0], boog[i + 1][1]);

addSeg(20, 290, 20, 788);        // linkermuur
addSeg(520, 290, 520, 880);      // rechtermuur
addSeg(478, 880, 520, 880);      // bodem van de baan
addSeg(478, 240, 478, 880);      // scheiding van de baan
addSeg(20, 788, 146, 857, 3, 0.45, 'geleider');   // linker geleider
addSeg(478, 788, 352, 857, 3, 0.45, 'geleider');  // rechter geleider

// Lichtbruggen: twee rails met een gang ertussen
const bruggen = [
  { a: [110, 575, 158, 665], b: [77, 593, 125, 683], sx: 117, sy: 629, tijd: -9, flits: 0 },
  { a: [388, 575, 340, 665], b: [421, 593, 373, 683], sx: 381, sy: 629, tijd: -9, flits: 0 }
];
for (const br of bruggen) { addSeg(...br.a, 3, 0.45, 'brug'); addSeg(...br.b, 3, 0.45, 'brug'); }

// Klepje: voorkomt dat de bal terug de baan in valt
const klep = { ax: 478, ay: 225, bx: 520, by: 205, rad: 3, e: 0.3, aan: false };

// Discoplaneten (bumpers) met een maantje eromheen
const planeten = [
  { x: 150, y: 395, r: 36, hue: 320, lit: false, flits: 0, tijd: -9 },
  { x: 348, y: 395, r: 36, hue: 190, lit: false, flits: 0, tijd: -9 },
  { x: 249, y: 520, r: 36, hue: 45,  lit: false, flits: 0, tijd: -9 }
];
const manen = planeten.map((p, i) => ({ p, hoek: i * 2.1, w: i % 2 ? -1.5 : 1.5, orb: 62, r: 11, tijd: -9, flits: 0, x: 0, y: 0 }));
function zetManen() { for (const m of manen) { const a = m.hoek + m.w * spel.v; m.x = m.p.x + Math.cos(a) * m.orb; m.y = m.p.y + Math.sin(a) * m.orb; } }

// Discoballen om te pakken
const discos = [[75, 470], [423, 470], [249, 300], [249, 690], [115, 175], [383, 175]]
  .map(([x, y]) => ({ x, y, r: 15, weg: false, terug: 0, aan: 1, flits: 0 }));

// Ruimtepoort: twee wormgaten, ga je in het ene dan kom je uit het andere
const poorten = [{ x: 70, y: 255, r: 22, flits: 0 }, { x: 428, y: 255, r: 22, flits: 0 }];
let poortTijd = -9;

// Raket bovenin
const raket = {
  x: 249, tijd: -9, anim: 0,
  caps: [[249, 124, 249, 124, 15], [249, 158, 249, 192, 24], [222, 200, 203, 234, 5], [276, 200, 295, 234, 5]]
};

// Astronaut: heel klein en zweeft rond. Eén keer raken = eindscore x2
const astro = { r: 9, geraakt: false, tijd: -9, flits: 0, x: 249, y: 255 };
function zetAstro() {
  astro.x = 249 + 175 * Math.sin(spel.v * 0.45);
  astro.y = 255 + 70 * Math.sin(spel.v * 0.7 + 1);
}

// Flippers
const flippers = [
  { px: 150, py: 860, L: 84, dir: 1,  rest: 0.5, up: -0.5, a: 0.5, druk: false, tv: [0, 0] },
  { px: 348, py: 860, L: 84, dir: -1, rest: 0.5, up: -0.5, a: 0.5, druk: false, tv: [0, 0] }
];
const tip = f => ({ x: f.px + f.dir * f.L * Math.cos(f.a), y: f.py + f.L * Math.sin(f.a) });

// ---------- Spelstatus ----------
const bal = { x: 499, y: 850, vx: 0, vy: 0, actief: false, trail: [] };
const spel = { staat: 'start', punten: 0, ballen: START_BALLEN, record: 0, wacht: 0, stil: 0, baan: 0, t: 0, v: 0, feest: 0 };
const popups = [], deeltjes = [];
try { spel.record = +localStorage.getItem('flipperRecord2') || 0; } catch (e) {}

function punt(x, y, n, kleur) {
  const v = n * (spel.feest > 0 ? 2 : 1);
  spel.punten += v;
  popups.push({ x, y, t: 0, txt: '+' + v, groot: v >= 20 ? 2 : v >= 5 ? 1 : 0, kleur });
  if (spel.punten > spel.record) {
    spel.record = spel.punten;
    try { localStorage.setItem('flipperRecord2', spel.record); } catch (e) {}
  }
}

function vonken(x, y, n, hue, snel = 260, ster = false) {
  for (let i = 0; i < n && deeltjes.length < 260; i++) {
    const a = Math.random() * TAU, s = snel * (0.3 + Math.random() * 0.8);
    deeltjes.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, max: 0.5 + Math.random() * 0.7,
      h: hue < 0 ? Math.random() * 360 : hue + (Math.random() - 0.5) * 40, s: 5 + Math.random() * 9, ster });
  }
}

function lanceer() {
  bal.x = 499; bal.y = 850; bal.vx = 0; bal.vy = -1500; bal.actief = true; bal.trail = [];
  klep.aan = false; spel.stil = 0; spel.baan = 0;
  geluid(180, 0.25, 'sawtooth', 0.12, 700);
}

function nieuwSpel() {
  spel.punten = 0; spel.ballen = START_BALLEN; spel.staat = 'speel'; spel.wacht = 0.6; spel.feest = 0; astro.geraakt = false;
  planeten.forEach(p => p.lit = false);
  bal.actief = false;
  $('scherm').classList.add('weg');
  try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
}

function verloren() {
  bal.actief = false;
  spel.ballen -= 1;
  geluid(300, 0.5, 'triangle', 0.15, 80);
  if (spel.ballen > 0) { spel.wacht = 1.0; }
  else {
    spel.staat = 'einde';
    const basis = spel.punten;
    if (astro.geraakt) {
      spel.punten = basis * 2;
      if (spel.punten > spel.record) {
        spel.record = spel.punten;
        try { localStorage.setItem('flipperRecord2', spel.record); } catch (e) {}
      }
    }
    $('schermTitel').textContent = 'Klaar! 🌟';
    $('schermTekst').textContent = (astro.geraakt ? 'Je had ' + basis + ' punten. Astronaut-bonus x2: ' + spel.punten + ' punten!' : 'Je hebt ' + spel.punten + ' punten.') +
      (spel.punten >= spel.record && spel.punten > 0 ? ' Nieuw record!' : ' Record: ' + spel.record + '.');
    $('uitleg').style.display = 'none'; $('feest').style.display = 'none';
    $('start').textContent = 'OPNIEUW';
    setTimeout(() => $('scherm').classList.remove('weg'), 700);
  }
}

// ---------- Geluid ----------
let ac = null;
function geluid(freq, dur, type = 'sine', vol = 0.1, naar = null, vertraging = 0) {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t0 = ac.currentTime + vertraging;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (naar) o.frequency.exponentialRampToValueAtTime(naar, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur);
  } catch (e) {}
}
const fanfare = () => [523, 659, 784, 1047, 1319].forEach((f, i) => geluid(f, 0.25, 'square', 0.07, null, i * 0.09));

// ---------- Fysica ----------
function rakenSeg(ax, ay, bx, by, rad, e, f) {
  const abx = bx - ax, aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = l2 ? ((bal.x - ax) * abx + (bal.y - ay) * aby) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t, cy = ay + aby * t;
  let dx = bal.x - cx, dy = bal.y - cy;
  const d = Math.hypot(dx, dy), min = R + rad;
  if (d >= min) return false;
  if (d > 1e-6) { dx /= d; dy /= d; } else { dx = 0; dy = -1; }
  bal.x = cx + dx * min; bal.y = cy + dy * min;
  const sx = f ? f.tv[0] * t : 0, sy = f ? f.tv[1] * t : 0;   // snelheid van het oppervlak
  const rx = bal.vx - sx, ry = bal.vy - sy;
  const vn = rx * dx + ry * dy;
  if (vn < 0) {
    bal.vx = sx + rx - (1 + e) * vn * dx;
    bal.vy = sy + ry - (1 + e) * vn * dy;
  }
  return true;
}

// Bumper: gooit de bal weg
function bumper(ax, ay, bx, by, rad, minV) {
  const abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby;
  let t = l2 ? ((bal.x - ax) * abx + (bal.y - ay) * aby) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t, cy = ay + aby * t;
  let dx = bal.x - cx, dy = bal.y - cy;
  const d = Math.hypot(dx, dy), min = R + rad;
  if (d >= min) return false;
  if (d > 1e-6) { dx /= d; dy /= d; } else { dx = 0; dy = -1; }
  bal.x = cx + dx * min; bal.y = cy + dy * min;
  const v = Math.min(950, Math.max(minV, Math.hypot(bal.vx, bal.vy) * 0.9 + 120));
  bal.vx = dx * v; bal.vy = dy * v;
  return true;
}

function planeetGeraakt(p) {
  p.flits = 1; p.lit = true;
  punt(p.x, p.y - p.r - 10, 2, p.hue);
  vonken(p.x, p.y, 10, p.hue, 300);
  geluid(520 + Math.random() * 300, 0.15, 'sine', 0.14, 1200);
  if (planeten.every(q => q.lit)) {
    if (spel.feest <= 0) punt(249, 450, 20, 50);
    spel.feest = FEEST_SECONDEN;
    planeten.forEach(q => { q.lit = false; q.flits = 1; });
    vonken(249, 450, 60, -1, 420, true);
    fanfare();
  }
}

function stap(h) {
  for (const f of flippers) {
    const oud = tip(f);
    const doel = f.druk ? f.up : f.rest, sp = FLIP_SNELHEID * h;
    f.a = f.a > doel ? Math.max(doel, f.a - sp) : Math.min(doel, f.a + sp);
    const nw = tip(f);
    f.tv = [(nw.x - oud.x) / h, (nw.y - oud.y) / h];
  }

  bal.vy += G * h;
  bal.x += bal.vx * h; bal.y += bal.vy * h;

  for (const s of segs) rakenSeg(s.ax, s.ay, s.bx, s.by, s.rad, s.e);
  if (klep.aan) rakenSeg(klep.ax, klep.ay, klep.bx, klep.by, klep.rad, klep.e);
  for (const f of flippers) {
    const t = tip(f);
    if (rakenSeg(f.px, f.py, t.x, t.y, 9, 0.3, f) && f.druk && Math.abs(f.tv[1]) > 50) geluid(220, 0.08, 'square', 0.05);
  }

  // Raket: veel punten
  let raak = false;
  for (const c of raket.caps) if (bumper(c[0], c[1], c[2], c[3], c[4], 650)) raak = true;
  if (raak && spel.t - raket.tijd > 0.5) {
    raket.tijd = spel.t; raket.anim = 1;
    punt(raket.x, 90, 25, 20);
    vonken(raket.x, 230, 40, 30, 380, true);
    geluid(120, 0.7, 'sawtooth', 0.14, 1000);
  }

  // Planeten
  for (const p of planeten) {
    if (bumper(p.x, p.y, p.x, p.y, p.r, 560) && spel.t - p.tijd > 0.15) { p.tijd = spel.t; planeetGeraakt(p); }
  }

  // Maantjes (niet hard)
  for (const m of manen) {
    if (Math.hypot(bal.x - m.x, bal.y - m.y) < R + m.r && spel.t - m.tijd > 1.2) {
      m.tijd = spel.t; m.flits = 1; punt(m.x, m.y - 20, 5, 190);
      vonken(m.x, m.y, 14, 190, 260);
      geluid(900, 0.2, 'triangle', 0.1, 1600);
    }
  }

  // Discoballen pakken
  for (const d of discos) {
    if (!d.weg && Math.hypot(bal.x - d.x, bal.y - d.y) < R + d.r) {
      d.weg = true; d.terug = spel.v + 7;
      punt(d.x, d.y - 22, 5, 60);
      vonken(d.x, d.y, 24, -1, 320, true);
      geluid(1200, 0.25, 'sine', 0.12, 2200);
    }
  }

  // Ruimtepoort
  for (let i = 0; i < 2; i++) {
    const p = poorten[i];
    if (Math.hypot(bal.x - p.x, bal.y - p.y) < p.r && spel.t - poortTijd > 1.6) {
      const q = poorten[1 - i];
      poortTijd = spel.t; p.flits = q.flits = 1;
      punt(q.x, q.y - 34, 5, 280);
      vonken(p.x, p.y, 16, 280, 260); vonken(q.x, q.y, 16, 190, 260);
      bal.x = q.x; bal.y = q.y; bal.trail = [];
      const dx = 249 - q.x, dy = 430 - q.y, dl = Math.hypot(dx, dy), v = Math.max(520, Math.hypot(bal.vx, bal.vy) * 0.8);
      bal.vx = dx / dl * v; bal.vy = dy / dl * v;
      geluid(300, 0.35, 'sawtooth', 0.08, 1400);
    }
  }

  // Lichtbruggen
  for (const br of bruggen) {
    if (Math.hypot(bal.x - br.sx, bal.y - br.sy) < 17 && spel.t - br.tijd > 1.2) {
      br.tijd = spel.t; br.flits = 1; punt(br.sx, br.sy - 26, 3, 165);
      vonken(br.sx, br.sy, 10, 165, 200);
      geluid(400, 0.25, 'triangle', 0.1, 800);
    }
  }

  // Astronaut
  if (Math.hypot(bal.x - astro.x, bal.y - astro.y) < R + astro.r && spel.t - astro.tijd > 0.8) {
    astro.tijd = spel.t; astro.flits = 1;
    vonken(astro.x, astro.y, 30, 50, 300, true);
    if (!astro.geraakt) {
      astro.geraakt = true;
      popups.push({ x: astro.x, y: astro.y - 24, t: 0, txt: 'EINDSCORE x2!', groot: 1, kleur: 50 });
      fanfare();
    } else {
      popups.push({ x: astro.x, y: astro.y - 24, t: 0, txt: 'x2 staat al!', groot: 0, kleur: 50 });
      geluid(900, 0.2, 'triangle', 0.1, 1500);
    }
  }

  // Klepje dicht zodra de bal in het veld is
  if (!klep.aan && bal.x < 470 && bal.y < 270) klep.aan = true;

  const v = Math.hypot(bal.vx, bal.vy);
  if (v > MAXV) { bal.vx *= MAXV / v; bal.vy *= MAXV / v; }
}

function fysica(dt) {
  const h = dt / SUB;
  zetManen(); zetAstro();
  for (let i = 0; i < SUB; i++) { spel.t += h; stap(h); }
  if (spel.feest > 0) spel.feest = Math.max(0, spel.feest - dt);
  const v = Math.hypot(bal.vx, bal.vy);
  // Onderin de baan blijven liggen: opnieuw inschieten
  if (bal.x > 480 && bal.y > 760 && v < 40) {
    spel.baan += dt;
    if (spel.baan > 1.2) lanceer();
  } else spel.baan = 0;
  // Vastzitten voorkomen
  if (v < 25 && bal.y < 790 && bal.x <= 480) {
    spel.stil += dt;
    if (spel.stil > 2.2) { bal.vx = (Math.random() - 0.5) * 300; bal.vy = -320; spel.stil = 0; }
  } else spel.stil = 0;
  if (bal.y > H + 30) verloren();
}

// ---------- Invoer ----------
const knopEl = [$('knopL'), $('knopR')];
const aanrakingen = new Map();           // pointerId -> kant
const keys = new Set();
function zetFlippers() {
  const kant = [false, false];
  for (const k of aanrakingen.values()) kant[k] = true;
  for (const k of keys) kant[k] = true;
  kant.forEach((v, i) => {
    if (v && !flippers[i].druk && spel.staat === 'speel') geluid(160, 0.06, 'square', 0.05);
    flippers[i].druk = v; knopEl[i].classList.toggle('aan', v);
  });
}
const toets = { ArrowLeft: 0, z: 0, Z: 0, a: 0, A: 0, ArrowRight: 1, m: 1, M: 1, l: 1, L: 1, '/': 1 };
window.addEventListener('keydown', e => {
  if (e.key in toets) { keys.add(toets[e.key]); zetFlippers(); e.preventDefault(); }
  if ((e.key === 'Enter' || e.key === ' ') && !$('scherm').classList.contains('weg')) nieuwSpel();
});
window.addEventListener('keyup', e => { if (e.key in toets) { keys.delete(toets[e.key]); zetFlippers(); } });
window.addEventListener('pointerdown', e => {
  if (e.target.id === 'start') return;
  aanrakingen.set(e.pointerId, e.clientX < innerWidth / 2 ? 0 : 1); zetFlippers();
});
for (const ev of ['pointerup', 'pointercancel']) {
  window.addEventListener(ev, e => { aanrakingen.delete(e.pointerId); zetFlippers(); });
}
window.addEventListener('contextmenu', e => e.preventDefault());
$('start').addEventListener('click', nieuwSpel);

// ---------- Tekenhulp ----------
let schaal = 1, bg = null;
const sterren = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.6, f: Math.random() * TAU, s: 0.6 + Math.random() * 2.4 }));
const lampen = Array.from({ length: 27 }, (_, i) => {
  const t = Math.PI + Math.PI * (i + 0.5) / 27;
  return [CX + (CR - 17) * Math.cos(t), CY + (CR - 17) * Math.sin(t)];
});

const glows = {};
function glow(h) {
  const k = (((Math.round(h / 10)) % 36) + 36) % 36;
  if (!glows[k]) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `hsla(${k * 10},100%,90%,1)`); g.addColorStop(0.25, `hsla(${k * 10},100%,62%,.6)`); g.addColorStop(1, `hsla(${k * 10},100%,50%,0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); glows[k] = c;
  }
  return glows[k];
}
function lichtje(x, y, r, h, a = 1) { ctx.globalAlpha = a; ctx.drawImage(glow(h), x - r, y - r, 2 * r, 2 * r); }
function cirkel(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }

function neonSegs(c, lijst, glowKleur, kern, w) {
  c.lineCap = 'round';
  for (const [lw, a, kleur] of [[w * 4.2, 0.10, glowKleur], [w * 2.4, 0.22, glowKleur], [w, 1, kern]]) {
    c.lineWidth = lw; c.globalAlpha = a; c.strokeStyle = kleur;
    c.beginPath();
    for (const s of lijst) { c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); }
    c.stroke();
  }
  c.globalAlpha = 1;
}

// Discobal / discoplaneet tekenen met spiegeltegeltjes
function discoBal(x, y, r, rot, hue, nb, ns, regenboog) {
  ctx.fillStyle = '#0d0d2a'; cirkel(x, y, r); ctx.fill();
  ctx.lineWidth = Math.max(0.5, r / 45); ctx.strokeStyle = 'rgba(0,0,20,.55)';
  for (let i = 0; i < nb; i++) {
    const a0 = -Math.PI / 2 + Math.PI * i / nb, a1 = -Math.PI / 2 + Math.PI * (i + 1) / nb, am = (a0 + a1) / 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    for (let j = 0; j < ns; j++) {
      const l0 = rot + TAU * j / ns, l1 = rot + TAU * (j + 1) / ns, lm = (l0 + l1) / 2;
      const nz = Math.cos(am) * Math.cos(lm);
      if (nz < 0.03) continue;
      const nx = Math.cos(am) * Math.sin(lm), ny = Math.sin(am);
      const licht = 0.3 * nz + 0.7 * Math.max(0, -0.55 * nx - 0.65 * ny) + 0.1;
      const glint = Math.sin(spel.v * 4 + i * 1.9 + j * 2.7 + hue) > 0.955;
      let hh = regenboog ? (hue + j * (360 / ns) * 0.6 + spel.v * 80) : hue + ((i * 9 + j * 5) % 50) - 25;
      const l = glint ? 95 : 16 + licht * 62 + (((i + j) & 1) ? 7 : 0);
      ctx.fillStyle = `hsl(${hh % 360},${glint ? 25 : 60}%,${l}%)`;
      ctx.beginPath();
      ctx.moveTo(x + r * c0 * Math.sin(l0), y + r * s0);
      ctx.lineTo(x + r * c0 * Math.sin(l1), y + r * s0);
      ctx.lineTo(x + r * c1 * Math.sin(l1), y + r * s1);
      ctx.lineTo(x + r * c1 * Math.sin(l0), y + r * s1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}

// ---------- Achtergrond (eenmalig getekend) ----------
function bak() {
  bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
  const c = bg.getContext('2d'); c.setTransform(schaal, 0, 0, schaal, 0, 0);
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#070726'); g.addColorStop(0.45, '#1b0a4a'); g.addColorStop(1, '#050620');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const neb = (x, y, r, kleur) => {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, kleur); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  };
  neb(110, 640, 280, 'rgba(255,60,190,.22)'); neb(440, 330, 290, 'rgba(60,190,255,.20)');
  neb(270, 900, 300, 'rgba(130,60,255,.26)'); neb(300, 140, 220, 'rgba(255,170,60,.12)');

  // ver weg: een grote planeet met ring
  c.save(); c.globalAlpha = 0.55;
  const pg = c.createRadialGradient(370, 745, 8, 390, 770, 120);
  pg.addColorStop(0, '#5a6ad8'); pg.addColorStop(0.6, '#23286e'); pg.addColorStop(1, '#0b0c36');
  c.fillStyle = pg; c.beginPath(); c.arc(390, 770, 105, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(190,200,255,.5)'; c.lineWidth = 7;
  c.beginPath(); c.ellipse(390, 770, 170, 36, -0.35, 0, TAU); c.stroke();
  c.restore();

  // kleine sterren
  for (let i = 0; i < 160; i++) {
    c.globalAlpha = 0.25 + Math.random() * 0.6; c.fillStyle = '#fff';
    c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 0.4 + Math.random() * 1.1, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;

  // radar-ringen op het speelveld
  c.strokeStyle = 'rgba(120,170,255,.07)'; c.lineWidth = 1.5;
  for (let r = 70; r < 520; r += 70) { c.beginPath(); c.arc(249, 470, r, 0, TAU); c.stroke(); }
  for (let a = 0; a < 12; a++) { c.beginPath(); c.moveTo(249, 470); c.lineTo(249 + Math.cos(a * TAU / 12) * 520, 470 + Math.sin(a * TAU / 12) * 520); c.stroke(); }

  // baan voor de bal: pijltjes omhoog
  c.strokeStyle = 'rgba(255,230,120,.5)'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let y = 560; y < 840; y += 55) { c.beginPath(); c.moveTo(490, y + 12); c.lineTo(499, y); c.lineTo(508, y + 12); c.stroke(); }

  // neon muren
  neonSegs(c, segs.filter(s => s.groep === 'muur'), '#2bbcff', '#d8f6ff', 4.5);
  neonSegs(c, segs.filter(s => s.groep === 'geleider'), '#ff2fb0', '#ffd6f2', 4.5);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.restore();
}

function pas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
  schaal = cv.width / W;
  bak();
}
window.addEventListener('resize', pas); pas();

// ---------- Tekenen ----------
function tekenRaket() {
  const sx = raket.anim > 0 ? Math.sin(spel.v * 70) * 3 * raket.anim : 0;
  const sy = raket.anim > 0 ? -Math.sin(raket.anim * Math.PI) * 16 : 0;
  ctx.save(); ctx.translate(sx, sy);
  // vlam
  const fl = 22 + Math.sin(spel.v * 30) * 5 + raket.anim * 80;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9; ctx.drawImage(glow(25), 249 - 24, 214, 48, fl * 2.2);
  ctx.drawImage(glow(50), 249 - 15, 214, 30, fl * 1.6);
  ctx.drawImage(glow(200), 249 - 8, 214, 16, fl);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // vinnen
  ctx.fillStyle = '#d6203a'; ctx.strokeStyle = '#7c0a1c'; ctx.lineWidth = 2;
  for (const d of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(249 + d * 24, 186); ctx.lineTo(249 + d * 49, 238); ctx.lineTo(249 + d * 24, 214); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // straalpijp
  ctx.fillStyle = '#2a2d4a'; ctx.fillRect(237, 212, 24, 11);
  // romp
  const romp = new Path2D('M249 96 C263 112 273 135 273 160 L273 214 L225 214 L225 160 C225 135 235 112 249 96 Z');
  const hg = ctx.createLinearGradient(225, 0, 273, 0);
  hg.addColorStop(0, '#9aa3c8'); hg.addColorStop(0.35, '#ffffff'); hg.addColorStop(0.7, '#dfe4f7'); hg.addColorStop(1, '#8089b0');
  ctx.fillStyle = hg; ctx.fill(romp);
  ctx.save(); ctx.clip(romp);
  const ng = ctx.createLinearGradient(225, 0, 273, 0);
  ng.addColorStop(0, '#a0102a'); ng.addColorStop(0.4, '#ff5a6e'); ng.addColorStop(1, '#a0102a');
  ctx.fillStyle = ng; ctx.fillRect(220, 90, 60, 50);
  ctx.fillStyle = '#d6203a'; ctx.fillRect(220, 196, 60, 8);
  ctx.restore();
  ctx.strokeStyle = '#59608a'; ctx.lineWidth = 2; ctx.stroke(romp);
  // raampje
  ctx.fillStyle = '#c9d2f2'; cirkel(249, 168, 14); ctx.fill();
  const rg = ctx.createRadialGradient(244, 163, 1, 249, 168, 11);
  rg.addColorStop(0, '#d9f6ff'); rg.addColorStop(0.5, '#38a6ff'); rg.addColorStop(1, '#0d2c75');
  ctx.fillStyle = rg; cirkel(249, 168, 11); ctx.fill();
  ctx.strokeStyle = '#59608a'; ctx.lineWidth = 2; cirkel(249, 168, 14); ctx.stroke();
  ctx.restore();
  // "25" bordje
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = 'bold 15px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('RAKET 25', 249, 262);
}

function tekenAstro() {
  zetAstro();
  astro.flits = Math.max(0, astro.flits - 0.03);
  const { x, y } = astro, hoek = 0.5 * Math.sin(spel.v * 1.3), arm = Math.sin(spel.v * 3);
  ctx.globalCompositeOperation = 'lighter';
  lichtje(x, y, 30 + astro.flits * 24, 50, astro.geraakt ? 0.65 : 0.4);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(hoek); ctx.scale(1.15, 1.15);
  ctx.lineCap = 'round'; ctx.strokeStyle = '#f4f6ff'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-3.8, -1); ctx.lineTo(-8, 1.5 + arm * 2.5); ctx.moveTo(3.8, -1); ctx.lineTo(8, 1.5 - arm * 2.5);
  ctx.moveTo(-2, 5); ctx.lineTo(-3.5, 10.5 + arm); ctx.moveTo(2, 5); ctx.lineTo(3.5, 10.5 - arm); ctx.stroke();
  ctx.fillStyle = '#8c93b8'; ctx.fillRect(-6.2, -3.5, 3, 9);
  ctx.fillStyle = '#f4f6ff'; ctx.strokeStyle = '#8c93b8'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.roundRect(-4.2, -3.5, 8.4, 9.5, 2.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff5a3c'; ctx.fillRect(-1.6, -1.5, 3.2, 2.2);
  ctx.fillStyle = '#f4f6ff'; cirkel(0, -6.5, 5.6); ctx.fill(); ctx.stroke();
  const vg = ctx.createRadialGradient(-0.5, -7.5, 0.5, 0.5, -6.5, 4);
  vg.addColorStop(0, '#fff3c0'); vg.addColorStop(0.5, '#f0b030'); vg.addColorStop(1, '#8a4a00');
  ctx.fillStyle = vg; cirkel(0.6, -6.4, 3.6); ctx.fill();
  ctx.restore();
}

function tekenWormgat(p, i) {
  p.flits = Math.max(0, p.flits - 0.02);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = 'lighter';
  lichtje(0, 0, 44 + p.flits * 22, i ? 190 : 280, 0.55 + p.flits * 0.45);
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = `hsl(${(i ? 170 : 270) + k * 28},100%,${62 + k * 6}%)`;
    ctx.globalAlpha = 0.75 + p.flits * 0.25; ctx.lineWidth = 3;
    const rr = p.r * (0.3 + k * 0.22), a0 = spel.v * (1.4 + k * 0.6) * (i ? -1 : 1) + k;
    ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 4.1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = 'bold 12px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('POORT 5', p.x, p.y + 42);
}

function tekenBrug(br) {
  br.flits = Math.max(0, br.flits - 0.02);
  const [ax, ay, bx, by] = br.a, [cx, cy, dx, dy] = br.b;
  ctx.fillStyle = `rgba(60,255,220,${0.14 + 0.45 * br.flits})`;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(dx, dy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const u = ((spel.v * 0.9 + k / 7) % 1);
    ctx.strokeStyle = `rgba(150,255,235,${0.25 + 0.6 * Math.sin(u * Math.PI)})`; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax + (bx - ax) * u, ay + (by - ay) * u);
    ctx.lineTo(cx + (dx - cx) * u, cy + (dy - cy) * u); ctx.stroke();
  }
  for (const [lw, a] of [[13, 0.12], [7, 0.3]]) {
    ctx.strokeStyle = '#27ffd0'; ctx.lineWidth = lw; ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#d8fff8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = 'bold 12px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('BRUG 3', br.sx, br.sy + 70);
}

function tekenHud() {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(190,210,255,.85)'; ctx.font = 'bold 12px "Trebuchet MS",sans-serif';
  ctx.fillText('PUNTEN', 16, 24);
  ctx.font = 'bold 40px "Trebuchet MS",sans-serif';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,10,50,.9)'; ctx.strokeText(spel.punten, 16, 64);
  ctx.fillStyle = '#fff'; ctx.fillText(spel.punten, 16, 64);
  ctx.font = 'bold 12px "Trebuchet MS",sans-serif'; ctx.fillStyle = 'rgba(150,240,255,.9)';
  ctx.fillText('RECORD ' + spel.record, 16, 88);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(190,210,255,.85)'; ctx.fillText('BALLEN', W - 16, 24);
  for (let i = 0; i < START_BALLEN; i++) {
    const x = W - 22 - i * 24, on = i < spel.ballen;
    ctx.fillStyle = on ? '#e8f0ff' : 'rgba(150,170,220,.25)'; cirkel(x, 42, 8); ctx.fill();
    if (on) { ctx.fillStyle = '#fff'; cirkel(x - 2.5, 39.5, 2.5); ctx.fill(); }
  }
  if (astro.geraakt) {
    ctx.textAlign = 'right'; ctx.font = 'bold 20px "Trebuchet MS",sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,10,50,.9)'; ctx.strokeText('einde x2', W - 16, 102);
    ctx.fillStyle = '#ffd95a'; ctx.fillText('einde x2', W - 16, 102);
  }
  if (spel.feest > 0) {
    const h = (spel.v * 160) % 360;
    ctx.textAlign = 'right'; ctx.font = 'bold 22px "Trebuchet MS",sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,10,50,.9)';
    ctx.strokeText('x2 ' + Math.ceil(spel.feest) + 's', W - 16, 74);
    ctx.fillStyle = `hsl(${h},100%,70%)`; ctx.fillText('x2 ' + Math.ceil(spel.feest) + 's', W - 16, 74);
    ctx.textAlign = 'center'; ctx.font = 'bold 20px "Trebuchet MS",sans-serif';
    ctx.strokeText('DISCOFEEST!', 270, 28); ctx.fillText('DISCOFEEST!', 270, 28);
  }
}

let vorigeFeest = 0;
function teken(dt) {
  ctx.setTransform(schaal, 0, 0, schaal, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0);
  ctx.setTransform(schaal, 0, 0, schaal, 0, 0);
  const feest = spel.feest > 0, hFeest = (spel.v * 120) % 360;

  // twinkelende sterren
  ctx.globalCompositeOperation = 'lighter';
  for (const s of sterren) {
    lichtje(s.x, s.y, s.r * 5, 210, 0.15 + 0.6 * Math.abs(Math.sin(spel.v * s.s + s.f)));
  }
  // discolichten
  if (feest) {
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 2 + Math.sin(spel.v * 1.3 + k * 1.05) * 0.9 + (k - 2.5) * 0.28;
      ctx.fillStyle = `hsla(${(hFeest + k * 60) % 360},100%,60%,.10)`;
      ctx.beginPath(); ctx.moveTo(249, -10);
      ctx.lineTo(249 + Math.cos(a - 0.09) * 1100, -10 + Math.sin(a - 0.09) * 1100);
      ctx.lineTo(249 + Math.cos(a + 0.09) * 1100, -10 + Math.sin(a + 0.09) * 1100);
      ctx.closePath(); ctx.fill();
    }
  }
  // lampjes langs de boog
  const stapL = Math.floor(spel.v * (feest ? 8 : 3));
  lampen.forEach(([x, y], i) => {
    const aan = feest ? true : (i + stapL) % 3 === 0;
    lichtje(x, y, aan ? 13 : 7, feest ? (hFeest + i * 14) : (i % 2 ? 50 : 320), aan ? 0.95 : 0.25);
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // klepje
  if (klep.aan) neonSegs(ctx, [klep], '#2bbcff', '#d8f6ff', 4.5);

  poorten.forEach(tekenWormgat);
  bruggen.forEach(tekenBrug);
  tekenRaket();
  tekenAstro();

  // planeten en maantjes
  zetManen();
  for (const p of planeten) {
    p.flits = Math.max(0, p.flits - 0.04);
    const hue = feest ? (p.hue + hFeest) % 360 : p.hue;
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
    cirkel(p.x, p.y, 62); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    lichtje(p.x, p.y, p.r * (2.2 + p.flits * 0.8), hue, 0.38 + 0.6 * p.flits + (p.lit ? 0.35 : 0));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const s = 1 + 0.1 * p.flits;
    discoBal(p.x, p.y, p.r * s, spel.v * 0.7 + p.hue, hue, 9, 16, feest);
    if (p.lit) {
      ctx.strokeStyle = `hsl(${hue},100%,75%)`; ctx.lineWidth = 3.5; cirkel(p.x, p.y, p.r + 6); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter'; lichtje(p.x - 12, p.y - 14, 17, 200, 0.75);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  for (const m of manen) {
    m.flits = Math.max(0, m.flits - 0.03);
    ctx.globalCompositeOperation = 'lighter'; lichtje(m.x, m.y, 26 + m.flits * 14, 190, 0.5 + m.flits * 0.5);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    discoBal(m.x, m.y, m.r, spel.v * 2 + m.hoek, 195, 5, 9, true);
  }

  // discoballen
  for (const d of discos) {
    if (d.weg && spel.v > d.terug) { d.weg = false; d.aan = 0; vonken(d.x, d.y, 8, 200, 120); }
    if (d.weg) continue;
    d.aan = Math.min(1, d.aan + dt * 2.5);
    const bob = Math.sin(spel.v * 2 + d.x) * 3;
    ctx.globalCompositeOperation = 'lighter'; lichtje(d.x, d.y + bob, 32 * d.aan, feest ? hFeest : 215, 0.55);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    discoBal(d.x, d.y + bob, d.r * d.aan, spel.v * 1.1 + d.x, 215, 7, 12, true);
    ctx.globalCompositeOperation = 'lighter';
    const tw = Math.abs(Math.sin(spel.v * 3 + d.y));
    ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.6 * tw})`; ctx.lineWidth = 1.5;
    const sp = 9 + 8 * tw; ctx.beginPath();
    ctx.moveTo(d.x - d.r - sp, d.y + bob - d.r); ctx.lineTo(d.x - d.r + sp, d.y + bob - d.r);
    ctx.moveTo(d.x - d.r, d.y + bob - d.r - sp); ctx.lineTo(d.x - d.r, d.y + bob - d.r + sp); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // flippers
  for (const f of flippers) {
    const t = tip(f);
    const dx = t.x - f.px, dy = t.y - f.py, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    ctx.globalCompositeOperation = 'lighter'; lichtje((f.px + t.x) / 2, (f.py + t.y) / 2, f.druk ? 70 : 52, f.druk ? 50 : 320, f.druk ? 0.9 : 0.45);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const gr = ctx.createLinearGradient(f.px + nx * 14, f.py + ny * 14, f.px - nx * 14, f.py - ny * 14);
    if (f.druk) { gr.addColorStop(0, '#fff6a8'); gr.addColorStop(0.5, '#ffc21a'); gr.addColorStop(1, '#d06a00'); }
    else { gr.addColorStop(0, '#ff9be3'); gr.addColorStop(0.5, '#ec2fb5'); gr.addColorStop(1, '#8a0a66'); }
    const ang = Math.atan2(ny, nx);
    ctx.fillStyle = gr; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(f.px + nx * 13, f.py + ny * 13); ctx.lineTo(t.x + nx * 8, t.y + ny * 8);
    ctx.arc(t.x, t.y, 8, ang, ang + Math.PI, true);
    ctx.lineTo(f.px - nx * 13, f.py - ny * 13);
    ctx.arc(f.px, f.py, 13, ang + Math.PI, ang + TAU, true);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(f.px + nx * 7, f.py + ny * 7); ctx.lineTo(t.x + nx * 4, t.y + ny * 4); ctx.stroke();
    ctx.fillStyle = '#fff'; cirkel(f.px, f.py, 5); ctx.fill();
    ctx.fillStyle = '#5a1a4a'; cirkel(f.px, f.py, 2.2); ctx.fill();
  }

  // bal met komeetstaart
  if (bal.actief) {
    bal.trail.push([bal.x, bal.y]); if (bal.trail.length > 16) bal.trail.shift();
    ctx.globalCompositeOperation = 'lighter';
    bal.trail.forEach(([x, y], i) => { const k = i / bal.trail.length; lichtje(x, y, 6 + k * 14, feest ? hFeest : 200, k * 0.5); });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const bgd = ctx.createRadialGradient(bal.x - 4, bal.y - 4, 1, bal.x, bal.y, R);
    bgd.addColorStop(0, '#ffffff'); bgd.addColorStop(0.45, '#c3d2ee'); bgd.addColorStop(1, '#5e6f9a');
    ctx.fillStyle = bgd; cirkel(bal.x, bal.y, R); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // vonken
  ctx.globalCompositeOperation = 'lighter';
  for (let i = deeltjes.length - 1; i >= 0; i--) {
    const d = deeltjes[i]; d.t += dt;
    if (d.t > d.max) { deeltjes.splice(i, 1); continue; }
    d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 380 * dt; d.vx *= 0.99;
    const k = 1 - d.t / d.max;
    lichtje(d.x, d.y, d.s * (0.5 + k), d.h, k);
    if (d.ster && k > 0.4) {
      ctx.strokeStyle = `hsla(${d.h},100%,85%,${k})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(d.x - d.s, d.y); ctx.lineTo(d.x + d.s, d.y); ctx.moveTo(d.x, d.y - d.s); ctx.lineTo(d.x, d.y + d.s); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // punten-pop-ups
  ctx.textAlign = 'center';
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += dt / 1.1;
    if (p.t > 1) { popups.splice(i, 1); continue; }
    const grootte = [24, 32, 48][p.groot], opacity = Math.min(1, (1 - p.t) * 2);
    ctx.font = `900 ${grootte}px "Trebuchet MS",sans-serif`;
    const half = ctx.measureText(p.txt).width / 2 + 10, y = p.y - p.t * 40, x = Math.max(half, Math.min(W - half, p.x));
    ctx.globalAlpha = opacity; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,10,60,.95)'; ctx.strokeText(p.txt, x, y);
    ctx.fillStyle = p.groot === 2 ? '#ffe45c' : `hsl(${p.kleur ?? 55},100%,${p.groot ? 78 : 85}%)`; ctx.fillText(p.txt, x, y);
  }
  ctx.globalAlpha = 1;

  if (raket.anim > 0) raket.anim = Math.max(0, raket.anim - dt * 0.9);
  tekenHud();
}

// ---------- Hoofdlus ----------
let laatste = performance.now();
function lus(nu) {
  const dt = Math.min(0.033, Math.max(0.001, (nu - laatste) / 1000)); laatste = nu;
  spel.v += dt;
  if (spel.staat === 'speel') {
    if (!bal.actief) {
      spel.wacht -= dt;
      if (spel.wacht <= 0) lanceer();
    } else fysica(dt);
  }
  teken(dt);
  requestAnimationFrame(lus);
}
requestAnimationFrame(lus);

// Offline spelen
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.__g = { astro, spel, bal, flippers, planeten, manen, discos, bruggen, poorten, raket, nieuwSpel, fysica, lanceer, zetManen };
})();
