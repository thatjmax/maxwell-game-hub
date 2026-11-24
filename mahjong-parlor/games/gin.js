/* Gin Rummy: one hand against the challenger. Melds are found automatically. */
'use strict';
(function () {
  const MP = window.MP, C = MP.cards, el = MP.el;
  const suit = C.suit, rank = C.rank;
  const value = (c) => Math.min(10, rank(c));

  // Best way to arrange a hand into melds, with the least deadwood.
  function bestMelds(hand) {
    const melds = [];
    for (let r = 1; r <= 13; r++) {
      const cs = hand.filter((c) => rank(c) === r);
      if (cs.length >= 3) {
        melds.push(cs.slice());
        if (cs.length === 4) for (let i = 0; i < 4; i++) melds.push(cs.filter((_, k) => k !== i));
      }
    }
    for (let s = 0; s < 4; s++) {
      const cs = hand.filter((c) => suit(c) === s).sort((a, b) => rank(a) - rank(b));
      let seg = [];
      const flush = () => {
        for (let i = 0; i < seg.length; i++) for (let j = i + 2; j < seg.length; j++) melds.push(seg.slice(i, j + 1));
      };
      cs.forEach((c) => {
        if (seg.length && rank(c) === rank(seg[seg.length - 1]) + 1) seg.push(c);
        else { flush(); seg = [c]; }
      });
      flush();
    }
    let best = null;
    function rec(idx, used, chosen) {
      const dead = hand.filter((c) => !used.has(c));
      const dw = dead.reduce((a, c) => a + value(c), 0);
      if (!best || dw < best.dw) best = { melds: chosen.map((m) => m.slice()), dead: dead, dw: dw };
      for (let k = idx; k < melds.length; k++) {
        if (melds[k].some((c) => used.has(c))) continue;
        melds[k].forEach((c) => used.add(c)); chosen.push(melds[k]);
        rec(k + 1, used, chosen);
        chosen.pop(); melds[k].forEach((c) => used.delete(c));
      }
    }
    rec(0, new Set(), []);
    return best;
  }
  function canExtend(meld, c) {
    const isSet = meld.every((m) => rank(m) === rank(meld[0]));
    if (isSet) return meld.length < 4 && rank(c) === rank(meld[0]);
    if (suit(c) !== suit(meld[0])) return false;
    const rs = meld.map(rank);
    return rank(c) === Math.min.apply(null, rs) - 1 || rank(c) === Math.max.apply(null, rs) + 1;
  }
  // Best discard: returns { card, dw }
  function bestDiscard(hand, forbid) {
    let best = null;
    hand.forEach((c) => {
      if (c === forbid) return;
      const dw = bestMelds(hand.filter((x) => x !== c)).dw;
      if (!best || dw < best.dw || (dw === best.dw && value(c) > value(best.card))) best = { card: c, dw: dw };
    });
    return best;
  }

  function restore(d) {
    const A = MP.assert, ok = (c) => MP.validInt(c, 0, 51);
    A(d && ['stock', 'discard', 'you', 'npc'].every((k) => Array.isArray(d[k]) && d[k].every(ok)));
    const all = d.stock.concat(d.discard, d.you, d.npc);
    A(all.length === 52 && new Set(all).size === 52);
    A(d.turn === 'you' || d.turn === 'npc');
    A(d.phase === 'draw' || d.phase === 'discard');
    return { stock: d.stock.slice(), discard: d.discard.slice(), you: d.you.slice(), npc: d.npc.slice(), turn: d.turn, phase: d.phase, took: ok(d.took) ? d.took : -1 };
  }

  MP.registerGame({
    id: 'gin', name: 'Gin Rummy', blurb: 'Make sets and runs',
    icon: '<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#333" stroke-width="3"><rect x="8" y="22" width="36" height="52" rx="5" fill="#fff" transform="rotate(-14 26 48)"/><rect x="32" y="18" width="36" height="52" rx="5" fill="#fff"/><rect x="56" y="22" width="36" height="52" rx="5" fill="#fff" transform="rotate(14 74 48)"/></g><text x="50" y="52" text-anchor="middle" font-size="22" font-weight="800" fill="#c3101c">7♦</text><text x="76" y="56" text-anchor="middle" font-size="20" font-weight="800" fill="#c3101c" transform="rotate(14 74 48)">7♥</text><text x="25" y="56" text-anchor="middle" font-size="20" font-weight="800" fill="#111" transform="rotate(-14 26 48)">7♠</text></svg>',
    rules: [
      'Make groups in your hand: three or four of the same number (7♠ 7♥ 7♦), or three or more in a row of the same suit (4♣ 5♣ 6♣).',
      'Your groups are found for you and lifted up with a green bar. The other cards are “deadwood”.',
      'On your turn, take a card from the deck or the discard pile. Then tap a card and tap Discard to throw one away.',
      'When your deadwood adds up to 10 or less, you can Knock to end the hand. No deadwood at all is Gin!',
      'Lowest deadwood wins. Face cards count 10, Aces count 1.',
    ],
    create(ctx, saved) {
      let st, sel = -1, busy = false;
      const body = ctx.body;
      const discardBtn = ctx.button('Discard', doDiscard, 'primary');
      const knockBtn = ctx.button('Knock', doKnock);

      function persist() { ctx.save({ stock: st.stock, discard: st.discard, you: st.you, npc: st.npc, turn: st.turn, phase: st.phase, took: st.took }); }
      function deal() {
        const deck = MP.shuffle(Array.from({ length: 52 }, (_, i) => i));
        st = { you: deck.slice(0, 10), npc: deck.slice(10, 20), discard: [deck[20]], stock: deck.slice(21), turn: 'you', phase: 'draw', took: -1 };
        persist();
      }
      function info() { return bestMelds(st.you); }

      function setMsg() {
        if (st.turn !== 'you') return;
        if (st.phase === 'draw') ctx.msg('Your turn: take a card from the deck or the discard pile.');
        else ctx.msg('Now tap a card to throw away, then tap Discard.');
      }
      function updateButtons() {
        const mine = st.turn === 'you' && st.phase === 'discard' && !busy;
        discardBtn.disabled = !(mine && sel >= 0);
        let canKnock = false, dw = 0;
        if (mine && sel >= 0) { dw = bestMelds(st.you.filter((c) => c !== sel)).dw; canKnock = dw <= 10; }
        knockBtn.disabled = !canKnock;
        knockBtn.textContent = canKnock && dw === 0 ? 'Gin!' : 'Knock';
        knockBtn.classList.toggle('pulse', canKnock);
      }
      function take(fromDiscard) {
        if (busy || st.turn !== 'you' || st.phase !== 'draw') return;
        if (fromDiscard) { if (!st.discard.length) return; const c = st.discard.pop(); st.you.push(c); st.took = c; sel = -1; }
        else { const c = st.stock.pop(); st.you.push(c); st.took = -1; sel = c; }
        st.phase = 'discard';
        ctx.sfx('select'); persist(); render(); setMsg();
      }
      function doDiscard() {
        if (sel < 0 || st.phase !== 'discard' || st.turn !== 'you') return;
        if (sel === st.took) { ctx.tip('You just picked that one up. Throw away a different card.'); return; }
        st.you = st.you.filter((c) => c !== sel); st.discard.push(sel); sel = -1; st.took = -1;
        st.phase = 'draw'; st.turn = 'npc'; ctx.sfx('select');
        persist(); render();
        if (st.stock.length <= 2) { endDraw(); return; }
        npcTurn();
      }
      function endDraw() { revealAll(); ctx.end(null, ['The deck ran out before anyone knocked.']); }
      function doKnock() {
        if (sel < 0 || st.phase !== 'discard') return;
        if (sel === st.took) { ctx.tip('You just picked that one up. Throw away a different card.'); return; }
        st.you = st.you.filter((c) => c !== sel); st.discard.push(sel); sel = -1;
        settle('you');
      }
      function npcTurn() {
        busy = true; ctx.msg(ctx.name + ' is thinking…'); updateButtons();
        ctx.later(() => {
          const L = ctx.level, oops = (1 - L) * 0.35;
          const top = st.discard[st.discard.length - 1];
          const now = bestMelds(st.npc).dw;
          const withTop = bestDiscard(st.npc.concat([top]), top).dw;
          let takeTop = withTop < now - 1;
          if (Math.random() < oops * 0.5) takeTop = !takeTop && Math.random() < 0.3;
          let drew, took = -1;
          if (takeTop) { drew = st.discard.pop(); took = drew; } else drew = st.stock.pop();
          st.npc.push(drew);
          let d = bestDiscard(st.npc, took);
          if (Math.random() < oops) {
            const dead = bestMelds(st.npc).dead.filter((c) => c !== took);
            if (dead.length) { const c = ctx.pick(dead); d = { card: c, dw: bestMelds(st.npc.filter((x) => x !== c)).dw }; }
          }
          st.npc = st.npc.filter((c) => c !== d.card); st.discard.push(d.card);
          const what = (takeTop ? 'took the ' + C.short(drew) + ' from the pile' : 'drew from the deck') + ' and threw away the ' + C.short(d.card) + '.';
          ctx.sfx('select');
          const limit = L > 0.6 ? 10 : L > 0.3 ? 6 : 2;
          if (d.dw === 0 || d.dw <= limit) { busy = false; render(); ctx.msg(ctx.name + ' ' + what); ctx.later(() => settle('npc'), 1200); return; }
          if (st.stock.length <= 2) { busy = false; render(); endDraw(); return; }
          st.turn = 'you'; st.phase = 'draw'; busy = false;
          persist(); render();
          ctx.msg(ctx.name + ' ' + what + ' Your turn: take a card.');
          ctx.speak(ctx.name + ' ' + what);
          if (Math.random() < 0.15) ctx.say(ctx.pick(['Hmm, what to keep…', 'Your turn!', 'This hand is coming together.']));
        }, 1400);
      }
      let revealed = false;
      function revealAll() { revealed = true; busy = true; render(); }
      function settle(knocker) {
        const K = bestMelds(knocker === 'you' ? st.you : st.npc);
        const D = bestMelds(knocker === 'you' ? st.npc : st.you);
        const gin = K.dw === 0;
        let ddead = D.dead.slice(), laid = 0;
        if (!gin) {
          const km = K.melds.map((m) => m.slice());
          let changed = true;
          while (changed) {
            changed = false;
            for (let i = 0; i < ddead.length; i++) {
              const m = km.find((mm) => canExtend(mm, ddead[i]));
              if (m) { m.push(ddead[i]); ddead.splice(i, 1); laid++; changed = true; break; }
            }
          }
        }
        const ddw = ddead.reduce((a, c) => a + value(c), 0);
        let winner;
        if (gin) winner = knocker;
        else winner = ddw <= K.dw ? (knocker === 'you' ? 'npc' : 'you') : knocker;
        revealAll();
        const who = (k) => (k === 'you' ? 'You' : ctx.name);
        const lines = [];
        if (gin) lines.push(who(knocker) + (knocker === 'you' ? ' got Gin!' : ' got Gin.'));
        else lines.push(who(knocker) + ' knocked with ' + K.dw + ' deadwood.');
        if (!gin) lines.push(who(knocker === 'you' ? 'npc' : 'you') + ' had ' + ddw + (laid ? ' after laying off ' + laid + ' card' + (laid > 1 ? 's' : '') : '') + '.');
        if (!gin && winner !== knocker) lines.push('Undercut! The lower deadwood wins.');
        ctx.msg(lines.join(' '));
        ctx.end(winner === 'you', lines);
      }

      // ---------- drawing ----------
      function groupHand(hand) {
        const b = bestMelds(hand);
        const groups = b.melds.map((m) => m.slice().sort((a, c) => rank(a) - rank(c) || suit(a) - suit(c)));
        const dead = b.dead.slice().sort((a, c) => rank(a) - rank(c) || suit(a) - suit(c));
        return { groups: groups, dead: dead, dw: b.dw };
      }
      function render() {
        const r = body.getBoundingClientRect(), W = r.width, H = r.height;
        body.textContent = '';
        const n = st.you.length;
        // Height budget: their cards (0.77cw) + piles (1.4cw) + labels (70px) + your raised hand (1.4cw + 40px)
        const cw = Math.min(W / (n * 0.66 + 1.4), (H - 124) / 3.6, 120);
        const ch = cw * 1.4;
        body.style.setProperty('--cw', cw + 'px');
        const small = cw * 0.55;
        // challenger's hand
        const npcRow = el('div', 'gin-npc');
        npcRow.style.setProperty('--cw', small + 'px');
        body.appendChild(npcRow);
        if (revealed) {
          const g = groupHand(st.npc);
          let x = 0;
          g.groups.concat([g.dead]).forEach((grp, gi) => {
            grp.forEach((c) => { const d = C.el(c, true); d.style.left = x + 'px'; if (gi < g.groups.length) d.classList.add('melded'); npcRow.appendChild(d); x += small * 0.62; });
            x += small * 0.35;
          });
          npcRow.style.width = (x + small) + 'px';
        } else {
          st.npc.forEach((c, i) => { const d = C.el(c, false); d.style.left = (i * small * 0.45) + 'px'; npcRow.appendChild(d); });
          npcRow.style.width = (st.npc.length * small * 0.45 + small) + 'px';
        }
        npcRow.style.height = small * 1.4 + 'px';
        // deck and discard
        const midY = small * 1.4 + 14;
        const drawing = st.turn === 'you' && st.phase === 'draw' && !busy;
        const deckX = W / 2 - cw - 20, discX = W / 2 + 20;
        const deck = C.el(0, false); deck.style.left = deckX + 'px'; deck.style.top = midY + 'px';
        if (drawing) deck.classList.add('glow');
        deck.addEventListener('click', () => take(false)); deck.setAttribute('aria-label', 'Deck');
        body.appendChild(deck);
        const lab1 = el('div', 'pile-label', 'Deck (' + st.stock.length + ')'); lab1.style.left = deckX + 'px'; lab1.style.top = (midY + ch + 4) + 'px'; lab1.style.width = cw + 'px'; body.appendChild(lab1);
        if (st.discard.length) {
          const top = st.discard[st.discard.length - 1];
          const d = C.el(top, true); d.style.left = discX + 'px'; d.style.top = midY + 'px';
          if (drawing) d.classList.add('glow');
          d.addEventListener('click', () => take(true)); body.appendChild(d);
        }
        const lab2 = el('div', 'pile-label', 'Discard pile'); lab2.style.left = discX + 'px'; lab2.style.top = (midY + ch + 4) + 'px'; lab2.style.width = cw + 'px'; body.appendChild(lab2);
        // your hand
        const g = groupHand(st.you);
        const handY = midY + ch + 30 + 34 + 16;
        const step = cw * 0.66, gapG = cw * 0.3;
        const totalW = n * step + (g.groups.length) * gapG + cw - step;
        let x = Math.max(4, (W - totalW) / 2);
        g.groups.concat([g.dead]).forEach((grp, gi) => {
          const isMeld = gi < g.groups.length;
          if (isMeld && grp.length) {
            const bar = el('div', 'meld-bar'); bar.style.left = x + 'px'; bar.style.top = (handY + ch + 6) + 'px';
            bar.style.width = ((grp.length - 1) * step + cw) + 'px'; body.appendChild(bar);
          }
          grp.forEach((c) => {
            const d = C.el(c, true);
            d.style.left = x + 'px'; d.style.top = (handY - (isMeld ? 14 : 0)) + 'px';
            if (c === sel) d.classList.add('sel');
            if (c === st.took) d.classList.add('took');
            d.addEventListener('click', () => {
              if (busy || st.turn !== 'you') return;
              if (st.phase !== 'discard') { ctx.tip('First take a card from the deck or the discard pile.'); return; }
              sel = sel === c ? -1 : c; ctx.sfx('select'); render();
            });
            body.appendChild(d);
            x += step;
          });
          x += gapG;
        });
        const dwLab = el('div', 'dw-label', 'Your deadwood: ' + g.dw + (g.dw <= 10 ? '  (you can knock when it’s your turn)' : '  (knock at 10 or less)'));
        dwLab.style.top = (midY + ch + 30) + 'px'; body.appendChild(dwLab);
        ctx.score([{ label: 'Deadwood', value: g.dw, cls: 'you' }, { label: 'Deck', value: st.stock.length }]);
        updateButtons();
      }
      ctx.saveNow = () => { if (st && !revealed) persist(); };
      window.addEventListener('resize', () => { if (ctx.alive()) render(); });

      if (saved) {
        st = restore(saved);
        render(); setMsg();
        if (st.turn === 'npc') npcTurn();
      } else {
        deal(); render(); setMsg();
        ctx.say(ctx.pick(['Let’s play some cards!', 'Deal ’em up!', 'I’ve been practicing my gin.']));
      }
    },
  });
})();
