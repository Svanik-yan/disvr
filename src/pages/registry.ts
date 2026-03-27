// Provider Registry page — served at GET /registry
export const registryPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link rel="icon" type="image/png" href="/favicon.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<title>Disvr — Provider Registry</title>
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
        "on-primary-fixed": "#000000",
      },
      fontFamily: { "headline": ["Manrope"], "body": ["Inter"] },
      borderRadius: {"DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px"},
    },
  },
}
</script>
<style>
body { background-color: #060e20; color: #dee5ff; font-family: 'Inter', sans-serif; }
.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
.glass-card { background: rgba(25, 37, 64, 0.4); backdrop-filter: blur(20px); border: 1px solid rgba(64, 72, 93, 0.15); }
.gradient-text { background: linear-gradient(135deg, #b79fff 0%, #62fae3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.glow-blob { filter: blur(80px); z-index: -1; }
.platform-btn.active { background: rgba(183,159,255,0.2); border-color: rgba(183,159,255,0.5); color: #b79fff; }
</style>
</head>
<body class="overflow-x-hidden">
<div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-dim/10 rounded-full glow-blob"></div>
<div class="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-dim/5 rounded-full glow-blob"></div>

<!-- Nav -->
<nav class="fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-8 h-20 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
  <div class="flex items-center gap-8">
    <a href="/" class="text-2xl font-bold bg-gradient-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent font-headline">Disvr</a>
    <div class="hidden md:flex items-center gap-6">
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/">Home</a>
      <a class="text-teal-400 border-b-2 border-teal-400 pb-1" href="/registry">Registry</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/explorer">Explorer</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/analytics">Analytics</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/keys">Get API Key</a>
    </div>
  </div>
  <div class="flex items-center gap-4">
    <a href="https://api.disvr.top/health" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-secondary text-sm font-medium">
      <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> API Live
    </a>
  </div>
</nav>

<!-- Main Content -->
<main class="mt-20 p-8 lg:p-12 min-h-screen max-w-7xl mx-auto">
  <header class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
    <div class="max-w-2xl">
      <h1 class="text-5xl lg:text-6xl font-headline font-extrabold tracking-tighter mb-4 leading-[0.9] gradient-text">Provider Registry</h1>
      <p class="text-on-surface-variant text-lg max-w-lg leading-relaxed">
        Browse all indexed MCP services. Search, filter, and explore the tools your agents can discover.
      </p>
    </div>
    <div class="glass-card px-6 py-3 rounded-full flex items-center gap-3">
      <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
      <span class="text-sm text-on-surface uppercase tracking-widest font-bold" id="service-count">Loading...</span>
    </div>
  </header>

  <!-- Search & Filters -->
  <div class="glass-card rounded-xl p-6 mb-8">
    <div class="flex flex-col md:flex-row gap-4">
      <div class="flex-1 relative">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
        <input id="search-input" type="text" placeholder="Search services by name or description..."
          class="w-full bg-surface-container-high border border-outline-variant/20 rounded-xl pl-12 pr-4 py-3 text-on-surface placeholder-on-surface-variant/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"/>
      </div>
      <select id="sort-select" class="bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary/50 min-w-[160px]">
        <option value="reputation">Sort: Reputation</option>
        <option value="name">Sort: Name</option>
        <option value="calls">Sort: Most Used</option>
        <option value="price">Sort: Price (Low)</option>
      </select>
    </div>
    <div class="flex flex-wrap gap-2 mt-4" id="platform-filters">
      <button class="platform-btn active text-xs font-bold px-4 py-1.5 rounded-full border border-outline-variant/20 transition-all hover:bg-white/5" data-platform="all">All Platforms</button>
    </div>
  </div>

  <!-- Services Grid -->
  <div id="services-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
    <div class="col-span-full flex justify-center py-20">
      <div class="flex items-center gap-3 text-on-surface-variant">
        <span class="material-symbols-outlined animate-spin">progress_activity</span>
        Loading services...
      </div>
    </div>
  </div>

  <!-- Pagination -->
  <div class="flex justify-between items-center glass-card rounded-xl px-6 py-4" id="pagination">
    <span class="text-sm text-on-surface-variant" id="page-info">Page 1</span>
    <div class="flex gap-2">
      <button id="prev-btn" onclick="changePage(-1)" disabled class="px-4 py-2 rounded-lg bg-surface-container-highest border border-white/10 text-sm font-bold disabled:opacity-30 hover:bg-white/10 transition-colors flex items-center gap-1">
        <span class="material-symbols-outlined text-sm">chevron_left</span> Prev
      </button>
      <button id="next-btn" onclick="changePage(1)" class="px-4 py-2 rounded-lg bg-surface-container-highest border border-white/10 text-sm font-bold disabled:opacity-30 hover:bg-white/10 transition-colors flex items-center gap-1">
        Next <span class="material-symbols-outlined text-sm">chevron_right</span>
      </button>
    </div>
  </div>
</main>

<!-- Footer -->
<footer class="w-full py-12 flex flex-col items-center gap-4 border-t border-slate-800/30">
  <div class="flex gap-8 mb-4">
    <a class="text-xs tracking-widest uppercase text-slate-600 hover:text-slate-300 transition-colors" href="/">Home</a>
    <a class="text-xs tracking-widest uppercase text-slate-600 hover:text-slate-300 transition-colors" href="https://github.com/Svanik-yan/disvr" target="_blank">GitHub</a>
    <a class="text-xs tracking-widest uppercase text-slate-600 hover:text-slate-300 transition-colors" href="https://api.disvr.top/health" target="_blank">API</a>
  </div>
  <p class="text-xs tracking-widest uppercase text-slate-500">&copy; 2026 Disvr. All rights reserved.</p>
</footer>

<script>
const API = 'https://api.disvr.top';
let currentPage = 1;
let currentSearch = '';
let currentPlatform = 'all';
let currentSort = 'reputation';
let totalPages = 1;
let debounceTimer = null;

// Search input with debounce
document.getElementById('search-input').addEventListener('input', function(e) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    currentSearch = e.target.value;
    currentPage = 1;
    loadServices();
  }, 300);
});

document.getElementById('search-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    clearTimeout(debounceTimer);
    currentSearch = e.target.value;
    currentPage = 1;
    loadServices();
  }
});

