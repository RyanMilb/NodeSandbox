// Static game data: resources, costs, board layout, action slots, metropolis tiles, cards.
// Unofficial fan implementation. Rules follow the published game; the card set is original.
(function () {
  const UC = (window.UC = window.UC || {});

  UC.RES = ['credits', 'kelp', 'steelplast', 'biomatter', 'science'];
  UC.RES_LABEL = { credits: 'Credits', kelp: 'Kelp', steelplast: 'Steelplast', biomatter: 'Biomatter', science: 'Science', vp: 'VP', cards: 'Cards', fed: 'Federation' };
  UC.RES_SHORT = { credits: 'CR', kelp: 'KP', steelplast: 'ST', biomatter: 'BM', science: 'SC', vp: 'VP', cards: 'card', fed: 'Fed' };

  UC.COSTS = {
    tunnel: { steelplast: 1, credits: 1 },
    city: { steelplast: 2, kelp: 1, credits: 1 },
    symcity: { steelplast: 1, kelp: 1, biomatter: 1, credits: 2 },
    farm: { kelp: 1 },
    desal: { credits: 1 },
    lab: { steelplast: 1 },
    upgrade: { science: 1 },
  };
  UC.KIND_LABEL = { tunnel: 'Tunnel', city: 'City', symcity: 'Symbiotic city', farm: 'Farm', desal: 'Desalination plant', lab: 'Laboratory', building: 'Building', structure: 'Structure' };
  UC.BUILDING_KINDS = ['farm', 'desal', 'lab'];
  UC.SYM_LIMIT = { 1: 7, 2: 7, 3: 10, 4: 13 };
  UC.PRODUCTION_ROUNDS = [4, 7, 10];
  UC.TOTAL_ROUNDS = 10;
  UC.eraOfRound = (r) => (r <= 4 ? 1 : r <= 7 ? 2 : 3);

  UC.PLAYER_COLORS = [
    { id: 'teal', hex: '#1f9e8a' },
    { id: 'coral', hex: '#e2603f' },
    { id: 'gold', hex: '#d9a521' },
    { id: 'violet', hex: '#7b5cd6' },
  ];

  // ---------- Player board ----------
  UC.BOARD = (function () {
    const nodes = {
      S: { x: 3, y: 2, start: true, label: 'Start' },
      C1: { x: 2, y: 2 },
      C2: { x: 1, y: 2 },
      C3: { x: 0, y: 2, bonus: { science: 1 } },
      C4: { x: 3, y: 1 },
      C5: { x: 2, y: 1, bonus: { credits: 1 } },
      C6: { x: 1, y: 1 },
      C7: { x: 0, y: 1, bonus: { fed: 1 } },
      C8: { x: 2, y: 0 },
      C9: { x: 1, y: 0, bonus: { steelplast: 1 } },
      M: { x: 0, y: 0, metro: 'brown', label: 'Metropolis' },
      B1: { x: 4, y: 1, metro: 'blue', label: 'Metropolis' },
      B2: { x: 3, y: 0, metro: 'blue', label: 'Metropolis' },
    };
    const edgeList = ['S-C1', 'C1-C2', 'C2-C3', 'S-C4', 'C1-C5', 'C2-C6', 'C3-C7', 'C4-C5', 'C5-C6', 'C6-C7', 'C5-C8', 'C6-C9', 'C8-C9', 'C7-M', 'C9-M', 'C4-B1', 'C8-B2'];
    const edgeBonus = { 'C6-C9': { credits: 1 }, 'C2-C3': { kelp: 1 } };
    const edges = {};
    edgeList.forEach((id) => {
      const [a, b] = id.split('-');
      edges[id] = { id, a, b, bonus: edgeBonus[id] || null };
    });
    const slotBonus = { 'C1-0': { kelp: 1 }, 'C6-1': { science: 1 }, 'C8-2': { credits: 1 }, 'C4-0': { steelplast: 1 } };
    const slots = {};
    const citySites = Object.keys(nodes).filter((n) => !nodes[n].metro);
    citySites.forEach((n) => {
      for (let i = 0; i < 3; i++) slots[`${n}-${i}`] = { id: `${n}-${i}`, node: n, idx: i, bonus: slotBonus[`${n}-${i}`] || null };
      slots[`${n}-x`] = { id: `${n}-x`, node: n, idx: 3, expansion: true, bonus: null };
    });
    const metroEdges = { M: ['C7-M', 'C9-M'], B1: ['C4-B1'], B2: ['C8-B2'] };
    return { nodes, edges, slots, citySites, metroEdges };
  })();

  // ---------- Metropolis tiles ----------
  UC.BROWN = [
    { id: 'brown-sets', name: 'Upgrade Nexus', text: '4 VP per set of one upgraded tunnel, farm, desalination plant and laboratory.', score: (p, H) => 4 * Math.min(H.upgraded(p, 'tunnel'), H.upgraded(p, 'farm'), H.upgraded(p, 'desal'), H.upgraded(p, 'lab')) },
    { id: 'brown-tunnels', name: 'Transit Hub', text: '2 VP per upgraded tunnel.', score: (p, H) => 2 * H.upgraded(p, 'tunnel') },
    { id: 'brown-sym', name: 'Symbiosis Center', text: '3 VP per connected symbiotic city.', score: (p, H) => 3 * H.symCities(p) },
    { id: 'brown-cities', name: 'Grand Capital', text: '2 VP per connected city.', score: (p, H) => 2 * H.connectedCities(p).length },
    { id: 'brown-labs', name: 'Research Campus', text: '3 VP per upgraded laboratory.', score: (p, H) => 3 * H.upgraded(p, 'lab') },
    { id: 'brown-flat', name: 'Deep Sanctuary', text: '8 VP.', score: () => 8 },
  ];
  UC.BLUE = [
    { id: 'blue-port', name: 'Trade Port', text: 'On connection: gain 3 credits and draw 1 card.', instant: { credits: 3, cards: 1 } },
    { id: 'blue-kelp', name: 'Kelp Reserve', text: 'Each Production: 1 kelp and 1 VP.', prod: { kelp: 1, vp: 1 } },
    { id: 'blue-mint', name: 'Mint', text: 'Each Production: 2 credits.', prod: { credits: 2 } },
    { id: 'blue-academy', name: 'Academy', text: 'On connection: gain 2 science.', instant: { science: 2 } },
    { id: 'blue-foundry', name: 'Foundry', text: 'Each Production: 1 steelplast and 1 VP.', prod: { steelplast: 1, vp: 1 } },
    { id: 'blue-embassy', name: 'Embassy', text: 'On connection: advance 2 on the Federation track.', instant: { fed: 2 } },
    { id: 'blue-bio', name: 'Bioreactor', text: 'Each Production: 1 biomatter and 1 VP.', prod: { biomatter: 1, vp: 1 } },
  ];

  // ---------- Federation track ----------
  // Index 0 is the start area below the track; index 4 is the top space "1".
  UC.FED_TRACK = [
    { label: 'Start', bonus: null },
    { label: 'A', bonus: { credits: 1 } },
    { label: '3', bonus: { cards: 1 } },
    { label: '2', bonus: { steelplast: 1 } },
    { label: '1', bonus: { science: 1 } },
  ];

  // ---------- Main board action slots ----------
  UC.SLOTS = [
    { id: 'Y1', color: 'yellow', name: 'Federation Summit', text: 'Advance 2 on the Federation track.', effects: [{ t: 'fed', n: 2 }] },
    { id: 'Y2', color: 'yellow', name: 'Desalination Works', text: 'Build up to 2 desalination plants.', effects: [{ t: 'build', kind: 'desal', n: 2 }] },
    { id: 'Y3', color: 'yellow', name: 'Supply Depot', text: 'Gain 2 different resources.', effects: [{ t: 'gainDistinct', n: 2 }] },
    { id: 'Y4', color: 'yellow', name: 'Urban Expansion', text: 'Build 1 city and 1 building.', effects: [{ t: 'build', kind: 'city', n: 1 }, { t: 'build', kind: 'building', n: 1 }] },
    { id: 'Y5', color: 'yellow', name: 'Research Council', text: 'Gain 2 science, or upgrade up to 3 structures (1 science each).', effects: [{ t: 'choose', title: 'Research Council', options: [{ label: 'Gain 2 science', effects: [{ t: 'gain', science: 2 }] }, { label: 'Upgrade up to 3 structures (1 science each)', effects: [{ t: 'upgrade', n: 3 }] }] }] },
    { id: 'R1', color: 'red', name: 'Frontier Line', text: 'Build 1 tunnel and 1 city.', effects: [{ t: 'build', kind: 'tunnel', n: 1 }, { t: 'build', kind: 'city', n: 1 }] },
    { id: 'R2', color: 'red', name: 'Steel Shipment', text: 'Gain 2 steelplast and 1 kelp.', effects: [{ t: 'gain', steelplast: 2, kelp: 1 }] },
    { id: 'R3', color: 'red', name: 'Laboratory Complex', text: 'Build up to 2 laboratories.', effects: [{ t: 'build', kind: 'lab', n: 2 }] },
    { id: 'R4', color: 'red', name: 'Special Requisition', text: 'Take a Special card and gain 1 credit.', effects: [{ t: 'special' }, { t: 'gain', credits: 1 }] },
    { id: 'R5', color: 'red', name: 'Engineering Corps', text: 'Use an action card, then build 1 structure; you may pay 1 science to upgrade it immediately.', effects: [{ t: 'useAction' }, { t: 'build', kind: 'structure', n: 1, thenUpgrade: true }] },
    { id: 'G1', color: 'green', name: 'Delegate', text: 'Use 1 of your action cards.', effects: [{ t: 'useAction' }] },
    { id: 'G2', color: 'green', name: 'Mixed Cargo', text: 'Gain 1 science, 1 steelplast and 1 kelp.', effects: [{ t: 'gain', science: 1, steelplast: 1, kelp: 1 }] },
    { id: 'G3', color: 'green', name: 'Tunnel Boring', text: 'Build up to 2 tunnels.', effects: [{ t: 'build', kind: 'tunnel', n: 2 }] },
    { id: 'G4', color: 'green', name: 'Kelp Farming', text: 'Build up to 2 farms.', effects: [{ t: 'build', kind: 'farm', n: 2 }] },
    { id: 'G5', color: 'green', name: 'Civic Works', text: 'Build 1 building and advance 1 on the Federation track.', effects: [{ t: 'build', kind: 'building', n: 1 }, { t: 'fed', n: 1 }] },
  ];
  UC.ALWAYS_SLOT = { id: 'ALWAYS', color: null, name: 'Open Market', text: 'Always available. Gain 2 cards and 2 credits. Your played card has no effect.', effects: [{ t: 'gainCards', n: 2 }, { t: 'gain', credits: 2 }] };
  UC.CLONE_SLOT = { id: 'CLONE', color: null, name: 'Action Cloning', text: '4 players only, once per round. Pay 1 credit to copy a slot another player already used.' };
  UC.SLOT_BY_ID = {};
  UC.SLOTS.forEach((s) => (UC.SLOT_BY_ID[s.id] = s));
  UC.SLOT_BY_ID.ALWAYS = UC.ALWAYS_SLOT;
  UC.SLOT_BY_ID.CLONE = UC.CLONE_SLOT;

  // ---------- Cards ----------
  // type: instant | action | permanent | production | end
  const defs = [];
  let seq = 0;
  function card(era, color, type, name, count, spec) {
    defs.push(Object.assign({ id: `${era}-${++seq}`, era, color, type, name, count }, spec));
  }
  const gain = (o) => ({ t: 'gain', ...o });

  // ===== Era I: build the engine =====
  card(1, 'green', 'instant', 'Kelp Bloom', 3, { text: 'Gain 2 kelp and 1 credit.', effects: [gain({ kelp: 2, credits: 1 })] });
  card(1, 'green', 'instant', 'Reinforced Bore', 3, { text: 'Build 1 tunnel for free.', effects: [{ t: 'build', kind: 'tunnel', n: 1, free: true }] });
  card(1, 'green', 'instant', 'Prefab Farm', 3, { text: 'Build 1 farm for free.', effects: [{ t: 'build', kind: 'farm', n: 1, free: true }] });
  card(1, 'green', 'instant', 'Research Grant', 3, { text: 'Gain 2 credits and 1 science.', effects: [gain({ credits: 2, science: 1 })] });
  card(1, 'green', 'instant', 'Survey Team', 2, { text: 'Draw 2 cards.', effects: [{ t: 'gainCards', n: 2 }] });
  card(1, 'green', 'action', 'Dredger', 2, { text: 'Action: gain 1 steelplast and 1 credit.', effects: [gain({ steelplast: 1, credits: 1 })] });
  card(1, 'green', 'action', 'Hydroponics Crew', 2, { text: 'Action: build 1 farm for free.', effects: [{ t: 'build', kind: 'farm', n: 1, free: true }] });
  card(1, 'green', 'permanent', 'Tunneling Guild', 2, { text: 'Tunnels cost 1 credit less.', perm: { discount: { tunnel: { credits: 1 } } } });
  card(1, 'green', 'permanent', 'Kelp Subsidy', 2, { text: 'Whenever you build a farm, gain 1 kelp.', perm: { onBuild: { farm: { kelp: 1 } } } });
  card(1, 'green', 'production', 'Algae Vats', 2, { text: 'Production: 1 kelp and 1 credit.', prod: { kelp: 1, credits: 1 } });
  card(1, 'green', 'end', 'Farm Baron', 2, { text: 'End: 2 VP per upgraded farm.', score: (p, H) => 2 * H.upgraded(p, 'farm') });

  card(1, 'red', 'instant', 'Salvage', 4, { text: 'Gain 1 steelplast and 1 credit.', effects: [gain({ steelplast: 1, credits: 1 })] });
  card(1, 'red', 'instant', 'Lab Grant', 2, { text: 'Build 1 laboratory for free.', effects: [{ t: 'build', kind: 'lab', n: 1, free: true }] });
  card(1, 'red', 'instant', 'Federation Envoy', 3, { text: 'Advance 1 on the Federation track and gain 1 credit.', effects: [{ t: 'fed', n: 1 }, gain({ credits: 1 })] });
  card(1, 'red', 'instant', 'Quick Upgrade', 3, { text: 'Upgrade 1 structure for free.', effects: [{ t: 'upgrade', n: 1, free: true }] });
  card(1, 'red', 'instant', 'Biomass Culture', 3, { text: 'Gain 2 biomatter.', effects: [gain({ biomatter: 2 })] });
  card(1, 'red', 'action', 'Broker', 2, { text: 'Action: gain 2 credits.', effects: [gain({ credits: 2 })] });
  card(1, 'red', 'action', 'Site Foreman', 2, { text: 'Action: build 1 desalination plant for free.', effects: [{ t: 'build', kind: 'desal', n: 1, free: true }] });
  card(1, 'red', 'permanent', 'Desalination Patent', 2, { text: 'Desalination plants are free to build.', perm: { discount: { desal: { credits: 1 } } } });
  card(1, 'red', 'production', 'Water Contracts', 2, { text: 'Production: 2 credits.', prod: { credits: 2 } });
  card(1, 'red', 'end', 'Chief Engineer', 2, { text: 'End: 1 VP per upgraded tunnel.', score: (p, H) => H.upgraded(p, 'tunnel') });

  card(1, 'yellow', 'instant', 'Small Grant', 4, { text: 'Gain 1 credit.', effects: [gain({ credits: 1 })] });
  card(1, 'yellow', 'instant', 'Kelp Ration', 4, { text: 'Gain 1 kelp.', effects: [gain({ kelp: 1 })] });
  card(1, 'yellow', 'instant', 'Scrap Steel', 4, { text: 'Gain 1 steelplast.', effects: [gain({ steelplast: 1 })] });
  card(1, 'yellow', 'instant', 'Lab Notes', 3, { text: 'Gain 1 science.', effects: [gain({ science: 1 })] });
  card(1, 'yellow', 'instant', 'Courier', 3, { text: 'Draw 1 card and gain 1 credit.', effects: [{ t: 'gainCards', n: 1 }, gain({ credits: 1 })] });
  card(1, 'yellow', 'action', 'Intern', 2, { text: 'Action: gain 1 credit.', effects: [gain({ credits: 1 })] });
  card(1, 'yellow', 'action', 'Kelp Diver', 2, { text: 'Action: gain 1 kelp.', effects: [gain({ kelp: 1 })] });
  card(1, 'yellow', 'production', 'Micro Farm', 2, { text: 'Production: 1 kelp.', prod: { kelp: 1 } });
  card(1, 'yellow', 'end', 'Bureaucrat', 2, { text: 'End: 1 VP per 2 connected cities.', score: (p, H) => Math.floor(H.connectedCities(p).length / 2) });

  // ===== Era II: expand and specialize =====
  card(2, 'green', 'instant', 'Twin Bore', 3, { text: 'Build up to 2 tunnels, each 1 credit cheaper.', effects: [{ t: 'build', kind: 'tunnel', n: 2, discount: { credits: 1 } }] });
  card(2, 'green', 'instant', 'Symbiosis Grant', 3, { text: 'Build 1 symbiotic city; it costs 2 credits less.', effects: [{ t: 'build', kind: 'symcity', n: 1, discount: { credits: 2 } }] });
  card(2, 'green', 'instant', 'Research Burst', 3, { text: 'Gain 3 science.', effects: [gain({ science: 3 })] });
  card(2, 'green', 'instant', 'Prospector', 2, { text: 'Draw 3 cards.', effects: [{ t: 'gainCards', n: 3 }] });
  card(2, 'green', 'action', 'Chief Technician', 2, { text: 'Action: upgrade 1 structure for free.', effects: [{ t: 'upgrade', n: 1, free: true }] });
  card(2, 'green', 'action', 'Master Bore', 2, { text: 'Action: build 1 tunnel for free.', effects: [{ t: 'build', kind: 'tunnel', n: 1, free: true }] });
  card(2, 'green', 'permanent', 'City Planner', 2, { text: 'Cities cost 1 steelplast less.', perm: { discount: { city: { steelplast: 1 } } } });
  card(2, 'green', 'permanent', 'Expansion Permit', 2, { text: 'You may build on expansion sites.', perm: { expansion: true } });
  card(2, 'green', 'production', 'Symbiont Research', 2, { text: 'Production: 1 VP per connected symbiotic city (max 3).', prodFn: (p, H) => ({ vp: Math.min(3, H.symCities(p)) }) });
  card(2, 'green', 'production', 'Fisheries', 2, { text: 'Production: 2 kelp and 1 VP.', prod: { kelp: 2, vp: 1 } });
  card(2, 'green', 'end', 'Metropolitan', 2, { text: 'End: 6 VP if your brown metropolis is connected.', score: (p, H) => (H.metroConnected(p, 'M') ? 6 : 0) });
  card(2, 'green', 'end', 'Diversity Charter', 2, { text: 'End: 3 VP per connected city with all 3 building types.', score: (p, H) => 3 * H.citiesWithTypes(p, 3) });

  card(2, 'red', 'instant', 'Bulk Steel', 3, { text: 'Gain 3 steelplast.', effects: [gain({ steelplast: 3 })] });
  card(2, 'red', 'instant', 'Federation Delegation', 3, { text: 'Advance 2 on the Federation track.', effects: [{ t: 'fed', n: 2 }] });
  card(2, 'red', 'instant', 'Quick Build', 3, { text: 'Build 1 building for free.', effects: [{ t: 'build', kind: 'building', n: 1, free: true }] });
  card(2, 'red', 'instant', 'Deep Harvest', 2, { text: 'Gain 2 kelp and 1 biomatter.', effects: [gain({ kelp: 2, biomatter: 1 })] });
  card(2, 'red', 'action', 'Trade Envoy', 2, { text: 'Action: gain 1 credit and 1 kelp.', effects: [gain({ credits: 1, kelp: 1 })] });
  card(2, 'red', 'action', 'Lab Director', 2, { text: 'Action: gain 1 science.', effects: [gain({ science: 1 })] });
  card(2, 'red', 'permanent', 'Extended Archive', 2, { text: 'Your hand limit is 4.', perm: { handLimit: 1 } });
  card(2, 'red', 'permanent', 'Toll Gates', 2, { text: 'Whenever you build a tunnel, gain 1 credit.', perm: { onBuild: { tunnel: { credits: 1 } } } });
  card(2, 'red', 'production', 'Refinery', 2, { text: 'Production: 1 steelplast and 1 science.', prod: { steelplast: 1, science: 1 } });
  card(2, 'red', 'end', 'Water Magnate', 2, { text: 'End: 2 VP per upgraded desalination plant.', score: (p, H) => 2 * H.upgraded(p, 'desal') });
  card(2, 'red', 'end', 'Scholar', 2, { text: 'End: 1 VP per science you hold.', score: (p) => p.res.science });

  card(2, 'yellow', 'instant', 'Grant', 3, { text: 'Gain 2 credits.', effects: [gain({ credits: 2 })] });
  card(2, 'yellow', 'instant', 'Harvest', 3, { text: 'Gain 2 kelp.', effects: [gain({ kelp: 2 })] });
  card(2, 'yellow', 'instant', 'Steel Delivery', 3, { text: 'Gain 2 steelplast.', effects: [gain({ steelplast: 2 })] });
  card(2, 'yellow', 'instant', 'Field Notes', 2, { text: 'Gain 1 science and 1 credit.', effects: [gain({ science: 1, credits: 1 })] });
  card(2, 'yellow', 'instant', 'Feast', 2, { text: 'Gain 1 biomatter and 1 kelp.', effects: [gain({ biomatter: 1, kelp: 1 })] });
  card(2, 'yellow', 'action', 'Clerk', 2, { text: 'Action: draw 1 card and gain 1 credit.', effects: [{ t: 'gainCards', n: 1 }, gain({ credits: 1 })] });
  card(2, 'yellow', 'production', 'Water Tower', 2, { text: 'Production: 1 credit and 1 biomatter.', prod: { credits: 1, biomatter: 1 } });
  card(2, 'yellow', 'end', 'Collector', 2, { text: 'End: 1 VP per 3 credits you hold.', score: (p) => Math.floor(p.res.credits / 3) });

  // ===== Era III: convert to points =====
  card(3, 'green', 'instant', 'Grand Project', 3, { text: 'Build 1 city (2 credits cheaper) and 1 building.', effects: [{ t: 'build', kind: 'city', n: 1, discount: { credits: 2 } }, { t: 'build', kind: 'building', n: 1 }] });
  card(3, 'green', 'instant', 'Mass Upgrade', 3, { text: 'Upgrade up to 2 structures for free.', effects: [{ t: 'upgrade', n: 2, free: true }] });
  card(3, 'green', 'instant', 'Federation Honors', 2, { text: 'Advance 3 on the Federation track.', effects: [{ t: 'fed', n: 3 }] });
  card(3, 'green', 'instant', 'Symbiotic Bloom', 3, { text: 'Gain 3 VP and 1 kelp.', effects: [gain({ vp: 3, kelp: 1 })] });
  card(3, 'green', 'action', 'Fixer', 2, { text: 'Action: gain 2 VP.', effects: [gain({ vp: 2 })] });
  card(3, 'green', 'end', 'Urbanist', 2, { text: 'End: 2 VP per connected city.', score: (p, H) => 2 * H.connectedCities(p).length });
  card(3, 'green', 'end', 'Transit Authority', 2, { text: 'End: 1 VP per tunnel adjacent to a connected city.', score: (p, H) => H.productiveTunnels(p) });
  card(3, 'green', 'end', 'Ecologist', 2, { text: 'End: 4 VP per city with 2 or more upgraded farms.', score: (p, H) => 4 * H.citiesWithPair(p, 'farm') });
  card(3, 'green', 'end', 'Investor', 2, { text: 'End: pay 3 credits for 2 VP, any number of times.', buy: { cost: { credits: 3 }, vp: 2 } });

  card(3, 'red', 'instant', 'Windfall', 3, { text: 'Gain 4 credits.', effects: [gain({ credits: 4 })] });
  card(3, 'red', 'instant', 'Bounty', 3, { text: 'Gain 2 VP and 1 science.', effects: [gain({ vp: 2, science: 1 })] });
  card(3, 'red', 'instant', 'Last Bore', 2, { text: 'Build 1 tunnel for free and upgrade it for free.', effects: [{ t: 'build', kind: 'tunnel', n: 1, free: true, thenUpgrade: 'free' }] });
  card(3, 'red', 'instant', 'Federation Gala', 2, { text: 'Advance 2 on the Federation track and gain 1 VP.', effects: [{ t: 'fed', n: 2 }, gain({ vp: 1 })] });
  card(3, 'red', 'action', 'Auditor', 2, { text: 'Action: gain 1 VP and 1 credit.', effects: [gain({ vp: 1, credits: 1 })] });
  card(3, 'red', 'end', 'Industrialist', 2, { text: 'End: 2 VP per upgraded laboratory.', score: (p, H) => 2 * H.upgraded(p, 'lab') });
  card(3, 'red', 'end', 'Recycler', 2, { text: 'End: pay 2 steelplast for 1 VP, any number of times.', buy: { cost: { steelplast: 2 }, vp: 1 } });
  card(3, 'red', 'end', 'Water Baron', 2, { text: 'End: 1 VP per desalination plant adjacent to a connected city.', score: (p, H) => H.productiveBuildings(p, 'desal') });
  card(3, 'red', 'end', 'Kelp Trader', 2, { text: 'End: pay 2 kelp for 1 VP, any number of times.', buy: { cost: { kelp: 2 }, vp: 1 } });

  card(3, 'yellow', 'instant', 'Bonus', 4, { text: 'Gain 1 VP.', effects: [gain({ vp: 1 })] });
  card(3, 'yellow', 'instant', 'Stipend', 3, { text: 'Gain 2 credits.', effects: [gain({ credits: 2 })] });
  card(3, 'yellow', 'instant', 'Kelp Stock', 3, { text: 'Gain 2 kelp.', effects: [gain({ kelp: 2 })] });
  card(3, 'yellow', 'instant', 'Ore Shipment', 3, { text: 'Gain 2 steelplast.', effects: [gain({ steelplast: 2 })] });
  card(3, 'yellow', 'instant', 'Dossier', 2, { text: 'Draw 2 cards.', effects: [{ t: 'gainCards', n: 2 }] });
  card(3, 'yellow', 'end', 'Landmark', 2, { text: 'End: 3 VP if you have 6 or more connected cities.', score: (p, H) => (H.connectedCities(p).length >= 6 ? 3 : 0) });
  card(3, 'yellow', 'end', 'Hoarder', 2, { text: 'End: 1 VP per 3 kelp you hold.', score: (p) => Math.floor(p.res.kelp / 3) });

  // ===== Special cards (obtained via the Special Requisition slot) =====
  function special(color, type, name, cost, spec) {
    defs.push(Object.assign({ id: `S-${++seq}`, era: 'S', color, type, name, count: 1, special: true, cost }, spec));
  }
  special('yellow', 'instant', 'Emergency Kelp', 1, { text: 'Gain 3 kelp.', effects: [gain({ kelp: 3 })] });
  special('red', 'instant', 'Steel Auction', 2, { text: 'Gain 3 steelplast.', effects: [gain({ steelplast: 3 })] });
  special('green', 'instant', 'Fast Tunnel', 2, { text: 'Build 1 tunnel for free.', effects: [{ t: 'build', kind: 'tunnel', n: 1, free: true }] });
  special('red', 'instant', 'Science Fair', 2, { text: 'Gain 2 science.', effects: [gain({ science: 2 })] });
  special('yellow', 'instant', 'Lobbyist', 1, { text: 'Advance 1 on the Federation track and draw 1 card.', effects: [{ t: 'fed', n: 1 }, { t: 'gainCards', n: 1 }] });
  special('green', 'instant', 'Bio Reactor', 1, { text: 'Gain 2 biomatter and 1 credit.', effects: [gain({ biomatter: 2, credits: 1 })] });
  special('yellow', 'instant', 'Bulk Order', 2, { text: 'Gain 2 kelp and 2 steelplast.', effects: [gain({ kelp: 2, steelplast: 2 })] });
  special('red', 'instant', 'Shortcut', 2, { text: 'Upgrade 1 structure for free.', effects: [{ t: 'upgrade', n: 1, free: true }] });
  special('green', 'instant', 'Charter Flight', 1, { text: 'Advance 2 on the Federation track.', effects: [{ t: 'fed', n: 2 }] });
  special('yellow', 'instant', 'Petty Cash', 1, { text: 'Gain 2 credits.', effects: [gain({ credits: 2 })] });
  // Six limited three-credit specials.
  special('red', 'production', 'Federation Seat', 3, { text: 'Production: advance 1 on the Federation track and gain 1 VP.', prod: { fed: 1, vp: 1 } });
  special('green', 'end', 'Kelp Empire', 3, { text: 'End: 3 VP per city with 2 or more upgraded farms.', score: (p, H) => 3 * H.citiesWithPair(p, 'farm') });
  special('yellow', 'end', 'Tunnel Network', 3, { text: 'End: 2 VP per upgraded tunnel.', score: (p, H) => 2 * H.upgraded(p, 'tunnel') });
  special('red', 'end', 'Science Council', 3, { text: 'End: 2 VP per upgraded laboratory.', score: (p, H) => 2 * H.upgraded(p, 'lab') });
  special('green', 'permanent', 'Master Builder', 3, { text: 'Farms, desalination plants and laboratories are free to build.', perm: { discount: { farm: { kelp: 1 }, desal: { credits: 1 }, lab: { steelplast: 1 } } } });
  special('yellow', 'end', 'Symbiotic Charter', 3, { text: 'End: 2 VP per connected symbiotic city.', score: (p, H) => 2 * H.symCities(p) });

  UC.ASSISTANT = { id: 'ASSISTANT', era: 0, color: null, type: 'action', name: 'Personal Assistant', text: 'Action: gain 1 steelplast or 1 credit.', effects: [{ t: 'choose', title: 'Personal Assistant', options: [{ label: 'Gain 1 steelplast', effects: [gain({ steelplast: 1 })] }, { label: 'Gain 1 credit', effects: [gain({ credits: 1 })] }] }] };

  UC.CARD_DEFS = {};
  defs.forEach((d) => (UC.CARD_DEFS[d.id] = d));
  UC.CARD_DEFS[UC.ASSISTANT.id] = UC.ASSISTANT;
  UC.CARD_LIST = defs;
})();
