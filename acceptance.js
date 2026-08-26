/* AngebotsPilot v11.9.1 – Vor-Ort-Abnahme mit Kunden- und Ausführenden-Unterschrift */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const cloud=()=>globalThis.getCloudState?.()||{};
  let pending=null;
  let bypass=false;

  const pads={
    customer:{id:'acceptanceSignature',dirty:false,drawing:false,last:{x:0,y:0}},
    operator:{id:'acceptanceOperatorSignature',dirty:false,drawing:false,last:{x:0,y:0}}
  };

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const isoNow=()=>new Date().toISOString();
  const localDateTime=()=>new Date().toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'});
  const currentRole=()=>globalThis.data?.privacy?.role||'owner';
  const roleLabel=role=>({owner:'Chef',office:'Büro',worker:'Mitarbeiter'}[role]||'Betrieb');

  function linkedCustomer(job){return (globalThis.data?.customers||[]).find(c=>c.id===job?.customerId)||{};}
  function linkedOffer(job){return (globalThis.data?.offers||[]).find(o=>o.id===job?.offerId)||{};}
  function companySettings(){return globalThis.data?.settings||{};}
  function operatorName(){
    const {membership,session}=cloud();
    return membership?.display_name||session?.user?.user_metadata?.full_name||membership?.email||session?.user?.email||'Angemeldete Person';
  }

  function selectedStatus(){return q('acceptanceStatus')?.value||'accepted_clean';}
  function setStatus(value){
    q('acceptanceStatus').value=value;
    document.querySelectorAll('[data-acceptance-status]').forEach(btn=>btn.classList.toggle('active',btn.dataset.acceptanceStatus===value));
    const reserve=value==='accepted_with_reservations';
    q('acceptanceDefectsWrap')?.classList.toggle('hidden',!reserve);
  }

  function servicesHTML(job){
    const offer=linkedOffer(job);
    const lines=(offer.lines||[]).filter(l=>l?.name).slice(0,8);
    if(lines.length)return lines.map(l=>`<div class="acceptanceService"><span>✓</span><b>${esc(l.name)}</b></div>`).join('');
    return `<div class="acceptanceService"><span>✓</span><b>${esc(job.title||'Ausgeführte Arbeiten')}</b></div>${job.notes?`<div class="acceptanceService sub"><span>•</span><b>${esc(job.notes)}</b></div>`:''}`;
  }

  function getPad(key){return pads[key];}
  function canvasOf(key){return q(getPad(key).id);}
  function configureContext(canvas,ratio){
    const ctx=canvas.getContext('2d');
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=2.4;ctx.strokeStyle='#f4f6fb';
    return ctx;
  }
  function fitCanvas(key){
    const pad=getPad(key),canvas=canvasOf(key);if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const ratio=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    const cssW=Math.max(280,Math.floor(rect.width||520));
    const cssH=170;
    const old=pad.dirty?canvas.toDataURL('image/png'):null;
    canvas.width=Math.floor(cssW*ratio);canvas.height=Math.floor(cssH*ratio);canvas.style.height=cssH+'px';
    const ctx=configureContext(canvas,ratio);
    if(old){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,cssW,cssH);img.src=old;}
  }
  function point(key,ev){
    const c=canvasOf(key),r=c.getBoundingClientRect(),e=ev.touches?.[0]||ev.changedTouches?.[0]||ev;
    return{x:e.clientX-r.left,y:e.clientY-r.top};
  }
  function startDraw(key,ev){const pad=getPad(key);ev.preventDefault();pad.drawing=true;pad.last=point(key,ev);}
  function moveDraw(key,ev){
    const pad=getPad(key);if(!pad.drawing)return;ev.preventDefault();
    const p=point(key,ev),ctx=canvasOf(key).getContext('2d');ctx.beginPath();ctx.moveTo(pad.last.x,pad.last.y);ctx.lineTo(p.x,p.y);ctx.stroke();pad.last=p;pad.dirty=true;
  }
  function stopDraw(key,ev){const pad=getPad(key);if(pad.drawing)ev?.preventDefault?.();pad.drawing=false;}
  function clearPad(key){
    const pad=getPad(key),c=canvasOf(key);if(c){const ratio=Math.max(1,Math.min(3,window.devicePixelRatio||1));const ctx=c.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);configureContext(c,ratio);}pad.dirty=false;pad.drawing=false;
  }
  function clearSignature(){clearPad('customer');}
  function clearOperatorSignature(){clearPad('operator');}
  function attachCanvas(key){
    const c=canvasOf(key);if(!c||c.dataset.bound)return;c.dataset.bound='1';
    c.addEventListener('pointerdown',ev=>startDraw(key,ev));c.addEventListener('pointermove',ev=>moveDraw(key,ev));c.addEventListener('pointerup',ev=>stopDraw(key,ev));c.addEventListener('pointercancel',ev=>stopDraw(key,ev));c.addEventListener('pointerleave',ev=>stopDraw(key,ev));
  }
  function setupCanvases(){for(const key of Object.keys(pads)){fitCanvas(key);attachCanvas(key);}}

  function begin(job,oldJob){
    if(bypass){bypass=false;return false;}
    const state=cloud();
    if(!state.client||!state.company||!state.session){globalThis.toast?.('Für die Abnahme wird eine Cloud-Verbindung benötigt.');return true;}
    pending={job:structuredClone(job),oldJob:oldJob?structuredClone(oldJob):null};
    const customer=linkedCustomer(job),offer=linkedOffer(job),role=currentRole(),name=operatorName();
    q('acceptanceJobTitle').textContent=job.title||'Baustelle';
    q('acceptanceCustomer').textContent=customer.name||'Kunde';
    q('acceptanceAddress').textContent=job.address||customer.address||'Adresse nicht hinterlegt';
    q('acceptanceOffer').textContent=offer.number?`${offer.number} · ${offer.subject||''}`:'Kein Angebot verknüpft';
    q('acceptanceServices').innerHTML=servicesHTML(job);
    q('acceptanceCustomerName').value=customer.contact||customer.name||'';
    q('acceptanceOperatorName').value=name;
    q('acceptanceOperatorRole').textContent=roleLabel(role);
    q('acceptanceOperatorHeading').textContent=role==='worker'?'Mitarbeiter unterschreibt':role==='owner'?'Chef unterschreibt':'Betriebliche Bestätigung';
    q('acceptanceOperatorHint').textContent=`${roleLabel(role)} bestätigt die dokumentierte Übergabe auf diesem Gerät.`;
    q('acceptanceDefects').value='';q('acceptanceNotes').value='';
    const now=localDateTime();q('acceptanceTimestamp').textContent=now;q('acceptanceOperatorTimestamp').textContent=now;
    q('acceptancePhotoCount').textContent=`${(job.photos||[]).length} Baustellenfoto${(job.photos||[]).length===1?'':'s'} dokumentiert`;
    setStatus('accepted_clean');clearSignature();clearOperatorSignature();
    q('acceptanceBackdrop').classList.remove('hidden');document.body.classList.add('acceptanceOpen');
    q('acceptanceBackdrop').scrollTop=0;
    requestAnimationFrame(setupCanvases);
    return true;
  }
  function closeSheet(){q('acceptanceBackdrop')?.classList.add('hidden');document.body.classList.remove('acceptanceOpen');}
  function cancel(){
    closeSheet();
    if(pending){const status=q('jobStatus');if(status)status.value=pending.oldJob?.status||'active';globalThis.APCustomSelect?.sync?.();}
    pending=null;clearSignature();clearOperatorSignature();
  }

  function dataUrlBytes(url){const raw=atob(String(url).split(',')[1]||'');const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  async function sha256(bytes){const input=bytes instanceof Blob?new Uint8Array(await bytes.arrayBuffer()):bytes;const hash=await crypto.subtle.digest('SHA-256',input);return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  function ascii(v){return globalThis.pdfAscii?globalThis.pdfAscii(v):String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ');}
  function pdfEscape(v){return ascii(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
  function wrap(text,max=78){const words=ascii(text).split(/\s+/).filter(Boolean),lines=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(t.length>max){if(line)lines.push(line);line=w;}else line=t;}if(line)lines.push(line);return lines;}
  function jpegDimensions(bytes){
    let i=2;while(i<bytes.length){if(bytes[i]!==0xFF){i++;continue;}const marker=bytes[i+1];const len=(bytes[i+2]<<8)+bytes[i+3];if([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker))return{h:(bytes[i+5]<<8)+bytes[i+6],w:(bytes[i+7]<<8)+bytes[i+8]};i+=2+len;}return{w:900,h:300};
  }
  function pdfImageBox(bytes,maxW,maxH){const d=jpegDimensions(bytes),scale=Math.min(maxW/d.w,maxH/d.h);return{sourceW:d.w,sourceH:d.h,w:d.w*scale,h:d.h*scale};}
  function buildPdf(snapshot,customerSignatureBytes,operatorSignatureBytes){
    const enc=new TextEncoder(),chunks=[],offsets=[0];let size=0;
    const push=b=>{const u=typeof b==='string'?enc.encode(b):b;chunks.push(u);size+=u.length;};
    const addObj=(n,head,raw=null,tail='')=>{offsets[n]=size;push(`${n} 0 obj\n${head}`);if(raw)push(raw);push(`${tail}\nendobj\n`);};
    const lines=[];const add=(txt,bold=false,sz=10)=>lines.push({txt,bold,sz});
    add('ABNAHMEPROTOKOLL',true,18);add(snapshot.company.companyName||'Betrieb',true,11);add(snapshot.company.address||'',false,8);add('');
    add(`Baustelle: ${snapshot.job.title}`,true,12);add(`Kunde: ${snapshot.customer.name}`);add(`Adresse: ${snapshot.job.address||snapshot.customer.address||''}`);add(`Datum / Uhrzeit: ${snapshot.signedLocal}`);if(snapshot.offer.number)add(`Angebot: ${snapshot.offer.number} · ${snapshot.offer.subject||''}`);add('');
    add('Ausgeführte / dokumentierte Leistungen',true,11);snapshot.services.slice(0,8).forEach(s=>wrap('• '+s,74).forEach(x=>add(x,false,9)));add('');
    add(snapshot.acceptanceStatus==='accepted_clean'?'Abnahme: ohne erkennbare Mängel / Vorbehalte':'Abnahme: mit dokumentierten Mängeln / Restarbeiten',true,11);
    if(snapshot.defects)wrap('Mängel / Restarbeiten: '+snapshot.defects,76).slice(0,5).forEach(x=>add(x,false,9));
    if(snapshot.notes)wrap('Bemerkungen: '+snapshot.notes,76).slice(0,4).forEach(x=>add(x,false,9));
    add(`Baustellenfotos in der Akte: ${snapshot.photoCount}`,false,9);add('');
    wrap('Erklärung: Die oben beschriebenen Leistungen wurden gemeinsam besichtigt. Der Kunde bestätigt mit seiner Unterschrift den ausgewählten Abnahmestatus und die dokumentierten Vorbehalte bzw. Mängel. Die betriebliche Seite bestätigt die dokumentierte Übergabe. Gesetzliche Rechte bleiben unberührt.',76).forEach(x=>add(x,false,8));

    let y=800,content='';for(const l of lines){if(!l.txt){y-=8;continue;}if(y<285)break;content+=`BT /${l.bold?'F2':'F1'} ${l.sz} Tf 54 ${y.toFixed(1)} Td (${pdfEscape(l.txt)}) Tj ET\n`;y-=l.sz+5;}
    content+=`BT /F2 9 Tf 54 236 Td (Kunde: ${pdfEscape(snapshot.customerSigner)}) Tj ET\n`;
    content+=`BT /F2 9 Tf 315 236 Td (${pdfEscape(snapshot.operatorRoleLabel)}: ${pdfEscape(snapshot.operatorName)}) Tj ET\n`;
    content+=`BT /F1 7 Tf 54 222 Td (Unterschrift Kunde) Tj ET\n`;
    content+=`BT /F1 7 Tf 315 222 Td (Unterschrift Betrieb / Ausfuehrender) Tj ET\n`;
    const cBox=pdfImageBox(customerSignatureBytes,220,88),oBox=pdfImageBox(operatorSignatureBytes,220,88);
    content+=`q ${cBox.w.toFixed(2)} 0 0 ${cBox.h.toFixed(2)} 54 118 cm /Im1 Do Q\n`;
    content+=`q ${oBox.w.toFixed(2)} 0 0 ${oBox.h.toFixed(2)} 315 118 cm /Im2 Do Q\n`;
    content+=`0.8 w 54 110 m 274 110 l S\n0.8 w 315 110 m 535 110 l S\n`;
    content+=`BT /F1 7 Tf 54 91 Td (Zeitpunkt: ${pdfEscape(snapshot.signedLocal)}) Tj ET\n`;
    content+=`BT /F1 7 Tf 315 91 Td (Rolle: ${pdfEscape(snapshot.operatorRoleLabel)}) Tj ET\n`;
    content+=`BT /F1 7 Tf 54 70 Td (Dokument-ID: ${pdfEscape(snapshot.documentId)}) Tj ET\n`;
    const contentBytes=enc.encode(content);
    push('%PDF-1.4\n%AP11\n');
    addObj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    addObj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    addObj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 7 0 R /Im2 8 0 R >> >> /Contents 6 0 R >>');
    addObj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    addObj(5,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    addObj(6,`<< /Length ${contentBytes.length} >>\nstream\n`,contentBytes,'\nendstream');
    addObj(7,`<< /Type /XObject /Subtype /Image /Width ${cBox.sourceW} /Height ${cBox.sourceH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${customerSignatureBytes.length} >>\nstream\n`,customerSignatureBytes,'\nendstream');
    addObj(8,`<< /Type /XObject /Subtype /Image /Width ${oBox.sourceW} /Height ${oBox.sourceH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${operatorSignatureBytes.length} >>\nstream\n`,operatorSignatureBytes,'\nendstream');
    const xref=size;push(`xref\n0 9\n0000000000 65535 f \n`);for(let i=1;i<=8;i++)push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);push(`trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks,{type:'application/pdf'});
  }

  async function resolveCloudRefs(job){
    const {client,company}=cloud();
    const {data:cj,error:je}=await client.from('jobs').select('id,customer_id').eq('company_id',company.id).eq('local_id',String(job.id)).is('deleted_at',null).maybeSingle();if(je)throw je;if(!cj)throw new Error('Baustelle ist noch nicht in der Cloud.');return cj;
  }
  function snapshot(job,documentId,signedAt){
    const c=linkedCustomer(job),o=linkedOffer(job),s=companySettings(),role=currentRole();const lines=(o.lines||[]).map(l=>l.name).filter(Boolean);
    return{documentId,signedAt,signedLocal:localDateTime(),acceptanceStatus:selectedStatus(),customerSigner:q('acceptanceCustomerName').value.trim(),defects:q('acceptanceDefects').value.trim(),notes:q('acceptanceNotes').value.trim(),photoCount:(job.photos||[]).length,operatorName:operatorName(),operatorRole:role,operatorRoleLabel:roleLabel(role),company:{companyName:s.companyName||'',ownerName:s.ownerName||'',address:s.address||'',phone:s.phone||'',email:s.email||'',countryCode:s.countryCode||'DE'},customer:{id:c.id||'',name:c.name||'',contact:c.contact||'',address:c.address||'',email:c.email||'',phone:c.phone||''},job:{id:job.id,title:job.title||'',address:job.address||'',start:job.start||'',startTime:job.startTime||'',notes:job.notes||'',docNote:job.docNote||''},offer:{id:o.id||'',number:o.number||'',subject:o.subject||''},services:lines.length?lines:[job.title||'Ausgeführte Arbeiten']};
  }

  async function finalize(){
    if(!pending)return;
    if(!q('acceptanceCustomerName').value.trim())return globalThis.toast?.('Bitte Namen der unterschreibenden Person eintragen.');
    if(selectedStatus()==='accepted_with_reservations'&&!q('acceptanceDefects').value.trim())return globalThis.toast?.('Bitte Mängel oder Restarbeiten dokumentieren.');
    if(!pads.customer.dirty)return globalThis.toast?.('Bitte den Kunden unterschreiben lassen.');
    if(!pads.operator.dirty)return globalThis.toast?.(`${roleLabel(currentRole())} muss die Abnahme ebenfalls unterschreiben.`);
    const btn=q('acceptanceFinalize');btn.disabled=true;btn.textContent='Abnahme wird gesichert …';
    try{
      const job=pending.job,{client,company,session}=cloud();if(!client||!company||!session)throw new Error('Cloud nicht verbunden');
      const documentId=crypto.randomUUID?.()||('abn_'+Date.now()),signedAt=isoNow(),snap=snapshot(job,documentId,signedAt);
      const customerSigUrl=q('acceptanceSignature').toDataURL('image/jpeg',0.92),customerSigBytes=dataUrlBytes(customerSigUrl),customerSigHash=await sha256(customerSigBytes);
      const operatorSigUrl=q('acceptanceOperatorSignature').toDataURL('image/jpeg',0.92),operatorSigBytes=dataUrlBytes(operatorSigUrl),operatorSigHash=await sha256(operatorSigBytes);
      snap.operatorSignatureSha256=operatorSigHash;
      const pdf=buildPdf(snap,customerSigBytes,operatorSigBytes),pdfHash=await sha256(pdf);
      const cj=await resolveCloudRefs(job);
      const clean=(job.title||'Baustelle').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g,'-').replace(/-+/g,'-').slice(0,45);
      const filename=`Abnahmeprotokoll-${clean||'Baustelle'}-${new Date().toISOString().slice(0,10)}.pdf`;
      const uploaded=await globalThis.CloudFiles?.uploadJobFile?.(job.id,pdf,filename,'acceptance');if(!uploaded)throw new Error('PDF konnte nicht hochgeladen werden');
      snap.pdfStoragePath=uploaded.storagePath;snap.pdfSha256=pdfHash;snap.customerSignatureSha256=customerSigHash;
      const snapHash=await sha256(new TextEncoder().encode(JSON.stringify(snap)));
      const {error}=await client.from('job_acceptances').insert({company_id:company.id,job_id:cj.id,customer_id:cj.customer_id,protocol_number:documentId,acceptance_result:snap.acceptanceStatus==='accepted_clean'?'accepted':'accepted_with_reservations',customer_name:snap.customerSigner,defects_text:snap.defects,remaining_work:snap.acceptanceStatus==='accepted_with_reservations'?snap.defects:'',notes:snap.notes,signature_data:customerSigUrl,snapshot:snap,snapshot_hash:snapHash,created_by:session.user.id,signed_at:signedAt});
      if(error){try{await globalThis.CloudFiles?.deleteCloudFile?.(uploaded.id)}catch(ignore){}throw error;}

      // Erst nach erfolgreicher, unveränderbarer Cloud-Sicherung schließen.
      closeSheet();
      bypass=true;pending=null;
      globalThis.toast?.('✓ Abnahme abgeschlossen und sicher gespeichert');
      requestAnimationFrame(()=>globalThis.saveJob?.());
      globalThis.Notifications?.notifyOwnerOffice?.('Baustelle abgenommen',`${job.title} · Kunde und ${roleLabel(currentRole()).toLowerCase()} haben unterschrieben.`,{type:'acceptance',tag:`acceptance-${job.id}-${documentId}`,url:'./?screen=jobs',metadata:{screen:'jobs',job_local_id:job.id}}).catch(()=>{});
    }catch(e){console.error('Abnahme',e);globalThis.toast?.('Abnahme konnte nicht sicher gespeichert werden. Bitte erneut versuchen.');}
    finally{btn.disabled=false;btn.textContent='✓ Abnahme & Auftrag abschließen';}
  }

  function shouldIntercept(obj,old){if(bypass){bypass=false;return false;}return obj?.status==='done'&&old?.status!=='done';}
  function consumeBypass(){if(bypass){bypass=false;return true;}return false;}

  globalThis.Acceptance={begin,cancel,finalize,setStatus,clearSignature,clearOperatorSignature,shouldIntercept,consumeBypass};
  globalThis.setAcceptanceStatus=setStatus;
  globalThis.clearAcceptanceSignature=clearSignature;
  globalThis.clearAcceptanceOperatorSignature=clearOperatorSignature;
  globalThis.finalizeAcceptance=finalize;
  globalThis.cancelAcceptance=cancel;
})();
