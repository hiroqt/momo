// Builds rigged, vector (shape-layer) Lottie animations of Momo for onboarding.
// Every body part is its own layer with a joint pivot: head, ears, eyes, glasses,
// mouth, cap, torso, upper/lower arms, legs and a two-part tail. Each act moves
// the whole body (primary gesture + follow-through), and every act loops seamlessly.
//
//   node tools/build-momo-lottie.mjs
//
// Output: mobile/assets/animations/momo-rig/<act>.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'mobile/assets/animations/momo-rig');
mkdirSync(outDir, { recursive: true });

const SIZE = 512;
const FPS = 30;
const OP = 120; // 4 s loop
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- palette
const COLORS = {
  fur: '#8B4C2C', furDark: '#6A3720', face: '#F5CBA3', earInner: '#EDB287', blush: '#F28C82',
  eye: '#2A1A12', mouth: '#8E2A33', tongue: '#F07482', teeth: '#FFFFFF', lip: '#6B2B22',
  cap: '#2456E8', capDark: '#1A3FBF', brim: '#1D46D2', brimEdge: '#132F92',
  sweater: '#2A58E6', sweaterDark: '#1E43C4', shirt: '#FFFFFF', collarLine: '#D6DBE8', tie: '#1C3FB8',
  pants: '#2443B0', pantsCuff: '#3563EC', shoe: '#F3E7D4', sole: '#FFFFFF', shoeAccent: '#2456E8',
  glasses: '#1F47D4', white: '#FFFFFF', yellow: '#F5C443',
  page: '#FFF8EC', pageLine: '#DCCDB3', cover: '#F5B942', spine: '#D9962A',
};

const r2 = (n) => Math.round(n * 100) / 100;
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1].map((v) => Math.round(v * 1000) / 1000);
};

// ---------------------------------------------------------------- shape helpers
/** Parses an absolute SVG path (M, L, C, Q, Z) into Lottie bezier shapes. */
function parsePath(d) {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+/gi);
  const subs = [];
  let cur = null;
  let cmd = null;
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/^[MLCQZ]$/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'M') {
      cur = { c: false, v: [{ p: [num(), num()], in: [0, 0], out: [0, 0] }] };
      subs.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      cur.v.push({ p: [num(), num()], in: [0, 0], out: [0, 0] });
    } else if (cmd === 'C' || cmd === 'Q') {
      const last = cur.v[cur.v.length - 1];
      let c1;
      let c2;
      let p;
      if (cmd === 'C') {
        c1 = [num(), num()]; c2 = [num(), num()]; p = [num(), num()];
      } else {
        const q = [num(), num()];
        p = [num(), num()];
        c1 = [last.p[0] + (2 / 3) * (q[0] - last.p[0]), last.p[1] + (2 / 3) * (q[1] - last.p[1])];
        c2 = [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
      }
      last.out = [c1[0] - last.p[0], c1[1] - last.p[1]];
      cur.v.push({ p, in: [c2[0] - p[0], c2[1] - p[1]], out: [0, 0] });
    } else if (cmd === 'Z') {
      cur.c = true;
      const first = cur.v[0];
      const last = cur.v[cur.v.length - 1];
      if (cur.v.length > 1 && Math.hypot(first.p[0] - last.p[0], first.p[1] - last.p[1]) < 0.01) {
        first.in = last.in;
        cur.v.pop();
      }
      cmd = null;
    } else {
      throw new Error(`Bad path near token ${i}: ${d}`);
    }
  }
  return subs;
}

const mirrorX = (x) => SIZE - x;

/** Path shapes; `m` mirrors across the vertical centre line (for right-side parts). */
function P(d, m = false) {
  return parsePath(d).map((sub) => ({
    ty: 'sh', d: 1,
    ks: {
      a: 0,
      k: {
        c: sub.c,
        v: sub.v.map(({ p }) => [r2(m ? mirrorX(p[0]) : p[0]), r2(p[1])]),
        i: sub.v.map(({ in: t }) => [r2(m ? -t[0] : t[0]), r2(t[1])]),
        o: sub.v.map(({ out: t }) => [r2(m ? -t[0] : t[0]), r2(t[1])]),
      },
    },
  }));
}
const E = (cx, cy, w, h) => ({ ty: 'el', d: 1, p: { a: 0, k: [cx, cy] }, s: { a: 0, k: [w, h] } });
const R = (cx, cy, w, h, r) => ({ ty: 'rc', d: 1, p: { a: 0, k: [cx, cy] }, s: { a: 0, k: [w, h] }, r: { a: 0, k: r } });

const groupTransform = (opacity = 100) => ({
  ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] },
  r: { a: 0, k: 0 }, o: { a: 0, k: opacity }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 },
});
/** Filled group. */
const F = (color, shapes, opacity = 100) => ({
  ty: 'gr', it: [...[shapes].flat(), { ty: 'fl', c: { a: 0, k: hex(color) }, o: { a: 0, k: 100 }, r: 1, bm: 0 }, groupTransform(opacity)],
});
/** Stroked group (round caps and joins). */
const S = (color, width, shapes, opacity = 100) => ({
  ty: 'gr', it: [...[shapes].flat(), { ty: 'st', c: { a: 0, k: hex(color) }, o: { a: 0, k: 100 }, w: { a: 0, k: width }, lc: 2, lj: 2, ml: 4, bm: 0 }, groupTransform(opacity)],
});

