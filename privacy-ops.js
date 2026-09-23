/* AngebotsPilot v11.32.5 – Datenschutz-Anfragen, Subprozessoren & Aufbewahrung
   Technische Unterstützung; keine automatische rechtliche Einzelfallentscheidung. */
(function installPrivacyOps(){
  'use strict';

  const VERSION='11.32.5';
  const FLAG='__AP_PRIVACY_OPS_11_32_1__';
  if(globalThis[FLAG])return;
  globalThis[FLAG]=true;

  const TYPES={
    access:'Auskunft',
    portability:'Datenübertragbarkeit',
    rectification:'Berichtigung',
    erasure:'Löschung',
    restriction:'Einschränkung',
    objection:'Widerspruch',
    other:'Sonstige Anfrage'
  };
  const STATUS={open:'Offen',in_review:'In Prüfung',waiting:'Rückfrage',completed:'Abgeschlossen',rejected:'Abgelehnt'};
  const RETENTION={
    DE:{title:'Deutschland',summary:'Buchungsbelege und Rechnungen regelmäßig 8 Jahre ab Ende des Kalenderjahres; je nach Unterlagenkategorie gelten daneben 6- oder 10-jährige Fristen.',source:'§ 147 AO / § 14b UStG'},
    AT:{title:'Österreich',summary:'Buchhaltungsunterlagen und Belege regelmäßig 7 Jahre; Sonderfälle können längere Fristen auslösen.',source:'USP/BMF Aufbewahrungspflicht'},
    CH:{title:'Schweiz',summary:'Geschäftsbücher und Buchungsbelege regelmäßig 10 Jahre; Sonderfälle können längere Fristen auslösen.',source:'OR 958f / GeBüV'}
  };
  const SUBPROCESSORS=[
    {name:'Supabase',purpose:'Datenbank, Authentifizierung und Dateispeicher',state:'aktiv'},
    {name:'Railway',purpose:'Serverseitige E-Rechnungs-/Validator-Dienste',state:'aktiv'},
    {name:'Stripe',purpose:'Abo-Abrechnung und Zahlungsabwicklung',state:'nur bei Abo/Billing'},
    {name:'GitHub Pages',purpose:'Auslieferung der statischen Web-App',state:'aktiv'},
    {name:'Open-Meteo',purpose:'Wetterdaten',state:'nur bei aktivierter Wetterfunktion'},
    {name:'Microsoft / verbundener Mailprovider',purpose:'Firmen-Mailbox',state:'nur nach Verbindung durch den Betrieb'}
  ];

  let activeRequestId='';
  let requests=[];

  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  const ctx=()=>{try{return globalThis.APCloudContext?.()||null}catch(e){return null}};
  const role=()=>ctx()?.membership?.role||globalThis.data?.privacy?.role||'owner';
  const canManage=()=>['owner','office'].includes(String(role()));
  const notify=(text,tone='info')=>{try{globalThis.toast?.(text,tone)}catch(e){console.log(text)}};
  const country=()=>String(globalThis.data?.settings?.countryCode||ctx()?.company?.country_code||'DE').toUpperCase();
  const safeFile=v=>String(v||'kunde').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'kunde';
  const isoDateTime=v=>{try{return new Date(v).toLocaleString('de-DE')}catch(e){return String(v||'')}};

  function ensureStyles(){
    if(q('privacyOpsStyles'))return;
    const s=document.createElement('style');s.id='privacyOpsStyles';s.textContent=`
      .privacyOpsCard{display:grid;gap:12px}.privacyOpsGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.privacyOpsFact{padding:11px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025)}.privacyOpsFact b,.privacyOpsFact span{display:block}.privacyOpsFact span{font-size:.69rem;color:var(--muted);margin-top:3px;line-height:1.35}.privacyOpsActions{display:flex;gap:8px;flex-wrap:wrap}.privacyOpsOverlay{position:fixed;inset:0;z-index:10080;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;padding:14px}.privacyOpsOverlay.hidden{display:none}.privacyOpsSheet{width:min(760px,100%);max-height:90vh;overflow:auto;background:var(--panel,#13171f);border:1px solid var(--line);border-radius:22px;padding:18px}.privacyOpsHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.privacyOpsHead h3{margin:2px 0}.privacyOpsHead p{margin:0;color:var(--muted);font-size:.74rem;line-height:1.4}.privacyOpsClose{border:0;background:transparent;color:inherit;font-size:1.5rem}.privacyOpsForm{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:15px 0}.privacyOpsForm .full{grid-column:1/-1}.privacyOpsRow{border-top:1px solid var(--line);padding:13px 0;display:grid;gap:7px}.privacyOpsRowTop{display:flex;gap:10px;justify-content:space-between;align-items:flex-start}.privacyOpsBadges{display:flex;gap:6px;flex-wrap:wrap}.privacyOpsBadge{font-size:.65rem;border:1px solid var(--line);padding:4px 7px;border-radius:999px;color:var(--muted)}.privacyOpsRow p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.45}.privacyOpsRowActions{display:flex;gap:7px;flex-wrap:wrap}.privacyOpsRetention{padding:11px 12px;border-radius:12px;border:1px solid rgba(255,190,80,.28);background:rgba(255,190,80,.06);font-size:.72rem;line-height:1.45}.privacyOpsSub{display:grid;gap:8px}.privacyOpsSubRow{border:1px solid var(--line);border-radius:12px;padding:11px}.privacyOpsSubRow b,.privacyOpsSubRow span,.privacyOpsSubRow small{display:block}.privacyOpsSubRow span,.privacyOpsSubRow small{color:var(--muted);font-size:.7rem;margin-top:3px}.privacyOpsEmpty{text-align:center;color:var(--muted);padding:20px 8px}.privacyOpsLegal{font-size:.69rem;color:var(--muted);line-height:1.45}
      @media(max-width:650px){.privacyOpsGrid,.privacyOpsForm{grid-template-columns:1fr}.privacyOpsForm .full{grid-column:auto}.privacyOpsActions,.privacyOpsRowActions{flex-direction:column}.privacyOpsActions .btn,.privacyOpsRowActions .btn{width:100%}.privacyOpsOverlay{padding:8px}}
    `;document.head.appendChild(s);
  }

  function ensureUI(){
    ensureStyles();
    const privacy=q('privacy');
    if(privacy&&!q('privacyOpsCard')){
      const titles=[...privacy.querySelectorAll('.sectionTitle')];
      const legalTitle=titles.find(x=>/rechtliches/i.test(x.textContent||''));
      const title=document.createElement('div');title.className='sectionTitle privacyOpsInjected';title.innerHTML='<h2>Datenschutz-Anfragen</h2><span>v11.32</span>';
      const card=document.createElement('div');card.className='card privacyOpsCard';card.id='privacyOpsCard';
      card.innerHTML=`
        <div class="privacyOpsGrid">
          <div class="privacyOpsFact"><b>Betroffenenanfragen</b><span>Auskunft, Export, Berichtigung, Löschung, Einschränkung und Widerspruch nachvollziehbar verwalten.</span></div>
          <div class="privacyOpsFact"><b>Aufbewahrung</b><span id="privacyOpsRetentionSummary">Wird aus dem Betriebsland abgeleitet.</span></div>
          <div class="privacyOpsFact"><b>Tracking</b><span>Keine Analytics-/Werbetracker im Kernworkflow aktiv.</span></div>
        </div>
        <div class="privacyOpsActions">
          <button class="btn primary" type="button" onclick="PrivacyOps.open()">Anfragen verwalten</button>
          <button class="btn" type="button" onclick="PrivacyOps.exportCompany()">Betriebsexport</button>
          <button class="btn" type="button" onclick="PrivacyOps.showSubprocessors()">Dienstleister / Subprozessoren</button>
        </div>
        <div class="privacyOpsLegal">Löschanfragen führen nicht automatisch zur Vernichtung von Rechnungen oder anderen gesetzlich aufzubewahrenden Unterlagen. Die App dokumentiert Anfrage, Prüfstatus und einen eventuellen Aufbewahrungsvorbehalt.</div>`;
      if(legalTitle){legalTitle.before(title,card)}else privacy.append(title,card);
    }

    if(!q('privacyOpsModal'))document.body.insertAdjacentHTML('beforeend',`
      <div class="privacyOpsOverlay hidden" id="privacyOpsModal">
        <div class="privacyOpsSheet">
          <div class="privacyOpsHead"><div><span class="securityBadge">🔐 DATENSCHUTZ</span><h3>Betroffenenanfragen</h3><p>Interne Fallverwaltung für Auskunft, Export, Berichtigung und Löschprüfung.</p></div><button class="privacyOpsClose" onclick="PrivacyOps.close()">×</button></div>
          <div class="privacyOpsForm">
            <div class="field"><label>Kunde / betroffene Person</label><select class="input" id="privacyOpsCustomer"></select></div>
            <div class="field"><label>Anfragetyp</label><select class="input" id="privacyOpsType">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
            <div class="field"><label>Zieldatum (optional)</label><input class="input" id="privacyOpsTarget" type="date"></div>
            <div class="field"><label>Betriebsland</label><input class="input" id="privacyOpsCountry" readonly></div>
            <div class="field full"><label>Interne Notiz / Anlass (optional)</label><textarea class="input" id="privacyOpsNote" rows="2" placeholder="z. B. Anfrage per E-Mail am …"></textarea></div>
            <button class="btn primary full" type="button" onclick="PrivacyOps.create()">Anfrage anlegen</button>
          </div>
          <div id="privacyOpsRetention" class="privacyOpsRetention"></div>
          <div id="privacyOpsList"><div class="privacyOpsEmpty">Anfragen werden geladen …</div></div>
        </div>
      </div>
      <div class="privacyOpsOverlay hidden" id="privacyOpsSubModal">
        <div class="privacyOpsSheet"><div class="privacyOpsHead"><div><span class="securityBadge">🧩 DIENSTLEISTER</span><h3>Subprozessor-/Dienstleister-Arbeitsliste</h3><p>Technischer Ist-Stand. AVV/DPA, Anschrift, Region und Vertragsgrundlage werden vor Live-Verkauf final geprüft.</p></div><button class="privacyOpsClose" onclick="PrivacyOps.closeSubprocessors()">×</button></div><div id="privacyOpsSubList" class="privacyOpsSub"></div></div>
      </div>`);
  }

  function updateCard(){
    ensureUI();
    const c=country(),ret=RETENTION[c]||RETENTION.DE;
    const el=q('privacyOpsRetentionSummary');if(el)el.textContent=ret.summary;
  }

  function customers(){return Array.isArray(globalThis.data?.customers)?globalThis.data.customers:[]}
  function populateCustomers(){
    const select=q('privacyOpsCustomer');if(!select)return;
    const rows=customers().slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));
    select.innerHTML='<option value="">Bitte auswählen</option>'+rows.map(c=>`<option value="${esc(c.id)}">${esc(c.name||'Kunde')} ${c.email?`· ${esc(c.email)}`:''}</option>`).join('');
    q('privacyOpsCountry').value=country();
  }

  function retentionText(code){
    const r=RETENTION[code]||RETENTION.DE;
    return `<b>${esc(r.title)} – Aufbewahrungs-Richtwert</b><br>${esc(r.summary)}<br><small>${esc(r.source)} · Sonderfälle und laufende Verfahren können Fristen verlängern. AngebotsPilot löscht deshalb keine finalisierten Belege automatisch.</small>`;
  }

  async function open(){
    ensureUI();
    if(!canManage())return notify('Nur Inhaber oder Büro können Datenschutz-Anfragen verwalten.','error');
    populateCustomers();
    q('privacyOpsRetention').innerHTML=retentionText(country());
    q('privacyOpsModal').classList.remove('hidden');
    await refresh();
  }
  function close(){q('privacyOpsModal')?.classList.add('hidden')}

  async function resolveCloudCustomer(localId){
    const c=ctx();if(!c?.client||!c?.company?.id||!localId)return null;
    const {data,error}=await c.client.from('customers').select('id,local_id,name,email,phone,address,country_code,vat_id,buyer_reference,e_invoice_address,customer_type,deleted_at').eq('company_id',c.company.id).eq('local_id',String(localId)).maybeSingle();
    if(error)throw error;return data||null;
  }

  async function create(){
    const c=ctx();if(!c?.client||!c?.company?.id||!c?.session?.user)return notify('Cloud-Anmeldung erforderlich.','error');
    if(!canManage())return notify('Keine Berechtigung.','error');
    const localId=q('privacyOpsCustomer')?.value||'',local=customers().find(x=>String(x.id)===String(localId));
    if(!local)return notify('Bitte zuerst einen Kunden auswählen.','warning');
    const type=q('privacyOpsType')?.value||'access',target=q('privacyOpsTarget')?.value||'',note=q('privacyOpsNote')?.value?.trim()||'';
    try{
      const cloudCustomer=await resolveCloudCustomer(localId);
      const snapshot={local_id:String(local.id||''),email:local.email||'',phone:local.phone||'',address:local.address||'',contact:local.contact||'',vat_id:local.vatId||'',customer_type:local.customerType||'auto'};
      const payload={
        company_id:c.company.id,
        customer_id:cloudCustomer?.id||null,
        request_type:type,
        status:'open',
        country_code:String(local.countryCode||country()).toUpperCase(),
        subject_name_snapshot:String(local.name||''),
        subject_contact_snapshot:snapshot,
        target_at:target?new Date(target+'T12:00:00').toISOString():null,
        retention_note:type==='erasure'?'Löschung erst nach Prüfung gesetzlicher Aufbewahrungs- und Nachweispflichten.':'',
        resolution_note:note,
        created_by:c.session.user.id
      };
      const {error}=await c.client.from('privacy_requests').insert(payload);if(error)throw error;
      q('privacyOpsNote').value='';q('privacyOpsTarget').value='';
      notify('✓ Datenschutz-Anfrage angelegt.','success');
      await refresh();
    }catch(e){console.error(e);notify(String(e?.message||'Anfrage konnte nicht angelegt werden.'),'error')}
  }

  async function refresh(){
    const c=ctx(),list=q('privacyOpsList');if(!list)return;
    if(!c?.client||!c?.company?.id){list.innerHTML='<div class="privacyOpsEmpty">Cloud-Anmeldung erforderlich.</div>';return}
    try{
      const {data,error}=await c.client.from('privacy_requests').select('*').eq('company_id',c.company.id).order('requested_at',{ascending:false}).limit(200);if(error)throw error;
      requests=data||[];renderList();
    }catch(e){console.error(e);list.innerHTML='<div class="privacyOpsEmpty">Anfragen konnten nicht geladen werden.</div>'}
  }

  function renderList(){
    const list=q('privacyOpsList');if(!list)return;
    if(!requests.length){list.innerHTML='<div class="privacyOpsEmpty">Noch keine Datenschutz-Anfragen.</div>';return}
    list.innerHTML=requests.map(r=>{
      const retention=r.request_type==='erasure'||r.legal_hold;
      return `<div class="privacyOpsRow">
        <div class="privacyOpsRowTop"><div><b>${esc(r.subject_name_snapshot||'Betroffene Person')}</b><div class="privacyOpsBadges"><span class="privacyOpsBadge">${esc(TYPES[r.request_type]||r.request_type)}</span><span class="privacyOpsBadge">${esc(STATUS[r.status]||r.status)}</span>${r.legal_hold?'<span class="privacyOpsBadge">Aufbewahrungsvorbehalt</span>':''}</div></div><small>${esc(isoDateTime(r.requested_at))}</small></div>
        <p>${r.target_at?`Zieldatum: ${esc(new Date(r.target_at).toLocaleDateString('de-DE'))} · `:''}${retention?'Gesetzliche Aufbewahrung wird vor Löschung geprüft.':'Keine automatische Löschung.'}${r.resolution_note?` · Notiz: ${esc(r.resolution_note)}`:''}</p>
        <div class="privacyOpsRowActions">
          <button class="btn small" type="button" onclick="PrivacyOps.exportSubject('${r.id}')">Datenkopie</button>
          <button class="btn small" type="button" onclick="PrivacyOps.setStatus('${r.id}','in_review')">In Prüfung</button>
          <button class="btn small" type="button" onclick="PrivacyOps.toggleHold('${r.id}')">${r.legal_hold?'Vorbehalt lösen':'Aufbewahrung vormerken'}</button>
          <button class="btn small primary" type="button" onclick="PrivacyOps.setStatus('${r.id}','completed')">Abschließen</button>
        </div>
      </div>`;
    }).join('');
  }

  async function setStatus(id,status){
    const c=ctx();if(!c?.client||!c?.company?.id||!canManage())return;
    try{
      const {error}=await c.client.from('privacy_requests').update({status}).eq('company_id',c.company.id).eq('id',id);if(error)throw error;
      notify(status==='completed'?'✓ Anfrage abgeschlossen.':'Status aktualisiert.','success');await refresh();
    }catch(e){console.error(e);notify(String(e?.message||'Status konnte nicht geändert werden.'),'error')}
  }

  async function toggleHold(id){
    const c=ctx(),r=requests.find(x=>x.id===id);if(!c?.client||!c?.company?.id||!r||!canManage())return;
    try{
      const next=!r.legal_hold;
      const {error}=await c.client.from('privacy_requests').update({legal_hold:next,retention_note:next?(r.retention_note||'Aufbewahrung vor Löschung rechtlich prüfen.') : r.retention_note}).eq('company_id',c.company.id).eq('id',id);if(error)throw error;
      notify(next?'Aufbewahrungsvorbehalt vorgemerkt.':'Aufbewahrungsvorbehalt gelöst.','success');await refresh();
    }catch(e){console.error(e);notify(String(e?.message||'Vorbehalt konnte nicht geändert werden.'),'error')}
  }

  async function selectMany(client,table,companyId,column,value){
    if(!value)return[];
    const {data,error}=await client.from(table).select('*').eq('company_id',companyId).eq(column,value);if(error)throw error;return data||[];
  }
  async function selectIn(client,table,column,ids){
    if(!ids?.length)return[];
    const {data,error}=await client.from(table).select('*').in(column,ids);if(error)throw error;return data||[];
  }

  async function exportSubject(id){
    const c=ctx(),r=requests.find(x=>x.id===id);if(!c?.client||!c?.company?.id||!r||!canManage())return;
    activeRequestId=id;notify('Datenkopie wird erstellt …','info');
    try{
      let customer=null;
      if(r.customer_id){
        const cq=await c.client.from('customers').select('*').eq('company_id',c.company.id).eq('id',r.customer_id).maybeSingle();if(cq.error)throw cq.error;customer=cq.data||null;
      }
      const localId=r.subject_contact_snapshot?.local_id||'';
      if(!customer&&localId){
        const cq=await c.client.from('customers').select('*').eq('company_id',c.company.id).eq('local_id',String(localId)).maybeSingle();if(cq.error)throw cq.error;customer=cq.data||null;
      }
      const customerId=customer?.id||r.customer_id||null;
      const [offers,jobs,invoices,events,tasks]=customerId?await Promise.all([
        selectMany(c.client,'offers',c.company.id,'customer_id',customerId),
        selectMany(c.client,'jobs',c.company.id,'customer_id',customerId),
        selectMany(c.client,'invoices',c.company.id,'customer_id',customerId),
        selectMany(c.client,'events',c.company.id,'customer_id',customerId),
        selectMany(c.client,'tasks',c.company.id,'customer_id',customerId)
      ]):[[],[],[],[],[]];
      const [offerLines,invoiceLines,timeEntries]=await Promise.all([
        selectIn(c.client,'offer_lines','offer_id',offers.map(x=>x.id)),
        selectIn(c.client,'invoice_lines','invoice_id',invoices.map(x=>x.id)),
        selectIn(c.client,'time_entries','job_id',jobs.map(x=>x.id))
      ]);
      let mailMessages=[];
      const email=String(customer?.email||r.subject_contact_snapshot?.email||'').trim();
      if(email){
        const [fromQ,toQ]=await Promise.all([
          c.client.from('mail_messages').select('*').eq('company_id',c.company.id).eq('from_email',email).limit(1000),
          c.client.from('mail_messages').select('*').eq('company_id',c.company.id).contains('to_emails',[email]).limit(1000)
        ]);
        if(fromQ.error)throw fromQ.error;if(toQ.error)throw toQ.error;
        const byId=new Map();[...(fromQ.data||[]),...(toQ.data||[])].forEach(x=>byId.set(x.id,x));mailMessages=[...byId.values()];
      }
      const ret=RETENTION[r.country_code]||RETENTION.DE;
      const exportData={
        format:'angebotspilot-data-subject-export',formatVersion:1,appBuild:VERSION,generatedAt:new Date().toISOString(),
        request:{id:r.id,type:r.request_type,status:r.status,requestedAt:r.requested_at,countryCode:r.country_code,legalHold:r.legal_hold,retentionNote:r.retention_note||''},
        retentionGuidance:{summary:ret.summary,source:ret.source,note:'Richtwert. Gesetzliche Sonderfälle und laufende Verfahren können längere Aufbewahrung erfordern.'},
        subject:{snapshot:{name:r.subject_name_snapshot,...(r.subject_contact_snapshot||{})},customer},
        records:{offers,offerLines,jobs,timeEntries,invoices,invoiceLines,events,tasks,mailMessages}
      };
      const counts=Object.fromEntries(Object.entries(exportData.records).map(([k,v])=>[k,Array.isArray(v)?v.length:0]));
      const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
      const name=`AngebotsPilot-Datenkopie-${safeFile(r.subject_name_snapshot)}-${new Date().toISOString().slice(0,10)}.json`;
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
      const {error}=await c.client.from('privacy_request_events').insert({request_id:r.id,company_id:c.company.id,user_id:c.session?.user?.id||null,event_type:'export_generated',metadata:{app_build:VERSION,counts,file_name:name}});if(error)console.warn('Privacy export audit',error);
      notify('✓ Datenkopie erstellt.','success');
    }catch(e){console.error(e);notify(String(e?.message||'Datenkopie konnte nicht erstellt werden.'),'error')}
    finally{activeRequestId=''}
  }

  function exportCompany(){
    if(!canManage())return notify('Nur Inhaber oder Büro können den Betrieb exportieren.','error');
    if(globalThis.DataSafety?.exportCompany)return globalThis.DataSafety.exportCompany();
    if(globalThis.exportPrivacyData)return globalThis.exportPrivacyData();
    notify('Exportfunktion ist noch nicht geladen.','warning');
  }

  function showSubprocessors(){
    ensureUI();const el=q('privacyOpsSubList');
    el.innerHTML=SUBPROCESSORS.map(x=>`<div class="privacyOpsSubRow"><b>${esc(x.name)}</b><span>${esc(x.purpose)}</span><small>${esc(x.state)}</small></div>`).join('')+
      '<div class="privacyOpsRetention"><b>Vor Live-Verkauf</b><br>AVV/DPA, Anbieteranschrift, Verarbeitungsregion, Unterauftragnehmer, Drittlandtransfers und Vertragsgrundlage werden mit den tatsächlichen Verträgen final dokumentiert.</div>';
    q('privacyOpsSubModal').classList.remove('hidden');
  }
  function closeSubprocessors(){q('privacyOpsSubModal')?.classList.add('hidden')}

  const api=Object.freeze({version:VERSION,open,close,create,refresh,setStatus,toggleHold,exportSubject,exportCompany,showSubprocessors,closeSubprocessors});
  globalThis.PrivacyOps=api;

  function boot(){ensureUI();updateCard();[500,1500].forEach(ms=>setTimeout(updateCard,ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('angebotspilot:syncstate',updateCard);
})();
