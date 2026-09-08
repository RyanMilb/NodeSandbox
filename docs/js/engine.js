// Rules engine. All state is plain JSON (card instances reference defs by id) so it can be
// snapshotted for "restart turn" and autosaved to localStorage.
(function () {
  const UC = window.UC;
  const E = (UC.engine = {});
  const B = UC.BOARD;
  const SAVE_KEY = 'uc-hotseat-save-v1';

  let S = null;
  const listeners = [];
  E.state = () => S;
  E.onChange = (fn) => listeners.push(fn);
  function changed() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
    listeners.forEach((f) => f());
  }
  E.hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  E.load = () => { try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { S = null; } listeners.forEach((f) => f()); return !!S; };
  E.clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const def = (uid) => UC.CARD_DEFS[S.cards[uid].defId];
  E.def = def;
  E.cardInst = (uid) => S.cards[uid];
  const cur = () => S.players[S.current];
  E.cur = cur;
  const P = (pid) => S.players[pid];

  function log(msg, pid) {
    const who = pid === undefined ? (S.current != null ? cur().name : '') : P(pid).name;
    S.log.push({ r: S.round, who, msg });
    if (S.log.length > 200) S.log.shift();
  }

  // ---------- Board helpers ----------
  const H = (E.H = {
    connectedSet(p) {
      const seen = new Set(['S']);
      const stack = ['S'];
      while (stack.length) {
        const n = stack.pop();
        for (const e of Object.values(B.edges)) {
          if (!p.board.tunnels[e.id]) continue;
          const other = e.a === n ? e.b : e.b === n ? e.a : null;
          if (other && !seen.has(other)) { seen.add(other); stack.push(other); }
        }
      }
      return seen;
    },
    isCityConnected(p, node, conn) { return !!p.board.cities[node] && (conn || H.connectedSet(p)).has(node); },
    connectedCities(p) { const c = H.connectedSet(p); return B.citySites.filter((n) => p.board.cities[n] && c.has(n)); },
    symCities(p) { return H.connectedCities(p).filter((n) => p.board.cities[n].type === 'symcity').length; },
    slotsOf(node) { return Object.values(B.slots).filter((s) => s.node === node); },
    buildingsAt(p, node) { return H.slotsOf(node).map((s) => p.board.buildings[s.id]).filter(Boolean); },
    cityTypes(p, node) { return new Set(H.buildingsAt(p, node).map((b) => b.type)); },
    citiesWithTypes(p, n) { return H.connectedCities(p).filter((c) => H.cityTypes(p, c).size >= n).length; },
    citiesWithPair(p, kind) { return H.connectedCities(p).filter((c) => H.buildingsAt(p, c).filter((b) => b.type === kind && b.upgraded).length >= 2).length; },
    upgraded(p, kind) {
      if (kind === 'tunnel') return Object.values(p.board.tunnels).filter((t) => t.upgraded).length;
      return Object.values(p.board.buildings).filter((b) => b.type === kind && b.upgraded).length;
    },
    productiveTunnels(p) {
      const conn = H.connectedSet(p);
      return Object.keys(p.board.tunnels).filter((id) => { const e = B.edges[id]; return H.isCityConnected(p, e.a, conn) || H.isCityConnected(p, e.b, conn); }).length;
    },
    productiveBuildings(p, kind) {
      const conn = H.connectedSet(p);
      return Object.entries(p.board.buildings).filter(([sid, b]) => b.type === kind && H.isCityConnected(p, B.slots[sid].node, conn)).length;
    },
    metroConnected(p, m) {
      const conn = H.connectedSet(p);
      return B.metroEdges[m].every((eid) => p.board.tunnels[eid]) && conn.has(m);
    },
    handLimit(p) { return 3 + p.permanents.reduce((a, uid) => a + ((def(uid).perm || {}).handLimit || 0), 0); },
  });

  // ---------- Costs ----------
  function permDiscounts(p, kind) {
    const key = kind === 'symcity' ? 'city' : kind;
    const d = {};
    p.permanents.forEach((uid) => {
      const disc = ((def(uid).perm || {}).discount || {})[key];
      if (disc) for (const r in disc) d[r] = (d[r] || 0) + disc[r];
    });
    return d;
  }
  function costOf(p, kind, mods) {
    mods = mods || {};
    if (mods.free) return {};
    const c = clone(UC.COSTS[kind]);
    const apply = (d) => { for (const r in d) if (c[r]) c[r] = Math.max(0, c[r] - d[r]); };
    apply(permDiscounts(p, kind));
    if (mods.discount) apply(mods.discount);
    for (const r in c) if (!c[r]) delete c[r];
    return c;
  }
  E.costOf = costOf;
  function canPay(p, cost) {
    const bioLeft = p.res.biomatter - (cost.biomatter || 0);
    if (bioLeft < 0) return false;
    if ((cost.credits || 0) > p.res.credits || (cost.science || 0) > p.res.science) return false;
    const short = Math.max(0, (cost.kelp || 0) - p.res.kelp) + Math.max(0, (cost.steelplast || 0) - p.res.steelplast);
    return short <= bioLeft;
  }
  E.canPay = canPay;
  function pay(p, cost) {
    p.res.biomatter -= cost.biomatter || 0;
    p.res.credits -= cost.credits || 0;
    p.res.science -= cost.science || 0;
    for (const r of ['kelp', 'steelplast']) {
      const need = cost[r] || 0;
      const fromRes = Math.min(need, p.res[r]);
      p.res[r] -= fromRes;
      p.res.biomatter -= need - fromRes;
    }
  }
  E.fmtCost = (cost) => { const parts = []; for (const r in cost) parts.push(`${cost[r]} ${UC.RES_SHORT[r]}`); return parts.length ? parts.join(' + ') : 'free'; };

  // ---------- Gains ----------
  function gain(p, g, why) {
    const parts = [];
    UC.RES.forEach((r) => { if (g[r]) { p.res[r] += g[r]; parts.push(`+${g[r]} ${UC.RES_SHORT[r]}`); } });
    if (g.vp) { p.vp += g.vp; parts.push(`+${g.vp} VP`); }
    if (g.cards) { const n = draw(p, g.cards); parts.push(`+${n} card${n === 1 ? '' : 's'}`); }
    if (g.fed) { advanceFed(p, g.fed); parts.push(`Federation +${g.fed}`); }
    if (parts.length) log(`${why ? why + ': ' : ''}${parts.join(', ')}`, p.id);
  }
  function advanceFed(p, n) {
    for (let i = 0; i < n; i++) {
      if (p.fed < UC.FED_TRACK.length - 1) {
        p.fed++;
        const b = UC.FED_TRACK[p.fed].bonus;
        if (b) gain(p, b, `Federation space ${UC.FED_TRACK[p.fed].label}`);
      } else {
        p.vp += 1;
        log('Federation overflow: +1 VP', p.id);
      }
    }
    p.fedArrival = ++S.arrival;
  }

  // ---------- Decks ----------
  function makeCard(defId) { const uid = 'c' + ++S.uidSeq; S.cards[uid] = { uid, defId }; return uid; }
  function eraDeck(era) { return S.decks[era]; }
  function draw(p, n) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const deck = eraDeck(S.era);
      if (!deck.length) {
        if (S.discards[S.era].length) { S.decks[S.era] = shuffle(S.discards[S.era]); S.discards[S.era] = []; }
        else break;
      }
      p.hand.push(eraDeck(S.era).pop());
      got++;
    }
    return got;
  }
  function discardCard(uid) {
    const d = def(uid);
    if (d.special) {
      if (d.cost === 3) S.special3.push(uid); else S.specialDeck.unshift(uid);
    } else if (d.era) {
      S.discards[d.era].push(uid);
    }
  }

  // ---------- New game ----------
  E.newGame = function (setup) {
    const n = setup.players.length;
    S = {
      version: 1, uidSeq: 0, arrival: 0, cards: {}, log: [],
      numPlayers: n, round: 0, era: 1, turnInRound: 0, orderIdx: 0, order: [], current: null,
      slots: {}, cloneUsed: false, symSupply: UC.SYM_LIMIT[n],
      decks: { 1: [], 2: [], 3: [] }, discards: { 1: [], 2: [], 3: [] }, specialDeck: [], special3: [],
      phase: 'setup', stage: null, turn: null, queue: [], prompt: null, pass: null, keepQueue: [],
      report: null, final: null, snapshot: null, view: 0,
      players: [],
    };
    UC.CARD_LIST.forEach((d) => {
      for (let i = 0; i < d.count; i++) {
        const uid = makeCard(d.id);
        if (d.special) { if (d.cost === 3) S.special3.push(uid); else S.specialDeck.push(uid); }
        else S.decks[d.era].push(uid);
      }
    });
    [1, 2, 3].forEach((e) => shuffle(S.decks[e]));
    shuffle(S.specialDeck);
    const browns = shuffle(UC.BROWN.slice());
    const blues = shuffle(UC.BLUE.slice());
    setup.players.forEach((ps, i) => {
      const p = {
        id: i, name: ps.name || `Player ${i + 1}`, color: UC.PLAYER_COLORS[i].id, colorHex: UC.PLAYER_COLORS[i].hex,
        res: { credits: 0, kelp: 0, steelplast: 0, biomatter: 0, science: 0 }, vp: 0,
        hand: [], actionCards: [{ uid: makeCard('ASSISTANT'), used: false }], permanents: [], productionCards: [], endCards: [],
        board: { cities: { S: { type: 'city' } }, tunnels: {}, buildings: {} },
        metro: { M: browns[i % browns.length].id, B1: blues[(2 * i) % blues.length].id, B2: blues[(2 * i + 1) % blues.length].id },
        metroDone: {}, fed: 0, fedArrival: 0, expansion: false, workers: 0,
      };
      S.players.push(p);
    });
    S.order = shuffle(S.players.map((p) => p.id));
    // Starting Federation positions compensate later seats.
    S.order.forEach((pid, seat) => {
      const p = P(pid);
      p.fed = [0, 1, 2, 3][seat];
      p.fedArrival = 0;
      if (seat === 2) p.res.credits += 1;
      if (seat === 3) { p.res.credits += 1; p.res.steelplast += 1; }
    });
    S.players.forEach((p) => { p.res.credits += 2; p.res.kelp += 1; p.res.steelplast += 1; });
    log('Game start. Each player: 2 credits, 1 kelp, 1 steelplast, plus seat bonuses.');
    S.players.forEach((p) => draw(p, 6));
    S.keepQueue = S.order.slice();
    S.keepN = 3;
    startKeep();
    changed();
  };

  function startKeep() {
    const pid = S.keepQueue.shift();
    S.current = pid; S.view = pid; S.pass = pid; S.phase = 'keep';
    S.prompt = { t: 'keep', n: S.keepN, title: `Choose ${S.keepN} cards to keep` };
  }

  // ---------- Rounds & turns ----------
  function nextRound() {
    if (S.round >= 1) {
      S.order = S.players.map((p) => p.id).sort((a, b) => P(b).fed - P(a).fed || P(b).fedArrival - P(a).fedArrival);
    }
    S.round++;
    S.era = UC.eraOfRound(S.round);
    S.slots = {}; S.cloneUsed = false; S.turnInRound = 0; S.orderIdx = 0;
    S.players.forEach((p) => (p.workers = 0));
    log(`Round ${S.round} (Era ${['I', 'II', 'III'][S.era - 1]}). Order: ${S.order.map((i) => P(i).name).join(' > ')}`);
    beginTurn();
  }
  function beginTurn() {
    S.current = S.order[S.orderIdx];
    S.view = S.current;
    S.phase = 'turn'; S.stage = 'chooseSlot'; S.turn = null; S.queue = []; S.prompt = null;
    S.pass = S.current;
    S.snapshot = null;
    S.snapshot = JSON.stringify(S);
  }
  E.restartTurn = function () {
    if (!S.snapshot || S.phase !== 'turn') return;
    const snap = JSON.parse(S.snapshot);
    S = snap; S.pass = null; S.snapshot = JSON.stringify(S);
    changed();
  };
  E.dismissPass = function () { S.pass = null; changed(); };
  E.setView = function (pid) { S.view = pid; changed(); };

  function nextPlayer() {
    S.orderIdx++;
    if (S.orderIdx >= S.order.length) { S.orderIdx = 0; S.turnInRound++; }
    if (S.turnInRound >= 3) { endRound(); return; }
    beginTurn();
  }
  function endRound() {
    if (UC.PRODUCTION_ROUNDS.includes(S.round)) production(); else nextRound();
  }

  // ---------- Slot selection ----------
  function slotFree(id) { return !S.slots[id]; }
  E.canChooseSlot = function (id) {
    if (S.phase !== 'turn' || S.stage !== 'chooseSlot' || S.pass) return false;
    if (id === 'ALWAYS') return true;
    if (id === 'CLONE') return S.numPlayers === 4 && !S.cloneUsed && cur().res.credits >= 1 && Object.keys(S.slots).some((k) => k !== 'CLONE' && S.slots[k] != null);
    return slotFree(id);
  };
  E.chooseSlot = function (id) {
    if (!E.canChooseSlot(id)) return;
    if (id === 'CLONE') {
      S.prompt = { t: 'clone', title: 'Choose an occupied slot to copy (costs 1 credit)', options: Object.keys(S.slots).filter((k) => k !== 'CLONE' && S.slots[k] != null) };
      changed(); return;
    }
    S.turn = { slotId: id, effSlot: id };
    if (id !== 'ALWAYS') S.slots[id] = S.current;
    S.stage = 'chooseCard';
    changed();
  };

  // ---------- Card play ----------
  E.chooseCard = function (uid) {
    if (S.phase !== 'turn' || S.stage !== 'chooseCard' || S.prompt) return;
    const p = cur();
    const idx = p.hand.indexOf(uid);
    if (idx < 0) return;
    p.hand.splice(idx, 1);
    const d = def(uid);
    const slot = UC.SLOT_BY_ID[S.turn.effSlot];
    const matched = !!slot.color && d.color === slot.color;
    S.turn.cardUid = uid; S.turn.matched = matched;
    log(`Takes ${UC.SLOT_BY_ID[S.turn.slotId].name}${S.turn.slotId === 'CLONE' ? ' (copying ' + slot.name + ')' : ''} and plays ${d.name}${matched ? '' : ' (no match, discarded)'}`);
    p.workers++;
    if (matched && d.special && d.cost) {
      if (canPay(p, { credits: d.cost })) { S.prompt = { t: 'payCost', title: `Pay ${d.cost} credits for ${d.name}?`, uid }; changed(); return; }
      log(`Cannot afford ${d.name}; no effect.`);
      finishCardChoice(uid, false);
    } else {
      finishCardChoice(uid, matched);
    }
    changed();
  };
  function finishCardChoice(uid, effective) {
    const p = cur();
    const d = def(uid);
    const slotEffects = clone(UC.SLOT_BY_ID[S.turn.effSlot].effects || []);
    let cardEffects = [];
    let pre = [];
    if (effective) {
      if (d.type === 'instant') { cardEffects = clone(d.effects); discardCard(uid); }
      else pre = claimCard(p, uid);
    } else {
      discardCard(uid);
    }
    S.stage = 'resolving';
    if (slotEffects.length && cardEffects.length) {
      S.prompt = { t: 'order', title: 'Resolve which first?', slotEffects, cardEffects, pre, cardName: d.name };
      return;
    }
    S.queue = pre.concat(slotEffects, cardEffects);
    runQueue();
  }
  function claimCard(p, uid) {
    const d = def(uid);
    log(`Claims ${d.name}`);
    if (d.type === 'action') {
      p.actionCards.push({ uid, used: false });
      if (p.actionCards.length > 4) return [{ t: 'actionOverflow' }];
    } else if (d.type === 'permanent') {
      p.permanents.push(uid);
      if ((d.perm || {}).expansion) p.expansion = true;
    } else if (d.type === 'production') p.productionCards.push(uid);
    else if (d.type === 'end') p.endCards.push(uid);
    return [];
  }

  // ---------- Effect queue ----------
  function runQueue() {
    while (S.queue.length && !S.prompt) {
      const ef = S.queue.shift();
      const p = cur();
      switch (ef.t) {
        case 'gain': gain(p, ef, ef.why); break;
        case 'gainCards': { const n = draw(p, ef.n); log(`Draws ${n} card${n === 1 ? '' : 's'}`); break; }
        case 'fed': advanceFed(p, ef.n); log(`Advances ${ef.n} on the Federation track`); break;
        case 'choose': S.prompt = { t: 'choose', title: ef.title || 'Choose', options: ef.options }; break;
        case 'build': startBuild(ef); break;
        case 'upgrade': startUpgrade(ef); break;
        case 'thenUpgrade': startThenUpgrade(ef); break;
        case 'useAction': startUseAction(); break;
        case 'gainDistinct': S.prompt = { t: 'gainDistinct', title: `Choose ${ef.n} different resources`, n: ef.n, picked: [] }; break;
        case 'special': startSpecial(); break;
        case 'actionOverflow': {
          const opts = p.actionCards.slice(0, 4).map((a) => a.uid);
          S.prompt = { t: 'discardAction', title: 'You hold 5 action cards. Discard one (an unused one is used first).', options: opts };
          break;
        }
        default: break;
      }
    }
    if (!S.queue.length && !S.prompt) afterQueue();
  }
  function afterQueue() {
    if (S.phase === 'turn' && S.stage === 'resolving') endTurn();
  }
  function endTurn() {
    const p = cur();
    S.stage = 'ending';
    const n = draw(p, 1);
    if (n) log('Draws 1 card at end of turn');
    const lim = H.handLimit(p);
    if (p.hand.length > lim) { S.prompt = { t: 'discardTo', title: `Discard down to ${lim} cards`, n: lim }; return; }
    nextPlayer();
  }

  // ---------- Build ----------
  const concreteKinds = (k) => (k === 'building' ? UC.BUILDING_KINDS.slice() : k === 'structure' ? ['tunnel'].concat(UC.BUILDING_KINDS) : [k]);
  function targetsFor(p, kind) {
    if (kind === 'tunnel') return Object.keys(B.edges).filter((e) => !p.board.tunnels[e]);
    if (kind === 'city' || kind === 'symcity') return B.citySites.filter((n) => !B.nodes[n].start && !p.board.cities[n]);
    return Object.values(B.slots).filter((s) => !p.board.buildings[s.id] && (!s.expansion || p.expansion)).map((s) => s.id);
  }
  E.targetsFor = targetsFor;
  function cityOptions(p, ef) {
    const opts = [];
    const ck = ef.kind === 'symcity' ? [] : ['city'];
    if (S.symSupply > 0) ck.push('symcity');
    ck.forEach((k) => { const c = costOf(p, k, ef); if (canPay(p, c)) opts.push({ kind: k, cost: c }); });
    return opts;
  }
  function kindFeasible(p, k, ef) {
    if (!targetsFor(p, k).length) return false;
    if (k === 'city' || k === 'symcity') return cityOptions(p, ef).length > 0;
    return canPay(p, costOf(p, k, ef));
  }
  function startBuild(ef) {
    const p = cur();
    const kinds = concreteKinds(ef.kind).filter((k) => kindFeasible(p, k, ef));
    if (!kinds.length) { log(`Nothing affordable to build (${UC.KIND_LABEL[ef.kind]})`); return; }
    S.prompt = { t: 'build', ef, kinds, kind: kinds.length === 1 ? kinds[0] : null, step: kinds.length === 1 ? 'target' : 'kind', title: buildTitle(ef) };
  }
  function buildTitle(ef) { return `Build ${UC.KIND_LABEL[ef.kind].toLowerCase()}${ef.n > 1 ? ` (up to ${ef.n})` : ''}${ef.free ? ' — free' : ef.discount ? ' — discounted' : ''}`; }
  E.buildTargets = function () {
    const pr = S.prompt;
    if (!pr || pr.t !== 'build' || pr.step !== 'target') return [];
    return targetsFor(cur(), pr.kind);
  };
  function doBuild(p, kind, target, ef, cost) {
    pay(p, cost);
    let bonus = null, label = '';
    if (kind === 'tunnel') { p.board.tunnels[target] = { upgraded: false }; bonus = B.edges[target].bonus; label = `tunnel ${target}`; }
    else if (kind === 'city' || kind === 'symcity') { p.board.cities[target] = { type: kind }; if (kind === 'symcity') S.symSupply--; bonus = B.nodes[target].bonus; label = `${UC.KIND_LABEL[kind].toLowerCase()} at ${target}`; }
    else { p.board.buildings[target] = { type: kind, upgraded: false }; bonus = B.slots[target].bonus; label = `${UC.KIND_LABEL[kind].toLowerCase()} at ${target}`; }
    log(`Builds ${label} (${E.fmtCost(cost)})`);
    if (bonus) gain(p, bonus, 'Site bonus');
    p.permanents.forEach((uid) => { const ob = ((def(uid).perm || {}).onBuild || {})[kind === 'symcity' ? 'city' : kind]; if (ob) gain(p, ob, def(uid).name); });
    if (kind === 'tunnel') checkMetros(p);
    if (ef.thenUpgrade) S.queue.unshift({ t: 'thenUpgrade', kind, target, free: ef.thenUpgrade === 'free' });
  }
  function checkMetros(p) {
    ['M', 'B1', 'B2'].forEach((m) => {
      if (p.metroDone[m] || !H.metroConnected(p, m)) return;
      p.metroDone[m] = true;
      const tile = tileOf(p, m);
      log(`Connects metropolis ${tile.name}`);
      if (tile.instant) gain(p, tile.instant, tile.name);
    });
  }
  function tileOf(p, m) { return (m === 'M' ? UC.BROWN : UC.BLUE).find((t) => t.id === p.metro[m]); }
  E.tileOf = tileOf;

  // ---------- Upgrade ----------
  function upgradeTargets(p) {
    const t = Object.keys(p.board.tunnels).filter((e) => !p.board.tunnels[e].upgraded).map((e) => ({ id: e, kind: 'tunnel' }));
    const b = Object.keys(p.board.buildings).filter((s) => !p.board.buildings[s].upgraded).map((s) => ({ id: s, kind: p.board.buildings[s].type }));
    return t.concat(b);
  }
  E.upgradeTargets = function () {
    const pr = S.prompt;
    if (!pr || pr.t !== 'upgrade') return [];
    return upgradeTargets(cur()).map((x) => x.id);
  };
  function startUpgrade(ef) {
    const p = cur();
    const cost = ef.free ? {} : UC.COSTS.upgrade;
    if (!upgradeTargets(p).length) { log('Nothing to upgrade'); return; }
    if (!canPay(p, cost)) { log('No science to upgrade'); return; }
    S.prompt = { t: 'upgrade', ef, title: `Upgrade a structure${ef.n > 1 ? ` (up to ${ef.n})` : ''}${ef.free ? ' — free' : ' — 1 science each'}` };
  }
  function doUpgrade(p, id, cost) {
    pay(p, cost);
    if (p.board.tunnels[id]) p.board.tunnels[id].upgraded = true; else p.board.buildings[id].upgraded = true;
    log(`Upgrades ${id} (${E.fmtCost(cost)})`);
  }
  function startThenUpgrade(ef) {
    const p = cur();
    if (ef.free) { doUpgrade(p, ef.target, {}); return; }
    if (!canPay(p, UC.COSTS.upgrade)) return;
    S.prompt = { t: 'thenUpgrade', title: `Pay 1 science to upgrade the new ${UC.KIND_LABEL[ef.kind].toLowerCase()} at ${ef.target}?`, target: ef.target };
  }

  // ---------- Action cards ----------
  function startUseAction() {
    const p = cur();
    const opts = p.actionCards.filter((a) => !a.used).map((a) => a.uid);
    if (!opts.length) { log('No unused action cards'); return; }
    S.prompt = { t: 'useAction', title: 'Use an action card', options: opts };
  }
  function useActionCard(p, uid) {
    const a = p.actionCards.find((x) => x.uid === uid);
    a.used = true;
    log(`Uses action card ${def(uid).name}`);
    p.permanents.forEach((pu) => { const g = (def(pu).perm || {}).onUseAction; if (g) gain(p, g, def(pu).name); });
    S.queue = clone(def(uid).effects).concat(S.queue);
  }

  // ---------- Special cards ----------
  function startSpecial() {
    if (!S.special3.length && !S.specialDeck.length) { log('No Special cards left'); return; }
    S.prompt = { t: 'special', step: 'method', title: 'Take a Special card', three: S.special3.slice(), deckCount: S.specialDeck.length };
  }

  // ---------- Prompt answers ----------
  E.answer = function (a) {
    const pr = S.prompt;
    if (!pr) return;
    const p = cur();
    switch (pr.t) {
      case 'keep': {
        if (!a.uids || a.uids.length !== pr.n) return;
        const keep = new Set(a.uids);
        p.hand.filter((u) => !keep.has(u)).forEach(discardCard);
        p.hand = p.hand.filter((u) => keep.has(u));
        S.prompt = null;
        log(`Keeps ${pr.n} cards`);
        if (S.keepQueue.length) startKeep(); else nextRound();
        break;
      }
      case 'discardTo': {
        const uid = a.uid;
        if (!p.hand.includes(uid)) return;
        p.hand.splice(p.hand.indexOf(uid), 1);
        discardCard(uid);
        log(`Discards ${def(uid).name}`);
        if (p.hand.length <= pr.n) { S.prompt = null; nextPlayer(); }
        break;
      }
      case 'clone': {
        if (!pr.options.includes(a.slotId)) return;
        p.res.credits -= 1; S.cloneUsed = true; S.slots.CLONE = S.current;
        S.turn = { slotId: 'CLONE', effSlot: a.slotId };
        S.stage = 'chooseCard'; S.prompt = null;
        break;
      }
      case 'payCost': {
        S.prompt = null;
        if (a.yes) { pay(p, { credits: def(pr.uid).cost }); log(`Pays ${def(pr.uid).cost} credits`); finishCardChoice(pr.uid, true); }
        else finishCardChoice(pr.uid, false);
        break;
      }
      case 'order': {
        S.prompt = null;
        S.queue = pr.pre.concat(a.first === 'card' ? pr.cardEffects.concat(pr.slotEffects) : pr.slotEffects.concat(pr.cardEffects));
        runQueue();
        break;
      }
      case 'choose': {
        const opt = pr.options[a.idx];
        if (!opt) return;
        S.prompt = null;
        log(`Chooses: ${opt.label}`);
        S.queue = clone(opt.effects).concat(S.queue);
        runQueue();
        break;
      }
      case 'build': {
        if (a.skip) { S.prompt = null; log('Skips build'); runQueue(); break; }
        if (pr.step === 'kind') { if (!pr.kinds.includes(a.kind)) return; pr.kind = a.kind; pr.step = 'target'; break; }
        if (pr.step === 'target') {
          if (!targetsFor(p, pr.kind).includes(a.target)) return;
          if (pr.kind === 'city' || pr.kind === 'symcity') {
            const opts = cityOptions(p, pr.ef);
            if (opts.length === 1) { finishBuild(p, opts[0].kind, a.target, pr, opts[0].cost); break; }
            pr.target = a.target; pr.step = 'citytype'; pr.cityOptions = opts; break;
          }
          finishBuild(p, pr.kind, a.target, pr, costOf(p, pr.kind, pr.ef));
          break;
        }
        if (pr.step === 'citytype') {
          const opt = pr.cityOptions.find((o) => o.kind === a.kind);
          if (!opt) return;
          finishBuild(p, opt.kind, pr.target, pr, opt.cost);
        }
        break;
      }
      case 'upgrade': {
        if (a.skip) { S.prompt = null; log('Skips upgrade'); runQueue(); break; }
        if (!upgradeTargets(p).some((x) => x.id === a.target)) return;
        const cost = pr.ef.free ? {} : UC.COSTS.upgrade;
        if (!canPay(p, cost)) return;
        doUpgrade(p, a.target, cost);
        S.prompt = null;
        if (pr.ef.n > 1) startUpgrade(Object.assign({}, pr.ef, { n: pr.ef.n - 1 }));
        runQueue();
        break;
      }
      case 'thenUpgrade': {
        S.prompt = null;
        if (a.yes && canPay(p, UC.COSTS.upgrade)) doUpgrade(p, pr.target, UC.COSTS.upgrade);
        runQueue();
        break;
      }
      case 'useAction': {
        S.prompt = null;
        if (!a.skip && pr.options.includes(a.uid)) useActionCard(p, a.uid);
        else log('Skips action card use');
        runQueue();
        break;
      }
      case 'discardAction': {
        if (!pr.options.includes(a.uid)) return;
        const idx = p.actionCards.findIndex((x) => x.uid === a.uid);
        const [rem] = p.actionCards.splice(idx, 1);
        S.prompt = null;
        log(`Discards action card ${def(rem.uid).name}`);
        if (!rem.used) { log('Uses it on the way out'); S.queue = clone(def(rem.uid).effects).concat(S.queue); }
        discardCard(rem.uid);
        runQueue();
        break;
      }
      case 'gainDistinct': {
        if (!UC.RES.includes(a.res) || pr.picked.includes(a.res)) return;
        pr.picked.push(a.res);
        if (pr.picked.length >= pr.n) {
          const g = {}; pr.picked.forEach((r) => (g[r] = 1));
          S.prompt = null; gain(p, g, 'Supply Depot'); runQueue();
        }
        break;
      }
      case 'special': {
        if (pr.step === 'method') {
          if (a.method === 'three') {
            if (!S.special3.includes(a.uid)) return;
            S.special3.splice(S.special3.indexOf(a.uid), 1);
            p.hand.push(a.uid); S.prompt = null;
            log(`Takes Special card ${def(a.uid).name}`);
            runQueue();
          } else if (a.method === 'draw') {
            if (!S.specialDeck.length) return;
            const three = S.specialDeck.splice(-3).reverse();
            pr.step = 'pick'; pr.three = three; pr.title = 'Keep 1 Special card';
          }
          break;
        }
        if (pr.step === 'pick') {
          if (!pr.three.includes(a.uid)) return;
          pr.three.filter((u) => u !== a.uid).forEach((u) => S.specialDeck.unshift(u));
          p.hand.push(a.uid); S.prompt = null;
          log(`Takes Special card ${def(a.uid).name}`);
          runQueue();
        }
        break;
      }
      default: return;
    }
    changed();
  };
  function finishBuild(p, kind, target, pr, cost) {
    S.prompt = null;
    doBuild(p, kind, target, pr.ef, cost);
    if (pr.ef.n > 1) startBuild(Object.assign({}, pr.ef, { n: pr.ef.n - 1 }));
    runQueue();
  }

  // ---------- Production ----------
  function production() {
    S.phase = 'production';
    S.pass = null;
    const report = [];
    S.players.forEach((p) => {
      const lines = [];
      const conn = H.connectedSet(p);
      const g = { credits: 0, kelp: 0, steelplast: 0, biomatter: 0, science: 0, vp: 0, fed: 0 };
      const add = (o, label) => { let s = []; for (const r in o) { if (!o[r]) continue; g[r] += o[r]; s.push(`+${o[r]} ${UC.RES_SHORT[r]}`); } if (s.length) lines.push(`${label}: ${s.join(', ')}`); };
      H.connectedCities(p).forEach((node) => {
        const city = p.board.cities[node];
        if (city.type === 'symcity') add({ vp: 2 }, `Symbiotic city ${node}`);
        const bl = H.buildingsAt(p, node);
        UC.BUILDING_KINDS.forEach((k) => {
          const bs = bl.filter((b) => b.type === k);
          if (!bs.length) return;
          const up = bs.filter((b) => b.upgraded).length;
          const o = {};
          const base = { farm: 'kelp', desal: 'credits', lab: 'steelplast' }[k];
          o[base] = bs.length;
          const extra = { farm: 'vp', desal: 'biomatter', lab: 'science' }[k];
          if (up) o[extra] = (o[extra] || 0) + up;
          if (up >= 2) { o[base] += 1; if (k === 'farm') o.vp = (o.vp || 0) + 1; }
          add(o, `${{ farm: 'Farms', desal: 'Desalination plants', lab: 'Laboratories' }[k]} at ${node}${up >= 2 ? ' (pair bonus)' : ''}`);
        });
      });
      Object.keys(p.board.tunnels).forEach((eid) => {
        const e = B.edges[eid];
        if (H.isCityConnected(p, e.a, conn) || H.isCityConnected(p, e.b, conn)) add({ credits: 1, vp: p.board.tunnels[eid].upgraded ? 1 : 0 }, `Tunnel ${eid}`);
      });
      ['B1', 'B2'].forEach((m) => { if (p.metroDone[m]) { const t = tileOf(p, m); if (t.prod) add(t.prod, t.name); } });
      p.productionCards.forEach((uid) => { const d = def(uid); add(d.prodFn ? d.prodFn(p, H) : d.prod, d.name); });
      const fedSteps = g.fed || 0;
      delete g.fed;
      UC.RES.forEach((r) => (p.res[r] += g[r]));
      p.vp += g.vp;
      if (fedSteps) advanceFed(p, fedSteps);
      // Feeding
      const cities = H.connectedCities(p).length;
      let kelpUsed = Math.min(cities, p.res.kelp);
      p.res.kelp -= kelpUsed;
      let unfed = cities - kelpUsed;
      const bio = Math.min(unfed, p.res.biomatter);
      p.res.biomatter -= bio; unfed -= bio;
      const vpLoss = unfed * 3;
      p.vp -= vpLoss;
      lines.push(`Feeding ${cities} ${cities === 1 ? 'city' : 'cities'}: ${kelpUsed} kelp${bio ? `, ${bio} biomatter` : ''}${vpLoss ? `, -${vpLoss} VP for ${unfed} unfed` : ''}`);
      p.actionCards.forEach((a) => (a.used = false));
      report.push({ pid: p.id, lines, vp: p.vp });
      log(`Production: ${lines.join(' | ')}`, p.id);
    });
    S.report = { round: S.round, players: report };
    changed();
  }
  E.continueAfterProduction = function () {
    if (S.phase !== 'production') return;
    S.report = null;
    if (S.round >= UC.TOTAL_ROUNDS) { finalScoring(); changed(); return; }
    S.era = UC.eraOfRound(S.round + 1);
    S.players.forEach((p) => draw(p, 3));
    S.keepQueue = S.order.slice();
    S.keepN = 3;
    log(`Era ${['I', 'II', 'III'][S.era - 1]} begins: draw 3 new cards and keep 3.`);
    startKeep();
    changed();
  };

  // ---------- Final scoring ----------
  function finalScoring() {
    S.phase = 'gameover'; S.pass = null; S.prompt = null;
    const results = S.players.map((p) => {
      const start = p.vp;
      let cities = 0;
      H.connectedCities(p).forEach((n) => { cities += [2, 3, 4, 6][H.cityTypes(p, n).size]; });
      const brown = H.metroConnected(p, 'M') ? tileOf(p, 'M').score(p, H) : 0;
      let cards = 0;
      const details = [];
      p.endCards.forEach((uid) => { const d = def(uid); if (d.score) { const v = d.score(p, H); cards += v; details.push(`${d.name}: ${v}`); } });
      p.endCards.forEach((uid) => {
        const d = def(uid);
        if (!d.buy) return;
        let times = 0;
        while (canPay(p, d.buy.cost)) { pay(p, d.buy.cost); times++; }
        details.push(`${d.name} x${times}: ${times * d.buy.vp}`);
        cards += times * d.buy.vp;
      });
      p.res.credits += p.res.biomatter * 2; p.res.biomatter = 0;
      const pool = p.res.credits + p.res.kelp + p.res.science + p.res.steelplast;
      const left = Math.floor(pool / 4);
      const rows = [
        { label: 'Points during the game', vp: start },
        { label: 'Connected cities', vp: cities, note: `${H.connectedCities(p).length} cities` },
        { label: 'Brown metropolis', vp: brown, note: tileOf(p, 'M').name + (H.metroConnected(p, 'M') ? '' : ' (not linked)') },
        { label: 'End-scoring cards', vp: cards, note: details.join('; ') || 'none' },
        { label: 'Leftover resources', vp: left, note: `${pool} resources / 4` },
      ];
      const total = start + cities + brown + cards + left;
      p.vp = total;
      return { pid: p.id, rows, total };
    });
    const orderRank = {}; S.order.forEach((pid, i) => (orderRank[pid] = i));
    results.sort((a, b) => b.total - a.total || orderRank[a.pid] - orderRank[b.pid]);
    S.final = results;
    log(`Game over. Winner: ${P(results[0].pid).name} with ${results[0].total} VP`);
  }

  E.debug = { runQueue, H, costOf, canPay, production, finalScoring, get S() { return S; }, set S(v) { S = v; } };
})();
