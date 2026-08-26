/* AngebotsPilot v11.6 – In-App + Web Push Benachrichtigungen */
(function(){
  'use strict';
  const VAPID_PUBLIC='BENvx_2wSNyvaHZ4GtSPUlTf1QadziQjwpUNCu_Uy6QlIOOZbGYv1uU53YBal5j8H7qH2CGOOOXQWKyQBKbp6_E';
  const q=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let client=null,session=null,company=null,membership=null;
  let rows=[];
  let loadTimer=null;
  let attached=false;

  function urlBase64ToUint8Array(base64String){
    const padding='='.repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }
  function isStandalone(){return window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true}
  function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
  function fmtDateTime(v){try{return new Date(v).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return''}}
  function iconFor(type){return({assignment:'🏗️',time_start:'▶️',time_stop:'⏱️',offer_accepted:'✅',reminder_job:'📅',reminder_event:'🗓️',invoice_overdue:'🧾',acceptance:'✍️'})[type]||'🔔'}
  function relative(v){const d=Date.now()-new Date(v).getTime();if(d<60000)return'gerade eben';if(d<3600000)return`${Math.floor(d/60000)} Min.`;if(d<86400000)return`${Math.floor(d/3600000)} Std.`;return fmtDateTime(v)}

  async function attach(c,s,co,m){
    client=c;session=s;company=co;membership=m;attached=!!(client&&session&&company&&membership);
    renderPermission();
    if(!attached)return;
    await load().catch(()=>{});
    if('Notification'in window&&Notification.permission==='granted'&&(!isIos()||isStandalone()))syncExistingSubscription().catch(()=>{});
    setTimeout(()=>runReminders().catch(()=>{}),4500);
    if(loadTimer)clearInterval(loadTimer);
    loadTimer=setInterval(()=>load().catch(()=>{}),60000);
    handleLaunchRoute();
  }
  function detach(){client=session=company=membership=null;attached=false;rows=[];if(loadTimer){clearInterval(loadTimer);loadTimer=null}renderBadge();renderList();renderPermission()}

  async function load(){
    if(!attached)return;
    const {data,error}=await client.from('app_notifications')
      .select('id,type,title,body,url,tag,metadata,read_at,created_at')
      .eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(60);
    if(error)throw error;rows=data||[];renderBadge();renderList();
  }
  function unreadCount(){return rows.filter(x=>!x.read_at).length}
  function renderBadge(){
    const n=unreadCount();
    ['notificationBadge','moreNotificationBadge'].forEach(id=>{const el=q(id);if(!el)return;el.textContent=n>99?'99+':String(n);el.hidden=!n;el.classList.toggle('hidden',!n)});
  }
  function renderList(){
    const box=q('notificationList');if(!box)return;
    if(!attached){box.innerHTML='<div class="empty">Melde dich mit deinem Betriebskonto an.</div>';return}
    box.innerHTML=rows.length?rows.map(n=>`<button type="button" class="notificationItem ${n.read_at?'':'unread'}" onclick="Notifications.open('${n.id}')"><span class="notificationIcon">${iconFor(n.type)}</span><span class="notificationBody"><b>${esc(n.title)}</b><small>${esc(n.body||'')}</small><em>${esc(relative(n.created_at))}</em></span>${n.read_at?'':'<i></i>'}</button>`).join(''):'<div class="empty">Noch keine Benachrichtigungen.</div>';
    const meta=q('notificationMeta');if(meta)meta.textContent=unreadCount()?`${unreadCount()} ungelesen`:'Alles gelesen';
  }
  function renderPermission(){
    const status=q('pushPermissionStatus'),btn=q('pushEnableBtn'),hint=q('pushPermissionHint'),disable=q('pushDisableBtn');if(!status||!btn)return;
    if(disable)disable.hidden=true;
    if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){
      status.textContent='Auf diesem Gerät nicht verfügbar';btn.hidden=true;if(hint)hint.textContent='In-App-Benachrichtigungen funktionieren trotzdem.';return;
    }
    if(isIos()&&!isStandalone()){
      status.textContent='Home-Bildschirm erforderlich';btn.hidden=false;btn.textContent='So geht’s';btn.onclick=()=>globalThis.toast?.('Safari → Teilen → Zum Home-Bildschirm. Danach AngebotsPilot von dort öffnen.');if(hint)hint.textContent='Apple erlaubt Web-Push auf dem iPhone für installierte Web-Apps.';return;
    }
    const p=Notification.permission;
    status.textContent=p==='granted'?'Push ist aktiviert':p==='denied'?'Benachrichtigungen blockiert':'Push noch nicht aktiviert';
    btn.hidden=false;btn.textContent=p==='granted'?'Push aktualisieren':'Push aktivieren';btn.onclick=enablePush;
    if(disable)disable.hidden=p!=='granted';
    if(hint)hint.textContent=p==='denied'?'Bitte Benachrichtigungen in den iPhone-/Browser-Einstellungen wieder erlauben.':'Neue Zuweisungen und wichtige Änderungen können direkt auf dem Gerät erscheinen.';
  }

  async function syncExistingSubscription(){
    if(!attached||!('serviceWorker'in navigator)||!('PushManager'in window))return;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC)});
    const j=sub.toJSON();
    await client.from('push_subscriptions').upsert({company_id:company.id,user_id:session.user.id,endpoint:j.endpoint,p256dh:j.keys?.p256dh||'',auth:j.keys?.auth||'',updated_at:new Date().toISOString()},{onConflict:'user_id,endpoint'});
  }

  async function enablePush(){
    if(!attached)return globalThis.toast?.('Bitte zuerst anmelden');
    if(isIos()&&!isStandalone())return globalThis.toast?.('Bitte AngebotsPilot zuerst zum Home-Bildschirm hinzufügen');
    try{
      const permission=await Notification.requestPermission();renderPermission();
      if(permission!=='granted')return globalThis.toast?.('Benachrichtigungen wurden nicht erlaubt');
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC)});
      const j=sub.toJSON();
      const {error}=await client.from('push_subscriptions').upsert({company_id:company.id,user_id:session.user.id,endpoint:j.endpoint,p256dh:j.keys?.p256dh||'',auth:j.keys?.auth||'',updated_at:new Date().toISOString()},{onConflict:'user_id,endpoint'});
      if(error)throw error;
      renderPermission();globalThis.toast?.('✓ Push-Benachrichtigungen aktiviert');
      await send({mode:'self',exclude_self:false,title:'Benachrichtigungen aktiviert',body:'AngebotsPilot kann dich jetzt über wichtige Änderungen informieren.',type:'general',tag:'push-enabled',dedupe_hours:24,url:'./?screen=notifications'}).catch(()=>{});
      setTimeout(()=>load().catch(()=>{}),700);
    }catch(e){console.error('Push enable',e);globalThis.toast?.('Push konnte nicht aktiviert werden')}
  }
  async function disablePush(){
    if(!attached)return;
    try{
      const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
      if(sub){await client.from('push_subscriptions').delete().eq('user_id',session.user.id).eq('endpoint',sub.endpoint);await sub.unsubscribe()}
      renderPermission();globalThis.toast?.('Push auf diesem Gerät deaktiviert');
    }catch(e){console.warn(e)}
  }

  async function send(payload){
    if(!attached)return null;
    const {data,error}=await client.functions.invoke('send-push',{body:payload});if(error)throw error;return data;
  }
  async function notifyUsers(userIds,title,body,opts={}){
    const ids=[...new Set((userIds||[]).filter(Boolean))];if(!ids.length)return;
    return send({mode:'users',user_ids:ids,title,body,type:opts.type||'general',tag:opts.tag||opts.type||'angebotspilot',url:opts.url||'./?screen=notifications',metadata:opts.metadata||{},dedupe_hours:Number(opts.dedupeHours)||0,exclude_self:true});
  }
  async function notifyOwnerOffice(title,body,opts={}){
    return send({mode:'owner_office',title,body,type:opts.type||'general',tag:opts.tag||opts.type||'angebotspilot',url:opts.url||'./?screen=notifications',metadata:opts.metadata||{},dedupe_hours:Number(opts.dedupeHours)||0,exclude_self:opts.excludeSelf!==false});
  }
  async function notifySelf(title,body,opts={}){
    return send({mode:'self',exclude_self:false,title,body,type:opts.type||'general',tag:opts.tag||opts.type||'angebotspilot',url:opts.url||'./?screen=notifications',metadata:opts.metadata||{},dedupe_hours:Number(opts.dedupeHours)||24});
  }

  async function open(id){
    const n=rows.find(x=>x.id===id);if(!n)return;
    if(!n.read_at){await client.from('app_notifications').update({read_at:new Date().toISOString()}).eq('id',id);n.read_at=new Date().toISOString();renderBadge();renderList()}
    navigate(n.url,n.metadata);
  }
  function navigate(url,metadata={}){
    try{
      const u=new URL(url||'./',location.href);const screen=u.searchParams.get('screen')||metadata?.screen||'notifications';
      if(screen&&q(screen))globalThis.showScreen?.(screen);
      if(screen==='jobs'&&metadata?.job_local_id){setTimeout(()=>globalThis.editJob?.(metadata.job_local_id),250)}
    }catch{globalThis.showScreen?.('notifications')}
  }
  async function markAllRead(){
    if(!attached||!unreadCount())return;
    const {error}=await client.from('app_notifications').update({read_at:new Date().toISOString()}).eq('user_id',session.user.id).is('read_at',null);if(error)return globalThis.toast?.('Konnte nicht gespeichert werden');await load();globalThis.toast?.('Alles als gelesen markiert');
  }
  async function clearAll(){
    if(!attached||!rows.length)return;
    const ok=await globalThis.appConfirm?.({title:'Benachrichtigungen löschen?',text:'Der Benachrichtigungsverlauf dieses Kontos wird gelöscht.',confirmLabel:'Löschen',icon:'🗑️'});if(!ok)return;
    const {error}=await client.from('app_notifications').delete().eq('user_id',session.user.id);if(error)return globalThis.toast?.('Löschen fehlgeschlagen');await load();
  }

  function isoDate(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
  async function runReminders(){
    if(!attached||!globalThis.data)return;
    const now=new Date(),tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1);const td=isoDate(tomorrow);
    const jobs=(globalThis.data.jobs||[]).filter(j=>j.start===td&&j.status!=='done');
    for(const j of jobs.slice(0,6)){
      await notifySelf('Baustelle morgen',`${j.title||'Baustelle'} · ${j.startTime||'08:00'} Uhr`,{type:'reminder_job',tag:`job-tomorrow-${j.id}-${td}`,dedupeHours:24,url:'./?screen=jobs',metadata:{screen:'jobs',job_local_id:j.id}}).catch(()=>{});
    }
    if(membership?.role!=='worker'){
      const events=(globalThis.data.events||[]).filter(e=>e.date===td&&!e.jobId);
      for(const e of events.slice(0,6))await notifySelf('Termin morgen',`${e.title||'Termin'} · ${e.time||'08:00'} Uhr`,{type:'reminder_event',tag:`event-tomorrow-${e.id}-${td}`,dedupeHours:24,url:'./?screen=calendar'}).catch(()=>{});
      const today=isoDate(now),overdue=(globalThis.data.invoices||[]).filter(i=>i.status==='open'&&i.dueDate&&i.dueDate<today);
      if(overdue.length)await notifySelf('Rechnungen überfällig',`${overdue.length} ${overdue.length===1?'Rechnung ist':'Rechnungen sind'} überfällig.`,{type:'invoice_overdue',tag:`overdue-${today}`,dedupeHours:24,url:'./?screen=invoices'}).catch(()=>{});
    }
    setTimeout(()=>load().catch(()=>{}),900);
  }
  function handleLaunchRoute(){
    const p=new URLSearchParams(location.search),screen=p.get('screen');if(!screen)return;
    setTimeout(()=>{if(q(screen))globalThis.showScreen?.(screen);history.replaceState({},'',location.pathname+location.hash)},700);
  }
  function openCenter(){globalThis.showScreen?.('notifications');load().catch(()=>{})}

  globalThis.openNotifications=openCenter;
  globalThis.Notifications={attach,detach,load,open,markAllRead,clearAll,enablePush,disablePush,notifyUsers,notifyOwnerOffice,notifySelf,runReminders,renderPermission};
})();