// ---------------------------------------------------------------- rig geometry
// All shapes are drawn in absolute canvas space; each layer's anchor = position = its joint,
// so the rest pose is the identity and children can be posed by rotating around joints.
const SHOULDER = { L: [194, 292], R: [mirrorX(194), 292] };
const ELBOW = { L: [194, 344], R: [mirrorX(194), 344] };
const UPPER = 52;
const LOWER = 54;

const PIVOTS = {
  root: [256, 484],
  torso: [256, 404],
  head: [256, 266],
  earL: [166, 182], earR: [mirrorX(166), 182],
  eyeL: [218, 177], eyeR: [294, 177],
  happyL: [218, 177], happyR: [294, 177],
  glasses: [256, 176],
  mouthGrin: [256, 222], mouthSmile: [256, 222], mouthO: [256, 222], mouthHmm: [256, 222],
  cap: [256, 146],
  armL_up: SHOULDER.L, armL_lo: ELBOW.L, armR_up: SHOULDER.R, armR_lo: ELBOW.R,
  legL: [234, 404], legR: [mirrorX(234), 404],
  tailBase: [208, 392], tailTip: [128, 374],
  book: [256, 342], bookFlip: [256, 342],
};

// The stage null scales the whole rig to leave headroom for hops and raised arms.
const STAGE = { anchor: [256, 484], position: [256, 498], scale: 94 };

const PARENTS = {
  root: 'stage',
  torso: 'root', head: 'torso',
  earL: 'head', earR: 'head', eyeL: 'head', eyeR: 'head', happyL: 'head', happyR: 'head',
  glasses: 'head', mouthGrin: 'head', mouthSmile: 'head', mouthO: 'head', mouthHmm: 'head', cap: 'head',
  armL_up: 'torso', armL_lo: 'armL_up', armR_up: 'torso', armR_lo: 'armR_up',
  book: 'torso', bookFlip: 'book',
  legL: 'root', legR: 'root', tailBase: 'root', tailTip: 'tailBase',
};

const ear = (m) => [
  F(COLORS.fur, E(m ? mirrorX(136) : 136, 184, 66, 72)),
  F(COLORS.earInner, E(m ? mirrorX(141) : 141, 186, 38, 44)),
];

function arm(side, { finger = false } = {}) {
  const m = side === 'R';
  const x = m ? mirrorX(194) : 194;
  const upper = [
    S(COLORS.sweaterDark, 3, R(x, 318, 44, 70, 22), 80),
    F(COLORS.sweater, R(x, 318, 44, 70, 22)),
    F(COLORS.sweaterDark, P('M 172 334 C 176 348 188 352 194 352 C 204 352 212 348 216 338 L 216 344 C 212 352 204 354 194 354 C 184 354 174 350 172 342 Z', m), 60),
  ];
  const lower = [
    ...(finger ? [F(COLORS.fur, R(x, 422, 13, 30, 6.5))] : []),
    S(COLORS.sweaterDark, 3, R(x, 366, 40, 52, 18), 80),
    F(COLORS.sweater, R(x, 366, 40, 52, 18)),
    F(COLORS.sweaterDark, R(x, 388, 40, 11, 5.5)),
    F(COLORS.fur, E(x, 400, 34, 32)),
    S(COLORS.furDark, 2.5, P('M 184 406 Q 194 411 204 406', m), 70),
    F(COLORS.face, E(m ? mirrorX(188) : 188, 393, 12, 9), 55),
  ];
  return { upper, lower };
}

function leg(side) {
  const m = side === 'R';
  const x = m ? mirrorX(234) : 234;
  return [
    F(COLORS.pants, R(x, 430, 46, 56, 14)),
    F(COLORS.pantsCuff, R(x, 456, 52, 14, 7)),
    F(COLORS.shoe, P('M 204 472 C 204 462 214 459 234 459 C 252 459 263 463 264 473 C 264 481 258 485 248 485 L 214 485 C 206 485 203 479 204 472 Z', m)),
    F(COLORS.sole, R(m ? mirrorX(234) : 234, 482.5, 58, 6, 3)),
    S(COLORS.shoeAccent, 3.5, P('M 226 466 L 242 466', m)),
  ];
}

const TORSO = [
  F(COLORS.sweater, P('M 196 274 C 222 266 290 266 316 274 C 336 282 342 300 342 326 L 344 388 C 344 402 334 410 320 410 L 192 410 C 178 410 168 402 168 388 L 170 326 C 170 300 176 282 196 274 Z')),
  F(COLORS.sweaterDark, P('M 304 272 C 318 278 328 288 334 302 C 340 316 342 330 342 344 L 344 388 C 344 402 334 410 320 410 L 312 410 C 324 398 328 360 326 330 C 324 304 318 286 304 272 Z'), 45),
  F(COLORS.sweaterDark, R(256, 401, 176, 18, 9)),
  F(COLORS.white, P('M 214 270 L 298 270 L 256 336 Z')),
  F(COLORS.sweater, P('M 221 270 L 291 270 L 256 327 Z')),
  F(COLORS.shirt, P('M 229 270 L 283 270 L 256 317 Z')),
  F(COLORS.tie, P('M 250 274 L 262 274 L 260 285 L 252 285 Z')),
  F(COLORS.tie, P('M 252 285 L 260 285 L 265 305 L 256 315 L 247 305 Z')),
  F(COLORS.white, P('M 228 268 L 252 271 L 239 289 Z')),
  F(COLORS.white, P('M 228 268 L 252 271 L 239 289 Z', true)),
  S(COLORS.collarLine, 2, [...P('M 228 268 L 252 271 L 239 289 Z'), ...P('M 228 268 L 252 271 L 239 289 Z', true)]),
];

