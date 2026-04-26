'use strict';

const API = 'https://pokeapi.co/api/v2';
const PAGE_SIZE = 40;
const STAT_NAMES = { hp: 'HP', attack: 'こうげき', defense: 'ぼうぎょ', 'special-attack': 'とくこう', 'special-defense': 'とくぼう', speed: 'すばやさ' };
const STAT_COLORS = { hp: '#ff5050', attack: '#ff7800', defense: '#ffc800', 'special-attack': '#6890f0', 'special-defense': '#78c850', speed: '#f85888' };
const TYPE_JA = { normal:'ノーマル', fire:'ほのお', water:'みず', electric:'でんき', grass:'くさ', ice:'こおり', fighting:'かくとう', poison:'どく', ground:'じめん', flying:'ひこう', psychic:'エスパー', bug:'むし', rock:'いわ', ghost:'ゴースト', dragon:'ドラゴン', dark:'あく', steel:'はがね', fairy:'フェアリー' };

let allPokemon = [];
let filteredPokemon = [];
let currentPage = 1;
let activeType = 'all';
let searchQuery = '';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const grid        = document.getElementById('pokemon-grid');
const loadingEl   = document.getElementById('loading');
const noResultEl  = document.getElementById('no-result');
const prevBtn     = document.getElementById('prev-btn');
const nextBtn     = document.getElementById('next-btn');
const pageInfo    = document.getElementById('page-info');
const searchInput = document.getElementById('search');
const typeFilter  = document.getElementById('type-filter');
const overlay     = document.getElementById('modal-overlay');
const modalClose  = document.getElementById('modal-close');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  showLoading(true);
  try {
    const res = await fetch(`${API}/pokemon?limit=1025`);
    const data = await res.json();
    allPokemon = data.results.map((p, i) => ({ name: p.name, url: p.url, id: i + 1 }));
    await buildTypeFilter();
    applyFilters();
  } catch (e) {
    grid.innerHTML = '<p style="color:#e94560;padding:40px;text-align:center">データの取得に失敗しました</p>';
  } finally {
    showLoading(false);
  }
}

// ── Type filter chips ─────────────────────────────────────────────────────────
async function buildTypeFilter() {
  const res = await fetch(`${API}/type?limit=20`);
  const data = await res.json();
  data.results.forEach(t => {
    if (t.name === 'unknown' || t.name === 'shadow') return;
    const btn = document.createElement('button');
    btn.className = 'type-chip';
    btn.dataset.type = t.name;
    const typeBg = getComputedStyle(document.documentElement).getPropertyValue(`--type-${t.name}`).trim();
    btn.textContent = TYPE_JA[t.name] || t.name;
    if (typeBg) {
      btn.style.setProperty('--chip-color', typeBg);
      btn.addEventListener('mouseenter', () => { if (!btn.classList.contains('active')) btn.style.background = typeBg + '55'; });
      btn.addEventListener('mouseleave', () => { if (!btn.classList.contains('active')) btn.style.background = ''; });
    }
    btn.addEventListener('click', () => selectType(t.name));
    typeFilter.appendChild(btn);
  });
}

function selectType(type) {
  activeType = type;
  document.querySelectorAll('.type-chip').forEach(c => {
    c.classList.remove('active');
    c.style.background = '';
    c.style.color = '';
  });
  const active = document.querySelector(`.type-chip[data-type="${type}"]`);
  active.classList.add('active');
  const typeBg = getComputedStyle(document.documentElement).getPropertyValue(`--type-${type}`).trim();
  if (type !== 'all' && typeBg) {
    active.style.background = typeBg;
    active.style.color = isLightColor(typeBg) ? '#000' : '#fff';
  }
  currentPage = 1;
  applyFilters();
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114) / 1000 > 150;
}

// ── Filter + search ───────────────────────────────────────────────────────────
function applyFilters() {
  let list = allPokemon;

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p => p.name.includes(q) || String(p.id).includes(q));
  }

  if (activeType !== 'all') {
    // We can't filter by type without fetching each pokemon, so we'll rely on cached data
    list = list.filter(p => p.types && p.types.includes(activeType));
    if (list.length === 0 && !allPokemon[0].types) {
      // Types not yet loaded; load them first
      loadTypePokemon(activeType);
      return;
    }
  }

  filteredPokemon = list;
  renderPage();
}

async function loadTypePokemon(type) {
  showLoading(true);
  try {
    const res = await fetch(`${API}/type/${type}`);
    const data = await res.json();
    const typeIds = new Set(data.pokemon.map(p => extractId(p.pokemon.url)));
    allPokemon = allPokemon.map(p => {
      if (!p.types) p.types = [];
      if (typeIds.has(p.id)) p.types.push(type);
      return p;
    });
    filteredPokemon = allPokemon.filter(p => p.types && p.types.includes(type));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredPokemon = filteredPokemon.filter(p => p.name.includes(q) || String(p.id).includes(q));
    }
    renderPage();
  } finally {
    showLoading(false);
  }
}

function extractId(url) {
  return parseInt(url.replace(/\/$/, '').split('/').pop());
}

