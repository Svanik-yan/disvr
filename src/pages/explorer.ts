// Agent Query Explorer page — served at GET /explorer
export const explorerPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Disvr — Agent Query Explorer</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<script>
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#b79fff", "primary-dim": "#a88cfb", "secondary": "#62fae3",
        "secondary-dim": "#50ebd5", "tertiary": "#ff86c3", "error": "#ff6e84",
        "background": "#060e20", "on-background": "#dee5ff", "on-surface": "#dee5ff",
        "on-surface-variant": "#a3aac4", "surface": "#060e20",
        "surface-container": "#0f1930", "surface-container-low": "#091328",
        "surface-container-high": "#141f38", "surface-container-highest": "#192540",
        "surface-container-lowest": "#000000", "surface-variant": "#192540",
        "outline": "#6d758c", "outline-variant": "#40485d",
        "on-primary-fixed": "#000000", "secondary-container": "#006b5f",
        "on-secondary-container": "#dcfff7",
      },
      fontFamily: { "headline": ["Manrope"], "body": ["Inter"] },
      borderRadius: {"DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px"},
    },
  },
}
</script>
<style>
body { background-color: #060e20; color: #dee5ff; font-family: 'Inter', sans-serif; overflow-x: hidden; }
.glass-panel { background: rgba(15, 25, 48, 0.6); backdrop-filter: blur(20px); }
.gradient-text { background: linear-gradient(135deg, #b79fff 0%, #62fae3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.gradient-border { position: relative; }
.gradient-border::after { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: linear-gradient(135deg, rgba(183,159,255,0.3), rgba(98,250,227,0.3)); mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude; -webkit-mask-composite: destination-out; pointer-events: none; }
.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
input[type="range"] { -webkit-appearance: none; height: 4px; border-radius: 2px; background: #192540; outline: none; }
input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #b79fff; cursor: pointer; border: 2px solid #060e20; }
input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #b79fff; cursor: pointer; border: 2px solid #060e20; }
</style>
</head>
<body class="bg-surface selection:bg-primary/30">
<div class="fixed inset-0 overflow-hidden pointer-events-none -z-10">
  <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
  <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[100px]"></div>
</div>

<!-- Nav -->
<header class="fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] border-b border-white/10">
  <div class="flex justify-between items-center px-8 py-4 w-full">
    <div class="flex items-center gap-8">
      <a href="/" class="text-2xl font-bold bg-gradient-to-r from-violet-400 to-teal-300 bg-clip-text text-transparent font-headline tracking-tight">Disvr</a>
      <nav class="hidden md:flex items-center gap-6">
        <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/">Home</a>
        <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/registry">Registry</a>
        <a class="text-teal-300 border-b-2 border-teal-300 pb-1" href="/explorer">Explorer</a>
        <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/analytics">Analytics</a>
        <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/keys">Get API Key</a>
      </nav>
    </div>
    <a href="https://api.disvr.top/health" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel text-secondary text-sm font-medium border border-white/10">
      <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> API Live
    </a>
  </div>
</header>

<!-- Main Content -->
<main class="pt-28 px-8 pb-12 max-w-7xl mx-auto">
  <!-- Hero & Search -->
  <section class="mb-16 max-w-5xl">
    <h1 class="font-headline text-5xl lg:text-7xl font-extrabold tracking-tighter text-on-surface mb-6 leading-none">
      Agent Query <span class="gradient-text">Explorer</span>
    </h1>
    <p class="text-on-surface-variant text-lg max-w-2xl mb-8 leading-relaxed">
      Try the Disvr discovery API live. Describe what your agent needs and see the top 3 ranked recommendations instantly.
    </p>
    <!-- API Key Input -->
    <div id="key-bar" class="glass-panel px-6 py-3 rounded-xl gradient-border mb-4 flex items-center gap-3">
      <span class="material-symbols-outlined text-primary text-xl">key</span>
      <input id="api-key-input" type="password" class="flex-1 bg-transparent border-none focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/40 py-1 font-mono" placeholder="Paste your API key (dsvr_...)"/>
      <button onclick="toggleKeyVisibility()" class="text-on-surface-variant hover:text-on-surface transition-colors"><span id="eye-icon" class="material-symbols-outlined text-lg">visibility_off</span></button>
      <span id="key-status" class="text-xs text-on-surface-variant"></span>
    </div>
    <!-- Inline quick register (shown when no key) -->
    <div id="quick-register" class="glass-panel px-6 py-3 rounded-xl gradient-border mb-4 flex items-center gap-3">
      <span class="material-symbols-outlined text-secondary text-xl">mail</span>
      <input id="quick-email" type="email" class="flex-1 bg-transparent border-none focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/40 py-1" placeholder="Enter email to get a free API key instantly"/>
      <button onclick="quickRegister()" id="quick-reg-btn" class="shrink-0 px-4 py-1.5 rounded-lg bg-secondary/20 text-secondary text-sm font-medium hover:bg-secondary/30 transition-colors">Get Key</button>
    </div>
    <p id="key-hint" class="text-xs text-on-surface-variant/60 mb-6">Already have a key? Paste it above. Or enter your email to generate one instantly.</p>
    <div class="glass-panel p-2 rounded-[2.5rem] gradient-border shadow-2xl flex items-center">
      <div class="flex-1 flex items-center px-6">
        <span class="material-symbols-outlined text-secondary mr-4">search</span>
        <input id="query-input" class="w-full bg-transparent border-none focus:ring-0 text-on-surface text-lg placeholder:text-on-surface-variant/30 py-4" placeholder="e.g. translate Chinese legal contract to Thai..." type="text"/>
      </div>
      <div class="hidden md:flex items-center gap-2 pr-2">
        <button onclick="executeSearch()" class="bg-gradient-to-r from-primary to-secondary text-surface-container-lowest font-bold px-8 py-3 rounded-full hover:shadow-[0_0_25px_rgba(98,250,227,0.3)] transition-all active:scale-95">
          Discover
        </button>
      </div>
    </div>
    <button onclick="executeSearch()" class="md:hidden mt-4 w-full bg-gradient-to-r from-primary to-secondary text-surface-container-lowest font-bold px-8 py-3 rounded-full">Discover</button>

    <!-- Advanced Filters (collapsible) -->
    <div class="mt-4">
      <button onclick="toggleFilters()" id="filter-toggle" class="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
        <span class="material-symbols-outlined text-lg" id="filter-arrow">expand_more</span>
        <span>Advanced Filters</span>
        <span id="filter-badge" class="hidden px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">Active</span>
      </button>
      <div id="filter-panel" class="hidden mt-3 glass-panel p-6 rounded-xl gradient-border">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Max Price -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm text-on-surface-variant">Max Price per Call</label>
              <span class="text-xs font-mono text-primary" id="price-val">Any</span>
            </div>
            <input type="range" id="filter-price" min="0" max="100" step="1" value="0" oninput="updateFilterLabel('price')"
              class="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"/>
            <div class="flex justify-between text-[10px] text-on-surface-variant/50 mt-1"><span>Free</span><span>$1</span><span>$10</span><span>$100</span></div>
          </div>
          <!-- Max Latency -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm text-on-surface-variant">Max Latency (P95)</label>
              <span class="text-xs font-mono text-secondary" id="latency-val">Any</span>
            </div>
            <input type="range" id="filter-latency" min="0" max="100" step="1" value="0" oninput="updateFilterLabel('latency')"
              class="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"/>
            <div class="flex justify-between text-[10px] text-on-surface-variant/50 mt-1"><span>Any</span><span>500ms</span><span>2s</span><span>10s</span></div>
          </div>
          <!-- Min Reputation -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm text-on-surface-variant">Min Reputation</label>
              <span class="text-xs font-mono text-tertiary" id="rep-val">Any</span>
            </div>
            <input type="range" id="filter-rep" min="0" max="50" step="1" value="0" oninput="updateFilterLabel('rep')"
              class="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-pink-400"/>
            <div class="flex justify-between text-[10px] text-on-surface-variant/50 mt-1"><span>Any</span><span>2.5</span><span>5.0</span></div>
          </div>
          <!-- Min Success Rate -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm text-on-surface-variant">Min Success Rate</label>
              <span class="text-xs font-mono text-on-surface" id="rate-val">Any</span>
            </div>
            <input type="range" id="filter-rate" min="0" max="100" step="1" value="0" oninput="updateFilterLabel('rate')"
              class="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-white"/>
            <div class="flex justify-between text-[10px] text-on-surface-variant/50 mt-1"><span>Any</span><span>50%</span><span>90%</span><span>100%</span></div>
          </div>
        </div>
        <div class="flex justify-end mt-4 gap-3">
          <button onclick="resetFilters()" class="text-xs text-on-surface-variant hover:text-on-surface transition-colors px-3 py-1.5 rounded-lg border border-outline-variant/30">Reset</button>
        </div>
      </div>
    </div>
  </section>

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
    <!-- Results Area -->
    <div class="xl:col-span-2 space-y-8">
      <!-- Status Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="glass-panel p-8 rounded-xl gradient-border relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <span class="material-symbols-outlined text-8xl">hub</span>
          </div>
          <h4 class="font-headline text-sm uppercase tracking-widest text-secondary mb-8">Services Indexed</h4>
          <div class="flex items-end justify-between">
            <div>
              <span class="text-4xl font-headline font-extrabold text-on-surface" id="stat-count">--</span>
              <p class="text-on-surface-variant text-sm mt-1">MCP servers available</p>
            </div>
            <div class="h-12 w-24 flex items-end gap-1">
              <div class="w-2 h-[40%] bg-secondary/40 rounded-t-sm"></div>
              <div class="w-2 h-[60%] bg-secondary/40 rounded-t-sm"></div>
              <div class="w-2 h-[50%] bg-secondary/40 rounded-t-sm"></div>
              <div class="w-2 h-[90%] bg-secondary rounded-t-sm"></div>
              <div class="w-2 h-[75%] bg-secondary rounded-t-sm"></div>
            </div>
          </div>
        </div>
        <div class="glass-panel p-8 rounded-xl gradient-border relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <span class="material-symbols-outlined text-8xl">speed</span>
          </div>
          <h4 class="font-headline text-sm uppercase tracking-widest text-primary mb-8">Search Method</h4>
          <div class="flex items-end justify-between">
            <div>
              <span class="text-4xl font-headline font-extrabold text-on-surface">Hybrid</span>
              <p class="text-on-surface-variant text-sm mt-1">Vector + FTS5 fallback</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Container -->
      <div id="results-container" class="glass-panel p-8 rounded-xl gradient-border">
        <div class="flex justify-between items-center mb-8">
          <h3 class="font-headline text-xl font-bold">Discovery Results</h3>
          <div class="flex items-center gap-4">
            <button onclick="toggleCompare()" id="compare-btn" class="hidden items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors px-3 py-1.5 rounded-lg border border-outline-variant/30">
              <span class="material-symbols-outlined text-sm">compare_arrows</span> Compare
            </button>
            <span class="text-on-surface-variant text-sm" id="result-status">Enter a query above to search</span>
          </div>
        </div>
        <div id="results-list" class="space-y-4">
          <div class="text-center py-12 text-on-surface-variant">
            <span class="material-symbols-outlined text-5xl mb-4 block opacity-30">search</span>
            <p>Describe what your agent needs to find the best tools.</p>
            <p class="text-sm mt-2 opacity-60">Try: "scrape product prices from e-commerce sites"</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Example Queries Sidebar -->
    <div class="space-y-6">
      <div class="flex items-center justify-between px-2">
        <h3 class="font-headline text-xl font-bold">Try These Queries</h3>
        <span class="material-symbols-outlined text-on-surface-variant">auto_awesome</span>
      </div>

      <div onclick="tryQuery('translate Chinese legal documents to Thai')" class="glass-panel p-6 rounded-xl gradient-border hover:bg-surface-container-highest transition-all duration-300 group cursor-pointer">
        <div class="flex gap-4 mb-3">
          <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-primary">translate</span>
          </div>
          <div>
            <h4 class="font-bold text-on-surface group-hover:text-secondary transition-colors text-sm">Translation</h4>
            <p class="text-xs text-on-surface-variant">Chinese legal docs to Thai</p>
          </div>
        </div>
      </div>

      <div onclick="tryQuery('scrape product prices from e-commerce websites')" class="glass-panel p-6 rounded-xl gradient-border hover:bg-surface-container-highest transition-all duration-300 group cursor-pointer">
        <div class="flex gap-4 mb-3">
          <div class="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-secondary">shopping_cart</span>
          </div>
          <div>
            <h4 class="font-bold text-on-surface group-hover:text-secondary transition-colors text-sm">Web Scraping</h4>
            <p class="text-xs text-on-surface-variant">E-commerce price extraction</p>
          </div>
        </div>
      </div>

      <div onclick="tryQuery('generate images from text descriptions')" class="glass-panel p-6 rounded-xl gradient-border hover:bg-surface-container-highest transition-all duration-300 group cursor-pointer">
        <div class="flex gap-4 mb-3">
          <div class="w-10 h-10 rounded-lg bg-tertiary/20 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-tertiary">image</span>
          </div>
          <div>
            <h4 class="font-bold text-on-surface group-hover:text-secondary transition-colors text-sm">Image Generation</h4>
            <p class="text-xs text-on-surface-variant">Text-to-image AI tools</p>
          </div>
        </div>
      </div>

      <div onclick="tryQuery('search and retrieve academic papers')" class="glass-panel p-6 rounded-xl gradient-border hover:bg-surface-container-highest transition-all duration-300 group cursor-pointer">
        <div class="flex gap-4 mb-3">
          <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-primary">school</span>
          </div>
          <div>
            <h4 class="font-bold text-on-surface group-hover:text-secondary transition-colors text-sm">Research</h4>
            <p class="text-xs text-on-surface-variant">Academic paper search</p>
          </div>
        </div>
      </div>

      <a href="https://github.com/Svanik-yan/disvr" target="_blank" class="block w-full py-4 rounded-xl border border-outline-variant/30 hover:border-primary/50 text-on-surface-variant text-sm font-medium transition-all text-center">
        View Source on GitHub <span class="material-symbols-outlined text-xs align-middle">open_in_new</span>
      </a>
    </div>
  </div>
</main>

<!-- Footer -->
<footer class="py-12 px-8 mt-auto w-full border-t border-slate-800/30">
  <div class="flex flex-col items-center gap-6">
    <div class="flex gap-8 text-xs tracking-widest uppercase">
      <a class="text-slate-600 hover:text-slate-300 transition-colors" href="/">Home</a>
      <a class="text-slate-600 hover:text-slate-300 transition-colors" href="https://github.com/Svanik-yan/disvr" target="_blank">GitHub</a>
      <a class="text-slate-600 hover:text-slate-300 transition-colors" href="https://api.disvr.top/health" target="_blank">API</a>
    </div>
    <p class="text-slate-500 text-xs tracking-widest uppercase">&copy; 2026 Disvr. All rights reserved.</p>
  </div>
</footer>

<script>
// Load service count
fetch('/health').then(r => r.json()).then(d => {
  document.getElementById('stat-count').textContent = d.services_indexed || '--';
}).catch(() => {});

// API key management with localStorage
const keyInput = document.getElementById('api-key-input');
const keyStatus = document.getElementById('key-status');
const savedKey = localStorage.getItem('disvr_api_key');

function updateKeyUI() {
  const hasKey = !!(keyInput.value.trim() || localStorage.getItem('disvr_api_key'));
  document.getElementById('quick-register').style.display = hasKey ? 'none' : 'flex';
  document.getElementById('key-hint').textContent = hasKey
    ? 'Key saved in browser. Ready to search.'
    : 'Already have a key? Paste it above. Or enter your email to generate one instantly.';
}

if (savedKey) {
  keyInput.value = savedKey;
  keyStatus.textContent = 'Saved';
  keyStatus.className = 'text-xs text-secondary';
}
updateKeyUI();

keyInput.addEventListener('input', function() {
  const k = keyInput.value.trim();
  if (k.startsWith('dsvr_') && k.length > 10) {
    localStorage.setItem('disvr_api_key', k);
    keyStatus.textContent = 'Saved';
    keyStatus.className = 'text-xs text-secondary';
  } else if (k.length === 0) {
    localStorage.removeItem('disvr_api_key');
    keyStatus.textContent = '';
  } else {
    keyStatus.textContent = 'Invalid format';
    keyStatus.className = 'text-xs text-error';
  }
  updateKeyUI();
});

function toggleKeyVisibility() {
  const isHidden = keyInput.type === 'password';
  keyInput.type = isHidden ? 'text' : 'password';
  document.getElementById('eye-icon').textContent = isHidden ? 'visibility' : 'visibility_off';
}

async function quickRegister() {
  const email = document.getElementById('quick-email').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { alert('Please enter a valid email.'); return; }
  const btn = document.getElementById('quick-reg-btn');
  btn.disabled = true; btn.textContent = '...';
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message || 'Registration failed.'); btn.disabled = false; btn.textContent = 'Get Key'; return; }
    keyInput.value = data.api_key;
    keyInput.type = 'text';
    document.getElementById('eye-icon').textContent = 'visibility';
    localStorage.setItem('disvr_api_key', data.api_key);
    keyStatus.textContent = 'New key created!';
    keyStatus.className = 'text-xs text-secondary';
    updateKeyUI();
  } catch (e) {
    alert('Network error. Please try again.');
    btn.disabled = false; btn.textContent = 'Get Key';
  }
}

function tryQuery(q) {
  document.getElementById('query-input').value = q;
  executeSearch();
}

function getApiKey() {
  return keyInput.value.trim() || localStorage.getItem('disvr_api_key') || '';
}

// ─── Advanced Filters ───
let filtersVisible = false;
let compareMode = false;
let lastResults = [];

const priceStops = [0, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 25, 50, 100];
const latencyStops = [0, 100, 200, 500, 1000, 2000, 5000, 10000];

function sliderToPrice(v) { const i = Math.round(v / 100 * (priceStops.length - 1)); return priceStops[i]; }
function sliderToLatency(v) { const i = Math.round(v / 100 * (latencyStops.length - 1)); return latencyStops[i]; }

function updateFilterLabel(type) {
  if (type === 'price') {
    const v = parseInt(document.getElementById('filter-price').value);
    document.getElementById('price-val').textContent = v === 0 ? 'Any' : '$' + sliderToPrice(v);
  } else if (type === 'latency') {
    const v = parseInt(document.getElementById('filter-latency').value);
    document.getElementById('latency-val').textContent = v === 0 ? 'Any' : sliderToLatency(v) + 'ms';
  } else if (type === 'rep') {
    const v = parseInt(document.getElementById('filter-rep').value);
    document.getElementById('rep-val').textContent = v === 0 ? 'Any' : (v / 10).toFixed(1);
  } else if (type === 'rate') {
    const v = parseInt(document.getElementById('filter-rate').value);
    document.getElementById('rate-val').textContent = v === 0 ? 'Any' : v + '%';
  }
  updateFilterBadge();
}

function updateFilterBadge() {
  const active = hasActiveFilters();
  document.getElementById('filter-badge').classList.toggle('hidden', !active);
}

function hasActiveFilters() {
  return parseInt(document.getElementById('filter-price').value) > 0 ||
    parseInt(document.getElementById('filter-latency').value) > 0 ||
    parseInt(document.getElementById('filter-rep').value) > 0 ||
    parseInt(document.getElementById('filter-rate').value) > 0;
}

function getFilterParams() {
  const p = {};
  const pv = parseInt(document.getElementById('filter-price').value);
  if (pv > 0) p.max_price_per_call = sliderToPrice(pv);
  const lv = parseInt(document.getElementById('filter-latency').value);
  if (lv > 0) p.max_latency_ms = sliderToLatency(lv);
  const rv = parseInt(document.getElementById('filter-rep').value);
  if (rv > 0) p.min_reputation = rv / 10;
  const sv = parseInt(document.getElementById('filter-rate').value);
  if (sv > 0) p.min_success_rate = sv / 100;
  return p;
}

function toggleFilters() {
  filtersVisible = !filtersVisible;
  document.getElementById('filter-panel').classList.toggle('hidden', !filtersVisible);
  document.getElementById('filter-arrow').textContent = filtersVisible ? 'expand_less' : 'expand_more';
}

function resetFilters() {
  ['filter-price','filter-latency','filter-rep','filter-rate'].forEach(function(id) { document.getElementById(id).value = 0; });
  ['price','latency','rep','rate'].forEach(updateFilterLabel);
}

// ─── Compare Mode ───
function toggleCompare() {
  compareMode = !compareMode;
  const btn = document.getElementById('compare-btn');
  btn.classList.toggle('border-primary/50', compareMode);
  btn.classList.toggle('text-primary', compareMode);
  if (lastResults.length > 0) renderResults(lastResults);
}

function renderResultCard(r, i) {
  const score = r.match_confidence ? (r.match_confidence * 100).toFixed(0) : '--';
  const rep = r.reputation !== null ? r.reputation.toFixed(1) : 'N/A';
  const rate = r.success_rate !== null ? (r.success_rate * 100).toFixed(0) + '%' : 'N/A';
  const colors = ['primary', 'secondary', 'tertiary'];
  const c = colors[i % 3];

  if (compareMode) {
    return '<div class="glass-panel p-5 rounded-xl gradient-border flex flex-col">' +
      '<div class="flex items-center gap-3 mb-4">' +
      '<div class="w-8 h-8 rounded-lg bg-' + c + '/20 flex items-center justify-center shrink-0">' +
      '<span class="font-headline font-black text-' + c + ' text-sm">#' + (i+1) + '</span></div>' +
      '<h4 class="font-bold text-on-surface text-sm truncate">' + r.service + '</h4></div>' +
      '<div class="text-center mb-4"><div class="text-3xl font-headline font-black text-' + c + '">' + score + '%</div>' +
      '<div class="text-[10px] text-on-surface-variant uppercase">Match</div></div>' +
      '<div class="space-y-2 text-xs flex-1">' +
      '<div class="flex justify-between"><span class="text-on-surface-variant">Platform</span><span class="text-on-surface">' + r.platform + '</span></div>' +
      '<div class="flex justify-between"><span class="text-on-surface-variant">Reputation</span><span class="text-secondary font-medium">' + rep + '/5</span></div>' +
      '<div class="flex justify-between"><span class="text-on-surface-variant">Success Rate</span><span class="text-on-surface">' + rate + '</span></div>' +
      (r.price_usd !== null ? '<div class="flex justify-between"><span class="text-on-surface-variant">Price</span><span class="text-primary font-medium">$' + r.price_usd + '</span></div>' : '') +
      (r.latency_p95_ms !== null ? '<div class="flex justify-between"><span class="text-on-surface-variant">P95 Latency</span><span class="text-tertiary font-medium">' + r.latency_p95_ms + 'ms</span></div>' : '') +
      (r.total_calls ? '<div class="flex justify-between"><span class="text-on-surface-variant">Total Calls</span><span class="text-on-surface">' + r.total_calls.toLocaleString() + '</span></div>' : '') +
      '</div>' +
      '<p class="text-xs text-on-surface-variant mt-3 pt-3 border-t border-outline-variant/20">' + (r.reason || '') + '</p>' +
      '</div>';
  }

  return '<div class="glass-panel p-6 rounded-xl gradient-border">' +
    '<div class="flex justify-between items-start mb-3">' +
    '<div class="flex items-center gap-3">' +
    '<div class="w-10 h-10 rounded-lg bg-' + c + '/20 flex items-center justify-center">' +
    '<span class="font-headline font-black text-' + c + '">#' + (i+1) + '</span></div>' +
    '<div><h4 class="font-bold text-on-surface">' + r.service + '</h4>' +
    '<span class="text-xs text-on-surface-variant">' + r.platform + '</span></div></div>' +
    '<div class="text-right"><div class="text-2xl font-headline font-black text-' + c + '">' + score + '%</div>' +
    '<div class="text-[10px] text-on-surface-variant uppercase">Match</div></div></div>' +
    '<p class="text-sm text-on-surface-variant mb-3">' + (r.reason || '') + '</p>' +
    '<div class="flex gap-4 text-xs text-on-surface-variant">' +
    '<span>Rep: <strong class="text-secondary">' + rep + '/5</strong></span>' +
    (r.price_usd !== null ? '<span>Price: <strong class="text-primary">$' + r.price_usd + '</strong></span>' : '') +
    (r.latency_p95_ms !== null ? '<span>P95: <strong class="text-tertiary">' + r.latency_p95_ms + 'ms</strong></span>' : '') +
    '</div></div>';
}

function renderResults(recs) {
  lastResults = recs;
  const list = document.getElementById('results-list');
  const compareBtn = document.getElementById('compare-btn');

  if (recs.length > 1) {
    compareBtn.classList.remove('hidden');
    compareBtn.classList.add('inline-flex');
  } else {
    compareBtn.classList.add('hidden');
  }

  if (compareMode && recs.length > 1) {
    list.className = 'grid grid-cols-' + Math.min(recs.length, 3) + ' gap-4';
  } else {
    list.className = 'space-y-4';
  }

  list.innerHTML = recs.map(function(r, i) { return renderResultCard(r, i); }).join('');
}

async function executeSearch() {
  const query = document.getElementById('query-input').value.trim();
  if (query.length < 5) { alert('Please enter at least 5 characters.'); return; }

  const apiKey = getApiKey();
  if (!apiKey) {
    document.getElementById('results-list').innerHTML = '<div class="text-center py-8"><p class="text-error mb-3">API key required</p><a href="/keys" class="inline-block bg-gradient-to-r from-primary to-secondary text-surface-container-lowest font-bold px-6 py-2 rounded-full text-sm">Get a Free API Key</a></div>';
    document.getElementById('result-status').textContent = 'Missing API key';
    return;
  }

  document.getElementById('result-status').textContent = 'Searching...';
  document.getElementById('results-list').className = 'space-y-4';
  document.getElementById('results-list').innerHTML = '<div class="text-center py-8 text-on-surface-variant"><span class="material-symbols-outlined text-3xl animate-spin">progress_activity</span><p class="mt-2">Querying Disvr API...</p></div>';

  const body = Object.assign({ need: query }, getFilterParams());

  try {
    const res = await fetch('/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body)
    });

    if (res.status === 401) {
      document.getElementById('result-status').textContent = 'Invalid key';
      document.getElementById('results-list').innerHTML = '<div class="text-center py-8"><p class="text-error mb-3">Invalid API key. Please check your key or get a new one.</p><a href="/keys" class="inline-block bg-gradient-to-r from-primary to-secondary text-surface-container-lowest font-bold px-6 py-2 rounded-full text-sm">Get a Free API Key</a></div>';
      return;
    }
    if (res.status === 429) {
      document.getElementById('result-status').textContent = 'Rate limited';
      document.getElementById('results-list').innerHTML = '<div class="text-center py-8 text-error"><p>Daily rate limit reached (1,000 requests/day). Try again tomorrow.</p></div>';
      return;
    }

    const data = await res.json();

    if (data.recommendations && data.recommendations.length > 0) {
      const filterNote = hasActiveFilters() ? ' (filtered)' : '';
      document.getElementById('result-status').textContent = data.recommendations.length + ' recommendations' + filterNote;
      renderResults(data.recommendations);
    } else {
      lastResults = [];
      document.getElementById('compare-btn').classList.add('hidden');
      document.getElementById('result-status').textContent = 'No results';
      document.getElementById('results-list').innerHTML = '<div class="text-center py-8 text-on-surface-variant"><p>No matching services found.' + (hasActiveFilters() ? ' Try relaxing your filters.' : ' Try a different query.') + '</p></div>';
    }
  } catch (e) {
    document.getElementById('result-status').textContent = 'Error';
    document.getElementById('results-list').innerHTML = '<div class="text-center py-8 text-error"><p>Failed to query API. Please try again.</p></div>';
  }
}

// Allow Enter key
document.getElementById('query-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') executeSearch();
});
</script>
</body></html>`;