const HEAD = [
  F(COLORS.fur, E(256, 170, 232, 206)),
  F(COLORS.furDark, P('M 146 196 C 156 248 206 274 256 274 C 306 274 356 248 366 196 C 352 238 302 262 256 262 C 210 262 160 238 146 196 Z'), 40),
  F(COLORS.face, [E(214, 172, 104, 96), E(298, 172, 104, 96), E(256, 222, 156, 94)]),
  F(COLORS.blush, [E(184, 222, 28, 15), E(328, 222, 28, 15)], 50),
  F(COLORS.furDark, E(256, 205, 18, 11)),
];

const GLASSES = [
  F(COLORS.white, [R(214, 176, 78, 64, 24), R(298, 176, 78, 64, 24)], 18),
  S(COLORS.glasses, 8, [R(214, 176, 78, 64, 24), R(298, 176, 78, 64, 24)]),
  S(COLORS.glasses, 7, [...P('M 252 170 Q 256 163 260 170'), ...P('M 175 170 L 158 164'), ...P('M 175 170 L 158 164', true)]),
  S(COLORS.white, 4, [...P('M 189 162 Q 192 154 200 151'), ...P('M 273 162 Q 276 154 284 151')], 65),
];

const CAP = [
  F(COLORS.cap, P('M 146 146 C 146 72 196 40 256 40 C 316 40 366 72 366 146 C 330 132 182 132 146 146 Z')),
  F(COLORS.capDark, P('M 300 47 C 340 62 366 96 366 146 C 352 141 338 138 322 136 C 326 104 318 70 300 47 Z'), 40),
  S(COLORS.white, 9, P('M 178 106 C 182 84 196 66 216 56'), 22),
  F(COLORS.capDark, E(256, 43, 22, 11)),
  S(COLORS.white, 6.5, [
    ...P('M 205 99 L 205 77 L 216 91 L 227 77 L 227 99'),
    E(243, 88, 17, 22),
    ...P('M 259 99 L 259 77 L 270 91 L 281 77 L 281 99'),
    E(297, 88, 17, 22),
  ]),
  S(COLORS.yellow, 5.5, P('M 222 111 Q 256 125 290 111')),
  S(COLORS.yellow, 4, [...P('M 207 108 L 213 113'), ...P('M 305 108 L 299 113')]),
  F(COLORS.brim, P('M 166 142 C 214 128 326 122 394 130 C 404 138 398 152 382 156 C 318 150 220 154 178 160 C 162 160 158 148 166 142 Z')),
  S(COLORS.brimEdge, 4, P('M 180 157 C 222 151 318 147 382 154'), 70),
];

const EYE = (x) => [F(COLORS.eye, E(x, 177, 21, 27)), F(COLORS.white, E(x + 4, 170, 8, 8)), F(COLORS.white, E(x - 3, 185, 3.5, 3.5), 80)];
const HAPPY_EYE = (x) => [S(COLORS.eye, 6.5, P(`M ${x - 14} 183 Q ${x} 165 ${x + 14} 183`))];

const MOUTH_GRIN = [
  F(COLORS.mouth, P('M 222 219 Q 256 228 290 219 Q 288 258 256 260 Q 224 258 222 219 Z')),
  F(COLORS.tongue, P('M 236 250 Q 256 236 276 250 Q 268 259 256 259 Q 244 259 236 250 Z')),
  F(COLORS.teeth, P('M 227 220 Q 256 228 285 220 L 284 228 Q 256 235 228 228 Z')),
];
const MOUTH_SMILE = [S(COLORS.lip, 6, P('M 232 226 Q 256 246 280 226'))];
const MOUTH_O = [F(COLORS.mouth, E(256, 236, 18, 21)), F(COLORS.tongue, E(256, 242, 10, 6))];
const MOUTH_HMM = [S(COLORS.lip, 6, P('M 242 236 Q 254 230 270 234'))];

const TAIL_BASE = [S(COLORS.fur, 17, P('M 208 392 C 180 402 146 398 128 374'))];
const TAIL_TIP = [S(COLORS.fur, 17, P('M 128 374 C 110 352 112 320 138 313 C 160 308 172 330 154 342'))];

