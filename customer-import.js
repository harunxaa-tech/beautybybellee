/* AngebotsPilot v11.26 – datensparsamer Bestandskunden-Import
   CSV/XLSX werden ausschließlich im Browser gelesen. Die Quelldatei wird nicht hochgeladen. */
(function(){
  'use strict';

  const NOTICE_VERSION='2026-09-07-v1';
  const MAX_ROWS=5000;
  const MAP_FIELDS=[
    ['name','Name / Firma',true],['firstName','Vorname',false],['lastName','Nachname',false],['contact','Ansprechpartner',false],
    ['address','Vollständige Adresse',false],['street','Straße + Hausnr.',false],['zip','PLZ',false],['city','Ort',false],['country','Land',false],
    ['phone','Telefon',false],['email','E-Mail',false],['vatId','USt-ID / UID / MWST-Nr.',false],['customerNumber','Kundennummer',false],['notes','Notiz',false]
  ];
  const ALIASES={
    name:['name','firma','firmenname','unternehmen','kunde','kundenname','company','customer','organisation','organization'],
    firstName:['vorname','first name','firstname','given name'],
    lastName:['nachname','familienname','last name','lastname','surname'],
    contact:['ansprechpartner','kontakt','contact person','contact'],
    address:['adresse','anschrift','vollständige adresse','vollstaendige adresse','address'],
    street:['straße','strasse','street','straße hausnr','strasse hausnr','street address'],
    zip:['plz','postleitzahl','zip','postal code'],
    city:['ort','stadt','city','town'],
    country:['land','country','staat'],
    phone:['telefon','telefonnummer','phone','tel','mobil','mobile','handy'],
    email:['e-mail','email','mail','emailadresse','e mail'],
    vatId:['ust-id','ust id','ustid','umsatzsteuer-id','umsatzsteuer id','uid','mwst-nr','mwst nr','vat id','vat'],
    customerNumber:['kundennummer','kunden-nr','kunden nr','customer number','customer no','client id'],
    notes:['notiz','notizen','bemerkung','bemerkungen','notes','note']
  };

  const state={format:'',fileName:'',fileHash:'',headers:[],rows:[],mapping:{},prepared:[],batchId:'',source:'file'};
  const q=id=>document.getElementById(id);
  const esc=s=>globalThis.escapeHTML?globalThis.escapeHTML(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s??'').trim().toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const normEmail=s=>String(s??'').trim().toLowerCase();
  const normPhone=s=>{let v=String(s??'').trim().replace(/[^0-9+]/g,'');if(v.startsWith('00'))v='+'+v.slice(2);return v.replace(/^\+?/,'')};
  const now=()=>new Date().toISOString();
  const localRole=()=>data?.privacy?.role||'owner';

  function reset(){
    Object.assign(state,{format:'',fileName:'',fileHash:'',headers:[],rows:[],mapping:{},prepared:[],batchId:'',source:'file'});
    if(q('customerImportFile'))q('customerImportFile').value='';
    ['customerImportMappingCard','customerImportPreviewCard','customerImportConfirmCard'].forEach(id=>q(id)?.classList.add('hidden'));
    if(q('customerImportSourceSummary'))q('customerImportSourceSummary').innerHTML='';
    if(q('customerImportLegalConfirm'))q('customerImportLegalConfirm').checked=false;
  }

  function open(){
    if(localRole()==='worker')return toast('Bestandskunden können nur Chef oder Büro importieren');
    reset();showScreen('customerImport');renderCapability();renderCountryLegal();
  }


  function renderCountryLegal(){
    const el=q('customerImportCountryLegal');if(!el)return;
    const code=currentCountryCode();
    const text={
      DE:'Deutschland: DSGVO-konforme Voreinstellung. Der Betrieb bleibt Verantwortlicher; AngebotsPilot verarbeitet die Kundendaten im Auftrag. Der Import schafft keine Werbeeinwilligung.',
      AT:'Österreich: DSGVO-konforme Voreinstellung. Der Betrieb bleibt Verantwortlicher; AngebotsPilot verarbeitet die Kundendaten im Auftrag. Der Import schafft keine Werbeeinwilligung.',
      CH:'Schweiz: datenschutzfreundliche Voreinstellung nach DSG. Der Betrieb bleibt für Zweck und Rechtmäßigkeit verantwortlich; AngebotsPilot verarbeitet die Daten als Auftragsbearbeiter. Der Import schafft keine Werbeerlaubnis.'
    };
    el.textContent=text[code]||text.DE;
  }

  function renderCapability(){
    const el=q('customerImportContactsHint');if(!el)return;
    el.textContent=navigator.contacts?.select?'Kontakte werden erst nach deiner Auswahl gelesen.':'Auf diesem Browser nicht verfügbar. In der nativen iPhone-/Android-App kommt der direkte Kontakteimport; hier bitte CSV/XLSX nutzen.';
  }

  async function sha256(buf){
    if(!crypto?.subtle)return'';
    const hash=await crypto.subtle.digest('SHA-256',buf);
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function delimiterFor(line){
    const counts=[[';',0],[',',0],['\t',0]];
    let quote=false;
    for(const ch of line){
      if(ch==='"')quote=!quote;
      if(!quote){const x=counts.find(a=>a[0]===ch);if(x)x[1]++}
    }
    counts.sort((a,b)=>b[1]-a[1]);return counts[0][1]?counts[0][0]:';';
  }

  function parseCsvLine(line,delim){
    const out=[];let cur='',quote=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(quote&&line[i+1]==='"'){cur+='"';i++}else quote=!quote;
      }else if(ch===delim&&!quote){out.push(cur);cur=''}else cur+=ch;
    }
    out.push(cur);return out.map(x=>x.trim());
  }

  function parseCsvText(text){
    text=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const physical=text.split('\n');
    const logical=[];let acc='',quote=false;
    for(const ln of physical){
      acc+=(acc?'\n':'')+ln;
      let toggles=0;for(let i=0;i<ln.length;i++){if(ln[i]==='"'&&ln[i+1]==='"'){i++;continue}if(ln[i]==='"')toggles++}
      if(toggles%2)quote=!quote;
      if(!quote){if(acc.trim())logical.push(acc);acc=''}
    }
    if(acc.trim())logical.push(acc);
    if(!logical.length)throw new Error('Die Datei enthält keine Daten.');
    const delim=delimiterFor(logical[0]);
    const headers=parseCsvLine(logical[0],delim).map((h,i)=>h||`Spalte ${i+1}`);
    const rows=logical.slice(1,MAX_ROWS+1).map(line=>{
      const vals=parseCsvLine(line,delim),obj={};headers.forEach((h,i)=>obj[h]=vals[i]??'');return obj;
    }).filter(r=>Object.values(r).some(v=>String(v).trim()));
    return{headers,rows};
  }

  function readU16(v,o){return v.getUint16(o,true)}
  function readU32(v,o){return v.getUint32(o,true)}
  async function unzipEntries(buffer){
    const u8=new Uint8Array(buffer),view=new DataView(buffer);let eocd=-1;
    for(let i=Math.max(0,u8.length-65557);i<=u8.length-22;i++)if(readU32(view,i)===0x06054b50)eocd=i;
    if(eocd<0)throw new Error('Ungültige XLSX-Datei.');
    const count=readU16(view,eocd+10),cdOffset=readU32(view,eocd+16);let pos=cdOffset;const entries={};
    for(let n=0;n<count;n++){
      if(readU32(view,pos)!==0x02014b50)throw new Error('XLSX-ZIP konnte nicht gelesen werden.');
      const method=readU16(view,pos+10),csize=readU32(view,pos+20),usize=readU32(view,pos+24),fnlen=readU16(view,pos+28),exlen=readU16(view,pos+30),comlen=readU16(view,pos+32),loff=readU32(view,pos+42);
      const name=new TextDecoder('utf-8').decode(u8.slice(pos+46,pos+46+fnlen));
      const relevant=name==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/i.test(name);
      if(relevant){
        if(usize>25*1024*1024)throw new Error('Die Excel-Datei enthält ungewöhnlich große Tabelleninhalte und wurde aus Sicherheitsgründen abgelehnt.');
        if(readU32(view,loff)!==0x04034b50)throw new Error('XLSX-Eintrag beschädigt.');
        const lfn=readU16(view,loff+26),lex=readU16(view,loff+28),start=loff+30+lfn+lex,compressed=u8.slice(start,start+csize);
        let raw;
        if(method===0)raw=compressed;
        else if(method===8){
          if(typeof DecompressionStream==='undefined')throw new Error('Excel-Import wird auf diesem Browser nicht unterstützt. Bitte als CSV exportieren.');
          const ds=new DecompressionStream('deflate-raw');
          raw=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(ds)).arrayBuffer());
        }else throw new Error('Diese Excel-Komprimierung wird nicht unterstützt.');
        if(raw.length>25*1024*1024)throw new Error('Die entpackte Excel-Tabelle ist zu groß.');
        entries[name]=raw;
      }
      pos+=46+fnlen+exlen+comlen;
    }
    return entries;
  }

  function colIndex(ref){
    const m=String(ref||'').match(/^([A-Z]+)/i);if(!m)return 0;let n=0;for(const ch of m[1].toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1;
  }
  async function parseXlsx(buffer){
    const entries=await unzipEntries(buffer),decoder=new TextDecoder('utf-8');
    const shared=[];
    if(entries['xl/sharedStrings.xml']){
      const xml=decoder.decode(entries['xl/sharedStrings.xml']);
      if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Unsichere XML-Struktur in der Excel-Datei.');
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      if(doc.getElementsByTagName('parsererror').length)throw new Error('Excel-Texttabelle ist beschädigt.');
      [...doc.getElementsByTagName('si')].forEach(si=>shared.push(si.textContent||''));
    }
    const sheetName=Object.keys(entries).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(k)).sort()[0];
    if(!sheetName)throw new Error('Keine Tabelle in der XLSX-Datei gefunden.');
    const sheetXml=decoder.decode(entries[sheetName]);
    if(/<!DOCTYPE|<!ENTITY/i.test(sheetXml))throw new Error('Unsichere XML-Struktur in der Excel-Datei.');
    const doc=new DOMParser().parseFromString(sheetXml,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw new Error('Excel-Tabelle ist beschädigt.');
    const rows=[];
    [...doc.getElementsByTagName('row')].slice(0,MAX_ROWS+1).forEach(row=>{
      const vals=[];
      [...row.getElementsByTagName('c')].forEach(c=>{
        const idx=colIndex(c.getAttribute('r'));const t=c.getAttribute('t')||'';let value='';
        if(t==='inlineStr')value=c.getElementsByTagName('is')[0]?.textContent||'';
        else{const v=c.getElementsByTagName('v')[0]?.textContent||'';value=t==='s'?shared[Number(v)]??'':v}
        vals[idx]=String(value??'');
      });
      if(vals.some(v=>String(v||'').trim()))rows.push(vals);
    });
    if(!rows.length)throw new Error('Die Excel-Datei enthält keine Daten.');
    const headers=rows[0].map((h,i)=>String(h||`Spalte ${i+1}`).trim()||`Spalte ${i+1}`);
    const objects=rows.slice(1).map(vals=>{const o={};headers.forEach((h,i)=>o[h]=vals[i]??'');return o}).filter(r=>Object.values(r).some(v=>String(v).trim()));
    return{headers,rows:objects};
  }

  function decodeCsv(buffer){
    const u8=new Uint8Array(buffer);let text=new TextDecoder('utf-8').decode(u8);
    const bad=(text.match(/�/g)||[]).length;
    if(bad>2){try{text=new TextDecoder('windows-1252').decode(u8)}catch(e){}}
    return text;
  }

  async function handleFile(ev){
    const file=ev.target.files?.[0];if(!file)return;
    try{
      const ext=(file.name.split('.').pop()||'').toLowerCase();
      if(!['csv','xlsx'].includes(ext))throw new Error('Bitte CSV oder XLSX auswählen. Alte .xls-Dateien zuerst als XLSX oder CSV speichern.');
      if(file.size>15*1024*1024)throw new Error('Die Datei ist zu groß. Bitte auf maximal 15 MB verkleinern.');
      const buffer=await file.arrayBuffer();
      const parsed=ext==='xlsx'?await parseXlsx(buffer):parseCsvText(decodeCsv(buffer));
      state.format=ext;state.fileName=file.name;state.fileHash=await sha256(buffer);state.headers=parsed.headers;state.rows=parsed.rows;state.source='file';
      state.mapping=autoMap(parsed.headers);renderLoadedSource();renderMapping();
    }catch(e){console.error(e);toast(e?.message||'Datei konnte nicht gelesen werden');reset()}
  }

  function headerScore(header,aliases){
    const h=norm(header);let best=0;for(const a of aliases){const n=norm(a);if(h===n)best=Math.max(best,100);else if(h.includes(n)||n.includes(h))best=Math.max(best,70)}return best;
  }
  function autoMap(headers){
    const out={};
    for(const [field] of MAP_FIELDS){let best='',score=0;for(const h of headers){const s=headerScore(h,ALIASES[field]||[]);if(s>score){score=s;best=h}}if(score>=70)out[field]=best}
    return out;
  }

  function renderLoadedSource(){
    q('customerImportMappingCard')?.classList.remove('hidden');q('customerImportPreviewCard')?.classList.add('hidden');q('customerImportConfirmCard')?.classList.add('hidden');
    const label=state.source==='contacts'?'Handy-Kontakte':`${state.fileName} · ${state.format.toUpperCase()}`;
    if(q('customerImportSourceSummary'))q('customerImportSourceSummary').innerHTML=`<span class="securityBadge">✓ LOKAL GELESEN</span><div><b>${esc(label)}</b><small>${state.rows.length} Datensätze erkannt · Quelldatei wird nicht hochgeladen</small></div>`;
  }

  function renderMapping(){
    const wrap=q('customerImportMapping');if(!wrap)return;
    wrap.innerHTML=MAP_FIELDS.map(([field,label,required])=>{
      const opts=['<option value="">Nicht übernehmen</option>',...state.headers.map(h=>`<option value="${esc(h)}" ${state.mapping[field]===h?'selected':''}>${esc(h)}</option>`)].join('');
      return `<label class="importMapRow"><span><b>${esc(label)}</b>${required?'<small>Pflicht oder Vorname/Nachname</small>':'<small>optional</small>'}</span><select onchange="CustomerImport.setMapping('${field}',this.value)">${opts}</select></label>`;
    }).join('');
  }

  function setMapping(field,value){state.mapping[field]=value||''}
  function val(row,field){const h=state.mapping[field];return h?String(row[h]??'').trim():''}
  function countryCode(v){
    const n=norm(v);if(!n)return currentCountryCode();
    if(['de','deutschland','germany'].includes(n))return'DE';if(['at','osterreich','austria'].includes(n))return'AT';if(['ch','schweiz','switzerland','suisse','svizzera'].includes(n))return'CH';return currentCountryCode();
  }
  function combinedAddress(row){
    const full=val(row,'address');if(full)return full;
    const line=[val(row,'street'),[val(row,'zip'),val(row,'city')].filter(Boolean).join(' ')].filter(Boolean);return line.join(', ');
  }
  function duplicateKey(c){
    const customerNumber=norm(c.customerNumber);if(customerNumber)return`c:${customerNumber}`;
    const email=normEmail(c.email);if(email)return`e:${email}`;
    const phone=normPhone(c.phone);if(phone.length>=7)return`p:${phone}`;
    const na=norm(c.name),ad=norm(c.address);if(na&&ad)return`n:${na}|${ad}`;return'';
  }

  function prepareRows(){
    const existing=new Map();(data.customers||[]).forEach(c=>{const k=duplicateKey(c);if(k&&!existing.has(k))existing.set(k,c)});
    const seen=new Map();
    state.prepared=state.rows.map((row,index)=>{
      const first=val(row,'firstName'),last=val(row,'lastName'),explicit=val(row,'name');
      let name=explicit||[first,last].filter(Boolean).join(' ');let contact=val(row,'contact');
      if(explicit&&!contact&&(first||last))contact=[first,last].filter(Boolean).join(' ');
      const obj={name,contact,address:combinedAddress(row),phone:val(row,'phone'),email:val(row,'email'),notes:val(row,'notes'),customerType:'auto',countryCode:countryCode(val(row,'country')),vatId:val(row,'vatId'),buyerReference:'',supplierNumber:'',eInvoiceAddress:'',eInvoiceRequired:false,customerNumber:val(row,'customerNumber')};
      const key=duplicateKey(obj),match=key?existing.get(key)||seen.get(key):null;
      const invalid=!obj.name;
      if(key&&!match)seen.set(key,obj);
      return{index,obj,key,duplicate:!!match,duplicateName:match?.name||'',invalid,include:!invalid&&!match};
    });
  }

  function analyze(){
    if(!state.rows.length)return toast('Bitte zuerst eine Datei auswählen');
    const hasName=!!state.mapping.name||!!state.mapping.firstName||!!state.mapping.lastName;
    if(!hasName)return toast('Bitte Name/Firma oder Vorname/Nachname zuordnen');
    prepareRows();renderPreview();
  }

  function toggleRow(i,checked){const r=state.prepared.find(x=>x.index===Number(i));if(r&&!r.invalid){r.include=!!checked;renderPreviewSummary()}}

  function renderPreviewSummary(){
    const valid=state.prepared.filter(r=>!r.invalid),duplicates=valid.filter(r=>r.duplicate),included=valid.filter(r=>r.include),invalid=state.prepared.filter(r=>r.invalid);
    if(q('customerImportStats'))q('customerImportStats').innerHTML=`<div><b>${included.length}</b><small>werden importiert</small></div><div><b>${duplicates.length}</b><small>Dubletten erkannt</small></div><div><b>${invalid.length}</b><small>unvollständig</small></div>`;
    const btn=q('customerImportCommit');if(btn)btn.textContent=`${included.length} Kunden importieren`;
  }

  function renderPreview(){
    q('customerImportPreviewCard')?.classList.remove('hidden');q('customerImportConfirmCard')?.classList.remove('hidden');
    renderPreviewSummary();
    const list=q('customerImportPreviewList');if(!list)return;
    const important=[...state.prepared.filter(r=>r.duplicate||r.invalid),...state.prepared.filter(r=>!r.duplicate&&!r.invalid)].slice(0,60);
    list.innerHTML=important.map(r=>{
      const status=r.invalid?'<span class="importStatus bad">Fehlt Name</span>':r.duplicate?'<span class="importStatus warn">Mögliche Dublette</span>':'<span class="importStatus ok">Bereit</span>';
      const hint=r.duplicate?`Bereits vorhanden: ${esc(r.duplicateName)} · standardmäßig nicht importiert`:r.invalid?'Diese Zeile wird übersprungen':[r.obj.email,r.obj.phone,r.obj.address].filter(Boolean).map(esc).join(' · ');
      return `<label class="importPreviewRow ${r.duplicate?'duplicate':''} ${r.invalid?'invalid':''}"><input type="checkbox" ${r.include?'checked':''} ${r.invalid?'disabled':''} onchange="CustomerImport.toggleRow(${r.index},this.checked)"><span><b>${esc(r.obj.name||'(ohne Name)')}</b><small>${hint||'Keine weiteren Kontaktdaten'}</small></span>${status}</label>`;
    }).join('')+(state.prepared.length>60?`<div class="mini importMore">Weitere ${state.prepared.length-60} Zeilen werden anhand derselben Regeln verarbeitet.</div>`:'');
    q('customerImportPreviewCard')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function contacts(){
    if(!navigator.contacts?.select)return toast('Direkter Kontakteimport ist in diesem Browser nicht verfügbar');
    try{
      const selected=await navigator.contacts.select(['name','email','tel'],{multiple:true});if(!selected?.length)return;
      const headers=['Name','E-Mail','Telefon'];
      state.format='contacts';state.fileName='';state.fileHash='';state.source='contacts';state.headers=headers;
      state.rows=selected.slice(0,MAX_ROWS).map(c=>({'Name':Array.isArray(c.name)?c.name[0]||'':c.name||'','E-Mail':Array.isArray(c.email)?c.email[0]||'':c.email||'','Telefon':Array.isArray(c.tel)?c.tel[0]||'':c.tel||''}));
      state.mapping={name:'Name',email:'E-Mail',phone:'Telefon'};renderLoadedSource();renderMapping();
    }catch(e){if(e?.name!=='AbortError')toast('Kontakte konnten nicht gelesen werden')}
  }

  async function createBatch(summary){
    const cloud=globalThis.getCloudState?.();
    if(!cloud?.client||!cloud?.company?.id||!cloud?.session?.user?.id)throw new Error('Für einen nachvollziehbaren Import ist ein verbundenes Betriebskonto erforderlich.');
    const role=cloud.membership?.role||localRole();if(!['owner','office'].includes(role))throw new Error('Nur Chef oder Büro dürfen Bestandskunden importieren.');
    const {data:row,error}=await cloud.client.from('customer_import_batches').insert({
      company_id:cloud.company.id,created_by:cloud.session.user.id,source_format:state.format,file_sha256:state.fileHash||'',row_count:state.prepared.length,
      imported_count:0,duplicate_count:summary.duplicates,skipped_count:summary.skipped,country_code:currentCountryCode(),legal_confirmation:true,privacy_notice_version:NOTICE_VERSION,mapping:Object.fromEntries(Object.entries(state.mapping).filter(([,v])=>!!v).map(([k])=>[k,true])),status:'prepared'
    }).select('id').single();
    if(error)throw error;return row.id;
  }

  async function commit(){
    const confirm=q('customerImportLegalConfirm');if(!confirm?.checked)return toast('Bitte die Import-Bestätigung aktivieren');
    const included=state.prepared.filter(r=>r.include&&!r.invalid);if(!included.length)return toast('Keine Kunden zum Import ausgewählt');
    const duplicates=state.prepared.filter(r=>r.duplicate).length,skipped=state.prepared.length-included.length;
    const btn=q('customerImportCommit');if(btn){btn.disabled=true;btn.textContent='Import wird sicher gespeichert …'}
    try{
      state.batchId=await createBatch({duplicates,skipped});
      const cloud=globalThis.getCloudState?.();
      if(!cloud?.client)throw new Error('Cloud-Verbindung fehlt.');
      const stamp=now();
      const localRows=included.map(r=>({
        id:uid(),name:r.obj.name,contact:r.obj.contact,address:r.obj.address,phone:r.obj.phone,email:r.obj.email,notes:r.obj.notes,customerType:'auto',countryCode:r.obj.countryCode,
        vatId:r.obj.vatId,buyerReference:'',supplierNumber:'',eInvoiceAddress:'',eInvoiceRequired:false,electronicInvoiceConsentAt:'',customerNumber:r.obj.customerNumber||'',
        importSource:state.format,importBatchId:state.batchId,importedAt:stamp,createdAt:stamp,updatedAt:stamp
      }));
      const payload=localRows.map((c,i)=>({
        local_id:String(c.id),name:c.name,contact:c.contact||'',address:c.address||'',phone:c.phone||'',email:c.email||'',notes:c.notes||'',
        country_code:c.countryCode||currentCountryCode(),vat_id:c.vatId||'',customer_number:c.customerNumber||'',allow_duplicate:!!included[i]?.duplicate
      }));

      // Eine einzige DB-Transaktion: entweder der komplette Import wird gespeichert oder keiner.
      const {data:count,error}=await cloud.client.rpc('import_customers_batch',{
        p_batch_id:state.batchId,p_rows:payload,p_duplicate_count:duplicates,p_skipped_count:skipped
      });
      if(error)throw error;
      if(Number(count)!==localRows.length)throw new Error('Der Import wurde aus Sicherheitsgründen nicht vollständig übernommen.');

      addAudit('Bestandskunden importiert',`${localRows.length} Kunden · ${duplicates} Dubletten erkannt · Quelle ${state.format.toUpperCase()}`);
      // Cloud ist nach der atomaren Transaktion die Quelle der Wahrheit; danach lokalen Offline-Stand erneuern.
      try{await globalThis.CloudSync?.pullCloud?.()}catch(syncErr){
        console.warn('Import gespeichert, lokaler Stand konnte noch nicht aktualisiert werden',syncErr);
        data.customers.push(...localRows);persistAppState();renderAll();
      }
      const result={created:localRows.length,duplicates,skipped};reset();showScreen('customers');toast(`${result.created} Bestandskunden importiert`);
    }catch(e){
      console.error(e);
      try{
        const cloud=globalThis.getCloudState?.();
        if(state.batchId&&cloud?.client){
          await cloud.client.from('customer_import_batches').update({status:'failed',imported_count:0}).eq('id',state.batchId).eq('company_id',cloud.company.id).eq('status','prepared');
        }
      }catch(_e){console.warn('Fehlerstatus des Importprotokolls konnte nicht gesetzt werden',_e)}
      toast(e?.message||'Import fehlgeschlagen');
    }finally{if(btn){btn.disabled=false;renderPreviewSummary()}}
  }

  function template(){
    const rows=[['Firma/Name','Vorname','Nachname','Ansprechpartner','Straße','PLZ','Ort','Land','Telefon','E-Mail','USt-ID','Kundennummer','Notiz'],['Muster GmbH','','','Lisa Muster','Musterweg 8','80331','München','DE','089 123456','info@muster.example','DE123456789','KD-1001','Bestandskunde']];
    const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    downloadBlob(csv,'AngebotsPilot-Kundenimport-Vorlage.csv','text/csv;charset=utf-8');
  }

  globalThis.CustomerImport={open,handleFile,setMapping,analyze,toggleRow,contacts,commit,template,reset};
  globalThis.openCustomerImport=open;
  globalThis.handleCustomerImportFile=handleFile;
})();
