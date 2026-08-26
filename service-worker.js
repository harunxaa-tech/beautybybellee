const CACHE='angebotspilot-v11-8';
const ASSETS=[
  './','./index.html','./style.css?v=11.8','./cloud-config.js?v=11.8',
  './country-config.js?v=11.8','./data-repository.js?v=11.8','./script.js?v=11.8','./cloud-files.js?v=11.8','./cloud-sync.js?v=11.8',
  './team.js?v=11.8','./assignments.js?v=11.8','./time-tracking.js?v=11.8','./notifications.js?v=11.8','./email-assistant.js?v=11.8','./custom-selects.js?v=11.8',
  './cloud-auth.js?v=11.8','./manifest.json','./icon-192.svg','./icon-512.svg'
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


self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(e){data={body:event.data?.text?.()||''}}
  const title=data.title||'AngebotsPilot';
  event.waitUntil(self.registration.showNotification(title,{
    body:data.body||'',
    tag:data.tag||'angebotspilot',
    renotify:true,
    data:{url:data.url||'./?screen=notifications',type:data.type||'general',metadata:data.metadata||{}},
    badge:'./icon-192.svg',
    icon:'./icon-192.svg'
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./?screen=notifications',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c){c.navigate(target);return c.focus()}}
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});
