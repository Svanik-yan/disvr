// Benchmark Leaderboard page — served at GET /benchmark
export const benchmarkPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link rel="icon" type="image/png" href="/favicon.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<title>Disvr Benchmark — AI Agent Tool Rankings</title>
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
.score-bar { height: 6px; border-radius: 3px; transition: width 0.6s ease; }
.scenario-tab { cursor: pointer; transition: all 0.2s; }
.scenario-tab.active { background: rgba(183,159,255,0.2); border-color: rgba(183,159,255,0.5); color: #b79fff; }
.scenario-tab:hover:not(.active) { background: rgba(183,159,255,0.1); }
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
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/registry">Registry</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/explorer">Explorer</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/analytics">Analytics</a>
      <a class="text-teal-400 border-b-2 border-teal-400 pb-1" href="/benchmark">Benchmark</a>
      <a class="text-slate-400 hover:text-slate-100 transition-colors" href="/keys">Get API Key</a>
    </div>
  </div>
  <div class="flex items-center gap-4">
    <a href="https://api.disvr.top/health" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-secondary text-sm font-medium">
      <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> API Live
    </a>
  </div>
</nav>

<!-- SDK Banner -->
<div class="mt-20 bg-surface-container-high/60 border-b border-primary/10">
  <div class="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
    <p class="text-sm text-on-surface-variant"><span class="text-secondary font-semibold">New:</span> TypeScript SDK available &mdash; <code class="text-primary">npm install @sylar_yan/disvr</code></p>
    <a href="https://www.npmjs.com/package/@sylar_yan/disvr" target="_blank" class="text-sm text-primary hover:text-primary-dim transition-colors font-medium">View on npm &rarr;</a>
  </div>
</div>

<!-- Main Content -->
<main class="p-8 lg:p-12 min-h-screen max-w-7xl mx-auto">
  <header class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
    <div class="max-w-2xl">
      <h1 class="text-5xl lg:text-6xl font-headline font-extrabold tracking-tighter mb-4 leading-[0.9] gradient-text">Benchmark</h1>
      <p class="text-on-surface-variant text-lg max-w-lg leading-relaxed">
        Standardized rankings across 10 task scenarios. Every tool scored on availability, installability, responsiveness, freshness, and popularity.
      </p>
    </div>
    <div class="glass-card px-6 py-3 rounded-full flex items-center gap-3">
      <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
      <span class="text-sm text-on-surface uppercase tracking-widest font-bold" id="overview-count">Loading...</span>
    </div>
  </header>

  <!-- Scenario Tabs -->
  <div class="glass-card rounded-xl p-4 mb-8">
    <div class="flex flex-wrap gap-2" id="scenario-tabs">
      <div class="text-on-surface-variant text-sm py-2 px-3">Loading scenarios...</div>
    </div>
  </div>

  <!-- Leaderboard Table -->
  <div class="glass-card rounded-xl overflow-hidden mb-8">
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-outline-variant/20 text-on-surface-variant text-xs uppercase tracking-widest">
            <th class="px-6 py-4 font-semibold">Rank</th>
            <th class="px-6 py-4 font-semibold">Tool Name</th>
            <th class="px-6 py-4 font-semibold text-center">Overall</th>
            <th class="px-6 py-4 font-semibold text-center">Availability</th>
            <th class="px-6 py-4 font-semibold text-center">Install</th>
            <th class="px-6 py-4 font-semibold text-center">Response</th>
            <th class="px-6 py-4 font-semibold text-center">Freshness</th>
            <th class="px-6 py-4 font-semibold text-center">Popularity</th>
            <th class="px-6 py-4 font-semibold text-center">Cost</th>
          </tr>
        </thead>
        <tbody id="leaderboard-body">
          <tr><td colspan="9" class="px-6 py-12 text-center text-on-surface-variant">Select a scenario to view rankings</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Overview Cards -->
  <h2 class="text-2xl font-headline font-bold mb-4 text-on-surface">Scenario Overview</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12" id="overview-cards">
    <div class="glass-card rounded-xl p-6 text-center text-on-surface-variant">Loading overview...</div>
  </div>

  <!-- Methodology -->
  <div class="glass-card rounded-xl p-8">
    <h2 class="text-xl font-headline font-bold mb-4 text-on-surface">Scoring Methodology</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-on-surface-variant leading-relaxed">
      <div>
        <h3 class="text-primary font-semibold mb-2">Dimensions</h3>
        <ul class="space-y-1">
          <li><span class="text-secondary">Availability</span> &mdash; Uptime and health status over 30 days</li>
          <li><span class="text-secondary">Installability</span> &mdash; Package existence, dependency count, env documentation</li>
          <li><span class="text-secondary">Responsiveness</span> &mdash; Call success rate and average response time</li>
          <li><span class="text-secondary">Freshness</span> &mdash; How recently the tool was updated</li>
          <li><span class="text-secondary">Popularity</span> &mdash; Reputation score and total usage calls</li>
          <li><span class="text-secondary">Cost Efficiency</span> &mdash; Pricing model, free tier availability, monthly cost</li>
        </ul>
      </div>
      <div>
        <h3 class="text-primary font-semibold mb-2">How It Works</h3>
        <p class="mb-2">Each scenario defines custom weights for the five dimensions based on what matters most for that task type. For example, <em>Web Search</em> weights availability and responsiveness higher, while <em>File Management</em> emphasizes installability and popularity.</p>
        <p>Benchmarks run daily at UTC 0. Tools are matched to scenarios via capabilities and description keywords, then scored and ranked.</p>
      </div>
    </div>
  </div>
</main>

<script>
const API_BASE = '';
let scenarios = [];
let activeScenarioId = null;

function scoreColor(score) {
  if (score >= 80) return '#62fae3';
  if (score >= 50) return '#f5c542';
  return '#ff6e84';
}

function scoreBg(score) {
  if (score >= 80) return 'bg-teal-400/20';
  if (score >= 50) return 'bg-yellow-400/20';
  return 'bg-red-400/20';
}

function renderScoreCell(score) {
  const color = scoreColor(score);
  return \`
    <div class="flex flex-col items-center gap-1">
      <span class="text-sm font-semibold" style="color:\${color}">\${score}</span>
      <div class="w-12 h-1.5 rounded-full bg-surface-container-highest">
        <div class="score-bar" style="width:\${score}%;background:\${color}"></div>
      </div>
    </div>
  \`;
}

function rankBadge(rank) {
  if (rank === 1) return '<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400/20 text-yellow-400 font-bold text-sm">1</span>';
  if (rank === 2) return '<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/20 text-slate-300 font-bold text-sm">2</span>';
  if (rank === 3) return '<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/20 text-amber-500 font-bold text-sm">3</span>';
  return '<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant font-medium text-sm">' + rank + '</span>';
}

async function loadOverview() {
  try {
    const res = await fetch(API_BASE + '/api/benchmark');
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;
    document.getElementById('overview-count').textContent = data.length + ' SCENARIOS';

    const cardsHtml = data.map(s => \`
      <div class="glass-card rounded-xl p-6 cursor-pointer hover:border-primary/30 transition-all" onclick="selectScenario('\${s.scenario_id}')">
        <h3 class="text-on-surface font-semibold mb-2">\${s.scenario_name}</h3>
        <div class="flex items-baseline gap-2 mb-3">
          <span class="text-3xl font-bold gradient-text">\${s.top_score ?? '—'}</span>
          <span class="text-on-surface-variant text-sm">top score</span>
        </div>
        <div class="flex justify-between text-sm text-on-surface-variant">
          <span>Top: <span class="text-secondary">\${s.top_tool ?? 'N/A'}</span></span>
          <span>\${s.candidates_count} tools</span>
        </div>
      </div>
    \`).join('');
    document.getElementById('overview-cards').innerHTML = cardsHtml || '<div class="glass-card rounded-xl p-6 text-center text-on-surface-variant col-span-3">No benchmark data yet. Run benchmarks via POST /admin/benchmark.</div>';
  } catch (e) {
    console.error('Failed to load overview:', e);
  }
}

async function loadScenarios() {
  try {
    const res = await fetch(API_BASE + '/api/benchmark/scenarios');
    const json = await res.json();
    if (!json.success) return;

    scenarios = json.data;
    const tabsHtml = scenarios.map(s => \`
      <button class="scenario-tab px-4 py-2 rounded-lg text-sm border border-outline-variant/20 text-on-surface-variant"
              data-id="\${s.id}" onclick="selectScenario('\${s.id}')">
        \${s.name}
      </button>
    \`).join('');
    document.getElementById('scenario-tabs').innerHTML = tabsHtml;

    if (scenarios.length > 0) selectScenario(scenarios[0].id);
  } catch (e) {
    console.error('Failed to load scenarios:', e);
  }
}

async function selectScenario(scenarioId) {
  activeScenarioId = scenarioId;

  document.querySelectorAll('.scenario-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.id === scenarioId);
  });

  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-12 text-center text-on-surface-variant">Loading...</td></tr>';

  try {
    const res = await fetch(API_BASE + '/api/benchmark/' + scenarioId);
    const json = await res.json();
    if (!json.success || !json.data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-12 text-center text-on-surface-variant">No results for this scenario yet.</td></tr>';
      return;
    }

    const rowsHtml = json.data.map(entry => {
      const d = entry.dimension_scores;
      return \`
        <tr class="border-b border-outline-variant/10 hover:bg-surface-container-high/40 transition-colors">
          <td class="px-6 py-4">\${rankBadge(entry.rank)}</td>
          <td class="px-6 py-4">
            <a href="/api/services/\${entry.service_id}" class="text-on-surface font-medium hover:text-primary transition-colors">\${entry.service_name}</a>
          </td>
          <td class="px-6 py-4 text-center">
            <span class="text-lg font-bold" style="color:\${scoreColor(entry.overall_score)}">\${entry.overall_score}</span>
          </td>
          <td class="px-6 py-4 text-center">\${renderScoreCell(d.availability)}</td>
          <td class="px-6 py-4 text-center">\${renderScoreCell(d.installability)}</td>
          <td class="px-6 py-4 text-center">\${renderScoreCell(d.responsiveness)}</td>
          <td class="px-6 py-4 text-center">\${renderScoreCell(d.freshness)}</td>
          <td class="px-6 py-4 text-center">\${renderScoreCell(d.popularity)}</td>
          <td class="px-6 py-4 text-center">\${renderScoreCell(d.cost_efficiency)}</td>
        </tr>
      \`;
    }).join('');
    tbody.innerHTML = rowsHtml;
  } catch (e) {
    console.error('Failed to load leaderboard:', e);
    tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-12 text-center text-error">Failed to load data</td></tr>';
  }
}

loadScenarios();
loadOverview();
</script>
</body></html>`;
