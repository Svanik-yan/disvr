// Service Detail page — served at GET /registry/:serviceId
// Dynamically loads data from /api/services/:id/detail

export function serviceDetailPageHtml(serviceId: string): string {
  return `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link rel="icon" type="image/png" href="/favicon.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<title>Disvr — Service Detail</title>
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
    <a href="/" class="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent font-headline"><img src="/favicon.png" alt="Disvr" class="w-8 h-8"/>Disvr</a>
    <div class="hidden md:flex items-center gap-6">
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/">Home</a>
      <a class="text-teal-400 border-b-2 border-teal-400 pb-1" href="/registry">Registry</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/explorer">Explorer</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/analytics">Analytics</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/benchmark">Benchmark</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/keys">Get API Key</a>
    </div>
  </div>
</nav>

<!-- Main Content -->
<main class="pt-28 pb-12 px-8 lg:px-12 min-h-screen max-w-6xl mx-auto">
  <!-- Back link -->
  <a href="/registry" class="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors mb-6">
    <span class="material-symbols-outlined text-sm">arrow_back</span> Back to Registry
  </a>

  <!-- Loading state -->
  <div id="loading" class="flex justify-center py-20">
    <div class="flex items-center gap-3 text-on-surface-variant">
      <span class="material-symbols-outlined animate-spin">progress_activity</span> Loading service details...
    </div>
  </div>

  <!-- Error state -->
  <div id="error-state" class="hidden flex flex-col items-center py-20 text-error">
    <span class="material-symbols-outlined text-5xl mb-4">error</span>
    <p class="text-lg font-bold">Service not found</p>
    <a href="/registry" class="text-sm text-primary mt-4 hover:underline">Return to Registry</a>
  </div>

  <!-- Detail content (hidden until loaded) -->
  <div id="detail-content" class="hidden space-y-6">
    <!-- Header -->
    <div class="glass-card rounded-xl p-8">
      <div class="flex flex-col md:flex-row justify-between items-start gap-6">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <h1 id="svc-name" class="text-3xl font-headline font-extrabold gradient-text"></h1>
            <span id="svc-health-dot" class="w-3 h-3 rounded-full"></span>
          </div>
          <p id="svc-desc" class="text-on-surface-variant text-sm leading-relaxed mb-4 max-w-2xl"></p>
          <div class="flex flex-wrap gap-2 mb-4" id="svc-badges"></div>
          <div class="flex flex-wrap gap-2" id="svc-caps"></div>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
          <div id="svc-reputation" class="text-4xl font-headline font-bold"></div>
          <div class="text-xs text-on-surface-variant uppercase">Reputation</div>
          <a id="svc-source" href="#" target="_blank" class="hidden items-center gap-1 text-secondary text-xs font-bold hover:underline mt-2">
            <span class="material-symbols-outlined text-sm">open_in_new</span>Source
          </a>
        </div>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4" id="metrics-grid"></div>

    <!-- Two Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Health & Install -->
      <div class="glass-card rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">monitor_heart</span> Health & Install
        </h2>
        <div id="health-section" class="space-y-3"></div>
      </div>

      <!-- Cost Intelligence -->
      <div class="glass-card rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">payments</span> Cost Intelligence
        </h2>
        <div id="cost-section" class="space-y-3"></div>
      </div>

      <!-- Error Profile -->
      <div class="glass-card rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">bug_report</span> Error Profile
        </h2>
        <div id="errors-section" class="space-y-3"></div>
      </div>

      <!-- Version History -->
      <div class="glass-card rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">history</span> Version History
        </h2>
        <div id="versions-section" class="space-y-3"></div>
      </div>
    </div>

    <!-- Install Info -->
    <div id="install-info-card" class="glass-card rounded-xl p-6 hidden">
      <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-sm">terminal</span> Installation
      </h2>
      <div id="install-info" class="space-y-3"></div>
    </div>

    <!-- Tools Provided -->
    <div id="tools-card" class="glass-card rounded-xl p-6 hidden">
      <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-sm">build</span> Tools Provided
      </h2>
      <div id="tools-section" class="space-y-2"></div>
    </div>

    <!-- Co-occurrence & Benchmarks -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="glass-card rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">hub</span> Commonly Used With
        </h2>
        <div id="cooccurrence-section" class="space-y-2"></div>
      </div>

      <div class="glass-card rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">leaderboard</span> Benchmark Rankings
        </h2>
        <div id="benchmarks-section" class="space-y-2"></div>
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
var SERVICE_ID = '${serviceId.replace(/'/g, "\\'")}';

function healthColor(status) {
  return { healthy: 'bg-green-400', degraded: 'bg-yellow-400', dead: 'bg-red-400' }[status] || 'bg-slate-500';
}
function healthText(status) {
  return { healthy: 'text-green-400', degraded: 'text-yellow-400', dead: 'text-red-400' }[status] || 'text-slate-400';
}

function metricCard(label, value, icon, color) {
  return '<div class="glass-card rounded-xl p-4 text-center">' +
    '<span class="material-symbols-outlined text-lg ' + (color || 'text-primary') + ' mb-1">' + icon + '</span>' +
    '<div class="text-lg font-bold ' + (color || 'text-on-surface') + '">' + value + '</div>' +
    '<div class="text-[10px] text-on-surface-variant uppercase tracking-widest">' + label + '</div>' +
  '</div>';
}

function kv(label, value, valueClass) {
  return '<div class="flex justify-between items-center py-1.5 border-b border-white/5">' +
    '<span class="text-xs text-on-surface-variant">' + label + '</span>' +
    '<span class="text-xs font-bold ' + (valueClass || 'text-on-surface') + '">' + value + '</span>' +
  '</div>';
}

async function loadDetail() {
  try {
    var res = await fetch(API + '/api/services/' + encodeURIComponent(SERVICE_ID) + '/detail');
    if (!res.ok) throw new Error('Not found');
    var json = await res.json();
    var d = json.data;
    var s = d.service;

    document.title = 'Disvr — ' + s.name;
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('detail-content').classList.remove('hidden');

    // Header
    document.getElementById('svc-name').textContent = s.name;
    document.getElementById('svc-desc').textContent = s.description || 'No description available.';

    var hs = d.health ? d.health.status : 'unknown';
    var dot = document.getElementById('svc-health-dot');
    dot.className = 'w-3 h-3 rounded-full ' + healthColor(hs);
    dot.title = hs;

    // Badges
    var badges = '';
    badges += '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-container-highest border border-white/10 text-on-surface-variant">' + s.platform + '</span>';
    badges += '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-container-highest border border-white/10 text-on-surface-variant">' + (s.type || 'mcp_server') + '</span>';
    if (d.cost) {
      var pc = { free: 'bg-green-500/15 text-green-400 border-green-500/20', open_source: 'bg-green-500/15 text-green-400 border-green-500/20', freemium: 'bg-blue-500/15 text-blue-400 border-blue-500/20', paid: 'bg-amber-500/15 text-amber-400 border-amber-500/20' };
      var pcc = pc[d.cost.pricing_model] || 'bg-slate-500/15 text-slate-400 border-slate-500/20';
      badges += '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ' + pcc + '">' + d.cost.pricing_model + '</span>';
    }
    if (d.versions && d.versions.recent_breaking_change) {
      badges += '<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/15 text-red-400 border border-red-500/20">Breaking Change</span>';
    }
    document.getElementById('svc-badges').innerHTML = badges;

    // Capabilities
    var capsHtml = (s.capabilities || []).map(function(c) {
      return '<span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] border border-primary/20">' + c + '</span>';
    }).join('');
    document.getElementById('svc-caps').innerHTML = capsHtml;

    // Reputation
    var rep = s.metrics.reputation_score;
    var repEl = document.getElementById('svc-reputation');
    repEl.textContent = rep !== null ? rep.toFixed(1) : 'N/A';
    repEl.className = 'text-4xl font-headline font-bold ' + (rep >= 3.5 ? 'text-secondary' : rep >= 2 ? 'text-primary' : 'text-on-surface-variant');

    // Source link
    if (s.source_url) {
      var srcEl = document.getElementById('svc-source');
      srcEl.href = s.source_url;
      srcEl.classList.remove('hidden');
      srcEl.classList.add('inline-flex');
    }

    // Metrics grid
    var m = s.metrics;
    var mg = '';
    mg += metricCard('Success Rate', m.success_rate !== null ? (m.success_rate * 100).toFixed(0) + '%' : '--', 'check_circle', m.success_rate >= 0.9 ? 'text-green-400' : m.success_rate >= 0.7 ? 'text-yellow-400' : 'text-on-surface');
    mg += metricCard('P95 Latency', m.latency_p95_ms !== null ? m.latency_p95_ms + 'ms' : '--', 'speed');
    mg += metricCard('Total Calls', m.total_calls.toLocaleString(), 'bar_chart');
    mg += metricCard('Retry Rate', m.retry_rate !== null ? (m.retry_rate * 100).toFixed(0) + '%' : '--', 'replay', m.retry_rate > 0.1 ? 'text-yellow-400' : 'text-on-surface');
    document.getElementById('metrics-grid').innerHTML = mg;

    // Health section
    var hh = '';
    if (d.health) {
      var h = d.health;
      hh += kv('Status', '<span class="' + healthText(h.status) + '">' + h.status + '</span>');
      hh += kv('Uptime (30d)', (h.uptime_30d * 100).toFixed(1) + '%');
      hh += kv('Avg Response', h.avg_response_ms !== null ? h.avg_response_ms + 'ms' : '--');
      hh += kv('Call Success Rate', h.call_success_rate !== null ? (h.call_success_rate * 100).toFixed(0) + '%' : '--');
      hh += kv('Probe Type', h.probe_type || '--');
      hh += kv('Install Score', h.install_score !== null ? h.install_score + '/100' : '--');
      hh += kv('Install Difficulty', h.install_difficulty || '--', h.install_difficulty === 'easy' ? 'text-green-400' : h.install_difficulty === 'hard' ? 'text-red-400' : '');
      hh += kv('Last Check', h.last_check_at ? h.last_check_at.slice(0, 16).replace('T', ' ') : '--');
    } else {
      hh = '<p class="text-xs text-on-surface-variant">No health data available.</p>';
    }
    document.getElementById('health-section').innerHTML = hh;

    // Cost section
    var cc = '';
    if (d.cost) {
      cc += kv('Pricing Model', d.cost.pricing_model);
      cc += kv('Cost per Call', d.cost.cost_per_call !== null ? '$' + d.cost.cost_per_call.toFixed(4) : 'Free');
      cc += kv('Free Tier', d.cost.free_tier_limit === -1 ? 'Unlimited' : d.cost.free_tier_limit !== null ? d.cost.free_tier_limit + ' calls/day' : '--');
      cc += kv('Monthly Price', d.cost.monthly_price !== null && d.cost.monthly_price > 0 ? '$' + d.cost.monthly_price.toFixed(2) + '/mo' : 'Free');
    } else {
      cc = '<p class="text-xs text-on-surface-variant">No cost data available.</p>';
    }
    document.getElementById('cost-section').innerHTML = cc;

    // Errors section
    var ee = '';
    if (d.errors && d.errors.error_count_30d > 0) {
      ee += kv('Errors (30d)', d.errors.error_count_30d, 'text-error');
      ee += kv('Primary Error', d.errors.primary_error_type || '--');
      if (d.errors.distribution && Object.keys(d.errors.distribution).length > 0) {
        ee += '<div class="mt-2"><div class="text-[10px] text-on-surface-variant uppercase mb-1">Distribution</div>';
        Object.entries(d.errors.distribution).forEach(function(e) {
          ee += '<div class="flex justify-between text-xs py-0.5"><span class="text-on-surface-variant">' + e[0] + '</span><span class="font-bold">' + e[1] + '</span></div>';
        });
        ee += '</div>';
      }
      if (d.errors.recent && d.errors.recent.length > 0) {
        ee += '<div class="mt-3 pt-3 border-t border-white/5"><div class="text-[10px] text-on-surface-variant uppercase mb-2">Recent Errors</div>';
        d.errors.recent.slice(0, 5).forEach(function(e) {
          ee += '<div class="text-[10px] py-1 border-b border-white/5 flex justify-between"><span class="text-error">' + e.error_type + '</span><span class="text-on-surface-variant">' + (e.occurred_at || '').slice(0, 10) + '</span></div>';
        });
        ee += '</div>';
      }
    } else {
      ee = '<p class="text-xs text-on-surface-variant flex items-center gap-2"><span class="material-symbols-outlined text-green-400 text-sm">verified</span> No errors in the last 30 days.</p>';
    }
    document.getElementById('errors-section').innerHTML = ee;

    // Versions section
    var vv = '';
    if (d.versions) {
      if (d.versions.current_version) {
        vv += kv('Current Version', d.versions.current_version);
      }
      if (d.versions.last_version_change) {
        vv += kv('Last Changed', d.versions.last_version_change.slice(0, 10));
      }
      if (d.versions.recent_breaking_change) {
        vv += '<div class="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-bold">Recent breaking change detected</div>';
      }
      if (d.versions.history && d.versions.history.length > 0) {
        vv += '<div class="mt-2"><div class="text-[10px] text-on-surface-variant uppercase mb-2">History</div>';
        d.versions.history.forEach(function(v) {
          var breakingIcon = v.is_breaking ? '<span class="text-red-400 text-[9px] font-bold ml-1">BREAKING</span>' : '';
          vv += '<div class="flex justify-between items-center text-xs py-1 border-b border-white/5">' +
            '<span class="font-mono text-primary">' + v.version + breakingIcon + '</span>' +
            '<span class="text-on-surface-variant">' + (v.detected_at || '').slice(0, 10) + '</span>' +
          '</div>';
        });
        vv += '</div>';
      }
    }
    if (!vv) vv = '<p class="text-xs text-on-surface-variant">No version data available.</p>';
    document.getElementById('versions-section').innerHTML = vv;

    // Install info
    if (s.install) {
      document.getElementById('install-info-card').classList.remove('hidden');
      var ii = '';
      ii += '<div class="bg-surface-container-highest rounded-lg p-3 font-mono text-xs text-secondary overflow-x-auto">' + s.install.command + '</div>';
      ii += kv('Runtime', s.install.runtime || '--');
      if (s.install.min_version) ii += kv('Min Version', s.install.min_version);
      if (s.required_env && s.required_env.length > 0) {
        ii += '<div class="mt-3 pt-3 border-t border-white/5"><div class="text-[10px] text-on-surface-variant uppercase mb-2">Environment Variables</div>';
        s.required_env.forEach(function(env) {
          var freeTier = env.free_tier ? '<span class="text-green-400 text-[9px] ml-1">FREE TIER</span>' : '';
          ii += '<div class="py-1"><span class="font-mono text-xs text-primary">' + env.key + '</span>' + freeTier + '<div class="text-[10px] text-on-surface-variant">' + (env.description || '') + '</div></div>';
        });
        ii += '</div>';
      }
      document.getElementById('install-info').innerHTML = ii;
    }

    // Tools provided
    if (s.tools_provided && s.tools_provided.length > 0) {
      document.getElementById('tools-card').classList.remove('hidden');
      var tt = '';
      s.tools_provided.forEach(function(t) {
        tt += '<div class="glass-card rounded-lg p-3">' +
          '<div class="text-xs font-bold text-primary">' + t.name + '</div>' +
          '<div class="text-[10px] text-on-surface-variant mt-0.5">' + (t.description || '') + '</div>' +
        '</div>';
      });
      document.getElementById('tools-section').innerHTML = tt;
    }

    // Co-occurrence
    var coo = '';
    if (d.cooccurrence && d.cooccurrence.length > 0) {
      d.cooccurrence.forEach(function(c) {
        coo += '<div class="flex justify-between items-center py-1.5 border-b border-white/5">' +
          '<a href="/registry/' + encodeURIComponent(c.service_id) + '" class="text-xs text-primary hover:underline">' + c.name + '</a>' +
          '<span class="text-[10px] text-on-surface-variant">' + c.co_count + ' co-uses</span>' +
        '</div>';
      });
    } else {
      coo = '<p class="text-xs text-on-surface-variant">No co-occurrence data yet.</p>';
    }
    document.getElementById('cooccurrence-section').innerHTML = coo;

    // Benchmarks
    var bb = '';
    if (d.benchmarks && d.benchmarks.length > 0) {
      d.benchmarks.forEach(function(b) {
        var rankColor = b.rank <= 3 ? 'text-secondary' : b.rank <= 10 ? 'text-primary' : 'text-on-surface';
        bb += '<div class="flex justify-between items-center py-1.5 border-b border-white/5">' +
          '<span class="text-xs text-on-surface">' + b.scenario_name + '</span>' +
          '<div class="flex items-center gap-3">' +
            '<span class="text-[10px] text-on-surface-variant">' + (b.score * 100).toFixed(0) + '%</span>' +
            '<span class="text-xs font-bold ' + rankColor + '">#' + b.rank + '</span>' +
          '</div>' +
        '</div>';
      });
    } else {
      bb = '<p class="text-xs text-on-surface-variant">No benchmark data yet.</p>';
    }
    document.getElementById('benchmarks-section').innerHTML = bb;

  } catch (e) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
  }
}

loadDetail();
</script>
</body></html>`;
}
