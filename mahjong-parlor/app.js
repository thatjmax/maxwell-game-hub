/* Mahjong Parlor — offline, ad-free mahjong solitaire.
   Security model: no network requests, no third-party code, no eval/innerHTML of
   user text. All data lives in this device's localStorage. */
'use strict';
(function () {
  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffle(a, rng) {
    rng = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function clampInt(v, min, max, def) {
    v = Math.floor(Number(v));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  }
  function cleanStr(v, max) {
    return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
  }

  // ---------- Tiles ----------
  const SUITS = {
    dot: { name: 'Circles', color: '#1d3f94' },
    bam: { name: 'Bamboo', color: '#17692f' },
    crk: { name: 'Characters', color: '#b0141e' },
  };
  const WIND = { wE: ['E', 'East'], wS: ['S', 'South'], wW: ['W', 'West'], wN: ['N', 'North'] };
  const FACE_IDS = [];
  ['dot', 'bam', 'crk'].forEach((s) => { for (let n = 1; n <= 9; n++) FACE_IDS.push(s + n); });
  ['wE', 'wS', 'wW', 'wN', 'dR', 'dG', 'dW'].forEach((f) => FACE_IDS.push(f));
  const FACE_SET = new Set(FACE_IDS);

  function faceLabel(f) {
    if (f[0] === 'w') return WIND[f][1] + ' Wind';
    if (f === 'dR') return 'Red Dragon';
    if (f === 'dG') return 'Green Dragon';
    if (f === 'dW') return 'White Dragon';
    return f.slice(3) + ' of ' + SUITS[f.slice(0, 3)].name;
  }
  function label(y, text, color) {
    return '<text x="38" y="' + y + '" text-anchor="middle" font-size="15" font-weight="800" font-family="Arial, sans-serif" fill="' + color + '">' + text + '</text>';
  }
  function suitIcon(s, c) {
    if (s === 'dot') return '<circle cx="38" cy="80" r="11" fill="none" stroke="' + c + '" stroke-width="4.5"/><circle cx="38" cy="80" r="4" fill="' + c + '"/>';
    if (s === 'bam') return '<rect x="32" y="66" width="12" height="29" rx="6" fill="' + c + '"/><rect x="32" y="75" width="12" height="2.5" fill="#fffdf5"/><rect x="32" y="85" width="12" height="2.5" fill="#fffdf5"/>';
    return '<text x="38" y="94" text-anchor="middle" font-size="25" font-weight="700" fill="' + c + '">萬</text>';
  }
  const faceCache = {};
  function faceSVG(f) {
    if (faceCache[f]) return faceCache[f];
    let inner;
    const s = f.slice(0, 3);
    if (SUITS[s]) {
      const c = SUITS[s].color;
      inner = '<text x="38" y="58" text-anchor="middle" font-size="60" font-weight="800" font-family="Georgia, \'Times New Roman\', serif" fill="' + c + '">' + f.slice(3) + '</text>' + suitIcon(s, c);
    } else if (f[0] === 'w') {
      inner = '<text x="38" y="62" text-anchor="middle" font-size="62" font-weight="800" font-family="Georgia, serif" fill="#1a1a1a">' + WIND[f][0] + '</text>' + label(90, WIND[f][1].toUpperCase(), '#1a1a1a');
    } else if (f === 'dR') {
      inner = '<text x="38" y="64" text-anchor="middle" font-size="54" font-weight="700" fill="#b0141e">中</text>' + label(90, 'RED', '#b0141e');
    } else if (f === 'dG') {
      inner = '<text x="38" y="64" text-anchor="middle" font-size="52" font-weight="700" fill="#17692f">發</text>' + label(90, 'GREEN', '#17692f');
    } else {
      inner = '<rect x="17" y="14" width="42" height="56" rx="5" fill="none" stroke="#1d3f94" stroke-width="5"/><rect x="25" y="22" width="26" height="40" rx="3" fill="none" stroke="#1d3f94" stroke-width="3"/>' + label(90, 'WHITE', '#1d3f94');
    }
    return (faceCache[f] = '<svg viewBox="0 0 76 100" aria-hidden="true" focusable="false">' + inner + '</svg>');
  }

  // ---------- Layouts (coordinates in half-tile units) ----------
  function rect(p, x0, y0, cols, rows, z) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) p.push({ x: x0 + c * 2, y: y0 + r * 2, z: z });
  }
  const LAYOUTS = {
    pyramid: { name: 'Little Pyramid', build(p) { rect(p, 0, 0, 6, 4, 0); rect(p, 2, 2, 4, 2, 1); rect(p, 4, 2, 2, 2, 2); } },
    table: { name: 'Tea Table', build(p) { rect(p, 0, 0, 7, 4, 0); rect(p, 1, 1, 6, 3, 1); rect(p, 3, 2, 4, 2, 2); } },
    butterfly: {
      name: 'Butterfly', build(p) {
        rect(p, 0, 0, 3, 5, 0); rect(p, 12, 0, 3, 5, 0); rect(p, 7, 1, 2, 4, 0);
        rect(p, 1, 1, 2, 4, 1); rect(p, 13, 1, 2, 4, 1); rect(p, 8, 3, 1, 2, 1);
      },
    },
    garden: { name: 'Garden', build(p) { rect(p, 0, 0, 8, 5, 0); rect(p, 2, 1, 6, 4, 1); rect(p, 4, 3, 4, 2, 2); } },
    fortress: { name: 'Fortress', build(p) { rect(p, 0, 0, 10, 5, 0); rect(p, 2, 1, 8, 4, 1); rect(p, 6, 3, 4, 2, 2); rect(p, 8, 4, 2, 1, 3); } },
  };
  const BIG_TILE_SWAP = { garden: 'table', fortress: 'butterfly' };

  function isFreeIn(t, list) {
    let L = false, R = false;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === t) continue;
      const dy = Math.abs(o.y - t.y);
      if (o.z > t.z) {
        if (Math.abs(o.x - t.x) < 2 && dy < 2) return false;
      } else if (o.z === t.z && dy < 2) {
        if (o.x === t.x - 2) L = true;
        else if (o.x === t.x + 2) R = true;
      }
    }
    return !(L && R);
  }

  // Assigns faces so the board is guaranteed solvable: we "remove" random free
  // pairs from the full board and give each pair matching faces.
  function dealFaces(tiles, faces, rng) {
    const counts = {};
    faces.forEach((f) => { counts[f] = (counts[f] || 0) + 1; });
    const pairs = [];
    Object.keys(counts).forEach((f) => { for (let i = 0; i < Math.floor(counts[f] / 2); i++) pairs.push(f); });
    if (pairs.length * 2 !== tiles.length) return false;
    for (let attempt = 0; attempt < 300; attempt++) {
      shuffle(pairs, rng);
      let active = tiles.slice();
      const assign = new Map();
      let k = 0, ok = true;
      while (active.length) {
        const free = active.filter((t) => isFreeIn(t, active));
        if (free.length < 2) { ok = false; break; }
        shuffle(free, rng);
        const a = free[0], b = free[1];
        assign.set(a, pairs[k]); assign.set(b, pairs[k]); k++;
        active = active.filter((t) => t !== a && t !== b);
      }
      if (ok) { assign.forEach((f, t) => { t.face = f; }); return true; }
    }
    return false;
  }

  function newBoard(key, rng) {
    const p = [];
    LAYOUTS[key].build(p);
    const N = p.length;
    const types = shuffle(FACE_IDS.slice(), rng).slice(0, Math.ceil(N / 4));
    const faces = [];
    types.forEach((f) => { for (let i = 0; i < 4 && faces.length < N; i += 2) faces.push(f, f); });
    const tiles = p.map((q, i) => ({ id: i, x: q.x, y: q.y, z: q.z, face: faces[i], gone: false }));
    dealFaces(tiles, faces, rng);
    return tiles;
  }

  // ---------- Challengers ----------
  const CHALLENGERS = [
    { name: 'Harold', town: 'Duluth, Minnesota', hello: "Hello there! I'm Harold. I've been practicing all week, so go easy on me.", lose: 'Well played! You got me fair and square.', layout: 'pyramid', av: { bg: '#f3c969', skin: '#f1c7a3', hair: '#d9d9d9', style: 'bald', glasses: true, mustache: true, shirt: '#3b6ea5' } },
    { name: 'Mabel', town: 'Savannah, Georgia', hello: "Why, hello! I'm Mabel. I do love a good game of tiles with a cup of tea.", lose: "Oh my, you're a natural! Lovely game.", layout: 'pyramid', av: { bg: '#f4a7b9', skin: '#e8b48f', hair: '#f0f0f0', style: 'bun', earrings: true, shirt: '#7a4ea3' } },
    { name: 'Walter', town: 'Tulsa, Oklahoma', hello: "Howdy! Walter here. Folks back home say I'm the quickest matcher in the county.", lose: "Shucks! You're quicker than me. Nice work.", layout: 'butterfly', av: { bg: '#9fd3c7', skin: '#c68a5e', hair: '#4a4a4a', style: 'hat', hat: '#8b5a2b', shirt: '#c0392b' } },
    { name: 'Rosa', town: 'Santa Fe, New Mexico', hello: "Hola! I'm Rosa. My grandchildren taught me this game, and now I almost never lose!", lose: '¡Bravo! You beat me fair and square.', layout: 'table', av: { bg: '#ffd29d', skin: '#b97a56', hair: '#cfcfcf', style: 'wavy', glasses: true, earrings: true, shirt: '#1f8a70' } },
    { name: 'Frank', town: 'Pittsburgh, Pennsylvania', hello: "Frank's the name. Thirty years of Sunday games at the community center. Let's see what you've got!", lose: "Now that's how it's done. My hat's off to you.", layout: 'garden', av: { bg: '#b8c6e8', skin: '#f0c4a0', hair: '#9a9a9a', style: 'short', glasses: true, shirt: '#2d4a6b' } },
    { name: 'Dottie', town: 'Boise, Idaho', hello: "Hi, sweetheart! I'm Dottie. I knit, I bake, and I play a mean game of mahjong.", lose: 'Oh, fiddlesticks! You won. Good for you!', layout: 'butterfly', av: { bg: '#c9e4a6', skin: '#f3cfb3', hair: '#e8e2d0', style: 'curly', glasses: true, shirt: '#d35d7a' } },
    { name: 'Leon', town: 'New Orleans, Louisiana', hello: 'Well, hey there! Leon. I play every afternoon on my front porch.', lose: 'Mm-hmm, you sure can play! Great game.', layout: 'garden', av: { bg: '#f2b880', skin: '#7b4b2a', hair: '#e6e6e6', style: 'short', mustache: true, shirt: '#4c7c3c' } },
    { name: 'June', town: 'Portland, Maine', hello: "Good day! I'm June. I'm a retired schoolteacher, so I always check my work.", lose: 'Top marks! You earned an A-plus today.', layout: 'table', av: { bg: '#a7d8f0', skin: '#f6d5bd', hair: '#bfbfbf', style: 'bun', glasses: true, shirt: '#3f6e8c' } },
    { name: 'Arthur', town: 'Milwaukee, Wisconsin', hello: "Hello, hello! Arthur here. I've been playing since before color television!", lose: "Splendid! You've outplayed an old pro.", layout: 'fortress', av: { bg: '#e4c1f9', skin: '#e9b996', hair: '#ffffff', style: 'bald', mustache: true, shirt: '#6b4226' } },
    { name: 'Pearl', town: 'Charleston, South Carolina', hello: "Hello, darling! I'm Pearl. They call me the Queen of Tiles at my card club.", lose: "Well, I'll be! Looks like there's a new queen in town.", layout: 'garden', av: { bg: '#ffe08a', skin: '#9c6644', hair: '#d4d4d4', style: 'curly', earrings: true, shirt: '#2a7f8f' } },
    { name: 'Gus', town: 'Omaha, Nebraska', hello: "Gus here. I don't say much, but I sure do match tiles.", lose: 'Huh. Nice game. Real nice.', layout: 'fortress', av: { bg: '#b5e3b0', skin: '#e0ac83', hair: '#5c5c5c', style: 'hat', hat: '#2e5e8c', glasses: true, shirt: '#8c6d2e' } },
    { name: 'Vivian', town: 'San Diego, California', hello: "Hello! I'm Vivian, the reigning champion. Beat me and you'll be the best of all!", lose: "Magnificent! You're the champion now!", layout: 'fortress', av: { bg: '#ffb3a7', skin: '#f2c9a0', hair: '#c7c7c7', style: 'wavy', glasses: true, earrings: true, shirt: '#5a3e8c' } },
  ];
  const WINS_FOR_TROPHY = 3;
  const NPC_AHEAD = ["I'm on a roll today!", 'Better keep an eye on me!', 'My tiles are falling right into place.', "Don't let me get too far ahead!"];
  const NPC_BEHIND = ["My, you're quick!", "I'd better concentrate...", "You've done this before, haven't you?", "Slow down, you're making me nervous!"];
  const NPC_HALF = ['Halfway there. What a good game!', 'This one is close!', 'Having fun? I sure am.'];

  function avatarSVG(a) {
    const h = a.hair, s = a.skin;
    let back = '', front = '';
    if (a.style === 'wavy') {
      back = '<path d="M28 46 Q26 17 50 17 Q74 17 72 46 L74 68 Q63 72 60 58 L40 58 Q37 72 26 68Z" fill="' + h + '"/>';
      front = '<path d="M31 41 Q35 23 50 23 Q65 23 69 41 Q60 31 50 31 Q40 31 31 41Z" fill="' + h + '"/>';
    } else if (a.style === 'bun') {
      back = '<circle cx="50" cy="16" r="9" fill="' + h + '"/>';
      front = '<path d="M31 42 Q30 21 50 20 Q70 21 69 42 Q65 30 50 29 Q35 30 31 42Z" fill="' + h + '"/>';
    } else if (a.style === 'curly') {
      front = [[33, 34], [38, 26], [46, 21], [54, 21], [62, 26], [67, 34]].map((c) => '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="8" fill="' + h + '"/>').join('');
    } else if (a.style === 'short') {
      front = '<path d="M31 42 Q29 20 50 19 Q71 20 69 42 Q66 29 50 28 Q34 29 31 42Z" fill="' + h + '"/>';
    } else if (a.style === 'bald') {
      front = '<path d="M31 50 Q29 38 33 33 L36 49Z" fill="' + h + '"/><path d="M69 50 Q71 38 67 33 L64 49Z" fill="' + h + '"/>';
    } else if (a.style === 'hat') {
      front = '<path d="M31 50 Q29 40 33 36 L36 49Z" fill="' + h + '"/><path d="M69 50 Q71 40 67 36 L64 49Z" fill="' + h + '"/>' +
        '<path d="M30 35 Q31 15 50 15 Q69 15 70 35Z" fill="' + a.hat + '"/><rect x="23" y="32" width="54" height="7" rx="3.5" fill="' + a.hat + '"/>';
    }
    let extras = '';
    if (a.glasses) extras += '<circle cx="43" cy="45" r="6" fill="none" stroke="#2b2b2b" stroke-width="2"/><circle cx="57" cy="45" r="6" fill="none" stroke="#2b2b2b" stroke-width="2"/><path d="M49 45 L51 45" stroke="#2b2b2b" stroke-width="2"/>';
    if (a.mustache) extras += '<path d="M42 54 Q50 50 58 54 Q50 57 42 54Z" fill="' + h + '"/>';
    if (a.earrings) extras += '<circle cx="31" cy="54" r="2.5" fill="#f2a900"/><circle cx="69" cy="54" r="2.5" fill="#f2a900"/>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<rect width="100" height="100" fill="' + a.bg + '"/>' + back +
      '<path d="M16 100 Q20 72 50 70 Q80 72 84 100Z" fill="' + a.shirt + '"/>' +
      '<rect x="43" y="58" width="14" height="14" rx="4" fill="' + s + '"/>' +
      '<ellipse cx="31" cy="47" rx="3.5" ry="5" fill="' + s + '"/><ellipse cx="69" cy="47" rx="3.5" ry="5" fill="' + s + '"/>' +
      '<ellipse cx="50" cy="45" rx="19" ry="22" fill="' + s + '"/>' + front +
      '<circle cx="43" cy="45" r="2.3" fill="#2b2b2b"/><circle cx="57" cy="45" r="2.3" fill="#2b2b2b"/>' +
      '<circle cx="39" cy="53" r="3.5" fill="#e8706f" opacity=".3"/><circle cx="61" cy="53" r="3.5" fill="#e8706f" opacity=".3"/>' +
      '<path d="M43 57 Q50 62 57 57" stroke="#7a3b2e" stroke-width="2.3" fill="none" stroke-linecap="round"/>' +
      extras + '</svg>';
  }
  const SUN_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#ffe7a0"/><circle cx="50" cy="50" r="20" fill="#f2a900"/>' +
    [0, 45, 90, 135, 180, 225, 270, 315].map((d) => '<rect x="47" y="12" width="6" height="14" rx="3" fill="#f2a900" transform="rotate(' + d + ' 50 50)"/>').join('') + '</svg>';

  // ---------- State ----------
  const STORE_KEY = 'mahjong-parlor-v1';
  function defaults() {
    return {
      v: 1,
      settings: { name: '', sound: true, speak: false, dim: true, bigTiles: false },
      notes: [], noteQueue: [],
      stats: { streak: 0, best: 0, wins: 0, losses: 0, recent: [], ladder: 0, rematch: 0, perCh: CHALLENGERS.map(() => ({ w: 0, l: 0 })), dailyLast: '', dailyDays: 0, log: [] },
      seen: { howto: false, intro: -1, rules: {} },
      games: { ch: null, daily: null },
      g2: {},
    };
  }
  function validGame(g, mode) {
    try {
      if (!g || g.mode !== mode || !LAYOUTS[g.layout] || !Array.isArray(g.tiles) || g.tiles.length > 200 || g.tiles.length % 2) return null;
      const tiles = g.tiles.map((t, i) => {
        if (!t || t.id !== i || !FACE_SET.has(t.face)) throw new Error('bad tile');
        return { id: i, x: clampInt(t.x, 0, 100, 0), y: clampInt(t.y, 0, 100, 0), z: clampInt(t.z, 0, 10, 0), face: t.face, gone: t.gone === true };
      });
      const total = tiles.length / 2;
      const hist = Array.isArray(g.hist) ? g.hist.filter((h) => Array.isArray(h) && h.length === 2 && h.every((n) => Number.isInteger(n) && n >= 0 && n < tiles.length && tiles[n].gone)).slice(-300) : [];
      const her = tiles.filter((t) => t.gone).length / 2;
      if (her >= total) return null;
      return {
        mode: mode, ci: mode === 'ch' ? clampInt(g.ci, 0, CHALLENGERS.length - 1, 0) : 0,
        date: mode === 'daily' ? cleanStr(g.date, 10) : '', layout: g.layout, tiles: tiles, hist: hist, her: her,
        npc: Math.min(total, Math.max(0, Number(g.npc) || 0)), total: total,
        rate: Math.min(0.97, Math.max(0.6, Number(g.rate) || 0.8)),
        hints: clampInt(g.hints, 0, 1e5, 0), undos: clampInt(g.undos, 0, 1e5, 0), shuffles: clampInt(g.shuffles, 0, 1e5, 0),
        result: g.result === 'win' || g.result === 'loss' ? g.result : null,
        lead: g.lead === 'npc' || g.lead === 'her' ? g.lead : '', half: g.half === true,
      };
    } catch (e) { return null; }
  }
  function sanitize(o, keepGames) {
    const d = defaults();
    if (!o || typeof o !== 'object') return d;
    const s = o.settings || {};
    d.settings.name = cleanStr(s.name, 30);
    ['sound', 'speak', 'dim', 'bigTiles'].forEach((k) => { if (typeof s[k] === 'boolean') d.settings[k] = s[k]; });
    if (Array.isArray(o.notes)) {
      d.notes = o.notes.slice(0, 50).map((n) => ({ from: cleanStr(n && n.from, 30), text: cleanStr(n && n.text, 240) })).filter((n) => n.text);
    }
    if (Array.isArray(o.noteQueue)) d.noteQueue = o.noteQueue.filter((i) => Number.isInteger(i) && i >= 0 && i < d.notes.length).slice(0, 50);
    const st = o.stats || {};
    const S = d.stats;
    S.streak = clampInt(st.streak, 0, 1e6, 0); S.best = clampInt(st.best, 0, 1e6, 0);
    S.wins = clampInt(st.wins, 0, 1e7, 0); S.losses = clampInt(st.losses, 0, 1e7, 0);
    if (Array.isArray(st.recent)) S.recent = st.recent.filter((x) => x === 0 || x === 1).slice(-10);
    S.ladder = clampInt(st.ladder, 0, CHALLENGERS.length, 0);
    S.rematch = clampInt(st.rematch, 0, CHALLENGERS.length - 1, 0);
    if (Array.isArray(st.perCh)) S.perCh = CHALLENGERS.map((_, i) => ({ w: clampInt(st.perCh[i] && st.perCh[i].w, 0, 1e6, 0), l: clampInt(st.perCh[i] && st.perCh[i].l, 0, 1e6, 0) }));
    S.dailyLast = /^\d{4}-\d{2}-\d{2}$/.test(st.dailyLast) ? st.dailyLast : '';
    S.dailyDays = clampInt(st.dailyDays, 0, 1e6, 0);
    if (Array.isArray(st.log)) {
      S.log = st.log.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.d)).slice(-60)
        .map((e) => ({ d: e.d, g: clampInt(e.g, 0, 1e5, 0), w: clampInt(e.w, 0, 1e5, 0), p: e.p === true }));
    }
    const se = o.seen || {};
    d.seen.howto = se.howto === true;
    d.seen.intro = clampInt(se.intro, -1, CHALLENGERS.length - 1, -1);
    if (se.rules && typeof se.rules === 'object') Object.keys(se.rules).slice(0, 20).forEach((k) => { if (/^[a-z]{2,12}$/.test(k) && se.rules[k] === true) d.seen.rules[k] = true; });
    if (keepGames && o.g2 && typeof o.g2 === 'object') {
      Object.keys(o.g2).slice(0, 20).forEach((k) => {
        const v = o.g2[k];
        if (!/^[a-z]{2,12}$/.test(k) || !v || typeof v !== 'object') return;
        try { if (JSON.stringify(v).length > 150000) return; } catch (e) { return; }
        d.g2[k] = { ci: clampInt(v.ci, 0, CHALLENGERS.length - 1, 0), level: Math.min(1, Math.max(0, Number(v.level) || 0)), data: v.data };
      });
    }
    if (keepGames && o.games) {
      d.games.ch = validGame(o.games.ch, 'ch');
      d.games.daily = validGame(o.games.daily, 'daily');
    }
    return d;
  }
  function load() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORE_KEY) || 'null'), true); } catch (e) { return defaults(); }
  }
  let state = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }
  function logToday(fn) {
    const k = dayKey();
    let e = state.stats.log.find((x) => x.d === k);
    if (!e) { e = { d: k, g: 0, w: 0, p: false }; state.stats.log.push(e); state.stats.log = state.stats.log.slice(-60); }
    fn(e);
  }

  // ---------- Sound & speech (all generated on-device) ----------
  let actx = null;
  function audio() {
    try {
      if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = new C(); }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tone(freq, start, dur, vol, type) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    const t = a.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    select: () => tone(660, 0, 0.12, 0.06),
    match: () => { tone(784, 0, 0.25, 0.1); tone(1047, 0.09, 0.35, 0.1); },
    blocked: () => tone(220, 0, 0.15, 0.06, 'triangle'),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.45, 0.1)),
    soft: () => { tone(440, 0, 0.3, 0.07); tone(392, 0.18, 0.4, 0.07); },
    shuffle: () => [500, 600, 700].forEach((f, i) => tone(f, i * 0.06, 0.12, 0.05)),
  };
  function sfx(n) { if (state.settings.sound) { try { SFX[n](); } catch (e) { /* ignore */ } } }
  function speak(text) {
    if (!state.settings.speak || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  // ---------- Screens & navigation ----------
  let pushed = false;
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    if (id !== 'home' && !pushed) { history.pushState({ app: 1 }, ''); pushed = true; }
  }
  function goHome() { if (pushed) history.back(); else renderHome(); }
  window.addEventListener('popstate', () => { pushed = false; closeModal(); X = null; save(); renderHome(); });
  document.querySelectorAll('.js-home').forEach((b) => b.addEventListener('click', goHome));

  // ---------- Modal ----------
  let modalOpen = false;
  function showModal(o) {
    const card = $('modalCard');
    card.textContent = '';
    $('tip').classList.add('hidden');
    if (o.portrait) { const p = el('div', 'portrait modalp'); p.innerHTML = o.portrait; card.appendChild(p); }
    if (o.title) card.appendChild(el('h2', null, o.title));
    if (o.quote) card.appendChild(el('p', 'quote', '“' + o.quote + '”'));
    (o.lines || []).forEach((l) => card.appendChild(el('p', null, l)));
    if (o.list) { const ul = el('ul'); o.list.forEach((l) => ul.appendChild(el('li', null, l))); card.appendChild(ul); }
    if (o.note) {
      const n = el('div', 'note');
      n.appendChild(el('strong', null, '💌 A note from ' + (o.note.from || 'your family')));
      n.appendChild(el('span', null, o.note.text));
      card.appendChild(n);
    }
    const bw = el('div', 'modal-btns');
    (o.buttons || [{ label: 'OK', primary: true }]).forEach((b) => {
      const btn = el('button', 'btn' + (b.primary ? ' primary' : ''), b.label);
      btn.addEventListener('click', () => { closeModal(); if (b.onClick) b.onClick(); });
      bw.appendChild(btn);
    });
    card.appendChild(bw);
    $('modal').classList.remove('hidden');
    modalOpen = true;
    if (o.say) speak(o.say);
  }
  function closeModal() { $('modal').classList.add('hidden'); modalOpen = false; }

  // ---------- Home ----------
  function currentCi() { return state.stats.ladder < CHALLENGERS.length ? state.stats.ladder : state.stats.rematch; }
  function greetingText() {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return part + (state.settings.name ? ', ' + state.settings.name : '') + '!';
  }
  function dots(n) { let s = ''; for (let i = 0; i < WINS_FOR_TROPHY; i++) s += i < n ? '●' : '○'; return s; }
  function renderHome() {
    showScreen('home');
    $('greeting').textContent = greetingText();
    $('today').textContent = 'Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const ci = currentCi(), ch = CHALLENGERS[ci], rec = state.stats.perCh[ci];
    $('homePortrait').innerHTML = avatarSVG(ch.av);
    $('homeName').textContent = ch.name;
    $('homeTown').textContent = 'from ' + ch.town;
    const done = state.stats.ladder >= CHALLENGERS.length;
    $('homeEyebrow').textContent = done ? 'Champion rematch' : (state.seen.intro < ci ? 'New challenger!' : 'Your challenger');
    $('homeRecord').textContent = done ? 'Wins against ' + ch.name + ': ' + rec.w : 'Wins toward trophy: ' + dots(Math.min(rec.w, WINS_FOR_TROPHY));
    $('playBtn').textContent = 'Play with ' + ch.name;
    $('streakNum').textContent = state.stats.streak;
    $('bestStreak').textContent = 'Best: ' + state.stats.best;
    const dg = state.games.daily;
    $('dailyBtn').textContent = state.stats.dailyLast === dayKey() ? '☀️ Today’s Puzzle ✓ Done' : (dg && dg.date === dayKey() ? '☀️ Continue Puzzle of the Day' : '☀️ Puzzle of the Day');
    renderSoundBtn();
  }
  function renderSoundBtn() {
    const on = state.settings.sound;
    $('soundBtn').textContent = on ? '🔊 Sound on' : '🔇 Sound off';
    $('soundBtn').setAttribute('aria-pressed', String(on));
  }
  $('soundBtn').addEventListener('click', () => { state.settings.sound = !state.settings.sound; save(); renderSoundBtn(); sfx('select'); });

  function introThen(ci, fn) {
    const ch = CHALLENGERS[ci];
    if (state.seen.intro >= ci || state.stats.ladder >= CHALLENGERS.length) { fn(); return; }
    state.seen.intro = ci; save();
    showModal({
      portrait: avatarSVG(ch.av), title: ci === 0 ? 'Meet your first challenger!' : 'A new challenger!',
      lines: [ch.name + ' from ' + ch.town], quote: ch.hello, say: ch.hello,
      buttons: [{ label: "Let's play!", primary: true, onClick: fn }],
    });
  }
  // First game ever: run the guided practice first.
  function howToThen(fn) {
    if (state.seen.howto) { fn(); return; }
    showModal({
      title: 'Let’s practice first',
      lines: ['A quick practice game will show you how to play.', 'It only takes a minute.'],
      say: 'Let’s practice first. A quick practice game will show you how to play.',
      buttons: [{ label: '▶ Start practice', primary: true, onClick: () => startPractice(fn) }],
    });
  }
  $('guideBtn').addEventListener('click', renderGuide);
  $('guidePracticeTop').addEventListener('click', () => startPractice(null));

  // ---------- Guide (one page, opened from Home) ----------
  function miniTile(face, cls) {
    const t = el('div', 'mini-tile' + (cls ? ' ' + cls : ''));
    const f = el('div', 'face'); f.innerHTML = faceSVG(face); t.appendChild(f);
    return t;
  }
  function miniWithCap(face, cls, cap) {
    const w = el('div', 'mini-wrap'); w.appendChild(miniTile(face, cls)); w.appendChild(el('span', 'mini-cap', cap)); return w;
  }
  function sign(text, cls) { return el('span', 'mini-sign ' + cls, text); }
  function renderGuide() {
    showScreen('guide');
    const body = $('guideBody');
    body.textContent = '';
    const ci = currentCi();
    const sections = [
      { title: 'The goal', text: ['Clear all the tiles off the board by matching them in pairs.'],
        visual: () => [miniTile('dot5'), sign('+', 'yes'), miniTile('dot5'), sign('✓', 'yes')] },
      { title: 'Making a match', text: ['Tap a tile. It lights up gold.', 'Then tap its twin. Both tiles disappear.'],
        visual: () => [miniWithCap('crk7', 'selected', '1. Tap'), miniWithCap('crk7', '', '2. Tap its twin')] },
      { title: 'Which tiles match?', text: ['Tiles match when they look exactly the same: the same number and the same symbol.'],
        visual: () => [miniTile('bam3'), miniTile('bam3'), sign('✓', 'yes'), miniTile('bam3'), miniTile('dot3'), sign('✗', 'no')] },
      { title: 'Bright tiles and dark tiles', text: ['You can pick bright tiles.', 'Dark tiles are stuck for now: another tile is on top of them, or both of their sides are blocked. Clear the tiles around them first.'],
        visual: () => [miniWithCap('wN', '', 'Bright: pick it'), miniWithCap('wN', 'blocked', 'Dark: not yet')] },
      { title: 'The three buttons', text: [],
        visual: () => {
          const rows = el('div', 'btn-rows');
          [['↶ Undo', 'Brings back the last two tiles.'], ['💡 Hint', 'Lights up two tiles that match.'], ['🔀 Shuffle', 'Mixes up the tiles if you’re stuck.']].forEach((r) => {
            const row = el('div', 'btn-row'); row.appendChild(el('span', 'fake-btn', r[0])); row.appendChild(el('span', null, r[1])); rows.appendChild(row);
          });
          return [rows];
        }, wideVisual: true },
      { title: 'Playing a challenger', text: ['Tap Play on the home screen, then pick a game: Mahjong, Solitaire, Gin Rummy, Dominoes, Checkers, Five Dice or Word Search. Each game has a ❓ Rules button.', 'In Mahjong there’s no clock. Your challenger only moves when you do, so take your time.', 'Wins in any game count. Beat a challenger 3 times to win their trophy and meet someone new.'],
        visual: () => { const p = el('div', 'portrait small'); p.innerHTML = avatarSVG(CHALLENGERS[ci].av); return [p, el('span', 'big-emoji', '🏆')]; } },
      { title: 'Puzzle of the Day', text: ['A new puzzle every day, with no challenger. Just you and the tiles.'],
        visual: () => [el('span', 'big-emoji', '☀️')] },
      { title: 'If something looks wrong', text: ['Tap ⌂ Home. Your game is always saved right where you left off.'],
        visual: () => [el('span', 'fake-btn', '⌂ Home')] },
    ];
    sections.forEach((s, i) => {
      const sec = el('div', 'guide-sec');
      sec.appendChild(el('div', 'guide-num', String(i + 1)));
      const tx = el('div', 'guide-text');
      tx.appendChild(el('h2', null, s.title));
      s.text.forEach((p) => tx.appendChild(el('p', null, p)));
      const vis = el('div', 'guide-visual' + (s.wideVisual ? ' wide' : ''));
      s.visual().forEach((n) => vis.appendChild(n));
      if (s.wideVisual) { tx.appendChild(vis); sec.appendChild(tx); } else { sec.appendChild(tx); sec.appendChild(vis); }
      body.appendChild(sec);
    });
    const end = el('div', 'guide-end');
    const pr = el('button', 'btn primary', '▶ Practice game');
    pr.addEventListener('click', () => startPractice(null));
    const hm = el('button', 'btn', '⌂ Home');
    hm.addEventListener('click', goHome);
    end.appendChild(pr); end.appendChild(hm);
    body.appendChild(end);
    body.scrollTop = 0;
    speak('How to play. Clear all the tiles off the board by matching them in pairs.');
  }

  // ---------- Guided practice game ----------
  // Fixed 10-tile board. Bottom rows y0 (5 tiles) and y2 (4 tiles), one tile on top.
  const PRACTICE = [
    { x: 0, y: 0, z: 0, face: 'dot5' }, { x: 2, y: 0, z: 0, face: 'bam3' }, { x: 4, y: 0, z: 0, face: 'dR' },
    { x: 6, y: 0, z: 0, face: 'crk7' }, { x: 8, y: 0, z: 0, face: 'wE' },
    { x: 0, y: 2, z: 0, face: 'dot5' }, { x: 2, y: 2, z: 0, face: 'crk7' }, { x: 4, y: 2, z: 0, face: 'dR' }, { x: 6, y: 2, z: 0, face: 'bam3' },
    { x: 3, y: 1, z: 1, face: 'wE' },
  ];
  const COACH = [
    { text: 'Welcome! Tap one of the glowing tiles.', glow: [0, 5], need: 'select' },
    { text: 'Now tap its twin, the other glowing tile.', glow: [0, 5], need: 'match' },
    { text: 'Nice! Matched tiles disappear. See the darker tiles? Try tapping one.', need: 'blocked' },
    { text: 'It shook. Dark tiles are stuck because a tile is on top of them. Now match the glowing tile on top with its twin.', glow: [9, 4], need: 'match' },
    { text: 'Can’t find a match? Tap the Hint button at the bottom.', need: 'hint', pulse: 'hintBtn' },
    { text: 'Hint lit up two matching tiles. Tap them both.', need: 'match' },
    { text: 'Changed your mind? Tap Undo to bring the last two tiles back.', need: 'undo', pulse: 'undoBtn' },
    { text: 'They’re back! Now finish the board on your own. Take your time.', need: 'done' },
  ];
  let P = null; // practice state: { step, then }
  function startPractice(then) {
    P = { step: 0, then: then };
    mode = 'practice';
    G = baseGame('practice', 'pyramid', PRACTICE.map((t, i) => ({ id: i, x: t.x, y: t.y, z: t.z, face: t.face, gone: false })));
    selected = null; hintIds = [];
    showScreen('game');
    $('npcRow').classList.add('hidden');
    $('bubble').classList.add('hidden');
    $('gamePortrait').innerHTML = SUN_SVG;
    buildBoard(); renderRace();
    coach();
    requestAnimationFrame(positionTiles);
  }
  function coach() {
    const s = COACH[P.step];
    const b = $('banner');
    $('tip').classList.add('hidden');
    b.textContent = s.text; b.classList.add('coach'); b.classList.remove('hidden');
    hintIds = s.glow ? s.glow.slice() : (s.need === 'match' ? hintIds : []);
    ['hintBtn', 'undoBtn', 'shuffleBtn'].forEach((id) => $(id).classList.toggle('pulse', s.pulse === id));
    updateTiles(); renderRace();
    requestAnimationFrame(positionTiles);
    speak(s.text);
  }
  // Returns true if the tutorial allows this action; advances steps.
  function practiceGate(action, t) {
    if (mode !== 'practice' || !P) return true;
    const s = COACH[P.step];
    if (s.need === 'done') return true;
    if (action === 'tap') {
      if (s.need === 'blocked') return true;
      if (s.glow && s.glow.indexOf(t.id) < 0) { showTip('Tap one of the glowing tiles.'); return false; }
      if (s.need === 'hint' || s.need === 'undo') { showTip(s.need === 'hint' ? 'Tap the Hint button at the bottom.' : 'Tap the Undo button at the bottom.'); return false; }
      if (s.need === 'match' && !s.glow && hintIds.indexOf(t.id) < 0) { showTip('Tap one of the glowing tiles.'); return false; }
      return true;
    }
    if (action === s.need) return true;
    showTip(s.need === 'hint' ? 'Tap the Hint button.' : s.need === 'undo' ? 'Tap the Undo button.' : 'Follow the instructions at the top.');
    return false;
  }
  function practiceEvent(ev) {
    if (mode !== 'practice' || !P) return;
    const s = COACH[P.step];
    if (s.need === ev || (s.need === 'select' && ev === 'select')) { P.step++; coach(); }
  }
  function finishPractice() {
    const then = P && P.then;
    P = null;
    ['hintBtn', 'undoBtn', 'shuffleBtn'].forEach((id) => $(id).classList.remove('pulse'));
    $('banner').classList.add('hidden'); $('banner').classList.remove('coach');
    state.seen.howto = true; save();
    sfx('win');
    const ch = CHALLENGERS[currentCi()];
    const buttons = then
      ? [{ label: 'Let’s play!', primary: true, onClick: then }]
      : [{ label: 'Play ' + (state.games.ch ? CHALLENGERS[state.games.ch.ci].name : ch.name), primary: true, onClick: () => { if (state.games.ch) openGame('ch'); else introThen(currentCi(), newChallengerGame); } },
        { label: 'Practice again', onClick: () => startPractice(null) }, { label: 'Home', onClick: goHome }];
    showModal({
      portrait: SUN_SVG, title: 'You’re ready! 🎉',
      list: ['If you’re ever stuck, tap 🔀 Shuffle to mix up the tiles.', 'The 📖 Guide on the home screen explains everything again.', 'Your game is always saved. Tap ⌂ Home anytime.'],
      say: 'You’re ready! If you’re ever stuck, tap Shuffle to mix up the tiles.',
      buttons: buttons,
    });
  }
  $('playBtn').addEventListener('click', () => introThen(currentCi(), renderPicker));
  $('dailyBtn').addEventListener('click', () => {
    if (state.stats.dailyLast === dayKey()) {
      showModal({ title: 'All done for today! ☀️', lines: ['You finished today’s puzzle.', 'A new one will be waiting tomorrow.'], buttons: [{ label: 'OK', primary: true }] });
      return;
    }
    const g = state.games.daily;
    if (g && g.date === dayKey()) { openGame('daily'); return; }
    howToThen(() => newDailyGame());
  });
  $('trophyBtn').addEventListener('click', renderTrophies);

  // Family settings: press and hold so it can't be opened by accident.
  (function () {
    const btn = $('familyBtn'), fill = $('familyFill');
    let timer = null;
    const cancel = () => { clearTimeout(timer); timer = null; fill.classList.remove('running'); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fill.classList.add('running');
      timer = setTimeout(() => { cancel(); renderFamily(); }, 2000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => {
      if (timer) { cancel(); showTip('Family settings: press and hold for 2 seconds.', true); }
    }));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  })();

  // ---------- Game ----------
  let G = null, mode = null, selected = null, hintIds = [];
  const tileEls = new Map();
  const board = $('board');

  function layoutFor(ci, nth) {
    let key = CHALLENGERS[ci].layout;
    if (state.stats.ladder >= CHALLENGERS.length) key = ['pyramid', 'butterfly', 'table', 'garden', 'fortress'][nth % 5];
    if (state.settings.bigTiles && BIG_TILE_SWAP[key]) key = BIG_TILE_SWAP[key];
    return key;
  }
  function computeRate(ci) {
    let rate = 0.76 + Math.min(ci, 11) * 0.015;
    const r = state.stats.recent;
    if (r.length >= 3) rate += (r.reduce((a, b) => a + b, 0) / r.length - 0.65) * 0.25;
    let lossRun = 0;
    for (let i = r.length - 1; i >= 0 && r[i] === 0; i--) lossRun++;
    if (lossRun >= 2) rate -= 0.05 * (lossRun - 1);
    rate *= 0.96 + Math.random() * 0.08;
    return Math.min(0.97, Math.max(0.6, rate));
  }
  function baseGame(m, key, tiles) {
    return { mode: m, ci: 0, date: '', layout: key, tiles: tiles, hist: [], her: 0, npc: 0, total: tiles.length / 2, rate: 0.8, hints: 0, undos: 0, shuffles: 0, result: null, lead: '', half: false };
  }
  function newChallengerGame() {
    const ci = currentCi();
    const pc = state.stats.perCh[ci];
    const key = layoutFor(ci, pc.w + pc.l);
    const g = baseGame('ch', key, newBoard(key, mulberry32((Math.random() * 4294967296) >>> 0)));
    g.ci = ci; g.rate = computeRate(ci);
    state.games.ch = g; save();
    openGame('ch', true);
  }
  function newDailyGame() {
    const k = dayKey();
    let key = ['pyramid', 'butterfly', 'table', 'garden'][hashStr(k) % 4];
    if (state.settings.bigTiles && BIG_TILE_SWAP[key]) key = BIG_TILE_SWAP[key];
    const g = baseGame('daily', key, newBoard(key, mulberry32(hashStr('daily-' + k))));
    g.date = k;
    state.games.daily = g; save();
    openGame('daily', true);
  }
  function openGame(m, fresh) {
    mode = m; G = state.games[m]; selected = null; hintIds = [];
    showScreen('game');
    $('banner').classList.add('hidden'); $('banner').classList.remove('coach'); $('bubble').classList.add('hidden');
    ['hintBtn', 'undoBtn', 'shuffleBtn'].forEach((id) => $(id).classList.remove('pulse'));
    P = null;
    if (m === 'ch') {
      const ch = CHALLENGERS[G.ci];
      $('npcRow').classList.remove('hidden');
      $('npcName').textContent = ch.name;
      $('gamePortrait').innerHTML = avatarSVG(ch.av);
      if (G.result === 'loss') showBanner(ch.name + ' finished first this time. Keep going and finish your board!');
      if (fresh) say(pick([ch.hello.split('!')[0] + '!', 'Good luck!', "Let's have a nice game."]));
    } else {
      $('npcRow').classList.add('hidden');
      $('gamePortrait').innerHTML = SUN_SVG;
    }
    buildBoard();
    renderRace();
    requestAnimationFrame(() => { positionTiles(); checkDeadEnd(); });
  }
  $('homeBtn').addEventListener('click', () => { save(); goHome(); });

  function active() { return G.tiles.filter((t) => !t.gone); }
  function buildBoard() {
    board.textContent = ''; tileEls.clear();
    G.tiles.forEach((t) => {
      const d = el('div', 'tile');
      d.dataset.id = String(t.id);
      d.setAttribute('role', 'button');
      d.appendChild(el('div', 'face'));
      board.appendChild(d);
      tileEls.set(t.id, d);
    });
    positionTiles(); updateTiles(true);
  }
  function positionTiles() {
    if (!G) return;
    const r = board.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxZ = 0;
    G.tiles.forEach((t) => { minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y); maxZ = Math.max(maxZ, t.z); });
    const cols = (maxX - minX) / 2 + 1, rows = (maxY - minY) / 2 + 1, A = 0.76, k = 0.08, pad = 6;
    const W = r.width - pad * 2, H = r.height - pad * 2;
    const tw = Math.min(W / (cols + k * maxZ + k), (H / (rows / A + k * maxZ + k)));
    const th = tw / A, off = tw * k, edge = tw * k, gap = Math.max(1, tw * 0.025);
    const totalW = cols * tw + maxZ * off + edge, totalH = rows * th + maxZ * off + edge;
    const ox = pad + (W - totalW) / 2 + edge + maxZ * off, oy = pad + (H - totalH) / 2 + maxZ * off;
    board.style.setProperty('--edge', Math.max(3, edge * 0.8).toFixed(1) + 'px');
    G.tiles.forEach((t) => {
      const d = tileEls.get(t.id);
      d.style.left = (ox + ((t.x - minX) / 2) * tw - t.z * off) + 'px';
      d.style.top = (oy + ((t.y - minY) / 2) * th - t.z * off) + 'px';
      d.style.width = (tw - gap) + 'px';
      d.style.height = (th - gap) + 'px';
      d.style.zIndex = String(t.z * 1000 + t.y * 30 + (60 - t.x));
    });
  }
  function updateTiles(faces) {
    const act = active();
    const dim = state.settings.dim || mode === 'practice';
    G.tiles.forEach((t) => {
      const d = tileEls.get(t.id);
      if (faces || d.dataset.face !== t.face) {
        d.firstChild.innerHTML = faceSVG(t.face);
        d.dataset.face = t.face;
        d.setAttribute('aria-label', faceLabel(t.face));
      }
      const free = !t.gone && isFreeIn(t, act);
      d.classList.toggle('gone', t.gone);
      d.classList.toggle('blocked', !t.gone && !free && dim);
      d.classList.toggle('selected', t.id === selected);
      d.classList.toggle('hint', hintIds.indexOf(t.id) >= 0);
    });
  }
  function renderRace() {
    $('youBar').style.width = (100 * G.her / G.total) + '%';
    $('youCount').textContent = G.her + ' of ' + G.total;
    if (mode === 'ch') {
      const n = Math.floor(G.npc);
      $('npcBar').style.width = (100 * n / G.total) + '%';
      $('npcCount').textContent = n + ' of ' + G.total;
    }
    $('undoBtn').disabled = G.hist.length === 0;
  }

  let tipTimer = null;
  function showTip(text, home) {
    const t = $('tip');
    if (home) {
      // Tips on the home screen reuse the modal-free toast in the board wrap; show a small modal instead.
      showModal({ lines: [text], buttons: [{ label: 'OK', primary: true }] });
      return;
    }
    t.textContent = text; t.classList.remove('hidden');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => t.classList.add('hidden'), 4500);
  }
  let bubbleTimer = null;
  function say(text) {
    if (mode !== 'ch' || G.result) return;
    const b = $('bubble');
    b.textContent = text; b.classList.remove('hidden');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.add('hidden'), 6000);
  }
  function showBanner(text) {
    const b = $('banner'); b.textContent = text; b.classList.remove('hidden');
    requestAnimationFrame(positionTiles);
  }

  function freePairs() {
    const groups = {};
    active().filter((t, _, arr) => isFreeIn(t, arr)).forEach((t) => { (groups[t.face] = groups[t.face] || []).push(t); });
    return Object.keys(groups).filter((f) => groups[f].length >= 2).map((f) => [groups[f][0], groups[f][1]]);
  }

  board.addEventListener('click', (e) => {
    const d = e.target.closest('.tile');
    if (!d || !G || modalOpen) return;
    onTap(G.tiles[Number(d.dataset.id)]);
  });

  function onTap(t) {
    if (!t || t.gone) return;
    const act = active();
    const free = isFreeIn(t, act);
    if (P && mode === 'practice' && COACH[P.step].need === 'blocked' && free) { showTip('Try tapping one of the darker tiles.'); return; }
    if (free && !practiceGate('tap', t)) return;
    if (!free) {
      sfx('blocked');
      const d = tileEls.get(t.id);
      d.classList.remove('wiggle'); void d.offsetWidth; d.classList.add('wiggle');
      if (P && mode === 'practice' && COACH[P.step].need === 'blocked') { practiceEvent('blocked'); return; }
      showTip('That tile is stuck for now. Pick a bright tile that’s open on the left or right.');
      return;
    }
    if (!(P && mode === 'practice' && COACH[P.step].need !== 'done')) hintIds = [];
    if (selected === null || selected === t.id) {
      selected = selected === t.id ? null : t.id;
      sfx('select'); updateTiles();
      if (selected !== null) practiceEvent('select');
      return;
    }
    const s = G.tiles[selected];
    if (s.face === t.face) {
      s.gone = true; t.gone = true;
      G.hist.push([s.id, t.id]);
      G.her += 1; selected = null;
      sfx('match');
      npcStep();
      afterMove();
      practiceEvent('match');
    } else {
      selected = t.id; sfx('select'); updateTiles();
    }
  }
  function npcStep() { if (mode === 'ch') G.npc = Math.min(G.total, G.npc + G.rate); }
  function chatter() {
    if (mode !== 'ch' || G.result) return;
    const lead = G.npc > G.her + 0.5 ? 'npc' : G.her > G.npc + 0.5 ? 'her' : G.lead;
    if (lead && lead !== G.lead) { G.lead = lead; say(pick(lead === 'npc' ? NPC_AHEAD : NPC_BEHIND)); }
    else if (!G.half && G.her >= G.total / 2) { G.half = true; say(pick(NPC_HALF)); }
  }
  function afterMove() {
    updateTiles(); chatter();
    if (checkEnd()) return;
    renderRace(); save(); checkDeadEnd();
  }
  function checkEnd() {
    const ch = mode === 'ch' ? CHALLENGERS[G.ci] : null;
    if (mode === 'ch' && !G.result) {
      if (G.her >= G.total) { G.result = 'win'; recordResult(true); }
      else if (G.npc >= G.total) {
        G.result = 'loss'; recordResult(false); sfx('soft');
        $('bubble').classList.add('hidden');
        showBanner(ch.name + ' finished first this time. Keep going and finish your board!');
      }
    }
    if (G.her >= G.total) { renderRace(); setTimeout(finishGame, 450); return true; }
    return false;
  }
  // Shared by every game. win: true, false, or null for a tie.
  function recordMatch(ci, win) {
    const S = state.stats, pc = S.perCh[ci], info = { trophy: false };
    logToday((e) => { e.g++; if (win) e.w++; });
    if (win === null) { save(); return info; }
    S.recent.push(win ? 1 : 0); S.recent = S.recent.slice(-10);
    if (win) {
      S.wins++; S.streak++; S.best = Math.max(S.best, S.streak); pc.w++;
      if (S.ladder < CHALLENGERS.length && ci === S.ladder && pc.w >= WINS_FOR_TROPHY) { S.ladder++; info.trophy = true; }
      else if (S.ladder >= CHALLENGERS.length) S.rematch = (S.rematch + 1) % CHALLENGERS.length;
    } else {
      S.losses++; pc.l++; S.streak = 0;
    }
    save();
    return info;
  }
  function recordResult(win) { G.trophy = recordMatch(G.ci, win).trophy; }
  function nextNote() {
    if (!state.notes.length) return null;
    state.noteQueue = state.noteQueue.filter((i) => i < state.notes.length);
    if (!state.noteQueue.length) state.noteQueue = shuffle(state.notes.map((_, i) => i));
    return state.notes[state.noteQueue.shift()];
  }
  function finishGame() {
    if (mode === 'practice') { finishPractice(); return; }
    const g = G, S = state.stats;
    state.games[mode] = null;
    if (mode === 'daily') {
      S.dailyLast = dayKey(); S.dailyDays++;
      logToday((e) => { e.p = true; });
      save(); sfx('win');
      const helped = g.hints + g.undos + g.shuffles;
      showModal({
        portrait: SUN_SVG, title: 'Puzzle solved! ☀️',
        lines: [helped === 0 ? 'You did it without any help. Wonderful!' : 'Nicely done!', 'Days you’ve solved the daily puzzle: ' + S.dailyDays],
        note: nextNote(), say: 'Puzzle solved! Nicely done.',
        buttons: [{ label: 'Home', primary: true, onClick: goHome }],
      });
      save();
      return;
    }
    const ch = CHALLENGERS[g.ci];
    if (g.result === 'win') {
      sfx('win');
      const lines = ['Win streak: ' + S.streak + (S.streak > 1 && S.streak === S.best ? '  ⭐ New best!' : '')];
      const buttons = [];
      if (g.trophy) {
        lines.push('🏆 You earned ' + ch.name + '’s trophy!');
        if (S.ladder < CHALLENGERS.length) {
          buttons.push({ label: 'Meet your next challenger', primary: true, onClick: () => introThen(currentCi(), newChallengerGame) });
        } else {
          lines.push('You beat every challenger. You’re the Grand Champion! 👑');
          buttons.push({ label: 'Play again', primary: true, onClick: newChallengerGame });
        }
      } else {
        const w = S.perCh[g.ci].w;
        if (S.ladder < CHALLENGERS.length) lines.push('Wins toward ' + ch.name + '’s trophy: ' + dots(Math.min(w, WINS_FOR_TROPHY)));
        buttons.push({ label: 'Play again', primary: true, onClick: newChallengerGame });
      }
      buttons.push({ label: 'Other games', onClick: renderPicker });
      buttons.push({ label: 'Home', onClick: goHome });
      showModal({ portrait: avatarSVG(ch.av), title: 'You won! 🎉', quote: ch.lose, lines: lines, note: nextNote(), say: 'You won! ' + ch.lose, buttons: buttons });
    } else {
      sfx('soft');
      const lines = [ch.name + ' finished first this time, but you finished strong.'];
      if (S.best > 0) lines.push('Your best streak of ' + S.best + ' is still yours.');
      showModal({
        portrait: avatarSVG(ch.av), title: 'Board cleared!', lines: lines, say: 'Board cleared! Nice finish.',
        buttons: [{ label: 'Rematch', primary: true, onClick: newChallengerGame }, { label: 'Other games', onClick: renderPicker }, { label: 'Home', onClick: goHome }],
      });
    }
    save();
  }
  function checkDeadEnd() {
    if (!G || G.her >= G.total || freePairs().length) return;
    showModal({
      title: 'No more matches right now',
      lines: ['Let’s mix up the tiles so you can keep going.', 'This one is free!'],
      say: 'No more matches. Let’s mix up the tiles.',
      buttons: [{ label: '🔀 Mix up the tiles', primary: true, onClick: () => doShuffle(false) }],
    });
  }
  function doShuffle(charge) {
    const act = active();
    const faces = act.map((t) => t.face);
    if (!dealFaces(act, faces, Math.random)) {
      // Rare: the remaining tiles are stacked so no deal can work. Lay them out flat.
      act.forEach((t, i) => { t.x = (i % 8) * 2; t.y = Math.floor(i / 8) * 2; t.z = 0; });
      G.tiles.forEach((t) => { if (t.gone) { t.x = 0; t.y = 0; t.z = 0; } });
      G.hist = [];
      dealFaces(act, faces, Math.random);
      positionTiles();
    }
    selected = null; hintIds = [];
    if (charge) { G.shuffles++; npcStep(); }
    sfx('shuffle');
    board.classList.remove('shuffling'); void board.offsetWidth; board.classList.add('shuffling');
    updateTiles(true); chatter();
    if (checkEnd()) return;
    renderRace(); save();
    setTimeout(checkDeadEnd, 500);
  }
  $('shuffleBtn').addEventListener('click', () => { if (G && !modalOpen && practiceGate('shuffle')) doShuffle(true); });
  $('hintBtn').addEventListener('click', () => {
    if (!G || modalOpen || !practiceGate('hint')) return;
    const pairs = freePairs();
    if (!pairs.length) { checkDeadEnd(); return; }
    const p = pick(pairs);
    hintIds = [p[0].id, p[1].id]; selected = null;
    G.hints++; npcStep();
    sfx('select'); updateTiles(); chatter();
    showTip('These two match. Tap them both!');
    if (!checkEnd()) { renderRace(); save(); }
    practiceEvent('hint');
  });
  $('undoBtn').addEventListener('click', () => {
    if (!G || modalOpen || !practiceGate('undo')) return;
    const last = G.hist.pop();
    if (!last) { showTip('Nothing to undo yet.'); return; }
    G.tiles[last[0]].gone = false; G.tiles[last[1]].gone = false;
    G.her -= 1; G.undos++; selected = null; hintIds = [];
    npcStep(); sfx('select');
    updateTiles(); chatter();
    if (!checkEnd()) { renderRace(); save(); }
    practiceEvent('undo');
  });

  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(positionTiles); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else if ($('home').classList.contains('active')) renderHome(); });

  // ---------- Trophies ----------
  function renderTrophies() {
    showScreen('trophies');
    const S = state.stats;
    const earned = Math.min(S.ladder, CHALLENGERS.length);
    $('trophyStats').textContent = '🏆 Trophies: ' + earned + ' of ' + CHALLENGERS.length + '   ·   Games won: ' + S.wins + '   ·   Best streak: ' + S.best + '   ·   Daily puzzles: ' + S.dailyDays;
    const grid = $('trophyGrid');
    grid.textContent = '';
    CHALLENGERS.forEach((ch, i) => {
      const card = el('div', 'trophy' + (i > S.ladder ? ' locked' : ''));
      const p = el('div', 'portrait');
      if (i > S.ladder) { const lf = el('div', 'lock-face', '?'); p.appendChild(lf); } else p.innerHTML = avatarSVG(ch.av);
      card.appendChild(p);
      card.appendChild(el('h3', null, i > S.ladder ? '???' : ch.name));
      const w = S.perCh[i].w;
      if (i < S.ladder) card.appendChild(el('p', null, '🏆 Trophy won'));
      else if (i === S.ladder) card.appendChild(el('p', null, 'Wins: ' + dots(Math.min(w, WINS_FOR_TROPHY))));
      else card.appendChild(el('p', null, 'Not met yet'));
      grid.appendChild(card);
    });
  }

  // ---------- Family settings ----------
  function toggleRow(body, text, key, after) {
    const row = el('div', 'row');
    row.appendChild(el('label', null, text));
    const b = el('button', 'btn toggle');
    const paint = () => { b.textContent = state.settings[key] ? 'On' : 'Off'; b.setAttribute('aria-pressed', String(state.settings[key])); };
    b.addEventListener('click', () => { state.settings[key] = !state.settings[key]; save(); paint(); if (after) after(); });
    paint(); row.appendChild(b); body.appendChild(row);
  }
  function renderFamily() {
    showScreen('family');
    const body = $('familyBody');
    body.textContent = '';

    body.appendChild(el('h2', null, 'Greeting'));
    const nr = el('div', 'row');
    nr.appendChild(el('label', null, 'Name to greet her with'));
    const ni = el('input'); ni.type = 'text'; ni.maxLength = 30; ni.placeholder = 'e.g. Grandma Rose'; ni.value = state.settings.name;
    ni.addEventListener('input', () => { state.settings.name = cleanStr(ni.value, 30); save(); });
    nr.appendChild(ni); body.appendChild(nr);

    body.appendChild(el('h2', null, 'Game options'));
    toggleRow(body, 'Sound', 'sound');
    toggleRow(body, 'Read messages aloud', 'speak');
    toggleRow(body, 'Darken tiles she can’t pick', 'dim');
    toggleRow(body, 'Bigger tiles (smaller boards)', 'bigTiles');
    body.appendChild(el('p', 'small-note', 'Board size changes apply to the next new game.'));

    body.appendChild(el('h2', null, 'Notes after a win'));
    body.appendChild(el('p', 'small-note', 'One of these shows up (in rotation) each time she wins. Stored only on this tablet.'));
    const list = el('div');
    const paintNotes = () => {
      list.textContent = '';
      if (!state.notes.length) list.appendChild(el('p', 'small-note', 'No notes yet.'));
      state.notes.forEach((n, i) => {
        const it = el('div', 'note-item');
        it.appendChild(el('p', null, (n.from ? n.from + ': ' : '') + n.text));
        const rm = el('button', 'btn tool', 'Remove');
        rm.addEventListener('click', () => { state.notes.splice(i, 1); state.noteQueue = []; save(); paintNotes(); });
        it.appendChild(rm); list.appendChild(it);
      });
    };
    paintNotes(); body.appendChild(list);
    const fr = el('div', 'row'); fr.appendChild(el('label', null, 'From'));
    const fi = el('input'); fi.type = 'text'; fi.maxLength = 30; fi.placeholder = 'e.g. Josef';
    fr.appendChild(fi); body.appendChild(fr);
    const mr = el('div', 'row'); mr.appendChild(el('label', null, 'Message'));
    const mi = el('textarea'); mi.maxLength = 240; mi.placeholder = 'e.g. Great job, Grandma! Love you.';
    mr.appendChild(mi); body.appendChild(mr);
    const add = el('button', 'btn primary', 'Add note');
    add.addEventListener('click', () => {
      const text = cleanStr(mi.value, 240);
      if (!text || state.notes.length >= 50) return;
      state.notes.push({ from: cleanStr(fi.value, 30), text: text });
      state.noteQueue = []; mi.value = ''; save(); paintNotes();
    });
    body.appendChild(add);

    body.appendChild(el('h2', null, 'This week'));
    const since = dayKey(new Date(Date.now() - 6 * 86400000));
    const wk = state.stats.log.filter((e) => e.d >= since);
    const sum = (f) => wk.reduce((a, e) => a + f(e), 0);
    body.appendChild(el('p', null, 'Days played: ' + wk.filter((e) => e.g > 0 || e.p).length + ' of 7  ·  Games: ' + sum((e) => e.g) + '  ·  Wins: ' + sum((e) => e.w) + '  ·  Daily puzzles: ' + sum((e) => (e.p ? 1 : 0))));
    body.appendChild(el('p', null, 'Current streak: ' + state.stats.streak + '  ·  Best streak: ' + state.stats.best + '  ·  Trophies: ' + Math.min(state.stats.ladder, CHALLENGERS.length) + ' of ' + CHALLENGERS.length));

    body.appendChild(el('h2', null, 'Backup'));
    body.appendChild(el('p', 'small-note', 'Save her progress as a file, in case the tablet is ever reset. Restoring replaces current progress.'));
    const br = el('div', 'row');
    const sb = el('button', 'btn', 'Save backup file');
    sb.addEventListener('click', () => {
      const data = JSON.stringify(Object.assign({}, state, { games: { ch: null, daily: null }, g2: {} }), null, 1);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'mahjong-parlor-backup-' + dayKey() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    const rb = el('button', 'btn', 'Restore from backup');
    rb.addEventListener('click', () => $('restoreInput').click());
    br.appendChild(sb); br.appendChild(rb); body.appendChild(br);

    body.appendChild(el('h2', null, 'Start over'));
    const reset = el('button', 'btn danger', 'Reset all progress');
    let armed = false;
    reset.addEventListener('click', () => {
      if (!armed) { armed = true; reset.textContent = 'Tap again to erase everything'; setTimeout(() => { armed = false; reset.textContent = 'Reset all progress'; }, 4000); return; }
      const keep = { settings: state.settings, notes: state.notes };
      state = defaults(); state.settings = keep.settings; state.notes = keep.notes; save(); renderFamily();
    });
    body.appendChild(reset);
    body.appendChild(el('p', 'small-note', 'Keeps settings and notes. Erases streaks, trophies and games.'));
    body.appendChild(el('p', 'small-note', 'Privacy: this app makes no internet connections after it is installed. Nothing is collected or shared.'));
  }
  $('restoreInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 200000) { showModal({ title: 'That file is too big', lines: ['It doesn’t look like a Mahjong Parlor backup.'] }); return; }
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result));
        if (!parsed || parsed.v !== 1) throw new Error('not a backup');
        state = sanitize(parsed, false); save(); renderFamily();
        showModal({ title: 'Backup restored', lines: ['Her progress is back.'] });
      } catch (err) {
        showModal({ title: 'Couldn’t read that file', lines: ['It doesn’t look like a Mahjong Parlor backup.'] });
      }
    };
    r.readAsText(f);
  });


  // ---------- Game picker & other games ----------
  const EXTRA = {}, EXTRA_ORDER = [];
  let X = null; // running extra game: { def, ctx }
  const MAHJONG_ICON = '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="22" y="10" width="56" height="78" rx="8" fill="#d8c690"/><rect x="18" y="6" width="56" height="78" rx="8" fill="#fffdf5" stroke="#6d5f3c" stroke-width="3"/><circle cx="46" cy="28" r="9" fill="none" stroke="#1d3f94" stroke-width="5"/><circle cx="46" cy="47" r="9" fill="none" stroke="#17692f" stroke-width="5"/><circle cx="46" cy="66" r="9" fill="none" stroke="#b0141e" stroke-width="5"/></svg>';
  function registerGame(def) { if (!EXTRA[def.id]) { EXTRA[def.id] = def; EXTRA_ORDER.push(def.id); } }
  function renderPicker() {
    showScreen('picker');
    const ci = currentCi(), ch = CHALLENGERS[ci];
    $('pickerPortrait').innerHTML = avatarSVG(ch.av);
    $('pickerTitle').textContent = 'What shall we play, ' + ch.name + '?';
    const grid = $('pickerGrid');
    grid.textContent = '';
    const items = [{ id: 'mahjong', name: 'Mahjong', blurb: 'Match pairs of tiles', icon: MAHJONG_ICON }].concat(EXTRA_ORDER.map((id) => EXTRA[id]));
    items.forEach((it) => {
      const b = el('button', 'pick-card');
      const ic = el('div', 'pick-icon'); ic.innerHTML = it.icon; b.appendChild(ic);
      b.appendChild(el('span', 'pick-name', it.name));
      b.appendChild(el('span', 'pick-blurb', it.blurb));
      const resume = it.id === 'mahjong' ? state.games.ch : state.g2[it.id];
      if (resume) b.appendChild(el('span', 'pick-badge', 'Continue'));
      b.addEventListener('click', () => {
        if (it.id === 'mahjong') { if (state.games.ch) openGame('ch'); else howToThen(newChallengerGame); }
        else startExtra(it.id);
      });
      grid.appendChild(b);
    });
    speak('What shall we play?');
  }
  function computeLevel(ci) {
    let lv = 0.2 + Math.min(ci, 11) * 0.06;
    const r = state.stats.recent;
    if (r.length >= 3) lv += (r.reduce((a, b) => a + b, 0) / r.length - 0.65) * 0.8;
    let lossRun = 0;
    for (let i = r.length - 1; i >= 0 && r[i] === 0; i--) lossRun++;
    if (lossRun >= 2) lv -= 0.15 * (lossRun - 1);
    lv += (Math.random() - 0.5) * 0.1;
    return Math.min(1, Math.max(0, lv));
  }
  function showRules(def, then) {
    state.seen.rules[def.id] = true; save();
    showModal({ title: 'How to play ' + def.name, list: def.rules, say: def.rules[0], buttons: [{ label: 'Got it!', primary: true, onClick: then }] });
  }
  $('g2Rules').addEventListener('click', () => { if (X) showRules(X.def); });
  $('g2Home').addEventListener('click', () => { if (X && X.ctx.saveNow) X.ctx.saveNow(); goHome(); });

  function startExtra(id, fresh) {
    const def = EXTRA[id];
    const saved = fresh ? null : state.g2[id];
    const ci = saved ? saved.ci : currentCi();
    const level = saved ? saved.level : computeLevel(ci);
    const ch = CHALLENGERS[ci];
    mode = 'extra'; G = null;
    showScreen('g2');
    $('g2Title').textContent = def.name;
    $('g2Portrait').innerHTML = avatarSVG(ch.av);
    ['g2Body', 'g2Ctrl', 'g2Score'].forEach((k) => { $(k).textContent = ''; });
    $('g2Msg').classList.add('hidden'); $('g2Bubble').classList.add('hidden'); $('g2Tip').classList.add('hidden');
    let bubbleT = null, tipT = null;
    const ctx = {
      body: $('g2Body'), ctrl: $('g2Ctrl'), ci: ci, ch: ch, name: ch.name, level: level,
      alive: () => X !== null && X.ctx === ctx,
      msg(text) { const m = $('g2Msg'); if (!text) { m.classList.add('hidden'); return; } m.textContent = text; m.classList.remove('hidden'); },
      say(text) {
        if (!ctx.alive()) return;
        const b = $('g2Bubble'); b.textContent = text; b.classList.remove('hidden');
        clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.add('hidden'), 5000);
      },
      tip(text) {
        const t = $('g2Tip'); t.textContent = text; t.classList.remove('hidden');
        clearTimeout(tipT); tipT = setTimeout(() => t.classList.add('hidden'), 4500);
      },
      score(parts) {
        const sc = $('g2Score'); sc.textContent = '';
        parts.forEach((p, i) => {
          if (i) sc.appendChild(el('span', 'g2-sep', '·'));
          sc.appendChild(el('span', 'g2-part' + (p.cls ? ' ' + p.cls : ''), p.label + ': ' + p.value));
        });
      },
      button(label, fn, cls) {
        const b = el('button', 'btn control' + (cls ? ' ' + cls : ''), label);
        b.addEventListener('click', () => { if (!modalOpen && ctx.alive()) fn(); });
        ctx.ctrl.appendChild(b); return b;
      },
      later(fn, ms) { setTimeout(() => { if (ctx.alive() && !ctx.done) fn(); }, ms); },
      save(data) { if (ctx.done) return; state.g2[id] = { ci: ci, level: level, data: data }; save(); },
      saveNow: null,
      sfx: sfx, speak: speak, el: el, shuffle: shuffle, pick: pick, modal: showModal,
      done: false,
      // win: true / false / null (tie)
      end(win, lines) {
        if (ctx.done) return;
        ctx.done = true;
        delete state.g2[id]; save();
        const info = recordMatch(ci, win);
        const S = state.stats;
        const L = (lines || []).slice();
        const buttons = [];
        let title, quote = null, say;
        if (win === true) {
          sfx('win'); title = 'You won! 🎉'; quote = ch.lose; say = 'You won! ' + ch.lose;
          L.push('Win streak: ' + S.streak + (S.streak > 1 && S.streak === S.best ? '  ⭐ New best!' : ''));
          if (info.trophy) {
            L.push('🏆 You earned ' + ch.name + '’s trophy!');
            if (S.ladder < CHALLENGERS.length) buttons.push({ label: 'Meet your next challenger', primary: true, onClick: () => introThen(currentCi(), renderPicker) });
            else { L.push('You beat every challenger. You’re the Grand Champion! 👑'); buttons.push({ label: 'Play again', primary: true, onClick: () => startExtra(id, true) }); }
          } else {
            if (S.ladder < CHALLENGERS.length) L.push('Wins toward ' + ch.name + '’s trophy: ' + dots(Math.min(S.perCh[ci].w, WINS_FOR_TROPHY)));
            buttons.push({ label: 'Play again', primary: true, onClick: () => startExtra(id, true) });
          }
        } else if (win === false) {
          sfx('soft'); title = ch.name + ' won this time'; say = 'Good game! ' + ch.name + ' won this time.';
          L.push('Good game! Rematch?');
          if (S.best > 0) L.push('Your best streak of ' + S.best + ' is still yours.');
          buttons.push({ label: 'Rematch', primary: true, onClick: () => startExtra(id, true) });
        } else {
          sfx('match'); title = 'It’s a tie!'; say = 'It’s a tie! Good game.';
          L.push('Your win streak stays at ' + S.streak + '.');
          buttons.push({ label: 'Play again', primary: true, onClick: () => startExtra(id, true) });
        }
        buttons.push({ label: 'Other games', onClick: renderPicker });
        buttons.push({ label: 'Home', onClick: goHome });
        setTimeout(() => showModal({ portrait: avatarSVG(ch.av), title: title, quote: quote, lines: L, note: win === true ? nextNote() : null, say: say, buttons: buttons }), 700);
      },
    };
    $('g2Bubble').classList.toggle('left', def.bubble === 'left');
    X = { def: def, ctx: ctx };
    const go = () => {
      try { def.create(ctx, saved ? saved.data : null); }
      catch (e) {
        // A saved game that can't be restored is dropped and a new one started.
        delete state.g2[id]; save();
        ['g2Body', 'g2Ctrl', 'g2Score'].forEach((k) => { $(k).textContent = ''; });
        def.create(ctx, null);
      }
    };
    if (!state.seen.rules[id]) showRules(def, go); else go();
  }

  // Playing cards shared by Solitaire and Gin Rummy. A card is an integer 0-51.
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUIT_SYM = ['♠', '♥', '♦', '♣'];
  const SUIT_NAME = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  const RANK_NAME = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
  const cardSuit = (c) => Math.floor(c / 13), cardRank = (c) => (c % 13) + 1;
  const isRed = (c) => { const s = cardSuit(c); return s === 1 || s === 2; };
  const cardName = (c) => RANK_NAME[c % 13] + ' of ' + SUIT_NAME[cardSuit(c)];
  const cardShort = (c) => RANKS[c % 13] + SUIT_SYM[cardSuit(c)];
  function cardEl(c, faceUp) {
    const d = el('div', 'pcard' + (faceUp ? (isRed(c) ? ' red' : ' black') : ' back'));
    if (faceUp) {
      d.appendChild(el('span', 'pc-rank', RANKS[c % 13]));
      d.appendChild(el('span', 'pc-suit', SUIT_SYM[cardSuit(c)]));
      d.appendChild(el('span', 'pc-big', SUIT_SYM[cardSuit(c)]));
      d.setAttribute('aria-label', cardName(c));
    }
    return d;
  }
  function validInt(v, min, max) { return Number.isInteger(v) && v >= min && v <= max; }
  function assert(c) { if (!c) throw new Error('bad saved game'); }

  window.MP = Object.freeze({
    registerGame: registerGame, el: el, shuffle: shuffle, pick: pick, validInt: validInt, assert: assert,
    cards: Object.freeze({ RANKS: RANKS, SUIT_SYM: SUIT_SYM, suit: cardSuit, rank: cardRank, isRed: isRed, name: cardName, short: cardShort, el: cardEl }),
  });

  // ---------- Boot ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  renderHome();
})();
