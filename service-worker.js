const CACHE='angebotspilot-v11-31-31';
const ASSETS=[
  './','./index.html','./style.css?v=11.31.31','./subscription.css?v=11.31.31','./cloud-config.js?v=11.31.31',
  './country-config.js?v=11.31.31','./data-repository.js?v=11.31.31','./einvoice.js?v=11.31.31','./compliance-v1131.js?v=11.31.31','./compliance-v113108.js?v=11.31.31','./compliance-v113128.js?v=11.31.31','./compliance-v113131.js?v=11.31.31','./script.js?v=11.31.31','./customer-import.js?v=11.31.31','./cloud-files.js?v=11.31.31','./cloud-sync.js?v=11.31.31',
  './team.js?v=11.31.31','./assignments.js?v=11.31.31','./time-tracking.js?v=11.31.31','./notifications.js?v=11.31.31','./mail-hub.js?v=11.31.31','./email-assistant.js?v=11.31.31','./acceptance.js?v=11.31.31','./custom-selects.js?v=11.31.31',
  './security.js?v=11.31.31','./onboarding-setup.js?v=11.31.31','./cloud-auth.js?v=11.31.31','./subscription.js?v=11.31.31','./data-safety.js?v=11.31.31','./manifest.json?v=11.31.31','./icon-192.svg','./icon-512.svg'
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
      .catch(()=>caches.match(event.request,{ignoreSearch:true}))
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