const PAGE_R = 'M 256 320 C 274 312 298 312 314 318 L 314 362 C 298 356 274 356 256 364 Z';
const PAGE_LINES_R = ['M 266 332 C 280 327 294 327 304 330', 'M 266 342 C 280 337 294 337 304 340', 'M 266 352 C 280 347 294 347 304 350'];
const page = (m) => [F(COLORS.page, P(PAGE_R, m)), S(COLORS.pageLine, 3, PAGE_LINES_R.flatMap((d) => P(d, m)))];
const BOOK = [
  F(COLORS.cover, P('M 256 316 C 236 307 208 307 190 314 L 190 370 C 208 364 236 364 256 372 C 276 364 304 364 322 370 L 322 314 C 304 307 276 307 256 316 Z')),
  ...page(true),
  ...page(false),
  S(COLORS.spine, 3, P('M 256 320 L 256 364')),
];
const BOOK_FLIP = page(false);

function partShapes(name, act) {
  switch (name) {
    case 'torso': return TORSO;
    case 'head': return HEAD;
    case 'earL': return ear(false);
    case 'earR': return ear(true);
    case 'eyeL': return EYE(218);
    case 'eyeR': return EYE(294);
    case 'happyL': return HAPPY_EYE(218);
    case 'happyR': return HAPPY_EYE(294);
    case 'glasses': return GLASSES;
    case 'mouthGrin': return MOUTH_GRIN;
    case 'mouthSmile': return MOUTH_SMILE;
    case 'mouthO': return MOUTH_O;
    case 'mouthHmm': return MOUTH_HMM;
    case 'cap': return CAP;
    case 'armL_up': return arm('L').upper;
    case 'armL_lo': return arm('L', { finger: act.finger === 'L' }).lower;
    case 'armR_up': return arm('R').upper;
    case 'armR_lo': return arm('R', { finger: act.finger === 'R' }).lower;
    case 'legL': return leg('L');
    case 'legR': return leg('R');
    case 'tailBase': return TAIL_BASE;
    case 'tailTip': return TAIL_TIP;
    case 'book': return BOOK;
    case 'bookFlip': return BOOK_FLIP;
    default: return null; // null layer
  }
}

// Front-to-back draw order. Arms sit in front so raised hands read over the head and ears.
const BASE_Z = [
  'armL_lo', 'armL_up', 'armR_lo', 'armR_up',
  'cap', 'glasses', 'happyL', 'happyR', 'eyeL', 'eyeR', 'mouthGrin', 'mouthSmile', 'mouthO', 'mouthHmm', 'head',
  'earL', 'earR', 'bookFlip', 'book', 'torso',
  'legL', 'legR', 'tailTip', 'tailBase',
];

// ---------------------------------------------------------------- motion math
const sin = (t, period, phase = 0) => Math.sin((TAU * (t - phase)) / period);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
/** 0 → 1 between a..b, holds, 1 → 0 between c..d. */
const env = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));
const pos = (x) => Math.max(0, x);
const mix = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k);
const wrap = (t) => ((t % OP) + OP) % OP;
const between = (t, a, b) => t >= a && t < b;
/** Triangle blink: 0 → 1 at b+4 → 0 at b+8. */
const blinkAt = (t, frames) => Math.max(0, ...frames.map((b) => clamp01(1 - Math.abs(t - b - 4) / 4)));
const norm = (deg) => { let d = ((deg + 180) % 360 + 360) % 360 - 180; if (d === -180) d = 180; return d; };
const deg = (rad) => (rad * 180) / Math.PI;

/** Rotate `pt` around `pivot` by `rot` degrees (clockwise, y-down), then offset. */
function xform(pt, pivot, rot = 0, offset = [0, 0], scale = [1, 1]) {
  const a = (rot * Math.PI) / 180;
  const x = (pt[0] - pivot[0]) * scale[0];
  const y = (pt[1] - pivot[1]) * scale[1];
  return [pivot[0] + offset[0] + x * Math.cos(a) - y * Math.sin(a), pivot[1] + offset[1] + x * Math.sin(a) + y * Math.cos(a)];
}

/** Two-bone IK in torso space. Returns [upperRot, lowerRot] relative to the hanging rest pose. */
function ik(side, target, { out = true } = {}) {
  const s = SHOULDER[side];
  const dx = target[0] - s[0];
  const dy = target[1] - s[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(UPPER - LOWER) + 1), UPPER + LOWER - 0.01);
  const base = Math.atan2(dy, dx);
  const alpha = Math.acos((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d));
  const solutions = [base + alpha, base - alpha].map((phi) => {
    const elbow = [s[0] + UPPER * Math.cos(phi), s[1] + UPPER * Math.sin(phi)];
    const tx = s[0] + d * Math.cos(base);
    const ty = s[1] + d * Math.sin(base);
    const psi = Math.atan2(ty - elbow[1], tx - elbow[0]);
    return { elbow, up: norm(deg(phi) - 90), lo: norm(deg(psi - phi)) };
  });
  solutions.sort((a, b) => Math.abs(b.elbow[0] - 256) - Math.abs(a.elbow[0] - 256));
  const pick = out ? solutions[0] : solutions[1];
  return [pick.up, pick.lo];
}

const REST = { L: [12, -8], R: [-12, 8] };
const restArm = (side, t) => {
  const k = side === 'L' ? 1 : -1;
  return [REST[side][0] + k * 2 * sin(t, 60), REST[side][1] + k * 2 * sin(t, 60, 6)];
};

