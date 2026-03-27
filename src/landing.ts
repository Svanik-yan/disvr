// Landing page HTML — served at GET /
// Design: Disvr Ethereal theme from Stitch, adapted with real product content

export const landingPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Disvr — Your Agent's Tool Search Engine</title>
<meta name="description" content="One API call. Any MCP server. No vendor lock-in. Disvr helps AI agents find the right tool from 900+ indexed services. Free REST API + MCP Server."/>
<meta property="og:title" content="Disvr — Your Agent's Tool Search Engine"/>
<meta property="og:description" content="One API call. Any MCP server. No vendor lock-in. 900+ services indexed from Smithery, GitHub, and more."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://www.disvr.top"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Disvr — Your Agent's Tool Search Engine"/>
<meta name="twitter:description" content="One API call. Any MCP server. No vendor lock-in."/>
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
.demo-result-enter {
  animation: fadeSlideIn 0.2s ease-out both;
}
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
</head>
<body class="bg-background text-on-background font-body selection:bg-primary/30 antialiased overflow-x-hidden">

<!-- Nav -->
<nav class="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-slate-950/60 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
  <a href="/" class="text-2xl font-bold bg-gradient-to-r from-violet-400 to-teal-400 bg-clip-text text-transparent font-headline">Disvr</a>
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
        Your agent's <span class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">tool search engine</span>
      </h1>

      <p class="text-on-surface-variant text-xl md:text-2xl max-w-2xl font-light leading-relaxed">
        One API call. Any MCP server. <strong class="text-on-surface">No vendor lock-in.</strong><br/>
        <span class="text-base">Works with Claude, GPT, Gemini, LLaMA, and any LLM.</span>
      </p>

      <!-- Live Demo Search -->
      <div class="glass-card p-2 rounded-full max-w-xl w-full flex items-center mt-2 border border-white/10">
        <div class="flex-1 flex items-center px-5">
          <span class="material-symbols-outlined text-secondary mr-3">search</span>
          <input id="hero-search" class="w-full bg-transparent border-none focus:ring-0 text-on-surface text-lg placeholder:text-on-surface-variant/40 py-3" placeholder="Try: I need a weather API..." type="text"/>
        </div>
        <button onclick="heroSearch()" class="shrink-0 ethereal-gradient text-on-primary-fixed font-bold px-8 py-3 rounded-full hover:shadow-[0_0_25px_rgba(98,250,227,0.3)] transition-all active:scale-95">
          Discover
        </button>
      </div>
      <div id="hero-results" class="hidden max-w-xl w-full mt-4 space-y-3"></div>
      <div class="flex flex-wrap gap-4 pt-2">
        <a href="/explorer" class="text-secondary text-sm hover:underline">Full Explorer with filters &rarr;</a>
        <a href="/keys" class="text-on-surface-variant text-sm hover:underline">Get API Key</a>
        <a href="https://github.com/Svanik-yan/disvr" target="_blank" class="text-on-surface-variant text-sm hover:underline">GitHub</a>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="lg:col-span-5 space-y-6">
      <div class="glass-card p-8 rounded-xl">
        <div class="flex items-center justify-between mb-6">
          <span class="material-symbols-outlined text-secondary text-3xl">terminal</span>
          <div class="px-3 py-1 bg-secondary/10 rounded-full text-secondary text-xs font-bold">QUICK START</div>
        </div>
        <div class="bg-surface-container-lowest rounded-lg p-5 font-mono text-sm leading-relaxed border border-white/5">
          <p class="text-slate-500">// .mcp.json &mdash; one line to connect</p>
          <p>{ <span class="text-primary">"mcpServers"</span>: {</p>
          <p class="pl-2"><span class="text-primary">"disvr"</span>: {</p>
          <p class="pl-4"><span class="text-primary">"type"</span>: <span class="text-secondary">"url"</span>,</p>
          <p class="pl-4"><span class="text-primary">"url"</span>: <span class="text-secondary">"https://api.disvr.top/mcp"</span></p>
          <p class="pl-2">}</p>
          <p>}}</p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div class="glass-card p-5 rounded-xl text-center">
          <div class="text-2xl font-black text-primary" id="stat-services">...</div>
          <div class="text-xs text-on-surface-variant mt-1">Services</div>
        </div>
        <div class="glass-card p-5 rounded-xl text-center">
          <div class="text-2xl font-black text-secondary">4-Dim</div>
          <div class="text-xs text-on-surface-variant mt-1">Ranking</div>
        </div>
        <div class="glass-card p-5 rounded-xl text-center">
          <div class="text-2xl font-black text-tertiary">Free</div>
          <div class="text-xs text-on-surface-variant mt-1">1K req/day</div>
        </div>
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
            <p class="text-on-surface-variant text-lg">Crawls Smithery and GitHub awesome-mcp-servers hourly. <span id="hero-count2">900+</span> services indexed and growing. Vector embeddings + FTS5 dual-path search ensures nothing is missed.</p>
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
            <p class="text-slate-500">// Or use the REST API directly</p>
            <p><span class="text-primary">curl</span> -X POST https://api.disvr.top/discover \\</p>
            <p class="pl-4">-H <span class="text-secondary">"Authorization: Bearer YOUR_KEY"</span> \\</p>
            <p class="pl-4">-H <span class="text-secondary">"Content-Type: application/json"</span> \\</p>
            <p class="pl-4">-d <span class="text-secondary">'{"need": "translate Chinese legal contract to Thai"}'</span></p>
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
      <p class="text-on-surface-variant max-w-sm mb-8">Your agent's tool search engine. One API call to find any tool it needs. Cross-platform, no vendor lock-in.</p>
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
  if(d.services_indexed){
    const el=document.getElementById('hero-count');if(el)el.textContent=d.services_indexed+'+';
    const el2=document.getElementById('hero-count2');if(el2)el2.textContent=d.services_indexed+'+';
    const el3=document.getElementById('stat-services');if(el3)el3.textContent=d.services_indexed+'+';
  }
}).catch(()=>{
  const fallback='900+';
  ['hero-count','hero-count2','stat-services'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=fallback;});
});

