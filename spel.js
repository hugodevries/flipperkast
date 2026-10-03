// Tijmens Ruimte-Flipperkast
(() => {
'use strict';

// ---------- Instellingen ----------
const W = 500, H = 900;          // tafelgrootte (logische eenheden)
const R = 9;                     // straal van de bal
const G = 780;                   // zwaartekracht
const SUB = 10;                  // fysica-stappen per beeld
const MAXV = 1600;               // maximale snelheid
const FLIP_SNELHEID = 24;        // rad/s
const START_BALLEN = 3;

const $ = id => document.getElementById(id);
const cv = $('tafel'), ctx = cv.getContext('2d');

// ---------- Tafel opbouwen ----------
const segs = [];                 // muren
const addSeg = (ax, ay, bx, by, rad = 3, e = 0.45) => segs.push({ ax, ay, bx, by, rad, e });

// Boog bovenin
const CX = 250, CY = 260, CR = 230, N = 40;
const boog = [[CX - CR, CY]];
for (let i = 1; i <= N; i++) {
  const t = Math.PI + Math.PI * i / N;
  boog.push([CX + CR * Math.cos(t), CY + CR * Math.sin(t)]);
}
for (let i = 0; i < N; i++) addSeg(boog[i][0], boog[i][1], boog[i + 1][0], boog[i + 1][1]);

addSeg(20, 260, 20, 700);        // linkermuur
addSeg(480, 260, 480, 830);      // rechtermuur
addSeg(440, 830, 480, 830);      // bodem van de baan
addSeg(440, 215, 440, 830);      // scheiding van de baan
addSeg(20, 700, 146, 776);       // linker geleider
addSeg(440, 700, 314, 776);      // rechter geleider

// Lichtbruggen (links en rechts): twee rails met een gang ertussen
const bruggen = [
  { a: [110, 470, 150, 545], b: [80, 486, 120, 561], sx: 115, sy: 515.5, tijd: -9, flits: 0 },
  { a: [350, 470, 310, 545], b: [380, 486, 340, 561], sx: 345, sy: 515.5, tijd: -9, flits: 0 }
];
for (const br of bruggen) { addSeg(...br.a); addSeg(...br.b); }

// Ruimtepoort bovenin: twee palen met een sensor ertussen
const poort = { x1: 195, x2: 265, y1: 68, y2: 112, tijd: -9, flits: 0 };
addSeg(poort.x1, poort.y1, poort.x1, poort.y2, 4);
addSeg(poort.x2, poort.y1, poort.x2, poort.y2, 4);

// Dicht klepje: voorkomt dat de bal terug de baan in valt
const klep = { ax: 440, ay: 205, bx: 480, by: 185, rad: 3, e: 0.3, aan: false };

// Planeten (bumpers)
const planeten = [
  { x: 160, y: 330, r: 30, kleur: ['#ffcf8a', '#e0662a'], ring: true, flits: 0 },
  { x: 300, y: 330, r: 30, kleur: ['#9fe3ff', '#2f78d8'], ring: false, flits: 0 },
  { x: 230, y: 445, r: 30, kleur: ['#e7a8ff', '#8a3bd0'], ring: true, flits: 0 }
];

// Flippers
const flippers = [
  { px: 150, py: 776, L: 68, dir: 1,  rest: 0.5, up: -0.5, a: 0.5, druk: false, tv: [0, 0] },
  { px: 310, py: 776, L: 68, dir: -1, rest: 0.5, up: -0.5, a: 0.5, druk: false, tv: [0, 0] }
];
const tip = f => ({ x: f.px + f.dir * f.L * Math.cos(f.a), y: f.py + f.L * Math.sin(f.a) });

// Sterren
const sterren = Array.from({ length: 90 }, () => ({
  x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.random() * 1.6, f: Math.random() * 6.3, s: 0.5 + Math.random() * 2
}));

// ---------- Spelstatus ----------
const bal = { x: 460, y: 800, vx: 0, vy: 0, actief: false };
const spel = { staat: 'start', punten: 0, ballen: START_BALLEN, record: 0, wacht: 0, stil: 0, t: 0 };
const popups = [];
try { spel.record = +localStorage.getItem('flipperRecord') || 0; } catch (e) {}

function ui() {
  $('punten').textContent = spel.punten;
  $('record').textContent = spel.record;
  $('ballen').textContent = '●'.repeat(Math.max(0, spel.ballen)) || '–';
}

function punt(x, y) {
  spel.punten += 1;
  popups.push({ x, y, t: 0 });
  if (spel.punten > spel.record) {
    spel.record = spel.punten;
    try { localStorage.setItem('flipperRecord', spel.record); } catch (e) {}
  }
  ui();
}

function lanceer() {
  bal.x = 460; bal.y = 800; bal.vx = 0; bal.vy = -1400; bal.actief = true;
  klep.aan = false; spel.stil = 0;
  geluid(180, 0.25, 'sawtooth', 0.12, 700);
}

function nieuwSpel() {
  spel.punten = 0; spel.ballen = START_BALLEN; spel.staat = 'speel'; spel.wacht = 0.6;
  bal.actief = false; ui();
  $('scherm').classList.add('weg');
  try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
}

function verloren() {
  bal.actief = false;
  spel.ballen -= 1; ui();
  geluid(300, 0.5, 'triangle', 0.15, 80);
  if (spel.ballen > 0) { spel.wacht = 1.0; }
  else {
    spel.staat = 'einde';
    $('schermTitel').textContent = 'Klaar! 🌟';
    $('schermTekst').textContent = 'Je hebt ' + spel.punten + ' punten' +
      (spel.punten >= spel.record && spel.punten > 0 ? ' — nieuw record!' : '. Record: ' + spel.record + '.');
    $('start').textContent = 'OPNIEUW';
    setTimeout(() => $('scherm').classList.remove('weg'), 700);
  }
}

// ---------- Geluid ----------
let ac = null;
function geluid(freq, dur, type = 'sine', vol = 0.1, naar = null) {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
    if (naar) o.frequency.exponentialRampToValueAtTime(naar, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch (e) {}
}

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
    if (rakenSeg(f.px, f.py, t.x, t.y, 8, 0.3, f) && f.druk && Math.abs(f.tv[1]) > 50) geluid(220, 0.08, 'square', 0.05);
  }

  // Planeten
  for (const p of planeten) {
    let dx = bal.x - p.x, dy = bal.y - p.y;
    const d = Math.hypot(dx, dy), min = R + p.r;
    if (d < min) {
      if (d > 1e-6) { dx /= d; dy /= d; } else { dx = 0; dy = -1; }
      bal.x = p.x + dx * min; bal.y = p.y + dy * min;
      const v = Math.min(900, Math.max(520, Math.hypot(bal.vx, bal.vy) * 0.9 + 120));
      bal.vx = dx * v; bal.vy = dy * v;
      p.flits = 1; punt(p.x, p.y - p.r - 6);
      geluid(520 + Math.random() * 300, 0.15, 'sine', 0.14, 1200);
    }
  }

  // Ruimtepoort (sensor)
  if (bal.x > poort.x1 && bal.x < poort.x2 && bal.y > poort.y1 && bal.y < poort.y2 && spel.t - poort.tijd > 1.2) {
    poort.tijd = spel.t; poort.flits = 1; punt((poort.x1 + poort.x2) / 2, poort.y1 - 14);
    geluid(300, 0.3, 'sawtooth', 0.08, 900);
  }
  // Lichtbruggen (sensor)
  for (const br of bruggen) {
    if (Math.hypot(bal.x - br.sx, bal.y - br.sy) < 15 && spel.t - br.tijd > 1.2) {
      br.tijd = spel.t; br.flits = 1; punt(br.sx, br.sy - 22);
      geluid(400, 0.25, 'triangle', 0.1, 800);
    }
  }

  // Klepje dicht zodra de bal in het veld is
  if (!klep.aan && bal.x < 430 && bal.y < 250) klep.aan = true;

  const v = Math.hypot(bal.vx, bal.vy);
  if (v > MAXV) { bal.vx *= MAXV / v; bal.vy *= MAXV / v; }
}

function fysica(dt) {
  const h = dt / SUB;
  for (let i = 0; i < SUB; i++) { spel.t += h; stap(h); }
  // Vastzitten voorkomen
  if (Math.hypot(bal.vx, bal.vy) < 25 && bal.y < 790) {
    spel.stil += dt;
    if (spel.stil > 2) { bal.vx = (Math.random() - 0.5) * 300; bal.vy = -320; spel.stil = 0; }
  } else spel.stil = 0;
  if (bal.y > H + 30) verloren();
}

// ---------- Invoer ----------
const knopEl = [$('knopL'), $('knopR')];
const aanrakingen = new Map();           // pointerId -> kant
function zetFlippers() {
  const kant = [false, false];
  for (const k of aanrakingen.values()) kant[k] = true;
  for (const k of keys) kant[k] = true;
  kant.forEach((v, i) => {
    if (v && !flippers[i].druk && spel.staat === 'speel') geluid(160, 0.06, 'square', 0.05);
    flippers[i].druk = v; knopEl[i].classList.toggle('aan', v);
  });
}
const keys = new Set();
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

// ---------- Tekenen ----------
let schaal = 1;
function pas() {
  const dpr = window.devicePixelRatio || 1;
  const hoogte = innerHeight, breedte = hoogte * W / H;
  cv.style.height = hoogte + 'px'; cv.style.width = breedte + 'px';
  cv.width = Math.round(breedte * dpr); cv.height = Math.round(hoogte * dpr);
  schaal = cv.width / W;
}
window.addEventListener('resize', pas); pas();

function cirkel(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); }

