// Apply a saved light/dark theme before the page paints, to avoid a flash.
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
// The Sketchbook screen layout replaces the old one only when scripts run (crawlers without JS get the full old layout).
document.documentElement.classList.add("has-js");
