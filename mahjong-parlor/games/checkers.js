/* Checkers (American rules: jumps are required, kings on the far row). */
'use strict';
(function () {
  const MP = window.MP, el = MP.el;
  // Board: 64 cells. 1 = your man, 2 = your king, -1 = challenger's man, -2 = their king, 0 = empty.
  const idx = (r, c) => r * 8 + c;
  const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function startBoard() {
    const b = new Array(64).fill(0);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) b[idx(r, c)] = -1; else if (r > 4) b[idx(r, c)] = 1;
    }
    return b;
  }
  const own = (v, side) => v * side > 0;
  const dirsFor = (v) => (Math.abs(v) === 2 ? DIRS : v > 0 ? DIRS.slice(0, 2) : DIRS.slice(2));
  const kingRow = (side) => (side > 0 ? 0 : 7);

  // All legal moves for a side. A move is { path: [[r,c],...], caps: [[r,c],...] }.
  function moves(b, side) {
    const jumps = [], steps = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const v = b[idx(r, c)];
      if (!own(v, side)) continue;
      const dfs = (rr, cc, path, caps, taken) => {
        let ext = false;
        if (!(Math.abs(v) === 1 && path.length > 1 && rr === kingRow(side))) {
          dirsFor(v).forEach((d) => {
            const mr = rr + d[0], mc = cc + d[1], lr = rr + 2 * d[0], lc = cc + 2 * d[1];
            if (!on(lr, lc)) return;
            const mv = b[idx(mr, mc)];
            if (mv === 0 || own(mv, side) || taken.has(idx(mr, mc))) return;
            if (b[idx(lr, lc)] !== 0 && !(lr === r && lc === c)) return;
            ext = true;
            taken.add(idx(mr, mc));
            dfs(lr, lc, path.concat([[lr, lc]]), caps.concat([[mr, mc]]), taken);
            taken.delete(idx(mr, mc));
          });
        }
        if (!ext && caps.length) jumps.push({ path: path, caps: caps });
      };
      dfs(r, c, [[r, c]], [], new Set());
      if (!jumps.length) {
        dirsFor(v).forEach((d) => {
          const nr = r + d[0], nc = c + d[1];
          if (on(nr, nc) && b[idx(nr, nc)] === 0) steps.push({ path: [[r, c], [nr, nc]], caps: [] });
        });
      }
    }
    return jumps.length ? jumps : steps;
  }
  function apply(b, m) {
    const n = b.slice();
    const [r0, c0] = m.path[0], [r1, c1] = m.path[m.path.length - 1];
    let v = n[idx(r0, c0)];
    n[idx(r0, c0)] = 0;
    m.caps.forEach((p) => { n[idx(p[0], p[1])] = 0; });
    if (Math.abs(v) === 1 && r1 === kingRow(Math.sign(v))) v *= 2;
    n[idx(r1, c1)] = v;
    return n;
  }
  function evaluate(b) { // from the challenger's point of view
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const v = b[idx(r, c)];
      if (!v) continue;
      const val = Math.abs(v) === 2 ? 1.6 : 1 + (v < 0 ? r : 7 - r) * 0.03;
      s += v < 0 ? val : -val;
    }
    return s;
  }
  function search(b, side, depth, alpha, beta) {
    const ms = moves(b, side);
    if (!ms.length) return side < 0 ? -100 - depth : 100 + depth;
    if (depth === 0) return evaluate(b);
    if (side < 0) {
      let best = -Infinity;
      for (const m of ms) { best = Math.max(best, search(apply(b, m), 1, depth - 1, alpha, beta)); alpha = Math.max(alpha, best); if (alpha >= beta) break; }
      return best;
    }
    let best = Infinity;
    for (const m of ms) { best = Math.min(best, search(apply(b, m), -1, depth - 1, alpha, beta)); beta = Math.min(beta, best); if (alpha >= beta) break; }
    return best;
  }
  function chooseMove(b, level) {
    const ms = moves(b, -1);
    if (Math.random() < (1 - level) * 0.3) return ms[Math.floor(Math.random() * ms.length)];
    const depth = 1 + Math.round(level * 3);
    const noise = (1 - level) * 0.6;
    let best = null, bestV = -Infinity;
    ms.forEach((m) => {
      const v = search(apply(b, m), 1, depth - 1, -Infinity, Infinity) + Math.random() * noise;
      if (v > bestV) { bestV = v; best = m; }
    });
    return best;
  }
  const count = (b, side) => b.filter((v) => own(v, side)).length;

  function restore(d) {
    const A = MP.assert;
    A(d && Array.isArray(d.board) && d.board.length === 64 && d.board.every((v) => [0, 1, 2, -1, -2].indexOf(v) >= 0));
    A(d.turn === 'you' || d.turn === 'npc');
    return { board: d.board.slice(), turn: d.turn, quiet: MP.validInt(d.quiet, 0, 500) ? d.quiet : 0 };
  }

  MP.registerGame({
    id: 'checkers', name: 'Checkers', blurb: 'The classic board game',
    icon: '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="8" y="8" width="84" height="84" fill="#f3e3c3" stroke="#333" stroke-width="3"/><g fill="#2f6b4f"><rect x="29" y="8" width="21" height="21"/><rect x="71" y="8" width="21" height="21"/><rect x="8" y="29" width="21" height="21"/><rect x="50" y="29" width="21" height="21"/><rect x="29" y="50" width="21" height="21"/><rect x="71" y="50" width="21" height="21"/><rect x="8" y="71" width="21" height="21"/><rect x="50" y="71" width="21" height="21"/></g><circle cx="39" cy="60" r="8" fill="#c3101c" stroke="#fff" stroke-width="2"/><circle cx="60" cy="39" r="8" fill="#222" stroke="#999" stroke-width="2"/><circle cx="18" cy="81" r="8" fill="#c3101c" stroke="#fff" stroke-width="2"/></svg>',
    rules: [
      'You are red, at the bottom. Pieces move one square forward on a slant, on the dark squares.',
      'Tap one of your pieces, then tap a glowing square to move there.',
      'Jump over an opponent’s piece to take it. If you can jump, you must, and you keep jumping while you can.',
      'Reach the far side to become a King 👑. Kings can move backward too.',
      'Take all of their pieces, or leave them with no moves, to win. Undo takes back your last move.',
    ],
    create(ctx, saved) {
      let st, sel = null, partial = null, busy = false, undo = [];
      const body = ctx.body;
      const undoBtn = ctx.button('↶ Undo', doUndo);

      function persist() { ctx.save({ board: st.board, turn: st.turn, quiet: st.quiet }); }
      function myMoves() { return moves(st.board, 1); }
      function yourTurn() {
        const ms = myMoves();
        if (!ms.length) { render(); ctx.end(false, ['You have no moves left.']); return; }
        ctx.msg(ms[0].caps.length ? 'You have a jump! Tap the glowing piece.' : 'Your turn: tap one of your red pieces.');
        render();
      }
      function candidates() {
        if (!sel) return [];
        return myMoves().filter((m) => m.path[0][0] === sel[0] && m.path[0][1] === sel[1] &&
          partial.every((p, i) => m.path[i] && m.path[i][0] === p[0] && m.path[i][1] === p[1]));
      }
      function tapSquare(r, c) {
        if (busy || st.turn !== 'you') return;
        const v = st.board[idx(r, c)];
        if (sel && partial.length > 1) { // in the middle of a multi-jump
          stepTo(r, c); return;
        }
        if (own(v, 1)) {
          const ms = myMoves().filter((m) => m.path[0][0] === r && m.path[0][1] === c);
          if (!ms.length) {
            ctx.sfx('blocked');
            ctx.tip(myMoves()[0].caps.length ? 'You must jump! Pick a piece that can jump.' : 'That piece can’t move right now.');
            return;
          }
          sel = [r, c]; partial = [[r, c]]; ctx.sfx('select'); render(); return;
        }
        if (sel) stepTo(r, c);
      }
      function stepTo(r, c) {
        const cands = candidates().filter((m) => m.path[partial.length] && m.path[partial.length][0] === r && m.path[partial.length][1] === c);
        if (!cands.length) { ctx.sfx('blocked'); ctx.tip('Tap one of the glowing squares.'); return; }
        if (partial.length === 1) undo.push(JSON.stringify(st));
        partial.push([r, c]);
        const full = cands.find((m) => m.path.length === partial.length);
        if (full) { finish(full); return; }
        // Show the jump so far and keep going.
        const prev = partial[partial.length - 2];
        const tmp = st.board.slice();
        const v = tmp[idx(partial[0][0], partial[0][1])];
        tmp[idx(partial[0][0], partial[0][1])] = 0;
        for (let i = 1; i < partial.length; i++) {
          const a = partial[i - 1], b = partial[i];
          tmp[idx((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)] = 0;
        }
        tmp[idx(r, c)] = v;
        ctx.sfx('match'); ctx.msg('Keep jumping! Tap the next glowing square.');
        render(tmp, prev);
      }
      function finish(m) {
        st.board = apply(st.board, m);
        st.quiet = m.caps.length ? 0 : st.quiet + 1;
        sel = null; partial = null;
        ctx.sfx(m.caps.length ? 'match' : 'select');
        if (!moves(st.board, -1).length) { render(); ctx.end(true, [count(st.board, -1) ? ctx.name + ' has no moves left.' : 'You took all of ' + ctx.name + '’s pieces!']); return; }
        if (st.quiet >= 80) { render(); ctx.end(null, ['Nobody has taken a piece in a long time.']); return; }
        st.turn = 'npc'; persist(); render(); npcTurn();
      }
      function npcTurn() {
        busy = true; ctx.msg(ctx.name + ' is thinking…'); render();
        ctx.later(() => {
          const m = chooseMove(st.board, ctx.level);
          st.board = apply(st.board, m);
          st.quiet = m.caps.length ? 0 : st.quiet + 1;
          busy = false; ctx.sfx(m.caps.length ? 'soft' : 'select');
          st.turn = 'you';
          lastNpc = m.path;
          if (!myMoves().length) { render(); ctx.end(false, ['You have no moves left.']); return; }
          if (st.quiet >= 80) { render(); ctx.end(null, ['Nobody has taken a piece in a long time.']); return; }
          persist();
          if (m.caps.length) ctx.say(m.caps.length > 1 ? 'A double jump!' : ctx.pick(['Got one!', 'Sorry about that!', 'Ooh, a jump!']));
          else if (Math.random() < 0.1) ctx.say(ctx.pick(['Your move.', 'Hmm, let’s see…', 'I like this game.']));
          yourTurn();
        }, 900);
      }
      let lastNpc = null;
      function doUndo() {
        if (busy || !undo.length) return;
        st = JSON.parse(undo.pop()); st.turn = 'you'; sel = null; partial = null; lastNpc = null;
        ctx.sfx('select'); persist(); yourTurn();
      }
      function render(boardOverride, from) {
        const b = boardOverride || st.board;
        const r = body.getBoundingClientRect();
        const size = Math.floor(Math.min(r.width, r.height) / 8) * 8;
        body.textContent = '';
        const grid = el('div', 'ck-board');
        grid.style.width = size + 'px'; grid.style.height = size + 'px';
        grid.style.left = ((r.width - size) / 2) + 'px'; grid.style.top = ((r.height - size) / 2) + 'px';
        const mine = st.turn === 'you' && !busy;
        const ms = mine ? myMoves() : [];
        const movable = new Set(ms.map((m) => idx(m.path[0][0], m.path[0][1])));
        const targets = new Set();
        if (sel) candidates().forEach((m) => { const p = m.path[partial.length]; if (p) targets.add(idx(p[0], p[1])); });
        const lastSet = new Set((lastNpc || []).map((p) => idx(p[0], p[1])));
        for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
          const dark = (rr + cc) % 2 === 1;
          const sq = el('div', 'ck-sq' + (dark ? ' dark' : ''));
          const i = idx(rr, cc);
          if (targets.has(i)) sq.classList.add('target');
          if (lastSet.has(i) && !boardOverride) sq.classList.add('last');
          const v = b[i];
          if (v) {
            const p = el('div', 'ck-pc ' + (v > 0 ? 'red' : 'blk'));
            if (Math.abs(v) === 2) p.textContent = '♛';
            if (sel && partial && partial[partial.length - 1][0] === rr && partial[partial.length - 1][1] === cc) p.classList.add('sel');
            else if (sel && !boardOverride && sel[0] === rr && sel[1] === cc) p.classList.add('sel');
            else if (!sel && movable.has(i) && ms[0].caps.length) p.classList.add('can');
            sq.appendChild(p);
          }
          if (dark) sq.addEventListener('click', () => tapSquare(rr, cc));
          grid.appendChild(sq);
        }
        body.appendChild(grid);
        undoBtn.disabled = !undo.length || busy;
        ctx.score([{ label: 'You', value: count(b, 1) + ' pieces', cls: 'you' }, { label: ctx.name, value: count(b, -1) + ' pieces', cls: 'npc' }]);
      }
      ctx.saveNow = () => { if (st) persist(); };
      window.addEventListener('resize', () => { if (ctx.alive()) render(); });

      if (saved) { st = restore(saved); if (st.turn === 'npc') npcTurn(); else yourTurn(); }
      else { st = { board: startBoard(), turn: 'you', quiet: 0 }; persist(); yourTurn(); ctx.say(ctx.pick(['You go first. Red always starts!', 'Let’s have a friendly game.', 'King me! …Someday.'])); }
    },
  });
})();