// ── Render page ───────────────────────────────────────────────────────────────
async function renderPage() {
  const totalPages = Math.max(1, Math.ceil(filteredPokemon.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filteredPokemon.slice(start, start + PAGE_SIZE);

  noResultEl.classList.toggle('hidden', slice.length > 0);
  pageInfo.textContent = `${currentPage} / ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  grid.innerHTML = '';
  if (slice.length === 0) return;

  // Fetch details in parallel batches
  showLoading(true);
  const details = await Promise.all(slice.map(p => fetchPokemonBasic(p)));
  showLoading(false);

  details.forEach(p => { if (p) grid.appendChild(createCard(p)); });
}

const detailCache = {};

async function fetchPokemonBasic(p) {
  if (detailCache[p.id]) return detailCache[p.id];
  try {
    const res = await fetch(`${API}/pokemon/${p.id}`);
    const data = await res.json();
    const detail = {
      id: data.id,
      name: data.name,
      sprite: data.sprites.other['official-artwork']?.front_default || data.sprites.front_default,
      types: data.types.map(t => t.type.name),
    };
    detailCache[p.id] = detail;
    // Back-fill type info onto allPokemon entry
    const entry = allPokemon.find(x => x.id === p.id);
    if (entry) entry.types = detail.types;
    return detail;
  } catch { return null; }
}

function createCard(p) {
  const card = document.createElement('div');
  card.className = 'pokemon-card';
  card.innerHTML = `
    <div class="card-number">#${String(p.id).padStart(4,'0')}</div>
    <div class="card-img-wrap">
      <img src="${p.sprite || ''}" alt="${p.name}" loading="lazy" />
    </div>
    <div class="card-name">${p.name}</div>
    <div class="card-types">${p.types.map(t => `<span class="type-badge ${t}">${TYPE_JA[t]||t}</span>`).join('')}</div>`;

  const typeColor = getComputedStyle(document.documentElement).getPropertyValue(`--type-${p.types[0]}`).trim();
  if (typeColor) card.style.borderColor = typeColor + '44';

  card.addEventListener('click', () => openModal(p.id));
  return card;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
async function openModal(id) {
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Reset
  document.getElementById('modal-name').textContent = '読み込み中...';
  document.getElementById('modal-ja-name').textContent = '';
  document.getElementById('modal-number').textContent = '';
  document.getElementById('modal-types').innerHTML = '';
  document.getElementById('modal-abilities').innerHTML = '';
  document.getElementById('modal-stats').innerHTML = '';
  document.getElementById('modal-height').textContent = '';
  document.getElementById('modal-weight').textContent = '';
  document.getElementById('modal-sprite-front').src = '';
  document.getElementById('modal-sprite-back').src = '';
  document.getElementById('modal-header').style.background = '';

  try {
    const [poke, species] = await Promise.all([
      fetch(`${API}/pokemon/${id}`).then(r => r.json()),
      fetch(`${API}/pokemon-species/${id}`).then(r => r.json()),
    ]);

    const jaName = species.names.find(n => n.language.name === 'ja-Hrkt') || species.names.find(n => n.language.name === 'ja');

    document.getElementById('modal-number').textContent = `#${String(poke.id).padStart(4,'0')}`;
    document.getElementById('modal-name').textContent = poke.name;
    document.getElementById('modal-ja-name').textContent = jaName ? jaName.name : '';
    document.getElementById('modal-height').textContent = `${(poke.height / 10).toFixed(1)} m`;
    document.getElementById('modal-weight').textContent = `${(poke.weight / 10).toFixed(1)} kg`;

    const types = poke.types.map(t => t.type.name);
    document.getElementById('modal-types').innerHTML = types.map(t => `<span class="type-badge ${t}">${TYPE_JA[t]||t}</span>`).join('');

    const typeColor = getComputedStyle(document.documentElement).getPropertyValue(`--type-${types[0]}`).trim();
    if (typeColor) document.getElementById('modal-header').style.background = `linear-gradient(135deg, ${typeColor}33, transparent)`;

    const frontSprite = poke.sprites.other['official-artwork']?.front_default || poke.sprites.front_default || '';
    const backSprite = poke.sprites.back_default || '';
    document.getElementById('modal-sprite-front').src = frontSprite;
    document.getElementById('modal-sprite-back').src = backSprite;

    const abilitiesEl = document.getElementById('modal-abilities');
    poke.abilities.forEach(a => {
      const span = document.createElement('span');
      span.className = 'ability-badge' + (a.is_hidden ? ' hidden-ability' : '');
      span.textContent = a.ability.name + (a.is_hidden ? ' (夢)' : '');
      abilitiesEl.appendChild(span);
    });

    const statsEl = document.getElementById('modal-stats');
    poke.stats.forEach(s => {
      const name = s.stat.name;
      const val = s.base_stat;
      const pct = Math.min(100, (val / 255) * 100);
      const color = STAT_COLORS[name] || '#aaa';
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `
        <span class="stat-name">${STAT_NAMES[name] || name}</span>
        <span class="stat-value">${val}</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:0%;background:${color}"></div>
        </div>`;
      statsEl.appendChild(row);
      requestAnimationFrame(() => {
        row.querySelector('.stat-bar').style.width = pct + '%';
      });
    });

  } catch {
    document.getElementById('modal-name').textContent = 'エラーが発生しました';
  }
}

function closeModal() {
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Pagination ────────────────────────────────────────────────────────────────
prevBtn.addEventListener('click', () => { currentPage--; renderPage(); window.scrollTo(0,0); });
nextBtn.addEventListener('click', () => { currentPage++; renderPage(); window.scrollTo(0,0); });

// ── Search ────────────────────────────────────────────────────────────────────
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim().toLowerCase();
    currentPage = 1;
    applyFilters();
  }, 300);
});

// ── Util ──────────────────────────────────────────────────────────────────────
function showLoading(on) {
  loadingEl.classList.toggle('hidden', !on);
}

init();
