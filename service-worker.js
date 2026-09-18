const CACHE='angebotspilot-v11-31-20';
const ASSETS=[
  './','./index.html','./style.css?v=11.30.1','./subscription.css?v=11.30.1','./cloud-config.js?v=11.31.20',
  './country-config.js?v=11.30.1','./data-repository.js?v=11.30.1','./einvoice.js?v=11.30.1','./compliance-v1131.js?v=11.31.0','./compliance-v113108.js?v=11.31.08','./compliance-v113120.js?v=11.31.20','./script.js?v=11.30.1','./customer-import.js?v=11.30.1','./cloud-files.js?v=11.30.1','./cloud-sync.js?v=11.31.07',
  './team.js?v=11.30.1','./assignments.js?v=11.30.1','./time-tracking.js?v=11.30.1','./notifications.js?v=11.30.1','./mail-hub.js?v=11.30.1','./email-assistant.js?v=11.30.1','./acceptance.js?v=11.30.1','./custom-selects.js?v=11.30.1',
  './security.js?v=11.30.1','./onboarding-setup.js?v=11.30.1','./cloud-auth.js?v=11.30.1','./subscription.js?v=11.30.6','./data-safety.js?v=11.30.6','./manifest.json?v=11.30.1','./icon-192.svg','./icon-512.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin){
    event.respondWith(fetch(event.request));
    return;
  }

  // HTML immer zuerst frisch anfordern. Keine HTML-/Script-Injektion mehr.
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response?.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          }
          return response;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // App-JS/CSS network-first; Cache bleibt Offline-Fallback.
  event.respondWith(
    fetch(event.request,{cache:'no-cache'})
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(event.request))
  );
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
    for(const client of list){
      if('focus' in client){
        client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});
