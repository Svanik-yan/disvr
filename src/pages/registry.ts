// Provider Registry page — served at GET /registry
export const registryPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
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
  <header class="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
    <div class="max-w-2xl">
      <h1 class="text-5xl lg:text-6xl font-headline font-extrabold tracking-tighter mb-4 leading-[0.9] gradient-text">Provider Registry</h1>
      <p class="text-on-surface-variant text-lg max-w-lg leading-relaxed">
        All indexed MCP services ranked by value score. Crawled hourly from Smithery and more sources.
      </p>
    </div>
    <div class="flex gap-4">
      <div class="glass-card px-6 py-3 rounded-full flex items-center gap-3">
        <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
        <span class="text-sm text-on-surface uppercase tracking-widest font-bold" id="service-count">Loading...</span>
      </div>
    </div>
  </header>

  <!-- Featured Providers -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
    <div class="glass-card p-8 rounded-xl group relative overflow-hidden flex flex-col justify-between h-72">
      <div class="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:scale-150"></div>
      <div>
        <div class="flex justify-between items-start mb-6">
          <div class="w-14 h-14 bg-surface-container-high rounded-lg flex items-center justify-center border border-white/5">
            <span class="material-symbols-outlined text-3xl text-primary">database</span>
          </div>
          <span class="text-[10px] font-bold py-1 px-3 rounded-full bg-secondary/10 text-secondary border border-secondary/20 uppercase">Primary Source</span>
        </div>
        <h3 class="text-2xl font-headline font-bold text-on-surface mb-2">Smithery Registry</h3>
        <p class="text-on-surface-variant text-sm leading-snug">16,000+ MCP servers indexed. Hourly crawl keeps data fresh. Primary source for service discovery.</p>
      </div>
      <div class="flex justify-between items-center mt-4">
        <span class="text-xs text-on-surface-variant uppercase tracking-widest">330+ Indexed</span>
        <a href="https://smithery.ai" target="_blank" class="text-secondary text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
          Visit <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </a>
      </div>
    </div>

    <div class="glass-card p-8 rounded-xl group relative overflow-hidden flex flex-col justify-between h-72">
      <div class="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:scale-150"></div>
      <div>
        <div class="flex justify-between items-start mb-6">
          <div class="w-14 h-14 bg-surface-container-high rounded-lg flex items-center justify-center border border-white/5">
            <span class="material-symbols-outlined text-3xl text-secondary">search</span>
          </div>
          <span class="text-[10px] font-bold py-1 px-3 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">Core Engine</span>
        </div>
        <h3 class="text-2xl font-headline font-bold text-on-surface mb-2">Vector Search</h3>
        <p class="text-on-surface-variant text-sm leading-snug">OpenAI text-embedding-3-small (1536 dim) + CF Vectorize. Semantic matching with FTS5 fallback.</p>
      </div>
      <div class="flex justify-between items-center mt-4">
        <span class="text-xs text-on-surface-variant uppercase tracking-widest">Dual-Path</span>
        <span class="text-primary text-sm font-bold">Embed + FTS5</span>
      </div>
    </div>

    <div class="glass-card p-8 rounded-xl group relative overflow-hidden flex flex-col justify-between h-72">
      <div class="absolute top-0 right-0 w-32 h-32 bg-tertiary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:scale-150"></div>
      <div>
        <div class="flex justify-between items-start mb-6">
          <div class="w-14 h-14 bg-surface-container-high rounded-lg flex items-center justify-center border border-white/5">
            <span class="material-symbols-outlined text-3xl text-tertiary">autorenew</span>
          </div>
          <span class="text-[10px] font-bold py-1 px-3 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 uppercase">Feedback</span>
        </div>
        <h3 class="text-2xl font-headline font-bold text-on-surface mb-2">Closed-Loop Ranking</h3>
        <p class="text-on-surface-variant text-sm leading-snug">Agents report call results. Success rate, latency, cost per success feed back into the 4-dimension value score.</p>
      </div>
      <div class="flex justify-between items-center mt-4">
        <span class="text-xs text-on-surface-variant uppercase tracking-widest">4-Dim Score</span>
        <span class="text-tertiary text-sm font-bold">Live Ranking</span>
      </div>
    </div>
  </section>

  <!-- Services Table -->
  <section class="glass-card rounded-xl overflow-hidden mb-12">
    <div class="px-8 py-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
      <div>
        <h2 class="text-2xl font-headline font-bold text-on-surface">Indexed Services</h2>
        <p class="text-on-surface-variant text-xs uppercase tracking-widest mt-1">From Smithery registry &middot; Updated hourly</p>
      </div>
      <div class="flex gap-3">
        <button onclick="loadServices()" class="bg-surface-container-highest border border-white/10 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-colors">
          <span class="material-symbols-outlined text-sm">refresh</span> Refresh
        </button>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-surface-variant/20">
            <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Service</th>
            <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Platform</th>
            <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Capabilities</th>
            <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Reputation</th>
            <th class="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
          </tr>
        </thead>
        <tbody id="services-tbody" class="divide-y divide-white/5">
          <tr><td colspan="5" class="px-8 py-12 text-center text-on-surface-variant">Loading services from API...</td></tr>
        </tbody>
      </table>
    </div>
    <div class="px-8 py-4 bg-surface-variant/10 flex justify-between items-center">
      <span class="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold" id="table-count">Loading...</span>
    </div>
  </section>

  <!-- Bottom Stats -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
    <div class="glass-card p-6 rounded-xl flex items-center gap-5">
      <div class="p-3 bg-primary/20 rounded-xl"><span class="material-symbols-outlined text-primary">hub</span></div>
      <div>
        <div class="text-2xl font-headline font-black text-on-surface tracking-tighter" id="stat-services">--</div>
        <div class="text-[10px] text-on-surface-variant uppercase tracking-widest">Indexed Services</div>
      </div>
    </div>
    <div class="glass-card p-6 rounded-xl flex items-center gap-5">
      <div class="p-3 bg-secondary/20 rounded-xl"><span class="material-symbols-outlined text-secondary">flash_on</span></div>
      <div>
        <div class="text-2xl font-headline font-black text-on-surface tracking-tighter">4-Dim</div>
        <div class="text-[10px] text-on-surface-variant uppercase tracking-widest">Value Scoring</div>
      </div>
    </div>
    <div class="glass-card p-6 rounded-xl flex items-center gap-5">
      <div class="p-3 bg-tertiary/20 rounded-xl"><span class="material-symbols-outlined text-tertiary">schedule</span></div>
      <div>
        <div class="text-2xl font-headline font-black text-on-surface tracking-tighter">1h</div>
        <div class="text-[10px] text-on-surface-variant uppercase tracking-widest">Crawl Interval</div>
      </div>
    </div>
    <div class="glass-card p-6 rounded-xl flex items-center gap-5">
      <div class="p-3 bg-primary/20 rounded-xl"><span class="material-symbols-outlined text-primary">cloud_sync</span></div>
      <div>
        <div class="text-2xl font-headline font-black text-on-surface tracking-tighter">Smithery</div>
        <div class="text-[10px] text-on-surface-variant uppercase tracking-widest">Data Source</div>
      </div>
    </div>
  </div>
