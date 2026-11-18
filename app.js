(function () {
  'use strict';
  const KEY = 'raidhelfer-v4', OLDKEY = 'raidhelfer-v3', BOSSCACHE = 'raidhelfer-bosses';
  const TYPES = ['Drache','Stahl','Geist','Wasser','Feuer','Pflanze','Kampf','Unlicht','Elektro','Boden','Gestein','Psycho','Eis','Flug','Fee','Gift','Käfer','Normal'];
  const DB = window.DB, MOVES = window.MOVES, CHART = window.TYPECHART, CPMT = window.CPM, MAXNAME = window.MAXNAME, UPCOST = window.UPCOST, BREAD = window.BREAD;
  const ART = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
  const RAIDS_URL = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raids.json';
  const SP = {}; DB.forEach(s => { SP[s.k] = s; s.eq = s.eq || []; s.ec = s.ec || []; s.ex = s.ex || []; });
  // Neue Megas (Stand Nov. 2026, Werte laut Dittobase), fehlen in den Spieldaten
  [['CLEFABLE', ['Fee', 'Flug'], [253, 205, 216]], ['STARAPTOR', ['Kampf', 'Flug'], [278, 207, 198]], ['CHANDELURE', ['Geist', 'Feuer'], [335, 227, 155]]].forEach(([k, t, b]) => {
    if (SP[k] && !(SP[k].mg || []).length) SP[k].mg = [{ id: 'MEGA', n: 'Mega', t, b, img: SP[k].img }];
  });
  // Zusatz-Ladeattacken (+) für Megas, die Super-Max (Mega-Level 4) erreichen können. Nur während der Mega-Entwicklung, 100 Energie.
  // Stärke steigt je Mega-Level um 10 %. Werte: Dittobase
  const PLUS = { 'BEEDRILL#MEGA': ['FELL_STINGER', 140, 2], 'RAICHU#MEGA_X': ['VOLT_TACKLE', 170, 3.5], 'RAICHU#MEGA_Y': ['ZAP_CANNON', 160, 3.5],
    'CLEFABLE#MEGA': ['MOONBLAST', 160, 4], 'VICTREEBEL#MEGA': ['ACID_SPRAY', 160, 3], 'STARMIE#MEGA': ['LIQUIDATION', 180, 3], 'DRAGONITE#MEGA': ['OUTRAGE', 185, 4],
    'MEWTWO#MEGA_X': ['DYNAMIC_PUNCH', 130, 2.5], 'MEWTWO#MEGA_Y': ['FUTURE_SIGHT', 140, 2.5], 'SKARMORY#MEGA': ['DRILL_PECK', 170, 2.5], 'HOUNDOOM#MEGA': ['DARK_PULSE', 150, 3],
    'SABLEYE#MEGA': ['NIGHT_SHADE', 160, 2.5], 'MANECTRIC#MEGA': ['DISCHARGE', 150, 2.5], 'STARAPTOR#MEGA': ['BRAVE_BIRD', 150, 2], 'CHANDELURE#MEGA': ['OMINOUS_WIND', 145, 2.5],
    'CHESNAUGHT#MEGA': ['SEED_BOMB', 150, 2], 'DELPHOX#MEGA': ['MYSTICAL_FIRE', 140, 2], 'GRENINJA#MEGA': ['SURF', 130, 1.5], 'MALAMAR#MEGA': ['PSYBEAM', 170, 3], 'FALINKS#MEGA': ['BRICK_BREAK', 150, 1.5] };
  const PLUS_EXTRA = { VOLT_TACKLE: ['Volt Tackle', 'Elektro', 'Volttackle'], FUTURE_SIGHT: ['Future Sight', 'Psycho', 'Seher'] };
  Object.keys(PLUS).forEach(key => {
    const [base, p, d] = PLUS[key], src = MOVES[base] || [PLUS_EXTRA[base][0], PLUS_EXTRA[base][1], 0, 0, 0, PLUS_EXTRA[base][2]];
    [1, 2, 3, 4].forEach(l => { MOVES[base + '_PLUS' + l] = [src[0] + '+', src[1], Math.round(p * (1 + 0.1 * (l - 1))), d, -100, (src[5] || src[0]) + '+']; });
  });
  const plusOf = (sp, megaId, lvl) => { const x = PLUS[sp.k + '#' + megaId]; return x ? x[0] + '_PLUS' + Math.max(1, Math.min(4, lvl || 1)) : null; };
  const superMaxOk = (sp, megaId) => !!PLUS[sp.k + '#' + megaId];
  const MEGALV = ['', 'Basis', 'Hoch', 'Max', 'Super-Max'];
  // Signaturattacken der Urformen (in den Spieldaten vorhanden, aber nicht verknüpft): bekommen sie beim Formwechsel
  MOVES.ROAR_OF_TIME = MOVES.ROAR_OF_TIME || ['Roar of Time', 'Drache', 160, 2, -100, 'Zeitenlärm'];
  MOVES.SPACIAL_REND = MOVES.SPACIAL_REND || ['Spacial Rend', 'Drache', 160, 2.5, -100, 'Raumschlag'];
  [['DIALGA_ORIGIN', 'ROAR_OF_TIME'], ['PALKIA_ORIGIN', 'SPACIAL_REND']].forEach(([k, mid]) => { if (SP[k] && !SP[k].ex.includes(mid)) SP[k].ex.push(mid); });
  // Weitere Attacken, die in den Spieldaten-Werten fehlen (Werte aus dem Game Master)
  MOVES.VOLT_TACKLE = MOVES.VOLT_TACKLE || ['Volt Tackle', 'Elektro', 90, 3.5, -33, 'Volttackle'];
  MOVES.FRUSTRATION = MOVES.FRUSTRATION || ['Frustration', 'Normal', 10, 2, -33, 'Frustration'];
  MOVES.RETURN = MOVES.RETURN || ['Return', 'Normal', 25, 0.5, -33, 'Rückkehr'];
  // Aktuelle Attacken-Pools von PvPoke einmischen (neue Attacken aus Saison-Updates). Statisch mitgeliefert + täglich aktualisiert.
  const POOLKEY = 'pokeplaner-pools';
  function mergePools(pool) {
    if (!pool) return;
    const PM = window.PVMAP || {};
    const fid = id => MOVES[id + '_FAST'] ? id + '_FAST' : (MOVES[id] && MOVES[id][4] > 0 ? id : null);
    const cid = id => MOVES[id] && MOVES[id][4] < 0 ? id : (id === 'FUTURE_SIGHT' && MOVES.FUTURESIGHT ? 'FUTURESIGHT' : null);
    Object.keys(pool).forEach(pid => {
      const sp = SP[PM[pid]]; if (!sp) return;
      const [fast, charged, elite] = pool[pid], el = new Set(elite || []);
      const have = new Set(sp.q.concat(sp.c, sp.eq, sp.ec, sp.ex));
      fast.forEach(m => { const id = fid(m); if (id && !have.has(id)) { (el.has(m) ? sp.eq : sp.q).push(id); have.add(id); } });
      charged.forEach(m => { const id = cid(m); if (id && !have.has(id)) { (el.has(m) ? sp.ec : sp.c).push(id); have.add(id); } });
    });
  }
  mergePools(window.PVPOOL);
  try { mergePools(JSON.parse(localStorage.getItem(POOLKEY))); } catch (e) {}
  // Entwicklungen von Dynamax-Pokémon können auch dynamaxen (fehlt in den Spieldaten bei diesen)
  ['DARMANITAN_STANDARD', 'MEOWSTIC_FEMALE'].forEach(k => { if (SP[k] && !SP[k].m.includes('d')) SP[k].m.splice(1, 0, 'd'); });
  // Zacian (König des Schwertes), Zamazenta (König des Schildes) und Endynalos sind immer Dyna-Kämpfer
  ['ZACIAN_CROWNED_SWORD', 'ZAMAZENTA_CROWNED_SHIELD', 'ETERNATUS'].forEach(k => { if (SP[k]) SP[k].m = ['s']; });
  const HEALERS = new Set(['Blissey', 'Chansey']);
  const LCL = window.LC || [], LCBY = {}; LCL.forEach(x => { LCBY[x.id] = x; });
  const LCSORT = LCL.slice().sort((a, b) => a.n.localeCompare(b.n, 'de'));
  const LCIMG = x => 'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/LocationCards/' + x.img + '.png';
  const MODE_NAME = { n: 'Normal', d: 'Dynamax', g: 'Gigadynamax', s: 'Dyna (Spezial)' };
  const CLS_NAME = { L: 'Legendär', M: 'Mysteriös', U: 'Ultrabestie' };
  // Wetter-Boost ×1,2 für Attacken dieser Typen (Raids und Dyna-Kämpfe)
  const WEATHER = { '': ['Kein Wetter', []], sun: ['☀️ Sonnig/Klar', ['Feuer','Pflanze','Boden']], rain: ['🌧 Regen', ['Wasser','Elektro','Käfer']], pc: ['⛅ Teilweise bewölkt', ['Normal','Gestein']],
    cloud: ['☁️ Bewölkt', ['Fee','Kampf','Gift']], wind: ['💨 Windig', ['Drache','Flug','Psycho']], snow: ['❄️ Schnee', ['Eis','Stahl']], fog: ['🌫 Nebel', ['Unlicht','Geist']] };
  const BOSS_CPM = 0.79;

  // ---------- Attacken ----------
  const mv = id => { const x = MOVES[id]; return x ? { id, n: x[5] || x[0], en: x[0], t: x[1], p: x[2], d: x[3], e: x[4] } : null; };
  const isRandomType = id => /^HIDDEN_POWER/.test(id);
  const moveKind = (sp, id) => (sp.eq.includes(id) || sp.ec.includes(id)) ? 'elite' : sp.ex.includes(id) ? 'spezial' : '';
  const fastPool = sp => sp.q.concat(sp.eq);
  const chargedPool = sp => sp.c.concat(sp.ec, sp.ex);
  // Variante = Pokémon in einer Form (normal, Mega, Proto) mit eigenen Werten/Typen
  const baseVar = sp => ({ sp, t: sp.t, b: sp.b, img: sp.img, mega: null, label: '' });
  const megaVars = sp => (sp.mg || []).map(g => ({ sp, t: g.t, b: g.b, img: g.img, mega: g.id, label: g.n }));
  // Megas eines eigenen Pokémon: m.mega '' = nicht angegeben (alle möglichen), 'none' = keine, sonst die freigeschaltete Form
  const monMegaVars = m => { if (m.crypto || m.mega === 'none') return []; const all = megaVars(spOf(m)); return m.mega ? all.filter(v => v.mega === m.mega) : all; };
  const varName = v => (v.label ? v.label + ' ' : '') + v.sp.de + (v.sp.f ? ' (' + v.sp.f + ')' : '');

  // ---------- state ----------
  function blankMon(k) {
    const sp = SP[k];
    return { uid: 0, k, mode: sp.m[0], crypto: false, purified: false, lucky: false, shiny: false, fav: false,
      iv: ['', '', ''], wp: '', lvl: '', fast: '', c1: '', c2: '', ma: 1, mg: 0, ms: 0, added: Date.now() };
  }
  function migrate() {
    let old; try { old = JSON.parse(localStorage.getItem(OLDKEY)); } catch (e) { return null; }
    if (!old || !Array.isArray(old.mons) || !old.mons.length) return null;
    const s = { tol: old.tol ?? 5, mons: [], next: 1 };
    const crowned = { 'Zacian (Crowned Sword)': 'ZACIAN_CROWNED_SWORD', 'Zamazenta (Crowned Shield)': 'ZAMAZENTA_CROWNED_SHIELD' };
    old.mons.forEach(m => {
      let name = m.sp, mode = 'n';
      if (name.startsWith('G-Max ')) { name = name.slice(6); mode = 'g'; } else if (name.startsWith('Dynamax ')) { name = name.slice(8); mode = 'd'; }
      const sp = crowned[name] ? SP[crowned[name]] : DB.find(x => x.en === name && !x.f) || DB.find(x => x.en === name);
      if (!sp) return;
      if (!sp.m.includes(mode)) mode = sp.m.includes('s') ? 's' : 'n';
      const n = Object.assign(blankMon(sp.k), { mode, shiny: !!m.shiny, fav: !!m.fav, iv: m.iv || ['', '', ''], wp: m.wp || '', lvl: m.lvl || '', ma: m.ma ?? 1, mg: m.mg || 0, ms: m.ms || 0 });
      n.uid = s.next++; s.mons.push(n);
    });
    return s;
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.mons)) { s.mons = s.mons.filter(m => SP[m.k]); s.mons.forEach(m => { if (!SP[m.k].m.includes(m.mode)) m.mode = SP[m.k].m[0]; }); return s; } } catch (e) {}
    return migrate() || { tol: 5, mons: [], next: 1 };
  }
  let state = load();
  state.ui = state.ui || {};
  let backupTimer = null;
  // Eindeutige IDs, damit Mac und Handy sich beim Synchronisieren nicht in die Quere kommen
  const newUid = () => { let u; do { u = Date.now() * 100 + Math.floor(Math.random() * 100); } while (state.mons.some(m => m.uid === u)); return u; };
  // Änderungen pro Pokémon mit Zeitstempel versehen (für den Abgleich zwischen Geräten)
  let stampMap = null, stampG = null;
  const monSig = m => { const c = Object.assign({}, m); delete c.upd; return JSON.stringify(c); };
  function stamp(silent) {
    const now = Date.now(), cur = {}; state.del = state.del || {};
    state.mons.forEach(m => { const j = monSig(m); cur[m.uid] = j; if (stampMap && !silent && stampMap[m.uid] !== j) m.upd = now; });
    if (stampMap && !silent) Object.keys(stampMap).forEach(u => { if (!cur[u]) state.del[u] = now; });
    const g = JSON.stringify([state.tags || [], state.tol]); if (stampG !== null && g !== stampG && !silent) state.gupd = now; stampG = g;
    stampMap = cur;
  }
  stamp(true);
  const save = (silent) => {
    stamp(silent === true);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (silent !== true) syncSoon();
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => { if (window.rhNet && window.rhNet.backup) window.rhNet.backup(JSON.stringify(state)).then(r => { lastBackup = r; if (current === 'settings') renderBackup(); }).catch(() => {}); }, 4000);
  };
  let lastBackup = null;
  function renderBackup() {
    const el = document.getElementById('backupInfo'); if (!el) return;
    el.innerHTML = window.PP_WEB ? 'Am Handy läuft die Sicherung über den Mac (iCloud) und den Abgleich.' : !window.rhNet || !window.rhNet.backup ? 'Braucht die neue App-Version (einmal neu starten).' : lastBackup && lastBackup.ok ? '✔ Zuletzt gesichert ' + new Date(lastBackup.at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) + ' in <code>' + esc(lastBackup.dir) + '</code>' + (lastBackup.icloud ? ' (iCloud)' : ' (iCloud nicht gefunden, lokal)') : lastBackup ? '⚠ ' + esc(lastBackup.error || 'Fehler') : 'Wird nach der nächsten Änderung gesichert.';
  }
  const tol = () => (Number(state.tol) || 0) / 100;
  const spOf = m => SP[m.k];
  function addMon(k, mode) {
    const m = blankMon(k); m.uid = newUid();
    if (mode && SP[k].m.includes(mode)) m.mode = mode;
    state.mons.unshift(m); save(); return m;
  }

  // ---------- Werte ----------
  function cpmAt(l) {
    l = Math.max(1, Math.min(CPMT.length, Number(l)));
    const lo = Math.floor(l), hi = Math.ceil(l);
    if (lo === hi) return CPMT[lo - 1];
    const a = CPMT[lo - 1], b = CPMT[hi - 1];
    return Math.sqrt((a * a + b * b) / 2);
  }
  const ivs = m => m.iv.map(v => v === '' ? null : Number(v));
  const hasIV = m => ivs(m).every(v => v !== null);
  const ivPct = m => hasIV(m) ? Math.round(ivs(m).reduce((a, b) => a + b, 0) / 45 * 100) : null;
  const isHundo = m => hasIV(m) && ivs(m).every(v => v === 15);
  function cpFor(base, iv, l) {
    const c = cpmAt(l);
    return Math.max(10, Math.floor((base[0] + iv[0]) * Math.sqrt(base[1] + iv[1]) * Math.sqrt(base[2] + iv[2]) * c * c / 10));
  }
  // Level aus WP (Kumpel-Bonus: angezeigte WP gelten für Level +1)
  function levelFromWp(m) {
    if (!hasIV(m) || !m.wp) return null;
    const base = spOf(m).b, iv = ivs(m), wp = Number(m.wp), bb = m.buddy ? 1 : 0;
    for (let l = 1; l <= 50; l += 0.5) if (cpFor(base, iv, l + bb) === wp) return l;
    return null;
  }
  const wpFor = m => hasIV(m) && m.lvl ? cpFor(spOf(m).b, ivs(m), Number(m.lvl) + (m.buddy ? 1 : 0)) : null;
  function levelOf(m) {
    if (m.lvl) return { l: Number(m.lvl), src: m.lvlSrc || 'manual' };
    const w = levelFromWp(m);
    if (w) return { l: w, src: 'wp' };
    return { l: null, src: null };
  }
  // Werte eines Exemplars, optional in einer Mega-/Proto-Form
  function statsOf(m, v) {
    const lv = levelOf(m), base = (v || baseVar(spOf(m))).b, iv = hasIV(m) ? ivs(m) : [15, 15, 15];
    const sm = v && v.mega && Number(m.mlv) === 4 && superMaxOk(v.sp, v.mega) ? 2 : 0;
    const l = (lv.l || 40) + (m.buddy && lv.l ? 1 : 0) + sm, c = cpmAt(l), cr = m.crypto && m.mode === 'n' && !(v && v.mega);
    return { l: lv.l, src: lv.src, atk: (base[0] + iv[0]) * c * (cr ? 1.2 : 1), def: (base[1] + iv[1]) * c * (cr ? 5 / 6 : 1),
      hp: Math.max(10, Math.floor((base[2] + iv[2]) * c)), cp: cpFor(spOf(m).b, iv, l) };
  }
  const refStats = (b, crypto) => { const c = cpmAt(40); return { atk: (b[0] + 15) * c * (crypto ? 1.2 : 1), def: (b[1] + 15) * c * (crypto ? 5 / 6 : 1), hp: Math.floor((b[2] + 15) * c) }; };
  const eff = (at, defs) => defs.reduce((p, d) => p * ((CHART[at] || {})[d] || 1), 1);
  const stabT = (types, t) => types.includes(t) ? 1.2 : 1;
  const hit = (power, atk, def, mult) => Math.floor(0.5 * power * atk / def * mult) + 1;
  const wBoost = (t, w) => (WEATHER[w || ''] || WEATHER[''])[1].includes(t) ? 1.2 : 1;

  // ---------- Boss ----------
  // ctx = { boss: Variante oder {t,b}, w: Wetter, bf/bc: Boss-Attacken, megaBoost: Typen der Mega im Team }
  function bossDef(ctx) { return ctx && ctx.boss ? (ctx.boss.b[1] + 15) * BOSS_CPM : 150; }
  // Wie hart trifft der Boss dieses Pokémon (relativ). Mit gewählten Boss-Attacken genau, sonst Mittel über alle seine Attacken.
  function incoming(types, ctx) {
    if (!ctx || !ctx.boss) return 1;
    const boss = ctx.boss, bsp = boss.sp;
    let moves = [ctx.bf, ctx.bc].filter(Boolean).map(mv);
    if (!moves.length && bsp) moves = bsp.q.concat(bsp.c).map(mv);
    if (!moves.length) return Math.max(...boss.t.map(t => eff(t, types))) * (boss.b[0] + 15) * BOSS_CPM / 200;
    const avg = moves.reduce((s, x) => s + eff(x.t, types) * stabT(boss.t, x.t) * wBoost(x.t, ctx.w), 0) / moves.length;
    return avg * (boss.b[0] + 15) * BOSS_CPM / 200;
  }

  // ---------- Normale Raids ----------
  function cycle(types, atk, fId, cId, ctx) {
    const f = mv(fId), c = mv(cId);
    if (!f || !c || f.e <= 0 || c.e >= 0) return 0;
    const bdef = bossDef(ctx), bt = ctx && ctx.boss ? ctx.boss.t : [];
    const mb = t => !ctx || !ctx.megaBoost ? 1 : ctx.megaBoost.includes(t) ? 1.3 : 1.1;
    const mult = x => stabT(types, x.t) * eff(x.t, bt) * wBoost(x.t, ctx && ctx.w) * mb(x.t);
    const df = hit(f.p, atk, bdef, mult(f)), dc = hit(c.p, atk, bdef, mult(c));
    const n = -c.e / f.e;
    return (n * df + dc) / (n * f.d + c.d);
  }
  function raidScore(types, st, f, cs, ctx) {
    let best = { dps: 0, c: null };
    cs.filter(Boolean).forEach(c => { const d = cycle(types, st.atk, f, c, ctx); if (d > best.dps) best = { dps: d, c }; });
    const tdo = best.dps * st.hp * st.def / 900 / incoming(types, ctx);
    return { dps: best.dps, tdo, er: Math.pow(Math.pow(best.dps, 3) * Math.max(tdo, 0), 0.25), c: best.c };
  }
  function bestRaidSet(v, ctx, opts) {
    opts = opts || {};
    const sp = v.sp, st = opts.st || refStats(v.b, opts.crypto);
    let fs = (opts.noElite ? sp.q : fastPool(sp)).filter(x => !isRandomType(x));
    let cs = opts.noElite ? sp.c.concat(sp.ex) : chargedPool(sp);
    if (opts.type) { fs = fs.filter(f => mv(f).t === opts.type); cs = cs.filter(c => mv(c).t === opts.type); }
    let best = null;
    const plus = v.mega ? plusOf(sp, v.mega, opts.mlv || 4) : null;
    fs.forEach(f => cs.forEach(c => {
      const r = raidScore(v.t, st, f, plus ? [c, plus] : [c], ctx);
      if (!best || r.er > best.er) best = Object.assign(r, { f, c });
    }));
    return best;
  }

  // ---------- Dyna-Kämpfe ----------
  function maxMove(sp, mode, fId) {
    if (mode === 'g' && sp.gx) return { n: sp.gx[0], t: sp.gx[1] };
    const f = mv(fId); if (!f) return null;
    return { n: MAXNAME[f.t] || 'Dyna-Angriff', t: f.t };
  }
  const maxPower = (sp, mode, lvl) => ((mode === 'g' || sp.en === 'Eternatus') ? [350, 400, 450] : [250, 300, 350])[Math.max(1, Math.min(3, lvl || 1)) - 1];
  function maxDmg(sp, mode, fId, atk, lvl, bt, bdef, w) {
    const x = maxMove(sp, mode, fId); if (!x) return 0;
    return hit(maxPower(sp, mode, lvl), atk, bdef || 180, stabT(sp.t, x.t) * eff(x.t, bt || []) * wBoost(x.t, w));
  }
  function bestMaxFast(sp, mode, bt, noElite) {
    const fs = (noElite ? sp.q : fastPool(sp)).filter(x => !isRandomType(x));
    const ref = refStats(sp.b);
    let best = null;
    fs.forEach(f => {
      const m = mv(f), d = maxDmg(sp, mode, f, ref.atk, 3, bt);
      const fdps = hit(m.p, ref.atk, 180, stabT(sp.t, m.t) * eff(m.t, bt || [])) / m.d;
      // gleiche Max-Attacke (z. B. G-Max): die schnellere Sofortattacke lädt die Max-Leiste schneller
      const score = d * 1e6 - m.d * 1000 + fdps;
      if (!best || score > best.score) best = { f, d, fdps, score, mm: maxMove(sp, mode, f) };
    });
    return best;
  }
  const isMaxMode = m => m.mode !== 'n';
  const maxMons = () => state.mons.filter(isMaxMode);
  const effFast = m => m.fast || (isMaxMode(m) ? (bestMaxFast(spOf(m), m.mode, [], true) || {}).f : (bestRaidSet(baseVar(spOf(m)), null, { noElite: true }) || {}).f);
  const effCharged = m => [m.c1, m.c2].filter(Boolean).length ? [m.c1, m.c2].filter(Boolean) : [(bestRaidSet(baseVar(spOf(m)), null, { noElite: true }) || {}).c];
  const monMaxType = m => { const x = maxMove(spOf(m), m.mode, effFast(m)); return x ? x.t : null; };
  const monMaxDmg = (m, bt, bdef, w) => maxDmg(spOf(m), m.mode, effFast(m), statsOf(m).atk, m.ma, bt || [], bdef, w);
  const tankScore = (types, st, ctx) => st.def * st.hp / (ctx && ctx.boss ? incoming(types, ctx) / ((ctx.boss.b[0] + 15) * BOSS_CPM / 200) : 1);
  const BLISSEY = SP.BLISSEY;
  const tankNorm = BLISSEY ? tankScore(BLISSEY.t, refStats(BLISSEY.b), null) : 1;
  const tankPct = (types, st, ctx) => tankScore(types, st, ctx) / tankNorm * 100;

  function bestOfType(type) {
    const t = tol(), own = maxMons().filter(m => monMaxType(m) === type);
    if (!own.length) return null;
    own.sort((x, y) => monMaxDmg(y) * (y.shiny ? 1 + t : 1) - monMaxDmg(x) * (x.shiny ? 1 + t : 1));
    return own[0];
  }
  const isBestAtt = m => isMaxMode(m) && bestOfType(monMaxType(m)) === m;
  function roleOf(m) {
    const sp = spOf(m);
    if (!isMaxMode(m)) return 'raid';
    if (isBestAtt(m)) return 'att';
    if (HEALERS.has(sp.en)) return 'healer';
    if (tankPct(sp.t, refStats(sp.b), null) >= 55) return 'tank';
    return 'att';
  }
  const MAXCANDS = [];
  DB.forEach(sp => sp.m.filter(x => x !== 'n').forEach(mode => {
    const seen = {};
    fastPool(sp).filter(f => !isRandomType(f)).forEach(f => {
      const mm = maxMove(sp, mode, f); if (!mm) return;
      const d = maxDmg(sp, mode, f, refStats(sp.b).atk, 3, []);
      const o = seen[mm.t], dur = mv(f).d;
      // bei gleichem Max-Schaden: schnellere Sofortattacke (lädt die Max-Leiste schneller), dann ohne Elite-TM
      if (!o || o.d < d || (o.d === d && (dur < mv(o.f).d || (dur === mv(o.f).d && moveKind(sp, o.f) && !moveKind(sp, f))))) seen[mm.t] = { sp, mode, f, d, t: mm.t, mm };
    });
    Object.values(seen).forEach(x => MAXCANDS.push(x));
  }));
  function nextGoal(type) {
    const t = tol(), b = bestOfType(type), bd = b ? maxDmg(spOf(b), b.mode, effFast(b), refStats(spOf(b).b).atk, 3, []) : 0;
    const have = new Set(maxMons().map(m => m.k + '|' + m.mode));
    const c = MAXCANDS.filter(x => x.t === type && !have.has(x.sp.k + '|' + x.mode) && x.d > bd * (1 + t)).sort((a, b) => b.d - a.d)[0];
    return c ? Object.assign({ gain: bd ? Math.round((c.d / bd - 1) * 100) : null }, c) : null;
  }
  function ivRating(m, att) {
    if (!hasIV(m)) return null;
    const n = ivs(m), p = ivPct(m);
    let cls, txt;
    if (p === 100) { cls = 'top'; txt = '💯 Hundo'; } else if (p >= 96) { cls = 'top'; txt = '🔥 Top'; } else if (p >= 80) { cls = 'good'; txt = '👍 Gut'; }
    else if (p >= 67) { cls = 'ok'; txt = '🆗 Brauchbar'; } else { cls = 'weak'; txt = '🤏 Schwach'; }
    return { cls, txt: txt + ' (' + p + '%)' + (att && p >= 67 && n[0] < 10 ? ', Angriff eher niedrig' : '') };
  }

  // ---------- Kosten ----------
  // Aufleveln: 2 Power-ups pro Level. Glücks-Pokémon halber Sternenstaub, Crypto ×1,2, Erlöst ×0,9 (Bonbons und Staub).
  function levelCost(sp, m, from, to) {
    const up = sp.up || UPCOST, mul = m.crypto ? 1.2 : m.purified ? 0.9 : 1;
    let dust = 0, candy = 0, xl = 0;
    for (let l = Math.max(1, from); l < to; l += 0.5) {
      const i = Math.floor(l) - 1;
      dust += Math.ceil((up[1][i] || 0) * mul * (m.lucky ? 0.5 : 1));
      if (l < 40) candy += Math.ceil((up[0][i] || 0) * mul); else xl += Math.ceil((up[2][Math.floor(l) - 40] || 0) * mul);
    }
    return { dust, candy, xl };
  }
  // Dyna-Attacke-Stufen: Kosten aus dem Game Master je nach Gruppe des Pokémon
  function maxStepCost(sp, which, cur) {
    const g = BREAD[sp.bg] || BREAD.GROUP_1, s = (which === 'ma' ? g.a : g.b)[cur] || {};
    return { mp: s.mpCost || 0, candy: s.candyCost || 0, xl: s.xlCandyCost || 0, dust: s.stardustCost || 0 };
  }
  const fmtCost = c => [c.mp ? fmt(c.mp) + ' Dyna-Partikel' : '', c.dust ? fmt(c.dust) + ' Sternenstaub' : '', c.candy ? fmt(c.candy) + ' Bonbons' : '', c.xl ? fmt(c.xl) + ' Bonbons XL' : ''].filter(Boolean).join(' + ') || 'nichts';
  const addCost = (a, b) => ({ mp: (a.mp || 0) + (b.mp || 0), dust: (a.dust || 0) + (b.dust || 0), candy: (a.candy || 0) + (b.candy || 0), xl: (a.xl || 0) + (b.xl || 0) });

  // ---------- Ausbau ----------
  const MOVE_NAMES = { ma: 'Attacke', mg: 'Dyna-Wall', ms: 'Dyna-Kampfgeist' };
  const primaryKey = r => r === 'healer' ? 'ms' : r === 'tank' ? 'mg' : 'ma';
  const secondaryKey = r => r === 'healer' ? 'mg' : r === 'tank' ? 'ms' : null;
  function plan(m, role) {
    role = role || roleOf(m);
    const sp = spOf(m), lvl = levelOf(m).l || 0, lvTxt = l => lvl ? fmtCost(levelCost(sp, m, lvl, l)) : 'WP + IVs oder Level eintragen';
    const lvStep = l => ({ done: lvl >= l, txt: 'Auf Level ' + l + ' bringen', cost: lvTxt(l), c: lvl ? levelCost(sp, m, lvl, l) : {} });
    if (!isMaxMode(m)) {
      const steps = [lvStep(30), lvStep(40)];
      return { steps, next: steps.find(x => !x.done), doneCount: steps.filter(x => x.done).length };
    }
    const pk = primaryKey(role), sk = secondaryKey(role), mm = maxMove(sp, m.mode, effFast(m));
    const label = k => k === 'ma' ? (mm ? mm.n : 'Attacke') : MOVE_NAMES[k];
    const mstep = (k, target) => {
      const cur = m[k]; let c = {};
      for (let i = cur; i < target; i++) c = addCost(c, maxStepCost(sp, k, i));
      return { done: cur >= target, txt: label(k) + (cur <= 0 ? ' freischalten' : '') + (target > 1 ? ' auf Level ' + (target === 3 ? '3 (Max)' : target) : ''), cost: fmtCost(c), c };
    };
    const l30 = lvStep(30), l40 = lvStep(40);
    l40.c = lvl ? levelCost(sp, m, Math.max(lvl, 30), 40) : {}; l40.cost = lvl ? fmtCost(l40.c) : l40.cost;
    const steps = [l30, mstep(pk, 2), l40, mstep(pk, 3)];
    steps[3].c = {}; for (let i = Math.max(m[pk], 2); i < 3; i++) steps[3].c = addCost(steps[3].c, maxStepCost(sp, pk, i)); steps[3].cost = fmtCost(steps[3].c);
    if (sk) steps.push(mstep(sk, 3));
    return { steps, next: steps.find(x => !x.done), doneCount: steps.filter(x => x.done).length };
  }
  const planTotal = p => p.steps.filter(x => !x.done).reduce((a, x) => addCost(a, x.c || {}), {});

  // ---------- Darstellung ----------
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const typeTag = t => '<span class="type t-' + t + '">' + t + '</span>';
  const spName = sp => esc(sp.de) + (sp.f ? ' <span class="form">' + esc(sp.f) + '</span>' : '');
  const vName = v => (v.label ? '<span class="mega">' + esc(v.label) + '</span> ' : '') + spName(v.sp);
  const spPlain = sp => sp.de + (sp.f ? ' (' + sp.f + ')' : '') + (sp.de !== sp.en ? ' · ' + sp.en : '');
  const modeBadge = mode => mode === 'g' ? '<span class="gm">G-MAX</span>' : mode === 'd' ? '<span class="dm">DYNA</span>' : mode === 's' ? '<span class="dm">MAX</span>' : '';
  const imgId = (id, cls, shiny) => '<img class="' + (cls || 'spr') + '" src="' + ART + (shiny ? 'shiny/' : '') + id + '.png" alt="" loading="lazy">';
  const img = (sp, cls, shiny) => imgId(sp.img, cls, shiny);
  const roleTag = r => r === 'healer' ? '<span class="role heal">Heiler</span>' : r === 'tank' ? '<span class="role tank">Tank</span>' : '';
  const fmt = n => Math.round(n).toLocaleString('de-DE');
  const kindTag = (sp, id) => { const k = moveKind(sp, id); return k === 'elite' ? ' <span class="elite">Elite-TM</span>' : k === 'spezial' ? ' <span class="spez">Spezial</span>' : ''; };
  const moveOpt = (sp, id, sel) => { const x = mv(id), k = moveKind(sp, id); return '<option class="t-' + x.t + '" value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(x.n) + (x.en !== x.n ? ' · ' + esc(x.en) : '') + ' (' + x.t + ')' + (k === 'elite' ? ' · Elite-TM' : k === 'spezial' ? ' · Spezial' : '') + '</option>'; };
  // Pokémon-Bild, mit Ortshintergrund dahinter, wenn gesetzt
  function monPic(m, size) {
    const sp = spOf(m), b = m.bg && typeof bgById === 'function' ? bgById(m.bg) : null;
    const pic = img(sp, size === 'big' ? 'spr big' : 'spr', m.shiny);
    return b && b.img ? '<div class="sprbg ' + size + '" style="background-image:url(\'' + esc(b.img) + '\')" title="' + esc(b.n) + '">' + pic + '</div>' : pic;
  }
  const megaTag = m => m.mega && m.mega !== 'none' && (spOf(m).mg || []).some(g => g.id === m.mega) ? ' <span class="mt mgt" title="' + esc(MEGALV[m.mlv || 1]) + '">' + (m.mega === 'PRIMAL' ? 'Proto' : esc(spOf(m).mg.find(g => g.id === m.mega).n)) + ' L' + (m.mlv || 1) + '</span>' : '';
  const pvpTag = m => m.pvp ? '<span class="mt pvpt">PvP</span>' : '';
  const monTags = m => pvpTag(m) + ((m.tags || []).map(tg => '<span class="mt tg2">' + esc(tg) + '</span>').join('')) + (m.shiny ? '<span class="mt sh">✨</span>' : '') + (m.lucky ? '<span class="mt lu">Glück</span>' : '') + (m.crypto ? '<span class="mt cr">Crypto</span>' : '') + (m.purified ? '<span class="mt pu">Erlöst</span>' : '') + (isHundo(m) ? '<span class="mt hu">💯</span>' : '') + (m.fav ? '<span class="mt fv">★</span>' : '') + (m.buddy ? '<span class="mt bu">Kumpel</span>' : '') + (m.bg ? '<span class="mt bgt" title="' + esc((bgById(m.bg) || {}).n || '') + '">🖼 ' + esc(((bgById(m.bg) || {}).n || '').slice(0, 22)) + '</span>' : '');

  function renderSide() {
    const covered = TYPES.filter(t => bestOfType(t)).length;
    $('#sideStats').innerHTML = '<div class="stat"><b>' + state.mons.length + '</b><span>Meine Pokémon</span></div>' +
      '<div class="stat"><b>' + covered + '/18</b><span>Dyna-Typen abgedeckt</span></div>';
  }

  // ----- Übersicht (Max) -----
  function planCard(m, role) {
    const sp = spOf(m), p = plan(m, role), mm = maxMove(sp, m.mode, effFast(m));
    const dots = p.steps.map(x => '<i class="' + (x.done ? 'on' : '') + '"></i>').join('');
    const tag = role === 'att' && mm ? typeTag(mm.t) : roleTag(role);
    const next = p.next ? '<div class="next">➜ ' + esc(p.next.txt) + '</div><div class="cost">' + esc(p.next.cost) + '</div>' : '<div class="next done">✔ Fertig ausgebaut</div>';
    return '<div class="pcard' + (m.fav ? ' fav' : '') + '" data-goto="' + m.uid + '">' + img(sp, 'spr big', m.shiny) +
      '<div class="pc-body"><div class="pc-top"><b>' + modeBadge(m.mode) + spName(sp) + (m.shiny ? ' ✨' : '') + '</b>' + tag + '</div>' + next +
      '<div class="dots">' + dots + '<span>' + p.doneCount + '/' + p.steps.length + '</span></div></div></div>';
  }
  function sortPlan(list, role) {
    return list.map(m => ({ m, p: plan(m, role || roleOf(m)) })).sort((x, y) =>
      (y.m.fav - x.m.fav) || ((!!y.p.next) - (!!x.p.next)) || (x.p.doneCount - y.p.doneCount)).map(x => x.m);
  }
  function wantCard(sp, mode, sub, extra) {
    return '<div class="wcard">' + img(sp) + '<div class="grow"><b>' + modeBadge(mode) + spName(sp) + '</b><div class="sub">' + sub + '</div>' + (extra ? '<div class="sub">' + extra + '</div>' : '') + '</div>' +
      '<button class="add" data-add="' + sp.k + '" data-mode="' + mode + '" title="Hab ich, hinzufügen">＋</button></div>';
  }
  function renderOverview() {
    const mm = maxMons();
    $('#emptyHint').innerHTML = !mm.length ? '<div class="hint"><div>👋 Füge unter <b>Meine Pokémon</b> deine Pokémon hinzu und stell bei Dynamax oder Gigadynamax den Modus um. Dann zeigt dir die Übersicht, was du ausbauen und holen solltest.</div><button class="btn primary" data-open="mine">Pokémon hinzufügen</button></div>' : '';
    const covered = TYPES.filter(t => bestOfType(t)).length;
    const attPlan = TYPES.map(bestOfType).filter(Boolean);
    const tankPlan = mm.filter(m => !attPlan.includes(m) && roleOf(m) !== 'att');
    const plans = attPlan.map(m => plan(m, 'att')).concat(tankPlan.map(m => plan(m)));
    const total = plans.reduce((a, p) => addCost(a, planTotal(p)), {});
    $('#hero').innerHTML =
      '<div class="hstat"><b>' + covered + '<small>/18</small></b><span>Typen abgedeckt</span><div class="hbar"><i style="width:' + Math.round(covered / 18 * 100) + '%"></i></div></div>' +
      '<div class="hstat"><b>' + mm.length + '</b><span>Dynamax &amp; G-Max</span></div>' +
      '<div class="hstat"><b>' + plans.filter(p => !p.next).length + '/' + plans.length + '</b><span>fertig ausgebaut</span></div>' +
      '<div class="hstat wide2"><span>Noch nötig für den ganzen Plan</span><div class="costs">' +
        '<div><b>' + fmt(total.mp || 0) + '</b><small>Dyna-Partikel</small></div><div><b>' + fmt(total.dust || 0) + '</b><small>Sternenstaub</small></div><div><b>' + fmt(total.candy || 0) + '</b><small>Bonbons</small></div><div><b>' + fmt(total.xl || 0) + '</b><small>Bonbons XL</small></div></div></div>';
    const pa = sortPlan(attPlan, 'att'), pt = sortPlan(tankPlan);
    $('#planAtt').innerHTML = pa.length ? pa.slice(0, 8).map(m => planCard(m, 'att')).join('') + (pa.length > 8 ? '<div class="muted small">+ ' + (pa.length - 8) + ' weitere</div>' : '') : '<div class="empty">Noch keine Angreifer.</div>';
    $('#planTank').innerHTML = pt.length ? pt.slice(0, 8).map(m => planCard(m, roleOf(m))).join('') : '<div class="empty">Noch keine Tanks oder Heiler.</div>';
    const wants = TYPES.map(t => ({ t, g: nextGoal(t), covered: !!bestOfType(t) })).filter(x => x.g)
      .sort((x, y) => (x.covered - y.covered) || (y.g.d - x.g.d)).slice(0, 9);
    const tankWants = [];
    const tanksOwned = mm.filter(m => roleOf(m) === 'tank').length, healOwned = mm.filter(m => roleOf(m) === 'healer').length;
    if (tanksOwned < 2) DB.filter(sp => sp.m.some(x => x !== 'n') && !HEALERS.has(sp.en) && !mm.some(m => m.k === sp.k))
      .sort((a, b) => tankPct(b.t, refStats(b.b), null) - tankPct(a.t, refStats(a.b), null)).slice(0, 2 - tanksOwned).forEach(sp => tankWants.push(sp));
    if (!healOwned && BLISSEY) tankWants.push(BLISSEY);
    $('#wantList').innerHTML = wants.map(x => wantCard(x.g.sp, x.g.mode, typeTag(x.t) + ' ' + (x.covered ? '+' + x.g.gain + '% Schaden' : 'Typ noch offen'), esc(mv(x.g.f).n) + kindTag(x.g.sp, x.g.f) + ' → ' + esc(x.g.mm.n))).join('') +
      tankWants.map(sp => wantCard(sp, sp.m.includes('g') ? 'g' : sp.m.includes('d') ? 'd' : 's', roleTag(HEALERS.has(sp.en) ? 'healer' : 'tank'))).join('') || '<div class="empty">Alles da, was sich lohnt.</div>';
    $('#overviewCards').innerHTML = TYPES.map(t => {
      const b = bestOfType(t), g = nextGoal(t), show = b ? spOf(b) : (g && g.sp);
      return '<div class="card' + (b ? '' : ' open') + '" data-type="' + t + '">' + (show ? img(show, 'spr card-img' + (b ? '' : ' ghost'), !!b && b.shiny) : '') +
        '<div class="head">' + typeTag(t) + '</div><div class="lbl">Dein Bester</div><div class="val' + (b ? '' : ' none') + '">' + (b ? modeBadge(b.mode) + spName(spOf(b)) + (b.shiny ? ' ✨' : '') : 'noch nichts') + '</div>' +
        '<div class="goal' + (g ? '' : ' done') + '">' + (g ? 'Ziel: ' + modeBadge(g.mode) + spName(g.sp) + (g.gain !== null ? ' +' + g.gain + '%' : '') : '✔ Bestes da') + '</div></div>';
    }).join('');
  }

  // Mega/Proto-Einstellung eines eigenen Pokémon
  function megaRow(m) {
    const sp = spOf(m); if (!(sp.mg || []).length || m.mode !== 'n') return '';
    const isPrimal = sp.mg.some(g => g.id === 'PRIMAL'), word = isPrimal ? 'Proto' : 'Mega';
    const sel = '<select class="ssel" data-mset="mega" data-uid="' + m.uid + '"' + (m.crypto ? ' disabled' : '') + '><option value="">' + word + ': nicht angegeben</option><option value="none"' + (m.mega === 'none' ? ' selected' : '') + '>kein ' + word + ' freigeschaltet</option>' +
      sp.mg.map(g => '<option value="' + g.id + '"' + (m.mega === g.id ? ' selected' : '') + '>' + esc(isPrimal ? 'Proto-' + sp.de : g.n + '-' + sp.de) + '</option>').join('') + '</select>';
    const cur = m.mega && m.mega !== 'none' ? m.mega : null, canSM = cur ? superMaxOk(sp, cur) : sp.mg.some(g => superMaxOk(sp, g.id));
    const lv = m.mega === 'none' || m.crypto ? '' : '<select class="ssel" data-mset="mlv" data-uid="' + m.uid + '">' + [1, 2, 3, 4].filter(l => l < 4 || canSM).map(l => '<option value="' + l + '"' + (Number(m.mlv || 1) === l ? ' selected' : '') + '>' + word + '-Level ' + l + ' (' + MEGALV[l] + ')</option>').join('') + '</select>';
    const plus = cur ? plusOf(sp, cur, m.mlv || 1) : null;
    return '<div class="mon-row megarow">' + sel + lv + (plus ? '<span class="muted small2">Zusatz-Attacke als Mega: <b>' + esc(mv(plus).n) + '</b> (' + mv(plus).p + ' Stärke' + (Number(m.mlv) === 4 ? ', kämpft 2 Level höher' : '') + ')</span>' : m.crypto ? '<span class="muted small2">Crypto kann nicht ' + word + '-entwickeln</span>' : '') + '</div>';
  }

  // ----- Meine Pokémon: Liste + Detail -----
  function advice(m) {
    if (m.pvp) return pvpAdvice(m);
    const sp = spOf(m), out = [], t = tol(), st = statsOf(m), bv = baseVar(sp);
    if (!m.fast || !m.c1) out.push('<div class="adv warn">Trag die Attacken ein, die dein Pokémon hat. Bis dahin rechnet das Programm mit den besten ohne Elite-TM.</div>');
    if (isMaxMode(m)) {
      const best = bestMaxFast(sp, m.mode, []), bestNE = bestMaxFast(sp, m.mode, [], true);
      const cur = m.fast ? maxDmg(sp, m.mode, m.fast, st.atk, 3, []) : 0, curRef = m.fast ? maxDmg(sp, m.mode, m.fast, refStats(sp.b).atk, 3, []) : 0;
      const line = b => esc(mv(b.f).n) + kindTag(sp, b.f) + ' → ' + esc(b.mm.n) + ' ' + typeTag(b.mm.t);
      if (m.mode === 'g') {
        const bf = best.f === m.fast ? null : best;
        out.push('<div class="adv ok"><b>Dyna-Kämpfe:</b> ' + esc(sp.gx[0]) + ' ist fest. Die Schnell-Attacke lädt nur die Dyna-Anzeige' + (bf ? ', am schnellsten mit ' + esc(mv(bf.f).n) + kindTag(sp, bf.f) : ' ✔') + '.</div>');
      } else if (!m.fast || curRef < best.d) {
        const gain = curRef ? Math.round((best.d / curRef - 1) * 100) : null;
        out.push('<div class="adv up"><b>Dyna-Kämpfe besser:</b> ' + line(best) + (gain ? ' <span class="muted">(+' + gain + '% Dyna-Schaden)</span>' : '') +
          (moveKind(sp, best.f) === 'elite' && bestNE && bestNE.f !== best.f ? '<div class="sub">Ohne Elite-TM: ' + line(bestNE) + '</div>' : '') + '</div>');
      } else out.push('<div class="adv ok"><b>Dyna-Kämpfe:</b> ' + esc(mv(m.fast).n) + ' passt ✔ (' + esc(maxMove(sp, m.mode, m.fast).n) + ', ca. ' + cur + ' Schaden auf Max-Level)</div>');
    }
    const best = bestRaidSet(bv, null, { st }), bestNE = bestRaidSet(bv, null, { st, noElite: true });
    if (best) {
      const cur = m.fast && m.c1 ? raidScore(sp.t, st, m.fast, [m.c1, m.c2], null) : null;
      const set = b => esc(mv(b.f).n) + kindTag(sp, b.f) + ' / ' + esc(mv(b.c).n) + kindTag(sp, b.c);
      if (!cur || best.er > cur.er * (1 + Math.max(t, 0.02))) {
        out.push('<div class="adv up"><b>Raids besser:</b> ' + set(best) + (cur ? ' <span class="muted">(+' + Math.round((best.er / cur.er - 1) * 100) + '%)</span>' : '') +
          ((moveKind(sp, best.f) === 'elite' || moveKind(sp, best.c) === 'elite') && bestNE && (bestNE.f !== best.f || bestNE.c !== best.c) ? '<div class="sub">Ohne Elite-TM: ' + set(bestNE) + (cur && bestNE.er > cur.er * 1.02 ? ' (+' + Math.round((bestNE.er / cur.er - 1) * 100) + '%)' : '') + '</div>' : '') + '</div>');
      } else {
        // Toleranz greift nur für den Gesamtvergleich. Eine bessere Sofortattacke zu den eingetragenen Lade-Attacken zeigen wir immer.
        let bf = null;
        if (cur) fastPool(sp).filter(f => !isRandomType(f) && f !== m.fast).forEach(f => { const r = raidScore(sp.t, st, f, [m.c1, m.c2], null); if (r.er > cur.er * 1.01 && (!bf || r.er > bf.er)) bf = Object.assign(r, { f }); });
        out.push(bf ? '<div class="adv up"><b>Raids:</b> Lade-Attacken passen, aber <b>' + esc(mv(bf.f).n) + '</b>' + kindTag(sp, bf.f) + ' ist als Sofortattacke besser <span class="muted">(+' + Math.max(1, Math.round((bf.er / cur.er - 1) * 100)) + '%)</span></div>' : '<div class="adv ok"><b>Raids:</b> Attacken passen ✔</div>');
      }
    }
    if (sp.mg && !m.crypto && m.mega !== 'none') out.push('<div class="adv muted2">' + (m.mega ? 'Als ' + esc((sp.mg.find(g => g.id === m.mega) || {}).n || 'Mega') + ' (Level ' + (m.mlv || 1) + ')' : 'Kann ' + sp.mg.map(g => esc(g.n)).join(' / ')) + ': wird im Raid-Planer mit eingeplant (max. 1 Mega pro Team).</div>');
    return out.join('');
  }
  function costBlock(m) {
    const sp = spOf(m), l = levelOf(m).l;
    if (!l) return '<div class="muted small">Kosten: erst WP + IVs oder Level eintragen.</div>';
    const rows = [30, 40, 50].filter(x => x > l).map(x => '<tr><td>bis Lv ' + x + '</td><td>' + fmtCost(levelCost(sp, m, l, x)) + '</td></tr>');
    if (isMaxMode(m)) ['ma', 'mg', 'ms'].forEach(k => { let c = {}; for (let i = m[k]; i < 3; i++) c = addCost(c, maxStepCost(sp, k, i)); if (m[k] < 3) rows.push('<tr><td>' + MOVE_NAMES[k] + ' auf Max</td><td>' + fmtCost(c) + '</td></tr>'); });
    return rows.length ? '<table class="ctab">' + rows.join('') + '</table>' + (m.lucky ? '<div class="muted small">Glücks-Pokémon: halber Sternenstaub ist eingerechnet.</div>' : '') : '<div class="muted small">Voll ausgebaut.</div>';
  }
  function monDetail(m) {
    const sp = spOf(m), st = statsOf(m), role = roleOf(m), p = plan(m, role), r = ivRating(m, role === 'att' || role === 'raid');
    const sel = (k, min) => '<select data-k="' + k + '" data-uid="' + m.uid + '">' + [0, 1, 2, 3].filter(v => v >= min).map(v => '<option value="' + v + '"' + (m[k] === v ? ' selected' : '') + '>' + (v === 0 ? '–' : v === 3 ? 'Max' : v) + '</option>').join('') + '</select>';
    const lvInfo = st.l ? 'Lv ' + String(st.l).replace('.', ',') + (m.buddy ? ' (+1 Kumpel = ' + String(st.l + 1).replace('.', ',') + ')' : '') : 'Level unbekannt';
    const modes = sp.m.map(x => '<button class="seg' + (m.mode === x ? ' on' : '') + '" data-mode-set="' + x + '" data-uid="' + m.uid + '">' + MODE_NAME[x] + '</button>').join('');
    const mm = isMaxMode(m) ? maxMove(sp, m.mode, effFast(m)) : null;
    const tcls = id => id && mv(id) ? ' class="mvsel t-' + mv(id).t + '"' : ' class="mvsel"';
    const fastSel = '<select' + tcls(m.fast) + ' data-mv="fast" data-uid="' + m.uid + '"><option value="">– wählen –</option>' + fastPool(sp).map(id => moveOpt(sp, id, m.fast)).join('') + '</select>';
    const chSel = (k, none) => '<select' + tcls(m[k]) + ' data-mv="' + k + '" data-uid="' + m.uid + '"><option value="">' + none + '</option>' + chargedPool(sp).concat(m.crypto ? ['FRUSTRATION'] : [], m.purified ? ['RETURN'] : []).filter(id => k === 'c1' ? id !== m.c2 : id !== m.c1).map(id => moveOpt(sp, id, m[k])).join('') + '</select>';
    const chk = (k, label, dis) => '<label class="toggle small2' + (dis ? ' dis' : '') + '"><input type="checkbox" data-tog-c="' + k + '" data-uid="' + m.uid + '"' + (m[k] ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + label + '</label>';
    return '<div class="mon detail' + (m.fav ? ' fav' : '') + (m.shiny ? ' shiny' : '') + '" id="mon-' + m.uid + '">' +
      '<div class="mon-h">' + monPic(m, 'big') +
        '<div class="grow"><div class="mon-name">' + modeBadge(m.mode) + spName(sp) + megaTag(m) + ' ' + monTags(m) + '</div>' +
        '<div class="tags">' + sp.t.map(typeTag).join('') + roleTag(role) + (sp.cls ? '<span class="mmv">' + CLS_NAME[sp.cls] + '</span>' : '') + (mm ? '<span class="mmv">' + esc(mm.n) + '</span>' : '') + '</div></div>' +
        '<div class="mon-btns">' +
          '<button class="tg pvptg' + (m.pvp ? ' on' : '') + '" data-tog="pvp" data-uid="' + m.uid + '" title="Für PvP (Kampfliga) gedacht: Attacken-Tipps nach PvP-Meta">PvP</button>' +
          '<button class="tg' + (m.fav ? ' on' : '') + '" data-tog="fav" data-uid="' + m.uid + '" title="Will ich unbedingt nutzen">★</button>' +
          '<button class="tg sh' + (m.shiny ? ' on' : '') + '" data-tog="shiny" data-uid="' + m.uid + '" title="Shiny">✨</button>' +
          '<button class="tg del" data-del="' + m.uid + '" title="Entfernen">✕</button>' +
        '</div></div>' +
      '<div class="mon-row"><div class="segs">' + modes + '</div>' + chk('lucky', 'Glücks-Pokémon') + chk('crypto', 'Crypto', m.mode !== 'n' || m.purified) + chk('purified', 'Erlöst', m.crypto) + '</div>' +
      megaRow(m) +
      '<div class="mon-moves">' +
        '<label><span class="lbl3">Schnell</span>' + fastSel + '</label>' +
        '<label><span class="lbl3">Lade 1</span>' + chSel('c1', '– wählen –') + '</label>' +
        (m.c2 || m.show2 ? '<label><span class="lbl3">Lade 2</span>' + chSel('c2', '– keine –') + '</label>' : '<button class="btn mini" data-show2="' + m.uid + '">＋ Zweite Lade-Attacke</button>') +
      '</div>' +
      '<div class="advs">' + advice(m) + '</div>' +
      '<div class="ivbox">' + ['Angriff', 'Verteidigung', 'KP'].map((l, i) => {
          const v = m.iv[i] === '' ? null : Number(m.iv[i]);
          return '<div class="ivline"><span class="ivl">' + l + '</span><div class="ivbar' + (v === 15 ? ' full' : '') + '">' +
            Array.from({ length: 16 }, (_, k) => '<button class="ivc' + (v !== null && k <= v && k > 0 ? ' on' : '') + (k === 0 ? ' zero' + (v === 0 ? ' on0' : '') : '') + '" data-ivset="' + k + '" data-i="' + i + '" data-uid="' + m.uid + '" title="' + k + '"></button>').join('') +
            '</div><span class="ivv">' + (v === null ? '–' : v) + '</span></div>';
        }).join('') + '<button class="btn mini" data-hundo="' + m.uid + '">💯 15/15/15</button></div>' +
      '<div class="mon-row"><span class="lbl3">WP</span><input class="num wide" type="number" min="10" placeholder="WP" data-wp="' + m.uid + '" value="' + esc(m.wp) + '">' +
        '<span class="lbl3">Level</span><input class="num" type="number" min="1" max="50" step="0.5" placeholder="Lv" data-lvl="' + m.uid + '" value="' + esc(m.lvl) + '">' +
        '<label class="toggle small2"><input type="checkbox" data-tog-c="buddy" data-uid="' + m.uid + '"' + (m.buddy ? ' checked' : '') + '> Bester Kumpel (+1 Level)</label>' +
        '<span class="muted small2">' + (hasIV(m) ? 'Eins eingeben, das andere füllt sich selbst.' : 'Erst IVs setzen, dann rechnet es WP ↔ Level um.') + '</span></div>' +
      '<div class="mon-stats">' + (r ? '<span class="ivr ' + r.cls + '">' + r.txt + '</span>' : '<span class="muted">IVs eintragen</span>') +
        '<span>' + lvInfo + '</span>' + (st.l ? '<span>' + fmt(st.cp) + ' WP</span><span>' + st.hp + ' KP</span><span>Angr. ' + st.atk.toFixed(0) + '</span><span>Vert. ' + st.def.toFixed(0) + '</span>' : '') +
        (m.wp && hasIV(m) && st.src !== 'wp' ? '<span class="warn">WP passt nicht zu den IVs</span>' : '') + '</div>' +
      (isMaxMode(m) ? '<div class="mon-row"><span class="lbl3">Dyna-Attacken</span><label>⚔ ' + sel('ma', 1) + '</label><label>🛡 ' + sel('mg', 0) + '</label><label>💚 ' + sel('ms', 0) + '</label></div>' : '') +
      '<div class="mon-next ' + (p.next ? '' : 'done') + '">' + (p.next ? '➜ ' + esc(p.next.txt) + ' <span class="muted">· ' + esc(p.next.cost) + '</span>' : '✔ Fertig ausgebaut') + '</div>' +
      (m.caught || m.where ? '<div class="muted small2" style="margin-top:6px">Gefangen ' + (m.caught ? m.caught.split('-').reverse().join('.') : '') + (m.where ? ' in der Nähe von ' + esc(m.where) : '') + '</div>' : '') +
      '<h3 class="h3">PvP</h3><div class="pvd">' + [1500, 2500, 10000].map(l => { const r = myRank(m, l), el = eligible(m, l); return '<div><b>' + LEAGUES[l] + '</b><span>' + (!el ? 'WP über Limit' : r ? 'Rang ' + r.rank + ' (' + r.pct.toFixed(1) + '%)' + (l < 10000 ? ' · Lv ' + String(r.l).replace('.', ',') + ' = ' + fmt(r.cp) + ' WP' : '') : 'IVs fehlen') + '</span></div>'; }).join('') + '</div>' +
      '<h3 class="h3">Ortshintergrund</h3>' + bgBlock(m) +
      '<h3 class="h3">Eigene Markierungen</h3><div class="chips">' + ((state.tags || []).length ? state.tags.map(tg => '<button class="chip' + ((m.tags || []).includes(tg) ? ' on' : '') + '" data-tagt="' + esc(tg) + '" data-uid="' + m.uid + '">🏷 ' + esc(tg) + '</button>').join('') : '<span class="muted small2">Lege oben bei den Filtern eigene Markierungen an (z. B. „Tauschen“, „PvP“).</span>') + '</div>' +
      '<h3 class="h3">Kosten</h3>' + costBlock(m) +
    '</div>';
  }
  function monFilter() {
    const f = state.ui.mf || {};
    const q = ($('#mineSearch').value || '').trim().toLowerCase(), ty = $('#mineType').value, mo = $('#mineMode').value;
    return state.mons.filter(m => {
      const sp = spOf(m);
      if (q && !(sp.de + ' ' + sp.en + ' ' + (sp.f || '') + ' ' + sp.t.join(' ')).toLowerCase().includes(q)) return false;
      if (ty && !sp.t.includes(ty)) return false;
      if (mo === 'max' ? m.mode === 'n' : mo && m.mode !== mo) return false;
      if (f.hundo && !isHundo(m)) return false;
      if (f.iv80 && !(ivPct(m) >= 80)) return false;
      if (f.shiny && !m.shiny) return false;
      if (f.lucky && !m.lucky) return false;
      if (f.crypto && !m.crypto) return false;
      if (f.fav && !m.fav) return false;
      if (f.leg && !sp.cls) return false;
      if (f.mega && !sp.mg) return false;
      if (f.nomoves && m.fast && m.c1) return false;
      if (f.bg && !m.bg) return false;
      if ((state.ui.tf || []).length && !(state.ui.tf || []).every(tg => (m.tags || []).includes(tg))) return false;
      return true;
    });
  }
  function renderMine() {
    const f = state.ui.mf || {};
    $('#mineChips').innerHTML = [['hundo', '💯 Hundo'], ['iv80', 'IV ≥ 80%'], ['shiny', '✨ Shiny'], ['lucky', 'Glück'], ['crypto', 'Crypto'], ['fav', '★ Favoriten'], ['leg', 'Legendär/Myst.'], ['mega', 'Mega-fähig'], ['nomoves', 'Attacken fehlen'], ['bg', '🖼 Hintergrund']]
      .map(([k, l]) => '<button class="chip' + (f[k] ? ' on' : '') + '" data-mf="' + k + '">' + l + '</button>').join('');
    const tf = state.ui.tf || [];
    $('#tagChips').innerHTML = (state.tags || []).map(tg => '<span class="tagwrap"><button class="chip tag' + (tf.includes(tg) ? ' on' : '') + '" data-tagf="' + esc(tg) + '">🏷 ' + esc(tg) + ' <small>' + state.mons.filter(m => (m.tags || []).includes(tg)).length + '</small></button><button class="x" data-tagdel="' + esc(tg) + '" title="Markierung löschen">✕</button></span>').join('');
    const sort = $('#mineSort').value;
    const list = monFilter();
    // Werte aufsteigend, Richtung über den Knopf (Standard: absteigend)
    const key = { new: m => m.added || m.uid, name: m => spOf(m).de, iv: m => ivPct(m) ?? -1, cp: m => Number(m.wp) || (statsOf(m).l ? statsOf(m).cp : 0), dex: m => spOf(m).dex }[sort] || (m => Number(m.wp) || 0);
    const dir = state.ui.sortAsc ? 1 : -1;
    $('#mineDir').textContent = state.ui.sortAsc ? '↑ aufsteigend' : '↓ absteigend';
    list.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
    $('#mineCount').textContent = list.length + ' von ' + state.mons.length;
    const open = new Set(state.ui.open || []);
    $('#mineList').innerHTML = list.length ? '<div class="mlist">' + list.map(m => {
      const sp = spOf(m), st = statsOf(m), p = ivPct(m), isOpen = open.has(m.uid);
      return '<div class="mitem' + (isOpen ? ' open' : '') + '" id="item-' + m.uid + '"><div class="mrow" data-toggle="' + m.uid + '">' + monPic(m, 'small') +
        '<div class="mr-name"><b>' + modeBadge(m.mode) + spName(sp) + '</b><div class="sub">' + sp.t.map(typeTag).join('') + megaTag(m) + '</div></div>' +
        '<div class="mr-tags">' + monTags(m) + '</div>' +
        '<div class="mr-iv ' + (p === null ? 'muted' : p === 100 ? 'hu' : p >= 80 ? 'good' : '') + '">' + (p === null ? '–' : p + '%') + '<small>' + (hasIV(m) ? m.iv.join('/') : 'IV') + '</small></div>' +
        '<div class="mr-cp">' + (st.l ? fmt(st.cp) + ' WP' : '–') + '<small>' + (st.l ? 'Lv ' + String(st.l).replace('.', ',') : '') + '</small></div>' +
        '<div class="mr-mv">' + (m.fast ? esc(mv(m.fast).n) : '<span class="warn">?</span>') + ' / ' + (m.c1 ? esc(mv(m.c1).n) : '<span class="warn">?</span>') + (m.c2 ? ' / ' + esc(mv(m.c2).n) : '') + '</div>' +
        '<span class="chev">' + (isOpen ? '▴' : '▾') + '</span></div>' + (isOpen ? '<div class="mdetail">' + monDetail(m) + '</div>' : '') + '</div>';
    }).join('') + '</div>' : '<div class="empty big">' + (state.mons.length ? 'Nichts gefunden. Filter anpassen.' : 'Noch keine Pokémon. Klick auf <b>＋ Pokémon hinzufügen</b> oder importier deine Liste.') + '</div>';
    $('#openCount').textContent = open.size ? open.size + ' offen' : '';
  }
  // Aufklappen in der Liste: mehrere gleichzeitig offen, damit man vergleichen kann
  function toggleOpen(uid, force) {
    uid = Number(uid); const o = new Set(state.ui.open || []);
    if (force === true || (force === undefined && !o.has(uid))) o.add(uid); else o.delete(uid);
    state.ui.open = [...o]; save();
  }
  function showDetail(uid) {
    toggleOpen(uid, true);
    if (current !== 'mine') show('mine'); else renderMine();
    const el = document.getElementById('item-' + uid);
    if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); }
  }
  function closeDetail() {}

  // ----- Auswahl-Fenster mit Filtern -----
  const DBSORT = DB.slice().sort((a, b) => a.dex - b.dex || (a.f || '').localeCompare(b.f || ''));
  function renderPicker() {
    const pf = state.ui.pf || {};
    $('#pickChips').innerHTML = [['final', 'Endstufe'], ['L', 'Legendär'], ['M', 'Mysteriös'], ['U', 'Ultrabestie'], ['d', 'Dynamax'], ['g', 'G-Max'], ['mega', 'Mega/Proto'], ['sh', 'Crypto möglich'], ['form', 'Regionalformen']]
      .map(([k, l]) => '<button class="chip' + (pf[k] ? ' on' : '') + '" data-pf="' + k + '">' + l + '</button>').join('');
    const q = $('#pickSearch').value.trim().toLowerCase(), ty = $('#pickType').value;
    let list = DBSORT.filter(sp => {
      if (q && !(sp.de + ' ' + sp.en + ' ' + (sp.f || '') + ' ' + sp.t.join(' ') + ' #' + sp.dex).toLowerCase().includes(q)) return false;
      if (ty && !sp.t.includes(ty)) return false;
      if (pf.final && sp.evo) return false;
      if ((pf.L || pf.M || pf.U) && !(pf[sp.cls])) return false;
      if (pf.d && !sp.m.includes('d')) return false;
      if (pf.g && !sp.m.includes('g')) return false;
      if (pf.mega && !sp.mg) return false;
      if (pf.sh && !sp.sh) return false;
      if (pf.form && !(sp.f && /Alola|Galar|Hisui|Paldea/.test(sp.f))) return false;
      return true;
    });
    $('#pickCount').textContent = list.length + ' Pokémon';
    list = list.slice(0, 240);
    $('#pickList').innerHTML = list.map(sp => {
      const cnt = state.mons.filter(m => m.k === sp.k).length;
      return '<button class="pk" data-pick="' + sp.k + '">' + img(sp, 'spr big') + '<div class="pk-name"><small>#' + sp.dex + '</small> ' + spName(sp) + '</div>' +
        '<div class="pk-tags">' + sp.t.map(typeTag).join('') + '</div><div class="pk-tags">' + (sp.cls ? '<span class="mmv">' + CLS_NAME[sp.cls] + '</span>' : '') + (sp.m.includes('d') ? '<span class="dm">DYNA</span>' : '') + (sp.m.includes('g') ? '<span class="gm">G-MAX</span>' : '') + (sp.mg ? '<span class="mega">MEGA</span>' : '') + '</div>' + (cnt ? '<div class="pk-cnt">hast du ' + cnt + '×</div>' : '') + '</button>';
    }).join('') || '<div class="empty">Nichts gefunden.</div>';
  }
  function openPicker() { $('#picker').hidden = false; $('#pickSearch').value = ''; renderPicker(); setTimeout(() => $('#pickSearch').focus(), 30); }
  function closePicker() { $('#picker').hidden = true; }

  // ----- Boss-Auswahl -----
  const BOSSVARS = []; DBSORT.forEach(sp => { BOSSVARS.push(baseVar(sp)); megaVars(sp).forEach(v => BOSSVARS.push(v)); });
  const bossKey = v => v.sp.k + (v.mega ? '#' + v.mega : '');
  const BV = {}; BOSSVARS.forEach(v => { BV[bossKey(v)] = v; });
  function readBoss(prefix) {
    const k = $('#' + prefix + 'Sel').value;
    let boss = null;
    if (k && BV[k]) boss = BV[k];
    else { const t = [$('#' + prefix + 'T1').value, $('#' + prefix + 'T2').value].filter(Boolean); if (t.length) boss = { t, b: [200, 200, 200], virtual: true }; }
    return { boss, w: $('#' + prefix + 'W').value, bf: $('#' + prefix + 'F').value, bc: $('#' + prefix + 'C').value };
  }
  function fillBossMoves(prefix) {
    const k = $('#' + prefix + 'Sel').value, v = BV[k], f = $('#' + prefix + 'F'), c = $('#' + prefix + 'C');
    const keepF = f.value, keepC = c.value;
    if (!v) { f.innerHTML = '<option value="">Schnell: ?</option>'; c.innerHTML = '<option value="">Lade: ?</option>'; f.disabled = c.disabled = true; return; }
    f.disabled = c.disabled = false;
    f.innerHTML = '<option value="">Schnell: unbekannt</option>' + v.sp.q.map(id => '<option value="' + id + '">' + esc(mv(id).n) + ' (' + mv(id).t + ')</option>').join('');
    c.innerHTML = '<option value="">Lade: unbekannt</option>' + v.sp.c.map(id => '<option value="' + id + '">' + esc(mv(id).n) + ' (' + mv(id).t + ')</option>').join('');
    if (v.sp.q.includes(keepF)) f.value = keepF; if (v.sp.c.includes(keepC)) c.value = keepC;
  }
  const weakTo = bt => TYPES.filter(x => eff(x, bt) > 1.01).sort((x, y) => eff(y, bt) - eff(x, bt));
  function bossHead(ctx) {
    const boss = ctx.boss, w = weakTo(boss.t), wt = WEATHER[ctx.w || ''];
    const mvTxt = [ctx.bf, ctx.bc].filter(Boolean).map(id => esc(mv(id).n) + ' ' + typeTag(mv(id).t)).join(' · ');
    return '<div class="panel wide bosshead">' + (boss.virtual ? '' : imgId(boss.img, 'spr big')) + '<div><b>' + (boss.virtual ? 'Typen: ' : vName(boss)) + '</b> ' + boss.t.map(typeTag).join('') +
      '<div class="sub">Schwach gegen: ' + (w.length ? w.map(t => typeTag(t) + (eff(t, boss.t) > 2 ? '<small>×2,56</small>' : '') + (wBoost(t, ctx.w) > 1 ? '<small>☀︎ Wetter</small>' : '')).join(' ') : '–') + '</div>' +
      '<div class="sub">' + (mvTxt ? 'Boss-Attacken: ' + mvTxt : 'Boss-Attacken unbekannt: es wird mit dem Schnitt aller seiner Attacken gerechnet.') + (ctx.w ? ' · Wetter: ' + wt[0] + ' (' + wt[1].join(', ') + ' ×1,2)' : '') + '</div></div></div>';
  }

  // ----- Max Team-Planer -----
  function renderTeam() {
    const ctx = readBoss('boss'), out = $('#teamOut'), boss = ctx.boss;
    if (!boss) { out.innerHTML = '<div class="empty big">Wähl oben einen Boss oder Typen.</div>'; return; }
    const bt = boss.t, bdef = (boss.b[1] + 15) * BOSS_CPM;
    const atts = maxMons().map(m => ({ m, d: monMaxDmg(m, bt, bdef, ctx.w), e: eff(monMaxType(m), bt) })).sort((a, b) => b.d - a.d);
    const pick = [], used = new Set();
    for (const x of atts.filter(x => x.m.fav && x.e >= 1).concat(atts)) { if (pick.length >= 2) break; if (!used.has(x.m.uid)) { pick.push(x); used.add(x.m.uid); } }
    const tanks = maxMons().filter(m => !used.has(m.uid) && !HEALERS.has(spOf(m).en)).map(m => ({ m, p: tankPct(spOf(m).t, statsOf(m), ctx) * (1 + 0.05 * m.mg) })).sort((a, b) => b.p - a.p);
    const heal = maxMons().filter(m => !used.has(m.uid) && HEALERS.has(spOf(m).en)).map(m => ({ m, p: tankPct(spOf(m).t, statsOf(m), ctx) })).sort((a, b) => b.p - a.p)[0];
    const tank = tanks[0];
    const bestDB = MAXCANDS.map(x => ({ x, d: maxDmg(x.sp, x.mode, x.f, refStats(x.sp.b).atk, 3, bt, bdef, ctx.w) })).sort((a, b) => b.d - a.d).slice(0, 8);
    const bestTanks = DB.filter(sp => sp.m.some(x => x !== 'n')).map(sp => ({ sp, p: tankPct(sp.t, refStats(sp.b), ctx) })).sort((a, b) => b.p - a.p).slice(0, 4);
    const hard = !boss.virtual && (boss.sp.cls || (boss.sp.m || []).includes('g') || boss.b[0] > 250);
    const row = (m, txt) => '<div class="tm" data-detail="' + m.uid + '">' + img(spOf(m), 'spr big', m.shiny) + '<div class="grow"><b>' + modeBadge(m.mode) + spName(spOf(m)) + (m.fav ? ' ★' : '') + '</b><div class="sub">' + txt + '</div></div></div>';
    let html = bossHead(ctx) + '<div class="two">';
    html += '<div><h2 class="sub">⚔ Angreifer (für die Dyna-Phase einwechseln)</h2>' + (pick.length ? pick.map(x => row(x.m, esc(mv(effFast(x.m)).n) + ' → ' + esc(maxMove(spOf(x.m), x.m.mode, effFast(x.m)).n) + ' ' + typeTag(monMaxType(x.m)) + ' · ca. ' + fmt(x.d) + ' pro Dyna-Attacke' + (x.e > 1 ? ' · <b class="g">sehr effektiv</b>' : x.e < 1 ? ' · <span class="warn">nicht effektiv</span>' : ''))).join('') : '<div class="empty">Keine Dynamax-/G-Max-Pokémon.</div>') + '</div>';
    html += '<div><h2 class="sub">🛡 Start-Pokémon &amp; Heiler</h2>' + (tank ? row(tank.m, 'Tank, Dyna-Wall · Haltbarkeit ' + Math.round(tank.p) + ' (Heiteira neutral = 100)') : '<div class="empty">Kein Tank da.</div>') +
      (heal ? row(heal.m, 'Heiler, Dyna-Kampfgeist') : '') +
      '<div class="adv ' + (hard ? 'up' : 'ok') + '">' + (hard ? '💚 Starker Boss: nimm einen Heiler (Dyna-Kampfgeist) mit oder spielt zu zweit mit Heiler.' : '⚔ Eher schwacher Boss: lieber mehr Angreifer, Heiler ist optional.') + '</div>' +
      '<div class="sub small">Beste Tanks gegen diesen Boss: ' + bestTanks.map(x => spName(x.sp) + ' (' + Math.round(x.p) + ')').join(', ') + '</div></div></div>';
    html += '<h2 class="sub">Beste Angreifer aus der Datenbank gegen diesen Boss</h2><div class="rank">' + bestDB.map((y, i) => '<div class="rk"><span class="rk-n">' + (i + 1) + '</span>' + img(y.x.sp) + '<div class="grow"><b>' + modeBadge(y.x.mode) + spName(y.x.sp) + '</b><div class="sub">' + esc(mv(y.x.f).n) + kindTag(y.x.sp, y.x.f) + ' → ' + esc(y.x.mm.n) + ' ' + typeTag(y.x.t) + '</div></div><span class="dmg">' + fmt(y.d) + '</span><button class="add" data-add="' + y.x.sp.k + '" data-mode="' + y.x.mode + '" title="Hab ich">＋</button></div>').join('') + '</div>';
    const weakM = weakTo(bt).slice(0, 4).map(TYPKEY);
    if (weakM.length) html += '<h2 class="sub">Suchtext fürs Spiel</h2>' + searchBox('Dyna-Pokémon mit passendem Dyna-Angriff', 'dynamax,gigadynamax&' + weakM.map(t => '@1' + t).join(','), 'Bei Dynamax zählt der Typ der Schnell-Attacke. Gigadynamax-Pokémon prüf extra, deren Giga-Attacke ist fest.');
    out.innerHTML = html;
  }

  // ----- Normale Raids -----
  function raidOptionsOf(m, ctx) {
    // Varianten eines eigenen Pokémon: normal + (falls möglich) jede Mega/Proto-Form
    const sp = spOf(m), vs = [baseVar(sp)].concat(monMegaVars(m));
    return vs.map(v => {
      const st = statsOf(m, v), f = effFast(m), plus = v.mega ? plusOf(sp, v.mega, m.mlv || 1) : null, cs = effCharged(m).concat(plus ? [plus] : []);
      return { m, v, r: raidScore(v.t, st, f, cs, ctx), f, plus, best: bestRaidSet(v, ctx, { st, mlv: m.mlv || 1 }) };
    });
  }
  function pickTeam(ctx) {
    // 1) ohne Mega rechnen, 2) beste Mega als Teammitglied testen: sie bringt den anderen ×1,3 (gleicher Typ) bzw. ×1,1
    const evalTeam = mega => {
      const c2 = mega ? Object.assign({}, ctx, { megaBoost: mega.v.t }) : ctx;
      let rows = [];
      state.mons.forEach(m => raidOptionsOf(m, c2).forEach(o => { if (!o.v.mega) rows.push(o); }));
      rows = rows.filter(o => o.r.dps > 0 && (!mega || o.m !== mega.m)).sort((a, b) => b.r.er - a.r.er).slice(0, mega ? 5 : 6);
      const team = mega ? [mega].concat(rows) : rows;
      return { team, score: team.reduce((s, o) => s + o.r.er, 0) };
    };
    let best = evalTeam(null);
    const megas = [];
    state.mons.forEach(m => raidOptionsOf(m, ctx).forEach(o => { if (o.v.mega && o.r.dps > 0) megas.push(o); }));
    megas.sort((a, b) => b.r.er - a.r.er).slice(0, 5).forEach(mg => { const t = evalTeam(mg); if (t.score > best.score) best = t; });
    return best.team;
  }
  function liveBossesHtml() {
    const data = liveBosses();
    if (!data) return '<div class="muted small">Aktuelle Bosse werden geladen …</div>';
    if (!data.list.length) return '<div class="muted small">Aktuelle Bosse konnten nicht geladen werden.</div>';
    const groups = {};
    data.list.forEach(b => { (groups[b.tier] = groups[b.tier] || []).push(b); });
    return '<div class="live">' + Object.keys(groups).map(t => '<div class="lg"><span class="lt">' + esc(t.replace(' Raids', '').replace('-Star', '★')) + '</span>' + groups[t].map(b => b.key ? '<button class="chip boss" data-boss="' + b.key + '">' + imgId(BV[b.key].img, 'mini') + esc(b.label) + (b.shiny ? ' ✨' : '') + (BV[b.key] ? forMeTags(BV[b.key].sp.dex, b.shiny) : '') + '</button>' : '<span class="chip off">' + esc(b.name) + '</span>').join('') + '</div>').join('') +
      '<div class="muted small">Quelle: LeekDuck über ScrapedDuck · Stand ' + new Date(data.at).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' }) + '</div></div>';
  }
  function renderRaids() {
    $('#liveBosses').innerHTML = liveBossesHtml();
    const ctx = readBoss('rboss'), out = $('#raidOut');
    if (!ctx.boss) { out.innerHTML = '<div class="empty big">Wähl oben einen Raid-Boss oder Typen.</div>'; return; }
    const team = pickTeam(ctx), mega = team.find(o => o.v.mega);
    const ref = team.length ? Math.max(...team.map(o => o.r.er)) : 1;
    const dbBest = [];
    BOSSVARS.forEach(v => { const b = bestRaidSet(v, ctx); if (b) dbBest.push({ v, b }); if (v.sp.sh && !v.mega) { const c = bestRaidSet(v, ctx, { crypto: true }); if (c) dbBest.push({ v, b: c, crypto: true }); } });
    dbBest.sort((a, b) => b.b.er - a.b.er);
    const topDB = dbBest.slice(0, 15), refDB = topDB[0] ? topDB[0].b.er : 1;
    let html = bossHead(ctx);
    html += '<h2 class="sub">Dein bestes Team (6)</h2>' + (mega ? '<div class="adv ok">Mega im Team: ' + vName(mega.v) + (mega.m.mega ? ' (Level ' + (mega.m.mlv || 1) + ')' : ' <span class="muted">(ob du es freigeschaltet hast, kannst du beim Pokémon einstellen)</span>') + (mega.plus ? ', nutzt auch ' + esc(mv(mega.plus).n) : '') + ', gibt allen anderen +30% auf ' + mega.v.t.join('/') + '-Attacken und +10% auf alles andere.</div>' : '') +
      (team.length ? '<div class="rank">' + team.map((x, i) => {
        const better = x.best && x.best.er > x.r.er * 1.05 ? '<div class="sub up2">Besser hier: ' + esc(mv(x.best.f).n) + kindTag(x.v.sp, x.best.f) + ' / ' + esc(mv(x.best.c).n) + kindTag(x.v.sp, x.best.c) + ' (+' + Math.round((x.best.er / x.r.er - 1) * 100) + '%)</div>' : '';
        return '<div class="rk" data-detail="' + x.m.uid + '"><span class="rk-n">' + (i + 1) + '</span>' + imgId(x.v.img, 'spr', x.m.shiny) + '<div class="grow"><b>' + modeBadge(x.m.mode) + vName(x.v) + ' ' + monTags(x.m) + '</b><div class="sub">' + esc(mv(x.f).n) + ' / ' + esc(mv(x.r.c).n) + (x.m.fast && x.m.c1 ? '' : ' <span class="warn">(Attacken nicht eingetragen)</span>') + '</div>' + better + '</div>' +
          '<span class="dmg">DPS ' + x.r.dps.toFixed(1) + '</span><div class="bar"><i style="width:' + Math.round(x.r.er / ref * 100) + '%"></i></div></div>';
      }).join('') + '</div>' : '<div class="empty">Noch keine Pokémon eingetragen.</div>');
    html += '<h2 class="sub">Die Besten aus der Datenbank (Lv 40, 15/15/15)</h2><div class="rank">' + topDB.map((x, i) => '<div class="rk"><span class="rk-n">' + (i + 1) + '</span>' + imgId(x.v.img) + '<div class="grow"><b>' + vName(x.v) + (x.crypto ? ' <span class="mt cr">Crypto</span>' : '') + '</b><div class="sub">' + esc(mv(x.b.f).n) + kindTag(x.v.sp, x.b.f) + ' / ' + esc(mv(x.b.c).n) + kindTag(x.v.sp, x.b.c) + '</div></div><span class="dmg">DPS ' + x.b.dps.toFixed(1) + '</span><div class="bar"><i style="width:' + Math.round(x.b.er / refDB * 100) + '%"></i></div><button class="add" data-add="' + x.v.sp.k + '" data-mode="n" data-crypto="' + (x.crypto ? 1 : '') + '" title="Hab ich">＋</button></div>').join('') + '</div>';
    const weak = weakTo(ctx.boss.t).slice(0, 4).map(TYPKEY);
    if (weak.length) html += '<h2 class="sub">Suchtexte fürs Spiel</h2>' + (team.length ? searchBox('Dein Team aus der Box', dexList(team.map(x => x.v.sp.dex)) + (team.some(x => x.m.crypto) ? '' : '&!crypto'), 'Pokédex-Nummern deiner 6. Bei mehreren gleichen nimm das mit dem höchsten WP.') : '') +
      searchBox('Alle Konter mit passenden Attacken', weak.map(t => '@1' + t).join(',') + '&' + weak.map(t => '@2' + t + ',@3' + t).join(','), 'Schnell-Attacke UND eine Lade-Attacke vom Typ ' + weak.join('/') + '.');
    out.innerHTML = html;
  }

  // ----- Aktuelle Raid-Bosse (live) -----
  let live = null;
  try { live = JSON.parse(localStorage.getItem(BOSSCACHE)); } catch (e) {}
  function mapLive(raw) {
    return raw.map(b => {
      const m = /pm(\d+)(?:\.f([A-Z0-9_]+))?\.icon/.exec(b.image || '') || [];
      const dex = Number(m[1]), form = m[2] || '';
      let name = b.name.replace(/^Shadow /, ''), key = null;
      const cands = DB.filter(sp => sp.dex === dex);
      let sp = null, mega = null;
      if (/^MEGA|PRIMAL/.test(form)) { sp = cands.find(x => !x.f) || cands[0]; mega = form.replace('MEGA', 'MEGA'); }
      else if (form) sp = cands.find(x => x.k.endsWith('_' + form)) || cands.find(x => !x.f) || cands[0];
      else sp = cands.find(x => !x.f) || cands[0];
      if (sp) {
        key = sp.k;
        if (mega && sp.mg) { const g = sp.mg.find(g => g.id === mega) || sp.mg[0]; key += '#' + g.id; }
      }
      return { name: b.name, tier: b.tier, shiny: b.canBeShiny, key: key && BV[key] ? key : null, label: (/^Shadow /.test(b.name) ? 'Crypto ' : '') + (key && BV[key] ? varName(BV[key]) : name) };
    });
  }
  const liveBosses = () => live;
  function loadLive(force) {
    if (live && !force && Date.now() - live.at < 3 * 3600 * 1000) return;
    fetch(RAIDS_URL, { cache: 'no-store' }).then(r => r.json()).then(raw => {
      live = { at: Date.now(), list: mapLive(raw) };
      try { localStorage.setItem(BOSSCACHE, JSON.stringify(live)); } catch (e) {}
      if (current === 'raids') renderRaids();
    }).catch(() => { if (!live) live = { at: Date.now(), list: [] }; if (current === 'raids') renderRaids(); });
  }

  // ----- Ranglisten -----
  function renderRanking() {
    const t = $('#rankType').value;
    if (t === 'Tanks') {
      const list = DB.filter(sp => sp.m.some(x => x !== 'n')).map(sp => ({ sp, p: tankPct(sp.t, refStats(sp.b), null) })).sort((a, b) => b.p - a.p).slice(0, 25);
      $('#rankList').innerHTML = '<div class="rank">' + list.map((x, i) => '<div class="rk"><span class="rk-n">' + (i + 1) + '</span>' + img(x.sp) + '<div class="grow"><b>' + spName(x.sp) + '</b> ' + roleTag(HEALERS.has(x.sp.en) ? 'healer' : 'tank') + '<div class="sub">' + x.sp.t.map(typeTag).join('') + '</div></div><span class="dmg">' + Math.round(x.p) + '</span><button class="add" data-add="' + x.sp.k + '" data-mode="' + (x.sp.m.includes('g') ? 'g' : x.sp.m.includes('d') ? 'd' : 's') + '">＋</button></div>').join('') + '</div>';
      return;
    }
    const list = MAXCANDS.filter(x => x.t === t).sort((a, b) => b.d - a.d).slice(0, 20), top = list[0] ? list[0].d : 1;
    const own = new Set(maxMons().map(m => m.k + '|' + m.mode));
    $('#rankList').innerHTML = '<div class="rank">' + list.map((x, i) => '<div class="rk' + (own.has(x.sp.k + '|' + x.mode) ? ' own' : '') + '"><span class="rk-n">' + (i + 1) + '</span>' + img(x.sp) + '<div class="grow"><b>' + modeBadge(x.mode) + spName(x.sp) + '</b><div class="sub">' + esc(mv(x.f).n) + kindTag(x.sp, x.f) + ' → ' + esc(x.mm.n) + '</div></div><span class="dmg">' + x.d + '</span><div class="bar"><i style="width:' + Math.round(x.d / top * 100) + '%"></i></div><button class="add" data-add="' + x.sp.k + '" data-mode="' + x.mode + '">＋</button></div>').join('') + '</div>';
  }
  function renderRRanking() {
    const t = $('#rrankType').value, showMega = $('#rrMega').checked, showCr = $('#rrCrypto').checked;
    const rows = [];
    BOSSVARS.forEach(v => {
      if (v.mega && !showMega) return;
      const b = bestRaidSet(v, null, { type: t }); if (b) rows.push({ v, b });
      if (showCr && !v.mega && v.sp.sh) { const c = bestRaidSet(v, null, { type: t, crypto: true }); if (c) rows.push({ v, b: c, crypto: true }); }
    });
    const list = rows.sort((a, b) => b.b.er - a.b.er).slice(0, 30), top = list[0] ? list[0].b.er : 1;
    const own = new Set(state.mons.map(m => m.k + (m.crypto ? '|c' : '')));
    $('#rrankList').innerHTML = '<div class="rank">' + list.map((x, i) => '<div class="rk' + (own.has(x.v.sp.k + (x.crypto ? '|c' : '')) ? ' own' : '') + '"><span class="rk-n">' + (i + 1) + '</span>' + imgId(x.v.img) + '<div class="grow"><b>' + vName(x.v) + (x.crypto ? ' <span class="mt cr">Crypto</span>' : '') + '</b><div class="sub">' + esc(mv(x.b.f).n) + kindTag(x.v.sp, x.b.f) + ' / ' + esc(mv(x.b.c).n) + kindTag(x.v.sp, x.b.c) + '</div></div><span class="dmg">DPS ' + x.b.dps.toFixed(1) + '</span><div class="bar"><i style="width:' + Math.round(x.b.er / top * 100) + '%"></i></div><button class="add" data-add="' + x.v.sp.k + '" data-mode="n" data-crypto="' + (x.crypto ? 1 : '') + '">＋</button></div>').join('') + '</div>';
  }

  // ---------- Import (Poke Genie / Calcy IV / CSV) ----------
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const MOVEBYNAME = {}; Object.keys(MOVES).forEach(id => { const x = MOVES[id]; [x[0], x[5]].filter(Boolean).forEach(n => { const k = norm(n); (MOVEBYNAME[k] = MOVEBYNAME[k] || []).push(id); }); });
  const NAMEMAP = {}; DB.forEach(sp => [sp.de, sp.en].forEach(n => { const k = norm(n); (NAMEMAP[k] = NAMEMAP[k] || []).push(sp); }));
  const FORMWORDS = [['alola', 'ALOLA'], ['galar', 'GALARIAN'], ['hisui', 'HISUIAN'], ['paldea', 'PALDEA'], ['origin', 'ORIGIN'], ['ur', 'ORIGIN'], ['therian', 'THERIAN'], ['tiergeist', 'THERIAN'], ['incarnate', 'INCARNATE'], ['inkarnation', 'INCARNATE'], ['altered', 'ALTERED'], ['wandel', 'ALTERED'], ['crowned', 'CROWNED'], ['konig', 'CROWNED'], ['rapid', 'RAPID_STRIKE'], ['fliessend', 'RAPID_STRIKE'], ['single', 'SINGLE_STRIKE'], ['fokus', 'SINGLE_STRIKE'], ['black', 'BLACK'], ['schwarz', 'BLACK'], ['white', 'WHITE'], ['weiss', 'WHITE'], ['dusk', 'DUSK_MANE'], ['abend', 'DUSK_MANE'], ['dawn', 'DAWN_WINGS'], ['morgen', 'DAWN_WINGS'], ['hero', 'HERO'], ['held', 'HERO'], ['sky', 'SKY'], ['zenit', 'SKY'], ['attack', 'ATTACK'], ['angriff', 'ATTACK'], ['defense', 'DEFENSE'], ['verteid', 'DEFENSE'], ['speed', 'SPEED'], ['initiativ', 'SPEED']];
  function findSpecies(name, form, dex) {
    const nf = norm(form) + ' ' + norm(name);
    let cands = dex ? DB.filter(sp => sp.dex === dex) : [];
    if (!cands.length) {
      const k = norm(String(name).replace(/^(shadow|crypto|purified|erlost|erlöst|mega|dynamax|gigantamax|gigadynamax|g-max)\s+/i, ''));
      cands = NAMEMAP[k] || Object.keys(NAMEMAP).filter(x => x && k.startsWith(x)).sort((a, b) => b.length - a.length).map(x => NAMEMAP[x])[0] || [];
    }
    if (!cands.length) return null;
    for (const [w, f] of FORMWORDS) if (nf.includes(w)) { const c = cands.find(sp => sp.k.includes(f)); if (c) return c; }
    return cands.find(sp => !sp.f) || cands[0];
  }
  function findMove(name, pool) {
    const ids = MOVEBYNAME[norm(name)] || [];
    return ids.find(id => pool.includes(id)) || '';
  }
  function importCSV(text) {
    const rows = parseCSV(text.replace(/^﻿/, ''));
    if (rows.length < 2) return { ok: 0, skip: 0, dup: 0, msg: 'Keine Daten gefunden.' };
    const H = rows[0].map(h => norm(h));
    const col = (...keys) => { for (const k of keys) { const i = H.findIndex(h => h === k); if (i >= 0) return i; } for (const k of keys) { const i = H.findIndex(h => h.includes(k)); if (i >= 0) return i; } return -1; };
    const c = { name: col('name', 'pokemon', 'species', 'art'), form: col('form'), dex: col('pokemonnumber', 'nr', 'dex', 'number', 'pokedex'), cp: col('cp', 'wp'),
      a: col('ativ', 'attackiv', 'atkiv', 'angriffiv', 'ivatk', 'ivatt', 'atk'), d: col('defiv', 'defenseiv', 'verteidigungiv', 'ivdef', 'def'), s: col('staiv', 'staminaiv', 'hpiv', 'kpiv', 'ivsta', 'ivhp', 'sta'),
      lvl: col('levelmin', 'level', 'lvl'), f: col('quickmove', 'fastmove', 'fastattack', 'schnellattacke', 'quick'), c1: col('chargemove', 'chargedmove', 'specialmove', 'ladeattacke', 'charge'),
      c2: col('chargemove2', 'chargedmove2', 'specialmove2', 'ladeattacke2'), lucky: col('lucky', 'glucks', 'gluck'), shadow: col('shadowpurified', 'shadow', 'crypto'), shiny: col('shiny'), fav: col('favorite', 'favorit'), dyna: col('dynamax', 'gigantamax', 'gmax') };
    if (c.c2 === c.c1) c.c2 = -1;
    const yes = v => /^(1|true|yes|ja|y|x|✓)$/i.test(String(v || '').trim());
    let ok = 0, skip = 0, dup = 0; const unknown = [];
    rows.slice(1).forEach(r => {
      const g = i => i >= 0 ? (r[i] || '').trim() : '';
      const sp = findSpecies(g(c.name), g(c.form), Number(g(c.dex)) || 0);
      if (!sp) { skip++; if (unknown.length < 8) unknown.push(g(c.name)); return; }
      const m = blankMon(sp.k);
      m.iv = [g(c.a), g(c.d), g(c.s)].map(v => v === '' || isNaN(Number(v)) ? '' : Math.max(0, Math.min(15, Math.round(Number(v)))));
      if (Number(g(c.cp))) m.wp = Math.round(Number(g(c.cp)));
      const lv = parseFloat(g(c.lvl).replace(',', '.')); if (lv) m.lvl = Math.round(lv * 2) / 2;
      const lw = levelFromWp(m); if (lw) { m.lvl = lw; m.lvlSrc = 'wp'; }
      m.fast = findMove(g(c.f), fastPool(sp)); m.c1 = findMove(g(c.c1), chargedPool(sp)); m.c2 = c.c2 >= 0 ? findMove(g(c.c2), chargedPool(sp)) : '';
      if (m.c2 === m.c1) m.c2 = '';
      m.lucky = yes(g(c.lucky)); m.shiny = yes(g(c.shiny)); m.fav = yes(g(c.fav));
      const sh = g(c.shadow).toLowerCase();
      if (sh === '1' || /shadow|crypto/.test(sh)) m.crypto = true; else if (sh === '2' || /purif|erl/.test(sh)) m.purified = true;
      const dy = g(c.dyna).toLowerCase(), nm = g(c.name).toLowerCase();
      if ((/giga|g-max|gmax/.test(dy) || /^(gigantamax|gigadynamax|g-max)/.test(nm)) && sp.m.includes('g')) m.mode = 'g';
      else if ((yes(dy) || /dyna/.test(dy) || /^dynamax/.test(nm)) && sp.m.includes('d')) m.mode = 'd';
      if (state.mons.some(x => x.k === m.k && String(x.wp) === String(m.wp) && x.iv.join() === m.iv.join() && m.wp)) { dup++; return; }
      m.uid = newUid(); state.mons.unshift(m); ok++;
    });
    save();
    return { ok, skip, dup, unknown };
  }

  // ---------- News aus mehreren Quellen (über die App selbst geladen, nicht über den Browser) ----------
  const NEWSSRC = {
    official: { name: 'Pokémon GO (offiziell, deutsch)', url: 'https://pokemongo.com/de/news', kind: 'official' },
    hub: { name: 'Pokémon GO Hub', url: 'https://pokemongohub.net/feed', kind: 'rss' }
  };
  const NEWSCACHE = 'raidhelfer-news';
  let news = null; try { news = JSON.parse(localStorage.getItem(NEWSCACHE)); } catch (e) {}
  const srcOn = k => !(state.ui.srcOff || []).includes(k);
  function parseNews(kind, text, srcKey) {
    const doc = new DOMParser().parseFromString(text, kind === 'rss' ? 'text/xml' : 'text/html');
    const out = [];
    if (kind === 'rss') {
      doc.querySelectorAll('item').forEach(it => {
        const g = t => (it.getElementsByTagName(t)[0] || {}).textContent || '';
        const html = g('content:encoded') || g('description');
        const im = /<img[^>]+src="([^"]+)"/.exec(html);
        out.push({ src: srcKey, title: g('title'), link: g('link'), date: g('pubDate') ? new Date(g('pubDate')).getTime() : 0, img: im ? im[1] : '', cat: [...it.getElementsByTagName('category')].map(c => c.textContent).slice(0, 3) });
      });
    } else {
      const seen = new Set();
      doc.querySelectorAll('a[href*="/news/"]').forEach(a => {
        const href = new URL(a.getAttribute('href'), 'https://pokemongo.com').href;
        if (!/\/news\/[^/?#]+/.test(href) || seen.has(href)) return;
        const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (title.length < 12) return;
        seen.add(href);
        const im = a.querySelector('img');
        out.push({ src: srcKey, title, link: href, date: 0, img: im ? (im.getAttribute('src') || '') : '', cat: [] });
      });
    }
    return out;
  }
  function loadNews(force) {
    if (!window.rhNet) return;
    if (news && !force && Date.now() - news.at < 2 * 3600 * 1000) return;
    const keys = Object.keys(NEWSSRC).filter(srcOn);
    Promise.all(keys.map(k => window.rhNet.get(NEWSSRC[k].url).then(r => r && r.ok ? { k, items: parseNews(NEWSSRC[k].kind, r.text, k) } : { k, err: (r && (r.error || r.status)) || 'Fehler' }).catch(e => ({ k, err: String(e) }))))
      .then(res => {
        news = { at: Date.now(), items: [], status: {} };
        res.forEach(r => { news.status[r.k] = r.err ? 'Fehler: ' + r.err : r.items.length + ' Beiträge'; (r.items || []).forEach(i => news.items.push(i)); });
        try { localStorage.setItem(NEWSCACHE, JSON.stringify(news)); } catch (e) {}
        if (current === 'events') renderEvents();
        if (current === 'settings') renderSources();
      });
  }
  function renderNews(out) {
    if (!window.rhNet) { out.innerHTML = '<div class="empty">News brauchen die neue App-Version (einmal neu starten).</div>'; return; }
    loadNews();
    if (!news) { out.innerHTML = '<div class="empty big">Lade News …</div>'; return; }
    const items = news.items.filter(i => srcOn(i.src));
    const off = items.filter(i => i.src === 'official'), rest = items.filter(i => i.src !== 'official').sort((a, b) => b.date - a.date);
    const card = i => '<a class="evc" href="' + esc(i.link) + '" target="_blank">' + (i.img ? '<img class="evimg" src="' + esc(i.img) + '" alt="" loading="lazy">' : '') + '<div class="evb"><span class="evt" style="background:' + (i.src === 'official' ? '#e5484d' : '#58a6ff') + '">' + esc(NEWSSRC[i.src].name) + '</span><b>' + esc(i.title) + '</b><div class="sub">' + (i.date ? new Date(i.date).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' }) : '') + (i.cat.length ? ' · ' + esc(i.cat.join(', ')) : '') + '</div></div></a>';
    out.innerHTML = (off.length ? '<h2 class="sub">📣 Offizielle News</h2><div class="evgrid">' + off.slice(0, 12).map(card).join('') + '</div>' : '') +
      (rest.length ? '<h2 class="sub">📰 Pokémon GO Hub</h2><div class="evgrid">' + rest.slice(0, 24).map(card).join('') + '</div>' : '') +
      (!items.length ? '<div class="empty">Keine News geladen. Quellen in den Einstellungen prüfen.</div>' : '') +
      '<div class="muted small">Stand ' + new Date(news.at).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' }) + '</div>';
  }
  function renderSources() {
    const st = (news && news.status) || {};
    $('#srcList').innerHTML = '<div class="src"><b>LeekDuck</b> (über ScrapedDuck): Events, Kalender, Raid-Bosse, Eier, Feldforschung <span class="pill p-have">immer an</span></div>' +
      Object.keys(NEWSSRC).map(k => '<label class="src"><input type="checkbox" data-src="' + k + '"' + (srcOn(k) ? ' checked' : '') + '> <b>' + esc(NEWSSRC[k].name) + '</b> <span class="muted small2">' + esc(st[k] || (window.rhNet ? 'noch nicht geladen' : 'braucht App-Neustart')) + '</span></label>').join('');
  }

  // ---------- Für dich: Shiny fehlt / hast du noch nicht ----------
  const ldDex = img => { const m = /pm(\d+)|pokemon_icon_(\d+)/.exec(img || ''); return m ? Number(m[1] || m[2]) : 0; };
  function ownInfo(dex) { const own = state.mons.filter(m => spOf(m).dex === dex); return { has: own.length > 0, shiny: own.some(m => m.shiny) }; }
  function forMeTags(dex, canShiny) {
    const o = ownInfo(dex), out = [];
    if (!o.has) out.push('<span class="fm neu">🆕 fehlt dir</span>');
    if (canShiny && !o.shiny) out.push('<span class="fm sh">✨ Shiny fehlt</span>');
    return out.join('');
  }
  function monsOfEvent(e) {
    const x = e.extraData || {}; let list = [];
    if (x.spotlight) list = x.spotlight.list || [x.spotlight];
    else if (x.communityday) list = (x.communityday.spawns || []).map(p => Object.assign({ canBeShiny: true }, p));
    else if (x.raidbattles) list = x.raidbattles.bosses || [];
    return list.map(p => ({ name: p.name, dex: ldDex(p.image), shiny: !!p.canBeShiny, img: p.image })).filter(p => p.dex);
  }
  const dbByDex = dex => DB.find(sp => sp.dex === dex && !sp.f) || DB.find(sp => sp.dex === dex);
  const deName = (dex, fallback) => { const sp = dbByDex(dex); return sp ? sp.de : fallback; };

  // ---------- Suchtexte fürs Spiel (deutsche Begriffe) ----------
  const TYPKEY = t => t.toLowerCase();
  const dexList = list => [...new Set(list)].sort((a, b) => a - b).join(',');
  function searchBox(title, str, note) {
    return '<div class="sbox"><div class="sb-h"><b>🔎 ' + esc(title) + '</b><button class="btn mini" data-copy="' + esc(str) + '">Kopieren</button></div><code>' + esc(str) + '</code>' + (note ? '<div class="muted small2">' + note + '</div>' : '') + '</div>';
  }

  // ---------- Kalender (.ics) ----------
  function icsTime(s) {
    const d = new Date(s), p = n => String(n).padStart(2, '0');
    if (/Z$/.test(s)) return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + '00Z';
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + 'T' + p(d.getHours()) + p(d.getMinutes()) + '00';
  }
  function addToCalendar(e) {
    if (!window.rhNet || !window.rhNet.ics) return;
    const esc2 = t => String(t || '').replace(/[\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PokéPlaner//DE', 'BEGIN:VEVENT', 'UID:' + e.eventID + '@raidhelfer', 'DTSTAMP:' + icsTime(new Date().toISOString()),
      'DTSTART:' + icsTime(e.start), 'DTEND:' + icsTime(e.end || e.start), 'SUMMARY:' + esc2('Pokémon GO: ' + e.name), 'URL:' + e.link, 'DESCRIPTION:' + esc2(evT(e)[0] + ' · ' + e.link),
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc2(e.name), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    window.rhNet.ics(e.eventID, ics);
  }

  // ---------- Mitteilungen ----------
  function notifSettings() { state.ui.notif = state.ui.notif || { on: false, lead: 30, types: ['community-day', 'raid-hour', 'raid-day', 'pokemon-spotlight-hour', 'max-mondays'], seen: {} }; return state.ui.notif; }
  function checkNotifs() {
    const n = notifSettings(); if (!n.on || !evData) return;
    const now = Date.now();
    evData.events.forEach(e => {
      if (!e.start || !n.types.includes(e.eventType)) return;
      const st = new Date(e.start).getTime(), key = e.eventID + '|' + e.start;
      if (st - now <= n.lead * 60000 && st > now - 5 * 60000 && !n.seen[key]) {
        n.seen[key] = now; save();
        const mins = Math.max(0, Math.round((st - now) / 60000));
        const extra = monsOfEvent(e).filter(p => p.shiny && !ownInfo(p.dex).shiny).map(p => deName(p.dex, p.name));
        try { new Notification(e.name, { body: (mins ? 'Startet in ' + mins + ' Min.' : 'Startet jetzt') + ' · ' + evT(e)[0] + (extra.length ? ' · ✨ Shiny fehlt dir: ' + extra.join(', ') : '') }); } catch (err) {}
      }
    });
    Object.keys(n.seen).forEach(k => { if (now - n.seen[k] > 14 * 864e5) delete n.seen[k]; });
  }
  function renderNotifSettings() {
    const n = notifSettings();
    const types = Object.keys(EVTYPE);
    $('#notifSet').innerHTML = '<label class="toggle"><input type="checkbox" data-notif="on"' + (n.on ? ' checked' : '') + '> <b>Mitteilungen einschalten</b></label>' +
      '<label class="field2">Vorlauf <select data-notif="lead">' + [5, 10, 15, 30, 60, 120].map(v => '<option value="' + v + '"' + (n.lead === v ? ' selected' : '') + '>' + v + ' Min. vorher</option>').join('') + '</select></label>' +
      '<button class="btn mini" id="notifTest">Test-Mitteilung</button>' +
      '<div class="chips" style="margin-top:10px">' + types.map(t => '<button class="chip' + (n.types.includes(t) ? ' on' : '') + '" data-nt="' + t + '"><i class="dot" style="background:' + EVTYPE[t][1] + '"></i>' + esc(EVTYPE[t][0]) + '</button>').join('') + '</div>' +
      '<p class="muted small">Die App muss dafür laufen (Fenster darf zu sein, nicht beenden). Beim ersten Mal fragt macOS, ob die App Mitteilungen senden darf.</p>';
    const tb = $('#notifTest'); if (tb) tb.onclick = () => { try { new Notification('PokéPlaner', { body: 'So sehen die Mitteilungen aus.' }); } catch (e) {} };
  }

  // ---------- Community Day: was entwickeln? ----------
  function cdHelp(e) {
    const spawns = monsOfEvent(e); if (!spawns.length) return '';
    return spawns.map(p => {
      const base = dbByDex(p.dex); if (!base) return '';
      const fam = DB.filter(sp => sp.fam === base.fam);
      const finals = fam.filter(sp => !sp.evo && !(sp.f && /Alola|Galar|Hisui|Paldea/.test(sp.f) !== /Alola|Galar|Hisui|Paldea/.test(base.f || '')));
      const mine = state.mons.filter(m => fam.includes(spOf(m))).sort((a, b) => (b.shiny - a.shiny) || ((ivPct(b) ?? -1) - (ivPct(a) ?? -1)));
      const fin = finals.map(sp => {
        const v = baseVar(sp), best = bestRaidSet(v, null), ne = bestRaidSet(v, null, { noElite: true });
        const elites = sp.eq.concat(sp.ec).map(id => esc(mv(id).n) + ' (' + mv(id).t + ')');
        return '<div class="cdf">' + img(sp) + '<div><b>' + spName(sp) + '</b><div class="sub">Elite-Attacken (eine davon ist oft die CD-Attacke): ' + (elites.join(', ') || 'keine') + '</div>' +
          (best ? '<div class="sub">Bestes Moveset: ' + esc(mv(best.f).n) + kindTag(sp, best.f) + ' / ' + esc(mv(best.c).n) + kindTag(sp, best.c) + (ne && best.er > ne.er * 1.01 ? ' · <b class="g">+' + Math.round((best.er / ne.er - 1) * 100) + '%</b> gegenüber ohne Elite' : '') + '</div>' : '') + '</div></div>';
      }).join('');
      return '<div class="panel wide cd"><div class="field"><span>🌟 ' + esc(e.name) + ' · ' + dfmt(evDate(e.start)) + '</span> <a class="btn mini" href="' + esc(e.link) + '" target="_blank">Genaue CD-Attacke nachlesen</a></div>' + fin +
        '<div class="sub" style="margin-top:8px"><b>Deine aus der Familie</b> (am Event-Tag entwickeln, beste zuerst):</div><div class="cdm">' +
        (mine.length ? mine.slice(0, 6).map(m => '<span class="chip" data-detail="' + m.uid + '">' + img(spOf(m), 'mini', m.shiny) + esc(spOf(m).de) + ' ' + (ivPct(m) !== null ? ivPct(m) + '%' : '') + ' ' + monTags(m) + '</span>').join('') : '<span class="muted small2">Noch keine eingetragen.</span>') + '</div>' +
        searchBox('Familie in der Box finden', dexList(fam.map(sp => sp.dex)) + '&3*,4*', 'Zeigt Pokémon dieser Familie mit 3 oder 4 Sternen.') + '</div>';
    }).join('');
  }

  // ---------- News & Events (LeekDuck über ScrapedDuck) ----------
  const SD = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/';
  const EVCACHE = 'raidhelfer-events';
  let evData = null; try { evData = JSON.parse(localStorage.getItem(EVCACHE)); } catch (e) {}
  let evMonth = 0;
  const EVTYPE = { 'community-day': ['Community Day', '#3fb950'], 'raid-day': ['Raid-Tag', '#e5484d'], 'raid-hour': ['Raid-Stunde', '#e5484d'], 'raid-battles': ['Raids', '#e5484d'], 'elite-raids': ['Elite-Raids', '#e5484d'],
    'max-battles': ['Dyna-Kämpfe', '#d06bff'], 'max-mondays': ['Max Monday', '#d06bff'], 'pokemon-spotlight-hour': ['Rampenlicht-Stunde', '#f0a040'], 'event': ['Event', '#58a6ff'], 'live-event': ['Live-Event', '#58a6ff'],
    'pokemon-go-tour': ['GO Tour', '#ff7a59'], 'pokemon-go-fest': ['GO Fest', '#ff7a59'], 'safari-zone': ['Safari Zone', '#ff7a59'], 'wild-area': ['Wild Area', '#ff7a59'], 'city-safari': ['City Safari', '#ff7a59'],
    'go-battle-league': ['GO Kampfliga', '#8a92a6'], 'season': ['Saison', '#8a92a6'], 'go-pass': ['GO Pass', '#8a92a6'], 'research': ['Forschung', '#5fc8c3'], 'timed-research': ['Zeitforschung', '#5fc8c3'],
    'special-research': ['Spezialforschung', '#5fc8c3'], 'research-day': ['Forschungstag', '#5fc8c3'], 'hatch-day': ['Schlüpftag', '#f5c542'], 'update': ['Update', '#8a92a6'], 'pokestop-showcase': ['Showcase', '#8a92a6'] };
  const evT = e => EVTYPE[e.eventType] || [e.heading || e.eventType, '#8a92a6'];
  const evDate = s => s ? new Date(s) : null;
  function loadEvents(force) {
    if (evData && !force && Date.now() - evData.at < 3 * 3600 * 1000) return;
    Promise.all(['events', 'eggs', 'research'].map(n => fetch(SD + n + '.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null))).then(([events, eggs, research]) => {
      if (!events && evData) return;
      evData = { at: Date.now(), events: events || [], eggs: eggs || [], research: research || [] };
      try { localStorage.setItem(EVCACHE, JSON.stringify(evData)); } catch (e) {}
      if (current === 'events') renderEvents();
    });
  }
  const dfmt = d => d ? d.toLocaleString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '?';
  function evCard(e, now) {
    const s = evDate(e.start), en = evDate(e.end), [lbl, col] = evT(e);
    const running = s && en && s <= now && en >= now;
    const left = running ? Math.max(0, en - now) : s && s > now ? s - now : 0;
    const dd = Math.floor(left / 864e5), hh = Math.floor(left % 864e5 / 36e5);
    const when = running ? 'noch ' + (dd ? dd + ' T ' : '') + hh + ' Std' : s && s > now ? 'in ' + (dd ? dd + ' T ' : '') + hh + ' Std' : '';
    const mons = monsOfEvent(e);
    return '<div class="evc">' + (e.image ? '<a href="' + esc(e.link) + '" target="_blank"><img class="evimg" src="' + esc(e.image) + '" alt="" loading="lazy"></a>' : '<div class="evimg"></div>') + '<div class="evb">' +
      '<span class="evt" style="background:' + col + '">' + esc(lbl) + '</span>' + (when ? '<span class="evw">' + when + '</span>' : '') +
      '<a class="evn" href="' + esc(e.link) + '" target="_blank"><b>' + esc(e.name) + '</b></a><div class="sub">' + (s ? dfmt(s) + ' bis ' + dfmt(en) + (/Z$/.test(e.start || '') ? ' (weltweit gleichzeitig)' : ' (Ortszeit)') : 'Datum folgt') + '</div>' +
      (mons.length ? '<div class="evm">' + mons.map(p => '<span class="evmon"><img src="' + esc(p.img) + '" alt="">' + esc(deName(p.dex, p.name)) + forMeTags(p.dex, p.shiny) + '</span>').join('') + '</div>' : '') +
      (s && window.rhNet && window.rhNet.ics ? '<div class="eva"><button class="btn mini" data-ics="' + esc(e.eventID) + '">📅 In Kalender</button></div>' : '') + '</div></div>';
  }
  function renderEvents() {
    loadEvents();
    const tab = state.ui.evtab || 'events', out = $('#evOut');
    document.querySelectorAll('[data-evtab]').forEach(b => b.classList.toggle('on', b.dataset.evtab === tab));
    if (!evData && tab !== 'news') { out.innerHTML = '<div class="empty big">Lade Events …</div>'; return; }
    if (tab === 'news') { $('#evChips').innerHTML = ''; renderNews(out); return; }
    $('#evStamp').textContent = 'Stand ' + new Date(evData.at).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' });
    const now = new Date();
    if (tab !== 'events') $('#evChips').innerHTML = '';
    if (tab === 'news') { renderNews(out); return; }
    if (tab === 'eggs') {
      const g = {}; evData.eggs.forEach(e => { (g[e.eggType] = g[e.eggType] || []).push(e); });
      out.innerHTML = Object.keys(g).map(k => '<div class="panel wide"><div class="field"><span>🥚 ' + esc(k) + '</span></div><div class="eggs">' + g[k].map(e => '<div class="egg"><img src="' + esc(e.image) + '" alt=""><div>' + esc(deName(ldDex(e.image), e.name)) + (e.canBeShiny ? ' ✨' : '') + '</div>' + forMeTags(ldDex(e.image), e.canBeShiny) + '<small>' + (e.combatPower ? e.combatPower.max + ' WP' : '') + (e.isRegional ? ' · regional' : '') + (e.isAdventureSync ? ' · Fitness' : '') + (e.isGiftExchange ? ' · Geschenk' : '') + '</small></div>').join('') + '</div></div>').join('') || '<div class="empty">Keine Daten.</div>';
      return;
    }
    if (tab === 'research') {
      out.innerHTML = '<div class="rank">' + evData.research.map(r => '<div class="rk"><div class="grow"><b>' + esc(String(r.text).replace(/<[^>]+>/g, '')) + '</b><div class="sub">' + (r.rewards || []).map(x => '<span class="rw"><img src="' + esc(x.image) + '" alt="">' + esc(x.name) + (x.canBeShiny ? ' ✨' : '') + '</span>').join('') + '</div></div></div>').join('') + '</div>';
      return;
    }
    const f = state.ui.evf || [];
    const types = [...new Set(evData.events.map(e => e.eventType))];
    $('#evChips').innerHTML = types.map(t => '<button class="chip' + (f.includes(t) ? ' on' : '') + '" data-evf="' + t + '"><i class="dot" style="background:' + evT({ eventType: t })[1] + '"></i>' + esc(evT({ eventType: t })[0]) + '</button>').join('');
    const evs = evData.events.filter(e => !f.length || f.includes(e.eventType));
    const running = evs.filter(e => e.start && e.end && evDate(e.start) <= now && evDate(e.end) >= now).sort((a, b) => evDate(a.end) - evDate(b.end));
    const upcoming = evs.filter(e => e.start && evDate(e.start) > now).sort((a, b) => evDate(a.start) - evDate(b.start));
    const undated = evs.filter(e => !e.start);
    // Kalender
    const base = new Date(now.getFullYear(), now.getMonth() + evMonth, 1), y = base.getFullYear(), mo = base.getMonth();
    const first = (base.getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
    let cal = '<div class="cal-h"><button class="btn mini" data-evm="-1">◀</button><b>' + base.toLocaleString('de-AT', { month: 'long', year: 'numeric' }) + '</b><button class="btn mini" data-evm="1">▶</button></div><div class="cal">' +
      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => '<div class="cal-d">' + d + '</div>').join('') + '<div></div>'.repeat(first);
    for (let d = 1; d <= days; d++) {
      const ds = new Date(y, mo, d), de = new Date(y, mo, d, 23, 59, 59);
      const todays = evs.filter(e => e.start && evDate(e.start) <= de && evDate(e.end || e.start) >= ds);
      const short = todays.filter(e => evDate(e.end) - evDate(e.start) < 2 * 864e5), long = todays.length - short.length;
      cal += '<div class="cal-c' + (ds.toDateString() === now.toDateString() ? ' today' : '') + '"><span class="cal-n">' + d + '</span>' +
        short.slice(0, 4).map(e => '<a class="cal-e" href="' + esc(e.link) + '" target="_blank" style="border-color:' + evT(e)[1] + '" title="' + esc(e.name) + '">' + evDate(e.start).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) + ' ' + esc(e.name) + '</a>').join('') +
        (short.length > 4 ? '<span class="cal-more">+' + (short.length - 4) + '</span>' : '') + (long ? '<span class="cal-more">' + long + ' laufende</span>' : '') + '</div>';
    }
    cal += '</div>';
    const fd = [];
    const fdSeen = new Set();
    running.concat(upcoming).forEach(e => monsOfEvent(e).forEach(p => { const o = ownInfo(p.dex), k = p.dex + '|' + e.eventType; if (fdSeen.has(k)) return; if ((p.shiny && !o.shiny) || !o.has) { fdSeen.add(k); fd.push({ e, p, o }); } }));
    const fdHtml = fd.length ? '<h2 class="sub">💡 Für dich interessant</h2><div class="fdl">' + fd.slice(0, 16).map(x => '<a class="fdi" href="' + esc(x.e.link) + '" target="_blank"><img src="' + esc(x.p.img) + '" alt=""><div><b>' + esc(deName(x.p.dex, x.p.name)) + '</b> ' + forMeTags(x.p.dex, x.p.shiny) + '<div class="sub">' + esc(evT(x.e)[0]) + ' · ' + (evDate(x.e.start) <= now ? 'läuft bis ' + dfmt(evDate(x.e.end)) : 'ab ' + dfmt(evDate(x.e.start))) + '</div></div></a>').join('') + '</div>' : '';
    const cds = upcoming.concat(running).filter(e => e.eventType === 'community-day' && monsOfEvent(e).length);
    out.innerHTML = fdHtml + (cds.length ? '<h2 class="sub">🌟 Community Day: was entwickeln?</h2>' + cds.map(cdHelp).join('') : '') + '<h2 class="sub">🔴 Läuft gerade (' + running.length + ')</h2><div class="evgrid">' + (running.map(e => evCard(e, now)).join('') || '<div class="empty">Nichts.</div>') + '</div>' +
      '<h2 class="sub">📅 Demnächst (' + upcoming.length + ')</h2><div class="evgrid">' + (upcoming.slice(0, 18).map(e => evCard(e, now)).join('') || '<div class="empty">Nichts.</div>') + '</div>' +
      (undated.length ? '<h2 class="sub">Ohne Datum</h2><div class="evgrid">' + undated.map(e => evCard(e, now)).join('') + '</div>' : '') +
      '<h2 class="sub">🗓 Kalender</h2><div class="panel wide">' + cal + '</div>';
  }

  // ---------- Aufräumen ----------
  function keepScore(m) {
    const sp = spOf(m), iv = hasIV(m) ? ivs(m) : [0, 0, 0];
    return (m.fav ? 5000 : 0) + ((m.tags || []).length ? 3000 : 0) + (m.shiny ? 2000 : 0) + (m.lucky ? 1200 : 0) + (m.mode !== 'n' ? 1500 : 0) + (isHundo(m) ? 1000 : 0) + (m.purified ? 50 : 0) +
      iv[0] * 20 + (ivPct(m) || 0) + (levelOf(m).l || 0);
  }
  function keepReasons(m) {
    const r = [];
    if (m.fav) r.push('Favorit'); if ((m.tags || []).length) r.push('markiert'); if (m.shiny) r.push('Shiny'); if (m.lucky) r.push('Glück');
    if (m.mode !== 'n') r.push(MODE_NAME[m.mode]); if (isHundo(m)) r.push('Hundo');
    return r;
  }
  function renderCleanup() {
    const groups = {};
    state.mons.forEach(m => { const key = m.k + (m.crypto ? '|c' : m.purified ? '|p' : ''); (groups[key] = groups[key] || []).push(m); });
    const dup = Object.values(groups).filter(g => g.length > 1);
    const goList = [];
    const html = dup.map(g => {
      g.sort((a, b) => keepScore(b) - keepScore(a));
      const sp = spOf(g[0]);
      const rows = g.map((m, i) => {
        const why = keepReasons(m), keep = i === 0 || why.length;
        if (!keep) goList.push(m);
        return '<div class="cr-row ' + (keep ? 'keep' : 'go') + '" data-detail="' + m.uid + '">' + img(sp, 'mini', m.shiny) + '<span class="grow">' + (ivPct(m) !== null ? ivPct(m) + '% (' + m.iv.join('/') + ')' : 'IV ?') + ' · ' + (statsOf(m).l ? fmt(statsOf(m).cp) + ' WP' : 'WP ?') + ' ' + monTags(m) + '</span>' +
          '<span class="pill ' + (keep ? 'p-have' : 'p-up') + '">' + (keep ? 'Behalten' + (i === 0 && !why.length ? ' (bestes)' : why.length ? ': ' + why.join(', ') : '') : 'Kann weg') + '</span></div>';
      }).join('');
      return '<div class="panel wide crg"><div class="field"><span>' + spName(sp) + (g[0].crypto ? ' · Crypto' : g[0].purified ? ' · Erlöst' : '') + ' · ' + g.length + '×</span></div>' + rows + '</div>';
    }).join('');
    const goDex = dexList(goList.map(m => spOf(m).dex));
    $('#cleanOut').innerHTML = (dup.length ? '<div class="adv ok">' + dup.length + ' Pokémon hast du mehrfach. ' + goList.length + ' davon würde ich verschicken oder tauschen.</div>' +
      (goList.length ? searchBox('Kandidaten in der Box', goDex + '&!schillernd&!glücks&!4*&!favorit&!dynamax&!gigadynamax&!legendär&!mysteriös', 'Zeigt diese Arten ohne Shinys, Glücks-Pokémon, Hundos, Favoriten, Dyna und Legendäre. Vorher kurz drüberschauen.') +
        '<button class="btn danger" id="cleanRemove">' + goList.length + ' „Kann weg“ aus der App entfernen</button>' : '') + html
      : '<div class="empty big">Keine doppelten Pokémon in deiner Liste.</div>');
    const b = $('#cleanRemove');
    if (b) b.onclick = () => { if (b.dataset.c) { const ids = new Set(goList.map(m => m.uid)); state.mons = state.mons.filter(m => !ids.has(m.uid)); save(); renderAll(); } else { b.dataset.c = 1; b.textContent = 'Wirklich? Nochmal klicken'; } };
  }

  // ---------- PvP (Meta von PvPoke, wird täglich neu geladen) ----------
  const LEAGUES = { 1500: 'Superliga', 2500: 'Hyperliga', 10000: 'Meisterliga' };
  const PVMAP = window.PVMAP || {}, PVMOVES = window.PVMOVES || {};
  const PVREV = {}; Object.keys(PVMAP).forEach(id => { if (!PVREV[PVMAP[id]] || id.length < PVREV[PVMAP[id]].length) PVREV[PVMAP[id]] = id; });
  const PVURL = l => 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-' + l + '.json';
  const PVCACHE = 'raidhelfer-pvp';
  let pvp = null; try { pvp = JSON.parse(localStorage.getItem(PVCACHE)); } catch (e) {}
  const PVGM = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.min.json';
  const BASEFMT = [{ key: 'all|1500', cup: 'all', cp: 1500, title: 'Superliga' }, { key: 'all|2500', cup: 'all', cp: 2500, title: 'Hyperliga' }, { key: 'all|10000', cup: 'all', cp: 10000, title: 'Meisterliga' }];
  if (!pvp || !pvp.L || pvp.v !== 2) pvp = { v: 2, L: {}, at: {}, fmts: null, fmtAt: 0 };
  const savePvp = () => { try { localStorage.setItem(PVCACHE, JSON.stringify(pvp)); } catch (e) {} };
  function allFmts() { return BASEFMT.concat(pvp.fmts || []); }
  function curFmt() { const k = state.ui.pvKey || 'all|1500'; return allFmts().find(f => f.key === k) || BASEFMT[0]; }
  let pvLoading = {};
  function loadFormats(force) {
    if (pvp.fmts && !force && Date.now() - pvp.fmtAt < 24 * 3600e3) return;
    fetch(PVGM, { cache: 'no-store' }).then(r => r.json()).then(g => {
      pvp.fmts = (g.formats || []).filter(f => !f.hideRankings && f.cup !== 'custom' && !(f.cup === 'all')).map(f => ({ key: f.cup + '|' + f.cp, cup: f.cup, cp: f.cp, title: f.title, rules: f.rules || [] }));
      pvp.fmtAt = Date.now(); savePvp(); if (current === 'pvp') renderPvp();
      // Attacken-Pools für das nächste Öffnen merken und gleich einmischen
      const pool = {}; Object.keys(PVREV).forEach(k => { const p = (g.pokemon || []).find(x => x.speciesId === PVREV[k]); if (p) pool[p.speciesId] = [p.fastMoves || [], p.chargedMoves || [], (p.eliteMoves || []).concat(p.legacyMoves || [])]; });
      try { localStorage.setItem(POOLKEY, JSON.stringify(pool)); } catch (e) {} mergePools(pool);
    }).catch(() => {});
  }
  // Rangliste einer Liga laden (für PvP-Tipps bei einzelnen Pokémon)
  function loadLeague(k) {
    if (pvLoading[k] || (pvp.L[k] && Date.now() - (pvp.at[k] || 0) < 24 * 3600e3)) return;
    const [cup, cp] = k.split('|'); pvLoading[k] = true;
    fetch('https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/' + cup + '/overall/rankings-' + cp + '.json', { cache: 'no-store' }).then(r => r.json())
      .then(list => { pvp.L[k] = list.slice(0, 300).map(x => ({ id: x.speciesId, s: x.score, ms: x.moveset || [], w: (x.matchups || []).map(o => o.opponent), lo: (x.counters || []).map(o => o.opponent) })); pvp.at[k] = Date.now(); savePvp(); })
      .catch(() => { if (!pvp.L[k]) pvp.L[k] = []; })
      .finally(() => { pvLoading[k] = false; renderAll(); });
  }
  const pvFast = id => MOVES[id + '_FAST'] ? id + '_FAST' : (MOVES[id] ? id : null);
  const pvCharged = id => MOVES[id] ? id : (id === 'FUTURE_SIGHT' && MOVES.FUTURESIGHT ? 'FUTURESIGHT' : null);
  const pvName = (id, fast) => { const x = fast ? pvFast(id) : pvCharged(id); return x ? mv(x).n : ((PVMOVES[id] || [])[0] || id); };
  function pvpAdvice(m) {
    const sp = spOf(m), wp = Number(m.wp) || (statsOf(m).l ? statsOf(m).cp : 0);
    const leagues = [['all|1500', 'Superliga', 1500], ['all|2500', 'Hyperliga', 2500], ['all|10000', 'Meisterliga', 1e9]];
    const id = (PVREV[sp.k] || '') + (m.crypto ? '_shadow' : '');
    const rows = leagues.map(([k, n, cap]) => {
      if (!pvp.L[k]) { loadLeague(k); return '<div class="sub">' + n + ': Meta wird geladen …</div>'; }
      const i = pvp.L[k].findIndex(x => x.id === id);
      if (i < 0) return '<div class="sub muted">' + n + ': nicht unter den Top 300</div>';
      const e = pvp.L[k][i], [f, c1, c2] = e.ms;
      const mine = [m.fast, m.c1, m.c2].filter(Boolean), want = [pvFast(f), pvCharged(c1), c2 && pvCharged(c2)].filter(Boolean);
      const miss = want.filter(x => !mine.includes(x));
      return '<div class="sub"><b>' + n + '</b> Platz ' + (i + 1) + (wp > cap ? ' <span class="muted">(dein WP ist zu hoch)</span>' : '') + ': ' + esc(pvName(f, true)) + ' / ' + esc(pvName(c1)) + (c2 ? ' / ' + esc(pvName(c2)) : '') +
        (mine.length ? (miss.length ? ' <span class="up2">fehlt: ' + miss.map(x => esc(mv(x).n)).join(', ') + '</span>' : ' ✔') : '') + '</div>';
    });
    const fit = wp && wp <= 1500 ? 'Superliga' : wp && wp <= 2500 ? 'Hyperliga' : 'Meisterliga';
    return '<div class="adv ok"><b>PvP-Pokémon</b> <span class="muted">(passt mit ' + (wp ? fmt(wp) + ' WP' : 'unbekannten WP') + ' in die ' + fit + '; Attacken laut PvPoke-Meta)</span>' + rows.join('') + '</div>' +
      '<div class="adv muted2">Raid- und Dyna-Tipps sind für dieses Pokémon ausgeblendet. Zum Zurückschalten oben auf „PvP“ klicken.</div>';
  }
  function loadPvp(force) {
    loadFormats(force);
    const f = curFmt(), k = f.key;
    if (pvLoading[k]) return;
    if (pvp.L[k] && !force && Date.now() - (pvp.at[k] || 0) < 24 * 3600e3) return;
    pvLoading[k] = true;
    fetch('https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/' + f.cup + '/overall/rankings-' + f.cp + '.json', { cache: 'no-store' }).then(r => r.json())
      .then(list => { pvp.L[k] = list.slice(0, 300).map(x => ({ id: x.speciesId, s: x.score, ms: x.moveset || [], w: (x.matchups || []).map(o => o.opponent), lo: (x.counters || []).map(o => o.opponent) })); pvp.at[k] = Date.now(); savePvp(); })
      .catch(() => { if (!pvp.L[k]) pvp.L[k] = []; })
      .finally(() => { pvLoading[k] = false; if (current === 'pvp') renderPvp(); });
  }
  function pvSp(id) {
    const shadow = /_shadow$/.test(id), mm = /_(mega(?:_[xy])?|primal)$/.exec(id.replace(/_shadow$/, '')), base = id.replace(/_shadow$/, '').replace(/_(mega(?:_[xy])?|primal)$/, '');
    const k = PVMAP[base] || (DB.find(sp => sp.en.toLowerCase().replace(/[^a-z0-9]/g, '') === base.replace(/[^a-z0-9]/g, '')) || {}).k;
    return k && SP[k] ? { sp: SP[k], shadow, mega: mm ? (mm[1] === 'primal' ? 'Proto' : 'Mega' + (mm[1].length > 4 ? ' ' + mm[1].slice(-1).toUpperCase() : '')) : '' } : null;
  }
  const pvMove = id => PVMOVES[id] || [id, 'Normal', 0];
  const metaOf = k => (pvp && pvp.L[k]) || [];
  // IV-Rang: alle 4096 IV-Kombinationen, jeweils höchstes Level unter dem WP-Limit, sortiert nach Werte-Produkt
  const rankCache = {};
  function ivRanks(sp, cap, maxL) {
    const key = sp.k + '|' + cap + '|' + maxL;
    if (rankCache[key]) return rankCache[key];
    const lv = []; for (let l = 1; l <= maxL; l += 0.5) lv.push([l, cpmAt(l)]);
    const b = sp.b, rows = [];
    for (let a = 0; a < 16; a++) for (let d = 0; d < 16; d++) for (let s2 = 0; s2 < 16; s2++) {
      let lo = 0, hi = lv.length - 1, best = 0;
      while (lo <= hi) { const mid = (lo + hi) >> 1, c = lv[mid][1]; const cp = Math.max(10, Math.floor((b[0] + a) * Math.sqrt(b[1] + d) * Math.sqrt(b[2] + s2) * c * c / 10)); if (cp <= cap) { best = mid; lo = mid + 1; } else hi = mid - 1; }
      const c = lv[best][1], prod = (b[0] + a) * c * (b[1] + d) * c * Math.floor((b[2] + s2) * c);
      rows.push({ k: a * 256 + d * 16 + s2, prod, l: lv[best][0], cp: Math.max(10, Math.floor((b[0] + a) * Math.sqrt(b[1] + d) * Math.sqrt(b[2] + s2) * c * c / 10)) });
    }
    rows.sort((x, y) => y.prod - x.prod);
    const map = {}; rows.forEach((r, i) => { map[r.k] = { rank: i + 1, pct: r.prod / rows[0].prod * 100, l: r.l, cp: r.cp }; });
    return (rankCache[key] = { map, top: rows[0] });
  }
  function myRank(m, cap) {
    if (!hasIV(m)) return null;
    const iv = ivs(m), t = ivRanks(spOf(m), cap, m.buddy ? 51 : 50);
    return t.map[iv[0] * 256 + iv[1] * 16 + iv[2]];
  }
  const pvIdOf = m => { const b = PVREV[m.k]; return b ? b + (m.crypto ? '_shadow' : '') : null; };
  function eligible(m, cap) { if (cap >= 10000) return true; const st = statsOf(m); return !st.l || st.cp <= cap; }
  // Matchup-Schätzung: PvPoke-Daten (Top-Siege/-Niederlagen), sonst Typen (eigene Attacken gegen Gegner-Typen und umgekehrt)
  function matchScore(me, th, l) {
    const meta = metaOf(l), me2 = me.pv && meta.find(x => x.id === me.pv), th2 = meta.find(x => x.id === th.id);
    if (me2 && me2.w.includes(th.id)) return 1.35;
    if (me2 && me2.lo.includes(th.id)) return 0.65;
    if (th2 && me.pv && th2.lo.includes(me.pv)) return 1.35;
    if (th2 && me.pv && th2.w.includes(me.pv)) return 0.65;
    const off = Math.max(0.5, ...me.mt.map(t => eff(t, th.t) * stabT(me.t, t)));
    const def = Math.max(0.5, ...th.mt.map(t => eff(t, me.t) * stabT(th.t, t)));
    return off / def;
  }
  const memberFromMon = m => { const sp = spOf(m), mvs = [m.fast, m.c1, m.c2].filter(Boolean); const pv = pvIdOf(m), me = metaOf(curFmt().key).find(x => x.id === pv);
    return { key: 'm' + m.uid, label: sp.de + (m.crypto ? ' (Crypto)' : '') + (ivPct(m) !== null ? ' ' + ivPct(m) + '%' : ''), sp, t: sp.t, pv, m, mt: mvs.length ? mvs.map(id => mv(id).t) : me ? me.ms.map(id => pvMove(id)[1]) : sp.t }; };
  const memberFromMeta = x => { const r = pvSp(x.id); if (!r) return null; return { key: 'p' + x.id, label: r.sp.de + (r.shadow ? ' (Crypto)' : '') + ' – hast du nicht', sp: r.sp, t: r.sp.t, pv: x.id, mt: x.ms.map(id => pvMove(id)[1]), meta: x }; };
  const threatOf = x => { const r = pvSp(x.id); return r ? { id: x.id, sp: r.sp, shadow: r.shadow, t: r.sp.t, mt: x.ms.map(id => pvMove(id)[1]), s: x.s } : null; };
  function teamEval(team, l, threats) {
    return threats.map(th => { const sc = team.map(me => me ? matchScore(me, th, l) : 0); return { th, sc, best: Math.max(0, ...sc) }; });
  }
  // Team um ein Pokémon bauen: deckt die Meta ab, vermeidet gemeinsame Schwächen und bevorzugt Partner, die selbst in der Meta stark sind
  // Teamvorschläge: feste Mitglieder (1 oder 2) werden ergänzt. Liefert die besten k Teams.
  // Bewertung: Abdeckung der Top-Meta, besonders der Konter der festen Mitglieder (laut PvPoke), Abzug für gemeinsame Schwächen, Stärke der Partner in der Meta.
  function suggestTeams(fixed, pool, l, threats, k) {
    const meta = metaOf(l), idx = {}; meta.forEach((x, i) => { idx[x.id] = i; });
    const quality = c => { const i = idx[c.pv]; return i === undefined ? 0.4 : Math.max(0.5, meta[i].s / 100) * (i < 60 ? 1 : i < 150 ? 0.92 : 0.82); };
    // Konter der festen Mitglieder zusätzlich als Gegner aufnehmen und stärker gewichten
    const ths = threats.slice(), W = ths.map(th => th.s / 100);
    fixed.forEach(f => { const e = meta[idx[f.pv]]; (e ? e.lo : []).forEach(id => {
      const j = ths.findIndex(t => t.id === id);
      if (j >= 0) W[j] *= 1.8; else { const x = meta[idx[id]], th = x && threatOf(x); if (th) { ths.push(th); W.push(1.4 * th.s / 100); } }
    }); });
    const row = c => ths.map(th => matchScore(c, th, l));
    const F = fixed.map(row), qW = ths.length * 0.12;
    const scoreRows = rows => {
      let s = 0;
      W.forEach((w, j) => {
        let best = 0, lose = 0; rows.forEach(r => { if (r[j] > best) best = r[j]; if (r[j] < 0.9) lose++; });
        s += w * Math.min(1.5, best);
        if (lose >= 2) s -= w * 0.45 * (lose - 1);
      });
      return s;
    };
    const free = pool.filter(c => !fixed.some(f => f.sp.k === c.sp.k)).map(c => ({ c, r: row(c), q: quality(c) }));
    const res = [];
    if (fixed.length >= 2) free.forEach(o => res.push({ sc: scoreRows(F.concat([o.r])) + o.q * qW, add: [o.c] }));
    else {
      const pre = free.map(o => Object.assign(o, { s1: scoreRows(F.concat([o.r])) + o.q * qW })).sort((a, b) => b.s1 - a.s1).slice(0, 30);
      pre.forEach((a, i) => pre.slice(i + 1).forEach(b => { if (a.c.sp.k !== b.c.sp.k) res.push({ sc: scoreRows(F.concat([a.r, b.r])) + (a.q + b.q) * qW, add: [a.c, b.c] }); }));
    }
    res.sort((a, b) => b.sc - a.sc);
    // Vielfalt: nicht fünfmal fast dasselbe Team
    const out = [], seen = {};
    res.forEach(r => { if (out.length >= k) return; const key = r.add.map(c => c.sp.k).join(); if (seen[key]) return; seen[key] = 1;
      if (fixed.length < 2 && out.filter(o => o.add.some(c => r.add.some(d => d.sp.k === c.sp.k))).length >= 2) return; out.push(r); });
    const top = out.length ? out[0].sc : 1;
    return out.map(r => ({ team: fixed.concat(r.add), pct: Math.round(r.sc / top * 100) }));
  }
  const buildAround = (anchor, pool, l, threats) => { const s = suggestTeams([anchor], pool, l, threats, 1)[0]; return s ? s.team : [anchor]; };
  window.__pvTest = { buildAround, suggestTeams, metaOf, threatOf, memberFromMon, memberFromMeta, pvp: () => pvp };
  let pvSugg = null;
  function renderPvp() {
    loadPvp(); loadEvents();
    const f = curFmt(), l = f.key, cap = f.cp, out = $('#pvpOut');
    document.querySelectorAll('[data-league]').forEach(b => b.classList.toggle('on', b.dataset.league === l));
    const gbl = evData ? evData.events.filter(e => e.eventType === 'go-battle-league' && e.start && new Date(e.end) > new Date()) : [];
    const isLive = x => { const tok = x.title.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter(w => w.length > 2 && !['cup', 'league', 'the', 'and', 'championship', 'series', 'edition'].includes(w)); return tok.length > 0 && gbl.some(e => { const n = e.name.toLowerCase(); return tok.every(w => n.includes(w)); }); };
    $('#cupSel').innerHTML = '<option value="">Cups (' + (pvp.fmts || []).length + ') …</option>' + (pvp.fmts || []).map(x => '<option value="' + x.key + '"' + (x.key === l ? ' selected' : '') + '>' + (isLive(x) ? '🟢 ' : '') + esc(x.title) + ' · ' + (x.cp >= 10000 ? 'ohne Limit' : x.cp) + '</option>').join('');
    if (!pvp.L[l]) { out.innerHTML = '<div class="empty big">Lade die Meta für ' + esc(f.title) + ' …</div>'; return; }
    if (!pvp.L[l].length) { out.innerHTML = '<div class="empty big">Für ' + esc(f.title) + ' gibt es gerade keine Rangliste.</div>'; return; }
    $('#pvpStamp').textContent = 'Meta-Stand ' + new Date(pvp.at[l]).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' }) + ' · Quelle: PvPoke';
    const meta = metaOf(l), ty = $('#pvpType').value;
    const ownBy = {}; state.mons.forEach(m => { const id = pvIdOf(m); if (id) (ownBy[id] = ownBy[id] || []).push(m); });
    const top = meta.filter(x => { const r = pvSp(x.id); return r && (!ty || r.sp.t.includes(ty)); }).slice(0, 50);
    const metaRows = top.map(x => {
      const r = pvSp(x.id), mine = (ownBy[x.id] || []).filter(m => eligible(m, cap)).map(m => ({ m, r: myRank(m, cap) })).sort((a, b) => ((a.r || {}).rank || 9999) - ((b.r || {}).rank || 9999));
      const pos = meta.indexOf(x) + 1, mvs = x.ms.map(id => pvMove(id));
      return '<div class="rk' + (mine.length ? ' own' : '') + '"><span class="rk-n">' + pos + '</span>' + img(r.sp) + '<div class="grow"><b>' + (r.mega ? '<span class="mega">' + r.mega + '</span> ' : '') + spName(r.sp) + (r.shadow ? ' <span class="mt cr">Crypto</span>' : '') + '</b> ' + r.sp.t.map(typeTag).join('') +
        '<div class="sub">' + mvs.map((v, i) => '<span class="pm t-' + v[1] + '">' + esc(v[0]) + '</span>' + (i === 0 ? ' · ' : ' ')).join('') + '</div>' +
        (mine.length ? '<div class="sub g">Du hast: ' + mine.slice(0, 3).map(o => '<span class="lnk" data-detail="' + o.m.uid + '">' + (o.r ? 'Rang ' + o.r.rank + ' (' + o.r.pct.toFixed(1) + '%)' : 'IVs fehlen') + '</span>').join(', ') + '</div>' : '') + '</div>' +
        '<span class="dmg">' + x.s.toFixed(1) + '</span><div class="bar"><i style="width:' + Math.round(x.s) + '%"></i></div>' +
        '<button class="add" data-add="' + r.sp.k + '" data-mode="n" data-crypto="' + (r.shadow ? 1 : '') + '" title="Hab ich, eintragen">＋</button></div>';
    }).join('');
    // Deine für diese Liga
    const mineL = state.mons.filter(m => eligible(m, cap)).map(m => { const id = pvIdOf(m), pos = meta.findIndex(x => x.id === id); return { m, pos: pos < 0 ? 9999 : pos + 1, r: myRank(m, cap), x: meta[pos] }; })
      .filter(o => o.pos <= 150).sort((a, b) => a.pos - b.pos);
    const mineRows = mineL.map(o => {
      const sp = spOf(o.m), rec = o.x ? o.x.ms.map(id => pvMove(id)) : [];
      const have = [o.m.fast, o.m.c1, o.m.c2].filter(Boolean).map(id => mv(id).n);
      const missing = rec.filter(v => !have.includes(v[0])).map(v => v[0]);
      return '<div class="rk" data-detail="' + o.m.uid + '"><span class="rk-n">#' + o.pos + '</span>' + img(sp, 'spr', o.m.shiny) + '<div class="grow"><b>' + spName(sp) + ' ' + monTags(o.m) + '</b>' +
        '<div class="sub">' + (o.r ? 'IV-Rang <b>' + o.r.rank + '</b>/4096 (' + o.r.pct.toFixed(1) + '%) · bestes Level ' + String(o.r.l).replace('.', ',') + ' = ' + fmt(o.r.cp) + ' WP' : 'IVs eintragen für den IV-Rang') + '</div>' +
        (missing.length && have.length ? '<div class="sub up2">Empfohlen fehlt: ' + missing.map(esc).join(', ') + '</div>' : !have.length ? '<div class="sub">Empfohlen: ' + rec.map(v => esc(v[0])).join(' / ') + '</div>' : '') + '</div></div>';
    }).join('');
    // Team-Bauer
    const threats = meta.slice(0, 40).map(threatOf).filter(Boolean);
    const myPool = state.mons.filter(m => eligible(m, cap)).map(memberFromMon);
    const metaPool = meta.slice(0, 60).map(memberFromMeta).filter(Boolean).filter(c => !myPool.some(p => p.pv === c.pv));
    const pool = state.ui.pvOnlyMine === false ? myPool.concat(metaPool) : myPool;
    const all = myPool.concat(metaPool), byKey = {}; all.forEach(c => { byKey[c.key] = c; });
    state.ui.team = state.ui.team || {}; const tk = state.ui.team[l] || [];
    let team = [0, 1, 2].map(i => byKey[tk[i]] || null);
    const slotSel = i => '<select data-slot="' + i + '"><option value="">– Slot ' + (i + 1) + ' –</option><optgroup label="Meine">' + myPool.map(c => '<option value="' + c.key + '"' + (team[i] && team[i].key === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') + '</optgroup><optgroup label="Aus der Meta">' + metaPool.map(c => '<option value="' + c.key + '"' + (team[i] && team[i].key === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') + '</optgroup></select>';
    const ev = teamEval(team, l, threats);
    const cell = v => v === 0 ? '<td></td>' : '<td class="' + (v >= 1.15 ? 'w' : v <= 0.87 ? 'lo' : 'ev') + '">' + (v >= 1.15 ? '✓' : v <= 0.87 ? '✗' : '≈') + '</td>';
    const covered = ev.filter(r => r.best >= 1.15).length, holes = ev.filter(r => r.best < 0.87 + 0.01 && team.some(Boolean));
    const teamHtml = '<div class="panel wide"><div class="boss-pick">' + [0, 1, 2].map(slotSel).join('') + '</div>' +
      '<div class="boss-pick"><button class="btn mini" data-build="1">✨ Vorschläge für die leeren Slots</button><label class="toggle small2"><input type="checkbox" data-pvmine' + (state.ui.pvOnlyMine === false ? '' : ' checked') + '> nur meine Pokémon vorschlagen</label><button class="btn mini" data-clearteam="1">Leeren</button></div></div>' +
      (pvSugg && pvSugg.l === l ? '<div class="panel wide sugg"><b>Vorschläge</b> <span class="muted small2">(fest: ' + pvSugg.fixed.map(esc).join(', ') + ')</span>' + pvSugg.list.map((o, i) => {
        const ev2 = teamEval(o.team, l, threats), cov = ev2.filter(r => r.best >= 1.15).length, hol = ev2.filter(r => r.best < 0.88).map(r => r.th.sp.de);
        return '<div class="srow2"><span class="rk-n">' + (i + 1) + '</span>' + o.team.map(c => img(c.sp, 'mini') + '<span class="' + (pvSugg.fixed.includes(c.label) ? 'muted' : '') + '">' + esc(c.label) + '</span>').join(' · ') +
          '<span class="muted small2"> · deckt ' + cov + '/' + threats.length + (hol.length ? ' · Lücken: ' + hol.slice(0, 4).map(esc).join(', ') : '') + '</span><button class="btn mini" data-usesugg="' + i + '">übernehmen</button></div>';
      }).join('') + '</div>' : '') +
      (team.some(Boolean) ? '<div class="adv ' + (covered >= 14 ? 'ok' : 'up') + '">Gegen ' + covered + ' von ' + threats.length + ' Top-Meta-Pokémon hat dein Team einen klaren Konter.' + (holes.length ? ' Lücken: ' + holes.map(r => esc(r.th.sp.de)).join(', ') + '.' : '') + '</div>' +
        '<table class="cov"><tr><th>Top-Meta</th>' + team.map(t => '<th>' + (t ? img(t.sp, 'mini') + esc(t.sp.de) : '–') + '</th>').join('') + '</tr>' +
        ev.map(r => '<tr><td>' + img(r.th.sp, 'mini') + esc(r.th.sp.de) + (r.th.shadow ? ' <small>Crypto</small>' : '') + '</td>' + r.sc.map(cell).join('') + '</tr>').join('') + '</table>' +
        '<div class="muted small">✓ gewinnt meist · ≈ offen · ✗ verliert meist. Aus den Top-Siegen/-Niederlagen von PvPoke, sonst nach Typen geschätzt (keine echte Kampf-Simulation).</div>' : '<div class="empty">Wähl ein Pokémon in Slot 1 und klick „Team um Slot 1 bauen“, oder stell alle drei selbst zusammen.</div>');
    window.__pvBuild = () => {
      const fixed = team.filter(Boolean); if (!fixed.length || fixed.length >= 3) { pvSugg = null; renderPvp(); return; }
      pvSugg = { l, fixed: fixed.map(c => c.label), list: suggestTeams(fixed, pool, l, threats, 5) }; renderPvp();
    };
    window.__pvUse = i => { const o = pvSugg && pvSugg.list[i]; if (!o) return; state.ui.team[l] = o.team.map(c => c.key); pvSugg = null; save(); renderPvp(); };
    out.innerHTML = (f.cup !== 'all' ? '<div class="adv ' + (isLive(f) ? 'ok' : 'muted2') + '"><b>' + esc(f.title) + '</b> · ' + (cap >= 10000 ? 'ohne WP-Limit' : 'bis ' + cap + ' WP') + (isLive(f) ? ' · 🟢 gerade in der GO-Kampfliga' : '') + (f.rules && f.rules.length ? '<div class="sub">Regeln (PvPoke, englisch): ' + f.rules.map(esc).join(' · ') + '</div>' : '') + '</div>' : '') +
      '<h2 class="sub">🧩 Team-Bauer</h2>' + teamHtml +
      '<h2 class="sub">⭐ Deine für die ' + f.title + '</h2>' + (mineRows ? '<div class="rank">' + mineRows + '</div>' : '<div class="empty">Keine deiner Pokémon sind in den Top 150 dieser Liga (oder ihre WP liegen über dem Limit).</div>') +
      '<h2 class="sub">📊 Meta-Top 50 ' + f.title + (ty ? ' · ' + ty : '') + '</h2><div class="rank">' + metaRows + '</div>' +
      searchBox('Meta-Pokémon in deiner Box', dexList(top.slice(0, 30).map(x => pvSp(x.id).sp.dex)), 'Pokédex-Nummern der Top 30 dieser Liste.');
  }

  // ---------- Aufs Handy: Kalender-Abos (GO Calendar, aus LeekDuck-Daten, aktualisiert sich selbst) ----------
  const GOCAL = 'webcal://github.com/othyn/go-calendar/releases/latest/download/';
  const SUBS = [['gocal.ics', 'Alles'], ['gocal__community_day.ics', 'Community Day'], ['gocal__raid_hour.ics', 'Raid-Stunde'], ['gocal__raid_day.ics', 'Raid-Tag'], ['gocal__raid_battles.ics', 'Raids'],
    ['gocal__pokemon_spotlight_hour.ics', 'Rampenlicht-Stunde'], ['gocal__max_mondays.ics', 'Max Monday'], ['gocal__max_battles.ics', 'Dyna-Kämpfe'], ['gocal__event.ics', 'Events'], ['gocal__pokemon_go_tour.ics', 'GO Tour'],
    ['gocal__go_battle_league.ics', 'GO-Kampfliga'], ['gocal__research.ics', 'Forschung'], ['gocal__timed_research.ics', 'Zeitforschung'], ['gocal__go_pass.ics', 'GO Pass'], ['gocal__season.ics', 'Saison'], ['gocal__wild_area.ics', 'Wild Area']];
  function renderSubs() {
    const el = document.getElementById('subsList'); if (!el) return;
    el.innerHTML = SUBS.map(([f, n]) => '<a class="chip" href="' + GOCAL + f + '" target="_blank">📲 ' + esc(n) + '</a>').join('');
  }

  // ---------- Hintergründe: welche Pokémon welchen Hintergrund haben können (Dittobase, wöchentlich) ----------
  const BGCACHE = 'pokeplaner-bgs', DITTO = 'https://www.dittobase.com/pokemon-go/backgrounds';
  let bgData = null; try { bgData = JSON.parse(localStorage.getItem(BGCACHE)); } catch (e) {}
  let bgLoading = null;
  // Detailseite eines Hintergrunds lesen, bei Fehlern bis zu 3 Versuche
  function fetchBgDetail(it, tries) {
    return window.rhNet.get(DITTO + '/' + it.id).then(r2 => {
      if (!r2 || !r2.ok) throw new Error('http');
      const html = r2.text.split(/Explore other Backgrounds/i)[0];
      const dex = new Set(); let mm; const re = /pokemon-unpadded\/(\d+)-/g;
      while ((mm = re.exec(html))) dex.add(Number(mm[1]));
      it.dex = [...dex]; it.ok = 1;
      if (!it.img) { const bi = /(https:\/\/assets\.dittobase\.com\/[^"' )]*background[^"' )]*\.(?:webp|png|jpg))/i.exec(html); if (bi) it.img = bi[1]; }
    }).catch(() => (tries > 1 ? new Promise(res => setTimeout(res, 1500)).then(() => fetchBgDetail(it, tries - 1)) : null));
  }
  function fetchBgDetails(items) {
    bgLoading.total = items.length; renderBgProgress();
    let i = 0;
    const next = () => {
      if (i >= items.length) return Promise.resolve();
      const it = items[i++];
      return fetchBgDetail(it, 3).then(() => { bgLoading.done++; if (bgLoading.done % 10 === 0) renderBgProgress(); return next(); });
    };
    return Promise.all([next(), next(), next()]);
  }
  const saveBgs = () => { try { localStorage.setItem(BGCACHE, JSON.stringify(bgData)); } catch (e) {} };
  function loadBackgrounds(force) {
    if (!window.rhNet || bgLoading) return;
    const fresh = bgData && bgData.list && bgData.list.length && !force && Date.now() - bgData.at < 7 * 864e5;
    if (fresh) {
      // Lücken nachladen: Seiten, die beim letzten Mal nicht geladen werden konnten
      const miss = bgData.list.filter(b => !b.ok && !(b.dex && b.dex.length));
      if (!miss.length || Date.now() - (bgData.retry || 0) < 6 * 36e5) return;
      bgLoading = { done: 0, total: 0 }; bgData.retry = Date.now();
      fetchBgDetails(miss).then(() => saveBgs()).catch(() => {}).then(() => { bgLoading = null; renderAll(); });
      return;
    }
    bgLoading = { done: 0, total: 0 };
    window.rhNet.get(DITTO).then(r => {
      if (!r || !r.ok) throw new Error('index');
      const doc = new DOMParser().parseFromString(r.text, 'text/html'), seen = {}, list = [];
      doc.querySelectorAll('a[href*="/pokemon-go/backgrounds/"]').forEach(a => {
        const m = /\/pokemon-go\/backgrounds\/([a-z0-9-]+)/.exec(a.getAttribute('href') || ''); if (!m || seen[m[1]]) return;
        const im = a.querySelector('img'), txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
        const date = /([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(txt);
        let name = (im && im.getAttribute('alt')) || txt.replace(/[A-Z][a-z]{2} \d{1,2}, \d{4}.*$/, '').trim() || m[1];
        seen[m[1]] = 1; list.push({ id: m[1], n: name, img: im ? (im.getAttribute('src') || '') : '', d: date ? new Date(date[1]).getTime() : 0, dex: [] });
      });
      return fetchBgDetails(list).then(() => { bgData = { at: Date.now(), list }; saveBgs(); });
    }).catch(() => {}).then(() => { bgLoading = null; renderAll(); });
  }
  function renderBgProgress() { document.querySelectorAll('.bgprog').forEach(el => { el.textContent = bgLoading ? 'Lade Hintergrund-Liste … ' + bgLoading.done + '/' + (bgLoading.total || '?') : ''; }); }
  // Ergänzungen, wo Dittobase unvollständig ist (laut offizieller Event-Seite)
  const BG_EXTRA = { 'lc-wild-area-mexico-city-2026': [888, 889], 'lc-wild-area-sendai-2026': [888, 889] };
  // Hintergründe, die bei Dittobase fehlen. Día de Muertos 2026: Duskull und Gigadynamax-Gengar vor Ort in Mexiko-Stadt mit Ortshintergrund (gleiche Ortskarte wie City Safari 2023)
  const BG_ADD = [{ id: 'x-dia-de-muertos-2026-cdmx', n: 'Día de Muertos 2026 Mexico City (Ort)', d: new Date('2026-10-31').getTime(), dex: [94, 355], imgFrom: 'lc-city-safari-2023-mexico-city' }];
  function bgList() {
    if (!bgData || !bgData.list) return [];
    return bgData.list.concat(BG_ADD.map(x => Object.assign({ img: ((bgData.list.find(b => b.id === x.imgFrom) || {}).img) || '' }, x)));
  }
  const famDex = sp => [...new Set(DB.filter(x => x.fam === sp.fam).map(x => x.dex))];
  function bgsFor(sp) {
    if (!bgData || !bgData.list) return [];
    const fd = famDex(sp);
    return bgList().filter(b => b.dex.concat(BG_EXTRA[b.id] || []).some(d => fd.includes(d))).sort((a, b) => b.d - a.d);
  }
  const bgById = id => bgList().find(b => b.id === id) || (LCBY[id] ? { id, n: LCBY[id].n, img: LCBY[id].img ? LCIMG(LCBY[id]) : '' } : null);
  function bgBlock(m) {
    const sp = spOf(m), cur = m.bg ? bgById(m.bg) : null;
    if (!window.rhNet) return '';
    if (!bgData) { loadBackgrounds(); return '<div class="muted small2 bgprog">Lade Hintergrund-Liste …</div>'; }
    const opts = bgsFor(sp);
    const others = m.allBg ? bgList().filter(b => !opts.includes(b)).sort((a, b) => b.d - a.d) : [];
    const opt = b => '<option value="' + b.id + '"' + (m.bg === b.id ? ' selected' : '') + '>' + esc(b.n) + (b.d ? ' (' + new Date(b.d).getFullYear() + ')' : '') + '</option>';
    const more = '<button class="btn mini" data-allbg="' + m.uid + '">' + (m.allBg ? 'Nur passende zeigen' : 'Fehlt einer? Alle zeigen') + '</button>' + (bgLoading ? '<span class="muted small2 bgprog"></span>' : '<button class="btn mini" data-bgreload="1">Liste neu laden</button>');
    if (!opts.length && !cur && !m.allBg) return '<div class="bgrow"><span class="muted small2">Für ' + esc(sp.de) + ' sind keine Ortshintergründe bekannt.</span>' + more + '</div>';
    return '<div class="bgrow"><select data-bg="1" data-uid="' + m.uid + '"><option value="">– kein Hintergrund –</option>' + (others.length ? '<optgroup label="Passend">' + opts.map(opt).join('') + '</optgroup><optgroup label="Alle anderen">' + others.map(opt).join('') + '</optgroup>' : opts.map(opt).join('')) +
      (cur && !opts.some(b => b.id === cur.id) ? '<option value="' + esc(cur.id) + '" selected>' + esc(cur.n) + '</option>' : '') + '</select>' +
      (cur && cur.img ? '<img class="bgimg" src="' + esc(cur.img) + '" alt="">' : '') + '<span class="muted small2">' + opts.length + ' mögliche für ' + esc(sp.de) + ' und Familie</span>' + more + '</div>';
  }

  // ---------- Screenshot-Import (Bewertungsansicht) ----------
  // Positionen gemessen auf iPhone-Screenshots mit 1179 px Breite, werden auf andere Breiten skaliert
  const SC = { w: 1179, bars: [1916, 2024, 2132], barX: [140, 548], star: [1065, 195],
    rects: { name: [150, 1030, 880, 110], kp: [300, 1150, 580, 150], wp: [370, 130, 450, 110], txt: [40, 2280, 1100, 230], candy: [440, 1680, 400, 160] } };
  let scanRows = [], scanBusy = false, scanNext = 1;
  const normName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
  const NAMEIDX = [...new Set(DB.map(sp => sp.de))].map(n => ({ n, k: normName(n) }));
  function matchName(raw) {
    const words = String(raw || '').split(/\s+/).map(normName).filter(w => w.length >= 3);
    let best = null;
    words.concat(words.length > 1 ? [words.join('')] : []).forEach(w => NAMEIDX.forEach(x => { const d = lev(w, x.k), sc = d / Math.max(3, x.k.length); if (!best || sc < best.sc) best = { n: x.n, sc }; }));
    return best && best.sc <= 0.34 ? best.n : null;
  }
  function loadImg(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => res({ im, url: fr.result }); im.onerror = rej; im.src = fr.result; }; fr.onerror = rej; fr.readAsDataURL(file); }); }
  function analyzePixels(im) {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const f = c.width / SC.w, px = (x, y) => g.getImageData(Math.round(x * f), Math.round(y * f), 1, 1).data;
    const iv = SC.bars.map(y => { let fill = null; for (let x = SC.barX[0]; x <= SC.barX[1] + 2; x++) { const p = px(x, y); if (p[0] > 200 && p[0] - p[2] > 60) fill = x; } return fill === null ? 0 : Math.max(0, Math.min(15, Math.round((fill - SC.barX[0]) / (SC.barX[1] - SC.barX[0]) * 15))); });
    const st = px(SC.star[0], SC.star[1]), fav = st[0] > 200 && st[1] > 140 && st[2] < 90;
    let dyna = 0, giga = 0;
    for (let y = 1550; y < 1800; y += 3) for (let x = 388; x < 484; x += 4) { const p = px(x, y); if (Math.abs(p[0] - 73) < 12 && Math.abs(p[1] - 58) < 12 && Math.abs(p[2] - 124) < 12) dyna++; if (Math.abs(p[0] - 44) < 12 && Math.abs(p[1] - 62) < 12 && Math.abs(p[2] - 112) < 12) giga++; }
    const th = document.createElement('canvas'); th.width = 90; th.height = Math.round(90 * c.height / c.width * 0.35);
    th.getContext('2d').drawImage(c, 0, 0, c.width, c.height * 0.35, 0, 0, th.width, th.height);
    const rects = {}; Object.keys(SC.rects).forEach(k => { const r = SC.rects[k]; rects[k] = { left: Math.round(r[0] * f), top: Math.round(r[1] * f), width: Math.round(r[2] * f), height: Math.round(r[3] * f) }; });
    return { iv, fav, mode: giga > 40 ? 'g' : dyna > 40 ? 'd' : 'n', thumb: th.toDataURL('image/jpeg', 0.7), rects };
  }
  // Form und Level aus KP + IVs (+ WP, soweit lesbar) bestimmen
  function resolveForm(deName, iv, kp, wpTxt) {
    const cands = DB.filter(sp => sp.de === deName);
    const digits = (String(wpTxt || '').match(/\d+/g) || []).join('');
    let best = null;
    cands.forEach(sp => { for (let l = 1; l <= 51; l += 0.5) {
      const c = cpmAt(l), hp = Math.floor((sp.b[2] + iv[2]) * c); if (kp && hp !== kp) continue;
      const cp = cpFor(sp.b, iv, l), cs = String(cp);
      const score = (digits === cs ? 0 : digits.endsWith(cs.slice(-3)) || digits.includes(cs) ? 1 : 2 + Math.min(5, lev(digits, cs))) + (sp.f ? 0.1 : 0);
      if (!best || score < best.score) best = { sp, l, cp, score };
    } });
    // gleiche Werte bei mehreren Formen (z. B. Weißes/Schwarzes Kyurem) -> Nutzer fragen
    if (best) best.tie = cands.some(sp => sp !== best.sp && sp.b.join() === best.sp.b.join());
    return best;
  }
  async function processShot(row, file) {
    try {
      const { im } = await loadImg(file);
      const a = analyzePixels(im);
      Object.assign(row, { thumb: a.thumb, iv: a.iv, fav: a.fav, mode: a.mode, status: 'Text lesen …' }); renderScan();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      const r = await window.rhNet.ocr(c.toDataURL('image/png'), a.rects);
      if (!r || !r.ok) throw new Error(r && r.error || 'Texterkennung fehlgeschlagen');
      const t = r.text, kpm = /(\d{2,4})\s*\/\s*(\d{2,4})\s*K\s*P/i.exec((t.kp || '') + ' ' + (t.name || ''));
      row.kp = kpm ? Number(kpm[2]) : null;
      row.lucky = /GL[ÜU]CKS/i.test((t.name || '') + (t.kp || ''));
      const dm = /am\s+(\d{2})\.(\d{2})\.(\d{4})/.exec(t.txt || ''), wm = /N[äa]he von\s+(.+?)\s+gefangen/i.exec((t.txt || '').replace(/\s+/g, ' '));
      row.caught = dm ? dm[3] + '-' + dm[2] + '-' + dm[1] : ''; row.where = wm ? wm[1] : '';
      let de = matchName(t.name);
      if (!de) { const cm = /([A-ZÄÖÜa-zäöüß]+)\s*-\s*$/m.exec(t.candy || '') || /([A-ZÄÖÜ]{3,})-/.exec(t.candy || ''); if (cm) de = matchName(cm[1]); }
      const txtName = /Dieses?\s+(\S+)\s+wurde/i.exec((t.txt || '').replace(/\s+/g, ' ')); if (!de && txtName) de = matchName(txtName[1]);
      if (!de) { row.status = 'Pokémon nicht erkannt, bitte auswählen'; row.err = true; renderScan(); return; }
      const res = resolveForm(de, row.iv, row.kp, t.wp);
      if (res) { row.k = res.sp.k; row.lvl = res.l; row.wp = res.cp; row.status = res.tie ? 'Form bitte prüfen' : res.score < 2 ? 'erkannt' : 'erkannt (WP geschätzt)'; if (res.tie) row.err = true; }
      else { row.k = (DB.find(sp => sp.de === de) || {}).k; row.status = 'KP passt nicht zu den IVs, bitte prüfen'; row.err = true; }
      if (row.k && !SP[row.k].m.includes(row.mode)) row.mode = SP[row.k].m[0];
    } catch (err) { row.status = 'Fehler: ' + err.message; row.err = true; }
    renderScan();
  }
  async function runScan(files) {
    if (!window.rhNet || !window.rhNet.ocr) { $('#scanBox').innerHTML = '<div class="adv warn">Dafür muss die App einmal neu gestartet werden (⌘Q und wieder öffnen).</div>'; return; }
    const list = [...files].filter(f => /image\//.test(f.type) || /\.(png|jpe?g|heic)$/i.test(f.name));
    const rows = list.map(f => ({ id: scanNext++, file: f, name: f.name, iv: [0, 0, 0], status: 'wartet …', shiny: false, crypto: false, purified: false, lucky: false, fav: false, mode: 'n', bg: '' }));
    scanRows = scanRows.concat(rows); renderScan();
    if (scanBusy) return; scanBusy = true;
    // immer die aktuelle Liste abarbeiten, auch wenn währenddessen neue Bilder dazukommen
    let row;
    while ((row = scanRows.find(r => r.status === 'wartet …'))) {
      row.status = 'lese Bild …'; renderScan();
      await Promise.race([processShot(row, row.file), new Promise(res => setTimeout(() => { if (/lese|Text/.test(row.status)) { row.status = 'Zeitüberschreitung, bitte prüfen'; row.err = true; } res(); }, 30000))]);
    }
    scanBusy = false; renderScan();
  }
  // Import-Liste zwischenspeichern, damit Häkchen ein Neuladen überleben
  const SCANKEY = 'pokeplaner-scan';
  try { const sv = JSON.parse(localStorage.getItem(SCANKEY)); if (Array.isArray(sv) && sv.length) { scanRows = sv.map(r => /wartet|lese|Text/.test(r.status) ? Object.assign(r, { status: 'nicht fertig gelesen, Bild bitte nochmal reinziehen', err: true }) : r); scanNext = Math.max(...scanRows.map(r => r.id)) + 1; } } catch (e) {}
  function renderScan() {
    try { localStorage.setItem(SCANKEY, JSON.stringify(scanRows.map(r => Object.assign({}, r, { file: null })))); } catch (e) {}
    const box = $('#scanBox'); if (!box) return;
    if (!scanRows.length) { box.innerHTML = ''; return; }
    const done = scanRows.filter(r => r.k && !/wartet|lese|Text/.test(r.status)).length;
    const FLAGS = [['shiny', '✨ Shiny'], ['lucky', 'Glück'], ['crypto', 'Crypto'], ['purified', 'Erlöst'], ['fav', '★ Favorit'], ['buddy', 'Kumpel']];
    const head = '<div class="panel wide scanp"><div class="scanhead"><b>📸 Screenshot-Import</b><span class="muted">' + done + ' von ' + scanRows.length + ' fertig</span></div>' +
      '<div class="scanall"><span class="muted small2">Alle:</span>' + FLAGS.map(([k, l]) => '<button class="chip" data-scall="' + k + '">' + l + '</button>').join('') + '</div>';
    const rows = scanRows.map(r => {
      const sp = r.k ? SP[r.k] : null;
      const opts = sp ? DB.filter(x => x.dex === sp.dex).map(x => '<option value="' + x.k + '"' + (x.k === r.k ? ' selected' : '') + '>' + esc(spPlain(x)) + '</option>').join('') + '<option value="__other">anderes Pokémon …</option>'
        : '<option value="">Pokémon wählen …</option>' + DBSORT.slice().sort((a, b) => a.de.localeCompare(b.de, 'de')).map(x => '<option value="' + x.k + '">' + esc(spPlain(x)) + '</option>').join('');
      const flags = FLAGS.map(([k, l]) => '<button class="sflag' + (r[k] ? ' on' : '') + '" data-scflag="' + k + '" data-sid="' + r.id + '">' + l + '</button>').join('');
      const modes = sp && sp.m.length > 1 ? '<select class="ssel" data-sc="mode" data-sid="' + r.id + '">' + sp.m.map(x => '<option value="' + x + '"' + (r.mode === x ? ' selected' : '') + '>' + MODE_NAME[x] + '</option>').join('') + '</select>' : '';
      const bgs = sp && bgData ? bgsFor(sp) : [];
      const bgSel = bgs.length ? '<select class="ssel" data-sc="bg" data-sid="' + r.id + '"><option value="">kein Hintergrund</option>' + bgs.map(b => '<option value="' + b.id + '"' + (r.bg === b.id ? ' selected' : '') + '>' + esc(b.n) + '</option>').join('') + '</select>' : '';
      return '<div class="srow' + (r.err ? ' bad' : '') + '">' +
        (r.thumb ? '<img class="sthumb" src="' + r.thumb + '">' : '<div class="sthumb"></div>') +
        '<div class="spic">' + (sp ? img(sp, 'spr', r.shiny) : '') + '</div>' +
        '<div class="smain"><div class="sline"><select class="ssel sname" data-sc="k" data-sid="' + r.id + '">' + opts + '</select>' + modes + '</div>' +
          '<div class="sline"><span class="muted small2">IV</span>' + [0, 1, 2].map(i => '<input class="sivn" type="number" min="0" max="15" data-sc="iv' + i + '" data-sid="' + r.id + '" value="' + r.iv[i] + '">').join('') +
          '<span class="muted small2 sgap">WP</span><input class="swpin" type="number" min="10" data-sc="wp" data-sid="' + r.id + '" value="' + (r.wp || '') + '">' +
          '<span class="muted small2">Lv</span><input class="sivn" type="number" min="1" max="51" step="0.5" data-sc="lvl" data-sid="' + r.id + '" value="' + (r.lvl || '') + '">' +
          '<span class="muted small2">' + (r.kp ? r.kp + ' KP' : '') + '</span></div>' +
          '<div class="sline">' + flags + bgSel + '</div>' +
          '<div class="sstat' + (r.err ? ' warn' : '') + '">' + esc(r.status) + (r.caught ? ' · gefangen ' + esc(r.caught.split('-').reverse().join('.')) : '') + '</div></div>' +
        '<button class="tg del" data-scdel="' + r.id + '" title="entfernen">✕</button></div>';
    }).join('');
    box.innerHTML = head + rows + '<div class="boss-pick"><button class="btn primary" data-scsave="1"' + (done ? '' : ' disabled') + '>' + done + ' übernehmen</button><button class="btn" data-scclear="1">Verwerfen</button>' + (scanBusy ? '<span class="muted small2">liest noch ' + (scanRows.length - done) + ' Bilder, fertige kannst du schon übernehmen</span>' : '') + '</div></div>';
  }
  function recalcRow(r) {
    if (!r.k || !r.kp) return;
    const sp = SP[r.k];
    for (let l = 1; l <= 51; l += 0.5) { if (Math.floor((sp.b[2] + r.iv[2]) * cpmAt(l)) === r.kp) { r.lvl = l; r.wp = cpFor(sp.b, r.iv, l); r.err = false; r.status = 'angepasst'; return; } }
    r.status = 'KP passt nicht zu den IVs'; r.err = true;
  }
  function saveScan() {
    let n = 0, dup = 0;
    const isDone = r => r.k && !/wartet|lese|Text/.test(r.status);
    const keep = scanRows.filter(r => !isDone(r));
    scanRows.filter(isDone).forEach(r => {
      if (state.mons.some(m => m.k === r.k && m.iv.join() === r.iv.join() && String(m.wp) === String(r.wp))) { dup++; return; }
      const m = addMon(r.k, r.mode);
      // Kumpel: angezeigte Werte gelten für Level +1
      Object.assign(m, { buddy: !!r.buddy, iv: r.iv.slice(), wp: r.wp || '', lvl: r.lvl ? (r.buddy ? Math.max(1, r.lvl - 1) : r.lvl) : '', lvlSrc: 'wp', shiny: r.shiny, lucky: r.lucky, crypto: r.crypto && r.mode === 'n', purified: r.purified, fav: r.fav, bg: r.bg || '', caught: r.caught || '', where: r.where || '' });
      n++;
    });
    scanRows = keep; renderScan(); save(); renderAll();
    $('#importMsg').innerHTML = '<div class="adv ok">✔ ' + n + ' Pokémon aus Screenshots übernommen' + (dup ? ', ' + dup + ' waren schon da' : '') + '. Attacken bitte noch eintragen (stehen nicht auf dem Bewertungs-Screenshot).</div>';
  }


  // ---------- Sync zwischen Mac und Handy über einen privaten GitHub-Gist ----------
  const SYNCKEY = 'pokeplaner-sync', WEBURL = 'https://mattislhm.github.io/pokeplaner/';
  let syncCfg = {}; try { syncCfg = JSON.parse(localStorage.getItem(SYNCKEY)) || {}; } catch (e) {}
  const saveSync = () => { try { localStorage.setItem(SYNCKEY, JSON.stringify(syncCfg)); } catch (e) {} };
  let syncTimer = null, syncBusy = false, syncAgain = false;
  const syncOn = () => !!(syncCfg.token && syncCfg.gist);
  function syncSoon() { if (!syncOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 3000); }
  function gh(path, opt) {
    return fetch('https://api.github.com' + path, Object.assign({ cache: 'no-store' }, opt, { headers: { Authorization: 'Bearer ' + syncCfg.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } }))
      .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status)); return j; }));
  }
  const fileText = f => !f ? Promise.resolve(null) : f.truncated && f.raw_url ? fetch(f.raw_url, { cache: 'no-store' }).then(r => r.text()) : Promise.resolve(f.content);
  // Fremden Stand einmischen: pro Pokémon gewinnt die neuere Änderung, Löschungen gelten, wenn sie neuer sind
  function mergeRemote(rem) {
    if (!rem || !Array.isArray(rem.mons)) return false;
    const before = JSON.stringify([state.mons, state.tags, state.tol]);
    state.del = state.del || {};
    Object.keys(rem.del || {}).forEach(u => { if (!state.del[u] || rem.del[u] > state.del[u]) state.del[u] = rem.del[u]; });
    const byUid = {}; state.mons.forEach(m => { byUid[m.uid] = m; });
    rem.mons.forEach(r => {
      if (!SP[r.k]) return;
      const l = byUid[r.uid], dt = state.del[r.uid] || 0;
      if (dt >= (r.upd || 0) && dt) return;
      if (!l) { state.mons.push(r); byUid[r.uid] = r; }
      else if ((r.upd || 0) > (l.upd || 0)) Object.assign(state.mons[state.mons.indexOf(l)] = r);
    });
    state.mons = state.mons.filter(m => !(state.del[m.uid] && state.del[m.uid] >= (m.upd || 0)));
    if ((rem.gupd || 0) > (state.gupd || 0)) { state.tags = rem.tags || []; state.tol = rem.tol ?? state.tol; state.gupd = rem.gupd; }
    // alte Löschmarken nach 60 Tagen vergessen
    const cut = Date.now() - 60 * 864e5; Object.keys(state.del).forEach(u => { if (state.del[u] < cut) delete state.del[u]; });
    const changed = JSON.stringify([state.mons, state.tags, state.tol]) !== before;
    if (changed) { save(true); renderAll(); }
    return changed;
  }
  const payload = () => JSON.stringify({ v: 1, at: Date.now(), from: window.PP_WEB ? 'handy' : 'mac', mons: state.mons, del: state.del || {}, tags: state.tags || [], tol: state.tol, gupd: state.gupd || 0 });
  async function syncNow() {
    if (!syncOn()) return;
    if (syncBusy) { syncAgain = true; return; }
    syncBusy = true; syncCfg.err = '';
    try {
      const g = await gh('/gists/' + syncCfg.gist);
      const txt = await fileText(g.files && g.files['pokeplaner.json']);
      let rem = null; try { rem = txt ? JSON.parse(txt) : null; } catch (e) {}
      mergeRemote(rem);
      const mine = payload(), files = {};
      const remSig = rem ? JSON.stringify([rem.mons, rem.del || {}, rem.tags || [], rem.tol, rem.gupd || 0]) : '';
      if (JSON.stringify([state.mons, state.del || {}, state.tags || [], state.tol, state.gupd || 0]) !== remSig) files['pokeplaner.json'] = { content: mine };
      // Der Mac legt alle 6 Stunden Events, News, Hintergründe und Bosse dazu, damit das Handy sie auch hat
      if (!window.PP_WEB && Date.now() - (syncCfg.cacheAt || 0) > 6 * 3600e3) {
        const keys = {}; ['raidhelfer-events', 'raidhelfer-news', 'pokeplaner-bgs', 'raidhelfer-bosses'].forEach(k => { try { const v = JSON.parse(localStorage.getItem(k)); if (v) keys[k] = v; } catch (e) {} });
        files['cache.json'] = { content: JSON.stringify({ at: Date.now(), keys }) }; syncCfg.cacheAt = Date.now();
      }
      if (Object.keys(files).length) await gh('/gists/' + syncCfg.gist, { method: 'PATCH', body: JSON.stringify({ files }) });
      syncCfg.last = Date.now();
    } catch (err) { syncCfg.err = String(err.message || err); }
    saveSync(); syncBusy = false; renderSyncInfo();
    if (syncAgain) { syncAgain = false; syncSoon(); }
  }
  async function syncSetup(token) {
    syncCfg.token = token.trim(); syncCfg.err = ''; renderSyncInfo('Verbinde …');
    try {
      if (!syncCfg.gist) {
        // vorhandenen PokéPlaner-Gist suchen, sonst neu anlegen (privat)
        const list = await gh('/gists?per_page=100');
        const found = list.find(g => g.files && g.files['pokeplaner.json']);
        syncCfg.gist = found ? found.id : (await gh('/gists', { method: 'POST', body: JSON.stringify({ public: false, description: 'PokéPlaner Sync (privat)', files: { 'pokeplaner.json': { content: payload() } } }) })).id;
      }
      saveSync(); syncCfg.cacheAt = 0; await syncNow();
    } catch (err) { syncCfg.err = String(err.message || err); saveSync(); renderSyncInfo(); }
  }
  function renderSyncInfo(msg) {
    const el = document.getElementById('syncBox'); if (!el) return;
    const link = syncOn() ? WEBURL + '#sync=' + encodeURIComponent(syncCfg.token + '.' + syncCfg.gist) : '';
    let qr = '';
    if (link && !window.PP_WEB && window.qrcode) { try { const q = qrcode(0, 'L'); q.addData(link); q.make(); qr = q.createSvgTag(4, 8); } catch (e) {} }
    el.innerHTML = (msg ? '<p class="muted small">' + esc(msg) + '</p>' : '') +
      (syncOn() ? '<p class="small">' + (syncCfg.err ? '⚠ ' + esc(syncCfg.err) : syncCfg.last ? '✔ Zuletzt abgeglichen ' + new Date(syncCfg.last).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : 'Verbunden, gleich wird abgeglichen …') + '</p>' +
        '<div class="btns"><button class="btn" data-syncnow="1">Jetzt abgleichen</button><button class="btn danger" data-syncoff="1">Trennen</button></div>' +
        (window.PP_WEB ? '' : '<p class="muted small" style="margin-top:10px"><b>Handy verbinden:</b> Code mit der iPhone-Kamera scannen, in Safari öffnen, dann „Teilen“ → „Zum Home-Bildschirm“. Der Code enthält deinen Schlüssel, also nicht weitergeben.</p><div class="qrbox">' + qr + '</div>')
      : '<p class="muted small">Gleicht deine Pokémon zwischen Mac und Handy ab, auch unterwegs. Dafür einmal einen GitHub-Schlüssel mit dem Recht „Gists“ eintragen.</p>' +
        '<div class="btns"><input type="password" id="syncToken" class="syncin" placeholder="GitHub-Schlüssel (github_pat_… oder ghp_…)" autocomplete="off"><button class="btn primary" data-syncset="1">Verbinden</button></div>');
  }

  window.__sync = { now: () => syncNow(), set: c => { syncCfg = c; saveSync(); } };
  // ---------- Steuerung ----------
  let current = 'mine';
  function renderAll() {
    renderSide();
    ({ overview: renderOverview, mine: renderMine, team: renderTeam, ranking: renderRanking, raids: renderRaids, rranking: renderRRanking, events: renderEvents, settings: () => { renderSources(); renderNotifSettings(); renderBackup(); renderSubs(); }, cleanup: renderCleanup, pvp: renderPvp }[current] || (() => {}))();
  }
  function show(v) {
    current = v;
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
    if (v === 'raids') loadLive();
    renderAll();
  }
  document.addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden'; }, true);
  document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  const monBy = uid => state.mons.find(m => m.uid === Number(uid));
  function goto(uid) { showDetail(uid); }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-syncnow],[data-syncoff],[data-syncset],[data-bgreload],[data-scflag],[data-scall],[data-scdel],[data-scsave],[data-scclear],[data-allbg],[data-league],[data-build],[data-usesugg],[data-clearteam],[data-copy],[data-ics],[data-nt],[data-toggle],[data-tagt],[data-tagf],[data-tagdel],[data-evm],[data-evf],[data-evtab],[data-ivset],[data-hundo],[data-pick],[data-add],[data-tog],[data-del],[data-open],[data-goto],[data-detail],[data-mode-set],[data-show2],[data-mf],[data-pf],[data-boss],.card');
    if (!t) return;
    if (t.dataset.pick) { const m = addMon(t.dataset.pick); closePicker(); showDetail(m.uid); return; }
    if (t.dataset.add) { const m = addMon(t.dataset.add, t.dataset.mode); if (t.dataset.crypto) m.crypto = true; save(); showDetail(m.uid); return; }
    if (t.dataset.syncnow) { syncNow(); renderSyncInfo('Gleiche ab …'); return; }
    if (t.dataset.syncoff) { syncCfg = {}; saveSync(); renderSyncInfo(); return; }
    if (t.dataset.syncset) { const v = ($('#syncToken') || {}).value || ''; if (v.trim()) syncSetup(v); return; }
    if (t.dataset.bgreload) { loadBackgrounds(true); renderAll(); return; }
    if (t.dataset.scflag) { const r = scanRows.find(x => x.id === Number(t.dataset.sid)); if (r) { r[t.dataset.scflag] = !r[t.dataset.scflag]; renderScan(); } return; }
    if (t.dataset.scall) { const k = t.dataset.scall, on = !scanRows.every(r => r[k]); scanRows.forEach(r => { r[k] = on; }); renderScan(); return; }
    if (t.dataset.scdel) { scanRows = scanRows.filter(r => r.id !== Number(t.dataset.scdel)); renderScan(); return; }
    if (t.dataset.scsave) { saveScan(); return; }
    if (t.dataset.scclear) { scanRows = []; renderScan(); return; }
    if (t.dataset.allbg) { const m = monBy(t.dataset.allbg); m.allBg = !m.allBg; save(); renderAll(); return; }
    if (t.dataset.league) { state.ui.pvKey = t.dataset.league; save(); loadPvp(); renderPvp(); return; }
    if (t.dataset.build) { if (window.__pvBuild) window.__pvBuild(); return; }
    if (t.dataset.usesugg) { if (window.__pvUse) window.__pvUse(Number(t.dataset.usesugg)); return; }
    if (t.dataset.clearteam) { const l = curFmt().key; state.ui.team = state.ui.team || {}; state.ui.team[l] = []; save(); renderPvp(); return; }
    if (t.dataset.copy !== undefined) { navigator.clipboard.writeText(t.dataset.copy).then(() => { t.textContent = '✔ Kopiert'; setTimeout(() => { t.textContent = 'Kopieren'; }, 1500); }).catch(() => {}); return; }
    if (t.dataset.ics) { const ev = evData && evData.events.find(x => x.eventID === t.dataset.ics); if (ev) { addToCalendar(ev); t.textContent = '✔ Geöffnet'; } return; }
    if (t.dataset.nt) { const n = notifSettings(), k = t.dataset.nt; n.types = n.types.includes(k) ? n.types.filter(x => x !== k) : n.types.concat(k); save(); renderNotifSettings(); return; }
    if (t.dataset.toggle) { toggleOpen(t.dataset.toggle); renderMine(); return; }
    if (t.dataset.tagt) { const m = monBy(t.dataset.uid), tg = t.dataset.tagt; m.tags = m.tags || []; m.tags = m.tags.includes(tg) ? m.tags.filter(x => x !== tg) : m.tags.concat(tg); save(); renderAll(); return; }
    if (t.dataset.tagf) { const f = state.ui.tf || []; state.ui.tf = f.includes(t.dataset.tagf) ? f.filter(x => x !== t.dataset.tagf) : f.concat(t.dataset.tagf); save(); renderMine(); return; }
    if (t.dataset.tagdel) { const tg = t.dataset.tagdel; if (t.dataset.confirm) { state.tags = (state.tags || []).filter(x => x !== tg); state.mons.forEach(m => { if (m.tags) m.tags = m.tags.filter(x => x !== tg); }); state.ui.tf = (state.ui.tf || []).filter(x => x !== tg); save(); renderAll(); } else { t.dataset.confirm = 1; t.textContent = 'löschen?'; } return; }
    if (t.dataset.evm) { evMonth += Number(t.dataset.evm); renderEvents(); return; }
    if (t.dataset.evf) { const f = state.ui.evf || []; state.ui.evf = f.includes(t.dataset.evf) ? f.filter(x => x !== t.dataset.evf) : f.concat(t.dataset.evf); save(); renderEvents(); return; }
    if (t.dataset.evtab) { state.ui.evtab = t.dataset.evtab; save(); renderEvents(); return; }
    if (t.dataset.ivset) { const m = monBy(t.dataset.uid), i = Number(t.dataset.i), v = Number(t.dataset.ivset); m.iv[i] = v; if (m.lvl) { const w = wpFor(m); if (w) m.wp = w; } else { const l = levelFromWp(m); if (l) { m.lvl = l; m.lvlSrc = 'wp'; } } save(); renderAll(); return; }
    if (t.dataset.hundo) { const m = monBy(t.dataset.hundo); m.iv = [15, 15, 15]; if (m.lvl) { const w = wpFor(m); if (w) m.wp = w; } save(); renderAll(); return; }
    if (t.dataset.mf) { state.ui.mf = state.ui.mf || {}; state.ui.mf[t.dataset.mf] = !state.ui.mf[t.dataset.mf]; save(); renderMine(); return; }
    if (t.dataset.pf) { state.ui.pf = state.ui.pf || {}; state.ui.pf[t.dataset.pf] = !state.ui.pf[t.dataset.pf]; save(); renderPicker(); return; }
    if (t.dataset.boss) { $('#rbossSel').value = t.dataset.boss; $('#rbossT1').value = ''; $('#rbossT2').value = ''; state.rboss = t.dataset.boss; fillBossMoves('rboss'); save(); renderRaids(); return; }
    if (t.dataset.modeSet) { const m = monBy(t.dataset.uid); m.mode = t.dataset.modeSet; if (m.mode !== 'n') m.crypto = false; save(); renderAll(); return; }
    if (t.dataset.show2) { const m = monBy(t.dataset.show2); m.show2 = true; renderAll(); return; }
    if (t.dataset.tog) { const m = monBy(t.dataset.uid); m[t.dataset.tog] = !m[t.dataset.tog]; save(); renderAll(); return; }
    if (t.dataset.del) {
      if (t.dataset.confirm) { state.mons = state.mons.filter(m => m.uid !== Number(t.dataset.del)); toggleOpen(t.dataset.del, false); save(); renderAll(); }
      else { t.dataset.confirm = '1'; t.textContent = '?'; t.title = 'Nochmal klicken zum Entfernen'; setTimeout(() => { if (t.isConnected) { delete t.dataset.confirm; t.textContent = '✕'; } }, 2500); }
      return;
    }
    if (t.dataset.open) { show(t.dataset.open); if (t.dataset.open === 'mine') openPicker(); return; }
    if (t.dataset.goto || t.dataset.detail) { showDetail(t.dataset.goto || t.dataset.detail); return; }
    if (t.classList.contains('card')) { show('ranking'); $('#rankType').value = t.dataset.type; renderRanking(); }
  });
  document.addEventListener('change', e => {
    const t = e.target, d = t.dataset;
    if (d.mv) { const m = monBy(d.uid); m[d.mv] = t.value; if (d.mv === 'c2' && !t.value) m.show2 = false; save(); renderAll(); return; }
    if (d.togC) { const m = monBy(d.uid); m[d.togC] = t.checked; if (d.togC === 'buddy') { const w = wpFor(m); if (w) m.wp = w; } save(); renderAll(); return; }
    if (d.k) { const m = monBy(d.uid); m[d.k] = Number(t.value); save(); renderAll(); return; }
    if (d.wp) { const m = monBy(d.wp); m.wp = t.value === '' ? '' : Math.max(10, Math.round(Number(t.value))); m.lvl = ''; const l = levelFromWp(m); if (l) { m.lvl = l; m.lvlSrc = 'wp'; } save(); renderAll(); return; }
    if (d.lvl) { const m = monBy(d.lvl); m.lvl = t.value === '' ? '' : Math.max(1, Math.min(50, Math.round(Number(t.value) * 2) / 2)); m.lvlSrc = 'manual'; const w = wpFor(m); if (w) m.wp = w; save(); renderAll(); return; }
  });
  $('#addBtn').addEventListener('click', openPicker);
  $('#pickClose').addEventListener('click', closePicker);
  $('#picker').addEventListener('click', e => { if (e.target.id === 'picker') closePicker(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#picker').hidden) closePicker(); });
  $('#closeAll').addEventListener('click', () => { state.ui.open = []; save(); renderMine(); });
  $('#tagAdd').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) { state.tags = state.tags || []; if (!state.tags.includes(v)) state.tags.push(v); e.target.value = ''; save(); renderAll(); } } });
  $('#pickSearch').addEventListener('input', renderPicker);
  $('#pickType').addEventListener('input', renderPicker);
  $('#pickSearch').addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('#pickList [data-pick]'); if (b) b.click(); } });
  ['#mineSearch', '#mineType', '#mineMode', '#mineSort'].forEach(s => $(s).addEventListener('input', renderMine));
  if (state.ui.sortBy) $('#mineSort').value = state.ui.sortBy;
  $('#mineSort').addEventListener('change', () => { state.ui.sortBy = $('#mineSort').value; save(); });
  $('#mineDir').addEventListener('click', () => { state.ui.sortAsc = !state.ui.sortAsc; save(); renderMine(); });

  const typeOpts = TYPES.map(t => '<option>' + t + '</option>').join('');
  $('#pickType').innerHTML = '<option value="">Alle Typen</option>' + typeOpts;
  $('#mineType').innerHTML = '<option value="">Alle Typen</option>' + typeOpts;
  $('#rankType').innerHTML = typeOpts + '<option value="Tanks">Tanks &amp; Heiler</option>';
  $('#rankType').addEventListener('input', renderRanking);
  $('#rrankType').innerHTML = typeOpts;
  ['#rrankType', '#rrMega', '#rrCrypto'].forEach(s => $(s).addEventListener('input', renderRRanking));
  const bossOptions = list => '<option value="">– Boss wählen –</option>' + list.map(v => '<option value="' + bossKey(v) + '">' + esc((v.label ? v.label + ' ' : '') + spPlain(v.sp)) + '</option>').join('');
  $('#bossSel').innerHTML = bossOptions(BOSSVARS.filter(v => !v.mega));
  $('#rbossSel').innerHTML = bossOptions(BOSSVARS);
  const wOpts = Object.keys(WEATHER).map(k => '<option value="' + k + '">' + WEATHER[k][0] + '</option>').join('');
  [['boss', renderTeam], ['rboss', renderRaids]].forEach(([p, fn]) => {
    const s = '#' + p + 'Sel', t1 = '#' + p + 'T1', t2 = '#' + p + 'T2';
    $(t1).innerHTML = '<option value="">Typ 1</option>' + typeOpts;
    $(t2).innerHTML = '<option value="">Typ 2</option>' + typeOpts;
    $('#' + p + 'W').innerHTML = wOpts;
    if (state[p] && BV[state[p]]) $(s).value = state[p];
    if (state[p + 'W']) $('#' + p + 'W').value = state[p + 'W'];
    fillBossMoves(p);
    $(s).addEventListener('input', () => { state[p] = $(s).value; if (state[p]) { $(t1).value = ''; $(t2).value = ''; } fillBossMoves(p); save(); fn(); });
    [t1, t2].forEach(x => $(x).addEventListener('input', () => { $(s).value = ''; state[p] = ''; fillBossMoves(p); save(); fn(); }));
    $('#' + p + 'W').addEventListener('input', () => { state[p + 'W'] = $('#' + p + 'W').value; save(); fn(); });
    ['F', 'C'].forEach(x => $('#' + p + x).addEventListener('input', fn));
  });
  $('#backupOpen').addEventListener('click', () => { if (window.rhNet && window.rhNet.openBackup) window.rhNet.openBackup(); });
  $('#evReload').addEventListener('click', () => { evData = null; news = null; renderEvents(); loadEvents(true); loadNews(true); });
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.notif; if (!k) return; const n = notifSettings(); if (k === 'on') { n.on = e.target.checked; if (n.on) { loadEvents(); try { Notification.requestPermission(); } catch (er) {} } } else n.lead = Number(e.target.value); save(); renderNotifSettings(); checkNotifs(); });
  setInterval(() => { loadEvents(); checkNotifs(); }, 60000);
  renderScan();
  setTimeout(() => loadFormats(), 4000);
  // Sync: beim Start Stand vom Handy/Mac übernehmen, dann regelmäßig und beim Zurückkehren in die App abgleichen
  try { const pre = localStorage.getItem('pokeplaner-remote'); if (pre) { localStorage.removeItem('pokeplaner-remote'); mergeRemote(JSON.parse(pre)); } } catch (e) {}
  renderSyncInfo();
  if (syncOn()) setTimeout(syncNow, 1500);
  setInterval(() => { if (syncOn() && document.visibilityState !== 'hidden') syncNow(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && syncOn()) syncNow(); });
  document.addEventListener('change', e => {
    const d = e.target.dataset || {}; if (!d.sc) return;
    const r = scanRows.find(x => x.id === Number(d.sid)); if (!r) return;
    const k = d.sc, el = e.target;
    if (k === 'k') { if (el.value === '__other') { r.k = ''; } else { r.k = el.value; r.err = false; recalcRow(r); if (!SP[r.k].m.includes(r.mode)) r.mode = SP[r.k].m[0]; } }
    else if (/^iv\d$/.test(k)) { r.iv[Number(k[2])] = Math.max(0, Math.min(15, Number(el.value) || 0)); recalcRow(r); }
    else if (k === 'wp') {
      r.wp = Number(el.value) || ''; r.status = 'WP manuell'; r.err = false;
      if (r.k && r.wp) { const sp = SP[r.k]; let best = null; for (let l = 1; l <= 51; l += 0.5) { const d = Math.abs(cpFor(sp.b, r.iv, l) - r.wp); if (!best || d < best.d) best = { l, d }; } if (best) r.lvl = best.l; }
    }
    else if (k === 'lvl') {
      const l = Math.round(Number(el.value) * 2) / 2; r.lvl = l >= 1 && l <= 51 ? l : ''; r.status = 'Level manuell'; r.err = false;
      if (r.k && r.lvl) r.wp = cpFor(SP[r.k].b, r.iv, r.lvl);
    }
    else if (el.type === 'checkbox') r[k] = el.checked;
    else r[k] = el.value;
    renderScan();
  });
  $('#scanFile').addEventListener('change', e => { runScan(e.target.files); e.target.value = ''; });
  const dropZone = document.getElementById('view-mine');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dropping'); });
  dropZone.addEventListener('dragleave', e => { if (e.target === dropZone) dropZone.classList.remove('dropping'); });
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dropping'); if (e.dataTransfer.files.length) runScan(e.dataTransfer.files); });
  document.addEventListener('change', e => {
    const d = e.target.dataset || {};
    if (d.slot !== undefined) { const l = curFmt().key; state.ui.team = state.ui.team || {}; const tk = (state.ui.team[l] || []).slice(); tk[Number(d.slot)] = e.target.value; state.ui.team[l] = tk; save(); renderPvp(); }
    if (d.pvmine !== undefined) { state.ui.pvOnlyMine = e.target.checked; save(); renderPvp(); }
    if (d.bg !== undefined) { const m = monBy(d.uid); m.bg = e.target.value; save(); renderAll(); }
    if (d.mset) { const m = monBy(d.uid); m[d.mset] = d.mset === 'mlv' ? Number(e.target.value) : e.target.value; if (m.mega && m.mega !== 'none' && Number(m.mlv) === 4 && !superMaxOk(spOf(m), m.mega)) m.mlv = 3; save(); renderAll(); }
  });
  $('#pvpType').addEventListener('input', renderPvp);
  $('#cupSel').addEventListener('input', e => { if (e.target.value) { state.ui.pvKey = e.target.value; save(); loadPvp(); renderPvp(); } });
  $('#pvpReload').addEventListener('click', () => { delete pvp.L[curFmt().key]; renderPvp(); loadPvp(true); });
  setTimeout(() => { if (notifSettings().on) { loadEvents(); checkNotifs(); } }, 4000);
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.src; if (!k) return; const off = new Set(state.ui.srcOff || []); if (e.target.checked) off.delete(k); else off.add(k); state.ui.srcOff = [...off]; news = null; save(); loadNews(true); renderSources(); });
  $('#liveReload').addEventListener('click', () => { live = null; renderRaids(); loadLive(true); });

  $('#importFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      const r = importCSV(txt);
      $('#importMsg').innerHTML = '<div class="adv ' + (r.ok ? 'ok' : 'warn') + '">' + (r.msg || ('✔ ' + r.ok + ' importiert' + (r.dup ? ', ' + r.dup + ' schon vorhanden' : '') + (r.skip ? ', ' + r.skip + ' nicht erkannt' + (r.unknown.length ? ' (' + r.unknown.map(esc).join(', ') + ' …)' : '') : '') + '. Prüf bei Dynamax/G-Max kurz den Modus.')) + '</div>';
      e.target.value = ''; show('mine');
    });
  });
  $('#tol').value = state.tol;
  $('#tol').addEventListener('input', () => { state.tol = Math.max(0, Math.min(50, Number($('#tol').value) || 0)); save(); renderAll(); });
  $('#exportBtn').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'pokeplaner-backup.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#restoreFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => { try { const s = JSON.parse(txt); if (!Array.isArray(s.mons)) throw 0; s.mons = s.mons.filter(m => SP[m.k]); s.ui = s.ui || {}; state = s; save(); $('#tol').value = state.tol; renderAll(); } catch (err) { $('#restoreFile').value = ''; } });
  });
  $('#resetBtn').addEventListener('click', () => {
    const b = $('#resetBtn');
    if (b.dataset.confirm) { state = { tol: 5, mons: [], next: 1, ui: {} }; save(); $('#tol').value = 5; renderAll(); b.textContent = 'Alles zurücksetzen'; delete b.dataset.confirm; }
    else { b.dataset.confirm = '1'; b.textContent = 'Wirklich? Nochmal klicken'; setTimeout(() => { b.textContent = 'Alles zurücksetzen'; delete b.dataset.confirm; }, 3000); }
  });

  window.__rh = { addMon, statsOf, bestRaidSet, bestMaxFast, raidScore, maxDmg, plan, roleOf, levelCost, importCSV, pickTeam, mapLive, state: () => state, SP, BV, renderAll, show, showDetail, MAXCANDS };
  save();
  show('mine');
})();
