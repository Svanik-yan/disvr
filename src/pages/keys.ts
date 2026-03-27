// API Key Registration page — served at GET /keys
export const keysPageHtml = `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link rel="icon" type="image/png" href="/favicon.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<title>Disvr — Get API Key</title>
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
        <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/explorer">Explorer</a>
        <a class="text-slate-400 hover:text-slate-200 transition-colors" href="/analytics">Analytics</a>
        <a class="text-teal-300 border-b-2 border-teal-300 pb-1" href="/keys">Get API Key</a>
      </nav>
    </div>
    <a href="https://api.disvr.top/health" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel text-secondary text-sm font-medium border border-white/10">
      <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> API Live
    </a>
  </div>
</header>

<!-- Main Content -->
<main class="pt-28 px-8 pb-12 max-w-4xl mx-auto">
  <section class="mb-12">
    <h1 class="font-headline text-5xl lg:text-7xl font-extrabold tracking-tighter text-on-surface mb-6 leading-none">
      Get Your <span class="gradient-text">API Key</span>
    </h1>
    <p class="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
      Register to get a free API key. Use it to access the Disvr discovery API from your agents.
    </p>
  </section>

  <!-- Registration Form -->
  <div id="register-section" class="glass-panel p-8 rounded-xl gradient-border mb-8">
    <h3 class="font-headline text-xl font-bold mb-6">Register</h3>
    <form id="register-form" onsubmit="handleRegister(event)" class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-on-surface-variant mb-2">Email Address</label>
        <input id="email-input" type="email" required
          class="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
          placeholder="you@example.com"/>
      </div>
      <div id="error-msg" class="hidden text-error text-sm"></div>
      <button type="submit" id="submit-btn"
        class="bg-gradient-to-r from-primary to-secondary text-surface-container-lowest font-bold px-8 py-3 rounded-full hover:shadow-[0_0_25px_rgba(98,250,227,0.3)] transition-all active:scale-95">
        Generate API Key
      </button>
    </form>
  </div>

  <!-- Key Display (hidden by default) -->
  <div id="key-section" class="hidden glass-panel p-8 rounded-xl gradient-border mb-8">
    <div class="flex items-center gap-3 mb-6">
      <span class="material-symbols-outlined text-secondary text-3xl">check_circle</span>
      <h3 class="font-headline text-xl font-bold text-secondary">API Key Created!</h3>
    </div>
    <div class="bg-surface-container-high rounded-lg p-4 mb-4">
      <div class="flex items-center justify-between gap-4">
        <code id="api-key-display" class="text-primary font-mono text-sm break-all select-all"></code>
        <button onclick="copyKey()" class="shrink-0 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm hover:bg-primary/30 transition-colors">
          <span class="material-symbols-outlined text-sm align-middle">content_copy</span> Copy
        </button>
      </div>
    </div>
    <div class="bg-error/10 border border-error/20 rounded-lg p-4 mb-6">
      <p class="text-error text-sm font-medium">
        <span class="material-symbols-outlined text-sm align-middle">warning</span>
        Save this key now! It will not be shown again.
      </p>
    </div>

    <h4 class="font-headline font-bold mb-3">Quick Start</h4>
    <div class="bg-surface-container-high rounded-lg p-4 overflow-x-auto">
      <pre class="text-sm text-on-surface-variant"><code>curl -X POST https://api.disvr.top/discover \\
  -H "Authorization: Bearer <span id="key-in-curl" class="text-primary">YOUR_KEY</span>" \\
  -H "Content-Type: application/json" \\
  -d '{"need": "translate Chinese to English"}'</code></pre>
    </div>
  </div>

  <!-- What You Get -->
  <div class="glass-panel p-8 rounded-xl gradient-border">
    <h3 class="font-headline text-xl font-bold mb-2">Everything is Free</h3>
    <p class="text-on-surface-variant text-sm mb-6">Disvr is completely free during the open beta. No credit card, no limits on features.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="flex items-center gap-3 bg-surface-container-high rounded-lg p-4">
        <span class="material-symbols-outlined text-secondary">search</span>
        <div><div class="font-medium text-sm">Semantic Search</div><div class="text-xs text-on-surface-variant">AI-powered tool discovery</div></div>
      </div>
      <div class="flex items-center gap-3 bg-surface-container-high rounded-lg p-4">
        <span class="material-symbols-outlined text-secondary">recommend</span>
        <div><div class="font-medium text-sm">Top 3 Recommendations</div><div class="text-xs text-on-surface-variant">Ranked by value score</div></div>
      </div>
      <div class="flex items-center gap-3 bg-surface-container-high rounded-lg p-4">
        <span class="material-symbols-outlined text-secondary">paid</span>
        <div><div class="font-medium text-sm">Spend Intelligence</div><div class="text-xs text-on-surface-variant">Cost per success, retry rates</div></div>
      </div>
      <div class="flex items-center gap-3 bg-surface-container-high rounded-lg p-4">
        <span class="material-symbols-outlined text-secondary">hub</span>
        <div><div class="font-medium text-sm">MCP Server Access</div><div class="text-xs text-on-surface-variant">Direct agent integration</div></div>
      </div>
      <div class="flex items-center gap-3 bg-surface-container-high rounded-lg p-4">
        <span class="material-symbols-outlined text-secondary">speed</span>
        <div><div class="font-medium text-sm">1,000 Requests / Day</div><div class="text-xs text-on-surface-variant">Generous daily limit</div></div>
      </div>
      <div class="flex items-center gap-3 bg-surface-container-high rounded-lg p-4">
        <span class="material-symbols-outlined text-secondary">assessment</span>
        <div><div class="font-medium text-sm">Call Reports</div><div class="text-xs text-on-surface-variant">Feedback loop for better recs</div></div>
      </div>
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
async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('email-input').value.trim();
  const errorEl = document.getElementById('error-msg');
  const btn = document.getElementById('submit-btn');

  if (!email) return;

  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || 'Registration failed.';
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Generate API Key';
      return;
    }

    // Show the key
    document.getElementById('api-key-display').textContent = data.api_key;
    document.getElementById('key-in-curl').textContent = data.api_key;
    document.getElementById('register-section').classList.add('hidden');
    document.getElementById('key-section').classList.remove('hidden');
  } catch (err) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Generate API Key';
  }
}

function copyKey() {
  const key = document.getElementById('api-key-display').textContent;
  navigator.clipboard.writeText(key).then(() => {
    const btn = event.target.closest('button');
    btn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle">done</span> Copied!';
    setTimeout(() => {
      btn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle">content_copy</span> Copy';
    }, 2000);
  });
}
</script>
</body></html>`;
