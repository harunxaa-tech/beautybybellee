/* AngebotsPilot v11.1 – Kern-Geschäftsdaten Cloud-Synchronisierung */
(function(){
  'use strict';
  const KEY='digitaler_handwerker_v3';
  const PRE_CLOUD_BACKUP='angebotspilot_precloud_backup_v11_1';
  const TABLES={
    customers:'customers',catalog:'catalog_items',offers:'offers',jobs:'jobs',
    events:'events',tasks:'tasks',invoices:'invoices'
  };
  let client=null,session=null,company=null,membership=null;
  let syncing=false,queued=false,lastError='',lastSuccessAt='';
  let initializedCompanyId='';
  const q=id=>document.getElementById(id);
  const n=v=>Number(v)||0;
  const iso=v=>v||new Date().toISOString();
  const cleanId=v=>v||null;

  function state(){return{syncing,lastError,lastSuccessAt,companyId:company?.id||'',ready:!!(client&&session&&company)}}
  function emit(){window.dispatchEvent(new CustomEvent('angebotspilot:syncstate',{detail:state()}));renderStatus()}
  function setProgress(p,title,text){
    const bar=q('entrySyncProgress');if(bar)bar.style.width=Math.max(0,Math.min(100,p))+'%';
    if(q('entrySyncTitle')&&title)q('entrySyncTitle').textContent=title;
    if(q('entrySyncText')&&text)q('entrySyncText').textContent=text;
  }
  function showEntrySync(show){
    const gate=q('entryGate');if(!gate)return;
    if(show){
      document.querySelectorAll('#entryGate .entryStep').forEach(el=>{
        el.hidden=true;el.classList.add('hidden');
      });
      const sync=q('entrySyncing');
      if(sync){sync.hidden=false;sync.classList.remove('hidden')}
      gate.hidden=false;gate.classList.remove('hidden');
    }else{
      const sync=q('entrySyncing');
      if(sync){sync.hidden=true;sync.classList.add('hidden')}
    }
  }
  function localData(){return globalThis.data||{}}
  function localCounts(d=localData()){return{
    customers:(d.customers||[]).length,offers:(d.offers||[]).length,jobs:(d.jobs||[]).length,
    events:(d.events||[]).length,tasks:(d.tasks||[]).length,invoices:(d.invoices||[]).length,
    catalog:(d.catalog||[]).length
  }}
  function renderStatus(){
    const c=localCounts();
    if(q('cloudSyncCustomers'))q('cloudSyncCustomers').textContent=c.customers;
    if(q('cloudSyncOffers'))q('cloudSyncOffers').textContent=c.offers;
    if(q('cloudSyncJobs'))q('cloudSyncJobs').textContent=c.jobs;
    if(q('cloudSyncInvoices'))q('cloudSyncInvoices').textContent=c.invoices;
    if(q('cloudSyncBadge'))q('cloudSyncBadge').textContent=syncing?'SYNC':lastError?'FEHLER':lastSuccessAt?'✓':'–';
    if(q('cloudSyncHeadline'))q('cloudSyncHeadline').textContent=syncing?'Synchronisierung läuft …':lastError?'Synchronisierung prüfen':'Cloud synchronisiert';
    if(q('cloudSyncDetail'))q('cloudSyncDetail').textContent=lastError?lastError:(lastSuccessAt?`Zuletzt ${new Date(lastSuccessAt).toLocaleString('de-DE')}`:'Noch keine Datensynchronisierung');
  }
  function backupLocalOnce(){
    if(localStorage.getItem(PRE_CLOUD_BACKUP))return;
    try{localStorage.setItem(PRE_CLOUD_BACKUP,JSON.stringify({savedAt:new Date().toISOString(),data:localData()}))}catch(e){}
  }
  function creator(){return session?.user?.id||null}
  async function all(table,columns='*'){
    const {data,error}=await client.from(table).select(columns).eq('company_id',company.id);
    if(error)throw error;return data||[];
  }
  async function mapFor(table){
    const rows=await all(table,'id,local_id,deleted_at,client_updated_at');
    return new Map(rows.filter(r=>r.local_id).map(r=>[r.local_id,r]));
  }
  async function upsertRows(table,rows,onConflict='company_id,local_id'){
    if(!rows.length)return [];
    const {data,error}=await client.from(table).upsert(rows,{onConflict}).select('id,local_id');
    if(error)throw error;return data||[];
  }
  function base(entity){return{
    company_id:company.id,local_id:String(entity.id),created_by:creator(),
    client_updated_at:iso(entity.updatedAt||entity.createdAt),deleted_at:null
  }}
  async function syncCustomers(d){
    await upsertRows('customers',(d.customers||[]).map(x=>({...base(x),name:x.name||'',contact:x.contact||'',address:x.address||'',phone:x.phone||'',email:x.email||'',notes:x.notes||''})));
    return mapFor('customers');
  }
  async function syncCatalog(d){
    await upsertRows('catalog_items',(d.catalog||[]).map(x=>({...base(x),trade:x.trade||d.settings?.trade||'garden',type:x.type||'service',name:x.name||'',unit:x.unit||'Stk.',price:n(x.price),purchase_price:n(x.purchasePrice),markup:n(x.markup)})));
  }
  async function syncOffers(d,custMap){
    const rows=(d.offers||[]).map(x=>({...base(x),customer_id:custMap.get(x.customerId)?.id,number:x.number||'',offer_date:x.date||new Date().toISOString().slice(0,10),status:x.status||'draft',subject:x.subject||'Angebot',notes:x.notes||'',discount_type:x.discountType||'euro',discount_value:n(x.discountValue),tax_rate:n(x.tax),subtotal:n(x.subtotal),total:n(x.total)})).filter(x=>x.customer_id);
    await upsertRows('offers',rows);
    const offerMap=await mapFor('offers');
    for(const offer of d.offers||[]){
      const cloud=offerMap.get(offer.id);if(!cloud)continue;
      const {error:delErr}=await client.from('offer_lines').delete().eq('offer_id',cloud.id);
      if(delErr)throw delErr;
      const lines=(offer.lines||[]).filter(l=>l.name).map((l,i)=>({offer_id:cloud.id,local_id:String(l.id||`${offer.id}:line:${i}`),position:i+1,name:l.name,qty:n(l.qty)||1,unit:l.unit||'Stk.',price:n(l.price),type:l.type||'service',workers:l.workers?Number(l.workers):null,hours_per_worker:l.hoursPerWorker?n(l.hoursPerWorker):null}));
      if(lines.length){const {error}=await client.from('offer_lines').insert(lines);if(error)throw error}
    }
    return offerMap;
  }
  async function syncJobs(d,custMap,offerMap){
    const rows=(d.jobs||[]).map(x=>({...base(x),customer_id:custMap.get(x.customerId)?.id,offer_id:x.offerId?offerMap.get(x.offerId)?.id:null,title:x.title||'Baustelle',address:x.address||'',start_date:x.start||null,status:x.status||'open',notes:x.notes||'',doc_note:x.docNote||''})).filter(x=>x.customer_id);
    await upsertRows('jobs',rows);
    return mapFor('jobs');
  }
  async function syncEvents(d,custMap,offerMap,jobMap){
    const rows=(d.events||[]).map(x=>({...base(x),customer_id:x.customerId?custMap.get(x.customerId)?.id:null,offer_id:x.offerId?offerMap.get(x.offerId)?.id:null,job_id:x.jobId?jobMap.get(x.jobId)?.id:null,title:x.title||'Termin',event_date:x.date||new Date().toISOString().slice(0,10),event_time:x.time||null,duration_minutes:Number(x.duration)||60,type:x.type||'Sonstiges',address:x.address||'',notes:x.notes||''}));
    await upsertRows('events',rows);
  }
  async function syncTasks(d,custMap,jobMap){
    const rows=(d.tasks||[]).map(x=>({...base(x),customer_id:x.customerId?custMap.get(x.customerId)?.id:null,job_id:x.jobId?jobMap.get(x.jobId)?.id:null,title:x.title||'Aufgabe',due_date:x.date||null,status:x.done?'done':'open',priority:x.priority||'normal',notes:x.notes||'',done:!!x.done}));
    await upsertRows('tasks',rows);
  }
  async function syncInvoices(d,custMap,offerMap,jobMap){
    const raw=d.invoices||[];
    let rows=raw.map(x=>({...base(x),customer_id:custMap.get(x.customerId)?.id,offer_id:x.offerId?offerMap.get(x.offerId)?.id:null,job_id:x.jobId?jobMap.get(x.jobId)?.id:null,number:x.number||'',invoice_date:x.date||new Date().toISOString().slice(0,10),due_date:x.dueDate||null,status:x.status||'draft',subject:x.subject||'Rechnung',notes:x.notes||'',discount_type:x.discountType||'euro',discount_value:n(x.discountValue),tax_rate:n(x.tax),subtotal:n(x.subtotal),total:n(x.total),document_type:x.documentType||'invoice',finalized_at:x.finalizedAt||null,offer_number:x.offerNumber||'',source_offer_number:x.sourceOfferNumber||'',created_automatically:!!x.createdAutomatically,finalized_snapshot:x.finalizedSnapshot||null,paid_at:x.paidAt||null,cancelled_at:x.cancelledAt||null})).filter(x=>x.customer_id);
    await upsertRows('invoices',rows);
    let invoiceMap=await mapFor('invoices');
    // relationship refs second pass
    const relational=raw.map(x=>({
      local:x.id,
      original:x.originalInvoiceId?invoiceMap.get(x.originalInvoiceId)?.id:null,
      correction:x.correctionOf?invoiceMap.get(x.correctionOf)?.id:null,
      cancelledBy:x.cancelledByInvoiceId?invoiceMap.get(x.cancelledByInvoiceId)?.id:null
    }));
    for(const rel of relational){
      const cloud=invoiceMap.get(rel.local);if(!cloud)continue;
      const {error}=await client.from('invoices').update({original_invoice_id:rel.original||null,correction_of_id:rel.correction||null,cancelled_by_invoice_id:rel.cancelledBy||null}).eq('id',cloud.id);
      if(error)throw error;
    }
    for(const inv of raw){
      const cloud=invoiceMap.get(inv.id);if(!cloud)continue;
      const {error:delErr}=await client.from('invoice_lines').delete().eq('invoice_id',cloud.id);
      if(delErr)throw delErr;
      const lines=(inv.lines||[]).filter(l=>l.name).map((l,i)=>({invoice_id:cloud.id,local_id:String(l.id||`${inv.id}:line:${i}`),position:i+1,name:l.name,qty:n(l.qty)||1,unit:l.unit||'Stk.',price:n(l.price),workers:l.workers?Number(l.workers):null,hours_per_worker:l.hoursPerWorker?n(l.hoursPerWorker):null}));
      if(lines.length){const {error}=await client.from('invoice_lines').insert(lines);if(error)throw error}
    }
    return invoiceMap;
  }
  async function applyTombstones(d){
    const tombs=d.meta?.deletedEntities||[];
    const tableMap={customers:'customers',catalog:'catalog_items',offers:'offers',jobs:'jobs',events:'events',tasks:'tasks',invoices:'invoices'};
    for(const t of tombs){
      const table=tableMap[t.collection];if(!table)continue;
      const {error}=await client.from(table).update({deleted_at:t.deletedAt||new Date().toISOString(),client_updated_at:t.deletedAt||new Date().toISOString()}).eq('company_id',company.id).eq('local_id',String(t.id));
      if(error)throw error;
    }
  }
  async function pushSnapshot(payload){
    if(!client||!company||!session)return;
    if(syncing){queued=true;return}
    syncing=true;lastError='';emit();
    try{
      const d=localData();
      setProgress(15,'Cloud wird aktualisiert','Kunden und Preisliste …');
      await client.from('companies').update({
        name:d.settings?.companyName||company.name,trade:d.settings?.trade||company.trade||'garden',
        address:d.settings?.address||'',phone:d.settings?.phone||'',email:d.settings?.email||session.user.email||'',
        tax_number:d.settings?.taxNumber||'',vat_id:d.settings?.vatId||'',iban:d.settings?.iban||'',
        bank_name:d.settings?.bankName||'',tax_rate:n(d.settings?.tax),
        payment_days:Math.max(0,Number(String(d.settings?.paymentTerm||'7').match(/\d+/)?.[0]||7))
      }).eq('id',company.id);
      const custMap=await syncCustomers(d);await syncCatalog(d);
      setProgress(40,'Cloud wird aktualisiert','Angebote …');
      const offerMap=await syncOffers(d,custMap);
      setProgress(58,'Cloud wird aktualisiert','Baustellen und Kalender …');
      const jobMap=await syncJobs(d,custMap,offerMap);
      await syncEvents(d,custMap,offerMap,jobMap);await syncTasks(d,custMap,jobMap);
      setProgress(78,'Cloud wird aktualisiert','Rechnungen …');
      await syncInvoices(d,custMap,offerMap,jobMap);
      await applyTombstones(d);
      d.meta=d.meta||{};d.meta.cloudCompanyId=company.id;d.meta.authUserId=session.user.id;d.meta.storageMode='cloud-sync';d.meta.cloudInitialSyncDone=true;d.meta.lastCloudPushAt=new Date().toISOString();d.meta.lastSyncError='';
      localStorage.setItem(KEY,JSON.stringify(d));
      lastSuccessAt=d.meta.lastCloudPushAt;setProgress(100,'Synchronisiert','Alles gespeichert.');renderStatus();
    }catch(e){
      console.error('Cloud push failed',e);lastError=String(e?.message||e||'Cloud-Sync fehlgeschlagen');
      const d=localData();d.meta=d.meta||{};d.meta.lastSyncError=lastError;localStorage.setItem(KEY,JSON.stringify(d));
      throw e;
    }finally{
      syncing=false;emit();
      if(queued){queued=false;setTimeout(()=>pushSnapshot(),250)}
    }
  }
  async function cloudCount(){
    const {count,error}=await client.from('customers').select('id',{count:'exact',head:true}).eq('company_id',company.id).is('deleted_at',null);
    if(error)throw error;
    const {count:offersCount,error:oe}=await client.from('offers').select('id',{count:'exact',head:true}).eq('company_id',company.id).is('deleted_at',null);
    if(oe)throw oe;
    const {count:jobsCount,error:je}=await client.from('jobs').select('id',{count:'exact',head:true}).eq('company_id',company.id).is('deleted_at',null);
    if(je)throw je;
    const {count:invCount,error:ie}=await client.from('invoices').select('id',{count:'exact',head:true}).eq('company_id',company.id).is('deleted_at',null);
    if(ie)throw ie;
    return{customers:count||0,offers:offersCount||0,jobs:jobsCount||0,invoices:invCount||0,total:(count||0)+(offersCount||0)+(jobsCount||0)+(invCount||0)};
  }
  async function selectActive(table,cols='*'){
    const {data,error}=await client.from(table).select(cols).eq('company_id',company.id).is('deleted_at',null);
    if(error)throw error;return data||[];
  }
  async function pullCloud(){
    setProgress(18,'Cloud-Daten werden geladen','Kunden …');
    const [customers,catalog,offers,jobs,events,tasks,invoices]=await Promise.all([
      selectActive('customers'),selectActive('catalog_items'),selectActive('offers'),selectActive('jobs'),
      selectActive('events'),selectActive('tasks'),selectActive('invoices')
    ]);
    const customerLocal=new Map(customers.map(x=>[x.id,x.local_id||x.id]));
    const offerLocal=new Map(offers.map(x=>[x.id,x.local_id||x.id]));
    const jobLocal=new Map(jobs.map(x=>[x.id,x.local_id||x.id]));
    const invoiceLocal=new Map(invoices.map(x=>[x.id,x.local_id||x.id]));

    setProgress(48,'Cloud-Daten werden geladen','Positionen und Beziehungen …');
    const offerIds=offers.map(x=>x.id),invoiceIds=invoices.map(x=>x.id);
    let offerLines=[],invoiceLines=[];
    if(offerIds.length){const {data,error}=await client.from('offer_lines').select('*').in('offer_id',offerIds).order('position');if(error)throw error;offerLines=data||[]}
    if(invoiceIds.length){const {data,error}=await client.from('invoice_lines').select('*').in('invoice_id',invoiceIds).order('position');if(error)throw error;invoiceLines=data||[]}
    const linesByOffer=new Map(),linesByInvoice=new Map();
    offerLines.forEach(l=>{if(!linesByOffer.has(l.offer_id))linesByOffer.set(l.offer_id,[]);linesByOffer.get(l.offer_id).push(l)});
    invoiceLines.forEach(l=>{if(!linesByInvoice.has(l.invoice_id))linesByInvoice.set(l.invoice_id,[]);linesByInvoice.get(l.invoice_id).push(l)});

    const d=localData(),s=d.settings||{};
    Object.assign(s,{
      companyName:company.name||s.companyName||'',trade:company.trade||s.trade||'garden',address:company.address||s.address||'',
      phone:company.phone||s.phone||'',email:company.email||session.user.email||s.email||'',tax:Number(company.tax_rate)||0,
      paymentTerm:`${Number(company.payment_days)||7} Tage`,taxNumber:company.tax_number||'',vatId:company.vat_id||'',
      iban:company.iban||'',bankName:company.bank_name||'',ownerName:session.user.user_metadata?.full_name||s.ownerName||''
    });
    d.settings=s;
    d.customers=customers.map(x=>({id:x.local_id||x.id,name:x.name,contact:x.contact,address:x.address,phone:x.phone,email:x.email,notes:x.notes,createdAt:x.created_at,updatedAt:x.client_updated_at||x.updated_at}));
    d.catalog=catalog.map(x=>({id:x.local_id||x.id,trade:x.trade,type:x.type,name:x.name,unit:x.unit,price:Number(x.price),purchasePrice:Number(x.purchase_price),markup:Number(x.markup),createdAt:x.created_at,updatedAt:x.client_updated_at||x.updated_at}));
    d.offers=offers.map(x=>({id:x.local_id||x.id,number:x.number,customerId:customerLocal.get(x.customer_id)||'',date:x.offer_date,status:x.status,subject:x.subject,notes:x.notes,discountType:x.discount_type,discountValue:Number(x.discount_value),tax:Number(x.tax_rate),subtotal:Number(x.subtotal),total:Number(x.total),travel:0,lines:(linesByOffer.get(x.id)||[]).map(l=>({id:l.local_id||l.id,name:l.name,qty:Number(l.qty),unit:l.unit,price:Number(l.price),type:l.type,workers:l.workers||undefined,hoursPerWorker:l.hours_per_worker?Number(l.hours_per_worker):undefined})),createdAt:x.created_at,updatedAt:x.client_updated_at||x.updated_at}));
    d.jobs=jobs.map(x=>({id:x.local_id||x.id,title:x.title,customerId:customerLocal.get(x.customer_id)||'',address:x.address,start:x.start_date,status:x.status,notes:x.notes,docNote:x.doc_note,offerId:x.offer_id?offerLocal.get(x.offer_id)||'':'',invoiceId:'',eventId:'',photos:[],createdAt:x.created_at,updatedAt:x.client_updated_at||x.updated_at}));
    d.events=events.map(x=>({id:x.local_id||x.id,title:x.title,customerId:x.customer_id?customerLocal.get(x.customer_id)||'':'',offerId:x.offer_id?offerLocal.get(x.offer_id)||'':'',jobId:x.job_id?jobLocal.get(x.job_id)||'':'',date:x.event_date,time:(x.event_time||'08:00').slice(0,5),duration:Number(x.duration_minutes)||60,type:x.type,address:x.address,notes:x.notes,createdAt:x.created_at,updatedAt:x.client_updated_at||x.updated_at}));
    d.tasks=tasks.map(x=>({id:x.local_id||x.id,title:x.title,date:x.due_date||'',priority:x.priority||'normal',notes:x.notes||'',done:!!x.done,customerId:x.customer_id?customerLocal.get(x.customer_id)||'':'',jobId:x.job_id?jobLocal.get(x.job_id)||'':'',createdAt:x.created_at,updatedAt:x.client_updated_at||x.updated_at}));
    d.invoices=invoices.map(x=>({id:x.local_id||x.id,number:x.number,customerId:customerLocal.get(x.customer_id)||'',date:x.invoice_date,dueDate:x.due_date,status:x.status,subject:x.subject,notes:x.notes,discountType:x.discount_type,discountValue:Number(x.discount_value),tax:Number(x.tax_rate),subtotal:Number(x.subtotal),total:Number(x.total),travel:0,offerId:x.offer_id?offerLocal.get(x.offer_id)||'':'',offerNumber:x.offer_number||'',sourceOfferNumber:x.source_offer_number||'',jobId:x.job_id?jobLocal.get(x.job_id)||'':'',documentType:x.document_type||'invoice',originalInvoiceId:x.original_invoice_id?invoiceLocal.get(x.original_invoice_id)||'':'',correctionOf:x.correction_of_id?invoiceLocal.get(x.correction_of_id)||'':'',createdAutomatically:!!x.created_automatically,finalizedAt:x.finalized_at||'',finalizedSnapshot:x.finalized_snapshot||null,paidAt:x.paid_at||'',cancelledAt:x.cancelled_at||'',cancelledByInvoiceId:x.cancelled_by_invoice_id?invoiceLocal.get(x.cancelled_by_invoice_id)||'':'',lines:(linesByInvoice.get(x.id)||[]).map(l=>({id:l.local_id||l.id,name:l.name,qty:Number(l.qty),unit:l.unit,price:Number(l.price),workers:l.workers||undefined,hoursPerWorker:l.hours_per_worker?Number(l.hours_per_worker):undefined})),createdAt:x.created_at,updatedAt:x.client_updated_at||x.updated_at}));
    // derive reverse job/invoice/event links
    d.invoices.forEach(inv=>{if(inv.jobId){const j=d.jobs.find(x=>x.id===inv.jobId);if(j)j.invoiceId=inv.id}});
    d.events.forEach(ev=>{if(ev.jobId){const j=d.jobs.find(x=>x.id===ev.jobId);if(j)j.eventId=ev.id}if(ev.offerId){const o=d.offers.find(x=>x.id===ev.offerId);if(o)o.eventId=ev.id}});
    d.meta=d.meta||{};d.meta.cloudCompanyId=company.id;d.meta.authUserId=session.user.id;d.meta.storageMode='cloud-sync';d.meta.cloudInitialSyncDone=true;d.meta.lastCloudPullAt=new Date().toISOString();d.meta.deletedEntities=[];
    localStorage.setItem(KEY,JSON.stringify(d));
    setProgress(100,'Cloud geladen','Dein Betrieb ist auf diesem Gerät bereit.');
    globalThis.renderAll?.();
    return d;
  }
  async function initialSync(){
    if(!client||!session||!company)return;
    const d=localData();
    if(d.meta?.cloudInitialSyncDone&&d.meta?.cloudCompanyId===company.id){
      globalThis.AppRepository?.setCloudAdapter({pushSnapshot});
      lastSuccessAt=d.meta?.lastCloudPushAt||d.meta?.lastCloudPullAt||'';
      renderStatus();return;
    }
    showEntrySync(true);emit();backupLocalOnce();
    try{
      const cc=await cloudCount(),lc=localCounts(d);
      if(cc.total===0 && (lc.customers+lc.offers+lc.jobs+lc.invoices+lc.events+lc.tasks)>0){
        setProgress(8,'Lokale Daten werden gesichert','Sicherheitskopie auf diesem Gerät erstellt.');
        await pushSnapshot();
      }else if(cc.total>0){
        syncing=true;emit();
        try{await pullCloud()}finally{syncing=false;emit()}
      }else{
        // Fresh account with no meaningful local data: mark ready, then upload catalog/settings
        d.meta=d.meta||{};d.meta.cloudCompanyId=company.id;d.meta.authUserId=session.user.id;d.meta.storageMode='cloud-sync';d.meta.cloudInitialSyncDone=true;
        localStorage.setItem(KEY,JSON.stringify(d));
        await pushSnapshot();
      }
      globalThis.AppRepository?.setCloudAdapter({pushSnapshot});
      lastSuccessAt=new Date().toISOString();lastError='';
    }catch(e){
      lastError=String(e?.message||e||'Erste Synchronisierung fehlgeschlagen');
      console.error(e);
    }finally{
      syncing=false;emit();setTimeout(()=>{showEntrySync(false);globalThis.requireCloudEntry?.()},500)
    }
  }
  async function attach(c,s,co,m){
    client=c;session=s;company=co;membership=m;
    if(!client||!session||!company)return;
    if(initializedCompanyId===company.id){
      globalThis.AppRepository?.setCloudAdapter({pushSnapshot});renderStatus();return;
    }
    initializedCompanyId=company.id;
    await initialSync();
  }
  function detach(){client=session=company=membership=null;initializedCompanyId='';globalThis.AppRepository?.setCloudAdapter(null);renderStatus()}
  async function manual(){if(!client||!company)throw new Error('Nicht mit der Cloud verbunden');showEntrySync(true);syncing=true;emit();try{await pushSnapshot();await pullCloud();lastSuccessAt=new Date().toISOString();lastError=''}finally{syncing=false;emit();setTimeout(()=>{showEntrySync(false);globalThis.requireCloudEntry?.()},450)}}
  globalThis.CloudSync={attach,detach,pushSnapshot,pullCloud,manual,state,renderStatus};
  globalThis.manualCloudSync=async()=>{try{await manual();globalThis.toast?.('☁️ Synchronisiert')}catch(e){console.error(e);globalThis.toast?.('Cloud-Sync fehlgeschlagen')}};
})();