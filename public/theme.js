// Apply a saved light/dark theme before the page paints, to avoid a flash.
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
