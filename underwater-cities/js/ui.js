// Rendering and interaction. Re-renders the whole app from engine state on every change.
(function () {
  const UC = window.UC;
  const E = UC.engine;
  const B = UC.BOARD;
  const app = document.getElementById('app');
  const ui = { sel: new Set(), showRules: false, setupCount: 2, names: ['', '', '', ''] };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = () => E.state();
  const ans = (o) => `data-act="answer" data-json='${esc(JSON.stringify(o))}'`;
  const ROMAN = ['I', 'II', 'III'];

  // ---------- Setup screen ----------
  function renderSetup() {
    const rows = [];
    for (let i = 0; i < ui.setupCount; i++) {
      rows.push(`<label><span class="swatch" style="background:${UC.PLAYER_COLORS[i].hex}"></span><input type="text" data-name="${i}" placeholder="Player ${i + 1}" value="${esc(ui.names[i])}" /></label>`);
    }
    return `<div class="setup">
      <h1>Underwater Cities <span class="muted" style="font-size:14px">hot seat</span></h1>
      <p class="muted">Unofficial fan implementation for local play. 2–4 players share one screen; a pass screen hides each hand between turns.</p>
      <div class="row"><span>Players:</span>${[2, 3, 4].map((n) => `<button class="${ui.setupCount === n ? 'primary' : ''}" data-act="count" data-n="${n}">${n}</button>`).join('')}</div>
      <div class="players-form">${rows.join('')}</div>
      <div class="row"><button class="primary" data-act="start">Start game</button>${E.hasSave() ? '<button data-act="resume">Resume saved game</button>' : ''}<button data-act="rules">Rules</button></div>
      <p class="notice">Costs and production values follow the published rulebook. The action-slot board and card set are original approximations; see README.</p>
    </div>${ui.showRules ? renderRules() : ''}`;
  }

  // ---------- Header & players ----------
  function renderHeader(s) {
    const cur = E.cur();
    let status = '';
    if (s.phase === 'turn') status = `Round ${s.round}/10 · Era ${ROMAN[s.era - 1]} · Turn ${s.turnInRound + 1} of 3 · <b style="color:${cur.colorHex}">${esc(cur.name)}</b> to act`;
    else if (s.phase === 'keep') status = `${s.round === 0 ? 'Setup' : 'Era ' + ROMAN[s.era - 1]} · <b style="color:${cur.colorHex}">${esc(cur.name)}</b> chooses cards`;
    else if (s.phase === 'production') status = `Production after round ${s.round}`;
    else if (s.phase === 'gameover') status = 'Final scoring';
    const decks = `Deck ${ROMAN[s.era - 1] || ''}: ${s.decks[s.era] ? s.decks[s.era].length : 0} · Symbiotic domes left: ${s.symSupply}`;
    return `<div class="header">
      <div><span class="title">Underwater Cities</span> <span class="status">${status}</span></div>
      <div class="row"><span class="muted" style="font-size:12px">${decks}</span>
        <button class="small" data-act="rules">Rules</button>
        <button class="small" data-act="restart-turn" ${s.phase === 'turn' && s.stage !== 'chooseSlot' ? '' : 'disabled'}>Restart turn</button>
        <button class="small" data-act="newgame">New game</button></div>
    </div>`;
  }
  function renderPlayers(s) {
    return `<div class="players">${s.players.map((p) => `
      <div class="pcard ${p.id === s.current ? 'active' : ''} ${p.id === s.view ? 'viewing' : ''}" style="--pc:${p.colorHex}" data-act="view" data-pid="${p.id}">
        <div class="name"><span>${esc(p.name)}${p.id === s.current ? ' ·' : ''}</span><span class="chip vp">${p.vp} VP</span></div>
        <div class="res">${UC.RES.map((r) => `<span class="chip ${r}">${UC.RES_SHORT[r]} ${p.res[r]}</span>`).join('')}<span class="chip">Fed ${UC.FED_TRACK[p.fed].label}</span><span class="chip">Hand ${p.hand.length}</span></div>
      </div>`).join('')}</div>`;
  }

  // ---------- Main board ----------
  function renderSlots(s) {
    const byColor = { yellow: [], red: [], green: [] };
    UC.SLOTS.forEach((sl) => byColor[sl.color].push(sl));
    const slotHtml = (sl) => {
      const occ = s.slots[sl.id];
      const can = E.canChooseSlot(sl.id);
      const selected = s.turn && s.turn.slotId === sl.id;
      const occP = occ != null ? s.players[occ] : null;
      return `<div class="slot ${sl.color || 'neutral'} ${can ? 'choosable' : ''} ${occ != null ? 'taken' : ''} ${selected ? 'selected' : ''}" ${can ? `data-act="slot" data-id="${sl.id}"` : ''}>
        ${occP ? `<span class="occ" style="background:${occP.colorHex}" title="${esc(occP.name)}"></span>` : ''}
        <div class="sname">${esc(sl.name)}</div><div class="stext">${esc(sl.text)}</div></div>`;
    };
    const rows = ['yellow', 'red', 'green'].map((c) => byColor[c].map(slotHtml).join('')).join('');
    const extra = slotHtml(UC.ALWAYS_SLOT) + (s.numPlayers === 4 ? slotHtml(UC.CLONE_SLOT) : '');
    return `<div class="panel"><h3>Main board — yellow slots are strongest, green weakest; match your card's colour to the slot to get its effect</h3>
      <div class="slots">${rows}</div><div class="slots-extra">${extra}</div></div>`;
  }

  // ---------- Player board ----------
  const PX = (n) => 60 + n.x * 150;
  const PY = (n) => 60 + n.y * 140;
  const SLOT_OFF = [[-36, -36], [36, -36], [-36, 36], [36, 36]];
  function renderBoard(s, p, interactive) {
    const conn = E.H.connectedSet(p);
    const pr = s.prompt;
    const buildTargets = new Set(interactive && pr && pr.t === 'build' ? E.buildTargets() : []);
    const upTargets = new Set(interactive && pr && pr.t === 'upgrade' ? E.upgradeTargets() : []);
    const parts = [];
    // Edges
    Object.values(B.edges).forEach((e) => {
      const a = B.nodes[e.a], b = B.nodes[e.b];
      const t = p.board.tunnels[e.id];
      const productive = t && (E.H.isCityConnected(p, e.a, conn) || E.H.isCityConnected(p, e.b, conn));
      const target = buildTargets.has(e.id) || upTargets.has(e.id);
      const cls = ['edge', t ? 'built' : '', t && t.upgraded ? 'upgraded' : '', productive && !(t && t.upgraded) ? 'productive' : '', target ? 'target' : ''].join(' ');
      parts.push(`<line class="${cls}" x1="${PX(a)}" y1="${PY(a)}" x2="${PX(b)}" y2="${PY(b)}" ${target ? `data-act="target" data-target="${e.id}"` : ''}><title>Tunnel ${e.id}${t ? (t.upgraded ? ' (upgraded)' : '') : ''}</title></line>`);
      if (e.bonus && !t) parts.push(`<text class="bonus" x="${(PX(a) + PX(b)) / 2}" y="${(PY(a) + PY(b)) / 2 - 8}">+${fmtGain(e.bonus)}</text>`);
      if (t && t.upgraded) parts.push(`<circle cx="${(PX(a) + PX(b)) / 2}" cy="${(PY(a) + PY(b)) / 2}" r="5" fill="#ffd24d" pointer-events="none"/>`);
    });
    // Nodes
    Object.entries(B.nodes).forEach(([id, n]) => {
      const x = PX(n), y = PY(n);
      if (n.metro) {
        const tile = E.tileOf(p, id);
        const done = !!p.metroDone[id];
        parts.push(`<rect class="metro ${n.metro} ${done ? 'done' : ''}" x="${x - 40}" y="${y - 26}" width="80" height="52" rx="8"><title>${esc(tile.name)}: ${esc(tile.text)}</title></rect>`);
        parts.push(`<text class="node-label" x="${x}" y="${y - 6}" style="fill:#e6eef5;font-size:10px">${esc(tile.name)}</text>`);
        parts.push(`<text class="node-label" x="${x}" y="${y + 9}">${n.metro === 'brown' ? '2 tunnels' : '1 tunnel'}${done ? ' · linked' : ''}</text>`);
        return;
      }
      // Building slots
      Object.values(B.slots).filter((sl) => sl.node === id).forEach((sl) => {
        const [dx, dy] = SLOT_OFF[sl.idx];
        const b = p.board.buildings[sl.id];
        const target = buildTargets.has(sl.id) || upTargets.has(sl.id);
        const cls = ['bslot', sl.expansion ? 'expansion' : '', sl.expansion && p.expansion ? 'open' : '', b ? b.type : '', b && b.upgraded ? 'upgraded' : '', target ? 'target' : ''].join(' ');
        if (sl.expansion && !p.expansion && !b) return;
        parts.push(`<rect class="${cls}" x="${x + dx - 12}" y="${y + dy - 12}" width="24" height="24" rx="4" ${target ? `data-act="target" data-target="${sl.id}"` : ''}><title>${b ? UC.KIND_LABEL[b.type] + (b.upgraded ? ' (upgraded)' : '') : (sl.expansion ? 'Expansion site' : 'Building site')}${sl.bonus ? ' · bonus +' + fmtGain(sl.bonus) : ''}</title></rect>`);
        if (b) parts.push(`<text class="bslot-label" x="${x + dx}" y="${y + dy + 4}">${{ farm: 'F', desal: 'D', lab: 'L' }[b.type]}${b.upgraded ? '+' : ''}</text>`);
        else if (sl.bonus) parts.push(`<text class="bonus" x="${x + dx}" y="${y + dy + 3}">+${fmtGain(sl.bonus)}</text>`);
      });
      const city = p.board.cities[id];
      const target = buildTargets.has(id);
      const cls = ['node', city ? city.type : '', city && conn.has(id) ? 'connected' : '', target ? 'target' : ''].join(' ');
      parts.push(`<circle class="${cls}" cx="${x}" cy="${y}" r="22" style="--pc:${p.colorHex}" ${target ? `data-act="target" data-target="${id}"` : ''}><title>${city ? UC.KIND_LABEL[city.type] + (conn.has(id) ? ' (connected)' : ' (not connected)') : 'City site ' + id}${n.bonus ? ' · bonus +' + fmtGain(n.bonus) : ''}</title></circle>`);
      parts.push(`<text class="node-label ${city ? 'dark' : ''}" x="${x}" y="${y + 4}">${n.start ? 'START' : id}</text>`);
      if (n.bonus && !city) parts.push(`<text class="bonus" x="${x}" y="${y + 14}">+${fmtGain(n.bonus)}</text>`);
    });
    return `<div class="board-wrap"><svg class="board" viewBox="0 0 740 400" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg></div>
      <div class="legend"><span><i style="background:var(--city)"></i>City</span><span><i style="background:var(--sym)"></i>Symbiotic city</span><span><i style="background:var(--farm)"></i>Farm</span><span><i style="background:var(--desal)"></i>Desalination</span><span><i style="background:var(--lab)"></i>Laboratory</span><span><i style="background:#ffd24d"></i>Upgraded</span><span><i style="background:#f4f7fa"></i>Producing tunnel</span></div>`;
  }
  function fmtGain(g) { return Object.keys(g).map((r) => `${g[r]} ${UC.RES_SHORT[r]}`).join(', '); }

  // ---------- Cards ----------
  function cardHtml(uid, opts) {
    opts = opts || {};
    const d = E.def(uid);
    const cls = ['card', `c-${d.color || 'none'}`, opts.playable ? 'playable' : '', opts.match ? 'match' : '', opts.selected ? 'selected' : '', opts.used ? 'used' : ''].join(' ');
    const act = opts.act ? `data-act="${opts.act}" data-uid="${uid}"` : '';
    return `<div class="${cls}" ${act}>
      <div class="chead"><span class="cname">${esc(d.name)}</span><span class="ctype">${d.special ? `<span class="cost">Special ${d.cost}CR</span> ` : ''}${d.type}${opts.used ? ' · used' : ''}${opts.match ? ' · <b style="color:var(--target)">match</b>' : ''}</span></div>
      <div class="ctext">${esc(d.text)}</div></div>`;
  }
  function renderHand(s, p, isCurrent) {
    const pr = s.prompt;
    const effColor = s.turn ? UC.SLOT_BY_ID[s.turn.effSlot].color : null;
    let title = 'Hand';
    let mode = null;
    if (isCurrent && s.phase === 'turn' && s.stage === 'chooseCard' && !pr) { mode = 'play'; title = 'Hand — play a card into the chosen slot'; }
    else if (isCurrent && pr && pr.t === 'discardTo') { mode = 'discard'; title = 'Hand — click a card to discard'; }
    else if (isCurrent && pr && pr.t === 'keep') { mode = 'keep'; title = `Hand — select ${pr.n} to keep (${ui.sel.size}/${pr.n})`; }
    if (!isCurrent && s.phase !== 'gameover') return `<div class="panel"><h3>Hand</h3><div class="muted">${p.hand.length} cards (hidden)</div></div>`;
    const cards = p.hand.map((uid) => {
      const d = E.def(uid);
      if (mode === 'play') return cardHtml(uid, { playable: true, act: 'play', match: !!effColor && d.color === effColor });
      if (mode === 'discard') return cardHtml(uid, { playable: true, act: 'discard' });
      if (mode === 'keep') return cardHtml(uid, { playable: true, act: 'toggle', selected: ui.sel.has(uid) });
      return cardHtml(uid, {});
    }).join('');
    const confirm = mode === 'keep' ? `<div style="margin-top:8px"><button class="primary" data-act="keep-confirm" ${ui.sel.size === pr.n ? '' : 'disabled'}>Keep selected</button></div>` : '';
    return `<div class="panel"><h3>${title}</h3><div class="cards">${cards || '<span class="muted">empty</span>'}</div>${confirm}</div>`;
  }
  function renderTableau(s, p) {
    const sec = (label, items) => (items.length ? `<h4>${label}</h4><div class="cards">${items.join('')}</div>` : '');
    const acts = p.actionCards.map((a) => cardHtml(a.uid, { used: a.used }));
    return `<div class="panel tableau"><h3>${esc(p.name)}'s tableau</h3>
      ${sec(`Action cards (${p.actionCards.length}/4, once per era)`, acts)}
      ${sec('Permanent effects', p.permanents.map((u) => cardHtml(u)))}
      ${sec('Production cards', p.productionCards.map((u) => cardHtml(u)))}
      ${sec('End-scoring cards', p.endCards.map((u) => cardHtml(u)))}
      <h4>Metropolises</h4><div class="tiles">${['M', 'B1', 'B2'].map((m) => { const t = E.tileOf(p, m); return `<div class="tile ${m === 'M' ? 'brown' : ''} ${p.metroDone[m] ? 'done' : ''}"><b>${esc(t.name)}</b> (${m})${p.metroDone[m] ? ' · linked' : ''}<br>${esc(t.text)}</div>`; }).join('')}</div>
    </div>`;
  }

  // ---------- Prompt panel ----------
  function renderPrompt(s) {
    const pr = s.prompt;
    const p = E.cur();
    if (s.phase === 'turn' && !pr) {
      if (s.stage === 'chooseSlot') return `<div class="panel prompt"><div class="ptitle">Choose an action slot on the main board</div><div class="muted">Highlighted slots are free. The Open Market is always available.</div></div>`;
      if (s.stage === 'chooseCard') { const sl = UC.SLOT_BY_ID[s.turn.effSlot]; return `<div class="panel prompt"><div class="ptitle">Slot: ${esc(sl.name)}${sl.color ? ` (${sl.color})` : ''}</div><div class="muted">Now play a card from your hand. A ${sl.color || 'no'}-colour card also gives its own effect.</div></div>`; }
      return '';
    }
    if (!pr) return '';
    const btn = (label, payload, extra) => `<button ${ans(payload)} ${extra || ''}>${label}</button>`;
    let body = '';
    switch (pr.t) {
      case 'keep': body = `<div class="muted">Click cards in your hand, then confirm.</div>`; break;
      case 'discardTo': body = `<div class="muted">Click a card in your hand to discard it.</div>`; break;
      case 'clone': body = `<div class="opts">${pr.options.map((id) => btn(`${esc(UC.SLOT_BY_ID[id].name)} (${UC.SLOT_BY_ID[id].color})`, { slotId: id })).join('')}</div>`; break;
      case 'payCost': body = `<div class="opts">${btn('Yes, pay', { yes: true })}${btn('No, discard without effect', { yes: false })}</div>`; break;
      case 'order': body = `<div class="opts">${btn('Slot action first', { first: 'slot' })}${btn(`Card (${esc(pr.cardName)}) first`, { first: 'card' })}</div>`; break;
      case 'choose': body = `<div class="opts">${pr.options.map((o, i) => btn(esc(o.label), { idx: i })).join('')}</div>`; break;
      case 'build': {
        if (pr.step === 'kind') body = `<div class="opts">${pr.kinds.map((k) => btn(`${UC.KIND_LABEL[k]} — ${E.fmtCost(E.costOf(p, k, pr.ef))}`, { kind: k })).join('')}${btn('Skip', { skip: true })}</div>`;
        else if (pr.step === 'target') {
          const cost = pr.kind === 'city' || pr.kind === 'symcity' ? '' : ` — ${E.fmtCost(E.costOf(p, pr.kind, pr.ef))}`;
          body = `<div class="muted">${UC.KIND_LABEL[pr.kind]}${cost}: click a highlighted site on your board.</div><div class="opts" style="margin-top:6px">${btn('Skip', { skip: true })}</div>`;
        } else body = `<div class="opts">${pr.cityOptions.map((o) => btn(`${UC.KIND_LABEL[o.kind]} — ${E.fmtCost(o.cost)}${o.kind === 'symcity' ? ' (2 VP each Production)' : ''}`, { kind: o.kind })).join('')}${btn('Skip', { skip: true })}</div>`;
        break;
      }
      case 'upgrade': body = `<div class="muted">Click a highlighted structure on your board.</div><div class="opts" style="margin-top:6px">${btn('Skip', { skip: true })}</div>`; break;
      case 'thenUpgrade': body = `<div class="opts">${btn('Yes, upgrade (1 science)', { yes: true })}${btn('No', { yes: false })}</div>`; break;
      case 'useAction': body = `<div class="opts">${pr.options.map((u) => btn(`${esc(E.def(u).name)}: ${esc(E.def(u).text)}`, { uid: u })).join('')}${btn('Skip', { skip: true })}</div>`; break;
      case 'discardAction': body = `<div class="opts">${pr.options.map((u) => btn(`${esc(E.def(u).name)}${p.actionCards.find((a) => a.uid === u).used ? ' (used)' : ' (unused — will be used first)'}`, { uid: u })).join('')}</div>`; break;
      case 'gainDistinct': body = `<div class="muted">Picked: ${pr.picked.map((r) => UC.RES_LABEL[r]).join(', ') || 'none'}</div><div class="opts" style="margin-top:6px">${UC.RES.filter((r) => !pr.picked.includes(r)).map((r) => btn(UC.RES_LABEL[r], { res: r })).join('')}</div>`; break;
      case 'special': {
        if (pr.step === 'method') body = `<div class="opts">${pr.three.map((u) => btn(`3-credit: ${esc(E.def(u).name)} — ${esc(E.def(u).text)}`, { method: 'three', uid: u })).join('')}${pr.deckCount ? btn(`Draw 3 from the Special deck and keep 1 (${pr.deckCount} left)`, { method: 'draw' }) : ''}</div>`;
        else body = `<div class="opts">${pr.three.map((u) => btn(`${esc(E.def(u).name)} (${E.def(u).cost}CR) — ${esc(E.def(u).text)}`, { uid: u })).join('')}</div>`;
        break;
      }
      default: body = '';
    }
    return `<div class="panel prompt"><div class="ptitle">${esc(pr.title || '')}</div>${body}</div>`;
  }

  // ---------- Overlays ----------
  function renderPass(s) {
    const p = s.players[s.pass];
    return `<div class="overlay pass"><div class="box" style="text-align:center">
      <div class="muted">Pass the device to</div><div class="pass-name" style="color:${p.colorHex}">${esc(p.name)}</div>
      <p class="muted">${s.phase === 'keep' ? 'Choose which cards to keep.' : `Round ${s.round}, turn ${s.turnInRound + 1} of 3.`}</p>
      <button class="primary" data-act="pass-ok">I'm ${esc(p.name)} — show my cards</button></div></div>`;
  }
  function renderProduction(s) {
    return `<div class="overlay"><div class="box report"><h2>Production after round ${s.report.round}</h2>
      ${s.report.players.map((r) => { const p = s.players[r.pid]; return `<div class="pl"><div class="pn" style="color:${p.colorHex}">${esc(p.name)} — ${r.vp} VP</div><ul>${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`; }).join('')}
      <div class="muted" style="font-size:12px">Action cards are refreshed.${s.round < 10 ? ' Next: each player draws 3 cards from the new era and keeps 3.' : ' Next: final scoring.'}</div>
      <div style="margin-top:12px"><button class="primary" data-act="continue-production">Continue</button></div></div></div>`;
  }
  function renderGameOver(s) {
    const cols = s.final.map((r) => s.players[r.pid]);
    const rowsHtml = s.final[0].rows.map((_, i) => `<tr><td>${esc(s.final[0].rows[i].label)}</td>${s.final.map((r) => `<td class="n">${r.rows[i].vp}${r.rows[i].note ? `<div class="muted" style="font-size:11px;font-weight:400">${esc(r.rows[i].note)}</div>` : ''}</td>`).join('')}</tr>`).join('');
    return `<div class="overlay"><div class="box"><h2>Final scoring</h2>
      <p>Winner: <b style="color:${cols[0].colorHex}">${esc(cols[0].name)}</b> with ${s.final[0].total} VP</p>
      <div style="overflow-x:auto"><table class="score"><tr><th></th>${cols.map((p) => `<th style="color:${p.colorHex}">${esc(p.name)}</th>`).join('')}</tr>${rowsHtml}<tr><th>Total</th>${s.final.map((r) => `<td class="n"><b>${r.total}</b></td>`).join('')}</tr></table></div>
      <div class="row" style="margin-top:12px"><button data-act="close-final">View boards</button><button class="primary" data-act="newgame">New game</button></div></div></div>`;
  }
  function renderRules() {
    const c = (k) => E.fmtCost(UC.COSTS[k]);
    return `<div class="overlay"><div class="box rules"><h2>Rules summary</h2>
      <p>10 rounds in three eras (rounds 1–4, 5–7, 8–10). Each round every player takes 3 turns in Federation order. On a turn: pick a free action slot, then play a card from your hand into it. If the card colour matches the slot colour you get the card's effect too; otherwise the card is discarded. Draw 1 card at end of turn (hand limit 3).</p>
      <h3>Costs</h3><table>
      <tr><td>Tunnel</td><td>${c('tunnel')}</td></tr><tr><td>City</td><td>${c('city')}</td></tr><tr><td>Symbiotic city</td><td>${c('symcity')}</td></tr>
      <tr><td>Farm / Desalination plant / Laboratory</td><td>1 KP / 1 CR / 1 ST</td></tr><tr><td>Upgrade any structure</td><td>1 SC</td></tr></table>
      <p>Biomatter may replace kelp or steelplast when paying. Buildings sit on the three sites around a city (the fourth needs an Expansion Permit).</p>
      <h3>Production (after rounds 4, 7, 10)</h3>
      <p>Only structures in your network produce: a city must be reachable from the Start city through tunnels. Per connected city: symbiotic city 2 VP; farm 1 KP (+1 VP if upgraded); desalination plant 1 CR (+1 BM if upgraded); laboratory 1 ST (+1 SC if upgraded). Two upgraded buildings of the same type at one city add +1 of the base resource (farms also +1 VP). Each tunnel touching a connected city gives 1 CR (+1 VP if upgraded). Then every connected city eats 1 kelp; if short, 1 biomatter, then −3 VP per unfed city. Action cards refresh; everyone draws 3 cards from the new era and keeps 3.</p>
      <h3>Federation track</h3><p>Advancing gives the space's bonus; past the top each step is +1 VP. Order on the track sets next round's turn order (later arrivals on a space sit on top).</p>
      <h3>Final scoring</h3><p>Connected cities score 2/3/4/6 VP for 0/1/2/3 building types adjacent. Brown metropolis scores its tile if both tunnels are built and linked. End-scoring cards resolve. Biomatter sells for 2 CR, then every 4 remaining resources = 1 VP.</p>
      <h3>Action cards and Specials</h3><p>Claimed action cards (max 4, incl. your Personal Assistant) can each be used once per era through a slot or card that says "use an action card". Claiming a fifth discards one; an unused one is used on the way out. Special cards come from the Special Requisition slot, stay in hand, and only take effect if you pay their credit cost when matched. The six 3-credit Specials are limited.</p>
      <div style="margin-top:12px"><button class="primary" data-act="close-rules">Close</button></div></div></div>`;
  }
  function renderLog(s) {
    const items = s.log.slice(-25).reverse().map((l) => `<div><span class="who">R${l.r} ${esc(l.who)}:</span> ${esc(l.msg)}</div>`).join('');
    return `<div class="panel"><h3>Log</h3><div class="log">${items}</div></div>`;
  }

  // ---------- Root render ----------
  function render() {
    const s = S();
    if (!s || s.phase === 'setup') { app.innerHTML = renderSetup(); return; }
    const viewPid = s.prompt && s.phase !== 'gameover' ? s.current : s.view;
    const vp = s.players[viewPid];
    const isCurrent = viewPid === s.current && s.phase !== 'gameover';
    const interactive = isCurrent && !s.pass;
    let html = `<div class="game">${renderHeader(s)}${renderPlayers(s)}
      <div class="left">${renderSlots(s)}
        <div class="panel"><h3>${esc(vp.name)}'s board${isCurrent ? '' : ' (viewing)'} · ${E.H.connectedCities(vp).length} connected cities</h3>${renderBoard(s, vp, interactive)}</div></div>
      <div class="side">${isCurrent ? renderPrompt(s) : `<div class="panel muted">Viewing ${esc(vp.name)}. <button class="small" data-act="view" data-pid="${s.current}">Back to ${esc(E.cur().name)}</button></div>`}${renderHand(s, vp, isCurrent)}${renderTableau(s, vp)}${renderLog(s)}</div>
    </div>`;
    if (s.pass != null) html += renderPass(s);
    if (s.phase === 'production' && s.report) html += renderProduction(s);
    if (s.phase === 'gameover' && s.final && !ui.finalClosed) html += renderGameOver(s);
    if (ui.showRules) html += renderRules();
    app.innerHTML = html;
  }

  // ---------- Events ----------
  app.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const s = S();
    switch (act) {
      case 'count': ui.setupCount = +el.dataset.n; render(); break;
      case 'start': {
        document.querySelectorAll('input[data-name]').forEach((inp) => (ui.names[+inp.dataset.name] = inp.value));
        const players = [];
        for (let i = 0; i < ui.setupCount; i++) players.push({ name: ui.names[i].trim() || `Player ${i + 1}` });
        ui.sel.clear(); ui.finalClosed = false;
        E.newGame({ players });
        break;
      }
      case 'resume': ui.sel.clear(); ui.finalClosed = false; E.load(); break;
      case 'newgame': if (!s || s.phase === 'gameover' || confirm('Abandon the current game?')) { E.clearSave(); E.debug.S = null; ui.sel.clear(); ui.finalClosed = false; render(); } break;
      case 'rules': ui.showRules = true; render(); break;
      case 'close-rules': ui.showRules = false; render(); break;
      case 'close-final': ui.finalClosed = true; render(); break;
      case 'pass-ok': E.dismissPass(); break;
      case 'view': E.setView(+el.dataset.pid); break;
      case 'restart-turn': E.restartTurn(); break;
      case 'slot': E.chooseSlot(el.dataset.id); break;
      case 'play': E.chooseCard(el.dataset.uid); break;
      case 'discard': E.answer({ uid: el.dataset.uid }); break;
      case 'toggle': {
        const uid = el.dataset.uid;
        if (ui.sel.has(uid)) ui.sel.delete(uid); else if (ui.sel.size < s.prompt.n) ui.sel.add(uid);
        render(); break;
      }
      case 'keep-confirm': { const uids = Array.from(ui.sel); ui.sel.clear(); E.answer({ uids }); break; }
      case 'target': E.answer({ target: el.dataset.target }); break;
      case 'answer': E.answer(JSON.parse(el.dataset.json)); break;
      case 'continue-production': E.continueAfterProduction(); break;
      default: break;
    }
  });
  app.addEventListener('input', (ev) => {
    if (ev.target.matches('input[data-name]')) ui.names[+ev.target.dataset.name] = ev.target.value;
  });

  E.onChange(render);
  render();
})();