</main>

<script>
async function loadServices() {
  try {
    const healthRes = await fetch('https://api.disvr.top/health');
    const health = await healthRes.json();
    const count = health.services_indexed || 0;
    document.getElementById('service-count').textContent = count + ' Services Live';
    document.getElementById('stat-services').textContent = count;
    document.getElementById('table-count').textContent = 'Showing top results of ' + count + ' indexed services';

    // Try discover with a broad query to show some services
    const discoverRes = await fetch('https://api.disvr.top/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({ need: 'popular tools and services' })
    });
    const data = await discoverRes.json();
    const tbody = document.getElementById('services-tbody');

    if (data.recommendations && data.recommendations.length > 0) {
      tbody.innerHTML = data.recommendations.map(function(r) {
        const rep = r.reputation !== null ? (r.reputation.toFixed(1) + '/5') : 'N/A';
        const caps = r.reason ? r.reason.substring(0, 60) + '...' : 'MCP Service';
        return '<tr class="hover:bg-white/5 transition-colors">' +
          '<td class="px-8 py-6"><div class="flex items-center gap-4">' +
          '<div class="w-10 h-10 rounded-lg bg-surface-container-highest border border-white/5 flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-primary text-xl">widgets</span></div>' +
          '<div><div class="text-sm font-bold text-on-surface">' + r.service + '</div>' +
          '<div class="text-[10px] text-on-surface-variant">' + r.platform + '</div></div></div></td>' +
          '<td class="px-8 py-6"><span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20">' + r.platform + '</span></td>' +
          '<td class="px-8 py-6"><span class="text-xs text-on-surface-variant">' + caps + '</span></td>' +
          '<td class="px-8 py-6"><span class="text-sm font-mono text-secondary">' + rep + '</span></td>' +
          '<td class="px-8 py-6"><div class="flex items-center gap-2">' +
          '<div class="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(98,250,227,0.5)]"></div>' +
          '<span class="text-xs text-on-surface font-medium">Indexed</span></div></td></tr>';
      }).join('');
    }
  } catch (e) {
    document.getElementById('service-count').textContent = 'Offline';
  }
}
loadServices();
</script>
</body></html>`;
