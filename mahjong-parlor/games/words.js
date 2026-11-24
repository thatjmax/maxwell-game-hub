/* Word Search: take turns finding words with the challenger. Most words found wins. */
'use strict';
(function () {
  const MP = window.MP, el = MP.el;
  const THEMES = {
    'In the Garden': ['ROSE', 'TULIP', 'DAISY', 'LILY', 'ORCHID', 'FERN', 'MAPLE', 'PEONY', 'VIOLET', 'POPPY', 'CLOVER', 'MOSS', 'SEED', 'IVY', 'ASTER'],
    'In the Kitchen': ['SPOON', 'FORK', 'KETTLE', 'OVEN', 'BOWL', 'LADLE', 'WHISK', 'PLATE', 'TEAPOT', 'APRON', 'TOAST', 'BUTTER', 'HONEY', 'SUGAR', 'FLOUR'],
    'Birds': ['ROBIN', 'WREN', 'SPARROW', 'EAGLE', 'OWL', 'DOVE', 'FINCH', 'HERON', 'SWAN', 'CROW', 'LARK', 'GOOSE', 'DUCK', 'PARROT', 'CRANE'],
    'Weather': ['RAIN', 'SNOW', 'CLOUD', 'SUNNY', 'WIND', 'STORM', 'FROST', 'MIST', 'BREEZE', 'THUNDER', 'RAINBOW', 'HAIL', 'FOG', 'SLEET', 'DEW'],
    'By the Sea': ['WHALE', 'CRAB', 'SHELL', 'WAVE', 'SAND', 'CORAL', 'SEAL', 'TIDE', 'BOAT', 'SHARK', 'FISH', 'PEARL', 'SHORE', 'ANCHOR', 'KELP'],
    'Music': ['PIANO', 'SONG', 'DRUM', 'FLUTE', 'HARP', 'CHOIR', 'VIOLIN', 'TUNE', 'NOTE', 'BANJO', 'CELLO', 'HYMN', 'WALTZ', 'BELL', 'ORGAN'],
    'Fruit': ['APPLE', 'PEAR', 'PLUM', 'GRAPE', 'LEMON', 'PEACH', 'MANGO', 'CHERRY', 'BERRY', 'MELON', 'LIME', 'KIWI', 'FIG', 'DATE', 'ORANGE'],
    'Around the House': ['CHAIR', 'TABLE', 'LAMP', 'CLOCK', 'SOFA', 'QUILT', 'MIRROR', 'PILLOW', 'RUG', 'DOOR', 'WINDOW', 'BASKET', 'CANDLE', 'SHELF', 'VASE'],
  };
  const SIZE = 10, NWORDS = 9;
  const DIRS = [[0, 1], [1, 0], [1, 1]];
  const ABC = 'ABCDEFGHIJKLMNOPRSTUVWY';

  function build() {
    const names = Object.keys(THEMES);
    const theme = names[Math.floor(Math.random() * names.length)];
    const pool = MP.shuffle(THEMES[theme].slice());
    const grid = new Array(SIZE * SIZE).fill('');
    const words = [];
    for (const w of pool) {
      if (words.length >= NWORDS) break;
      if (w.length > SIZE) continue;
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const d = DIRS[Math.floor(Math.random() * DIRS.length)];
        const r = Math.floor(Math.random() * (SIZE - d[0] * (w.length - 1)));
        const c = Math.floor(Math.random() * (SIZE - d[1] * (w.length - 1)));
        let ok = true;
        for (let i = 0; i < w.length; i++) { const g = grid[(r + d[0] * i) * SIZE + c + d[1] * i]; if (g && g !== w[i]) { ok = false; break; } }
        if (!ok) continue;
        for (let i = 0; i < w.length; i++) grid[(r + d[0] * i) * SIZE + c + d[1] * i] = w[i];
        words.push({ w: w, r: r, c: c, dr: d[0], dc: d[1], by: '' });
        placed = true;
      }
    }
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = ABC[Math.floor(Math.random() * ABC.length)];
    return { theme: theme, grid: grid.join(''), words: words, turn: 'you' };
  }
  const cellsOf = (w) => Array.from({ length: w.w.length }, (_, i) => (w.r + w.dr * i) * SIZE + w.c + w.dc * i);

  function restore(d) {
    const A = MP.assert;
    A(d && typeof d.grid === 'string' && /^[A-Z]{100}$/.test(d.grid) && THEMES[d.theme] && Array.isArray(d.words) && d.words.length >= 3 && d.words.length <= 12);
    const words = d.words.map((w) => {
      A(w && typeof w.w === 'string' && /^[A-Z]{2,10}$/.test(w.w) && MP.validInt(w.r, 0, 9) && MP.validInt(w.c, 0, 9) && MP.validInt(w.dr, 0, 1) && MP.validInt(w.dc, 0, 1) && (w.dr || w.dc));
      const o = { w: w.w, r: w.r, c: w.c, dr: w.dr, dc: w.dc, by: w.by === 'you' || w.by === 'npc' ? w.by : '' };
      cellsOf(o).forEach((ci, i) => A(ci < 100 && d.grid[ci] === o.w[i]));
      return o;
    });
    A(d.turn === 'you' || d.turn === 'npc');
    return { theme: d.theme, grid: d.grid, words: words, turn: d.turn };
  }

  MP.registerGame({
    id: 'words', name: 'Word Search', blurb: 'Take turns finding words',
    icon: '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="8" y="8" width="84" height="84" rx="8" fill="#fffdf5" stroke="#333" stroke-width="3"/><rect x="16" y="40" width="68" height="20" rx="10" fill="#9ee6b0"/><g font-size="17" font-weight="800" font-family="Arial" text-anchor="middle" fill="#222"><text x="26" y="31">K</text><text x="50" y="31">L</text><text x="74" y="31">A</text><text x="26" y="56">R</text><text x="50" y="56">O</text><text x="74" y="56">W</text><text x="26" y="81">T</text><text x="50" y="81">E</text><text x="74" y="81">S</text></g></svg>',
    rules: [
      'Find the words from the list in the letters. They go across, down, or on a slant, always left-to-right or top-to-bottom.',
      'Tap the first letter of a word, then tap its last letter.',
      'You and your challenger take turns. After you find a word, they get a turn to look for one.',
      'Stuck? Hint lights up where a word starts, but then your challenger gets a turn.',
      'Whoever finds the most words wins.',
    ],
    create(ctx, saved) {
      let st, start = -1, hintCell = -1, busy = false;
      const body = ctx.body;
      const hintBtn = ctx.button('💡 Hint', doHint);

      function persist() { ctx.save({ theme: st.theme, grid: st.grid, words: st.words, turn: st.turn }); }
      const left = () => st.words.filter((w) => !w.by);
      const countBy = (who) => st.words.filter((w) => w.by === who).length;
      function yourMsg() { ctx.msg('Your turn: tap the first letter of a word, then its last letter.'); }

      function tapCell(i) {
        if (busy || st.turn !== 'you') return;
        if (start < 0) { start = i; ctx.sfx('select'); render(); return; }
        if (start === i) { start = -1; render(); return; }
        const a = start, b = i;
        start = -1;
        const w = left().find((x) => { const cs = cellsOf(x); const s = cs[0], e = cs[cs.length - 1]; return (s === a && e === b) || (s === b && e === a); });
        if (!w) {
          ctx.sfx('blocked'); ctx.tip('That’s not one of the words. Try again!'); render(); return;
        }
        w.by = 'you'; hintCell = -1; ctx.sfx('match');
        ctx.speak(w.w);
        afterFind();
      }
      function afterFind() {
        if (!left().length) { finish(); return; }
        st.turn = 'npc'; persist(); render(); npcTurn();
      }
      function finish() {
        render();
        const a = countBy('you'), b = countBy('npc');
        ctx.end(a > b ? true : a < b ? false : null, ['You found ' + a + ' words. ' + ctx.name + ' found ' + b + '.']);
      }
      function npcTurn() {
        busy = true; render(); ctx.msg(ctx.name + ' is looking…');
        ctx.later(() => {
          const p = 0.25 + 0.55 * ctx.level;
          const rem = left();
          busy = false;
          if (rem.length && Math.random() < p) {
            const w = ctx.pick(rem);
            w.by = 'npc'; ctx.sfx('soft');
            ctx.say(ctx.pick(['Found one: ' + w.w + '!', 'Aha! ' + w.w + '!', 'There’s ' + w.w + '!']));
            if (!left().length) { finish(); return; }
            st.turn = 'you'; persist(); render();
            ctx.msg(ctx.name + ' found ' + w.w + '. Your turn!');
          } else {
            ctx.say(ctx.pick(['Hmm, I can’t spot one. Your turn!', 'These letters are tricky…', 'I’ll pass this time.']));
            st.turn = 'you'; persist(); render(); yourMsg();
          }
        }, 1800);
      }
      function doHint() {
        if (busy || st.turn !== 'you') return;
        const w = ctx.pick(left());
        hintCell = cellsOf(w)[0];
        ctx.tip('A word starts at the glowing letter. Now it’s ' + ctx.name + '’s turn.');
        render();
        st.turn = 'npc'; persist();
        ctx.later(npcTurn, 1400);
      }

      function render() {
        const r = body.getBoundingClientRect(), W = r.width, H = r.height;
        body.textContent = '';
        const portrait = W < H * 1.1;
        const gridSize = Math.floor(Math.min(portrait ? W : W * 0.64, portrait ? H * 0.62 : H) / SIZE) * SIZE;
        const wrap = el('div', 'ws-wrap' + (portrait ? ' portrait' : ''));
        const g = el('div', 'ws-grid');
        g.style.width = gridSize + 'px'; g.style.height = gridSize + 'px';
        g.style.setProperty('--ws', (gridSize / SIZE) + 'px');
        const owner = new Array(SIZE * SIZE).fill('');
        st.words.forEach((w) => { if (w.by) cellsOf(w).forEach((ci) => { owner[ci] = owner[ci] ? 'both' : w.by; }); });
        const mine = st.turn === 'you' && !busy;
        for (let i = 0; i < SIZE * SIZE; i++) {
          const c = el('button', 'ws-cell' + (owner[i] ? ' f-' + owner[i] : '') + (i === start ? ' start' : '') + (i === hintCell ? ' hint' : ''), st.grid[i]);
          c.addEventListener('click', () => tapCell(i));
          if (!mine) c.tabIndex = -1;
          g.appendChild(c);
        }
        wrap.appendChild(g);
        const side = el('div', 'ws-side');
        side.appendChild(el('h3', null, st.theme));
        const ul = el('ul', 'ws-list');
        st.words.forEach((w) => {
          const li = el('li', w.by ? 'got ' + w.by : '', w.w);
          if (w.by) li.appendChild(el('span', 'who', w.by === 'you' ? ' ✓ You' : ' ✓ ' + ctx.name));
          ul.appendChild(li);
        });
        side.appendChild(ul);
        wrap.appendChild(side);
        body.appendChild(wrap);
        hintBtn.disabled = !mine;
        ctx.score([{ label: 'You', value: countBy('you') + ' words', cls: 'you' }, { label: ctx.name, value: countBy('npc') + ' words', cls: 'npc' }, { label: 'Left', value: left().length }]);
      }
      ctx.saveNow = () => { if (st) persist(); };
      window.addEventListener('resize', () => { if (ctx.alive()) render(); });

      if (saved) { st = restore(saved); render(); if (st.turn === 'npc') npcTurn(); else yourMsg(); }
      else { st = build(); persist(); render(); yourMsg(); ctx.say(ctx.pick(['I’m good at spotting words!', 'Let’s see who finds the most.', 'Ready, set, search!'])); }
    },
  });
})();
