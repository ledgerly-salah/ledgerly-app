const CACHE='ledgerly-shell-3.1.0-20261019-readiness-r16';
const SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./logo.svg",
  "./branding/icon-navy.svg",
  "./releases/20261019-readiness-r16/pdf-preview/pdf.mjs",
  "./releases/20261019-readiness-r16/pdf-preview/resources.js",
  "./releases/20261019-readiness-r16/pdf-preview/pdf.worker.mjs",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./releases/20261019-readiness-r16/session.3.1.1.js",
  "./releases/20261019-readiness-r16/app.3.1.0.js",
  "./releases/20261019-readiness-r16/crypto.3.1.0.js",
  "./releases/20261019-readiness-r16/financial-action-guard.3.1.1.js",
  "./releases/20261019-readiness-r16/i18n.3.1.0.js",
  "./releases/20261019-readiness-r16/infographic-report-v1.3.1.1.js",
  "./releases/20261019-readiness-r16/ledger-core.3.1.0.js",
  "./releases/20261019-readiness-r16/migrations.3.1.0.js",
  "./releases/20261019-readiness-r16/pdf-arabic-forms.3.1.1.js",
  "./releases/20261019-readiness-r16/pdf-bidi.3.1.1.js",
  "./releases/20261019-readiness-r16/pdf-font-data.3.1.1.js",
  "./releases/20261019-readiness-r16/pdf-report-v2.3.1.1.js",
  "./releases/20261019-readiness-r16/pdf-unicode.3.1.1.js",
  "./releases/20261019-readiness-r16/pdf.3.1.0.js",
  "./releases/20261019-readiness-r16/release.3.1.1.js",
  "./releases/20261019-readiness-r16/report-tools.3.1.1.js",
  "./releases/20261019-readiness-r16/security-tools.3.1.1.js",
  "./releases/20261019-readiness-r16/storage.3.1.0.js",
  "./releases/20261019-readiness-r16/styles.3.1.0.css",
  "./releases/20261019-readiness-r16/ui-accessibility.3.1.1.js",
  "./releases/20261019-readiness-r16/visual-report-v1.3.1.1.js"
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
async function deleteOldShells(){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('ledgerly-shell-')&&k!==CACHE).map(k=>caches.delete(k)));}
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
 // Only a sole current-build window can prove no older window still needs its assets.
 if(event.data?.type==='CLEANUP_OLD_SHELLS'&&event.data.build==='20261019-readiness-r16')event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  if(windows.length===1&&windows[0].id===event.source?.id)await deleteOldShells();
 })());
});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 if(!windows.length)await deleteOldShells();
 await self.clients.claim();
})());});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname.includes('/api/')||url.pathname.includes('/auth/'))return;
 if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(cache=>cache.match('./index.html')).then(cached=>cached||fetch(event.request)));return;}
 const versioned=url.pathname.includes('/releases/');
 event.respondWith((versioned?caches.match(event.request):caches.open(CACHE).then(cache=>cache.match(event.request))).then(cached=>cached||fetch(event.request)));
});