// ---------------------------------------------------------------- acts
// Each act returns per-part functions of t (0..OP). Missing parts use gentle defaults.
// Track keys: `<part>.r` (deg), `<part>.p` ([dx, dy] offset), `<part>.s` ([sx, sy] %), `<part>.o` (%).
function defaults() {
  return {
    'tailBase.r': (t) => 6 * sin(t, 60),
    'tailTip.r': (t) => 10 * sin(t, 60, 8),
    'earL.r': (t) => 3 * sin(t, 40),
    'earR.r': (t) => -3 * sin(t, 40, 6),
    'torso.s': (t) => { const b = (sin(t, 60) + 1) / 2; return [100 + 1.2 * b, 100 + 2 * b]; },
    'head.r': (t) => 1.5 * sin(t, 60, 10),
    'armL': (t) => restArm('L', t),
    'armR': (t) => restArm('R', t),
  };
}

const ACTS = {
  wave(d) {
    const W = (t) => env(t, 2, 10, 56, 66) + env(t, 76, 84, 108, 118);
    const pose = ik('R', [408, 214]);
    return {
      blinks: [34, 100],
      expr: (t) => ({ eyes: between(t, 62, 80) ? 'happy' : 'open', mouth: 'grin' }),
      look: (t) => [1.5 * sin(t, 60), 0],
      tracks: {
        armR: (t) => [pose[0] + 5 * sin(t, 15, 3) * W(t), pose[1] + 24 * sin(t, 15) * W(t)],
        armL: d.armL,
        'head.r': (t) => 5 + 2 * sin(t, 60),
        'torso.r': (t) => 2 * sin(t, 60, 15),
        'torso.p': (t) => [0, -1.5 * ((1 - Math.cos((TAU * t) / 15)) / 2) * W(t)],
        'tailBase.r': (t) => 8 * sin(t, 30),
        'tailTip.r': (t) => 12 * sin(t, 30, 5),
      },
    };
  },

  tipCap() {
    const nod = (t) => env(t, 32, 42, 56, 66);
    const headR = (t) => -5 * nod(t) + 1.5 * sin(t, 60, 10);
    const headP = (t) => [0, 6 * nod(t)];
    const tip = (t) => env(t, 30, 40, 58, 68);
    const capR = (t) => -16 * tip(t);
    const capP = (t) => [10 * tip(t), -16 * tip(t)];
    const brim = (t) => xform(xform([362, 152], PIVOTS.cap, capR(t), capP(t)), PIVOTS.head, headR(t), headP(t));
    const reach = (t) => env(t, 12, 28, 66, 84);
    return {
      blinks: [96],
      expr: (t) => ({ eyes: between(t, 34, 64) ? 'happy' : 'open', mouth: between(t, 28, 74) ? 'grin' : 'smile' }),
      look: () => [0, 0],
      tracks: {
        armR: (t) => mix(restArm('R', t), ik('R', brim(t)), reach(t)),
        'head.r': headR,
        'head.p': headP,
        'cap.r': capR,
        'cap.p': capP,
        'torso.s': (t) => { const b = (sin(t, 60) + 1) / 2; return [100 + 1.2 * b, 100 + 2 * b - 2.5 * nod(t)]; },
        'torso.r': (t) => -1.5 * nod(t),
      },
    };
  },

  listen() {
    const nods = (t) => clamp01(1 - Math.abs(t - 66) / 6) + clamp01(1 - Math.abs(t - 80) / 6);
    const headR = (t) => -9 + 2.5 * sin(t, 40);
    const headP = (t) => [0, 5 * smooth(nods(t))];
    const earPoint = (t) => xform([160, 216], PIVOTS.head, headR(t), headP(t));
    return {
      blinks: [24, 100],
      expr: (t) => ({ eyes: between(t, 62, 84) ? 'happy' : 'open', mouth: between(t, 56, 112) ? 'smile' : 'o' }),
      look: (t) => [-6 + 1.5 * sin(t, 40), -2],
      tracks: {
        armL: (t) => ik('L', earPoint(t)),
        'head.r': headR,
        'head.p': headP,
        'earL.r': (t) => 12 * sin(t, 8) * env(t, 12, 16, 30, 34) + 7 * sin(t, 8) * env(t, 90, 94, 102, 106),
        'torso.r': (t) => -3 + 1.2 * sin(t, 60),
        'tailBase.r': (t) => 9 * sin(t, 24),
        'tailTip.r': (t) => 14 * sin(t, 24, 4),
      },
    };
  },

  point(d) {
    const T = (t) => env(t, 6, 14, 50, 58) + env(t, 70, 78, 104, 112);
    const pose = ik('R', [430, 420]);
    return {
      finger: 'R',
      blinks: [30, 92],
      expr: (t) => ({ eyes: between(t, 58, 72) ? 'happy' : 'open', mouth: 'grin' }),
      look: () => [5, 5],
      tracks: {
        armR: (t) => [pose[0] + 4 * sin(t, 20) * T(t), pose[1] + 7 * sin(t, 20, 3) * T(t)],
        armL: d.armL,
        'torso.r': (t) => 5 + 1.5 * sin(t, 60),
        'torso.p': (t) => [0, -1.5 * ((1 - Math.cos((TAU * t) / 20)) / 2) * T(t)],
        'head.r': (t) => 7 + 2 * sin(t, 40),
      },
    };
  },

  think() {
    const aha = (t) => env(t, 58, 64, 100, 112);
    const headR = (t) => mix(-6 + 2 * sin(t, 30), 3, aha(t));
    const hopU = (t) => (between(t, 60, 74) ? Math.sin((Math.PI * (t - 60)) / 14) : 0);
    const land = (t) => (between(t, 74, 82) ? Math.sin((Math.PI * (t - 74)) / 8) : 0);
    const chin = (t) => xform([280, 262], PIVOTS.head, headR(t));
    const tap = (t) => 5 * sin(t, 10) * env(t, 6, 12, 48, 56);
    const raise = (t) => env(t, 60, 68, 94, 108);
    return {
      blinks: [22, 112],
      expr: (t) => ({
        eyes: between(t, 76, 98) ? 'happy' : 'open',
        mouth: between(t, 60, 108) ? 'grin' : 'hmm',
      }),
      look: (t) => mix([5, -7], [0, 0], ramp(t, 58, 64) * (1 - ramp(t, 104, 112))),
      eyeScale: (t) => 1 + 0.15 * env(t, 58, 62, 70, 76),
      tracks: {
        armR: (t) => {
          const [u, l] = mix(ik('R', chin(t)), ik('R', [366, 196]), raise(t));
          return [u, l + tap(t)];
        },
        armL: (t) => {
          const [u, l] = mix(ik('L', [296, 352]), ik('L', [146, 214]), raise(t));
          return [u + 2 * sin(t, 30), l + 3 * sin(t, 30, 6)];
        },
        'head.r': headR,
        'root.p': (t) => [0, -16 * hopU(t)],
        'root.s': (t) => [100 + 6 * land(t), 100 - 6 * land(t)],
        'cap.p': (t) => [0, 3 * land(t) - 2 * hopU(t)],
      },
    };
  },

  presentBook(d) {
    const present = (t) => env(t, 4, 20, 104, 118);
    const bookS = (t) => 100 + 6 * present(t);
    const bookP = (t) => [0, -8 * present(t)];
    const hand = (pt, t) => xform(pt, PIVOTS.book, 0, bookP(t), [bookS(t) / 100, bookS(t) / 100]);
    const flip = (t) => {
      if (t < 44) return 100;
      if (t < 58) return 100 * Math.cos(Math.PI * ramp(t, 44, 58));
      if (t < 72) return -100;
      return 100; // reset while hidden (identical to the static right page)
    };
    const excited = (t) => (between(t, 62, 74) ? Math.sin((Math.PI * (t - 62)) / 12) : 0);
    return {
      book: true,
      blinks: [100],
      expr: (t) => ({
        eyes: between(t, 62, 86) ? 'happy' : 'open',
        mouth: between(t, 44, 60) ? 'o' : between(t, 60, 102) ? 'grin' : 'smile',
      }),
      look: (t) => mix([0, 0], [0, 6], env(t, 18, 26, 56, 62)),
      tracks: {
        armL: (t) => ik('L', hand([200, 346], t)),
        armR: (t) => ik('R', hand([312, 346], t)),
        'book.s': (t) => [bookS(t), bookS(t)],
        'book.p': bookP,
        'bookFlip.s': (t) => [flip(t), 100],
        'bookFlip.o': (t) => (t >= 71 && t <= 73 ? 0 : 100),
        'head.r': (t) => -3 * env(t, 18, 26, 56, 62) + 2 * sin(t, 60),
        'head.p': (t) => [0, 3 * env(t, 18, 26, 56, 62)],
        'root.p': (t) => [0, -10 * excited(t)],
        'tailBase.r': (t) => d['tailBase.r'](t) + 10 * excited(t),
      },
    };
  },

  march() {
    const step = (t) => sin(t, 30);
    return {
      blinks: [30, 100],
      expr: (t) => ({ eyes: between(t, 60, 76) ? 'happy' : 'open', mouth: 'grin' }),
      look: () => [0, 0],
      tracks: {
        'legL.p': (t) => [0, -14 * pos(step(t))],
        'legR.p': (t) => [0, -14 * pos(-step(t))],
        'legL.r': (t) => 4 * pos(step(t)),
        'legR.r': (t) => -4 * pos(-step(t)),
        'torso.p': (t) => [0, -2.5 * Math.abs(step(t))],
        'torso.r': (t) => 2.5 * step(t),
        'head.r': (t) => -3 * sin(t, 30, 4),
        'head.p': (t) => [0, -1 * Math.abs(step(t))],
        armL: (t) => [14 + 20 * step(t), -18 - 8 * sin(t, 30, 4)],
        armR: (t) => [-14 + 20 * step(t), 18 - 8 * sin(t, 30, 4)],
        'earL.r': (t) => 4 * sin(t, 15),
        'earR.r': (t) => -4 * sin(t, 15),
        'tailBase.r': (t) => 10 * sin(t, 30),
        'tailTip.r': (t) => 14 * sin(t, 30, 5),
      },
    };
  },

  proud() {
    const puff = (t) => env(t, 4, 18, 96, 112);
    const tap = (t) => pos(sin(t, 10)) * env(t, 84, 86, 106, 108);
    return {
      blinks: [104],
      winkR: (t) => env(t, 72, 75, 84, 88),
      expr: (t) => ({ eyes: between(t, 10, 60) ? 'happy' : 'open', mouth: 'grin' }),
      look: () => [0, -1],
      tracks: {
        // Hands stay on the hips; elbows flare with the chest puff and breathing.
        armL: (t) => ik('L', [200 - 4 * puff(t), 376 - 2 * sin(t, 60)]),
        armR: (t) => ik('R', [312 + 4 * puff(t), 376 - 2 * sin(t, 60)]),
        'legL.r': (t) => 2 * sin(t, 60),
        'torso.s': (t) => { const b = (sin(t, 60) + 1) / 2; return [100 + 3 * puff(t) + b, 100 + 3.5 * puff(t) + 1.5 * b]; },
        'head.r': (t) => -4 * puff(t) + 1.5 * sin(t, 60),
        'head.p': (t) => [0, -3 * puff(t)],
        'legR.p': (t) => [0, -6 * tap(t)],
        'legR.r': (t) => -3 * tap(t),
        'tailBase.r': (t) => 12 * sin(t, 20),
        'tailTip.r': (t) => 16 * sin(t, 20, 4),
      },
    };
  },

  cheer() {
    const u = (t) => t % 40;
    const hop = (t) => (u(t) >= 4 && u(t) < 28 ? Math.sin((Math.PI * (u(t) - 4)) / 24) : 0);
    const land = (t) => (u(t) >= 28 && u(t) < 38 ? Math.sin((Math.PI * (u(t) - 28)) / 10) : 0);
    const stretch = (t) => (u(t) >= 4 && u(t) < 14 ? Math.sin((Math.PI * (u(t) - 4)) / 10) : 0);
    const L = ik('L', [124, 198]);
    const Rr = ik('R', [388, 198]);
    return {
      blinks: [],
      expr: () => ({ eyes: 'happy', mouth: 'grin' }),
      look: () => [0, 0],
      mouthScale: (t) => 100 + 12 * pos(sin(t, 20)),
      tracks: {
        armL: (t) => [L[0] + 6 * sin(t, 20, 3), L[1] + 16 * sin(t, 20)],
        armR: (t) => [Rr[0] - 6 * sin(t, 20, 3), Rr[1] - 16 * sin(t, 20)],
        'root.p': (t) => [0, -28 * hop(t)],
        'root.s': (t) => [100 + 7 * land(t) - 4 * stretch(t), 100 - 7 * land(t) + 5 * stretch(t)],
        'legL.r': (t) => 6 * hop(t),
        'legR.r': (t) => -6 * hop(t),
        'earL.r': (t) => 10 * sin(t, 20, 2),
        'earR.r': (t) => -10 * sin(t, 20, 2),
        'cap.p': (t) => [0, 4 * land(t) - 3 * stretch(t)],
        'head.r': (t) => 3 * sin(t, 40),
        'tailBase.r': (t) => 14 * sin(t, 20),
        'tailTip.r': (t) => 18 * sin(t, 20, 4),
      },
    };
  },
};

