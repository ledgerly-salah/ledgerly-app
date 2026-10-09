const CACHE='ledgerly-shell-3.1.0-20261009-integrity-r3';
const SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./logo.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./releases/20261009-integrity-r3/app.3.1.0.js",
  "./releases/20261009-integrity-r3/crypto.3.1.0.js",
  "./releases/20261009-integrity-r3/financial-action-guard.3.1.1.js",
  "./releases/20261009-integrity-r3/i18n.3.1.0.js",
  "./releases/20261009-integrity-r3/infographic-report-v1.3.1.1.js",
  "./releases/20261009-integrity-r3/ledger-core.3.1.0.js",
  "./releases/20261009-integrity-r3/migrations.3.1.0.js",
  "./releases/20261009-integrity-r3/pdf-arabic-forms.3.1.1.js",
  "./releases/20261009-integrity-r3/pdf-bidi.3.1.1.js",
  "./releases/20261009-integrity-r3/pdf-font-data.3.1.1.js",
  "./releases/20261009-integrity-r3/pdf-report-v2.3.1.1.js",
  "./releases/20261009-integrity-r3/pdf-unicode.3.1.1.js",
  "./releases/20261009-integrity-r3/pdf.3.1.0.js",
  "./releases/20261009-integrity-r3/release.3.1.1.js",
  "./releases/20261009-integrity-r3/report-tools.3.1.1.js",
  "./releases/20261009-integrity-r3/security-tools.3.1.1.js",
  "./releases/20261009-integrity-r3/storage.3.1.0.js",
  "./releases/20261009-integrity-r3/styles.3.1.0.css",
  "./releases/20261009-integrity-r3/ui-accessibility.3.1.1.js",
  "./releases/20261009-integrity-r3/visual-report-v1.3.1.1.js"
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ledgerly-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.includes('/api/')||url.pathname.includes('/auth/'))return;
 if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(cache=>cache.match('./index.html')).then(cached=>cached||fetch(event.request)));return;}
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request)));
});
