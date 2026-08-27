/* AngebotsPilot v11.10 – providerunabhängige Firmen-Mailbox
   Microsoft zuerst im reinen Lesemodus. Google/andere Anbieter nutzen später dieselbe normalisierte Mailbox. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const cloud=()=>globalThis.getCloudState?.()||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let connections=[];
  let messages=[];
  let capabilities={microsoft:{ready:false},google:{ready:false},other:{ready:false}};
  let loading=false;

  try{
    const p=new URLSearchParams(location.search),mail=p.get('mail');
    if(mail)sessionStorage.setItem('ap_mail_oauth_return_v1110',JSON.stringify({mail,message:p.get('mail_message')||''}));
  }catch{}

  const providerLabel=p=>({microsoft:'Microsoft 365 / Outlook',google:'Google / Workspace',imap:'Andere Firmen-E-Mail',forwarding:'Andere Firmen-E-Mail'})[p]||p;
  const dt=v=>{try{return new Date(v).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return'–'}};
  const role=()=>cloud().membership?.role||'';

  async function invoke(name,body){
    const {client}=cloud();if(!client)throw new Error('Cloud nicht verbunden');
    const {data,error}=await client.functions.invoke(name,{body});
    if(error){
      let message=error.message||'Serveranfrage fehlgeschlagen';
      try{const detail=await error.context?.json?.();message=detail?.message||detail?.error||message}catch{}
      throw new Error(message);
    }
    return data||{};
  }

  async function loadCapabilities(){
    try{capabilities=await invoke('mail-account',{action:'capabilities'})}catch(e){console.warn('Mail capabilities',e)}
  }
  async function loadConnections(){
    const {client,company}=cloud();if(!client||!company)return connections=[];
    const {data,error}=await client.from('mail_connections').select('*').eq('company_id',company.id).neq('status','disconnected').order('created_at',{ascending:false});
    if(error)throw error;connections=data||[];
  }
  async function loadMessages(){
    const {client,company}=cloud();if(!client||!company)return messages=[];
    const {data,error}=await client.from('mail_messages').select('*').eq('company_id',company.id).eq('direction','inbound').order('received_at',{ascending:false}).limit(40);
    if(error)throw error;messages=data||[];
  }
  function activeConnection(){return connections.find(x=>x.status==='connected')||connections[0]||null}

  function renderConnection(){
    const box=q('mailConnectionState'),providers=q('mailProviderGrid');if(!box||!providers)return;
    const c=activeConnection(),owner=role()==='owner';
    if(c?.status==='connected'){
      box.innerHTML=`<div class="mailConnected"><span class="mailProviderIcon">${c.provider==='microsoft'?'Ⓜ️':c.provider==='google'?'🇬':'✉️'}</span><div><small>VERBUNDEN · NUR LESEN</small><b>${esc(c.account_email||c.account_name||providerLabel(c.provider))}</b><span>${esc(providerLabel(c.provider))}${c.last_sync_at?` · zuletzt ${esc(dt(c.last_sync_at))}`:''}</span></div><strong>✓</strong></div>${c.last_error?`<div class="mailConnectionError">${esc(c.last_error)}</div>`:''}<div class="mailConnectionActions"><button class="btn primary small" type="button" onclick="MailHub.sync('${c.id}')">↻ Neue Mails abrufen</button>${owner?`<button class="btn small" type="button" onclick="MailHub.disconnect('${c.id}')">Verbindung trennen</button>`:''}</div>`;
    }else if(c){
      box.innerHTML=`<div class="mailPending"><span>⏳</span><div><b>${esc(providerLabel(c.provider))}</b><small>${c.status==='error'?'Verbindung nicht abgeschlossen':'Verbindung wird vorbereitet'}${c.last_error?` · ${esc(c.last_error)}`:''}</small></div></div>`;
    }else{
      box.innerHTML='<div class="mailNoConnection"><span>📭</span><div><b>Noch kein Firmen-Postfach verbunden</b><small>Die bisherige manuelle Prüfung bleibt darunter vollständig nutzbar.</small></div></div>';
    }

    const msReady=!!capabilities?.microsoft?.ready;
    providers.innerHTML=`
      <button type="button" class="mailProviderCard microsoft ${c?.provider==='microsoft'&&c?.status==='connected'?'connected':''}" onclick="MailHub.connectMicrosoft()" ${!owner||c?.status==='connected'?'disabled':''}>
        <span class="mailProviderMark">M</span><div><b>Microsoft 365 / Outlook</b><small>${c?.provider==='microsoft'&&c?.status==='connected'?'Verbunden':msReady?'Jetzt sicher verbinden':'Technisch vorbereitet · Freigabe fehlt noch'}</small></div><em>${c?.provider==='microsoft'&&c?.status==='connected'?'✓':'›'}</em>
      </button>
      <button type="button" class="mailProviderCard" onclick="MailHub.providerInfo('google')" ${!owner?'disabled':''}><span class="mailProviderMark">G</span><div><b>Google / Workspace</b><small>Nächster OAuth-Connector</small></div><em>später</em></button>
      <button type="button" class="mailProviderCard" onclick="MailHub.providerInfo('other')" ${!owner?'disabled':''}><span class="mailProviderMark">@</span><div><b>Andere Firmen-E-Mail</b><small>IONOS, STRATO, ALL-INKL & eigene Domain</small></div><em>später</em></button>`;
  }

  function renderInbox(){
    const box=q('mailInboxList'),meta=q('mailInboxMeta'),sync=q('mailInboxSyncBtn');if(!box)return;
    const c=activeConnection();
    if(meta)meta.textContent=c?.status==='connected'?(messages.length?`${messages.length} zuletzt geladene Nachrichten`:'Posteingang verbunden'):'Noch kein echtes Postfach verbunden';
    if(sync){sync.hidden=!(c?.status==='connected');sync.disabled=loading;}
    if(!c?.status==='connected'){box.innerHTML='<div class="empty mailInboxEmpty">Sobald ein Postfach verbunden ist, erscheinen neue Kundenmails hier. Bis dahin kannst du Nachrichten darunter weiterhin manuell prüfen.</div>';return}
    if(!messages.length){box.innerHTML='<div class="empty mailInboxEmpty">Noch keine Nachrichten geladen. Tippe auf „Neue Mails abrufen“.</div>';return}
    box.innerHTML=messages.map(m=>`<div class="mailMessage ${m.workflow_status==='new'?'unreviewed':''}"><div class="mailMessageTop"><span>${m.workflow_status==='new'?'●':'✓'}</span><div><b>${esc(m.from_name||m.from_email||'Unbekannter Absender')}</b><small>${esc(m.from_email||'')} · ${esc(dt(m.received_at))}</small></div></div><h3>${esc(m.subject||'Ohne Betreff')}</h3><p>${esc(m.body_preview||m.body_text||'').slice(0,260)}</p><div class="mailMessageActions"><button class="btn primary small" type="button" onclick="MailHub.review('${m.id}')">Sekretärin prüfen lassen</button></div></div>`).join('');
  }

  function showOAuthReturn(){
    let saved=null;try{saved=JSON.parse(sessionStorage.getItem('ap_mail_oauth_return_v1110')||'null');sessionStorage.removeItem('ap_mail_oauth_return_v1110')}catch{}
    if(!saved)return;
    setTimeout(()=>globalThis.toast?.(saved.mail==='connected'?'✓ Firmen-E-Mail erfolgreich verbunden':saved.message||'E-Mail-Verbindung konnte nicht abgeschlossen werden'),250);
  }

  async function refresh(){
    if(!['owner','office'].includes(role()))return;
    try{await Promise.all([loadCapabilities(),loadConnections(),loadMessages()]);renderConnection();renderInbox();showOAuthReturn()}catch(e){console.error('MailHub refresh',e);renderConnection();renderInbox()}
  }

  async function connectMicrosoft(){
    if(role()!=='owner')return globalThis.toast?.('Nur der Chef kann ein Firmen-Postfach verbinden.');
    try{
      const r=await invoke('mail-account',{action:'microsoft_start'});
      if(!r.authorization_url)throw new Error('Microsoft-Verbindung konnte nicht gestartet werden.');
      location.href=r.authorization_url;
    }catch(e){
      globalThis.toast?.(e.message||'Microsoft-Verbindung ist noch nicht verfügbar.');
    }
  }

  async function sync(connectionId){
    if(loading)return;loading=true;renderInbox();
    const btn=q('mailInboxSyncBtn');if(btn)btn.textContent='Wird abgerufen …';
    try{const r=await invoke('mail-sync',{connection_id:connectionId});await Promise.all([loadConnections(),loadMessages()]);renderConnection();renderInbox();globalThis.toast?.(r.new_count?`✓ ${r.new_count} neue Mail${r.new_count===1?'':'s'} geladen`:'Posteingang ist aktuell')}
    catch(e){globalThis.toast?.(e.message||'Mails konnten nicht geladen werden')}
    finally{loading=false;if(btn)btn.textContent='↻ Neue Mails abrufen';renderInbox()}
  }

  async function disconnect(connectionId){
    if(role()!=='owner')return;
    const ok=await globalThis.appConfirm?.({title:'E-Mail-Verbindung trennen?',text:'AngebotsPilot kann danach keine neuen Mails mehr abrufen. Bereits importierte Nachrichten und Prüfverläufe bleiben dokumentiert.',confirmLabel:'Verbindung trennen',icon:'🔌'});if(!ok)return;
    try{await invoke('mail-account',{action:'disconnect',connection_id:connectionId});await refresh();globalThis.toast?.('E-Mail-Verbindung getrennt')}catch(e){globalThis.toast?.(e.message||'Verbindung konnte nicht getrennt werden')}
  }

  function providerInfo(provider){
    const msg=provider==='google'?'Google / Workspace wird als nächster OAuth-Connector an dieselbe sichere Mailbox angeschlossen.':'Für IONOS, STRATO, ALL-INKL und eigene Mailserver bauen wir einen separaten sicheren Connector. Das Firmenpasswort wird nicht im Browser gespeichert.';
    globalThis.appConfirm?.({title:provider==='google'?'Google / Workspace':'Andere Firmen-E-Mail',text:msg,confirmLabel:'Verstanden',icon:provider==='google'?'G':'@'});
  }

  async function review(id){
    const m=messages.find(x=>x.id===id);if(!m)return;
    globalThis.EmailAssistant?.loadMailMessage?.(m);
  }

  globalThis.MailHub={refresh,connectMicrosoft,sync,disconnect,providerInfo,review,_state:()=>({connections,messages,capabilities})};
})();
