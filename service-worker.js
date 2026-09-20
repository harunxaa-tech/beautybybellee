const CACHE='angebotspilot-v11-32-1';
const ASSETS=[
  './','./index.html','./style.css?v=11.32.1','./subscription.css?v=11.32.1','./cloud-config.js?v=11.32.1',
  './country-config.js?v=11.32.1','./data-repository.js?v=11.32.1','./einvoice.js?v=11.32.1','./compliance-v1131.js?v=11.32.1','./compliance-v113108.js?v=11.32.1','./compliance-v113128.js?v=11.32.1','./compliance-v113131.js?v=11.32.1','./script.js?v=11.32.1','./customer-import.js?v=11.32.1','./cloud-files.js?v=11.32.1','./cloud-sync.js?v=11.32.1',
  './team.js?v=11.32.1','./assignments.js?v=11.32.1','./time-tracking.js?v=11.32.1','./notifications.js?v=11.32.1','./mail-hub.js?v=11.32.1','./email-assistant.js?v=11.32.1','./acceptance.js?v=11.32.1','./privacy-ops.js?v=11.32.1','./account-deletion.js?v=11.32.1','./account-deletion.html','./custom-selects.js?v=11.32.1',
  './security.js?v=11.32.1','./onboarding-setup.js?v=11.32.1','./cloud-auth.js?v=11.32.1','./subscription.js?v=11.32.1','./data-safety.js?v=11.32.1','./manifest.json?v=11.32.1','./icon-192.svg','./icon-512.svg'
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

  // HTML immer zuerst frisch anfordern. Die öffentliche Kontolöschseite bekommt einen eigenen Cache-Eintrag.
  if(event.request.mode==='navigate'){
    const accountDeletionPage=url.pathname.endsWith('/account-deletion.html');
    const fallback=accountDeletionPage?'./account-deletion.html':'./index.html';
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response?.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(fallback,copy));
          }
          return response;
        })
        .catch(()=>caches.match(fallback))
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
