// DOM layer: HUD, legend, tooltip, site modal, toasts, fades.

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
    const biomeNames = {
      MEADOW: 'Starlit Meadow', FOREST: 'Sighing Forest', MOUNTAIN: 'Cloudpiercers',
      VOLCANO: 'Ember Wastes', DESERT: 'Glass Dunes', TUNDRA: 'Pale Expanse',
      SEA: 'Astral Shallows', CRYSTAL: 'Prism Fields',
    };
    $('hud-loc').innerHTML = `<b>${tile.name}</b><br><span style="color:var(--ink-dim);font-style:italic">${biomeNames[tile.biome]} · hex ${tile.q}, ${tile.r}</span>`;
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