document.getElementById('sort-select').addEventListener('change', function(e) {
  currentSort = e.target.value;
  currentPage = 1;
  loadServices();
});

function selectPlatform(platform) {
  currentPlatform = platform;
  currentPage = 1;
  document.querySelectorAll('.platform-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.platform === platform);
  });
  loadServices();
}

function changePage(delta) {
  currentPage = Math.max(1, Math.min(totalPages, currentPage + delta));
  loadServices();
}

function renderServiceCard(s) {
  var rep = s.reputation_score !== null ? s.reputation_score.toFixed(1) : 'N/A';
  var repColor = s.reputation_score >= 3.5 ? 'text-secondary' : s.reputation_score >= 2 ? 'text-primary' : 'text-on-surface-variant';
  var price = s.pricing && s.pricing.price_usd > 0 ? ('$' + s.pricing.price_usd.toFixed(4)) : 'Free';
  var priceColor = s.pricing && s.pricing.price_usd === 0 ? 'text-secondary' : 'text-on-surface';
  var desc = s.description ? (s.description.length > 120 ? s.description.substring(0, 120) + '...' : s.description) : 'No description';
  var caps = (s.capabilities || []).slice(0, 3);
  var successRate = s.success_rate !== null ? (s.success_rate * 100).toFixed(0) + '%' : '--';
  var latency = s.latency_p95_ms !== null ? s.latency_p95_ms + 'ms' : '--';
  var sourceLink = s.source_url ? '<a href="' + s.source_url + '" target="_blank" class="text-secondary text-xs font-bold flex items-center gap-1 hover:underline"><span class="material-symbols-outlined text-sm">open_in_new</span>Source</a>' : '';

  return '<div class="glass-card rounded-xl p-6 hover:border-primary/30 transition-all group">' +
    '<div class="flex justify-between items-start mb-3">' +
      '<div class="flex items-center gap-3">' +
        '<div class="w-10 h-10 rounded-lg bg-surface-container-highest border border-white/5 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-primary">widgets</span>' +
        '</div>' +
        '<div>' +
          '<h3 class="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">' + s.name + '</h3>' +
          '<span class="text-[10px] text-on-surface-variant uppercase tracking-widest">' + s.platform + '</span>' +
        '</div>' +
      '</div>' +
      '<span class="text-lg font-headline font-bold ' + repColor + '">' + rep + '</span>' +
    '</div>' +
    '<p class="text-xs text-on-surface-variant leading-relaxed mb-4">' + desc + '</p>' +
    (caps.length > 0 ? '<div class="flex flex-wrap gap-1.5 mb-4">' + caps.map(function(c) {
      return '<span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20">' + c + '</span>';
    }).join('') + '</div>' : '') +
    '<div class="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">' +
      '<div class="text-center"><div class="text-xs font-bold ' + priceColor + '">' + price + '</div><div class="text-[9px] text-on-surface-variant uppercase">Price</div></div>' +
      '<div class="text-center"><div class="text-xs font-bold text-on-surface">' + successRate + '</div><div class="text-[9px] text-on-surface-variant uppercase">Success</div></div>' +
      '<div class="text-center"><div class="text-xs font-bold text-on-surface">' + latency + '</div><div class="text-[9px] text-on-surface-variant uppercase">Latency</div></div>' +
    '</div>' +
    (sourceLink ? '<div class="mt-3 pt-3 border-t border-white/5 flex justify-end">' + sourceLink + '</div>' : '') +
  '</div>';
}

