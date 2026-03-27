// Landing page HTML — served at GET /
// Design: Disvr Ethereal theme from Stitch, adapted with real product content

export const landingPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link rel="icon" type="image/png" href="/favicon.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<title>Disvr — The Ranking Engine for AI Agent Tools</title>
<meta name="description" content="Quality intelligence for the MCP ecosystem. Index 500+ tools, rank by real usage, find the best one in one API call."/>
<meta property="og:title" content="Disvr — The Ranking Engine for AI Agent Tools"/>
<meta property="og:description" content="Quality intelligence for the MCP ecosystem. Index 500+ tools, rank by real usage, find the best one in one API call."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://www.disvr.top"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Disvr — The Ranking Engine for AI Agent Tools"/>
<meta name="twitter:description" content="Quality intelligence for the MCP ecosystem. Index 500+ tools, rank by real usage, find the best one in one API call."/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<script>
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#b79fff",
        "primary-dim": "#a88cfb",
        "secondary": "#62fae3",
        "secondary-dim": "#50ebd5",
        "tertiary": "#ff86c3",
        "error": "#ff6e84",
        "background": "#060e20",
        "on-background": "#dee5ff",
        "on-surface": "#dee5ff",
        "on-surface-variant": "#a3aac4",
        "surface": "#060e20",
        "surface-container": "#0f1930",
        "surface-container-low": "#091328",
        "surface-container-high": "#141f38",
        "surface-container-highest": "#192540",
        "surface-container-lowest": "#000000",
        "surface-variant": "#192540",
        "outline": "#6d758c",
        "outline-variant": "#40485d",
        "on-primary-fixed": "#000000",
      },
      fontFamily: {
        "headline": ["Manrope"],
        "body": ["Inter"],
      },
      borderRadius: {"DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px"},
    },
  },
}
</script>
<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.glass-card {
  background: rgba(25, 37, 64, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(64, 72, 93, 0.15);
}
.ethereal-gradient {
  background: linear-gradient(135deg, #b79fff 0%, #62fae3 100%);
}
.text-glow {
  text-shadow: 0 0 20px rgba(183, 159, 255, 0.3);
}
</style>
</head>
<body class="bg-background text-on-background font-body selection:bg-primary/30 antialiased overflow-x-hidden">

<!-- Nav -->
<nav class="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-slate-950/60 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
  <a href="/" class="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent font-headline"><img src="/favicon.png" alt="Disvr" class="w-8 h-8"/>Disvr</a>
  <div class="hidden md:flex items-center gap-6">
    <a class="text-teal-400 border-b-2 border-teal-400 pb-1" href="/">Home</a>
    <a class="text-slate-300 hover:text-slate-100 transition-colors" href="/registry">Registry</a>
    <a class="text-slate-300 hover:text-slate-100 transition-colors" href="/explorer">Explorer</a>
    <a class="text-slate-300 hover:text-slate-100 transition-colors" href="/analytics">Analytics</a>
    <a class="text-slate-300 hover:text-slate-100 transition-colors" href="/keys">Get API Key</a>
    <a class="text-slate-300 hover:text-slate-100 transition-colors" href="https://github.com/Svanik-yan/disvr" target="_blank">GitHub</a>
  </div>
  <div class="flex items-center gap-4">
    <a href="https://api.disvr.top/health" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-secondary text-sm font-medium hover:bg-white/10 transition-all">
      <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
      API Status
    </a>
    <a href="/keys" class="ethereal-gradient text-on-primary-fixed px-6 py-2 rounded-full font-bold text-sm hover:shadow-[0_0_20px_rgba(183,159,255,0.4)] transition-all active:scale-95">
      Get API Key
    </a>
  </div>
</nav>

<!-- Hero -->
<main class="relative pt-32 pb-20 px-6 min-h-screen flex flex-col items-center overflow-hidden">
  <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-dim/10 blur-[120px] -z-10"></div>
  <div class="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-secondary-dim/10 blur-[120px] -z-10"></div>

  <div class="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
    <div class="lg:col-span-7 space-y-8">
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-secondary font-medium text-sm tracking-widest uppercase">
        <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
        Live &middot; <span id="hero-count">...</span> Services Indexed
      </div>

      <h1 class="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter leading-none text-glow">
        The <span class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Ranking Engine</span> for AI Agent Tools
      </h1>

      <p class="text-on-surface-variant text-xl md:text-2xl max-w-2xl font-light leading-relaxed">
        Quality intelligence for the MCP ecosystem. We index 500+ tools, rank them by real usage signals, and help your agent find the best one in one API call.
      </p>

      <div class="flex flex-wrap gap-6 pt-4">
        <a href="/keys" class="ethereal-gradient text-on-primary-fixed px-10 py-4 rounded-full font-bold text-lg hover:shadow-[0_0_30px_rgba(183,159,255,0.4)] transition-all active:scale-95">
          Get Free API Key
        </a>
        <a href="https://github.com/Svanik-yan/disvr" target="_blank" class="glass-card px-10 py-4 rounded-full font-bold text-lg text-on-surface hover:bg-white/10 transition-all border border-white/10">
          View on GitHub
        </a>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="lg:col-span-5 relative">
      <div class="glass-card p-8 rounded-xl relative z-20 translate-x-4 -rotate-2">
        <div class="flex items-center justify-between mb-6">
          <span class="material-symbols-outlined text-secondary text-3xl">search</span>
          <div class="px-3 py-1 bg-secondary/10 rounded-full text-secondary text-xs font-bold">LIVE QUERY</div>
        </div>
        <div class="space-y-4">
          <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <div class="h-full bg-secondary w-3/4 shadow-[0_0_10px_rgba(98,250,227,0.5)]"></div>
          </div>
          <p class="font-headline font-bold text-xl">"translate Chinese contract to Thai"</p>
          <p class="text-on-surface-variant text-sm">Top 3 ranked by cost_per_success, retry_rate, latency &rarr; best value wins.</p>
        </div>
      </div>

      <div class="absolute top-20 -left-10 glass-card p-6 rounded-xl z-10 -translate-x-8 translate-y-8 rotate-3 w-64">
        <div class="flex items-center gap-3 mb-4">
          <span class="material-symbols-outlined text-primary">speed</span>
          <span class="font-bold">Value Score</span>
        </div>
        <div class="text-3xl font-black text-primary">4-Dim</div>
        <div class="text-xs text-on-surface-variant mt-2">Semantic + Quality + Cost + Reliability</div>
      </div>

      <div class="absolute -bottom-10 right-4 glass-card p-6 rounded-xl z-30 translate-y-4 -rotate-1 w-72">
        <div class="flex items-center gap-3 mb-2">
          <span class="material-symbols-outlined text-tertiary">loop</span>
          <span class="font-bold">Closed-Loop Feedback</span>
        </div>
        <div class="flex gap-1">
          <div class="w-full h-1 bg-secondary rounded-full"></div>
          <div class="w-full h-1 bg-secondary rounded-full"></div>
          <div class="w-full h-1 bg-secondary rounded-full"></div>
          <div class="w-full h-1 bg-white/10 rounded-full"></div>
        </div>
        <div class="text-xs text-on-surface-variant mt-2">Agents report results &rarr; scores improve over time</div>
      </div>
    </div>
  </div>
</main>

<!-- Why Disvr -->
<section id="why" class="py-32 px-6 bg-surface-container-low relative">
  <div class="max-w-7xl mx-auto">
    <div class="mb-20 text-center lg:text-left">
      <h2 class="font-headline text-5xl font-extrabold mb-6">Why Disvr?</h2>
      <p class="text-on-surface-variant text-xl max-w-2xl">Not another directory. A <strong class="text-on-surface">decision engine</strong> that helps agents spend smarter.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
      <!-- Large card: Spend Intelligence -->
      <div class="md:col-span-8 glass-card p-10 rounded-xl relative overflow-hidden flex flex-col justify-end min-h-[280px]">
        <span class="material-symbols-outlined text-5xl text-primary mb-6">paid</span>
        <h3 class="font-headline text-3xl font-bold mb-4">Spend Intelligence, Not Just Search</h3>
        <p class="text-on-surface-variant text-lg max-w-lg">Traditional directories return a list. Disvr returns a <strong class="text-on-surface">ranked recommendation</strong> &mdash; factoring in cost per success, retry rate, success rate, and latency. Your agent picks the best tool, not just the first one.</p>
      </div>

      <!-- Small card: MCP Native -->
      <div class="md:col-span-4 bg-surface-container p-10 rounded-xl flex flex-col justify-center border border-white/5 min-h-[280px]">
        <span class="material-symbols-outlined text-4xl text-secondary mb-6">hub</span>
        <h3 class="font-headline text-2xl font-bold mb-4">MCP Native</h3>
        <p class="text-on-surface-variant">Works as a Streamable HTTP MCP Server. Claude, GPT, and any MCP-compatible agent can call <code class="text-secondary text-sm">discover_services</code> directly.</p>
      </div>

      <!-- Small card: Closed-Loop Feedback -->
      <div class="md:col-span-4 bg-surface-container p-10 rounded-xl flex flex-col justify-center border border-white/5 min-h-[280px]">
        <span class="material-symbols-outlined text-4xl text-tertiary mb-6">autorenew</span>
        <h3 class="font-headline text-2xl font-bold mb-4">Closed-Loop Feedback</h3>
        <p class="text-on-surface-variant">Agents report call results back. Every success, failure, and latency measurement feeds into the ranking algorithm. The more agents use Disvr, the smarter it gets.</p>
      </div>

      <!-- Large card: Multi-Source Crawling -->
      <div class="md:col-span-8 glass-card p-10 rounded-xl relative overflow-hidden flex flex-col justify-end min-h-[280px]">
        <div class="flex items-center gap-12">
          <div>
            <span class="material-symbols-outlined text-4xl text-secondary mb-6">cloud_sync</span>
            <h3 class="font-headline text-2xl font-bold mb-4">Multi-Source Crawling</h3>
            <p class="text-on-surface-variant text-lg">Hourly Cron crawls pull from Smithery (16,000+ servers), with MCP Official Registry and more sources coming. Vector embeddings + FTS5 dual-path search ensures nothing is missed.</p>
          </div>
          <div class="hidden sm:block">
            <div class="w-48 h-48 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center relative">
              <div class="w-32 h-32 rounded-full border-2 border-primary/30 flex items-center justify-center">
                <div class="w-16 h-16 rounded-full ethereal-gradient animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Integration Steps -->
<section id="integration" class="py-32 px-6">
  <div class="max-w-7xl mx-auto">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
      <div class="space-y-12">
        <h2 class="font-headline text-5xl font-extrabold tracking-tight">Get Started in 3 Steps</h2>
        <div class="space-y-8">
          <div class="flex gap-6 group">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-surface-container flex items-center justify-center border border-white/10 group-hover:border-primary transition-colors">
              <span class="font-headline font-black text-primary">01</span>
            </div>
            <div>
              <h4 class="font-headline text-xl font-bold mb-2">Add MCP Server</h4>
              <p class="text-on-surface-variant">Add Disvr to your <code class="text-secondary text-sm">.mcp.json</code> and your AI agent gains the <code class="text-secondary text-sm">discover_services</code> tool instantly. Works with Claude Code, Cursor, and any MCP client.</p>
            </div>
          </div>

          <div class="flex gap-6 group">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-surface-container flex items-center justify-center border border-white/10 group-hover:border-secondary transition-colors">
              <span class="font-headline font-black text-secondary">02</span>
            </div>
            <div>
              <h4 class="font-headline text-xl font-bold mb-2">Query via REST API</h4>
              <p class="text-on-surface-variant">Or call <code class="text-secondary text-sm">POST /discover</code> directly with your need. Get back top 3 recommendations ranked by value score, not just relevance.</p>
            </div>
          </div>

          <div class="flex gap-6 group">
            <div class="flex-shrink-0 w-12 h-12 rounded-full bg-surface-container flex items-center justify-center border border-white/10 group-hover:border-tertiary transition-colors">
              <span class="font-headline font-black text-tertiary">03</span>
            </div>
            <div>
              <h4 class="font-headline text-xl font-bold mb-2">Report Results</h4>
              <p class="text-on-surface-variant">After using a tool, report success/failure via <code class="text-secondary text-sm">POST /report</code>. This closes the feedback loop and makes future recommendations better for everyone.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Code Example -->
      <div class="glass-card rounded-xl p-2 relative">
        <div class="bg-surface-container-lowest rounded-lg p-8 font-mono text-sm leading-relaxed overflow-hidden border border-white/5">
          <div class="flex gap-2 mb-6">
            <div class="w-3 h-3 rounded-full bg-error/50"></div>
            <div class="w-3 h-3 rounded-full bg-secondary/50"></div>
            <div class="w-3 h-3 rounded-full bg-primary/50"></div>
          </div>
          <div class="space-y-2 overflow-x-auto">
            <p class="text-slate-500">// .mcp.json &mdash; one line to connect</p>
            <p>{ <span class="text-primary">"mcpServers"</span>: { <span class="text-primary">"disvr"</span>: {</p>
            <p class="pl-4"><span class="text-primary">"type"</span>: <span class="text-secondary">"url"</span>,</p>
            <p class="pl-4"><span class="text-primary">"url"</span>: <span class="text-secondary">"https://api.disvr.top/mcp"</span></p>
            <p>}}}</p>
            <br/>
            <p class="text-slate-500">// Or use the TypeScript SDK</p>
            <p><span class="text-primary">npm</span> install <span class="text-secondary">@sylar_yan/disvr</span></p>
            <br/>
            <p><span class="text-primary">import</span> { <span class="text-secondary">Disvr</span> } <span class="text-primary">from</span> <span class="text-secondary">"@sylar_yan/disvr"</span>;</p>
            <p><span class="text-primary">const</span> client = <span class="text-primary">new</span> <span class="text-secondary">Disvr</span>(<span class="text-secondary">"YOUR_KEY"</span>);</p>
            <p><span class="text-primary">const</span> result = <span class="text-primary">await</span> client.<span class="text-secondary">discover</span>({</p>
            <p class="pl-4"><span class="text-primary">need</span>: <span class="text-secondary">"translate Chinese legal contract to Thai"</span></p>
            <p>});</p>
            <br/>
            <p class="text-slate-500">// Response: Top 3 ranked by value_score</p>
            <p>{ <span class="text-primary">"recommendations"</span>: [</p>
            <p class="pl-4">{ <span class="text-primary">"service"</span>: <span class="text-secondary">"deepl-mcp-server"</span>,</p>
            <p class="pl-6"><span class="text-primary">"value_score"</span>: <span class="text-tertiary">0.92</span>,</p>
            <p class="pl-6"><span class="text-primary">"reason"</span>: <span class="text-secondary">"Best cost/quality ratio for legal docs"</span> }</p>
            <p class="pl-4">...</p>
            <p>]}</p>
          </div>
          <div class="absolute bottom-4 right-8 opacity-20 select-none pointer-events-none">
            <span class="material-symbols-outlined text-8xl">code</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section id="cta" class="py-32 px-6">
  <div class="max-w-5xl mx-auto glass-card rounded-xl p-16 text-center relative overflow-hidden">
    <div class="absolute inset-0 ethereal-gradient opacity-5 -z-10"></div>
    <div class="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 blur-[80px] rounded-full"></div>
    <div class="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/20 blur-[80px] rounded-full"></div>

    <h2 class="font-headline text-5xl font-extrabold mb-8">Stop guessing. Start discovering.</h2>
    <p class="text-on-surface-variant text-xl mb-12 max-w-2xl mx-auto font-light">
      Add Disvr as your agent's MCP Server and let it find the best tools automatically. Free tier available &mdash; no credit card required.
    </p>
    <div class="flex flex-col sm:flex-row justify-center gap-6">
      <a href="/keys" class="ethereal-gradient text-on-primary-fixed px-12 py-5 rounded-full font-bold text-xl hover:shadow-[0_0_40px_rgba(98,250,227,0.3)] transition-all active:scale-95">
        Get Free API Key
      </a>
      <a href="/explorer" class="px-12 py-5 rounded-full font-bold text-xl border border-white/10 hover:bg-white/5 transition-all">
        Try Explorer
      </a>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="py-20 px-8 border-t border-white/5 bg-surface-container-low">
  <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
    <div class="col-span-1 md:col-span-2">
      <div class="text-2xl font-bold bg-gradient-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent mb-6 font-headline">Disvr</div>
      <p class="text-on-surface-variant max-w-sm mb-8">Quality intelligence for the MCP ecosystem.</p>
      <div class="flex gap-4">
        <a class="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-primary/20 transition-colors" href="https://github.com/Svanik-yan/disvr" target="_blank" title="GitHub">
          <span class="material-symbols-outlined text-sm">terminal</span>
        </a>
        <a class="w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-primary/20 transition-colors" href="mailto:yanchen330@gmail.com" title="Email">
          <span class="material-symbols-outlined text-sm">alternate_email</span>
        </a>
      </div>
    </div>
    <div>
      <h5 class="font-headline font-bold mb-6">Product</h5>
      <ul class="space-y-4 text-on-surface-variant">
        <li><a class="hover:text-primary transition-colors" href="#why">Why Disvr</a></li>
        <li><a class="hover:text-primary transition-colors" href="#integration">Integration</a></li>
        <li><a class="hover:text-primary transition-colors" href="https://api.disvr.top/health" target="_blank">API Status</a></li>
      </ul>
    </div>
    <div>
      <h5 class="font-headline font-bold mb-6">Resources</h5>
      <ul class="space-y-4 text-on-surface-variant">
        <li><a class="hover:text-secondary transition-colors" href="https://github.com/Svanik-yan/disvr" target="_blank">GitHub</a></li>
        <li><a class="hover:text-secondary transition-colors" href="https://api.disvr.top/mcp" target="_blank">MCP Server</a></li>
        <li><a class="hover:text-secondary transition-colors" href="https://api.disvr.top/health" target="_blank">Health Check</a></li>
      </ul>
    </div>
  </div>
  <div class="max-w-7xl mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
    <p>&copy; 2026 Disvr. All rights reserved.</p>
    <div class="flex gap-8">
      <a class="hover:text-on-surface transition-colors" href="#">Privacy Policy</a>
      <a class="hover:text-on-surface transition-colors" href="#">Terms of Service</a>
      <a class="hover:text-on-surface transition-colors" href="https://api.disvr.top/health" target="_blank">System Status</a>
    </div>
  </div>
</footer>

<script>
fetch('/health').then(r=>r.json()).then(d=>{
  const el=document.getElementById('hero-count');
  if(el&&d.services_indexed) el.textContent=d.services_indexed+'+';
}).catch(()=>{
  const el=document.getElementById('hero-count');
  if(el) el.textContent='390+';
});
</script>
</body>
</html>`;
