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
      <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/keys">Get API Key</a>
    </div>
  </div>
  <a href="https://api.disvr.top/health" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-secondary text-sm font-medium">
    <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> API Live
  </a>
</nav>

<!-- Main Content -->
<main class="pt-28 px-8 pb-12 max-w-7xl mx-auto">
  <header class="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
    <div>
      <h1 class="text-5xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Analytics Dashboard</h1>
      <p class="text-on-surface-variant text-lg max-w-2xl">Real-time intelligence metrics from the Disvr discovery engine.</p>
    </div>
    <button onclick="loadStats()" class="flex items-center gap-2 px-4 py-2 rounded-lg glass-card text-sm font-bold hover:bg-white/10 transition-colors">
      <span class="material-symbols-outlined text-sm">refresh</span> Refresh
    </button>
  </header>

  <!-- KPI Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
    <div class="glass-card rounded-xl p-6 group relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl -mr-8 -mt-8 group-hover:scale-150 transition-all"></div>
      <div class="relative z-10">
        <div class="flex justify-between items-start mb-3">
          <span class="text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">Services Indexed</span>
          <span class="material-symbols-outlined text-2xl text-secondary">database</span>
        </div>
        <div class="text-4xl font-headline font-extrabold text-on-surface" id="kpi-services">--</div>
        <div class="text-xs text-on-surface-variant mt-1">From Smithery registry</div>
      </div>
    </div>
    <div class="glass-card rounded-xl p-6 group relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8 group-hover:scale-150 transition-all"></div>
      <div class="relative z-10">
        <div class="flex justify-between items-start mb-3">
          <span class="text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">Feedback Reports</span>
          <span class="material-symbols-outlined text-2xl text-primary">feedback</span>
        </div>
        <div class="text-4xl font-headline font-extrabold text-on-surface" id="kpi-reports">--</div>
        <div class="text-xs text-on-surface-variant mt-1">Agent call reports received</div>
      </div>
    </div>
    <div class="glass-card rounded-xl p-6 group relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl -mr-8 -mt-8 group-hover:scale-150 transition-all"></div>
      <div class="relative z-10">
        <div class="flex justify-between items-start mb-3">
          <span class="text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">Avg Success Rate</span>
          <span class="material-symbols-outlined text-2xl text-secondary">check_circle</span>
        </div>
        <div class="text-4xl font-headline font-extrabold text-on-surface" id="kpi-success">--</div>
        <div class="text-xs text-on-surface-variant mt-1">Across services with data</div>
      </div>
    </div>
    <div class="glass-card rounded-xl p-6 group relative overflow-hidden">
      <div class="absolute top-0 right-0 w-24 h-24 bg-tertiary/10 rounded-full blur-2xl -mr-8 -mt-8 group-hover:scale-150 transition-all"></div>
      <div class="relative z-10">
        <div class="flex justify-between items-start mb-3">
          <span class="text-on-surface-variant uppercase text-[10px] tracking-widest font-bold">Avg Latency</span>
          <span class="material-symbols-outlined text-2xl text-tertiary">speed</span>
        </div>
        <div class="text-4xl font-headline font-extrabold text-on-surface" id="kpi-latency">--</div>
        <div class="text-xs text-on-surface-variant mt-1">P95 across active services</div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
    <!-- Platform Distribution -->
    <div class="glass-card rounded-xl p-8">
      <h2 class="text-xl font-headline font-bold mb-6">Platform Distribution</h2>
      <div id="platform-chart" class="space-y-4">
        <div class="text-sm text-on-surface-variant">Loading...</div>
      </div>
    </div>

    <!-- Ranking Weights -->
    <div class="glass-card rounded-xl p-8">
      <h2 class="text-xl font-headline font-bold mb-2">Ranking Weights</h2>
      <p class="text-xs text-on-surface-variant mb-6">How value_score is computed</p>
      <div class="h-52 flex items-end justify-around gap-3">
        <div class="text-center flex-1">
          <div class="w-full bg-gradient-to-t from-primary/20 to-primary/60 rounded-t-xl mx-auto" style="height: 75%"></div>
          <p class="text-[10px] text-on-surface-variant mt-2">Semantic</p>
          <p class="text-xs font-bold text-primary">0.30</p>
        </div>
        <div class="text-center flex-1">
          <div class="w-full bg-gradient-to-t from-secondary/20 to-secondary/60 rounded-t-xl mx-auto" style="height: 62%"></div>
          <p class="text-[10px] text-on-surface-variant mt-2">Quality</p>
          <p class="text-xs font-bold text-secondary">0.25</p>
        </div>
        <div class="text-center flex-1">
          <div class="w-full bg-gradient-to-t from-tertiary/20 to-tertiary/60 rounded-t-xl mx-auto" style="height: 62%"></div>
          <p class="text-[10px] text-on-surface-variant mt-2">Cost Eff.</p>
          <p class="text-xs font-bold text-tertiary">0.25</p>
        </div>
        <div class="text-center flex-1">
          <div class="w-full bg-gradient-to-t from-primary/20 to-primary/40 rounded-t-xl mx-auto" style="height: 50%"></div>
          <p class="text-[10px] text-on-surface-variant mt-2">Reliability</p>
          <p class="text-xs font-bold text-primary-dim">0.20</p>
        </div>
      </div>
    </div>

    <!-- API Endpoints -->
    <div class="glass-card rounded-xl p-8 flex flex-col">
      <h2 class="text-xl font-headline font-bold mb-6">API Endpoints</h2>
      <div class="space-y-5 flex-1">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-secondary text-lg">search</span>
            </div>
            <div>
              <p class="text-sm font-bold">POST /discover</p>
              <p class="text-[10px] text-on-surface-variant">Service Discovery</p>
            </div>
          </div>
          <div class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(98,250,227,0.5)]" id="ep-discover"></div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-primary text-lg">send</span>
            </div>
            <div>
              <p class="text-sm font-bold">POST /report</p>
              <p class="text-[10px] text-on-surface-variant">Feedback Loop</p>
            </div>
          </div>
          <div class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(98,250,227,0.5)]" id="ep-report"></div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-tertiary text-lg">hub</span>
            </div>
            <div>
              <p class="text-sm font-bold">MCP /mcp</p>
              <p class="text-[10px] text-on-surface-variant">Streamable HTTP</p>
            </div>
          </div>
          <div class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(98,250,227,0.5)]" id="ep-mcp"></div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center">
              <span class="material-symbols-outlined text-on-surface-variant text-lg">list_alt</span>
            </div>
            <div>
              <p class="text-sm font-bold">GET /api/services</p>
              <p class="text-[10px] text-on-surface-variant">Service Listing</p>
            </div>
          </div>
          <div class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(98,250,227,0.5)]" id="ep-services"></div>
        </div>
      </div>
      <a href="/explorer" class="mt-6 text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
        Try Explorer <span class="material-symbols-outlined text-sm">arrow_forward</span>
      </a>
    </div>
  </div>

  <!-- Bottom Row -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
    <!-- Top Services -->
    <div class="glass-card rounded-xl overflow-hidden">
      <div class="px-8 py-5 border-b border-white/5">
        <h2 class="text-xl font-headline font-bold">Top Services</h2>
        <p class="text-xs text-on-surface-variant">Ranked by usage volume and reputation</p>
      </div>
      <div id="top-services" class="divide-y divide-white/5">
        <div class="px-8 py-8 text-center text-on-surface-variant text-sm">Loading...</div>
      </div>
    </div>

    <!-- Recent Feedback -->
    <div class="glass-card rounded-xl overflow-hidden">
      <div class="px-8 py-5 border-b border-white/5">
        <h2 class="text-xl font-headline font-bold">Recent Feedback</h2>
        <p class="text-xs text-on-surface-variant">Latest agent call reports</p>
      </div>
      <div id="recent-reports" class="divide-y divide-white/5">
        <div class="px-8 py-8 text-center text-on-surface-variant text-sm">Loading...</div>
      </div>
    </div>
  </div>

  <!-- Architecture -->
  <div class="glass-card rounded-xl overflow-hidden">
    <div class="p-8 border-b border-outline-variant/10">
      <h2 class="text-2xl font-headline font-extrabold tracking-tight">System Architecture</h2>
      <p class="text-sm text-on-surface-variant">How Disvr processes a discovery request</p>
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
var API = 'https://api.disvr.top';

