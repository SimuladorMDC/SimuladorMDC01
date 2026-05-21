const CACHE='mdc-v3';
const FILES=['./index.html','./manifest.json','./icon-192.png','./grupos.json'];
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(FILES).catch(()=>{}))
  .then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
  // grupos.json: sempre tenta rede primeiro, fallback cache
  if(e.request.url.includes('grupos.json')){
    e.respondWith(
      fetch(e.request).then(r=>{
        const clone=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return r;
      }).catch(()=>caches.match(e.request))
    );
    return;
  }
  // Resto: cache first
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