async function loadServices() {
  var grid = document.getElementById('services-grid');
  grid.innerHTML = '<div class="col-span-full flex justify-center py-20"><div class="flex items-center gap-3 text-on-surface-variant"><span class="material-symbols-outlined animate-spin">progress_activity</span>Loading...</div></div>';

  try {
    var params = new URLSearchParams({ page: currentPage, limit: 21 });
    if (currentSearch) params.set('search', currentSearch);
    if (currentPlatform !== 'all') params.set('platform', currentPlatform);
    if (currentSort) params.set('sort', currentSort);

    var res = await fetch(API + '/api/services?' + params.toString());
    var data = await res.json();

    document.getElementById('service-count').textContent = data.total + ' Services Indexed';
    totalPages = Math.ceil(data.total / data.limit);

    if (data.services.length === 0) {
      grid.innerHTML = '<div class="col-span-full flex flex-col items-center py-20 text-on-surface-variant">' +
        '<span class="material-symbols-outlined text-5xl mb-4 opacity-30">search_off</span>' +
        '<p class="text-lg font-bold mb-1">No services found</p>' +
        '<p class="text-sm">Try a different search or filter</p></div>';
    } else {
      grid.innerHTML = data.services.map(renderServiceCard).join('');
    }

    // Update pagination
    document.getElementById('page-info').textContent = 'Page ' + currentPage + ' of ' + totalPages + ' (' + data.total + ' services)';
    document.getElementById('prev-btn').disabled = currentPage <= 1;
    document.getElementById('next-btn').disabled = currentPage >= totalPages;

    // Build platform filter buttons from first load
    if (currentPlatform === 'all' && currentSearch === '' && currentPage === 1) {
      buildPlatformFilters();
    }
  } catch (e) {
    grid.innerHTML = '<div class="col-span-full flex flex-col items-center py-20 text-error">' +
      '<span class="material-symbols-outlined text-5xl mb-4">cloud_off</span>' +
      '<p class="text-lg font-bold">Failed to load services</p>' +
      '<p class="text-sm text-on-surface-variant">API may be temporarily unavailable</p></div>';
  }
}

async function buildPlatformFilters() {
  try {
    var res = await fetch(API + '/api/stats');
    var stats = await res.json();
    var container = document.getElementById('platform-filters');
    var html = '<button class="platform-btn active text-xs font-bold px-4 py-1.5 rounded-full border border-outline-variant/20 transition-all hover:bg-white/5" data-platform="all" onclick="selectPlatform(\\x27all\\x27)">All (' + stats.total_services + ')</button>';
    (stats.platforms || []).forEach(function(p) {
      html += '<button class="platform-btn text-xs font-bold px-4 py-1.5 rounded-full border border-outline-variant/20 transition-all hover:bg-white/5" data-platform="' + p.platform + '" onclick="selectPlatform(\\x27' + p.platform + '\\x27)">' + p.platform + ' (' + p.count + ')</button>';
    });
    container.innerHTML = html;
  } catch(e) {}
}

loadServices();
</script>
</body></html>`;
