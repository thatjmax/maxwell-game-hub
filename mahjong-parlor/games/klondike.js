/* Klondike solitaire (draw one). Deals are checked with a solver so every game can be won. */
'use strict';
(function () {
  const MP = window.MP, C = MP.cards, el = MP.el;
  const suit = C.suit, rank = C.rank, red = C.isRed;

  // ---------- Solver (draw-1, unlimited passes: any stock/waste card is reachable) ----------
  function solve(init, budget) {
    let nodes = 0;
    const seen = new Set();
    const canF = (s, c) => s.f[suit(c)] === rank(c) - 1;
    const safeF = (s, c) => {
      const r = rank(c);
      if (r <= 2) return true;
      const opp = red(c) ? [0, 3] : [1, 2];
      return s.f[opp[0]] >= r - 1 && s.f[opp[1]] >= r - 1;
    };
    const fits = (s, c, j) => {
      const u = s.u[j];
      if (u.length) { const t = u[u.length - 1]; return red(t) !== red(c) && rank(t) === rank(c) + 1; }
      return s.d[j].length === 0 && rank(c) === 13;
    };
    const fix = (s, i) => { if (!s.u[i].length && s.d[i].length) s.u[i].push(s.d[i].pop()); };
    const clone = (s) => ({ f: s.f.slice(), t: s.t.slice(), d: s.d.map((x) => x.slice()), u: s.u.map((x) => x.slice()) });
    const key = (s) => s.f.join(',') + '|' + s.t.slice().sort((a, b) => a - b).join(',') + '|' + s.d.map((d, i) => d.length + ':' + s.u[i].join('.')).join('/');
    function auto(s) {
      let n = 0, ch = true;
      while (ch) {
        ch = false;
        for (let i = 0; i < 7; i++) {
          const u = s.u[i], c = u[u.length - 1];
          if (c !== undefined && canF(s, c) && safeF(s, c)) { u.pop(); s.f[suit(c)]++; fix(s, i); n++; ch = true; }
        }
        for (let k = 0; k < s.t.length; k++) {
          const c = s.t[k];
          if (canF(s, c) && safeF(s, c)) { s.t.splice(k, 1); s.f[suit(c)]++; n++; ch = true; k--; }
        }
      }
      return n;
    }
    function gen(s) {
      const m = [];
      for (let i = 0; i < 7; i++) { const u = s.u[i], c = u[u.length - 1]; if (c !== undefined && canF(s, c)) m.push({ t: 'tf', i: i }); }
      for (let i = 0; i < 7; i++) {
        if (!s.u[i].length || !s.d[i].length) continue;
        const c = s.u[i][0];
        for (let j = 0; j < 7; j++) if (j !== i && fits(s, c, j)) { m.push({ t: 'tt', i: i, k: 0, j: j }); break; }
      }
      s.t.forEach((c) => { for (let j = 0; j < 7; j++) if (fits(s, c, j)) { m.push({ t: 'Tt', c: c, j: j }); break; } });
      s.t.forEach((c) => { if (canF(s, c)) m.push({ t: 'Tf', c: c }); });
      for (let i = 0; i < 7; i++) {
        for (let k = 1; k < s.u[i].length; k++) {
          if (!canF(s, s.u[i][k - 1])) continue;
          const c = s.u[i][k];
          for (let j = 0; j < 7; j++) if (j !== i && fits(s, c, j)) { m.push({ t: 'tt', i: i, k: k, j: j }); break; }
        }
      }
      return m;
    }
    function apply(s, mv) {
      if (mv.t === 'tf') { const c = s.u[mv.i].pop(); s.f[suit(c)]++; fix(s, mv.i); }
      else if (mv.t === 'tt') { const run = s.u[mv.i].splice(mv.k); s.u[mv.j].push.apply(s.u[mv.j], run); fix(s, mv.i); }
      else if (mv.t === 'Tt') { s.t.splice(s.t.indexOf(mv.c), 1); s.u[mv.j].push(mv.c); }
      else if (mv.t === 'Tf') { s.t.splice(s.t.indexOf(mv.c), 1); s.f[suit(mv.c)]++; }
    }
    function dfs(s, depth) {
      if (++nodes > budget) return -1;
      const a = auto(s);
      if (s.f.every((x) => x === 13)) return depth + a;
      const k = key(s);
      if (seen.has(k)) return -1;
      seen.add(k);
      const ms = gen(s);
      for (let i = 0; i < ms.length; i++) {
        const n = clone(s); apply(n, ms[i]);
        const r = dfs(n, depth + a + 1);
        if (r >= 0) return r;
        if (nodes > budget) return -1;
      }
      return -1;
    }
    return dfs(clone(init), 0);
  }

  function dealCards() {
    const deck = MP.shuffle(Array.from({ length: 52 }, (_, i) => i));
    const tab = [];
    let p = 0;
    for (let i = 0; i < 7; i++) { const col = []; for (let k = 0; k <= i; k++) col.push({ c: deck[p++], u: k === i }); tab.push(col); }
    return { stock: deck.slice(p), waste: [], found: [[], [], [], []], tab: tab };
  }
  function toSolver(st) {
    return {
      f: st.found.map((f) => f.length), t: st.stock.concat(st.waste),
      d: st.tab.map((col) => col.filter((x) => !x.u).map((x) => x.c)), u: st.tab.map((col) => col.filter((x) => x.u).map((x) => x.c)),
    };
  }

  function restore(d) {
    const A = MP.assert, ok = (c) => MP.validInt(c, 0, 51);
    A(d && Array.isArray(d.stock) && Array.isArray(d.waste) && Array.isArray(d.found) && d.found.length === 4 && Array.isArray(d.tab) && d.tab.length === 7);
    const all = [];
    d.stock.forEach((c) => { A(ok(c)); all.push(c); });
    d.waste.forEach((c) => { A(ok(c)); all.push(c); });
    d.found.forEach((f, s) => { A(Array.isArray(f)); f.forEach((c, i) => { A(ok(c) && suit(c) === s && rank(c) === i + 1); all.push(c); }); });
    const tab = d.tab.map((col) => { A(Array.isArray(col)); return col.map((x) => { A(x && ok(x.c)); all.push(x.c); return { c: x.c, u: x.u === true }; }); });
    A(new Set(all).size === 52 && all.length === 52);
    return {
      stock: d.stock.slice(), waste: d.waste.slice(), found: d.found.map((f) => f.slice()), tab: tab,
      acts: MP.validInt(d.acts, 0, 1e6) ? d.acts : 0, target: Math.max(60, Math.min(600, Number(d.target) || 160)),
      lost: d.lost === true,
    };
  }

  MP.registerGame({
    id: 'klondike', name: 'Solitaire', blurb: 'Classic Klondike patience',
    icon: '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="14" y="16" width="44" height="62" rx="6" fill="#fff" stroke="#333" stroke-width="3" transform="rotate(-10 36 47)"/><rect x="40" y="18" width="44" height="62" rx="6" fill="#fff" stroke="#333" stroke-width="3" transform="rotate(8 62 49)"/><text x="64" y="62" text-anchor="middle" font-size="34" fill="#c3101c" transform="rotate(8 62 49)">♥</text><text x="30" y="58" text-anchor="middle" font-size="30" fill="#111" transform="rotate(-10 36 47)">♠</text></svg>',
    rules: [
      'Move all 52 cards up to the four piles at the top right, one pile per suit, from Ace up to King.',
      'In the seven columns, put a card on one that is one higher and the other color. For example, a red 6 on a black 7.',
      'Just tap a card. It moves to the best spot by itself.',
      'Tap the deck at the top left to turn over a new card. When it runs out, tap it again to start over.',
      'Only a King can go in an empty column.',
      'Every game can be won. Each Hint or Undo lets your challenger catch up a little.',
    ],
    create(ctx, saved) {
      let st = null, undo = [], glow = null, finishing = false;
      const body = ctx.body;
      const levelRate = 0.6 + 0.3 * ctx.level; // how efficient the challenger is
      const undoBtn = ctx.button('↶ Undo', doUndo);
      const hintBtn = ctx.button('💡 Hint', doHint);
      const finishBtn = ctx.button('✨ Finish', autoFinish, 'primary');
      finishBtn.classList.add('hidden');

      function homeCount() { return st.found.reduce((a, f) => a + f.length, 0); }
      function npcCount() { return Math.min(52, Math.floor(st.acts * 52 * levelRate / st.target)); }
      function persist() { ctx.save({ stock: st.stock, waste: st.waste, found: st.found, tab: st.tab, acts: st.acts, target: st.target, lost: st.lost }); }
      function updateScore() {
        ctx.score([{ label: 'You', value: homeCount() + ' of 52 home', cls: 'you' }, { label: ctx.name, value: npcCount() + ' of 52', cls: 'npc' }]);
        undoBtn.disabled = !undo.length;
      }
      function newDeal(first) {
        body.textContent = '';
        ctx.msg('Shuffling the cards…');
        ctx.later(() => {
          let best = null;
          for (let tries = 0; tries < 14; tries++) {
            const d = dealCards();
            const n = solve(toSolver(d), 12000);
            if (n >= 0) { best = { d: d, n: n }; break; }
            if (!best) best = { d: d, n: 110 };
          }
          st = best.d;
          st.acts = 0; st.lost = false;
          st.target = Math.round(best.n * 1.25 + 30); // expected taps, including turning the deck
          undo = []; glow = null;
          ctx.msg(first ? 'Tap a card to move it. Tap the deck to turn over a new card.' : null);
          persist(); render();
          if (first) ctx.say(ctx.pick(['Let’s see who finishes first!', 'Good luck!', 'I love a good game of cards.']));
        }, 60);
      }

      // ---------- moves ----------
      const canF = (c) => st.found[suit(c)].length === rank(c) - 1;
      function fitsCol(c, j) {
        const col = st.tab[j];
        if (!col.length) return rank(c) === 13;
        const t = col[col.length - 1];
        return t.u && red(t.c) !== red(c) && rank(t.c) === rank(c) + 1;
      }
      function snapshot() { undo.push(JSON.stringify({ stock: st.stock, waste: st.waste, found: st.found, tab: st.tab })); if (undo.length > 300) undo.shift(); }
      function flipTops() { st.tab.forEach((col) => { if (col.length && !col[col.length - 1].u) col[col.length - 1].u = true; }); }
      function act() {
        st.acts++; glow = null;
        flipTops();
        afterMove();
      }
      function tapStock() {
        snapshot();
        if (st.stock.length) st.waste.push(st.stock.pop());
        else if (st.waste.length) { st.stock = st.waste.reverse(); st.waste = []; }
        else { undo.pop(); return; }
        ctx.sfx('select'); act();
      }
      // Move the card (and any cards on top of it) to the best place.
      // Forgiving taps: if the tapped card can't move, try the other face-up cards in that column.
      function tryMove(src) {
        let plan = planMove(src);
        if (!plan && src.from === 'tab') {
          const col = st.tab[src.i];
          for (let k = 0; k < col.length && !plan; k++) if (col[k].u && k !== src.k) plan = planMove({ from: 'tab', i: src.i, k: k });
        }
        if (!plan) { ctx.sfx('blocked'); ctx.tip('That card can’t move right now.'); return; }
        const p = plan;
        snapshot();
        if (p.src.from === 'waste') st.waste.pop();
        else if (p.src.from === 'found') st.found[p.src.i].pop();
        else st.tab[p.src.i].splice(p.src.k);
        if (p.dest.to === 'found') st.found[suit(p.card)].push(p.card);
        else p.run.forEach((c) => st.tab[p.dest.j].push({ c: c, u: true }));
        ctx.sfx(p.dest.to === 'found' ? 'match' : 'select');
        act();
      }
      function planMove(src) {
        let card, run;
        if (src.from === 'waste') { card = st.waste[st.waste.length - 1]; run = [card]; }
        else if (src.from === 'found') { card = st.found[src.i][st.found[src.i].length - 1]; run = [card]; }
        else { const col = st.tab[src.i]; run = col.slice(src.k).map((x) => x.c); card = run[0]; }
        const single = run.length === 1;
        let dest = null;
        if (single && src.from !== 'found' && canF(card)) dest = { to: 'found' };
        if (!dest) {
          const fromEmptyBase = src.from === 'tab' && src.k === 0;
          const cands = [];
          for (let j = 0; j < 7; j++) {
            if (src.from === 'tab' && j === src.i) continue;
            if (!fitsCol(card, j)) continue;
            if (!st.tab[j].length && fromEmptyBase) continue; // pointless: King already at the bottom
            cands.push(j);
          }
          cands.sort((a, b) => (st.tab[b].length ? 1 : 0) - (st.tab[a].length ? 1 : 0));
          if (cands.length) dest = { to: 'tab', j: cands[0] };
        }
        return dest ? { src: src, dest: dest, run: run, card: card } : null;
      }
      function anyMove() {
        for (let i = 0; i < 7; i++) {
          const col = st.tab[i];
          if (!col.length) continue;
          const top = col[col.length - 1];
          if (canF(top.c)) return { glowCard: top.c };
          const k = col.findIndex((x) => x.u);
          for (let j = 0; j < 7; j++) {
            if (j === i || !fitsCol(col[k].c, j)) continue;
            if (k > 0 || st.tab[j].length) return { glowCard: col[k].c };
          }
        }
        const w = st.waste[st.waste.length - 1];
        if (w !== undefined) {
          if (canF(w)) return { glowCard: w };
          for (let j = 0; j < 7; j++) if (fitsCol(w, j)) return { glowCard: w };
        }
        const talon = st.stock.concat(st.waste);
        for (const c of talon) {
          if (canF(c)) return { glowStock: true };
          for (let j = 0; j < 7; j++) if (fitsCol(c, j)) return { glowStock: true };
        }
        return null;
      }
      function doHint() {
        const m = anyMove();
        if (!m) { checkStuck(); return; }
        st.acts++;
        glow = m.glowCard !== undefined ? m.glowCard : 'stock';
        ctx.tip(glow === 'stock' ? 'Tap the deck to turn over a new card.' : 'Tap the glowing card.');
        ctx.sfx('select'); persist(); render(); checkNpc();
      }
      function doUndo() {
        if (!undo.length) return;
        const p = JSON.parse(undo.pop());
        st.stock = p.stock; st.waste = p.waste; st.found = p.found; st.tab = p.tab;
        st.acts++; glow = null; ctx.sfx('select');
        persist(); render(); checkNpc();
      }
      function canFinish() { return !st.stock.length && !st.waste.length && st.tab.every((col) => col.every((x) => x.u)); }
      function autoFinish() {
        if (finishing) return;
        finishing = true; st.acts++;
        const step = () => {
          if (!ctx.alive()) return;
          for (let i = 0; i < 7; i++) {
            const col = st.tab[i];
            if (col.length && canF(col[col.length - 1].c)) {
              const c = col.pop().c; st.found[suit(c)].push(c); ctx.sfx('select'); render();
              if (homeCount() === 52) { finishing = false; afterMove(); return; }
              ctx.later(step, 110); return;
            }
          }
          finishing = false; afterMove();
        };
        step();
      }
      function checkNpc() {
        updateScore();
        if (!st.lost && npcCount() >= 52 && homeCount() < 52) {
          st.lost = true; persist();
          ctx.msg(ctx.name + ' finished first this time. Keep going and finish your cards!');
          ctx.sfx('soft');
        }
      }
      function afterMove() {
        if (homeCount() === 52) {
          render();
          ctx.end(!st.lost, st.lost ? ['You finished your cards too. Nice work!'] : ['All 52 cards are home!']);
          return;
        }
        persist(); render(); checkNpc();
        if (!st.lost) {
          const h = homeCount();
          if (h >= 26 && npcCount() < h && Math.random() < 0.08) ctx.say(ctx.pick(['You’re quick with these cards!', 'My, you’re doing well.']));
          else if (npcCount() > h + 6 && Math.random() < 0.1) ctx.say(ctx.pick(['My cards are falling right into place!', 'Better hurry!']));
        }
        checkStuck();
      }
      function checkStuck() {
        if (anyMove() || homeCount() === 52) return;
        if (st.lost) { ctx.end(false, ['No more moves were left on this deal.']); return; }
        ctx.modal({
          title: 'No more moves', lines: ['This deal got stuck. Let’s deal a new one.', 'It won’t count against you.'],
          say: 'No more moves. Let’s deal a new one.',
          buttons: [{ label: 'Deal again', primary: true, onClick: () => newDeal(false) }],
        });
      }

      // ---------- drawing ----------
      function render() {
        if (!st) return;
        const r = body.getBoundingClientRect();
        const W = r.width, H = r.height;
        let cw = Math.min((W - 8 * 10) / 7, H / 4.2, 120);
        const ch = cw * 1.4;
        const gap = (W - 7 * cw) / 8;
        body.textContent = '';
        body.style.setProperty('--cw', cw + 'px');
        const x = (i) => gap + i * (cw + gap);
        const topY = 4;
        finishBtn.classList.toggle('hidden', !canFinish());
        // stock
        if (st.stock.length) {
          const s = C.el(0, false); s.style.left = x(0) + 'px'; s.style.top = topY + 'px';
          if (glow === 'stock') s.classList.add('glow');
          s.addEventListener('click', tapStock); s.setAttribute('aria-label', 'Deck: tap to turn over a card'); body.appendChild(s);
        } else {
          const s = el('div', 'pslot' + (glow === 'stock' ? ' glow' : ''), st.waste.length ? '↻' : '');
          s.style.left = x(0) + 'px'; s.style.top = topY + 'px'; s.addEventListener('click', tapStock); body.appendChild(s);
        }
        // waste (top card)
        if (st.waste.length) {
          const c = st.waste[st.waste.length - 1];
          const w = C.el(c, true); w.style.left = x(1) + 'px'; w.style.top = topY + 'px';
          if (glow === c) w.classList.add('glow');
          w.addEventListener('click', () => tryMove({ from: 'waste' })); body.appendChild(w);
        } else { const s = el('div', 'pslot'); s.style.left = x(1) + 'px'; s.style.top = topY + 'px'; body.appendChild(s); }
        // foundations
        for (let i = 0; i < 4; i++) {
          const f = st.found[i];
          if (f.length) {
            const d = C.el(f[f.length - 1], true); d.style.left = x(3 + i) + 'px'; d.style.top = topY + 'px';
            d.addEventListener('click', () => tryMove({ from: 'found', i: i })); body.appendChild(d);
          } else {
            const s = el('div', 'pslot', C.SUIT_SYM[i]); s.style.left = x(3 + i) + 'px'; s.style.top = topY + 'px'; body.appendChild(s);
          }
        }
        // tableau
        const tabTop = topY + ch + Math.max(12, gap);
        const avail = H - tabTop - ch - 6;
        st.tab.forEach((col, i) => {
          if (!col.length) {
            const s = el('div', 'pslot', 'K'); s.style.left = x(i) + 'px'; s.style.top = tabTop + 'px'; body.appendChild(s); return;
          }
          const nDown = col.filter((q) => !q.u).length, nUp = col.length - nDown;
          let dDown = ch * 0.14, dUp = ch * 0.3;
          const need = nDown * dDown + Math.max(0, nUp - 1) * dUp;
          if (need > avail && need > 0) { const k = avail / need; dDown *= k; dUp *= k; }
          let y = tabTop;
          col.forEach((q, k) => {
            const d = C.el(q.c, q.u);
            d.style.left = x(i) + 'px'; d.style.top = y + 'px';
            if (q.u) {
              if (glow === q.c) d.classList.add('glow');
              d.addEventListener('click', () => tryMove({ from: 'tab', i: i, k: k }));
            } else {
              d.addEventListener('click', () => { ctx.sfx('blocked'); ctx.tip('That card is face down. Move the cards on top of it first.'); });
            }
            body.appendChild(d);
            y += q.u ? dUp : dDown;
          });
        });
        updateScore();
      }
      ctx.saveNow = () => { if (st) persist(); };
      window.addEventListener('resize', () => { if (ctx.alive()) render(); });

      if (saved) {
        st = restore(saved);
        render(); checkNpc();
        if (st.lost) ctx.msg(ctx.name + ' finished first this time. Keep going and finish your cards!');
        ctx.later(checkStuck, 300);
      } else newDeal(true);
    },
  });
})();
