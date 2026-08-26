const CACHE='digitaler-handwerker-v11-5';
const ASSETS=[
  './','./index.html','./style.css?v=11.5','./cloud-config.js?v=11.5',
  './data-repository.js?v=11.5','./script.js?v=11.5','./cloud-files.js?v=11.5','./cloud-sync.js?v=11.5',
  './team.js?v=11.5','./assignments.js?v=11.5','./time-tracking.js?v=11.5',
  './cloud-auth.js?v=11.5','./manifest.json','./icon-192.svg','./icon-512.svg'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin){e.respondWith(fetch(e.request));return}
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return r}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)));
});
