/* Five Dice: a scorecard dice game, 13 rounds, against the challenger. */
'use strict';
(function () {
  const MP = window.MP, el = MP.el;
  const CATS = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', '3 of a kind', '4 of a kind', 'Full house', 'Small straight', 'Large straight', 'Five Dice!', 'Chance'];
  const HELP = ['', '', '', '', '', '', 'Add all dice', 'Add all dice', '25 points', '4 in a row: 30', '5 in a row: 40', 'All five the same: 50', 'Add all dice'];
  const EV = [2.1, 5.3, 8.6, 12.2, 15.7, 19.2, 21.7, 13.1, 22.6, 18, 13, 11, 22];
  const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
  function dieSVG(n) {
    const pips = n ? PIPS[n].map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#1a1a1a"/>').join('') : '<text x="50" y="66" text-anchor="middle" font-size="46" font-weight="800" fill="#999">?</text>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="16" fill="#fffdf5" stroke="#333" stroke-width="5"/>' + pips + '</svg>';
  }
  function score(cat, d) {
    const cnt = [0, 0, 0, 0, 0, 0, 0];
    d.forEach((v) => cnt[v]++);
    const sum = d.reduce((a, b) => a + b, 0), mx = Math.max.apply(null, cnt);
    const has = (arr) => arr.every((v) => cnt[v] > 0);
    if (cat < 6) return cnt[cat + 1] * (cat + 1);
    if (cat === 6) return mx >= 3 ? sum : 0;
    if (cat === 7) return mx >= 4 ? sum : 0;
    if (cat === 8) { const s = cnt.filter((x) => x).sort().join(''); return s === '23' || mx === 5 ? 25 : 0; }
    if (cat === 9) return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    if (cat === 10) return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    if (cat === 11) return mx === 5 ? 50 : 0;
    return sum;
  }
  function totals(card) {
    const upper = card.slice(0, 6).reduce((a, v) => a + (v || 0), 0);
    const bonus = upper >= 63 ? 35 : 0;
    const lower = card.slice(6).reduce((a, v) => a + (v || 0), 0);
    return { upper: upper, bonus: bonus, total: upper + bonus + lower };
  }
  const roll = () => 1 + Math.floor(Math.random() * 6);
  function catValue(cat, d) {
    const s = score(cat, d);
    let v = s - EV[cat] * 0.6;
    if (cat < 6 && s >= 3 * (cat + 1)) v += 4;
    return v;
  }
  function bestCat(card, d) {
    let best = -1, bv = -Infinity;
    card.forEach((v, c) => { if (v !== null) return; const x = catValue(c, d); if (x > bv) { bv = x; best = c; } });
    return { cat: best, v: bv };
  }
  function chooseHold(card, d, level) {
    if (Math.random() < (1 - level) * 0.5) return [0, 1, 2, 3, 4].map(() => Math.random() < 0.5);
    const N = Math.round(12 + 120 * level);
    let bestMask = 31, bestV = -Infinity;
    for (let mask = 0; mask < 32; mask++) {
      let tot = 0;
      for (let k = 0; k < N; k++) {
        const nd = d.map((v, i) => ((mask >> i) & 1 ? v : roll()));
        tot += bestCat(card, nd).v;
      }
      if (tot / N > bestV) { bestV = tot / N; bestMask = mask; }
    }
    return [0, 1, 2, 3, 4].map((i) => ((bestMask >> i) & 1) === 1);
  }

  function restore(s) {
    const A = MP.assert, cardOk = (c) => Array.isArray(c) && c.length === 13 && c.every((v) => v === null || MP.validInt(v, 0, 50));
    A(s && cardOk(s.you) && cardOk(s.npc));
    A(Array.isArray(s.dice) && s.dice.length === 5 && s.dice.every((v) => MP.validInt(v, 0, 6)));
    A(Array.isArray(s.held) && s.held.length === 5);
    A(s.turn === 'you' || s.turn === 'npc');
    return { you: s.you.slice(), npc: s.npc.slice(), dice: s.dice.slice(), held: s.held.map((h) => h === true), rolls: MP.validInt(s.rolls, 0, 3) ? s.rolls : 3, turn: s.turn };
  }

  MP.registerGame({
    id: 'dice', name: 'Five Dice', blurb: 'Roll for the best score', bubble: 'left',
    icon: '<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-12 34 56)"><rect x="12" y="34" width="44" height="44" rx="9" fill="#fffdf5" stroke="#333" stroke-width="3"/><circle cx="24" cy="46" r="4.5"/><circle cx="34" cy="56" r="4.5"/><circle cx="44" cy="66" r="4.5"/></g><g transform="rotate(10 66 40)"><rect x="44" y="18" width="44" height="44" rx="9" fill="#fffdf5" stroke="#333" stroke-width="3"/><circle cx="56" cy="30" r="4.5"/><circle cx="76" cy="30" r="4.5"/><circle cx="56" cy="50" r="4.5"/><circle cx="76" cy="50" r="4.5"/><circle cx="66" cy="40" r="4.5"/></g></svg>',
    rules: [
      'Each turn you can roll the dice up to three times.',
      'After a roll, tap any dice you want to keep. They say HELD and won’t change. Tap again to let them roll.',
      'When you’re happy, tap a row on the scorecard to score there. Each row can only be used once.',
      'Light gray numbers show what each row would score right now.',
      'Get 63 or more in Ones through Sixes for a 35-point bonus. After 13 rounds, the higher total wins.',
    ],
    create(ctx, saved) {
      let st, busy = false;
      const body = ctx.body;
      const rollBtn = ctx.button('🎲 Roll', doRoll, 'primary');

      function persist() { ctx.save({ you: st.you, npc: st.npc, dice: st.dice, held: st.held, rolls: st.rolls, turn: st.turn }); }
      function newTurn(turn) { st.turn = turn; st.dice = [0, 0, 0, 0, 0]; st.held = [false, false, false, false, false]; st.rolls = 3; }
      function yourMsg() {
        if (st.rolls === 3) ctx.msg('Your turn: tap Roll.');
        else if (st.rolls > 0) ctx.msg('Tap dice to keep them, then Roll again (' + st.rolls + ' left), or tap a row to score.');
        else ctx.msg('No rolls left. Tap a row on the scorecard to score.');
      }
      function doRoll() {
        if (busy || st.turn !== 'you' || st.rolls <= 0) return;
        st.dice = st.dice.map((v, i) => (st.held[i] && v ? v : roll()));
        st.rolls--; ctx.sfx('shuffle'); persist(); render(true); yourMsg();
      }
      function tapDie(i) {
        if (busy || st.turn !== 'you') return;
        if (st.rolls === 3) { ctx.tip('Roll first!'); return; }
        if (st.rolls === 0) { ctx.tip('No rolls left. Pick a row on the scorecard.'); return; }
        st.held[i] = !st.held[i]; ctx.sfx('select'); persist(); render();
      }
      function tapCat(c) {
        if (busy || st.turn !== 'you') return;
        if (st.rolls === 3) { ctx.tip('Roll the dice first.'); return; }
        if (st.you[c] !== null) { ctx.tip('You already used that row.'); return; }
        const s = score(c, st.dice);
        st.you[c] = s;
        ctx.sfx(s > 0 ? 'match' : 'soft');
        if (c === 11 && s === 50) ctx.say('Five of a kind! Wonderful!');
        newTurn('npc'); persist(); render(); npcTurn();
      }
      function npcTurn() {
        busy = true; render();
        ctx.msg(ctx.name + ' is rolling…');
        const step = () => {
          if (!ctx.alive()) return;
          st.dice = st.dice.map((v, i) => (st.held[i] && v ? v : roll()));
          st.rolls--; ctx.sfx('shuffle'); render(true);
          const bc = bestCat(st.npc, st.dice);
          const keepGoing = st.rolls > 0 && !(score(bc.cat, st.dice) >= 25 && bc.cat >= 8) && !(Math.random() < (1 - ctx.level) * 0.25);
          if (keepGoing) {
            st.held = chooseHold(st.npc, st.dice, ctx.level);
            if (st.held.every((h) => h)) { ctx.later(pickCat, 900); return; }
            ctx.later(() => { render(); ctx.later(step, 800); }, 700);
          } else ctx.later(pickCat, 900);
        };
        const pickCat = () => {
          let c = bestCat(st.npc, st.dice).cat;
          if (Math.random() < (1 - ctx.level) * 0.45) {
            let hi = -1;
            st.npc.forEach((v, k) => { if (v === null && (hi < 0 || score(k, st.dice) > score(hi, st.dice))) hi = k; });
            c = hi;
          }
          const s = score(c, st.dice);
          st.npc[c] = s;
          const what = ctx.name + ' scored ' + s + ' in ' + CATS[c].replace(/!$/, '') + '.';
          if (s >= 30) ctx.say(ctx.pick(['Look at that!', 'Lucky roll!', 'Oh, I like that one.']));
          busy = false;
          if (st.you.every((v) => v !== null) && st.npc.every((v) => v !== null)) {
            render();
            const a = totals(st.you).total, b = totals(st.npc).total;
            ctx.msg(what);
            ctx.end(a > b ? true : a < b ? false : null, ['Final score: you ' + a + ', ' + ctx.name + ' ' + b + '.']);
            return;
          }
          newTurn('you'); persist(); render();
          ctx.msg(what + ' Your turn: tap Roll.'); ctx.speak(what);
        };
        ctx.later(step, 900);
      }

      function render(rolled) {
        body.textContent = '';
        const wrap = el('div', 'dice-wrap');
        const left = el('div', 'dice-left');
        const row = el('div', 'dice-row');
        st.dice.forEach((v, i) => {
          const b = el('button', 'die' + (st.held[i] && v ? ' held' : '') + (rolled && !(st.held[i] && v) ? ' rolling' : ''));
          b.innerHTML = dieSVG(v);
          b.setAttribute('aria-label', v ? 'Die showing ' + v + (st.held[i] ? ', held' : '') : 'Die');
          if (st.held[i] && v) b.appendChild(el('span', 'held-tag', 'HELD'));
          b.addEventListener('click', () => tapDie(i));
          row.appendChild(b);
        });
        left.appendChild(el('p', 'dice-who', st.turn === 'you' ? 'Your dice' : ctx.name + '’s dice'));
        left.appendChild(row);
        left.appendChild(el('p', 'dice-rolls', st.turn === 'you' ? (st.rolls === 3 ? 'Ready to roll' : 'Rolls left: ' + st.rolls) : ''));
        wrap.appendChild(left);
        // scorecard
        const tbl = el('table', 'scorecard');
        const head = el('tr');
        ['', 'You', ctx.name].forEach((h) => head.appendChild(el('th', null, h)));
        tbl.appendChild(head);
        const mine = st.turn === 'you' && !busy && st.rolls < 3;
        const addRow = (label, a, b, cls, c) => {
          const tr = el('tr', cls || '');
          const th = el('th', 'cat');
          th.appendChild(el('span', null, label));
          if (c !== undefined && HELP[c]) th.appendChild(el('small', null, HELP[c]));
          tr.appendChild(th);
          const ta = el('td', 'you'), tb = el('td', 'npc');
          if (c !== undefined && a === null) {
            if (mine) { ta.textContent = String(score(c, st.dice)); ta.classList.add('preview'); tr.classList.add('open'); tr.addEventListener('click', () => tapCat(c)); }
            else ta.textContent = '';
          } else ta.textContent = a === null ? '' : String(a);
          tb.textContent = b === null ? '' : String(b);
          tr.appendChild(ta); tr.appendChild(tb); tbl.appendChild(tr);
        };
        for (let c = 0; c < 6; c++) addRow(CATS[c], st.you[c], st.npc[c], '', c);
        const tu = totals(st.you), tn = totals(st.npc);
        addRow('Bonus (63+)', tu.upper >= 63 ? 35 : tu.upper + '/63', tn.upper >= 63 ? 35 : tn.upper + '/63', 'sub');
        for (let c = 6; c < 13; c++) addRow(CATS[c], st.you[c], st.npc[c], '', c);
        addRow('Total', tu.total, tn.total, 'total');
        const scroll = el('div', 'dice-card'); scroll.appendChild(tbl);
        wrap.appendChild(scroll);
        body.appendChild(wrap);
        rollBtn.disabled = !(st.turn === 'you' && !busy && st.rolls > 0);
        rollBtn.textContent = st.rolls === 3 || st.turn !== 'you' ? '🎲 Roll' : '🎲 Roll again (' + st.rolls + ' left)';
        rollBtn.classList.toggle('pulse', st.turn === 'you' && !busy && st.rolls === 3);
        const round = Math.min(13, st.you.filter((v) => v !== null).length + (st.turn === 'you' ? 1 : 0));
        ctx.score([{ label: 'Round', value: round + ' of 13' }, { label: 'You', value: tu.total, cls: 'you' }, { label: ctx.name, value: tn.total, cls: 'npc' }]);
      }
      ctx.saveNow = () => { if (st) persist(); };

      if (saved) { st = restore(saved); render(); if (st.turn === 'npc') { newTurn('npc'); npcTurn(); } else yourMsg(); }
      else {
        st = { you: new Array(13).fill(null), npc: new Array(13).fill(null) };
        newTurn('you'); persist(); render(); yourMsg();
        ctx.say(ctx.pick(['Feeling lucky?', 'Let’s roll!', 'May the best dice win.']));
      }
    },
  });
})();
