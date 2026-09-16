/* AngebotsPilot v11.30.5 – Datenexport, sichere Wiederherstellung & Archiv
   Vollständige Betriebssicherung ohne stille Cloud-Überschreibung. */
(function(){
  'use strict';

  const BUILD='11.30.5';
  const BACKUP_FORMAT='angebotspilot-backup';
  const BACKUP_FORMAT_VERSION=2;
  const PAGE_SIZE=1000;
  const CORE=['customers','offers','events','tasks','jobs','invoices','catalog'];
  const ARCHIVE_TABLES={
    customers:{label:'Kunden',collection:'customers',title:r=>r.name||'Kunde'},
    catalog_items:{label:'Leistungen',collection:'catalog',title:r=>r.name||'Leistung'},
    offers:{label:'Angebote',collection:'offers',title:r=>`${r.number||'Angebot'} · ${r.subject||''}`},
    jobs:{label:'Baustellen',collection:'jobs',title:r=>r.title||'Baustelle'},
    events:{label:'Termine',collection:'events',title:r=>r.title||'Termin'},
    tasks:{label:'Aufgaben',collection:'tasks',title:r=>r.title||'Aufgabe'},
    invoices:{label:'Rechnungen',collection:'invoices',title:r=>`${r.number||'Rechnung'} · ${r.subject||''}`}
  };
  const EXPORT_TABLES=[
    'company_members','customers','catalog_items','offers','offer_lines','jobs','events','tasks','invoices','invoice_lines',
    'job_assignments','time_entries','customer_files','job_acceptances','time_period_reviews','subscription_invoices'
  ];
  const CSV_TABLES=['customers','offers','invoices','jobs','tasks','time_entries','customer_files','job_acceptances'];
  const enc=new TextEncoder(),dec=new TextDecoder();
  const q=id=>document.getElementById(id);
  let restorePreview=null;
  let archiveRows=[];
  let contextWatchKey='';
  let contextWatchTimer=null;

  function ctx(){try{return globalThis.APCloudContext?.()||null}catch(e){return null}}
  function role(){return ctx()?.membership?.role||globalThis.data?.privacy?.role||'owner'}
  function canManage(){return ['owner','office'].includes(role())}
  function toast(message,type='info'){
    if(globalThis.toast)return globalThis.toast(message,type);
    if(globalThis.showToast)return globalThis.showToast(message,type);
    console[type==='error'?'error':'log'](message);
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function clone(v){try{return structuredClone(v)}catch(e){return JSON.parse(JSON.stringify(v))}}
  function slug(v){return String(v||'betrieb').trim().toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'betrieb'}
  function stamp(){document.querySelectorAll('[data-app-build]').forEach(el=>{el.textContent=BUILD})}
  function dateStamp(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function isoNow(){return new Date().toISOString()}
  function counts(d=globalThis.data||{}){return Object.fromEntries(CORE.map(k=>[k,Array.isArray(d[k])?d[k].length:0]))}
  function totalCounts(c){return Object.values(c||{}).reduce((a,b)=>a+(Number(b)||0),0)}
  function formatDate(v){if(!v)return '–';const d=new Date(v);return Number.isNaN(d.getTime())?'–':d.toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'})}

  async function sha256(text){
    if(!crypto?.subtle)return '';
    const digest=await crypto.subtle.digest('SHA-256',enc.encode(text));
    return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function audit(eventType,metadata={},entityType='',entityId=''){
    try{
      const c=ctx();if(!c?.client||!c?.company?.id||!c?.session?.user?.id)return;
      await c.client.from('data_operation_events').insert({company_id:c.company.id,user_id:c.session.user.id,event_type:eventType,entity_type:entityType,entity_id:String(entityId||''),metadata});
    }catch(e){console.warn('Daten-Audit konnte nicht geschrieben werden',e)}
  }

  async function pagedCompany(table){
    const c=ctx();if(!c?.client||!c?.company?.id)return [];
    let out=[],from=0;
    while(true){
      const {data,error}=await c.client.from(table).select('*').eq('company_id',c.company.id).range(from,from+PAGE_SIZE-1);
      if(error)throw error;
      out.push(...(data||[]));
      if(!data||data.length<PAGE_SIZE)break;
      from+=PAGE_SIZE;
    }
    return out;
  }
  async function pagedByIds(table,column,ids){
    const c=ctx();if(!c?.client||!ids?.length)return [];
    const out=[];
    for(let i=0;i<ids.length;i+=100){
      const {data,error}=await c.client.from(table).select('*').in(column,ids.slice(i,i+100));
      if(error)throw error;out.push(...(data||[]));
    }
    return out;
  }
  async function collectCloudExport(){
    const c=ctx();if(!c?.client||!c?.company?.id)return {connected:false,tables:{},company:null};
    const {data:company,error}=await c.client.from('companies').select('*').eq('id',c.company.id).single();if(error)throw error;
    const tables={};
    for(const table of EXPORT_TABLES){
      if(table==='offer_lines'||table==='invoice_lines')continue;
      tables[table]=await pagedCompany(table);
    }
    tables.offer_lines=await pagedByIds('offer_lines','offer_id',(tables.offers||[]).map(x=>x.id));
    tables.invoice_lines=await pagedByIds('invoice_lines','invoice_id',(tables.invoices||[]).map(x=>x.id));
    return {connected:true,company,tables};
  }

  function csvValue(v){
    if(v===null||v===undefined)return '';
    if(typeof v==='object')v=JSON.stringify(v);
    const s=String(v).replace(/\r?\n/g,' ');
    return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  }
  function toCsv(rows){
    if(!rows?.length)return 'Keine Daten\n';
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r||{})))];
    return '\ufeff'+keys.map(csvValue).join(';')+'\n'+rows.map(r=>keys.map(k=>csvValue(r[k])).join(';')).join('\n')+'\n';
  }

  function crcTable(){
    const t=new Uint32Array(256);
    for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0}
    return t;
  }
  const CRC_TABLE=crcTable();
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
  function u16(n){return [n&255,(n>>>8)&255]}
  function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
  function dosDateTime(date=new Date()){
    const year=Math.max(1980,date.getFullYear());
    return {date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate(),time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2)};
  }
  function makeZip(files){
    const locals=[],centrals=[];let offset=0;
    for(const f of files){
      const name=enc.encode(f.name),body=f.bytes instanceof Uint8Array?f.bytes:enc.encode(String(f.text??'')),crc=crc32(body),dt=dosDateTime();
      const local=new Uint8Array([80,75,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),...u32(crc),...u32(body.length),...u32(body.length),...u16(name.length),...u16(0),...name]);
      const combined=new Uint8Array(local.length+body.length);combined.set(local);combined.set(body,local.length);locals.push(combined);
      const central=new Uint8Array([80,75,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),...u32(crc),...u32(body.length),...u32(body.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);
      centrals.push(central);offset+=combined.length;
    }
    const centralSize=centrals.reduce((a,x)=>a+x.length,0),end=new Uint8Array([80,75,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),...u16(0)]);
    const size=offset+centralSize+end.length,out=new Uint8Array(size);let p=0;for(const x of locals){out.set(x,p);p+=x.length}for(const x of centrals){out.set(x,p);p+=x.length}out.set(end,p);return out;
  }
  function readZipStored(buffer){
    const v=new DataView(buffer),bytes=new Uint8Array(buffer),files={};let p=0;
    const u16at=o=>v.getUint16(o,true),u32at=o=>v.getUint32(o,true);
    while(p+30<=bytes.length&&u32at(p)===0x04034b50){
      const flags=u16at(p+6),method=u16at(p+8),comp=u32at(p+18),nameLen=u16at(p+26),extraLen=u16at(p+28);
      if(method!==0)throw new Error('Dieses ZIP verwendet eine nicht unterstützte Komprimierung. Bitte ein AngebotsPilot-Backup verwenden.');
      if(flags&0x08)throw new Error('Dieses ZIP-Format kann nicht sicher geprüft werden.');
      const name=dec.decode(bytes.slice(p+30,p+30+nameLen)),start=p+30+nameLen+extraLen,end=start+comp;
      if(end>bytes.length)throw new Error('Backup-ZIP ist beschädigt.');files[name]=bytes.slice(start,end);p=end;
    }
    return files;
  }

  async function shareOrDownload(blob,name){
    try{
      if(typeof File!=='undefined'&&navigator.share){
        const file=new File([blob],name,{type:blob.type||'application/zip'});
        if(!navigator.canShare||navigator.canShare({files:[file]})){await navigator.share({title:'AngebotsPilot Datensicherung',files:[file]});return 'shared'}
      }
    }catch(e){if(e?.name==='AbortError')return 'cancelled';console.warn('Teilen nicht möglich',e)}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);return 'downloaded';
  }

  async function exportCompany(){
    if(!canManage())return toast('Nur Inhaber oder Büro können den vollständigen Betrieb exportieren.','error');
    const current=clone(globalThis.data||{}),c=ctx(),companyId=c?.company?.id||current?.meta?.cloudCompanyId||current?.meta?.companyId||'',createdAt=isoNow();
    const localJson=JSON.stringify(current),integrity=await sha256(localJson),localCounts=counts(current);
    toast('Datensicherung wird erstellt …','info');
    let cloud={connected:false,tables:{},company:null};
    try{cloud=await collectCloudExport()}catch(e){console.warn(e);toast('Cloud-Daten konnten nicht vollständig geladen werden. Das lokale Backup wird trotzdem erstellt.','warning')}
    const backup={format:BACKUP_FORMAT,formatVersion:BACKUP_FORMAT_VERSION,appBuild:BUILD,schemaVersion:globalThis.AppRepository?.SCHEMA_VERSION||null,createdAt,companyId,data:current,integrity:{dataSha256:integrity}};
    const manifest={format:BACKUP_FORMAT,formatVersion:BACKUP_FORMAT_VERSION,appBuild:BUILD,createdAt,companyId,companyName:c?.company?.name||current?.settings?.companyName||'',schemaVersion:backup.schemaVersion,localCounts,localTotal:totalCounts(localCounts),cloudConnected:cloud.connected,cloudCounts:Object.fromEntries(Object.entries(cloud.tables||{}).map(([k,v])=>[k,(v||[]).length])),integrity:{backupDataSha256:integrity},restoreMode:'non-destructive-merge'};
    const readme=`AngebotsPilot – Betriebsexport ${BUILD}\nErstellt: ${createdAt}\n\nINHALT\n- backup/arbeitsdaten.json: maschinenlesbares AngebotsPilot-Backup für die sichere Wiederherstellung.\n- cloud/: vollständige exportierte Geschäftstabellen, soweit das Betriebskonto verbunden war.\n- csv/: verständliche Tabellen für Excel/Numbers.\n- manifest.json: Version, Zählwerte und Integritätsangaben.\n\nWIEDERHERSTELLUNG\nEin Backup wird niemals direkt beim Auswählen überschrieben. AngebotsPilot zeigt zuerst eine Vorschau. Beim Einspielen werden bestehende aktuelle Daten nicht still gelöscht; fehlende aktuelle Datensätze bleiben erhalten.\n\nSICHERHEIT\nZugangstokens, IMAP-Passwörter, OAuth-Zustände, Push-Schlüssel sowie Stripe- und Server-Secrets sind absichtlich NICHT enthalten. Dokumentdateien selbst sind nicht in diesem ZIP, aber ihre Metadaten/Storage-Pfade sind enthalten.\n`;
    const files=[
      {name:'README.txt',text:readme},
      {name:'manifest.json',text:JSON.stringify(manifest,null,2)},
      {name:'backup/arbeitsdaten.json',text:JSON.stringify(backup,null,2)}
    ];
    if(cloud.company)files.push({name:'cloud/company.json',text:JSON.stringify(cloud.company,null,2)});
    for(const [table,rows] of Object.entries(cloud.tables||{}))files.push({name:`cloud/${table}.json`,text:JSON.stringify(rows,null,2)});
    for(const table of CSV_TABLES){if(cloud.tables?.[table])files.push({name:`csv/${table}.csv`,text:toCsv(cloud.tables[table])})}
    if(!cloud.connected){
      for(const k of CORE){if(Array.isArray(current[k]))files.push({name:`csv/lokal-${k}.csv`,text:toCsv(current[k])})}
    }
    const zip=makeZip(files),name=`AngebotsPilot-${slug(manifest.companyName)}-${dateStamp()}.zip`;
    await audit('export_created',{app_build:BUILD,format_version:BACKUP_FORMAT_VERSION,cloud_connected:cloud.connected,local_counts:localCounts,zip_bytes:zip.length});
    const result=await shareOrDownload(new Blob([zip],{type:'application/zip'}),name);
    if(result!=='cancelled')toast('✓ Betriebsexport erstellt.','success');
  }

  function normalizeBackup(raw){
    if(raw?.format===BACKUP_FORMAT&&raw?.data)return raw;
    if(raw&&typeof raw==='object'&&(Array.isArray(raw.customers)||Array.isArray(raw.offers)||raw.settings)){
      return {format:BACKUP_FORMAT,formatVersion:0,appBuild:'legacy',schemaVersion:raw?.meta?.schemaVersion||null,createdAt:null,companyId:raw?.meta?.cloudCompanyId||raw?.meta?.companyId||'',data:raw,integrity:{},legacy:true};
    }
    throw new Error('Datei ist kein gültiges AngebotsPilot-Backup.');
  }
  async function parseBackupFile(file){
    if(!file)throw new Error('Keine Datei ausgewählt.');
    if(file.size>120*1024*1024)throw new Error('Backup ist zu groß für die sichere Browser-Wiederherstellung.');
    const buf=await file.arrayBuffer();let obj;
    if(file.name.toLowerCase().endsWith('.zip')||file.type==='application/zip'){
      const files=readZipStored(buf),raw=files['backup/arbeitsdaten.json'];if(!raw)throw new Error('Im ZIP fehlt backup/arbeitsdaten.json.');obj=JSON.parse(dec.decode(raw));
    }else obj=JSON.parse(dec.decode(new Uint8Array(buf)));
    const b=normalizeBackup(obj),data=b.data;
    if(!data||typeof data!=='object')throw new Error('Backup enthält keine Arbeitsdaten.');
    if(b.formatVersion>BACKUP_FORMAT_VERSION)throw new Error('Dieses Backup stammt aus einer neueren AngebotsPilot-Version. Bitte zuerst die App aktualisieren.');
    const c=ctx(),activeCompany=c?.company?.id||globalThis.data?.meta?.cloudCompanyId||'';
    if(c?.company?.id&&b.companyId&&b.companyId!==c.company.id&&b.companyId!==globalThis.data?.meta?.companyId){throw new Error('Sicherheitsstopp: Dieses Backup gehört zu einem anderen Betrieb.');}
    let integrity='not-provided';
    if(b.integrity?.dataSha256){const actual=await sha256(JSON.stringify(data));if(actual!==b.integrity.dataSha256)throw new Error('Integritätsprüfung fehlgeschlagen. Das Backup wurde möglicherweise verändert oder beschädigt.');integrity='verified'}
    const currentCounts=counts(globalThis.data||{}),backupCounts=counts(data),warnings=[];
    if(b.legacy)warnings.push('Älteres JSON-Backup: Es wird vor dem Einspielen auf das aktuelle sichere Merge-Verfahren umgestellt.');
    if(!b.companyId)warnings.push('Das Backup enthält keine eindeutige Betriebs-ID. Aktuelle Cloud-Identität bleibt deshalb unverändert.');
    return {backup:b,fileName:file.name,fileSize:file.size,integrity,currentCounts,backupCounts,warnings,activeCompany};
  }

  function mergeById(current=[],incoming=[]){
    const map=new Map();for(const x of current||[]){if(x&&typeof x==='object')map.set(String(x.id||crypto.randomUUID()),clone(x))}
    for(const x of incoming||[]){if(x&&typeof x==='object')map.set(String(x.id||crypto.randomUUID()),clone(x))}
    return [...map.values()];
  }
  function mergeWorkspace(current,incoming){
    const c=clone(current||{}),b=clone(incoming||{}),out={...c,...b};
    out.settings={...(c.settings||{}),...(b.settings||{})};
    // Einwilligungen/Rollen des aktuell angemeldeten Geräts niemals aus einem Backup zurückrollen.
    out.privacy=clone(c.privacy||b.privacy||{});
    out.users=mergeById(c.users,b.users);
    for(const k of CORE)out[k]=mergeById(c[k],b[k]);
    out.audit=[...(Array.isArray(c.audit)?c.audit:[]),...(Array.isArray(b.audit)?b.audit:[])].slice(-1000);
    const cm=c.meta||{},bm=b.meta||{};out.meta={...bm,...cm};
    for(const k of ['companyId','currentUserId','deviceId','cloudCompanyId','authUserId','storageMode'])if(cm[k])out.meta[k]=cm[k];
    out.meta.deletedEntities=[];
    out.meta.lastRestoreAt=isoNow();out.meta.lastRestoreBuild=BUILD;
    return out;
  }
  function savePreRestoreSnapshot(){
    try{
      const prefix='angebotspilot_pre_restore_';const key=prefix+Date.now(),snapshot={savedAt:isoNow(),data:clone(globalThis.data||{})};localStorage.setItem(key,JSON.stringify(snapshot));
      const keys=Object.keys(localStorage).filter(k=>k.startsWith(prefix)).sort().reverse();keys.slice(3).forEach(k=>localStorage.removeItem(k));return key;
    }catch(e){console.warn('Lokaler Vorher-Snapshot nicht möglich',e);return ''}
  }
  async function applyRestore(){
    if(!restorePreview)return;
    if(!canManage())return toast('Nur Inhaber oder Büro können ein Backup einspielen.','error');
    const p=restorePreview,current=globalThis.data||{},merged=mergeWorkspace(current,p.backup.data),beforeKey=savePreRestoreSnapshot();
    const ok=await confirmAction('Backup sicher einspielen?',`Die Sicherung wird mit dem aktuellen Betrieb zusammengeführt. Aktuelle Datensätze, die im Backup fehlen, bleiben erhalten. Vorher wird zusätzlich ein lokaler Sicherheits-Snapshot angelegt.\n\nBackup: ${p.fileName}\nBackup-Datensätze: ${totalCounts(p.backupCounts)}\nAktuell: ${totalCounts(p.currentCounts)}`,'Backup zusammenführen');
    if(!ok)return;
    try{
      // Objektidentität beibehalten, damit der laufende App-Code dieselbe Datenreferenz nutzt.
      Object.keys(current).forEach(k=>delete current[k]);Object.assign(current,merged);globalThis.data=current;
      if(globalThis.AppRepository?.prepare)globalThis.AppRepository.prepare(current,null);
      if(globalThis.safePersistCloudIdentity)globalThis.safePersistCloudIdentity(current);else localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(current));
      const c=ctx();
      if(c?.company?.id&&globalThis.CloudSync?.pushSnapshot){
        await globalThis.CloudSync.pushSnapshot();
        await globalThis.CloudSync.pullCloud();
      }
      await audit('restore_applied',{app_build:BUILD,source_file:p.fileName,format_version:p.backup.formatVersion,backup_counts:p.backupCounts,pre_restore_snapshot:!!beforeKey,mode:'non_destructive_merge'});
      closeModal('dataSafetyRestoreModal');restorePreview=null;globalThis.renderAll?.();toast('✓ Backup sicher zusammengeführt.','success');
    }catch(e){console.error(e);toast(String(e?.message||'Wiederherstellung fehlgeschlagen.'),'error')}
  }

  async function chooseBackup(event){
    const file=event?.target?.files?.[0];if(event?.target)event.target.value='';if(!file)return;
    try{
      const preview=await parseBackupFile(file);restorePreview=preview;await audit('restore_previewed',{source_file:file.name,format_version:preview.backup.formatVersion,backup_counts:preview.backupCounts,integrity:preview.integrity});showRestorePreview(preview);
    }catch(e){console.error(e);toast(String(e?.message||'Backup konnte nicht geprüft werden.'),'error')}
  }

  async function archived(){
    const c=ctx();if(!c?.client||!c?.company?.id)return [];
    const out=[];
    for(const [table,cfg] of Object.entries(ARCHIVE_TABLES)){
      const {data,error}=await c.client.from(table).select('*').eq('company_id',c.company.id).not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(250);
      if(error)throw error;(data||[]).forEach(row=>out.push({table,cfg,row}));
    }
    return out.sort((a,b)=>String(b.row.deleted_at||'').localeCompare(String(a.row.deleted_at||'')));
  }
  async function archiveCount(){try{return (await archived()).length}catch(e){return null}}
  async function openArchive(){
    if(!canManage())return toast('Nur Inhaber oder Büro können das Archiv verwalten.','error');
    if(!ctx()?.client||!ctx()?.company?.id)return toast('Das zentrale Archiv ist verfügbar, sobald der Betrieb mit der Cloud verbunden ist.','info');
    showModal('dataSafetyArchiveModal');q('dataSafetyArchiveList').innerHTML='<div class="dsLoading">Archiv wird geladen …</div>';
    try{archiveRows=await archived();renderArchive()}catch(e){console.error(e);q('dataSafetyArchiveList').innerHTML='<div class="dsEmpty">Archiv konnte gerade nicht geladen werden.</div>'}
  }
  function removeLocalTombstone(collection,localId){
    const d=globalThis.data;if(!d?.meta?.deletedEntities)return;d.meta.deletedEntities=d.meta.deletedEntities.filter(x=>!(x.collection===collection&&String(x.id)===String(localId)));try{globalThis.safePersistCloudIdentity?.(d)}catch(e){}
  }
  async function restoreArchived(index){
    const item=archiveRows[index];if(!item)return;const {table,cfg,row}=item;
    const ok=await confirmAction('Aus Archiv wiederherstellen?',`${cfg.label}: ${cfg.title(row)}\n\nDer Eintrag erscheint danach wieder normal in AngebotsPilot.`,'Wiederherstellen');if(!ok)return;
    try{
      const c=ctx(),now=isoNow();removeLocalTombstone(cfg.collection,row.local_id);
      const {error}=await c.client.from(table).update({deleted_at:null,client_updated_at:now}).eq('company_id',c.company.id).eq('id',row.id);if(error)throw error;
      await audit('archive_restored',{table,local_id:row.local_id||'',deleted_at:row.deleted_at},cfg.collection,row.local_id||row.id);
      if(globalThis.CloudSync?.pullCloud)await globalThis.CloudSync.pullCloud();archiveRows=await archived();renderArchive();enhanceBackupCard();globalThis.renderAll?.();toast('✓ Aus Archiv wiederhergestellt.','success');
    }catch(e){console.error(e);toast(String(e?.message||'Wiederherstellung aus Archiv fehlgeschlagen.'),'error')}
  }

  function ensureUI(){
    if(q('dataSafetyStyles'))return;
    const style=document.createElement('style');style.id='dataSafetyStyles';style.textContent=`
      .dsGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:12px}.dsAction{border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025);padding:14px;text-align:left;color:inherit;display:grid;gap:5px}.dsAction span{font-size:1.2rem}.dsAction b{font-size:.84rem}.dsAction small{font-size:.7rem;color:var(--muted);line-height:1.35}.dsStatus{margin-top:12px;padding:11px 12px;border-radius:12px;border:1px solid var(--line);font-size:.74rem;color:var(--muted);line-height:1.45}.dsStatus b{color:var(--text)}.dsDanger{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
      .dsOverlay{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;padding:18px}.dsOverlay.hidden{display:none}.dsSheet{width:min(680px,100%);max-height:88vh;overflow:auto;background:var(--panel,#13171f);border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.5)}.dsHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.dsHead h3{margin:3px 0}.dsHead p{margin:0;color:var(--muted);font-size:.76rem;line-height:1.4}.dsClose{border:0;background:transparent;color:inherit;font-size:1.5rem}.dsFacts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0}.dsFact{border:1px solid var(--line);border-radius:12px;padding:11px}.dsFact span{display:block;color:var(--muted);font-size:.66rem;text-transform:uppercase}.dsFact b{display:block;margin-top:3px}.dsWarn{padding:10px 12px;border:1px solid rgba(255,190,80,.25);background:rgba(255,190,80,.07);border-radius:12px;font-size:.74rem;line-height:1.4;margin:8px 0}.dsSafe{padding:10px 12px;border:1px solid rgba(90,210,140,.25);background:rgba(90,210,140,.06);border-radius:12px;font-size:.74rem;line-height:1.4;margin:10px 0}.dsSheetActions{display:flex;gap:8px;margin-top:14px}.dsSheetActions .btn{flex:1}.dsArchiveRow{display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:12px 0}.dsArchiveRow:last-child{border-bottom:0}.dsArchiveRow>div{flex:1;min-width:0}.dsArchiveRow b,.dsArchiveRow small{display:block}.dsArchiveRow b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsArchiveRow small{color:var(--muted);font-size:.7rem;margin-top:3px}.dsEmpty,.dsLoading{text-align:center;color:var(--muted);padding:28px 8px}.dsCount{display:inline-flex;min-width:22px;height:22px;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.08);font-size:.7rem;font-weight:800}
      @media(max-width:650px){.dsGrid{grid-template-columns:1fr}.dsFacts{grid-template-columns:1fr}.dsOverlay{padding:10px}.dsSheetActions{flex-direction:column}}
    `;document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend',`
      <div class="dsOverlay hidden" id="dataSafetyRestoreModal"><div class="dsSheet"><div class="dsHead"><div><span class="securityBadge">🛡️ SICHERE WIEDERHERSTELLUNG</span><h3>Backup prüfen</h3><p>Es wird noch nichts verändert.</p></div><button class="dsClose" onclick="DataSafety.closeRestore()">×</button></div><div id="dataSafetyRestoreBody"></div></div></div>
      <div class="dsOverlay hidden" id="dataSafetyArchiveModal"><div class="dsSheet"><div class="dsHead"><div><span class="securityBadge">🗄️ ARCHIV</span><h3>Archivierte Einträge</h3><p>Löschen im Tagesgeschäft entfernt Kerndaten nicht sofort aus der Cloud.</p></div><button class="dsClose" onclick="DataSafety.closeArchive()">×</button></div><div id="dataSafetyArchiveList"></div></div></div>`);
  }
  function showModal(id){ensureUI();q(id)?.classList.remove('hidden')}
  function closeModal(id){q(id)?.classList.add('hidden')}
  function showRestorePreview(p){
    ensureUI();const warnings=p.warnings||[],body=q('dataSafetyRestoreBody');body.innerHTML=`
      <div class="dsFacts"><div class="dsFact"><span>Datei</span><b>${esc(p.fileName)}</b></div><div class="dsFact"><span>Integrität</span><b>${p.integrity==='verified'?'✓ geprüft':p.integrity==='not-provided'?'älteres Format':'–'}</b></div><div class="dsFact"><span>Backup</span><b>${totalCounts(p.backupCounts)} Kerndatensätze</b></div><div class="dsFact"><span>Aktuell</span><b>${totalCounts(p.currentCounts)} Kerndatensätze</b></div></div>
      <div class="dsSafe"><b>Kein stilles Überschreiben.</b><br>Die Sicherung wird mit dem aktuellen Betrieb zusammengeführt. Aktuelle Datensätze, die im Backup fehlen, bleiben erhalten. Cloud-/Login-Identität wird nicht aus dem Backup übernommen.</div>
      ${warnings.map(w=>`<div class="dsWarn">⚠️ ${esc(w)}</div>`).join('')}
      <div class="dsSheetActions"><button class="btn" onclick="DataSafety.closeRestore()">Abbrechen</button><button class="btn primary" onclick="DataSafety.applyRestore()">Backup zusammenführen</button></div>`;showModal('dataSafetyRestoreModal');
  }
  function renderArchive(){
    const host=q('dataSafetyArchiveList');if(!host)return;
    if(!archiveRows.length){host.innerHTML='<div class="dsEmpty"><b>Archiv ist leer.</b><br><small>Archivierte Kerndaten erscheinen hier und können wiederhergestellt werden.</small></div>';return}
    host.innerHTML=archiveRows.map((x,i)=>`<div class="dsArchiveRow"><div><b>${esc(x.cfg.title(x.row))}</b><small>${esc(x.cfg.label)} · archiviert ${formatDate(x.row.deleted_at)}</small></div><button class="btn small" onclick="DataSafety.restoreArchived(${i})">Wiederherstellen</button></div>`).join('');
  }
  async function confirmAction(title,text,label){
    if(globalThis.appConfirm)return !!(await globalThis.appConfirm({title,text,confirmLabel:label,icon:'🛡️'}));return confirm(`${title}\n\n${text}`);
  }

  async function enhanceBackupCard(){
    ensureUI();const h=[...document.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Datensicherung'),card=h?.closest('.card');if(!card)return;
    const connected=!!ctx()?.company?.id,arch=connected?await archiveCount():null;
    card.innerHTML=`<h3 style="margin-top:0">Datensicherung & Archiv</h3><p class="mini">Vollständiger Betriebsexport, sichere Wiederherstellung mit Vorschau und Cloud-Archiv statt versehentlichem endgültigem Datenverlust.</p>
      <div class="dsGrid"><button class="dsAction" type="button" onclick="DataSafety.exportCompany()"><span>📦</span><b>Betrieb exportieren</b><small>ZIP + JSON + CSV${connected?' · Cloud & lokal':' · lokal'}</small></button><label class="dsAction"><span>↩️</span><b>Backup einlesen</b><small>Erst prüfen, dann zusammenführen</small><input type="file" accept=".zip,.json,application/zip,application/json" hidden onchange="DataSafety.chooseBackup(event)"></label><button class="dsAction" type="button" onclick="DataSafety.openArchive()" ${connected?'':'disabled'}><span>🗄️</span><b>Archiv öffnen ${arch===null?'':`<span class="dsCount">${arch}</span>`}</b><small>${connected?'Gelöschte Kerndaten wiederherstellen':'Cloud-Konto erforderlich'}</small></button></div>
      <div class="dsStatus"><b>${connected?'☁️ Cloud-Betrieb verbunden':'📱 Lokaler Arbeitsbereich'}</b><br>Export bleibt auch im Abo-Lesemodus möglich. Abo-Kündigung löscht niemals automatisch Betriebsdaten. Zugangsdaten und Server-Secrets werden nicht exportiert.</div>
      <div class="dsDanger"><button class="btn danger" style="width:100%" onclick="resetApp()">Lokale App-Daten zurücksetzen</button><p class="mini">Getrennt vom Archiv und vom Abo. Nur verwenden, wenn du den lokalen Arbeitsbereich bewusst zurücksetzen willst.</p></div>`;
  }

  function startContextWatcher(){
    if(contextWatchTimer)return;
    const check=()=>{
      const c=ctx();
      const key=`${c?.session?.user?.id||''}:${c?.company?.id||''}:${c?.membership?.role||''}`;
      if(key!==contextWatchKey){
        contextWatchKey=key;
        enhanceBackupCard();
      }
    };
    check();
    contextWatchTimer=setInterval(check,1000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
    window.addEventListener('angebotspilot:syncstate',check);
  }

  function installLegacyOverrides(){
    globalThis.exportBackup=()=>exportCompany();
    globalThis.importBackup=event=>chooseBackup(event);
  }
  function wrapBuild(){
    const r=globalThis.renderAll;if(typeof r==='function'&&!r.__dsBuild){const w=function(){const x=r.apply(this,arguments);stamp();return x};w.__dsBuild=true;globalThis.renderAll=w}
    const s=globalThis.showScreen;if(typeof s==='function'&&!s.__dsBuild){const w=function(){const x=s.apply(this,arguments);stamp();if(arguments[0]==='settings')setTimeout(enhanceBackupCard,0);return x};w.__dsBuild=true;globalThis.showScreen=w}
  }
  function init(){ensureUI();installLegacyOverrides();wrapBuild();stamp();enhanceBackupCard();startContextWatcher()}

  globalThis.DataSafety={BUILD,exportCompany,chooseBackup,applyRestore,openArchive,restoreArchived,closeRestore:()=>{restorePreview=null;closeModal('dataSafetyRestoreModal')},closeArchive:()=>closeModal('dataSafetyArchiveModal'),refreshCard:enhanceBackupCard};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
