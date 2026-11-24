/* Draw dominoes (double-six). First to play all their tiles wins. */
'use strict';
(function () {
  const MP = window.MP, el = MP.el;
  const PIPS = {
    0: [], 1: [[50, 50]], 2: [[25, 25], [75, 75]], 3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]], 5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
  };
  function half(n, ox, oy) { return PIPS[n].map((p) => '<circle cx="' + (ox + p[0]) + '" cy="' + (oy + p[1]) + '" r="10" fill="#1a1a1a"/>').join(''); }
  // a and b are integers 0-6 (validated), so this markup holds no outside text.
  function tileSVG(a, b, vertical) {
    if (vertical) {
      return '<svg viewBox="0 0 100 200" aria-hidden="true"><rect x="3" y="3" width="94" height="194" rx="12" fill="#fffdf5" stroke="#333" stroke-width="5"/><line x1="12" y1="100" x2="88" y2="100" stroke="#333" stroke-width="4"/>' + half(a, 0, 0) + half(b, 0, 100) + '</svg>';
    }
    return '<svg viewBox="0 0 200 100" aria-hidden="true"><rect x="3" y="3" width="194" height="94" rx="12" fill="#fffdf5" stroke="#333" stroke-width="5"/><line x1="100" y1="12" x2="100" y2="88" stroke="#333" stroke-width="4"/>' + half(a, 0, 0) + half(b, 100, 0) + '</svg>';
  }
  const sum = (h) => h.reduce((a, t) => a + t[0] + t[1], 0);

  function restore(d) {
    const A = MP.assert, ok = (t) => Array.isArray(t) && t.length === 2 && MP.validInt(t[0], 0, 6) && MP.validInt(t[1], 0, 6);
    A(d && ['you', 'npc', 'bone', 'chain'].every((k) => Array.isArray(d[k]) && d[k].every(ok)));
    const keys = d.you.concat(d.npc, d.bone, d.chain).map((t) => Math.min(t[0], t[1]) + '-' + Math.max(t[0], t[1]));
    A(keys.length === 28 && new Set(keys).size === 28);
    for (let i = 1; i < d.chain.length; i++) A(d.chain[i - 1][1] === d.chain[i][0]);
    A(d.turn === 'you' || d.turn === 'npc');
    const cp = (a) => a.map((t) => [t[0], t[1]]);
    return { you: cp(d.you), npc: cp(d.npc), bone: cp(d.bone), chain: cp(d.chain), turn: d.turn, passes: MP.validInt(d.passes, 0, 2) ? d.passes : 0 };
  }

  MP.registerGame({
    id: 'dominoes', name: 'Dominoes', blurb: 'Match the numbers',
    icon: '<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-20 50 50)"><rect x="10" y="30" width="80" height="40" rx="6" fill="#fffdf5" stroke="#333" stroke-width="3"/><line x1="50" y1="34" x2="50" y2="66" stroke="#333" stroke-width="3"/><circle cx="22" cy="40" r="4"/><circle cx="30" cy="50" r="4"/><circle cx="38" cy="60" r="4"/><circle cx="62" cy="40" r="4"/><circle cx="78" cy="40" r="4"/><circle cx="62" cy="60" r="4"/><circle cx="78" cy="60" r="4"/></g></svg>',
    rules: [
      'Take turns adding a domino to either end of the line on the table.',
      'The number on your domino must match the number at that end.',
      'Dominoes you can play are bright. Just tap one to play it.',
      'If you can’t play, tap Draw to take a new domino from the pile. If the pile is empty, you pass.',
      'The first player to use up all their dominoes wins. If nobody can play, the lowest total of dots wins.',
    ],
    create(ctx, saved) {
      let st, busy = false;
      const body = ctx.body;
      const drawBtn = ctx.button('Draw a domino', doDraw, 'primary');
      const passBtn = ctx.button('Pass', doPass);

      function persist() { ctx.save({ you: st.you, npc: st.npc, bone: st.bone, chain: st.chain, turn: st.turn, passes: st.passes }); }
      function deal() {
        const all = [];
        for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push([a, b]);
        MP.shuffle(all);
        st = { you: all.slice(0, 7), npc: all.slice(7, 14), bone: all.slice(14), chain: [], turn: 'you', passes: 0 };
        persist();
      }
      const ends = () => (st.chain.length ? [st.chain[0][0], st.chain[st.chain.length - 1][1]] : null);
      function sides(t) {
        const e = ends();
        if (!e) return ['R'];
        const s = [];
        if (t[0] === e[0] || t[1] === e[0]) s.push('L');
        if (t[0] === e[1] || t[1] === e[1]) s.push('R');
        if (s.length === 2 && e[0] === e[1]) return ['R'];
        return s;
      }
      function place(t, side) {
        const e = ends();
        if (!e) { st.chain.push([t[0], t[1]]); return; }
        if (side === 'L') st.chain.unshift(t[1] === e[0] ? [t[0], t[1]] : [t[1], t[0]]);
        else st.chain.push(t[0] === e[1] ? [t[0], t[1]] : [t[1], t[0]]);
      }
      const canPlay = (hand) => hand.some((t) => sides(t).length > 0);

      function yourTurnMsg() {
        if (canPlay(st.you)) ctx.msg(st.chain.length ? 'Your turn: tap a bright domino to play it.' : 'You go first: tap any domino to start.');
        else if (st.bone.length) ctx.msg('You can’t play yet. Tap “Draw a domino”.');
        else ctx.msg('You can’t play and the pile is empty. Tap Pass.');
      }
      function playYours(t, side) {
        st.you = st.you.filter((x) => x !== t);
        place(t, side); st.passes = 0; ctx.sfx('match');
        if (!st.you.length) { render(); ctx.end(true, ['You played all your dominoes!']); return; }
        st.turn = 'npc'; persist(); render(); npcTurn();
      }
      function tapTile(t) {
        if (busy || st.turn !== 'you') return;
        const s = sides(t);
        if (!s.length) { ctx.sfx('blocked'); const e = ends(); ctx.tip('That one doesn’t match. The ends are ' + e[0] + ' and ' + e[1] + '.'); return; }
        if (s.length === 1) { playYours(t, s[0]); return; }
        const e = ends();
        ctx.modal({
          title: 'Which end?', lines: ['This domino fits at both ends.'],
          buttons: [{ label: '◀ Left end (' + e[0] + ')', primary: true, onClick: () => playYours(t, 'L') }, { label: 'Right end (' + e[1] + ') ▶', primary: true, onClick: () => playYours(t, 'R') }],
        });
      }
      function doDraw() {
        if (busy || st.turn !== 'you' || canPlay(st.you) || !st.bone.length) return;
        st.you.push(st.bone.pop()); ctx.sfx('select'); persist(); render(); yourTurnMsg();
      }
      function doPass() {
        if (busy || st.turn !== 'you' || canPlay(st.you) || st.bone.length) return;
        st.passes++;
        if (st.passes >= 2) { blocked(); return; }
        st.turn = 'npc'; persist(); render(); npcTurn();
      }
      function blocked() {
        const a = sum(st.you), b = sum(st.npc);
        render();
        const lines = ['Nobody can play. You have ' + a + ' dots left; ' + ctx.name + ' has ' + b + '.'];
        ctx.end(a < b ? true : a > b ? false : null, lines);
      }
      function npcTurn() {
        busy = true; render(); ctx.msg(ctx.name + ' is thinking…');
        ctx.later(() => {
          let drew = 0;
          while (!canPlay(st.npc) && st.bone.length) { st.npc.push(st.bone.pop()); drew++; }
          const opts = st.npc.filter((t) => sides(t).length);
          if (!opts.length) {
            st.passes++;
            if (st.passes >= 2) { busy = false; blocked(); return; }
            busy = false; st.turn = 'you'; persist(); render();
            ctx.msg(ctx.name + (drew ? ' drew ' + drew + ' and' : '') + ' couldn’t play, so they pass. Your turn!');
            return;
          }
          let t;
          const sty = (ctx.style && ctx.style.dom) || 'heavy';
          const valueOf = (x) => {
            const pips = x[0] + x[1];
            if (sty === 'doubles') return (x[0] === x[1] ? 20 : 0) + pips;
            if (sty === 'block') {
              // Prefer leaving ends that match the challenger's own remaining dominoes.
              const rest = st.npc.filter((y) => y !== x);
              const e = ends(), newEnd = !e ? x[1] : (x[0] === e[1] || x[0] === e[0] ? x[1] : x[0]);
              return rest.filter((y) => y[0] === newEnd || y[1] === newEnd).length * 4 + pips * 0.3;
            }
            return pips + (x[0] === x[1] ? 3 : 0);
          };
          if (Math.random() < 0.3 + 0.7 * ctx.level) { opts.sort((x, y) => valueOf(y) - valueOf(x)); t = opts[0]; }
          else t = ctx.pick(opts);
          const s = sides(t);
          const side = s.length === 2 && Math.random() < 0.5 ? 'L' : s[s.length - 1];
          st.npc = st.npc.filter((x) => x !== t);
          place(t, side); st.passes = 0; ctx.sfx('select');
          busy = false;
          if (!st.npc.length) { render(); ctx.end(false, [ctx.name + ' played their last domino.']); return; }
          st.turn = 'you'; persist(); render();
          const what = ctx.name + (drew ? ' drew ' + drew + (drew > 1 ? ' dominoes' : ' domino') + ', then' : '') + ' played ' + t[0] + '–' + t[1] + '.';
          ctx.msg(what + ' ' + (canPlay(st.you) ? 'Your turn!' : st.bone.length ? 'Your turn: tap Draw.' : 'Your turn: tap Pass.'));
          ctx.speak(what);
          if (st.npc.length === 1) ctx.say('Just one domino left!');
          else if (Math.random() < 0.12) ctx.say(ctx.pick(['Your move!', 'Ooh, that fit nicely.', 'Let’s see what you’ve got.']));
        }, 1300);
      }

      function render() {
        const r = body.getBoundingClientRect(), W = r.width, H = r.height;
        body.textContent = '';
        // challenger's dominoes (backs)
        const top = el('div', 'dom-npc');
        st.npc.forEach(() => top.appendChild(el('span', 'dom-back')));
        top.appendChild(el('span', 'dom-count', ctx.name + ': ' + st.npc.length + ' left  ·  Pile: ' + st.bone.length));
        body.appendChild(top);
        // the line on the table
        const line = el('div', 'dom-line');
        const n = st.chain.length;
        const unit = Math.max(26, Math.min(56, Math.sqrt((W * H * 0.4) / Math.max(1, n * 2.6))));
        line.style.setProperty('--du', unit + 'px');
        if (!n) line.appendChild(el('div', 'dom-empty', 'The table is empty'));
        st.chain.forEach((t, i) => {
          const dbl = t[0] === t[1];
          const d = el('div', 'dom-tile' + (dbl ? ' dbl' : '') + (i === 0 || i === n - 1 ? ' end' : ''));
          d.innerHTML = tileSVG(t[0], t[1], dbl);
          line.appendChild(d);
        });
        body.appendChild(line);
        const e = ends();
        if (e) {
          const lab = el('div', 'dom-ends', 'Left end: ' + e[0] + '     Right end: ' + e[1]);
          body.appendChild(lab);
        }
        // your hand
        const hand = el('div', 'dom-hand');
        const hu = Math.min(70, (W - 40) / (st.you.length * 2.3));
        hand.style.setProperty('--du', hu + 'px');
        const mine = st.turn === 'you' && !busy;
        st.you.forEach((t) => {
          const ok = mine && sides(t).length > 0;
          const d = el('button', 'dom-tile mine' + (ok ? ' ok' : ' no'));
          d.innerHTML = tileSVG(t[0], t[1], false);
          d.setAttribute('aria-label', t[0] + ' and ' + t[1]);
          d.addEventListener('click', () => tapTile(t));
          hand.appendChild(d);
        });
        body.appendChild(hand);
        const canDraw = mine && !canPlay(st.you) && st.bone.length > 0;
        const canPass = mine && !canPlay(st.you) && !st.bone.length;
        drawBtn.disabled = !canDraw; drawBtn.classList.toggle('pulse', canDraw);
        passBtn.disabled = !canPass; passBtn.classList.toggle('pulse', canPass);
        ctx.score([{ label: 'You', value: st.you.length + ' left', cls: 'you' }, { label: ctx.name, value: st.npc.length + ' left', cls: 'npc' }]);
      }
      ctx.saveNow = () => { if (st) persist(); };
      window.addEventListener('resize', () => { if (ctx.alive()) render(); });

      if (saved) { st = restore(saved); render(); if (st.turn === 'npc') npcTurn(); else yourTurnMsg(); }
      else { deal(); render(); yourTurnMsg(); ctx.say(ctx.pick(['Shuffle, shuffle… let’s play!', 'You go first.', 'I love the clack of dominoes.'])); }
    },
  });
})();
