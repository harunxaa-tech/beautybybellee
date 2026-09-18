/* AngebotsPilot v11.31.02 – zentrale Runtime + Compliance Loader
   Der Publishable Key ist ausdrücklich für Browser-Apps gedacht.
   Keine geheimen Service-Role-Keys gehören jemals in diese Datei. */
globalThis.AP_CLOUD_CONFIG = Object.freeze({
  url: "https://haqztfpixbjqfiollazv.supabase.co",
  publishableKey: "sb_publishable_gpyLnT-j8lcLiIirHAqGUA_zvM7CuNa",
  projectRef: "haqztfpixbjqfiollazv",
  region: "eu-central-1",
  appUrl: "https://harunxaa-tech.github.io/beautybybellee/"
});

(function installAngebotsPilotRuntime(){
  'use strict';

  const VERSION='11.31.02';
  const DATA_SAFETY_SRC='./data-safety.js?v=11.30.6';
  const COMPLIANCE_SRC=`./compliance-v1131.js?v=${VERSION}`;
  const BOOT_KEY='__ANGEBOTSPILOT_RUNTIME_11_31_02__';

  function stampBuild(){
    document.querySelectorAll('[data-app-build]').forEach(el=>{
      if(el.textContent!==VERSION)el.textContent=VERSION;
    });
  }

  if(globalThis[BOOT_KEY]){
    stampBuild();
    globalThis.DataSafety?.refreshCard?.();
    return;
  }
  globalThis[BOOT_KEY]=true;

  globalThis.AP_BUILD_VERSION=VERSION;
  globalThis.APBuild=Object.freeze({
    version:VERSION,
    cacheTag:'angebotspilot-v11-31-02',
    stamp:stampBuild
  });

  let wrappersInstalled=false;
  let settingsObserver=null;
  let refreshTimer=null;

  // v11.31.0-r3: Rechnungseditor robust gegen fehlende/alte HTML-Felder machen.
  function ensureInvoiceEditorUi(){
    const editor=document.getElementById('invoiceEditor');
    if(!editor)return false;

    let serviceDate=document.getElementById('invoiceServiceDate');
    if(!serviceDate){
      const due=document.getElementById('invoiceDueDate');
      const dateRow=due?.closest?.('.row');
      if(dateRow){
        const field=document.createElement('div');
        field.className='field apInvoiceServiceDateField';
        field.innerHTML='<label>Leistungsdatum</label><input type="date" class="input" id="invoiceServiceDate" data-invoice-editable><small>Datum, an dem die Leistung ausgeführt bzw. abgeschlossen wurde.</small>';
        dateRow.insertAdjacentElement('afterend',field);
        serviceDate=field.querySelector('#invoiceServiceDate');
      }
    }

    // Die Compliance-Anzeige war im alten HTML noch nicht vorhanden. Sie ist optional,
    // soll aber sichtbar sein, sobald v11.31 aktiv ist.
    let complianceBox=document.getElementById('invoiceComplianceBox');
    if(!complianceBox){
      const lines=document.getElementById('invoiceLines');
      const lineCard=lines?.closest?.('.card');
      if(lineCard){
        complianceBox=document.createElement('div');
        complianceBox.id='invoiceComplianceBox';
        complianceBox.className='invoiceComplianceBox';
        complianceBox.innerHTML='<div class="invoiceComplianceHead"><span>🛡️</span><div><b>Rechnungsprüfung bereit</b><small>Pflichtfelder und E‑Rechnungsregeln werden vor dem Ausstellen geprüft.</small></div></div>';
        lineCard.insertAdjacentElement('beforebegin',complianceBox);
      }
    }

    return !!serviceDate;
  }

  function installInvoiceActionGuards(){
    ensureInvoiceEditorUi();
    const names=['newInvoice','editInvoice','createCorrectionDraft','createCancellationDraft','saveInvoice','autoSaveInvoiceAndClose'];
    for(const name of names){
      const fn=globalThis[name];
      if(typeof fn!=='function'||fn.__apInvoiceUiGuard)continue;
      const wrapped=function(){
        ensureInvoiceEditorUi();
        snapshotLinkedInvoiceDrafts();
        try{
          const result=fn.apply(this,arguments);
          if(result&&typeof result.then==='function'){
            return result.then(value=>{
              snapshotLinkedInvoiceDrafts();
              scheduleInvoiceSafetyRepair(250);
              return value;
            }).catch(error=>{
              console.error(`AngebotsPilot Rechnungsaktion ${name} fehlgeschlagen`,error);
              const message='Rechnungsaktion konnte nicht abgeschlossen werden. Bitte App einmal neu laden.';
              if(globalThis.toast)globalThis.toast(message,'error');
              else if(globalThis.showToast)globalThis.showToast(message,'error');
              return undefined;
            });
          }
          snapshotLinkedInvoiceDrafts();
          scheduleInvoiceSafetyRepair(250);
          return result;
        }catch(error){
          console.error(`AngebotsPilot Rechnungsaktion ${name} fehlgeschlagen`,error);
          const message='Rechnungsansicht konnte nicht geöffnet werden. Bitte App einmal neu laden.';
          if(globalThis.toast)globalThis.toast(message,'error');
          else if(globalThis.showToast)globalThis.showToast(message,'error');
          return undefined;
        }
      };
      wrapped.__apInvoiceUiGuard=true;
      wrapped.__apOriginal=fn;
      globalThis[name]=wrapped;
    }
  }

  function invoiceButtonDiagnostics(){
    const required=[
      'newInvoice','editInvoice','previewInvoice','finalizeInvoiceById','shareInvoicePDF',
      'markInvoicePaid','createCorrectionDraft','createCancellationDraft','addInvoiceLine',
      'saveInvoice','autoSaveInvoiceAndClose','printInvoice'
    ];
    const missing=required.filter(name=>typeof globalThis[name]!=='function');
    const ids=['invoiceEditor','invoiceId','invoiceNumber','invoiceCustomer','invoiceDate','invoiceDueDate','invoiceServiceDate','invoiceStatus','invoiceSubject','invoiceNotes','invoiceLines','invoiceAddLineBtn','invoiceDiscountType','invoiceDiscount','invoiceTaxTreatment','invoiceTaxRate','invoiceTaxNote','invoiceSaveBtn','invoicePreviewPaper','invoicePreviewSource'];
    const missingIds=ids.filter(id=>!document.getElementById(id));
    return{ok:missing.length===0&&missingIds.length===0,missingFunctions:missing,missingElements:missingIds};
  }

  globalThis.APInvoiceUI={version:'11.31.02',ensure:ensureInvoiceEditorUi,diagnostics:invoiceButtonDiagnostics};

  // v11.31.0-r4: Rechnungsbeziehungen nach dem Cloud-Push robust nachziehen.
  // Wichtig: Nur vorhandene lokale Beziehungen werden gesetzt; bestehende Cloud-Beziehungen
  // werden niemals durch leere lokale Werte auf NULL zurückgesetzt.
  let invoiceRelationRepairTimer=null;
  let invoiceRelationRepairRunning=false;

  async function repairInvoiceCloudRelations(){
    if(invoiceRelationRepairRunning)return;
    const linked=(globalThis.data?.invoices||[]).filter(inv=>inv?.correctionOf||inv?.originalInvoiceId||inv?.cancelledByInvoiceId);
    if(!linked.length)return;
    let ctx=null;
    try{ctx=globalThis.APCloudContext?.()||null}catch(e){ctx=null}
    if(!ctx?.client||!ctx?.company?.id||!ctx?.session?.user?.id)return;

    invoiceRelationRepairRunning=true;
    try{
      const {data:rows,error}=await ctx.client.from('invoices')
        .select('id,local_id,correction_of_id,original_invoice_id,cancelled_by_invoice_id')
        .eq('company_id',ctx.company.id)
        .is('deleted_at',null);
      if(error)throw error;
      const byLocal=new Map((rows||[]).filter(r=>r?.local_id).map(r=>[String(r.local_id),r]));

      for(const inv of linked){
        const cloud=byLocal.get(String(inv.id));
        if(!cloud)continue;
        const patch={};
        if(inv.correctionOf){
          const original=byLocal.get(String(inv.correctionOf));
          if(original?.id&&cloud.correction_of_id!==original.id)patch.correction_of_id=original.id;
        }
        if(inv.originalInvoiceId){
          const original=byLocal.get(String(inv.originalInvoiceId));
          if(original?.id&&cloud.original_invoice_id!==original.id)patch.original_invoice_id=original.id;
        }
        if(inv.cancelledByInvoiceId){
          const cancellation=byLocal.get(String(inv.cancelledByInvoiceId));
          if(cancellation?.id&&cloud.cancelled_by_invoice_id!==cancellation.id)patch.cancelled_by_invoice_id=cancellation.id;
        }
        if(!Object.keys(patch).length)continue;
        const {error:updateError}=await ctx.client.from('invoices')
          .update(patch)
          .eq('company_id',ctx.company.id)
          .eq('id',cloud.id);
        if(updateError)throw updateError;
      }
    }catch(error){
      console.warn('Rechnungsbeziehungen konnten noch nicht nachgezogen werden',error);
    }finally{
      invoiceRelationRepairRunning=false;
    }
  }

  function scheduleInvoiceRelationRepair(delay=450){
    clearTimeout(invoiceRelationRepairTimer);
    invoiceRelationRepairTimer=setTimeout(()=>repairInvoiceCloudRelations(),delay);
  }

  // v11.31.02: Schutzschicht für Korrektur-/Stornoentwürfe.
  // Sie verhindert, dass ein unvollständiger Cloud-Zwischenstand Positionen oder
  // die Verknüpfung zur Originalrechnung vernichtet.
  const INVOICE_SAFETY_KEY='angebotspilot_invoice_safety_v113102';
  let invoiceSafetyRepairTimer=null;
  let invoiceSafetyRepairRunning=false;
  let manualSyncInstalled=false;

  const cloneInvoiceSafety=value=>{
    try{return structuredClone(value)}catch(e){return JSON.parse(JSON.stringify(value))}
  };

  function readInvoiceSafetyShadow(){
    try{
      const raw=JSON.parse(localStorage.getItem(INVOICE_SAFETY_KEY)||'{}');
      return raw&&typeof raw==='object'?raw:{};
    }catch(e){return {}}
  }

  function writeInvoiceSafetyShadow(shadow){
    try{localStorage.setItem(INVOICE_SAFETY_KEY,JSON.stringify(shadow));return true}
    catch(e){console.warn('Rechnungs-Sicherheitskopie konnte lokal nicht gespeichert werden',e);return false}
  }

  function meaningfulInvoiceLines(inv){
    return (inv?.lines||[]).filter(line=>String(line?.name||'').trim());
  }

  function isProtectedInvoiceDraft(inv){
    return !!inv && inv.status==='draft' && !!(
      inv.correctionOf ||
      inv.originalInvoiceId ||
      inv.documentType==='correction' ||
      inv.documentType==='cancellation'
    );
  }

  function snapshotLinkedInvoiceDrafts(){
    const invoices=globalThis.data?.invoices||[];
    const shadow=readInvoiceSafetyShadow();
    let changed=false;
    for(const inv of invoices){
      if(!isProtectedInvoiceDraft(inv))continue;
      const lines=meaningfulInvoiceLines(inv);
      const old=shadow[String(inv.id)]?.invoice;
      // Einen bereits reicheren Snapshot niemals mit einem leeren Zwischenstand überschreiben.
      if(!lines.length && old && meaningfulInvoiceLines(old).length)continue;
      shadow[String(inv.id)]={
        capturedAt:new Date().toISOString(),
        number:inv.number||'',
        invoice:cloneInvoiceSafety(inv)
      };
      changed=true;
    }
    if(changed)writeInvoiceSafetyShadow(shadow);
    return shadow;
  }

  function restoreLocalInvoiceFromShadow(current,saved){
    if(!current||!saved||current.status!=='draft')return false;
    let changed=false;
    if(!current.correctionOf && saved.correctionOf){current.correctionOf=saved.correctionOf;changed=true}
    if(!current.originalInvoiceId && saved.originalInvoiceId){current.originalInvoiceId=saved.originalInvoiceId;changed=true}
    if(!current.cancelledByInvoiceId && saved.cancelledByInvoiceId){current.cancelledByInvoiceId=saved.cancelledByInvoiceId;changed=true}

    const currentLines=meaningfulInvoiceLines(current),savedLines=meaningfulInvoiceLines(saved);
    if(!currentLines.length && savedLines.length){
      current.lines=cloneInvoiceSafety(saved.lines||[]);
      for(const key of ['baseSubtotal','subtotal','total','discount','discountType','discountValue','tax']){
        if(saved[key]!==undefined)current[key]=cloneInvoiceSafety(saved[key]);
      }
      if(!String(current.subject||'').trim()&&saved.subject)current.subject=saved.subject;
      if(!String(current.notes||'').trim()&&saved.notes)current.notes=saved.notes;
      changed=true;
    }
    return changed;
  }

  async function repairInvoiceSafety(){
    if(invoiceSafetyRepairRunning)return;
    const shadow=readInvoiceSafetyShadow();
    const entries=Object.values(shadow||{}).filter(x=>x?.invoice&&isProtectedInvoiceDraft(x.invoice));
    if(!entries.length)return;

    invoiceSafetyRepairRunning=true;
    try{
      const invoices=globalThis.data?.invoices||[];
      let localChanged=false;
      for(const entry of entries){
        const saved=entry.invoice;
        const current=invoices.find(x=>String(x.id)===String(saved.id));
        if(current && restoreLocalInvoiceFromShadow(current,saved))localChanged=true;
      }
      if(localChanged){
        try{
          if(globalThis.safePersistCloudIdentity)globalThis.safePersistCloudIdentity(globalThis.data);
          else localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(globalThis.data));
        }catch(e){console.warn('Lokaler Rechnungsentwurf konnte nicht geschützt werden',e)}
        globalThis.renderAll?.();
      }

      let ctx=null;
      try{ctx=globalThis.APCloudContext?.()||null}catch(e){ctx=null}
      if(!ctx?.client||!ctx?.company?.id)return;

      const {data:rows,error}=await ctx.client.from('invoices')
        .select('id,local_id,status,total,subtotal,correction_of_id,original_invoice_id,cancelled_by_invoice_id,finalized_at')
        .eq('company_id',ctx.company.id)
        .is('deleted_at',null);
      if(error)throw error;
      const byLocal=new Map((rows||[]).filter(r=>r?.local_id).map(r=>[String(r.local_id),r]));
      const protectedCloudIds=[];

      for(const entry of entries){
        const saved=entry.invoice;
        const current=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(saved.id));
        const source=(current&&meaningfulInvoiceLines(current).length)?current:saved;
        const cloud=byLocal.get(String(saved.id));
        if(!cloud||cloud.finalized_at||cloud.status!=='draft')continue;
        protectedCloudIds.push(cloud.id);

        const patch={};
        if(source.correctionOf){
          const original=byLocal.get(String(source.correctionOf));
          if(original?.id&&cloud.correction_of_id!==original.id)patch.correction_of_id=original.id;
        }
        if(source.originalInvoiceId){
          const original=byLocal.get(String(source.originalInvoiceId));
          if(original?.id&&cloud.original_invoice_id!==original.id)patch.original_invoice_id=original.id;
        }
        if(source.cancelledByInvoiceId){
          const cancellation=byLocal.get(String(source.cancelledByInvoiceId));
          if(cancellation?.id&&cloud.cancelled_by_invoice_id!==cancellation.id)patch.cancelled_by_invoice_id=cancellation.id;
        }
        if(Object.keys(patch).length){
          const {error:updateError}=await ctx.client.from('invoices')
            .update(patch).eq('company_id',ctx.company.id).eq('id',cloud.id);
          if(updateError)throw updateError;
        }
      }

      if(protectedCloudIds.length){
        const {data:cloudLines,error:lineReadError}=await ctx.client.from('invoice_lines')
          .select('id,invoice_id').in('invoice_id',protectedCloudIds);
        if(lineReadError)throw lineReadError;
        const countByInvoice=new Map();
        for(const line of cloudLines||[])countByInvoice.set(line.invoice_id,(countByInvoice.get(line.invoice_id)||0)+1);

        for(const entry of entries){
          const saved=entry.invoice;
          const current=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(saved.id));
          const source=(current&&meaningfulInvoiceLines(current).length)?current:saved;
          const cloud=byLocal.get(String(saved.id));
          if(!cloud||cloud.finalized_at||cloud.status!=='draft')continue;
          const lines=meaningfulInvoiceLines(source);
          if(!lines.length || (countByInvoice.get(cloud.id)||0)>0)continue;

          const payload=lines.map((line,index)=>({
            invoice_id:cloud.id,
            local_id:String(line.id||`${source.id}:line:${index}`),
            position:index+1,
            name:String(line.name||'').trim(),
            qty:Number(line.qty)||1,
            unit:line.unit||'Stk.',
            price:Number(line.price)||0,
            workers:line.workers?Number(line.workers):null,
            hours_per_worker:line.hoursPerWorker?Number(line.hoursPerWorker):null
          }));
          const {error:insertError}=await ctx.client.from('invoice_lines').insert(payload);
          if(insertError)throw insertError;

          // Nur einen eindeutig beschädigten Entwurf (keine Cloud-Positionen) wieder auf
          // den bereits lokal gesicherten Betrag bringen. Finalisierte Rechnungen werden nie angefasst.
          const amountPatch={};
          for(const [localKey,cloudKey] of [['subtotal','subtotal'],['total','total']]){
            if(source[localKey]!==undefined)amountPatch[cloudKey]=Number(source[localKey])||0;
          }
          if(Object.keys(amountPatch).length){
            const {error:amountError}=await ctx.client.from('invoices')
              .update(amountPatch).eq('company_id',ctx.company.id).eq('id',cloud.id).is('finalized_at',null);
            if(amountError)throw amountError;
          }
        }
      }
    }catch(error){
      console.warn('Rechnungs-Sicherheitsprüfung konnte noch nicht vollständig abgeschlossen werden',error);
    }finally{
      invoiceSafetyRepairRunning=false;
    }
  }

  function scheduleInvoiceSafetyRepair(delay=300){
    clearTimeout(invoiceSafetyRepairTimer);
    invoiceSafetyRepairTimer=setTimeout(()=>repairInvoiceSafety(),delay);
  }

  function installManualSyncGuard(){
    const sync=globalThis.CloudSync;
    if(!sync||manualSyncInstalled||typeof sync.pushSnapshot!=='function'||typeof sync.pullCloud!=='function')return;
    manualSyncInstalled=true;

    const safeManual=async()=>{
      // Der alte CloudSync.manual()-Pfad setzt "syncing" vor pushSnapshot auf true.
      // pushSnapshot interpretiert das als bereits laufenden Sync und überspringt den Push.
      // Deshalb hier bewusst: erst pushen, danach pullen.
      snapshotLinkedInvoiceDrafts();
      await sync.pushSnapshot();
      await repairInvoiceSafety();
      await sync.pullCloud();
      await repairInvoiceSafety();
      snapshotLinkedInvoiceDrafts();
      return true;
    };

    sync.manual=safeManual;
    globalThis.manualCloudSync=async()=>{
      try{
        await safeManual();
        globalThis.toast?.('☁️ Synchronisiert');
      }catch(error){
        console.error(error);
        globalThis.toast?.('Cloud-Sync fehlgeschlagen');
      }
    };
  }

  function dataSafetyCardIsCurrent(){
    const card=document.getElementById('dataSafetyCard');
    if(!card)return false;
    return card.querySelector('h3')?.textContent?.trim()==='Datensicherung & Archiv' && !!card.querySelector('.dsGrid');
  }

  function scheduleDataSafetyRefresh(force=false){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      const refresh=globalThis.DataSafety?.refreshCard;
      if(typeof refresh!=='function')return;
      if(force||!dataSafetyCardIsCurrent()){
        Promise.resolve(refresh()).catch(err=>console.warn('Datensicherung konnte nicht aktualisiert werden',err));
      }
    },50);
  }

  function claimCentralBuildVersion(){
    // script.js v11.30.1 enthält noch eine alte interne Stamp-Funktion.
    // Für die laufende App wird die zentrale Runtime-Quelle verbindlich verwendet.
    if(typeof globalThis.syncVisibleBuildVersion==='function'){
      globalThis.syncVisibleBuildVersion=stampBuild;
    }
  }

  function installWrappers(){
    claimCentralBuildVersion();
    if(wrappersInstalled)return;
    const render=globalThis.renderAll;
    const show=globalThis.showScreen;
    if(typeof render!=='function'||typeof show!=='function')return;

    if(!render.__apCentralRuntime){
      const wrappedRender=function(){
        const result=render.apply(this,arguments);
        ensureInvoiceEditorUi();
        installInvoiceActionGuards();
        stampBuild();
        scheduleDataSafetyRefresh();
        return result;
      };
      wrappedRender.__apCentralRuntime=true;
      globalThis.renderAll=wrappedRender;
    }

    if(!show.__apCentralRuntime){
      const wrappedShow=function(){
        if(arguments[0]==='invoiceEditor')ensureInvoiceEditorUi();
        const result=show.apply(this,arguments);
        if(arguments[0]==='invoiceEditor')ensureInvoiceEditorUi();
        installInvoiceActionGuards();
        stampBuild();
        if(arguments[0]==='settings')scheduleDataSafetyRefresh(true);
        return result;
      };
      wrappedShow.__apCentralRuntime=true;
      globalThis.showScreen=wrappedShow;
    }
    wrappersInstalled=true;
  }

  function installSettingsObserver(){
    if(settingsObserver)return;
    const settings=document.getElementById('settings');
    if(!settings)return;
    settingsObserver=new MutationObserver(()=>{
      const legacy=[...settings.querySelectorAll('h3')].some(h=>h.textContent.trim()==='Datensicherung');
      if(legacy||!dataSafetyCardIsCurrent())scheduleDataSafetyRefresh();
    });
    settingsObserver.observe(settings,{childList:true,subtree:true});
  }

  function installRestoreSafetyGuard(){
    const ds=globalThis.DataSafety;
    if(!ds||ds.__apRestoreSafetyGuard)return;
    ds.__apRestoreSafetyGuard=true;

    const CORE=['customers','offers','events','tasks','jobs','invoices','catalog'];
    const FORMAT='angebotspilot-backup';
    const MAX_FORMAT_VERSION=2;
    const decoder=new TextDecoder();
    const encoder=new TextEncoder();
    let safeRestoreState=null;

    const clone=value=>{
      try{return structuredClone(value)}catch(e){return JSON.parse(JSON.stringify(value))}
    };
    const nowIso=()=>new Date().toISOString();
    const total=obj=>Object.values(obj||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
    const notify=(message,type='info')=>{
      if(globalThis.toast)return globalThis.toast(message,type);
      if(globalThis.showToast)return globalThis.showToast(message,type);
      console[type==='error'?'error':'log'](message);
    };
    const currentContext=()=>{
      try{return globalThis.APCloudContext?.()||null}catch(e){return null}
    };
    const canManage=()=>['owner','office'].includes(currentContext()?.membership?.role||globalThis.data?.privacy?.role||'owner');

    function readStoredZip(buffer){
      const view=new DataView(buffer),bytes=new Uint8Array(buffer),files={};let pos=0;
      const u16=o=>view.getUint16(o,true),u32=o=>view.getUint32(o,true);
      while(pos+30<=bytes.length&&u32(pos)===0x04034b50){
        const flags=u16(pos+6),method=u16(pos+8),size=u32(pos+18),nameLen=u16(pos+26),extraLen=u16(pos+28);
        if(method!==0)throw new Error('Dieses ZIP verwendet eine nicht unterstützte Komprimierung. Bitte ein AngebotsPilot-Backup verwenden.');
        if(flags&0x08)throw new Error('Dieses ZIP-Format kann nicht sicher geprüft werden.');
        const name=decoder.decode(bytes.slice(pos+30,pos+30+nameLen));
        const begin=pos+30+nameLen+extraLen,end=begin+size;
        if(end>bytes.length)throw new Error('Backup-ZIP ist beschädigt.');
        files[name]=bytes.slice(begin,end);pos=end;
      }
      return files;
    }

    async function sha256(text){
      if(!crypto?.subtle)return '';
      const digest=await crypto.subtle.digest('SHA-256',encoder.encode(text));
      return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    }

    function normalizeBackup(raw){
      if(raw?.format===FORMAT&&raw?.data)return raw;
      if(raw&&typeof raw==='object'&&(Array.isArray(raw.customers)||Array.isArray(raw.offers)||raw.settings)){
        return {format:FORMAT,formatVersion:0,appBuild:'legacy',companyId:raw?.meta?.cloudCompanyId||raw?.meta?.companyId||'',data:raw,integrity:{},legacy:true};
      }
      throw new Error('Datei ist kein gültiges AngebotsPilot-Backup.');
    }

    async function parseForSafeRestore(file){
      if(!file)throw new Error('Keine Datei ausgewählt.');
      if(file.size>120*1024*1024)throw new Error('Backup ist zu groß für die sichere Browser-Wiederherstellung.');
      const buffer=await file.arrayBuffer();let raw;
      if(file.name.toLowerCase().endsWith('.zip')||file.type==='application/zip'){
        const files=readStoredZip(buffer),payload=files['backup/arbeitsdaten.json'];
        if(!payload)throw new Error('Im ZIP fehlt backup/arbeitsdaten.json.');
        raw=JSON.parse(decoder.decode(payload));
      }else raw=JSON.parse(decoder.decode(new Uint8Array(buffer)));
      const backup=normalizeBackup(raw);
      if((Number(backup.formatVersion)||0)>MAX_FORMAT_VERSION)throw new Error('Dieses Backup stammt aus einer neueren AngebotsPilot-Version. Bitte zuerst die App aktualisieren.');
      if(!backup.data||typeof backup.data!=='object')throw new Error('Backup enthält keine Arbeitsdaten.');
      const context=currentContext(),activeCompany=context?.company?.id||globalThis.data?.meta?.cloudCompanyId||globalThis.data?.meta?.companyId||'';
      if(context?.company?.id&&backup.companyId&&backup.companyId!==context.company.id&&backup.companyId!==globalThis.data?.meta?.companyId){
        throw new Error('Sicherheitsstopp: Dieses Backup gehört zu einem anderen Betrieb.');
      }
      if(backup.integrity?.dataSha256){
        const actual=await sha256(JSON.stringify(backup.data));
        if(actual!==backup.integrity.dataSha256)throw new Error('Integritätsprüfung fehlgeschlagen. Das Backup wurde möglicherweise verändert oder beschädigt.');
      }
      return {fileName:file.name,backup,activeCompany};
    }

    function timestampOf(row){
      if(!row||typeof row!=='object')return 0;
      const keys=['client_updated_at','clientUpdatedAt','updated_at','updatedAt','modified_at','modifiedAt'];
      let best=0;
      for(const key of keys){
        const value=row[key];if(!value)continue;
        const ms=Date.parse(value);if(Number.isFinite(ms)&&ms>best)best=ms;
      }
      return best;
    }

    function sameRecord(a,b){
      try{return JSON.stringify(a)===JSON.stringify(b)}catch(e){return false}
    }

    function currentTombstones(current,collection){
      return new Set((current?.meta?.deletedEntities||[])
        .filter(x=>x&&x.collection===collection)
        .map(x=>String(x.id??''))
        .filter(Boolean));
    }

    function mergeCollection(currentRows,incomingRows,collection){
      const out=(Array.isArray(currentRows)?currentRows:[]).map(clone);
      const byId=new Map();
      out.forEach((row,index)=>{if(row&&row.id!==undefined&&row.id!==null)byId.set(String(row.id),index)});
      const tombstones=currentTombstones(globalThis.data||{},collection);
      const stats={added:0,backupNewer:0,currentProtected:0,identical:0,deletedProtected:0,noIdSkipped:0};

      for(const incoming of Array.isArray(incomingRows)?incomingRows:[]){
        if(!incoming||typeof incoming!=='object')continue;
        const id=incoming.id===undefined||incoming.id===null?'':String(incoming.id);
        if(!id){stats.noIdSkipped++;continue}
        if(tombstones.has(id)){stats.deletedProtected++;continue}
        if(!byId.has(id)){
          byId.set(id,out.length);out.push(clone(incoming));stats.added++;continue;
        }
        const index=byId.get(id),current=out[index];
        if(sameRecord(current,incoming)){stats.identical++;continue}
        const currentTs=timestampOf(current),backupTs=timestampOf(incoming);
        if(currentTs&&backupTs&&backupTs>currentTs){
          out[index]=clone(incoming);stats.backupNewer++;
        }else{
          stats.currentProtected++;
        }
      }
      return {rows:out,stats};
    }

    function fillMissing(currentValue,backupValue){
      if(currentValue===undefined||currentValue===null||currentValue==='')return clone(backupValue);
      if(Array.isArray(currentValue))return clone(currentValue);
      if(currentValue&&backupValue&&typeof currentValue==='object'&&typeof backupValue==='object'){
        const out=clone(currentValue);
        for(const [key,value] of Object.entries(backupValue)){
          out[key]=key in out?fillMissing(out[key],value):clone(value);
        }
        return out;
      }
      return clone(currentValue);
    }

    function buildSafeMerge(current,incoming){
      const merged=clone(current||{}),details={},summary={added:0,backupNewer:0,currentProtected:0,identical:0,deletedProtected:0,noIdSkipped:0};
      for(const collection of CORE){
        const result=mergeCollection(current?.[collection],incoming?.[collection],collection);
        merged[collection]=result.rows;details[collection]=result.stats;
        for(const key of Object.keys(summary))summary[key]+=result.stats[key]||0;
      }
      merged.settings=fillMissing(current?.settings||{},incoming?.settings||{});
      merged.privacy=clone(current?.privacy||{});
      merged.users=clone(current?.users||[]);
      merged.audit=clone(current?.audit||[]);
      merged.meta={...(clone(current?.meta||{})),lastRestoreAt:nowIso(),lastRestoreBuild:VERSION,lastRestoreMode:'conflict-aware-current-protected'};
      // Aktuelle Löschmarker bleiben erhalten. Backup-Löschmarker werden bewusst nicht importiert.
      merged.meta.deletedEntities=clone(current?.meta?.deletedEntities||[]);
      return {merged,summary,details};
    }

    function savePreRestoreSnapshot(){
      try{
        const prefix='angebotspilot_pre_restore_',key=prefix+Date.now();
        localStorage.setItem(key,JSON.stringify({savedAt:nowIso(),data:clone(globalThis.data||{})}));
        Object.keys(localStorage).filter(k=>k.startsWith(prefix)).sort().reverse().slice(3).forEach(k=>localStorage.removeItem(k));
        return key;
      }catch(e){console.warn('Lokaler Vorher-Snapshot nicht möglich',e);return ''}
    }

    async function writeRestoreAudit(state,beforeKey){
      try{
        const c=currentContext();if(!c?.client||!c?.company?.id||!c?.session?.user?.id)return;
        await c.client.from('data_operation_events').insert({
          company_id:c.company.id,user_id:c.session.user.id,event_type:'restore_applied',entity_type:'backup',entity_id:'',
          metadata:{app_build:VERSION,source_file:state.fileName,format_version:state.backup.formatVersion||0,pre_restore_snapshot:!!beforeKey,mode:'conflict-aware-current-protected',merge_summary:state.plan.summary}
        });
      }catch(e){console.warn('Restore-Audit konnte nicht geschrieben werden',e)}
    }

    function decorateSafePreview(state){
      const body=document.getElementById('dataSafetyRestoreBody');if(!body)return;
      body.querySelector('.apRestoreConflictGuard')?.remove();
      body.querySelector('.apRestoreSafeMerge')?.remove();
      const s=state.plan.summary;
      const box=document.createElement('div');box.className='dsSafe apRestoreSafeMerge';
      box.innerHTML=`<b>✓ Konfliktsicherer Merge bereit</b><br>${s.added} fehlende Datensätze werden ergänzt · ${s.backupNewer} nachweislich neuere Backup-Datensätze werden übernommen · ${s.currentProtected} aktuelle Konflikte bleiben geschützt · ${s.identical} identische Datensätze bleiben unverändert${s.deletedProtected?` · ${s.deletedProtected} aktuelle Löschungen bleiben geschützt`:''}.`;
      body.querySelector('.dsSheetActions')?.before(box);
      const apply=[...body.querySelectorAll('button')].find(b=>/Backup zusammenführen|Merge-Schutz aktiv|Sicher zusammenführen/.test(b.textContent||''));
      if(apply){apply.disabled=false;apply.textContent='Sicher zusammenführen';}
    }

    function decorateRestoreError(message){
      const body=document.getElementById('dataSafetyRestoreBody');if(!body)return;
      const box=document.createElement('div');box.className='dsWarn apRestoreConflictGuard';
      box.innerHTML=`<b>🛡️ Sicherheitsstopp</b><br>${String(message||'Backup konnte nicht für den sicheren Merge vorbereitet werden.')}`;
      body.querySelector('.dsSheetActions')?.before(box);
      const apply=[...body.querySelectorAll('button')].find(b=>/Backup zusammenführen|Sicher zusammenführen/.test(b.textContent||''));
      if(apply){apply.disabled=true;apply.textContent='Merge nicht freigegeben';}
    }

    const originalChoose=ds.chooseBackup?.bind(ds);
    if(originalChoose){
      ds.chooseBackup=async function(event){
        const file=event?.target?.files?.[0]||null;
        safeRestoreState=null;
        const safeParse=file?parseForSafeRestore(file):Promise.reject(new Error('Keine Datei ausgewählt.'));
        const result=await originalChoose(event);
        try{
          const parsed=await safeParse,current=globalThis.data||{},plan=buildSafeMerge(current,parsed.backup.data);
          safeRestoreState={...parsed,plan};
          setTimeout(()=>decorateSafePreview(safeRestoreState),0);
        }catch(e){
          console.error(e);safeRestoreState=null;
          setTimeout(()=>decorateRestoreError(e?.message),0);
        }
        return result;
      };
    }

    const originalClose=ds.closeRestore?.bind(ds);
    ds.closeRestore=function(){safeRestoreState=null;return originalClose?.()};

    ds.applyRestore=async function(){
      if(!safeRestoreState)return notify('Bitte Backup erneut auswählen und prüfen.','warning');
      if(!canManage())return notify('Nur Inhaber oder Büro können ein Backup einspielen.','error');
      const state=safeRestoreState,current=globalThis.data||{},freshPlan=buildSafeMerge(current,state.backup.data);
      state.plan=freshPlan;
      const s=freshPlan.summary;
      const text=`Die Sicherung wird konfliktbewusst mit dem aktuellen Betrieb zusammengeführt. Aktuelle Datensätze werden niemals von älteren oder unklaren Backup-Ständen überschrieben.\n\nNeu ergänzen: ${s.added}\nBackup nachweislich neuer: ${s.backupNewer}\nAktuelle Konflikte geschützt: ${s.currentProtected}\nIdentisch: ${s.identical}\nAktuelle Löschungen geschützt: ${s.deletedProtected}`;
      const ok=globalThis.appConfirm?!!(await globalThis.appConfirm({title:'Backup sicher zusammenführen?',text,confirmLabel:'Sicher zusammenführen',icon:'🛡️'})):confirm(`Backup sicher zusammenführen?\n\n${text}`);
      if(!ok)return;
      const beforeKey=savePreRestoreSnapshot();
      try{
        Object.keys(current).forEach(key=>delete current[key]);Object.assign(current,freshPlan.merged);globalThis.data=current;
        if(globalThis.AppRepository?.prepare)globalThis.AppRepository.prepare(current,null);
        if(globalThis.safePersistCloudIdentity)globalThis.safePersistCloudIdentity(current);else localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(current));
        const c=currentContext();
        if(c?.company?.id&&globalThis.CloudSync?.pushSnapshot){
          await globalThis.CloudSync.pushSnapshot();
          await globalThis.CloudSync.pullCloud();
        }
        await writeRestoreAudit(state,beforeKey);
        document.getElementById('dataSafetyRestoreModal')?.classList.add('hidden');
        safeRestoreState=null;
        globalThis.renderAll?.();
        notify(`✓ Backup sicher zusammengeführt. ${s.added+s.backupNewer} Datensätze übernommen, ${s.currentProtected} aktuelle Konflikte geschützt.`,'success');
      }catch(e){
        console.error(e);notify(String(e?.message||'Wiederherstellung fehlgeschlagen.'),'error');
      }
    };
  }

  function ensureDataSafetyLoaded(){
    if(globalThis.DataSafety?.refreshCard){
      installRestoreSafetyGuard();
      installSettingsObserver();
      scheduleDataSafetyRefresh(true);
      return;
    }

    const existing=[...document.scripts].find(s=>/data-safety\.js(?:\?|$)/.test(s.src||''));
    if(existing){
      existing.addEventListener('load',()=>{
        installSettingsObserver();
        scheduleDataSafetyRefresh(true);
      },{once:true});
      return;
    }

    // Direkt aus dem Hauptdokument-Bootstrap laden; nicht mehr vom Service Worker abhängig.
    const script=document.createElement('script');
    script.src=DATA_SAFETY_SRC;
    script.defer=true;
    script.dataset.apRuntimeLoader='cloud-config';
    script.onload=()=>{
      installRestoreSafetyGuard();
      installSettingsObserver();
      scheduleDataSafetyRefresh(true);
    };
    script.onerror=()=>console.error('AngebotsPilot Datensicherung konnte nicht geladen werden.');
    document.head.appendChild(script);
  }

  function ensureComplianceLoaded(){
    if(globalThis.APCompliance?.runtimeVersion===VERSION)return;
    const existing=[...document.scripts].find(s=>/compliance-v1131\.js(?:\?|$)/.test(s.src||''));
    if(existing)return;
    const script=document.createElement('script');
    script.src=COMPLIANCE_SRC;
    script.defer=true;
    script.dataset.apRuntimeLoader='compliance-v1131';
    script.onerror=()=>console.error('AngebotsPilot Rechnungs-Compliance konnte nicht geladen werden.');
    document.head.appendChild(script);
  }

  function installRefreshHooks(){
    const refresh=()=>scheduleDataSafetyRefresh(true);
    window.addEventListener('angebotspilot:syncstate',event=>{
      refresh();
      installManualSyncGuard();
      if(event?.detail?.syncing===true)snapshotLinkedInvoiceDrafts();
      if(event?.detail?.syncing===false){
        scheduleInvoiceRelationRepair(250);
        scheduleInvoiceSafetyRepair(300);
      }
    });
    window.addEventListener('focus',()=>{
      refresh();installManualSyncGuard();snapshotLinkedInvoiceDrafts();
      scheduleInvoiceRelationRepair(450);scheduleInvoiceSafetyRepair(500);
    });
    window.addEventListener('pageshow',()=>{
      refresh();installManualSyncGuard();snapshotLinkedInvoiceDrafts();
      scheduleInvoiceRelationRepair(450);scheduleInvoiceSafetyRepair(500);
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){
      refresh();installManualSyncGuard();snapshotLinkedInvoiceDrafts();
      scheduleInvoiceRelationRepair(450);scheduleInvoiceSafetyRepair(500);
    }});
  }

  function forceServiceWorkerCheck(){
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.getRegistration().then(reg=>reg?.update?.()).catch(()=>{});
  }

  function boot(){
    stampBuild();
    ensureInvoiceEditorUi();
    installInvoiceActionGuards();
    installWrappers();
    installSettingsObserver();
    ensureDataSafetyLoaded();
    ensureComplianceLoaded();
    installRefreshHooks();
    installManualSyncGuard();
    snapshotLinkedInvoiceDrafts();
    scheduleInvoiceSafetyRepair(600);
    forceServiceWorkerCheck();

    // Späte App-/Cloud-Initialisierung abfangen, ohne dauerhaft renderAll zu pollen.
    [0,250,800,1800].forEach(ms=>setTimeout(()=>{
      ensureInvoiceEditorUi();
      installInvoiceActionGuards();
      installWrappers();
      stampBuild();
      ensureDataSafetyLoaded();
      ensureComplianceLoaded();
      scheduleDataSafetyRefresh(true);
      installManualSyncGuard();
      snapshotLinkedInvoiceDrafts();
      scheduleInvoiceRelationRepair(250);
      scheduleInvoiceSafetyRepair(350);
    },ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
