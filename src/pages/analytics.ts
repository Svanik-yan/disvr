// Analytics Dashboard page — served at GET /analytics
export const analyticsPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Disvr — Analytics Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
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
        "on-primary-fixed": "#000000", "primary-fixed-dim": "#9d81f0",
      },
      fontFamily: { "headline": ["Manrope"], "body": ["Inter"] },
      borderRadius: {"DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px"},
    },
  },
}
</script>
<style>
.glass-card { background: rgba(25, 37, 64, 0.4); backdrop-filter: blur(20px); outline: 1px solid rgba(64, 72, 93, 0.15); }
.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
</style>
</head>
<body class="bg-surface text-on-surface font-body selection:bg-primary/30 min-h-screen">
<div class="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
  <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full"></div>
  <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[100px] rounded-full"></div>
</div>

<!-- Nav -->
<nav class="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-slate-950/60 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] border-b border-white/10">
  <div class="flex items-center gap-8">
    <a href="/" class="text-2xl font-bold bg-gradient-to-r from-violet-400 to-teal-300 bg-clip-text text-transparent font-headline">Disvr</a>
    <div class="hidden md:flex gap-6 items-center">
      <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/">Home</a>
      <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/registry">Registry</a>
      <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/explorer">Explorer</a>
      <a class="text-teal-300 border-b-2 border-teal-300 pb-1" href="/analytics">Analytics</a>
    </div>
  </div>
  <a href="https://api.disvr.top/health" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-secondary text-sm font-medium">
    <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> API Live
  </a>
</nav>