function renderPlatformBar(name, count, total, color) {
  var pct = total > 0 ? Math.round(count / total * 100) : 0;
  return '<div>' +
    '<div class="flex justify-between items-center mb-1">' +
      '<span class="text-sm font-bold text-on-surface">' + name + '</span>' +
      '<span class="text-xs text-on-surface-variant">' + count + ' (' + pct + '%)</span>' +
    '</div>' +
    '<div class="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">' +
      '<div class="h-full rounded-full ' + color + '" style="width: ' + pct + '%"></div>' +
    '</div>' +
  '</div>';
}

async function loadStats() {
  try {
    var res = await fetch(API + '/api/stats');
    var s = await res.json();

    // KPIs
    document.getElementById('kpi-services').textContent = s.total_services;
    document.getElementById('kpi-reports').textContent = s.total_reports;
    document.getElementById('kpi-success').textContent = s.avg_success_rate !== null ? (s.avg_success_rate * 100).toFixed(1) + '%' : 'N/A';
    document.getElementById('kpi-latency').textContent = s.avg_latency_ms !== null ? Math.round(s.avg_latency_ms) + 'ms' : 'N/A';

    // Platform distribution
    var colors = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-primary-dim', 'bg-secondary-dim'];
    var platformHtml = '';
    (s.platforms || []).forEach(function(p, i) {
      platformHtml += renderPlatformBar(p.platform, p.count, s.total_services, colors[i % colors.length]);
    });
    document.getElementById('platform-chart').innerHTML = platformHtml || '<div class="text-sm text-on-surface-variant">No platform data yet</div>';

    // Top services
    var topHtml = '';
    (s.top_services || []).forEach(function(t, i) {
      var rep = t.reputation_score !== null ? t.reputation_score.toFixed(1) : '--';
      topHtml += '<div class="px-8 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">' +
        '<div class="flex items-center gap-4">' +
          '<span class="text-sm font-bold text-on-surface-variant w-6">#' + (i + 1) + '</span>' +
          '<div>' +
            '<p class="text-sm font-bold text-on-surface">' + t.name + '</p>' +
            '<p class="text-[10px] text-on-surface-variant">' + t.total_calls + ' calls</p>' +
          '</div>' +
        '</div>' +
        '<span class="text-sm font-mono font-bold text-secondary">' + rep + '</span>' +
      '</div>';
    });
    document.getElementById('top-services').innerHTML = topHtml || '<div class="px-8 py-8 text-center text-on-surface-variant text-sm">No usage data yet. Services appear here after agents report call results.</div>';

    // Recent reports
    var recentHtml = '';
    (s.recent_reports || []).forEach(function(r) {
      var icon = r.success ? 'check_circle' : 'cancel';
      var iconColor = r.success ? 'text-secondary' : 'text-error';
      var time = r.created_at ? new Date(r.created_at).toLocaleString() : '--';
      recentHtml += '<div class="px-8 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">' +
        '<div class="flex items-center gap-3">' +
          '<span class="material-symbols-outlined ' + iconColor + '">' + icon + '</span>' +
          '<div>' +
            '<p class="text-sm font-bold text-on-surface">' + r.service_id + '</p>' +
            '<p class="text-[10px] text-on-surface-variant">' + time + '</p>' +
          '</div>' +
        '</div>' +
        '<span class="text-xs font-bold ' + (r.success ? 'text-secondary' : 'text-error') + '">' + (r.success ? 'Success' : 'Failed') + '</span>' +
      '</div>';
    });
    document.getElementById('recent-reports').innerHTML = recentHtml || '<div class="px-8 py-8 text-center text-on-surface-variant text-sm">No feedback reports yet. Reports appear here after agents use POST /report.</div>';

    // Check endpoint health
    checkEndpoints();
  } catch (e) {
    document.getElementById('kpi-services').textContent = 'Error';
  }
}

async function checkEndpoints() {
  try {
    var res = await fetch(API + '/health');
    if (res.ok) {
      ['ep-discover', 'ep-report', 'ep-mcp', 'ep-services'].forEach(function(id) {
        document.getElementById(id).className = 'w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(98,250,227,0.5)]';
      });
    }
  } catch (e) {
    ['ep-discover', 'ep-report', 'ep-mcp', 'ep-services'].forEach(function(id) {
      document.getElementById(id).className = 'w-2 h-2 rounded-full bg-error shadow-[0_0_8px_rgba(255,110,132,0.5)]';
    });
  }
}

loadStats();
</script>
</body></html>`;