// Live Demo Search
let searchTimer=null;
const heroInput=document.getElementById('hero-search');
const heroResults=document.getElementById('hero-results');

function heroSearch(){
  const q=(heroInput?.value||'').trim();
  if(!q||q.length<2){heroResults.classList.add('hidden');heroResults.innerHTML='';return;}
  heroResults.innerHTML='<div class="text-on-surface-variant text-sm animate-pulse">Searching...</div>';
  heroResults.classList.remove('hidden');
  fetch('/api/services?search='+encodeURIComponent(q)+'&limit=5')
    .then(r=>r.json())
    .then(d=>{
      if(!d.services||d.services.length===0){
        heroResults.innerHTML='<div class="glass-card p-4 rounded-xl text-on-surface-variant text-sm">No services found. Try a different keyword.</div>';
        return;
      }
      heroResults.innerHTML=d.services.map((s,i)=>\`
        <div class="glass-card p-4 rounded-xl demo-result-enter" style="animation-delay:\${i*60}ms">
          <div class="flex items-center justify-between mb-1">
            <span class="font-headline font-bold text-on-surface">\${esc(s.name)}</span>
            \${s.reputation_score!=null?'<span class="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">'+s.reputation_score.toFixed(1)+'</span>':''}
          </div>
          <p class="text-on-surface-variant text-sm line-clamp-2">\${esc((s.description||'').slice(0,120))}</p>
          <div class="flex gap-3 mt-2 text-xs text-on-surface-variant/60">
            \${s.platform?'<span>'+esc(s.platform)+'</span>':''}
            \${s.total_calls?'<span>'+s.total_calls+' calls</span>':''}
          </div>
        </div>
      \`).join('')+'<div class="text-center pt-2"><a href="/explorer" class="text-secondary text-sm hover:underline">See all '+d.total+' results in Explorer &rarr;</a></div>';
    })
    .catch(()=>{
      heroResults.innerHTML='<div class="glass-card p-4 rounded-xl text-on-surface-variant text-sm">Search failed. Try again.</div>';
    });
}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

heroInput?.addEventListener('keydown',function(e){if(e.key==='Enter')heroSearch();});
heroInput?.addEventListener('input',function(){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(heroSearch,400);
});
</script>
</body>
</html>`;