<!-- Main Content -->
<main class="pt-28 px-8 pb-12 max-w-7xl mx-auto">
  <header class="mb-12">
    <h1 class="text-5xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Analytics Dashboard</h1>
    <p class="text-on-surface-variant text-lg max-w-2xl">Real-time intelligence metrics for the Disvr discovery engine.</p>
  </header>

  <!-- Bento Grid -->
  <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-12">
    <!-- Metric: Services Indexed -->
    <div class="md:col-span-2 glass-card rounded-xl p-8 flex flex-col justify-between overflow-hidden relative group">
      <div class="relative z-10">
        <div class="flex justify-between items-start mb-4">
          <span class="text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">Services Indexed</span>
          <span class="text-secondary material-symbols-outlined text-3xl">database</span>
        </div>
        <div class="text-4xl font-headline font-extrabold text-on-surface mb-1" id="metric-services">--</div>
        <div class="flex items-center gap-2 text-secondary text-sm font-medium">
          <span class="material-symbols-outlined text-sm">cloud_sync</span>
          <span>From Smithery registry</span>
        </div>
      </div>
      <div class="absolute bottom-0 left-0 w-full h-24 opacity-30 group-hover:opacity-50 transition-opacity">
        <svg class="w-full h-full" viewBox="0 0 400 100">
          <path d="M0,80 Q50,40 100,70 T200,30 T300,50 T400,10" fill="none" stroke="rgba(98,250,227,0.6)" stroke-width="4"/>
        </svg>
      </div>
    </div>

    <!-- Metric: Search Method -->
    <div class="md:col-span-2 glass-card rounded-xl p-8 flex flex-col justify-between overflow-hidden relative">
      <div>
        <div class="flex justify-between items-start mb-4">
          <span class="text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">Search Pipeline</span>
          <span class="text-primary material-symbols-outlined text-3xl">manage_search</span>
        </div>
        <div class="text-4xl font-headline font-extrabold text-on-surface mb-1">Dual-Path</div>
        <div class="flex items-center gap-2 text-primary-fixed-dim text-sm font-medium">
          <span class="material-symbols-outlined text-sm">alt_route</span>
          <span>Vector + FTS5 fallback</span>
        </div>
      </div>
      <div class="flex gap-1 items-end h-16 mt-4">
        <div class="bg-primary/20 w-full rounded-t-sm h-[40%]"></div>
        <div class="bg-primary/20 w-full rounded-t-sm h-[60%]"></div>
        <div class="bg-primary/20 w-full rounded-t-sm h-[50%]"></div>
        <div class="bg-primary/40 w-full rounded-t-sm h-[80%]"></div>
        <div class="bg-primary/60 w-full rounded-t-sm h-[100%]"></div>
        <div class="bg-primary/20 w-full rounded-t-sm h-[70%]"></div>
        <div class="bg-primary/20 w-full rounded-t-sm h-[45%]"></div>
      </div>
    </div>

    <!-- Metric: Value Score -->
    <div class="md:col-span-2 glass-card rounded-xl p-8 flex flex-col items-center justify-center relative">
      <div class="relative w-32 h-32 flex items-center justify-center">
        <svg class="w-full h-full -rotate-90">
          <circle cx="64" cy="64" fill="transparent" r="58" stroke="rgba(255,255,255,0.05)" stroke-width="8"/>
          <circle cx="64" cy="64" fill="transparent" r="58" stroke="url(#grad-score)" stroke-dasharray="364" stroke-dashoffset="12" stroke-linecap="round" stroke-width="8"/>
          <defs><linearGradient id="grad-score" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" style="stop-color:#b79fff"/><stop offset="100%" style="stop-color:#62fae3"/></linearGradient></defs>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-2xl font-headline font-bold">4-Dim</span>
          <span class="text-[8px] text-on-surface-variant uppercase tracking-widest">Value Score</span>
        </div>
      </div>
      <div class="mt-4 text-center">
        <p class="text-xs text-on-surface-variant font-medium">Semantic + Quality + Cost + Reliability</p>
      </div>
    </div>

    <!-- Scoring Weights Chart -->
    <div class="md:col-span-4 lg:col-span-4 glass-card rounded-xl p-8">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h2 class="text-xl font-headline font-bold">Ranking Weights</h2>
          <p class="text-xs text-on-surface-variant">How value_score is computed for each recommendation</p>
        </div>
        <div class="flex gap-2">
          <div class="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-[10px] text-on-surface-variant border border-outline-variant/10">
            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span> Semantic
          </div>
          <div class="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-[10px] text-on-surface-variant border border-outline-variant/10">
            <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> Quality
          </div>
          <div class="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-[10px] text-on-surface-variant border border-outline-variant/10">
            <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span> Cost
          </div>
        </div>
      </div>
      <div class="h-64 w-full relative">
        <div class="absolute inset-0 flex items-end justify-around px-2">
          <div class="text-center">
            <div class="w-16 bg-gradient-to-t from-primary/20 to-primary/60 rounded-t-xl mx-auto" style="height: 75%"></div>
            <p class="text-[10px] text-on-surface-variant mt-2">Semantic</p>
            <p class="text-xs font-bold text-primary">0.30</p>
          </div>
          <div class="text-center">
            <div class="w-16 bg-gradient-to-t from-secondary/20 to-secondary/60 rounded-t-xl mx-auto" style="height: 62%"></div>
            <p class="text-[10px] text-on-surface-variant mt-2">Quality</p>
            <p class="text-xs font-bold text-secondary">0.25</p>
          </div>
          <div class="text-center">
            <div class="w-16 bg-gradient-to-t from-tertiary/20 to-tertiary/60 rounded-t-xl mx-auto" style="height: 62%"></div>
            <p class="text-[10px] text-on-surface-variant mt-2">Cost Eff.</p>
            <p class="text-xs font-bold text-tertiary">0.25</p>
          </div>
          <div class="text-center">
            <div class="w-16 bg-gradient-to-t from-primary/20 to-primary/40 rounded-t-xl mx-auto" style="height: 50%"></div>
            <p class="text-[10px] text-on-surface-variant mt-2">Reliability</p>
            <p class="text-xs font-bold text-primary-dim">0.20</p>
          </div>
        </div>
      </div>
    </div>

    <!-- API Endpoints -->
    <div class="md:col-span-2 lg:col-span-2 glass-card rounded-xl p-8 flex flex-col">
      <h2 class="text-xl font-headline font-bold mb-6">API Endpoints</h2>
      <div class="space-y-6 flex-1">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-secondary">search</span>
            </div>
            <div>
              <p class="text-sm font-bold">POST /discover</p>
              <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Service Discovery</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs font-bold text-secondary">Live</p>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-primary">send</span>
            </div>
            <div>
              <p class="text-sm font-bold">POST /report</p>
              <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Feedback Loop</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs font-bold text-secondary">Live</p>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-tertiary">hub</span>
            </div>
            <div>
              <p class="text-sm font-bold">MCP /mcp</p>
              <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Streamable HTTP</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs font-bold text-secondary">Live</p>
          </div>
        </div>
      </div>
      <a href="/explorer" class="mt-8 text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
        Try Explorer <span class="material-symbols-outlined text-sm">arrow_forward</span>
      </a>
    </div>

    <!-- Architecture Overview -->
    <div class="md:col-span-6 glass-card rounded-xl overflow-hidden">
      <div class="p-8 border-b border-outline-variant/10 flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-headline font-extrabold tracking-tight">System Architecture</h2>
          <p class="text-sm text-on-surface-variant">How Disvr processes a discovery request</p>
        </div>
      </div>
      <div class="p-8">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-center">
          <div class="glass-card p-6 rounded-xl">
            <span class="material-symbols-outlined text-3xl text-secondary mb-2">input</span>
            <p class="text-sm font-bold">Agent Query</p>
            <p class="text-[10px] text-on-surface-variant mt-1">"I need X"</p>
          </div>
          <div class="hidden md:flex items-center justify-center">
            <span class="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
          </div>
          <div class="glass-card p-6 rounded-xl">
            <span class="material-symbols-outlined text-3xl text-primary mb-2">memory</span>
            <p class="text-sm font-bold">Embed + Search</p>
            <p class="text-[10px] text-on-surface-variant mt-1">OpenAI + Vectorize</p>
          </div>
          <div class="hidden md:flex items-center justify-center">
            <span class="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
          </div>
          <div class="glass-card p-6 rounded-xl">
            <span class="material-symbols-outlined text-3xl text-tertiary mb-2">leaderboard</span>
            <p class="text-sm font-bold">4-Dim Rank</p>
            <p class="text-[10px] text-on-surface-variant mt-1">Top 3 by value</p>
          </div>
        </div>
        <div class="flex justify-center mt-6">
          <div class="glass-card px-8 py-4 rounded-xl flex items-center gap-4">
            <span class="material-symbols-outlined text-secondary">autorenew</span>
            <div class="text-left">
              <p class="text-sm font-bold">Closed-Loop Feedback</p>
              <p class="text-[10px] text-on-surface-variant">POST /report &rarr; refreshServiceStats &rarr; better rankings</p>
            </div>
          </div>
        </div>
      </div>
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
fetch('https://api.disvr.top/health').then(r => r.json()).then(d => {
  document.getElementById('metric-services').textContent = d.services_indexed || '--';
}).catch(() => {});
</script>
</body></html>`;