// ---------------------------------------------------------------- lottie output
function compress(samples, tol) {
  const n = samples.length;
  const keep = [0];
  let i = 0;
  const fits = (a, b) => {
    for (let m = a + 1; m < b; m += 1) {
      const k = (m - a) / (b - a);
      for (let dim = 0; dim < samples[a].length; dim += 1) {
        const v = samples[a][dim] + (samples[b][dim] - samples[a][dim]) * k;
        if (Math.abs(v - samples[m][dim]) > tol) return false;
      }
    }
    return true;
  };
  while (i < n - 1) {
    let j = i + 1;
    while (j + 1 <= n - 1 && fits(i, j + 1)) j += 1;
    keep.push(j);
    i = j;
  }
  return keep;
}

function animatedProp(fn, kind, pivot) {
  const map = {
    r: (v) => [r2(v)],
    o: (v) => [r2(v)],
    p: (v) => [r2(pivot[0] + v[0]), r2(pivot[1] + v[1]), 0],
    s: (v) => [r2(v[0]), r2(v[1]), 100],
  }[kind];
  const samples = [];
  for (let t = 0; t <= OP; t += 1) samples.push(map(fn(t)));
  const constant = samples.every((s) => s.every((v, i) => Math.abs(v - samples[0][i]) < 1e-6));
  if (constant) return { a: 0, k: kind === 'r' || kind === 'o' ? samples[0][0] : samples[0] };
  const tol = kind === 'o' ? 0.5 : 0.12;
  const idx = compress(samples, tol);
  const ease = (v) => (kind === 'p' ? v : kind === 's' ? [v, v, v] : [v]);
  return {
    a: 1,
    k: idx.map((t, n) => {
      const kf = { t, s: samples[t] };
      if (n < idx.length - 1) {
        kf.o = { x: ease(0), y: ease(0) };
        kf.i = { x: ease(1), y: ease(1) };
        if (kind === 'p') { kf.to = [0, 0, 0]; kf.ti = [0, 0, 0]; }
      }
      return kf;
    }),
  };
}

