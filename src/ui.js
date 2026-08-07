// DOM layer: HUD, legend, tooltip, site modal, toasts, fades.

import { RARITY, SETS } from './items.js';
import { FEATS } from './meta.js';
import { BIOMES } from './names.js';

const $ = id => document.getElementById(id);

export const ui = {
  init(world) {
    this.world = world;
    const legend = $('legend');
    legend.innerHTML = '<h3>THE CELESTIAL COURTS</h3>' + world.kingdoms.map(k =>
      `<div class="row"><span class="sw" style="background:#${k.color.toString(16).padStart(6, '0')};color:#${k.color.toString(16).padStart(6, '0')}"></span>${k.name}</div>`
    ).join('') + `<div class="row"><span class="sw" style="background:#9aa3cf;color:#9aa3cf"></span>The Driftlands (free)</div>`;

    $('modal-scrim').addEventListener('click', e => {
      if (e.target === $('modal-scrim')) this.closeModal();
    });
  },

  loadingDone() { $('loading').classList.add('gone'); setTimeout(() => $('loading').remove(), 1200); },

  fade(on) { $('fade').classList.toggle('on', on); },

  setLocation(tile, kingdom) {
    const biomeName = BIOMES[tile.biome]?.name || '—';
    $('hud-loc').innerHTML = `<b>${tile.name}</b><br><span style="color:var(--ink-dim);font-style:italic">${biomeName} · hex ${tile.q}, ${tile.r}</span>`;
    const kEl = $('hud-king');
    if (kingdom) {
      const hex = '#' + kingdom.color.toString(16).padStart(6, '0');
      kEl.innerHTML = `<span class="chip" style="background:${hex}"></span>${kingdom.name}`;
    } else {
      kEl.innerHTML = `<span class="chip" style="background:#9aa3cf"></span>The Driftlands`;
    }
  },

  setExploring(name) {
    $('hud-loc').innerHTML = `<b>Exploring: ${name}</b>`;
  },

  setShards(n) { $('hud-shards').textContent = `☆ ${n} star-shards`; },

  setRegion(region, threat) {
    $('hud-region').innerHTML = region
      ? `◈ ${region.name} · <span style="color:#ffd98a">tier ${region.tier}</span>`
        + (threat
          ? ` · <span style="color:${threat.color}">☠ ${threat.label}${threat.tier > region.tier ? ` (scaled ${threat.tier})` : ''}</span>`
          : '')
      : '';
  },

  setStats(run) {
    const s = run.stats;
    $('hud-stats').innerHTML =
      `❤ <b>${run.hp}</b>/${s.maxHP} · ⚔ <b>${s.atk}</b> · ➟ <b>${s.spd}</b>` +
      (s.luck ? ` · ✧ ${s.luck}%` : '') +
      ` · <span style="color:#ffd98a">power ${run.power}</span>`;
    $('hud-consum').textContent =
      `✸ ${run.consumables.charge} charges · ❋ ${run.consumables.dew} dew` +
      (run.consumables.feather ? ` · ➳ ${run.consumables.feather}` : '');
    $('btn-detonate').textContent = `✸ Detonate (${run.consumables.charge})`;
  },

  // set by main: { useDew: fn, useFeather: fn } — enables the Use buttons
  inventoryHandlers: null,

  renderInventory(run) {
    const s = run.stats;
    const h = this.inventoryHandlers;
    const canDew = run.consumables.dew > 0 && run.hp < s.maxHP;
    const canFeather = run.consumables.feather > 0;
    $('inv-stats').innerHTML =
      `❤ HP <b>${run.hp} / ${s.maxHP}</b> &nbsp; ⚔ ATK <b>${s.atk}</b> &nbsp; ➟ SPD <b>${s.spd}</b><br>` +
      `✧ crit <b>${s.luck}%</b> &nbsp; ⛊ dodge <b>${s.dodge}%</b> &nbsp; ☆ shard gain <b>${s.shardGain >= 0 ? '+' : ''}${s.shardGain}%</b><br>` +
      `power score <b style="color:var(--gold)">${run.power}</b> · bosses felled <b>${run.bossesDown}</b> · battles won <b>${run.battlesWon}</b>` +
      `<div class="inv-consum">` +
      `<span>✸ ×${run.consumables.charge} <i>(✸ Detonate on the map)</i></span>` +
      `<span>❋ ×${run.consumables.dew} <button id="inv-use-dew" ${canDew ? '' : 'disabled'}>Drink</button></span>` +
      `<span>➳ ×${run.consumables.feather} <button id="inv-use-feather" ${canFeather ? '' : 'disabled'}>Fly home</button></span>` +
      `</div>`;
    if (h) {
      $('inv-use-dew')?.addEventListener('click', () => h.useDew());
      $('inv-use-feather')?.addEventListener('click', () => h.useFeather());
    }
    const setRows = Object.entries(SETS)
      .map(([tag, def]) => ({ tag, def, n: run.tagCounts[tag] || 0 }))
      .filter(x => x.n > 0)
      .map(({ tag, def, n }) => {
        const done = n >= def.need;
        return `<span class="setchip" style="color:${def.color};border-color:${def.color}${done ? '' : '44'};${done ? '' : 'opacity:0.7'}">` +
          `${def.name} ${Math.min(n, def.need)}/${def.need}${done ? ' ✦' : ''}</span>`;
      }).join(' ');
    $('inv-synergies').innerHTML =
      (setRows ? `<div class="syn" style="border:none;padding:4px 0">${setRows}</div>` : '') +
      (run.synergies.length
        ? run.synergies.map(sy => `<div class="syn${sy.grand ? ' grand' : ''}"><b>${sy.grand ? '✦ ' : ''}${sy.name}</b> — ${sy.desc}</div>`).join('')
        : '<div class="syn" style="opacity:0.6">No synergies yet — gather 3–4 relics of one set to ignite it; complete two sets for something greater…</div>');
    $('inv-items').innerHTML = run.items.length
      ? run.items.map(it => {
        const rar = RARITY[it.rarity] || RARITY.c;
        return `<div class="inv-item" style="border-color:${rar.color}55">` +
          `<span class="pool" style="color:${rar.color}">${rar.name.toUpperCase()} · ${it.pool}</span><br>` +
          `<b>${it.name}</b><br><span class="fx">${it.desc}</span></div>`;
      }).join('')
      : '<div class="inv-item" style="opacity:0.6">Your pack holds only lint and resolve. Seek the waiting pedestals.</div>';
  },

  toggleInventory(run, force) {
    const inv = $('inventory');
    const show = force ?? inv.classList.contains('hidden');
    if (show) { this.renderInventory(run); inv.classList.remove('hidden'); }
    else inv.classList.add('hidden');
  },

  // The blind-draw reveal: a face-down gift turns over.
  showItemCard(item, newSynergies, onTaken) {
    const rar = RARITY[item.rarity] || RARITY.c;
    const sourceLine = item.pool === 'BOSS' ? 'CLAIMED FROM THE WARDEN'
      : item.pool === 'ASTRAL' ? 'A GIFT FROM THE DEEP SKY' : 'THE PEDESTAL TURNS ITS GIFT OVER';
    $('ic-kicker').innerHTML = `<span style="color:${rar.color}">✧ ${rar.name.toUpperCase()} ✧</span><br>${sourceLine}`;
    $('itemcard').style.borderColor = rar.color;
    $('ic-name').style.color = rar.color;
    $('ic-name').textContent = item.name;
    $('ic-desc').textContent = item.desc;
    $('ic-flavor').textContent = item.flavor;
    $('ic-synergy').innerHTML = (newSynergies || []).map(sy =>
      `<div class="syn"><b>⚡ SYNERGY IGNITED — ${sy.name}</b><br>${sy.desc}</div>`).join('');
    $('itemcard-scrim').classList.remove('hidden');
    $('ic-take').onclick = () => {
      $('itemcard-scrim').classList.add('hidden');
      if (onTaken) onTaken();
    };
  },

  // The alternative ending: the deity falls and the run is complete.
  showEnding(run, world, meta) {
    $('ending-stats').innerHTML =
      `hexes wandered <b>${run.hexesVisited.size}</b> · battles won <b>${run.battlesWon}</b> · ` +
      `wardens felled <b>${run.bossesDown}</b><br>` +
      `relics gathered <b>${run.items.length}</b> · mutations carried <b>${run.mutationCount}</b> · ` +
      `star-shards at the end <b>${run.shards}</b><br>` +
      (meta ? `echoes inscribed <b>${meta.data.feats.length} / ${FEATS.length}</b><br>` : '') +
      `<span style="font-style:italic;color:var(--ink-dim)">seed ${world.seed} is healed now. It will not remember you. You will remember it.</span>`;
    $('ending').classList.remove('hidden');
  },

  showDeath(run, world, meta) {
    $('death-stats').innerHTML =
      `hexes wandered <b>${run.hexesVisited.size}</b> · battles won <b>${run.battlesWon}</b> · ` +
      `wardens felled <b>${run.bossesDown}</b><br>` +
      `relics gathered <b>${run.items.length}</b> · star-shards at the end <b>${run.shards}</b><br>` +
      (meta ? `echoes inscribed <b>${meta.data.feats.length} / ${FEATS.length}</b> · relics unlocked <b>${meta.unlockedIds.size}</b><br>` : '') +
      `<span style="font-style:italic;color:var(--ink-dim)">seed ${world.seed} is ash now.</span>`;
    $('death').classList.remove('hidden');
  },

  renderEchoes(meta) {
    const done = new Set(meta.data.feats);
    $('echo-summary').innerHTML =
      `<b>${meta.unlockedIds.size}</b> relics in the pools · <b>${meta.lockedCount}</b> still sealed · ` +
      `<b>${meta.data.feats.length}/${FEATS.length}</b> echoes inscribed`;
    $('echo-list').innerHTML = FEATS.map(f => {
      const ok = done.has(f.id);
      return `<div class="echo ${ok ? 'done' : ''}">` +
        `<span class="echo-mark">${ok ? '✦' : '·'}</span>` +
        `<b>${f.name}</b> — ${f.desc}` +
        `<span class="echo-n">${ok ? 'inscribed' : `+${f.unlocks} relics`}</span></div>`;
    }).join('');
  },

  toggleEchoes(meta, force) {
    const el = $('echoes');
    const show = force ?? el.classList.contains('hidden');
    if (show) { this.renderEchoes(meta); el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  },

  setHint(text) { $('hint').innerHTML = text; },

  showReturn(on) { $('btn-return').classList.toggle('hidden', !on); },

  tooltip(html, x, y) {
    const tt = $('tooltip');
    if (!html) { tt.classList.add('hidden'); return; }
    tt.innerHTML = html;
    tt.classList.remove('hidden');
    const pad = 14;
    const w = tt.offsetWidth, h = tt.offsetHeight;
    let tx = x + pad, ty = y + pad;
    if (tx + w > innerWidth - 8) tx = x - w - pad;
    if (ty + h > innerHeight - 8) ty = y - h - pad;
    tt.style.left = tx + 'px';
    tt.style.top = ty + 'px';
  },

  toast(msg, gold = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (gold ? ' gold' : '');
    t.innerHTML = msg;
    $('toasts').appendChild(t);
    setTimeout(() => t.classList.add('fade'), 2600);
    setTimeout(() => t.remove(), 3300);
  },

  openModal(site, { onAction, onClose }) {
    this._onClose = onClose;
    const badge = $('modal-badge');
    badge.className = site.type;
    badge.textContent = { battle: '⚔ battle', trader: '✦ trader', side: '◈ side area' }[site.type] || site.type;
    $('modal-title').textContent = site.name;
    $('modal-sub').textContent = site.subtype ? `${site.subtype}` : '';
    $('modal-flavor').textContent = site.flavor;

    const extra = $('modal-extra');
    extra.innerHTML = '';
    if (site.wares) {
      extra.innerHTML = site.wares.map(([w, p]) =>
        `<div class="ware"><span>${w}</span><span class="price">☆ ${p}</span></div>`
      ).join('');
    }

    const actions = $('modal-actions');
    actions.innerHTML = '';
    for (const label of site.actions || []) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => onAction(label, b));
      actions.appendChild(b);
    }
    const close = document.createElement('button');
    close.textContent = 'Leave';
    close.className = 'ghost';
    close.addEventListener('click', () => this.closeModal());
    actions.appendChild(close);

    $('modal-scrim').classList.remove('hidden');
  },

  modalOutcome(text) {
    const div = document.createElement('div');
    div.className = 'outcome';
    div.textContent = text;
    $('modal-extra').appendChild(div);
  },

  get modalOpen() { return !$('modal-scrim').classList.contains('hidden'); },

  closeModal() {
    $('modal-scrim').classList.add('hidden');
    if (this._onClose) { const cb = this._onClose; this._onClose = null; cb(); }
  },
};
