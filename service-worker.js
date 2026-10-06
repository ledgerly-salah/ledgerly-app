const CACHE='ledgerly-shell-3.1.0-20261006-r12';
const SHELL=[
  './','./index.html','./styles.3.1.0.css','./app.3.1.0.js','./security-tools.3.1.1.js','./financial-action-guard.3.1.1.js','./report-tools.3.1.1.js','./pdf-report-v2.3.1.1.js','./visual-report-v1.3.1.1.js','./ledger-core.3.1.0.js','./storage.3.1.0.js','./crypto.3.1.0.js','./migrations.3.1.0.js','./i18n.3.1.0.js','./pdf.3.1.0.js',
  './ledgerly-v2.webmanifest','./logo.svg','./icon-192.png','./icon-512.png','./icon-maskable-512.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ledgerly-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  if(url.pathname.includes('/api/')||url.pathname.includes('/auth/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res;}).catch(()=>caches.match('./index.html')));return;
  }
  if(url.pathname.endsWith('/ledgerly-v2.webmanifest')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));return;
  }
  if(/\.(?:js|css)$/.test(url.pathname)){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res;}).catch(()=>caches.match(event.request)));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res;})));
});