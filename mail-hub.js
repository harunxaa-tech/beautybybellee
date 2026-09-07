/* AngebotsPilot v11.18 – providerunabhängige Firmen-Mailbox
   Microsoft OAuth + IMAP/TLS + konservativer Posteingangsfilter. Nichts wird gelöscht. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const cloud=()=>globalThis.getCloudState?.()||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let connections=[];
  let messages=[];
  let assistantItems=[];
  let capabilities={microsoft:{ready:false},google:{ready:false},other:{ready:false}};
  let loading=false;
  let homeRefreshing=false;
  let homeSyncing=false;
  let homeLastRefreshAt=0;
  let imapProvider='';
  let showFiltered=false;

  try{
    const p=new URLSearchParams(location.search),mail=p.get('mail');
    if(mail)sessionStorage.setItem('ap_mail_oauth_return_v1111',JSON.stringify({mail,message:p.get('mail_message')||''}));
  }catch{}

  const providerLabel=p=>({microsoft:'Microsoft 365 / Outlook',google:'Google / Workspace',imap:'Andere Firmen-E-Mail',forwarding:'Andere Firmen-E-Mail'})[p]||p;
  const connectionLabel=c=>c?.provider==='imap'?(c?.metadata?.provider_label||c?.account_name||'IMAP / TLS'):providerLabel(c?.provider);
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
    const c=activeConnection();if(!c)return messages=[];
    const {data,error}=await client.from('mail_messages').select('*').eq('company_id',company.id).eq('connection_id',c.id).eq('direction','inbound').order('received_at',{ascending:false}).limit(40);
    if(error)throw error;messages=data||[];
  }
  async function loadAssistantItems(){
    const {client,company}=cloud();if(!client||!company)return assistantItems=[];
    const {data,error}=await client.from('email_assistant_items').select('id,detected_intent,confidence,workflow_status,subject,customer_name,sender_email,offer_number,created_at,source_mail_message_id,action_note').eq('company_id',company.id).order('created_at',{ascending:false}).limit(40);
    if(error)throw error;assistantItems=data||[];return assistantItems;
  }
  function activeConnection(){return connections.find(x=>x.status==='connected')||connections[0]||null}

  function renderConnection(){
    const box=q('mailConnectionState'),providers=q('mailProviderGrid');if(!box||!providers)return;
    const c=activeConnection(),owner=role()==='owner';
    if(c?.status==='connected'){
      const icon=c.provider==='microsoft'?'M':c.provider==='google'?'G':'@';
      box.innerHTML=`<div class="mailConnected"><span class="mailProviderIcon">${icon}</span><div><small>VERBUNDEN</small><b>${esc(c.account_email||c.account_name||connectionLabel(c))}</b><span>${esc(connectionLabel(c))}${c.last_sync_at?` · zuletzt ${esc(dt(c.last_sync_at))}`:''}</span></div><strong>✓</strong></div>${c.last_error?`<div class="mailConnectionError">${esc(c.last_error)}</div>`:''}<div class="mailConnectionActions"><button class="btn primary small" type="button" onclick="MailHub.sync('${c.id}')">↻ Aktualisieren</button>${owner?`<button class="btn small" type="button" onclick="MailHub.disconnect('${c.id}')">Trennen</button>`:''}</div>`;
    }else if(c){
      box.innerHTML=`<div class="mailPending"><span>⏳</span><div><b>${esc(connectionLabel(c))}</b><small>${c.status==='error'?'Verbindung nicht abgeschlossen':'Verbindung wird vorbereitet'}${c.last_error?` · ${esc(c.last_error)}`:''}</small></div></div>`;
    }else{
      box.innerHTML='<div class="mailNoConnection"><span>📭</span><div><b>Noch kein Firmen-Postfach verbunden</b><small>Die bisherige manuelle Prüfung bleibt darunter vollständig nutzbar.</small></div></div>';
    }

    const msReady=!!capabilities?.microsoft?.ready,otherReady=!!capabilities?.other?.ready;
    const msActive=c?.provider==='microsoft'&&c?.status==='connected',imapActive=c?.provider==='imap'&&c?.status==='connected';
    providers.innerHTML=`
      <button type="button" class="mailProviderCard microsoft ${msActive?'connected':''}" onclick="MailHub.connectMicrosoft()" ${!owner||msActive?'disabled':''}>
        <span class="mailProviderMark">M</span><div><b>Microsoft 365 / Outlook</b><small>${msActive?'Verbunden':msReady?'Jetzt sicher verbinden':'Noch nicht verfügbar'}</small></div><em>${msActive?'✓':'›'}</em>
      </button>
      <button type="button" class="mailProviderCard" onclick="MailHub.providerInfo('google')" ${!owner?'disabled':''}><span class="mailProviderMark">G</span><div><b>Google / Workspace</b><small>Noch nicht verfügbar</small></div><em>später</em></button>
      <button type="button" class="mailProviderCard ${imapActive?'connected':''}" onclick="MailHub.openImapSetup()" ${!owner||imapActive?'disabled':''}><span class="mailProviderMark">@</span><div><b>Andere Firmen-E-Mail</b><small>${imapActive?'Verbunden':otherReady?'WEB.DE, GMX, IONOS, STRATO, ALL-INKL & eigene Domain':'Noch nicht verfügbar'}</small></div><em>${imapActive?'✓':'›'}</em></button>`;
    const disclosure=q('mailConnectionDetails');
    if(disclosure){const connected=c?.status==='connected';disclosure.classList.toggle('connected',!!connected);if(!connected)disclosure.open=true;else if(!disclosure.dataset.initialized){disclosure.open=false;disclosure.dataset.initialized='1'}}
    renderAssistantOverview();
  }

  const normEmail=v=>String(v||'').trim().toLowerCase();
  function keptSenders(){
    try{return new Set(JSON.parse(localStorage.getItem('ap_mail_keep_senders_v1117')||'[]').map(normEmail).filter(Boolean))}catch{return new Set()}
  }
  function customerEmails(){
    const set=new Set();
    for(const c of globalThis.data?.customers||[]){
      if(c?.deletedAt||c?.deleted_at)continue;
      const email=normEmail(c?.email);if(email)set.add(email);
    }
    return set;
  }
  function triageMessage(m){
    const sender=normEmail(m?.from_email),subject=String(m?.subject||''),body=String(m?.body_preview||m?.body_text||'');
    const text=`${subject} ${body}`.toLowerCase();
    const local=sender.split('@')[0]||'',domain=sender.split('@')[1]||'';
    if(keptSenders().has(sender))return{bucket:'primary',reason:'Vom Betrieb priorisiert',confidence:1};
    if(customerEmails().has(sender))return{bucket:'primary',reason:'Bekannter Kunde',confidence:1};

    // Eindeutige Social-Media-Rückblicke dürfen nach unten, Sicherheits-/Kontomails derselben Plattform aber niemals.
    const socialDomain=/(facebookmail\.com$|mail\.instagram\.com$|pinterest\.com$)/i.test(domain);
    const socialNoise=/freundschaftsanfrage|freundschaftsvorschl|reels von|sieh dir an, was du verpasst|neue reels|personen, die du kennen könntest/i.test(subject);
    const critical=/(sicherheits|security|passwort|password|login|konto|account|zahlung|payment|rechnung|invoice|2fa|two-factor|bestätigungscode|verification|code)/i.test(text);
    if(socialDomain&&socialNoise&&!critical)return{bucket:'filtered',reason:'Social-Media-Benachrichtigung',confidence:.99};

    // Alles mit möglichem Geschäfts-, Zahlungs-, Termin- oder Sicherheitsbezug bleibt IMMER im Hauptposteingang.
    const important=/(angebot|offerte|auftrag|termin|start|beginn|rechnung|invoice|mahnung|zahlung|payment|anfrage|preis|kostenvoranschlag|quote|estimate|appointment|booking|projekt|baustelle|reklamation|mangel|schaden|storno|kündig|kuendig|bestellung|liefer|vertrag|dringend|urgent|notfall|bewerbung|support|rückfrage|rueckfrage|annahme|angenommen|ablehn|bestätig|bestaetig|zusage|passwort|password|sicherheits|security code|bestätigungscode|verification|konto|account|login|anmeld|2fa|two-factor|steuer|finanzamt|versicherung)/i.test(text);
    if(important)return{bucket:'primary',reason:'Möglicher Geschäftsbezug',confidence:.99};

    // Nur sehr eindeutige Massen-/Werbesignale werden nach unten sortiert. Ein einzelnes Signal reicht nie.
    let bulk=0;const reasons=[];
    if(/newsletter|marketing|promotions?|campaign|digest|mailer|posts?-recap|friendsuggestion|reminders/i.test(local)){bulk++;reasons.push('Massen-Absender')}
    if(/(^|\.)((news|newsletter|neuigkeiten|mailings)\.|facebookmail\.com$|mail\.instagram\.com$|linkedin\.com$|pinterest\.com$)/i.test(domain)){bulk++;reasons.push('Benachrichtigungs-Domain')}
    if(/newsletter|wochenrückblick|weekly digest|daily digest|neuigkeiten|news update|deal der woche|rabattaktion|black friday|gewinn(?:spiel|-code)?|gratis|nur heute|aktion endet|entdecke|discover|reels von|freundschaftsanfrage|freundschaftsvorschl/i.test(subject)){bulk++;reasons.push('Werbe-Betreff')}
    if(/unsubscribe|newsletter abbestellen|vom newsletter abmelden|e-mail-präferenzen|email preferences|keine weiteren e-mails|abbestellen/i.test(body)){bulk++;reasons.push('Abmelde-Hinweis')}
    if(/^(no-?reply|noreply|donotreply)$/i.test(local)){bulk++;reasons.push('Automatischer Absender')}
    if(bulk>=2)return{bucket:'filtered',reason:reasons.slice(0,2).join(' · '),confidence:.98};
    return{bucket:'primary',reason:'Im Zweifel sichtbar',confidence:.5};
  }
  function isTodayLocal(value){
    if(!value)return false;const d=new Date(value),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();
  }
  function homeIntentMeta(intent){
    return ({accepted:{icon:'✓',label:'ZUSAGE ERKANNT',tone:'accepted'},declined:{icon:'↩',label:'ABSAGE ERKANNT',tone:'declined'},appointment:{icon:'📅',label:'TERMINFRAGE',tone:'appointment'},question:{icon:'?',label:'KUNDENFRAGE',tone:'question'},unknown:{icon:'✉',label:'PRÜFUNG OFFEN',tone:'unknown'}})[intent]||{icon:'✉',label:'VORGANG',tone:'unknown'};
  }
  function homeMailMeta(m){
    const text=`${m?.subject||''} ${m?.body_preview||m?.body_text||''}`.toLowerCase();
    if(/annehm|angenommen|zusage|beauftrag|auftrag erteilen|accept/.test(text))return{icon:'✓',label:'MÖGLICHE ZUSAGE'};
    if(/termin|wann (?:könn|koenn)|start|beginn|zeitpunkt|appointment/.test(text))return{icon:'📅',label:'TERMIN / START'};
    if(/ablehn|absage|nicht beauftrag|declin/.test(text))return{icon:'↩',label:'MÖGLICHE ABSAGE'};
    if(/rechnung|zahlung|bezahlt|überweis|ueberweis|invoice|payment/.test(text))return{icon:'€',label:'RECHNUNG / ZAHLUNG'};
    if(customerEmails().has(normEmail(m?.from_email)))return{icon:'👤',label:'BEKANNTER KUNDE'};
    return{icon:'✉',label:'NEUE KUNDENMAIL'};
  }
  function homeLastSyncLabel(c){
    if(homeSyncing)return'Postfach wird gerade aktualisiert';
    if(!c?.last_sync_at)return'Postfach verbunden';
    try{return`Postfach zuletzt ${new Date(c.last_sync_at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} aktualisiert`}catch{return'Postfach verbunden'}
  }
  function renderAssistantOverview(){
    const box=q('mailAssistantOverview');if(!box)return;
    const c=activeConnection();
    if(!c||c.status!=='connected'){
      box.innerHTML=`<div class="secretariatOverviewCard"><div class="secretariatOverviewSetup"><span>📭</span><div><b>Firmen-E-Mail noch nicht verbunden</b><small>Verbinde dein Postfach einmal. Danach landen wichtige Kundenmails automatisch hier.</small></div><button type="button" class="btn primary small" onclick="MailHub.openConnectionSettings()">Postfach verbinden</button></div></div>`;
      return;
    }
    const triaged=messages.map(m=>({m,t:triageMessage(m)}));
    const primary=triaged.filter(x=>x.t.bucket==='primary');
    const filtered=triaged.filter(x=>x.t.bucket==='filtered');
    const newImportant=primary.filter(x=>x.m.workflow_status==='new').length;
    const openItems=assistantItems.filter(i=>!['done','archived'].includes(String(i.workflow_status||'').toLowerCase())).length;
    const total=newImportant+openItems;
    const title=total?`${total} ${total===1?'Vorgang braucht':'Vorgänge brauchen'} deine Aufmerksamkeit`:'Alles im Blick';
    const stateClass=total?' attention':'';
    const calm=total?'':`<div class="secretariatOverviewCalm"><span>✓</span><div><b>Keine offenen wichtigen Vorgänge</b><small>Du musst gerade nichts freigeben.</small></div></div>`;
    box.innerHTML=`<div class="secretariatOverviewCard"><div class="secretariatOverviewHead"><div><small>HEUTE IM SEKRETARIAT</small><b>${esc(title)}</b></div><span class="secretariatOverviewState${stateClass}">${total?'!':'✓'}</span></div><div class="secretariatOverviewStats"><div class="secretariatOverviewStat"><span>Neue Mails</span><strong>${newImportant}</strong></div><div class="secretariatOverviewStat"><span>Freigaben</span><strong>${openItems}</strong></div><div class="secretariatOverviewStat"><span>Weitere</span><strong>${filtered.length}</strong></div></div>${calm}<div class="secretariatOverviewActions"><button type="button" class="btn ${total?'primary':''}" onclick="MailHub.jumpInbox()">${total?'Jetzt prüfen':'Posteingang öffnen'}</button><button type="button" class="btn" onclick="MailHub.syncHome()" ${homeSyncing?'disabled':''}>${homeSyncing?'…':'↻'}</button></div></div>`;
  }
  function openConnectionSettings(){const d=q('mailConnectionDetails');if(!d)return;d.open=true;setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'start'}),20)}
  function jumpInbox(){q('mailInboxCard')?.scrollIntoView({behavior:'smooth',block:'start'})}
  function renderHomeSecretariat(){
    const host=q('secretariatHome');if(!host)return;
    const allowed=['owner','office'].includes(role());host.hidden=!allowed;if(!allowed)return;
    const {client,company}=cloud();
    if(!client||!company){host.innerHTML=`<div class="secretariatHomeCard secretariatHomeLoading"><div class="secretariatHomeOrb"><span>✦</span></div><div><span class="secretariatEyebrow">DEIN BÜRO HEUTE</span><h2>Sekretariat</h2><p>Cloud und Postfach werden vorbereitet …</p></div></div>`;return}
    const c=activeConnection();
    if(!c||c.status!=='connected'){
      host.innerHTML=`<div class="secretariatHomeCard"><div class="secretariatHomeTop"><div class="secretariatIdentity"><div class="secretariatHomeOrb"><span>✦</span></div><div><span class="secretariatEyebrow">DEIN BÜRO HEUTE</span><h2>Sekretariat</h2><p>Deine digitale Sekretärin für Kundenmails und Rückmeldungen.</p></div></div><span class="secretariatStatus offline"><span class="secretariatStatusDot"></span>NICHT VERBUNDEN</span></div><div class="secretariatSetup"><b>Einmal Firmen-Postfach verbinden</b><small>Danach erscheinen wichtige Kundenmails morgens automatisch hier. Antworten und Aktionen bleiben immer unter deiner Freigabe.</small><button type="button" class="btn primary" onclick="openEmailAssistant()">Sekretariat einrichten</button></div><div class="secretariatFineprint">🔒 <b>Keine automatische Antwort.</b> Du behältst die Kontrolle.</div></div>`;return
    }
    const triaged=messages.map(m=>({m,t:triageMessage(m)}));
    const primary=triaged.filter(x=>x.t.bucket==='primary');
    const filtered=triaged.filter(x=>x.t.bucket==='filtered');
    const newImportant=primary.filter(x=>x.m.workflow_status==='new');
    const openItems=assistantItems.filter(i=>!['done','archived'].includes(String(i.workflow_status||'').toLowerCase()));
    const todayChecked=assistantItems.filter(i=>isTodayLocal(i.created_at)).length;
    const totalOpen=newImportant.length+openItems.length;
    let headline='Alles im Blick.';
    let detail='Keine neuen wichtigen Kundenmails oder offenen Freigaben.';
    if(newImportant.length&&openItems.length){headline=`${totalOpen} Vorgänge brauchen deine Aufmerksamkeit.`;detail=`${newImportant.length} neue ${newImportant.length===1?'Mail':'Mails'} · ${openItems.length} bereits vorbereitete ${openItems.length===1?'Freigabe':'Freigaben'}.`}
    else if(newImportant.length){headline=`${newImportant.length} neue wichtige ${newImportant.length===1?'Mail wartet':'Mails warten'} auf dich.`;detail='Die Sekretärin hält mögliche Kunden- und Auftragsmails bewusst sichtbar.'}
    else if(openItems.length){headline=`${openItems.length} ${openItems.length===1?'Vorgang wartet':'Vorgänge warten'} auf deine Freigabe.`;detail='Analyse und Antwort sind vorbereitet. Versendet oder gebucht wird erst nach deiner Bestätigung.'}
    const queue=[
      ...openItems.map(i=>({kind:'assistant',date:i.created_at,item:i})),
      ...newImportant.map(x=>({kind:'mail',date:x.m.received_at,item:x.m}))
    ].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,2);
    const queueHtml=queue.map(x=>{
      if(x.kind==='assistant'){
        const i=x.item,m=homeIntentMeta(i.detected_intent),who=i.customer_name||i.sender_email||'Kunde',offer=i.offer_number?` · ${i.offer_number}`:'';
        return `<button type="button" class="secretariatQueueItem" onclick="MailHub.openAssistantItem('${esc(i.id)}')"><span class="secretariatQueueIcon">${m.icon}</span><span class="secretariatQueueBody"><small>${m.label}</small><b>${esc(i.subject||'Ohne Betreff')}</b><span>${esc(who)}${esc(offer)}</span></span><span class="secretariatQueueArrow">›</span></button>`;
      }
      const m=x.item,meta=homeMailMeta(m),who=m.from_name||m.from_email||'Unbekannter Absender';
      return `<button type="button" class="secretariatQueueItem" onclick="MailHub.review('${esc(m.id)}')"><span class="secretariatQueueIcon">${meta.icon}</span><span class="secretariatQueueBody"><small>${meta.label}</small><b>${esc(m.subject||'Ohne Betreff')}</b><span>${esc(who)}</span></span><span class="secretariatQueueArrow">›</span></button>`;
    }).join('');
    const checkedHtml=todayChecked?`<span class="secretariatPulseSep">·</span><small>✓ ${todayChecked} heute geprüft</small>`:`<small>Noch nichts geprüft</small>`;
    const openLabel=totalOpen?`Alle ${totalOpen} öffnen`:'Sekretariat öffnen';
    host.innerHTML=`<div class="secretariatHomeCard compact"><div class="secretariatHomeTop"><div class="secretariatIdentity"><div class="secretariatHomeOrb"><span>✦</span></div><div><span class="secretariatEyebrow">DEIN BÜRO HEUTE</span><h2>Sekretariat</h2></div></div><span class="secretariatStatus ${totalOpen?'attention':''}"><span class="secretariatStatusDot"></span>${totalOpen?`${totalOpen} OFFEN`:'AKTUELL'}</span></div>${totalOpen?`<div class="secretariatPulse"><b>${newImportant.length} neue ${newImportant.length===1?'Mail':'Mails'}</b><span class="secretariatPulseSep">·</span><b>${openItems.length} ${openItems.length===1?'Freigabe':'Freigaben'}</b>${checkedHtml}</div>`:`<div class="secretariatCalmLine"><span>✓</span><div><b>Alles im Blick</b><small>Keine offenen wichtigen Vorgänge.</small></div></div>`}${queueHtml?`<div class="secretariatQueue compact">${queueHtml}</div>`:''}<div class="secretariatHomeActions compact"><button type="button" class="btn primary secretariatOpen" onclick="openEmailAssistant()">${openLabel}</button><button type="button" class="btn secretariatRefresh ${homeSyncing?'syncing':''}" onclick="MailHub.syncHome()" aria-label="Postfach aktualisieren" ${homeSyncing?'disabled':''}>↻</button></div><div class="secretariatFineprint">🔒 Versand nur nach Freigabe · ${esc(homeLastSyncLabel(c))}</div></div>`;
  }
  async function maybeAutoSyncHome(){
    const c=activeConnection();if(!c||c.status!=='connected'||homeSyncing)return;
    let age=Infinity;try{age=Date.now()-new Date(c.last_sync_at||0).getTime()}catch{}
    if(age<10*60*1000)return;
    const key=`ap_secretariat_autosync_v1124_${c.id}`;try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1')}catch{}
    homeSyncing=true;renderHomeSecretariat();
    try{await invoke('mail-sync',{connection_id:c.id});await loadConnections();await Promise.all([loadMessages(),loadAssistantItems()]);renderConnection();renderInbox()}
    catch(e){console.warn('Sekretariat Auto-Sync',e)}
    finally{homeSyncing=false;homeLastRefreshAt=Date.now();renderHomeSecretariat()}
  }
  async function refreshHome(force=false){
    if(!['owner','office'].includes(role())){renderHomeSecretariat();return}
    const {client,company}=cloud();if(!client||!company){renderHomeSecretariat();return}
    if(homeRefreshing)return;
    if(!force&&homeLastRefreshAt&&Date.now()-homeLastRefreshAt<30000){renderHomeSecretariat();return}
    homeRefreshing=true;
    try{await loadConnections();await Promise.all([loadMessages(),loadAssistantItems()]);homeLastRefreshAt=Date.now();renderHomeSecretariat();void maybeAutoSyncHome()}
    catch(e){console.warn('Sekretariat Startseite',e);renderHomeSecretariat()}
    finally{homeRefreshing=false}
  }
  async function syncHome(){
    const c=activeConnection();if(!c||c.status!=='connected')return globalThis.openEmailAssistant?.();
    if(homeSyncing)return;homeSyncing=true;renderHomeSecretariat();
    try{const r=await invoke('mail-sync',{connection_id:c.id});await loadConnections();await Promise.all([loadMessages(),loadAssistantItems()]);renderConnection();renderInbox();globalThis.toast?.(r.new_count?`✓ ${r.new_count} neue Mail${r.new_count===1?'':'s'} geladen`:'Sekretariat ist aktuell')}
    catch(e){globalThis.toast?.(e.message||'Postfach konnte nicht aktualisiert werden')}
    finally{homeSyncing=false;homeLastRefreshAt=Date.now();renderHomeSecretariat()}
  }
  async function openAssistantItem(id){
    await globalThis.openEmailAssistant?.();setTimeout(()=>globalThis.EmailAssistant?.reopen?.(id),60);
  }

  function mailCard(m,triage,filtered=false){
    return `<div class="mailMessage ${m.workflow_status==='new'?'unreviewed':''} ${filtered?'mailMessageFiltered':''}">${filtered?`<div class="mailFilterBadge">Weitere Mail · ${esc(triage.reason||'Automatisch erkannt')}</div>`:''}<div class="mailMessageTop"><span>${m.workflow_status==='new'?'●':'✓'}</span><div><b>${esc(m.from_name||m.from_email||'Unbekannter Absender')}</b><small>${esc(m.from_email||'')} · ${esc(dt(m.received_at))}</small></div></div><h3>${esc(m.subject||'Ohne Betreff')}</h3><p>${esc(m.body_preview||m.body_text||'').slice(0,260)}</p><div class="mailMessageActions ${filtered?'mailFilteredActions':''}"><button class="btn ${filtered?'':'primary'} small" type="button" onclick="MailHub.review('${m.id}')">Prüfen & Antwort vorbereiten</button>${filtered?`<button class="btn small" type="button" onclick="MailHub.keepSender('${m.id}')">⭐ Künftig oben</button>`:''}</div></div>`;
  }
  function renderInbox(){
    const box=q('mailInboxList'),meta=q('mailInboxMeta'),sync=q('mailInboxSyncBtn');if(!box)return;
    const c=activeConnection();
    if(sync){sync.hidden=!(c?.status==='connected');sync.disabled=loading;}
    if(!c?.status==='connected'){if(meta)meta.textContent='Noch kein Firmen-Postfach verbunden';box.innerHTML='<div class="empty mailInboxEmpty">Verbinde dein Firmen-Postfach. Danach erscheinen wichtige Kundenmails automatisch hier.</div>';renderAssistantOverview();return}
    if(!messages.length){if(meta)meta.textContent='Postfach verbunden';box.innerHTML='<div class="empty mailInboxEmpty">Noch keine Nachrichten geladen. Tippe auf „Aktualisieren“.</div>';renderAssistantOverview();return}

    const triaged=messages.map(m=>({m,t:triageMessage(m)}));
    const primary=triaged.filter(x=>x.t.bucket==='primary');
    const filtered=triaged.filter(x=>x.t.bucket==='filtered');
    if(meta)meta.textContent=`${primary.length} im Hauptposteingang${filtered.length?` · ${filtered.length} weitere`:''}`;

    const notice=`<div class="mailTriageNotice"><span>🛡️</span><div><b>Im Zweifel bleibt die Mail hier</b><small>Nur eindeutige Newsletter und Automails landen unter „Weitere Mails“. Nichts wird gelöscht.</small></div></div>`;
    const main=primary.length?primary.map(x=>mailCard(x.m,x.t,false)).join(''):'<div class="empty mailInboxEmpty">Keine möglichen Kundenmails unter den zuletzt geladenen Nachrichten.</div>';
    const extra=filtered.length?`<div class="mailFilteredArea"><button type="button" class="mailFilteredToggle" onclick="MailHub.toggleFiltered()"><span><b>${showFiltered?'Weitere Mails ausblenden':'Weitere Mails anzeigen'} (${filtered.length})</b><small>Eindeutige Newsletter/Automails · nichts gelöscht</small></span><em>${showFiltered?'⌃':'⌄'}</em></button>${showFiltered?`<div class="mailFilteredList">${filtered.map(x=>mailCard(x.m,x.t,true)).join('')}</div>`:''}</div>`:'';
    box.innerHTML=notice+main+extra;
    renderAssistantOverview();
  }

  function showOAuthReturn(){
    let saved=null;try{saved=JSON.parse(sessionStorage.getItem('ap_mail_oauth_return_v1111')||sessionStorage.getItem('ap_mail_oauth_return_v1110')||'null');sessionStorage.removeItem('ap_mail_oauth_return_v1111');sessionStorage.removeItem('ap_mail_oauth_return_v1110')}catch{}
    if(!saved)return;
    setTimeout(()=>globalThis.toast?.(saved.mail==='connected'?'✓ Firmen-E-Mail erfolgreich verbunden':saved.message||'E-Mail-Verbindung konnte nicht abgeschlossen werden'),250);
  }

  async function refresh(){
    if(!['owner','office'].includes(role()))return;
    try{await Promise.all([loadCapabilities(),loadConnections()]);await Promise.all([loadMessages(),loadAssistantItems()]);homeLastRefreshAt=Date.now();renderConnection();renderInbox();renderHomeSecretariat();showOAuthReturn()}catch(e){console.error('MailHub refresh',e);renderConnection();renderInbox();renderHomeSecretariat()}
  }

  async function confirmProviderSwitch(){
    const c=activeConnection();if(!c?.status||c.status!=='connected')return true;
    return await globalThis.appConfirm?.({title:'Postfach wechseln?',text:`Aktuell ist ${c.account_email||connectionLabel(c)} verbunden. Beim Wechsel wird diese Verbindung getrennt; bereits importierte Nachrichten bleiben dokumentiert.`,confirmLabel:'Postfach wechseln',icon:'🔄'});
  }

  async function connectMicrosoft(){
    if(role()!=='owner')return globalThis.toast?.('Nur der Chef kann ein Firmen-Postfach verbinden.');
    if(!(await confirmProviderSwitch()))return;
    try{
      const r=await invoke('mail-account',{action:'microsoft_start'});
      if(!r.authorization_url)throw new Error('Microsoft-Verbindung konnte nicht gestartet werden.');
      location.href=r.authorization_url;
    }catch(e){globalThis.toast?.(e.message||'Microsoft-Verbindung ist noch nicht verfügbar.');}
  }

  function guessProvider(email=''){
    const domain=String(email).toLowerCase().split('@')[1]||'';
    if(domain==='gmx.de'||domain==='gmx.net'||domain==='gmx.com')return'gmx';
    return'';
  }
  function ensureImapSheet(){
    let el=q('mailImapBackdrop');if(el)return el;
    el=document.createElement('div');el.id='mailImapBackdrop';el.className='mailImapBackdrop';el.hidden=true;
    el.innerHTML=`<div class="mailImapSheet" role="dialog" aria-modal="true" aria-labelledby="mailImapTitle">
      <div class="mailImapHandle"></div>
      <div class="mailImapHead"><div><span class="securityBadge">SICHERES FIRMEN-POSTFACH</span><h2 id="mailImapTitle">Firmen-E-Mail verbinden</h2><p>Für WEB.DE, GMX, IONOS, STRATO, ALL-INKL und eigene Mailserver.</p></div><button type="button" class="btn small" onclick="MailHub.closeImapSetup()">Abbrechen</button></div>
      <div class="mailProviderPicks">
        <button type="button" data-provider="gmx" onclick="MailHub.pickImapProvider('gmx')"><b>GMX</b><small>imap.gmx.net</small></button>
        <button type="button" data-provider="ionos" onclick="MailHub.pickImapProvider('ionos')"><b>IONOS</b><small>imap.ionos.de</small></button>
        <button type="button" data-provider="strato" onclick="MailHub.pickImapProvider('strato')"><b>STRATO</b><small>imap.strato.de</small></button>
        <button type="button" data-provider="allinkl" onclick="MailHub.pickImapProvider('allinkl')"><b>ALL-INKL</b><small>kasserver.com</small></button>
        <button type="button" data-provider="custom" onclick="MailHub.pickImapProvider('custom')"><b>Andere</b><small>eigener IMAP-Server</small></button>
      </div>
      <form id="mailImapForm" class="mailImapForm" onsubmit="return MailHub.submitImap(event)">
        <label>E-Mail-Adresse<input id="mailImapEmail" type="email" autocomplete="username" inputmode="email" placeholder="info@firma.de" required></label>
        <label>Benutzername <span>meist die E-Mail-Adresse</span><input id="mailImapUsername" type="text" autocomplete="username" placeholder="wird automatisch übernommen"></label>
        <label id="mailImapHostWrap" hidden>IMAP-Server<input id="mailImapHost" type="text" autocapitalize="none" autocomplete="off" placeholder="z. B. w0123456.kasserver.com"></label>
        <label>Passwort / App-Passwort<input id="mailImapPassword" type="password" autocomplete="current-password" placeholder="••••••••" required></label>
        <div id="mailImapHint" class="mailImapHint"></div>
        <div id="mailImapError" class="mailImapError" hidden></div>
        <div class="mailImapSecurity"><span>🔐</span><p><b>Serverseitig verschlüsselt</b>Das Passwort wird nur zum Postfachzugriff verwendet, nicht im Browser gespeichert und später nicht wieder angezeigt.</p></div>
        <button id="mailImapSubmit" class="btn primary mailImapSubmit" type="submit">Sicher verbinden</button>
      </form>
    </div>`;
    el.addEventListener('click',e=>{if(e.target===el)closeImapSetup()});document.body.appendChild(el);return el;
  }

  async function openImapSetup(){
    if(role()!=='owner')return globalThis.toast?.('Nur der Chef kann ein Firmen-Postfach verbinden.');
    if(!(await confirmProviderSwitch()))return;
    const el=ensureImapSheet(),c=activeConnection();
    const email=c?.account_email||'';imapProvider=guessProvider(email)||'gmx';
    q('mailImapEmail').value=email;q('mailImapUsername').value='';q('mailImapPassword').value='';q('mailImapHost').value='';q('mailImapError').hidden=true;
    pickImapProvider(imapProvider);el.hidden=false;document.body.classList.add('mailSheetOpen');setTimeout(()=>q('mailImapEmail')?.focus(),180);
  }
  function closeImapSetup(){const el=q('mailImapBackdrop');if(el)el.hidden=true;document.body.classList.remove('mailSheetOpen');const p=q('mailImapPassword');if(p)p.value=''}
  function pickImapProvider(provider){
    imapProvider=provider;document.querySelectorAll('.mailProviderPicks [data-provider]').forEach(b=>b.classList.toggle('active',b.dataset.provider===provider));
    const hostWrap=q('mailImapHostWrap'),hint=q('mailImapHint');if(hostWrap)hostWrap.hidden=!['allinkl','custom'].includes(provider);
    const texts={gmx:'GMX: POP3/IMAP muss in den GMX-Einstellungen aktiviert sein. Wenn 2FA aktiv ist, verwende ein anwendungsspezifisches Passwort.',ionos:'IONOS: Verwende die vollständige Postfach-Adresse und das zugehörige E-Mail-Passwort.',strato:'STRATO: Verwende die vollständige Postfach-Adresse und das Passwort des E-Mail-Postfachs.',allinkl:'ALL-INKL: Trage zusätzlich deinen IMAP-Server ein, z. B. w0123456.kasserver.com.',custom:'Eigener Server: Nur verschlüsseltes IMAP über Port 993 wird zugelassen.'};if(hint)hint.textContent=texts[provider]||'';
  }

  async function submitImap(event){
    event?.preventDefault?.();if(loading)return false;
    const email=q('mailImapEmail')?.value.trim()||'',username=q('mailImapUsername')?.value.trim()||email,password=q('mailImapPassword')?.value||'',imap_host=q('mailImapHost')?.value.trim()||'';
    const err=q('mailImapError'),btn=q('mailImapSubmit');if(err){err.hidden=true;err.textContent=''};loading=true;if(btn){btn.disabled=true;btn.textContent='Verbindung wird geprüft …'};
    try{
      const r=await invoke('mail-account',{action:'imap_connect',provider_key:imapProvider,email,username,password,imap_host});
      q('mailImapPassword').value='';closeImapSetup();await loadConnections();await loadMessages();renderConnection();renderInbox();globalThis.toast?.('✓ Firmen-Postfach sicher verbunden');
      if(r.connection?.id)await sync(r.connection.id);
    }catch(e){if(err){err.textContent=e.message||'Postfach konnte nicht verbunden werden.';err.hidden=false}else globalThis.toast?.(e.message||'Postfach konnte nicht verbunden werden.')}
    finally{loading=false;if(btn){btn.disabled=false;btn.textContent='Sicher verbinden'}}
    return false;
  }

  async function sync(connectionId){
    if(loading)return;loading=true;renderInbox();
    const btn=q('mailInboxSyncBtn');if(btn)btn.textContent='Wird abgerufen …';
    try{const r=await invoke('mail-sync',{connection_id:connectionId});await loadConnections();await Promise.all([loadMessages(),loadAssistantItems()]);homeLastRefreshAt=Date.now();renderConnection();renderInbox();renderHomeSecretariat();globalThis.toast?.(r.new_count?`✓ ${r.new_count} neue Mail${r.new_count===1?'':'s'} geladen`:'Posteingang ist aktuell')}
    catch(e){globalThis.toast?.(e.message||'Mails konnten nicht geladen werden')}
    finally{loading=false;if(btn)btn.textContent='↻ Neue Mails abrufen';renderInbox();renderHomeSecretariat()}
  }

  async function disconnect(connectionId){
    if(role()!=='owner')return;
    const ok=await globalThis.appConfirm?.({title:'E-Mail-Verbindung trennen?',text:'AngebotsPilot kann danach keine neuen Mails mehr abrufen. Bereits importierte Nachrichten und Prüfverläufe bleiben dokumentiert.',confirmLabel:'Verbindung trennen',icon:'🔌'});if(!ok)return;
    try{await invoke('mail-account',{action:'disconnect',connection_id:connectionId});await refresh();globalThis.toast?.('E-Mail-Verbindung getrennt')}catch(e){globalThis.toast?.(e.message||'Verbindung konnte nicht getrennt werden')}
  }

  function providerInfo(provider){
    const msg=provider==='google'?'Google / Workspace ist noch nicht verfügbar.':'Andere Firmen-E-Mail kann sicher mit AngebotsPilot verbunden werden.';
    globalThis.appConfirm?.({title:provider==='google'?'Google / Workspace':'Andere Firmen-E-Mail',text:msg,confirmLabel:'Verstanden',icon:provider==='google'?'G':'@'});
  }

  function toggleFiltered(){showFiltered=!showFiltered;renderInbox()}
  function keepSender(id){
    const m=messages.find(x=>x.id===id),email=normEmail(m?.from_email);if(!email)return;
    const set=keptSenders();set.add(email);localStorage.setItem('ap_mail_keep_senders_v1117',JSON.stringify([...set]));renderInbox();renderHomeSecretariat();globalThis.toast?.('⭐ Absender bleibt künftig im Hauptposteingang');
  }

  async function review(id){const m=messages.find(x=>x.id===id);if(!m)return;globalThis.showScreen?.('emailAssistant');await new Promise(r=>setTimeout(r,30));globalThis.EmailAssistant?.loadMailMessage?.(m)}

  async function sendReply(mailMessageId,replyBody,requestId){
    return await invoke('mail-send',{action:'reply',mail_message_id:mailMessageId,reply_body:replyBody,request_id:requestId});
  }
  async function sendInvoiceMail(invoiceId,kind,replyBody,requestId){
    return await invoke('invoice-followup-send',{invoice_id:invoiceId,kind,reply_body:replyBody,request_id:requestId});
  }

  globalThis.MailHub={refresh,refreshHome,syncHome,openAssistantItem,openConnectionSettings,jumpInbox,connectMicrosoft,openImapSetup,closeImapSetup,pickImapProvider,submitImap,sync,disconnect,providerInfo,toggleFiltered,keepSender,review,sendReply,sendInvoiceMail,_state:()=>({connections,messages,assistantItems,capabilities})};
  window.addEventListener('load',()=>{setTimeout(()=>refreshHome(false).catch(()=>{}),1100);setTimeout(()=>refreshHome(false).catch(()=>{}),3600)});
  window.addEventListener('angebotspilot:syncstate',()=>{if(Date.now()-homeLastRefreshAt>5000)setTimeout(()=>refreshHome(false).catch(()=>{}),180)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&q('today')?.classList.contains('active'))refreshHome(false).catch(()=>{})});
})();
