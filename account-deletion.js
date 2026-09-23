/* AngebotsPilot v11.32.6 – Store-konformer Kontolöschauftrag.
   Die endgültige Löschung wird serverseitig verarbeitet; gesetzliche Aufbewahrung bleibt vorbehalten. */
(function installAccountDeletion(){
  'use strict';

  const VERSION='11.32.6';
  const FLAG='__AP_ACCOUNT_DELETION_11_32_1__';
  if(globalThis[FLAG])return;
  globalThis[FLAG]=true;

  let current=null;
  let openingFromWeb=false;

  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const ctx=()=>{try{return globalThis.APCloudContext?.()||null}catch(e){return null}};
  const notify=(text,tone='info')=>{try{globalThis.toast?.(text,tone)}catch(e){console.log(text)}};
  const fmt=v=>{if(!v)return'–';try{return new Date(v).toLocaleString('de-DE')}catch(e){return String(v)}};
  const pending=s=>['requested','in_review'].includes(String(s||''));

  function ensureStyles(){
    if(q('accountDeletionStyles'))return;
    const s=document.createElement('style');s.id='accountDeletionStyles';s.textContent=`
      .accountDeleteCard{display:grid;gap:11px}.accountDeleteFacts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.accountDeleteFact{padding:11px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025)}.accountDeleteFact b,.accountDeleteFact span{display:block}.accountDeleteFact span{font-size:.69rem;color:var(--muted);line-height:1.4;margin-top:3px}.accountDeleteActions{display:flex;gap:8px;flex-wrap:wrap}.accountDeleteActions .btn{flex:1;min-width:180px}.accountDeleteStatus{padding:11px 12px;border-radius:12px;border:1px solid var(--line);font-size:.73rem;line-height:1.45}.accountDeleteStatus.pending{border-color:rgba(255,190,80,.3);background:rgba(255,190,80,.07)}.accountDeleteStatus.done{border-color:rgba(95,220,140,.25);background:rgba(95,220,140,.06)}.accountDeleteModal{position:fixed;inset:0;z-index:10120;background:rgba(0,0,0,.74);display:flex;align-items:flex-end;justify-content:center;padding:12px}.accountDeleteModal.hidden{display:none}.accountDeleteSheet{width:min(680px,100%);max-height:92vh;overflow:auto;background:var(--panel,#13171f);border:1px solid var(--line);border-radius:22px;padding:18px}.accountDeleteHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.accountDeleteHead h3{margin:3px 0 5px}.accountDeleteHead p{margin:0;color:var(--muted);font-size:.75rem;line-height:1.45}.accountDeleteClose{border:0;background:transparent;color:inherit;font-size:1.5rem}.accountDeleteWarning{padding:12px;border:1px solid rgba(255,110,110,.24);background:rgba(255,90,90,.06);border-radius:13px;font-size:.74rem;line-height:1.5;margin:14px 0}.accountDeleteInfo{padding:11px;border:1px solid var(--line);border-radius:12px;font-size:.72rem;line-height:1.5;margin:10px 0}.accountDeleteInfo b{display:block;margin-bottom:4px}.accountDeleteCompanies{display:grid;gap:7px;margin-top:8px}.accountDeleteCompany{padding:9px;border:1px solid var(--line);border-radius:10px;font-size:.7rem}.accountDeletePhrase{margin-top:14px}.accountDeletePhrase .input{margin-top:6px}.accountDeleteFooter{display:flex;gap:8px;margin-top:12px}.accountDeleteFooter .btn{flex:1}.accountDeleteExternal{font-size:.68rem;color:var(--muted);line-height:1.45}.accountDeleteExternal a{text-decoration:underline;color:inherit}@media(max-width:650px){.accountDeleteFacts{grid-template-columns:1fr}.accountDeleteActions,.accountDeleteFooter{flex-direction:column}.accountDeleteActions .btn,.accountDeleteFooter .btn{width:100%}}
    `;document.head.appendChild(s);
  }

  function ensureUI(){
    ensureStyles();
    const privacy=q('privacy');
    if(privacy&&!q('accountDeletionCard')){
      const auditTitle=[...privacy.querySelectorAll('.sectionTitle')].find(x=>/Aktivitätsprotokoll/i.test(x.textContent||''));
      const title=document.createElement('div');title.className='sectionTitle accountDeletionInjected';title.innerHTML='<h2>AngebotsPilot-Konto</h2><span>Store-ready</span>';
      const card=document.createElement('div');card.className='card accountDeleteCard';card.id='accountDeletionCard';
      card.innerHTML=`
        <div class="accountDeleteFacts">
          <div class="accountDeleteFact"><b>Konto vollständig löschen</b><span>Du kannst die Löschung deines AngebotsPilot-Accounts direkt hier beantragen – nicht nur lokale Gerätedaten entfernen.</span></div>
          <div class="accountDeleteFact"><b>Aufbewahrung getrennt</b><span>Gesetzlich notwendige Rechnungs- und Geschäftsunterlagen können trotz Kontolöschung für die erforderliche Dauer aufbewahrt werden.</span></div>
        </div>
        <div id="accountDeletionCardStatus" class="accountDeleteStatus">Status wird geladen …</div>
        <div class="accountDeleteActions"><button class="btn danger" type="button" onclick="AccountDeletion.open()">Kontolöschung verwalten</button><button class="btn" type="button" onclick="AccountDeletion.openWebInfo()">Web-Löschseite</button></div>
        <div class="accountDeleteExternal">Die öffentliche Web-Ressource für die Store-Angaben ist <a href="account-deletion.html" target="_blank" rel="noopener">account-deletion.html</a>.</div>`;
      if(auditTitle)auditTitle.before(title,card); else privacy.append(title,card);
    }

    if(!q('accountDeletionModal'))document.body.insertAdjacentHTML('beforeend',`
      <div id="accountDeletionModal" class="accountDeleteModal hidden" role="dialog" aria-modal="true" aria-labelledby="accountDeletionTitle">
        <div class="accountDeleteSheet">
          <div class="accountDeleteHead"><div><span class="securityBadge">🗑️ KONTO</span><h3 id="accountDeletionTitle">AngebotsPilot-Konto löschen</h3><p>Hier startest du die Löschung deines Accounts und der nicht mehr benötigten personenbezogenen Kontodaten.</p></div><button class="accountDeleteClose" type="button" aria-label="Schließen" onclick="AccountDeletion.close()">×</button></div>
          <div class="accountDeleteWarning"><b>Das ist etwas anderes als „lokale Daten löschen“.</b><br>Der Löschauftrag betrifft dein AngebotsPilot-Benutzerkonto. Ein laufendes Abo wird im Löschprozess berücksichtigt; bei alleiniger Inhaberschaft eines Betriebs müssen Eigentum und aufbewahrungspflichtige Geschäftsunterlagen geordnet behandelt werden.</div>
          <div id="accountDeletionDetail" class="accountDeleteInfo">Status wird geladen …</div>
          <div id="accountDeletionRequestWrap">
            <div class="accountDeleteInfo"><b>Was passiert nach dem Antrag?</b>Nicht aufbewahrungspflichtige Kontodaten werden entfernt. Gesetzlich oder zur Rechtsverteidigung notwendige Geschäftsunterlagen können getrennt bestehen bleiben. Wenn die Bearbeitung nicht sofort abgeschlossen werden kann, bleibt der Status hier sichtbar.</div>
            <div class="field accountDeletePhrase"><label>Zur Bestätigung <b>KONTO LÖSCHEN</b> eingeben</label><input id="accountDeletionPhrase" class="input" autocomplete="off" placeholder="KONTO LÖSCHEN"></div>
            <div class="accountDeleteFooter"><button class="btn" type="button" onclick="AccountDeletion.close()">Abbrechen</button><button id="accountDeletionRequestBtn" class="btn danger" type="button" onclick="AccountDeletion.request()">Löschauftrag starten</button></div>
          </div>
          <div id="accountDeletionPendingActions" class="accountDeleteFooter hidden"><button class="btn" type="button" onclick="AccountDeletion.openSubscription()">Abo prüfen</button><button class="btn danger" type="button" onclick="AccountDeletion.cancel()">Löschauftrag zurücknehmen</button></div>
        </div>
      </div>`);
  }

  async function refresh(){
    ensureUI();
    const c=ctx();
    const card=q('accountDeletionCardStatus'),detail=q('accountDeletionDetail');
    if(!c?.client||!c?.session?.user){
      current=null;
      if(card){card.className='accountDeleteStatus';card.textContent='Für Kontolöschung bitte mit deinem AngebotsPilot-Konto anmelden.'}
      if(detail)detail.innerHTML='<b>Nicht angemeldet</b>Bitte melde dich zuerst mit dem zu löschenden Konto an.';
      renderActions();
      return null;
    }
    try{
      const {data,error}=await c.client.rpc('get_my_account_deletion_request');
      if(error)throw error;
      current=data&&data.id?data:null;
      renderStatus();
      return current;
    }catch(e){
      console.error('Account deletion status',e);
      if(card){card.className='accountDeleteStatus';card.textContent='Löschstatus konnte gerade nicht geladen werden.'}
      if(detail)detail.textContent='Der Löschstatus konnte gerade nicht geladen werden. Bitte später erneut versuchen.';
      return null;
    }
  }

  function renderStatus(){
    const card=q('accountDeletionCardStatus'),detail=q('accountDeletionDetail');
    if(!current){
      if(card){card.className='accountDeleteStatus';card.innerHTML='<b>Kein Löschauftrag aktiv.</b><br>Dein Konto bleibt unverändert.'}
      if(detail)detail.innerHTML='<b>Kein aktiver Löschauftrag</b>Wenn du dein Konto löschen möchtest, kannst du den Auftrag unten bestätigen.';
      renderActions();return;
    }
    const isPending=pending(current.status);
    const label={requested:'Beantragt',in_review:'In Prüfung',completed:'Abgeschlossen',cancelled:'Zurückgenommen',rejected:'Abgelehnt'}[current.status]||current.status;
    const blocker=current.blocker_note?`<div class="accountDeleteInfo"><b>Vor Abschluss zu klären</b>${esc(current.blocker_note)}</div>`:'';
    const companies=Array.isArray(current.companies)?current.companies:[];
    const companyHtml=companies.length?`<div class="accountDeleteCompanies">${companies.map(x=>`<div class="accountDeleteCompany"><b>${esc(x.company_name||'Betrieb')}</b> · ${esc(x.role||'')} ${x.sole_owner?'· alleiniger Inhaber':''}</div>`).join('')}</div>`:'';
    const body=`<b>Status: ${esc(label)}</b><br>Beantragt: ${esc(fmt(current.requested_at))}${current.target_at?`<br>Zieltermin: ${esc(fmt(current.target_at))}`:''}${blocker}${companyHtml}<div class="accountDeleteExternal" style="margin-top:8px">${esc(current.retention_notice||'')}</div>`;
    if(card){card.className='accountDeleteStatus '+(isPending?'pending':current.status==='completed'?'done':'');card.innerHTML=`<b>${esc(label)}</b>${current.requested_at?` · ${esc(fmt(current.requested_at))}`:''}${current.blocker_note?'<br>Vor Abschluss ist noch eine Prüfung erforderlich.':''}`}
    if(detail)detail.innerHTML=body;
    renderActions();
  }

  function renderActions(){
    const req=q('accountDeletionRequestWrap'),pendingActions=q('accountDeletionPendingActions');
    const active=current&&pending(current.status);
    if(req)req.classList.toggle('hidden',!!active);
    if(pendingActions)pendingActions.classList.toggle('hidden',!active);
  }

  async function open(){
    ensureUI();
    q('accountDeletionPhrase')&&(q('accountDeletionPhrase').value='');
    q('accountDeletionModal')?.classList.remove('hidden');
    await refresh();
  }
  function close(){q('accountDeletionModal')?.classList.add('hidden')}

  async function request(){
    const c=ctx();
    if(!c?.client||!c?.session?.user)return notify('Bitte zuerst anmelden.','error');
    if(String(q('accountDeletionPhrase')?.value||'').trim().toUpperCase()!=='KONTO LÖSCHEN')return notify('Bitte KONTO LÖSCHEN eingeben.','warning');
    const btn=q('accountDeletionRequestBtn');if(btn){btn.disabled=true;btn.textContent='Wird beantragt …'}
    try{
      const {data,error}=await c.client.rpc('request_account_deletion',{p_source:openingFromWeb?'web':'app'});
      if(error)throw error;
      if(!data?.ok)throw new Error('Der Löschauftrag konnte nicht angelegt werden.');
      current=data;
      q('accountDeletionPhrase')&&(q('accountDeletionPhrase').value='');
      renderStatus();
      notify('✓ Kontolöschung wurde beantragt.','success');
    }catch(e){console.error(e);notify(String(e?.message||'Kontolöschung konnte nicht beantragt werden.'),'error')}
    finally{if(btn){btn.disabled=false;btn.textContent='Löschauftrag starten'}}
  }

  async function cancel(){
    const c=ctx();if(!c?.client||!current?.id)return;
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:'Löschauftrag zurücknehmen?',text:'Dein AngebotsPilot-Konto bleibt bestehen. Bereits gesetzlich oder technisch notwendige Protokolle des Löschauftrags bleiben als Nachweis erhalten.',confirmLabel:'Zurücknehmen',icon:'↩️'}):confirm('Löschauftrag zurücknehmen?');
    if(!ok)return;
    try{
      const {data,error}=await c.client.rpc('cancel_account_deletion',{p_request_id:current.id});if(error)throw error;
      current={...current,...data};renderStatus();notify('Löschauftrag zurückgenommen.','success');
    }catch(e){console.error(e);notify(String(e?.message||'Löschauftrag konnte nicht zurückgenommen werden.'),'error')}
  }

  function openSubscription(){
    close();
    if(typeof globalThis.openSubscription==='function')globalThis.openSubscription();
    else globalThis.showScreen?.('subscription');
  }

  function openWebInfo(){window.open('account-deletion.html','_blank','noopener')}

  function handleExternalRoute(){
    let url;try{url=new URL(location.href)}catch(e){return}
    if(url.searchParams.get('accountDeletion')!=='1')return;
    openingFromWeb=true;
    const c=ctx();
    if(!c?.session?.user)return;
    url.searchParams.delete('accountDeletion');
    history.replaceState({},'',url.pathname+(url.search||'')+(url.hash||''));
    globalThis.showScreen?.('privacy');
    setTimeout(()=>open(),100);
  }

  const api=Object.freeze({version:VERSION,open,close,refresh,request,cancel,openSubscription,openWebInfo,status:()=>current});
  globalThis.AccountDeletion=api;

  function boot(){ensureUI();refresh();handleExternalRoute();[800,1800,3500].forEach(ms=>setTimeout(()=>{refresh();handleExternalRoute()},ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('angebotspilot:syncstate',()=>{refresh();handleExternalRoute()});
})();