function teken() {
  ctx.setTransform(schaal, 0, 0, schaal, 0, 0);
  // achtergrond: nevel
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a3a'); g.addColorStop(0.5, '#1a0b44'); g.addColorStop(1, '#050824');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(130, 560, 10, 130, 560, 260);
  g.addColorStop(0, 'rgba(255,80,200,.18)'); g.addColorStop(1, 'rgba(255,80,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(360, 220, 10, 360, 220, 240);
  g.addColorStop(0, 'rgba(60,200,255,.16)'); g.addColorStop(1, 'rgba(60,200,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // sterren
  for (const s of sterren) {
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(spel.t * s.s + s.f));
    ctx.fillStyle = '#fff'; cirkel(s.x, s.y, s.r); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // muren
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6fd6ff'; ctx.shadowColor = '#3ab8ff'; ctx.shadowBlur = 10; ctx.lineWidth = 6;
  ctx.beginPath();
  for (const s of segs) { ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); }
  ctx.stroke();
  if (klep.aan) { ctx.beginPath(); ctx.moveTo(klep.ax, klep.ay); ctx.lineTo(klep.bx, klep.by); ctx.stroke(); }
  ctx.shadowBlur = 0;

  // lichtbruggen
  for (const br of bruggen) {
    br.flits = Math.max(0, br.flits - 0.02);
    const [ax, ay, bx, by] = br.a, [cx, cy, dx, dy] = br.b;
    ctx.fillStyle = `rgba(80,255,220,${0.15 + 0.5 * br.flits})`;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(dx, dy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(160,255,240,${0.4 + 0.6 * br.flits})`; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      const u = i / 6;
      ctx.beginPath();
      ctx.moveTo(ax + (bx - ax) * u, ay + (by - ay) * u);
      ctx.lineTo(cx + (dx - cx) * u, cy + (dy - cy) * u); ctx.stroke();
    }
    ctx.strokeStyle = '#7dffe6'; ctx.shadowColor = '#2affd0'; ctx.shadowBlur = 8; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ruimtepoort
  poort.flits = Math.max(0, poort.flits - 0.02);
  const pm = (poort.x1 + poort.x2) / 2, py = (poort.y1 + poort.y2) / 2;
  g = ctx.createRadialGradient(pm, py, 2, pm, py, 42);
  g.addColorStop(0, `rgba(255,255,255,${0.5 + 0.5 * poort.flits})`);
  g.addColorStop(0.4, `rgba(190,90,255,${0.45 + 0.4 * poort.flits})`);
  g.addColorStop(1, 'rgba(190,90,255,0)');
  ctx.fillStyle = g; ctx.fillRect(poort.x1 - 20, poort.y1 - 20, poort.x2 - poort.x1 + 40, poort.y2 - poort.y1 + 40);
  ctx.strokeStyle = '#ffd400'; ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 10; ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(poort.x1, poort.y1); ctx.lineTo(poort.x1, poort.y2);
  ctx.moveTo(poort.x2, poort.y1); ctx.lineTo(poort.x2, poort.y2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('RUIMTEPOORT', pm, poort.y2 + 22);

  // planeten
  for (const p of planeten) {
    p.flits = Math.max(0, p.flits - 0.05);
    const s = 1 + 0.12 * p.flits;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s);
    ctx.shadowColor = p.kleur[1]; ctx.shadowBlur = 14 + 22 * p.flits;
    const pg = ctx.createRadialGradient(-10, -12, 4, 0, 0, p.r);
    pg.addColorStop(0, p.kleur[0]); pg.addColorStop(1, p.kleur[1]);
    ctx.fillStyle = pg; cirkel(0, 0, p.r); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0.2, 2.6); ctx.lineTo(0, 0); ctx.fill();
    if (p.ring) {
      ctx.strokeStyle = 'rgba(255,240,210,.9)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r + 14, 9, -0.35, 0, 6.2832); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * p.flits})`; ctx.lineWidth = 3;
    cirkel(0, 0, p.r); ctx.stroke();
    ctx.restore();
  }

  // flippers (raketvinnen)
  for (const f of flippers) {
    const t = tip(f);
    const dx = t.x - f.px, dy = t.y - f.py, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    ctx.fillStyle = f.druk ? '#ffe36b' : '#ff7a3c';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = '#ff7a3c'; ctx.shadowBlur = f.druk ? 16 : 6;
    ctx.beginPath();
    ctx.moveTo(f.px + nx * 11, f.py + ny * 11); ctx.lineTo(t.x + nx * 7, t.y + ny * 7);
    ctx.arc(t.x, t.y, 7, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
    ctx.lineTo(f.px - nx * 11, f.py - ny * 11);
    ctx.arc(f.px, f.py, 11, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; cirkel(f.px, f.py, 4); ctx.fill();
  }

  // bal
  if (bal.actief) {
    ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 12;
    const bg = ctx.createRadialGradient(bal.x - 3, bal.y - 3, 1, bal.x, bal.y, R);
    bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#8fa6c8');
    ctx.fillStyle = bg; cirkel(bal.x, bal.y, R); ctx.fill(); ctx.shadowBlur = 0;
  }

  // +1 popups
  ctx.textAlign = 'center'; ctx.font = 'bold 24px sans-serif';
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += 0.03;
    if (p.t > 1) { popups.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - p.t; ctx.fillStyle = '#fff176'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    ctx.fillText('+1', p.x, p.y - p.t * 30);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ---------- Hoofdlus ----------
let laatste = performance.now();
function lus(nu) {
  const dt = Math.min(0.033, (nu - laatste) / 1000); laatste = nu;
  if (spel.staat === 'speel') {
    if (!bal.actief) {
      spel.wacht -= dt;
      if (spel.wacht <= 0) lanceer();
    } else fysica(dt);
  } else spel.t += dt;
  teken();
  requestAnimationFrame(lus);
}
ui();
requestAnimationFrame(lus);

// Offline spelen
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.__g = { spel, bal, flippers, planeten, bruggen, poort, nieuwSpel, fysica };
})();