function build(name, actFn) {
  const d = defaults();
  const act = actFn(d);
  const tracks = { ...d, ...act.tracks };

  // Expressions, blinks and gaze drive the face layers.
  const expr = act.expr;
  const blink = (t) => blinkAt(t, act.blinks ?? []);
  const eyeScale = act.eyeScale ?? (() => 1);
  const look = act.look ?? (() => [0, 0]);
  const eyeS = (wink) => (t) => {
    const w = eyeScale(t);
    const closed = Math.max(blink(t), wink ? wink(t) : 0);
    return [100 * w, 100 * w * (1 - 0.9 * closed)];
  };
  tracks['eyeL.s'] = eyeS(null);
  tracks['eyeR.s'] = eyeS(act.winkR);
  for (const part of ['eyeL', 'eyeR', 'happyL', 'happyR']) tracks[`${part}.p`] = look;
  tracks['eyeL.o'] = (t) => (expr(t).eyes === 'open' ? 100 : 0);
  tracks['eyeR.o'] = tracks['eyeL.o'];
  tracks['happyL.o'] = (t) => (expr(t).eyes === 'happy' ? 100 : 0);
  tracks['happyR.o'] = tracks['happyL.o'];
  for (const [layer, key] of [['mouthGrin', 'grin'], ['mouthSmile', 'smile'], ['mouthO', 'o'], ['mouthHmm', 'hmm']]) {
    tracks[`${layer}.o`] = (t) => (expr(t).mouth === key ? 100 : 0);
  }
  if (act.mouthScale) tracks['mouthGrin.s'] = (t) => [100, act.mouthScale(t)];

  // Arms are posed as [upper, lower] pairs.
  for (const side of ['L', 'R']) {
    const f = tracks[`arm${side}`];
    tracks[`arm${side}_up.r`] = (t) => f(t)[0];
    tracks[`arm${side}_lo.r`] = (t) => f(t)[1];
  }

  // The cap lags slightly behind head turns for follow-through.
  const headR = tracks['head.r'];
  const capR = tracks['cap.r'] ?? (() => 0);
  tracks['cap.r'] = (t) => capR(t) + 0.6 * (headR(wrap(t - 5)) - headR(t));

  let z = BASE_Z.filter((n) => (act.book ? true : n !== 'book' && n !== 'bookFlip'));
  if (act.z) z = act.z(z);

  const names = ['stage', 'root', ...z];
  const index = Object.fromEntries(names.map((n, i) => [n, i + 1]));
  const layerFor = (n) => {
    if (n === 'stage') {
      return {
        ddd: 0, ind: index.stage, ty: 3, nm: 'stage', sr: 1, ao: 0, ip: 0, op: OP, st: 0, bm: 0,
        ks: {
          o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
          p: { a: 0, k: [...STAGE.position, 0] }, a: { a: 0, k: [...STAGE.anchor, 0] },
          s: { a: 0, k: [STAGE.scale, STAGE.scale, 100] },
        },
      };
    }
    const pivot = PIVOTS[n];
    const shapes = n === 'root' ? null : partShapes(n, act);
    const ks = {
      o: tracks[`${n}.o`] ? animatedProp(tracks[`${n}.o`], 'o', pivot) : { a: 0, k: 100 },
      r: tracks[`${n}.r`] ? animatedProp(tracks[`${n}.r`], 'r', pivot) : { a: 0, k: 0 },
      p: tracks[`${n}.p`] ? animatedProp(tracks[`${n}.p`], 'p', pivot) : { a: 0, k: [pivot[0], pivot[1], 0] },
      a: { a: 0, k: [pivot[0], pivot[1], 0] },
      s: tracks[`${n}.s`] ? animatedProp(tracks[`${n}.s`], 's', pivot) : { a: 0, k: [100, 100, 100] },
    };
    const layer = {
      ddd: 0, ind: index[n], ty: shapes ? 4 : 3, nm: n, sr: 1, ks, ao: 0,
      ip: 0, op: OP, st: 0, bm: 0,
    };
    if (PARENTS[n]) layer.parent = index[PARENTS[n]];
    if (shapes) layer.shapes = [...shapes].reverse();
    return layer;
  };
  // Lottie draws the first layer on top: z is front-to-back, the root null goes last.
  const layers = [...z.map(layerFor), layerFor('root'), layerFor('stage')];

  const json = {
    v: '5.7.4', fr: FPS, ip: 0, op: OP, w: SIZE, h: SIZE, nm: `Momo ${name}`, ddd: 0,
    assets: [], layers, markers: [],
  };
  const file = resolve(outDir, `${name}.json`);
  writeFileSync(file, JSON.stringify(json));
  return { file, layers: layers.length, bytes: JSON.stringify(json).length };
}

const NAMES = {
  wave: 'wave', tipCap: 'tip-cap', listen: 'listen', point: 'point', think: 'think',
  presentBook: 'present-book', march: 'march', proud: 'proud', cheer: 'cheer',
};
for (const [key, file] of Object.entries(NAMES)) {
  const { layers, bytes } = build(file, ACTS[key]);
  console.log(`${file.padEnd(13)} ${layers} layers  ${(bytes / 1024).toFixed(1)} KB`);
}
