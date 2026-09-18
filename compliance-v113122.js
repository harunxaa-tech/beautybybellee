/* AngebotsPilot v11.31.22 – serverseitige XRechnungs-Validierung
   Ergänzt den lokalen EN16931/XRechnung-Vorabcheck um einen authentifizierten
   Supabase-Servercheck. Ein echter KoSIT-Daemon wird nur als „offiziell bestanden“
   ausgewiesen, wenn der Server tatsächlich dessen Ergebnis bestätigt. */
(function installServerXRechnungValidation(){
  'use strict';

  const RUNTIME_VERSION='11.31.22';
  const BASE_VERSION='11.31.08';
  const FUNCTION_NAME='xrechnung-validate';

  const uniq=arr=>[...new Set((arr||[]).filter(Boolean).map(x=>String(x)))];
  const messageText=item=>String(item?.message||item?.text||item||'').trim();

  function cloudContext(){
    try{return globalThis.APCloudContext?.()||null}catch(e){return null}
  }

  function serverMessages(result){
    return [
      ...(result?.server_preflight?.messages||[]),
      ...(result?.official_kosit?.messages||[])
    ].map(messageText).filter(Boolean);
  }


  // v11.31.22: UBL MonetaryTotal hat eine feste Elementreihenfolge.
  // Der alte Generator schrieb AllowanceTotalAmount vor TaxExclusiveAmount.
  // KoSIT/XSD lehnt das korrekt mit HTTP 406 ab. Diese Normalisierung hält
  // Rechnungswerte unverändert und korrigiert ausschließlich die XML-Reihenfolge.
  function normalizeLegalMonetaryTotal(xml){
    return String(xml||'').replace(/<cac:LegalMonetaryTotal>([\s\S]*?)<\/cac:LegalMonetaryTotal>/g,(whole,inner)=>{
      const take=tag=>{
        const m=String(inner||'').match(new RegExp(`<cbc:${tag}\\b[^>]*>[\\s\\S]*?<\\/cbc:${tag}>`));
        return m?.[0]||'';
      };
      const ordered=[
        take('LineExtensionAmount'),
        take('TaxExclusiveAmount'),
        take('TaxInclusiveAmount'),
        take('AllowanceTotalAmount'),
        take('ChargeTotalAmount'),
        take('PrepaidAmount'),
        take('PayableRoundingAmount'),
        take('PayableAmount')
      ].filter(Boolean).join('');
      return ordered?`<cac:LegalMonetaryTotal>${ordered}</cac:LegalMonetaryTotal>`:whole;
    });
  }


  function xmlEscape(value){
    return String(value??'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&apos;');
  }

  // EN16931 BR-CO-26 verlangt zusätzlich zu BT-32 mindestens eine maschinenlesbare
  // Verkäuferkennung (BT-29), Handelsregisterkennung (BT-30) oder USt-ID (BT-31).
  // Einzelunternehmer ohne USt-ID/Handelsregister brauchen dafür kein neues Eingabefeld:
  // AngebotsPilot verwendet die bereits hinterlegte steuerliche Kennung als stabile BT-29.
  function ensureSellerIdentifier(xml){
    const source=String(xml||'');
    const supplier=source.match(/<cac:AccountingSupplierParty>([\s\S]*?)<\/cac:AccountingSupplierParty>/);
    if(!supplier)return source;
    const block=supplier[0];
    if(/<cac:PartyIdentification>[\s\S]*?<cbc:ID(?:\s[^>]*)?>[^<]+<\/cbc:ID>[\s\S]*?<\/cac:PartyIdentification>/.test(block))return source;
    if(/<cac:PartyLegalEntity>[\s\S]*?<cbc:CompanyID(?:\s[^>]*)?>[^<]+<\/cbc:CompanyID>/.test(block))return source;
    if(/<cac:PartyTaxScheme>[\s\S]*?<cbc:CompanyID(?:\s[^>]*)?>[^<]+<\/cbc:CompanyID>[\s\S]*?<cbc:ID>VAT<\/cbc:ID>/.test(block))return source;

    const s=globalThis.data?.settings||{};
    const sellerId=String(s.vatId||s.taxNumber||'').trim();
    if(!sellerId)return source;
    const identification=`<cac:PartyIdentification><cbc:ID>${xmlEscape(sellerId)}</cbc:ID></cac:PartyIdentification>`;
    const patched=block.replace('<cac:Party>','<cac:Party>'+identification);
    return source.replace(block,patched);
  }

  async function sha256Text(text){
    const bytes=new TextEncoder().encode(String(text||''));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function invokeServerValidation(inv,job){
    const ctx=cloudContext();
    if(!ctx?.client||!ctx?.session?.user||!ctx?.company?.id){
      return{
        ok:true,
        transport:'unavailable',
        server_preflight:{status:'unavailable',valid:null,messages:[{severity:'warning',message:'Serverprüfung ist erst nach der Cloud-Anmeldung verfügbar.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }
    if(!job?.xml||!job?.xmlSha256){
      return{
        ok:false,
        transport:'invalid-job',
        server_preflight:{status:'failed',valid:false,messages:[{severity:'error',message:'Die strukturierte XML-Datei konnte nicht für die Serverprüfung vorbereitet werden.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }

    const invoiceRef=String(inv?.id||inv?.localId||'').trim();
    if(!invoiceRef){
      return{
        ok:false,
        transport:'missing-invoice-id',
        server_preflight:{status:'failed',valid:false,messages:[{severity:'error',message:'Die Rechnung besitzt noch keine stabile Beleg-ID für die Serverprüfung.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }

    try{
      const {data,error}=await ctx.client.functions.invoke(FUNCTION_NAME,{
        body:{
          invoice_id:invoiceRef,
          xml:job.xml,
          xml_sha256:job.xmlSha256,
          profile:'xrechnung'
        }
      });
      if(error){
        console.warn('XRechnung-Serverprüfung nicht erreichbar',error);
        return{
          ok:false,
          transport:'error',
          technicalError:true,
          server_preflight:{status:'error',valid:null,messages:[{severity:'error',message:'Der E-Rechnungs-Prüfservice ist technisch nicht erreichbar. Es fehlt kein Eingabefeld.'}]},
          official_kosit:{status:'error',valid:null,required:true}
        };
      }
      return data&&typeof data==='object'?{transport:'ok',...data}:{
        ok:true,
        transport:'empty',
        server_preflight:{status:'unavailable',valid:null,messages:[{severity:'warning',message:'Serverprüfung lieferte noch kein verwertbares Ergebnis.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }catch(error){
      console.warn('XRechnung-Serverprüfung fehlgeschlagen',error);
      return{
        ok:true,
        transport:'error',
        server_preflight:{status:'unavailable',valid:null,messages:[{severity:'warning',message:'Serverprüfung konnte gerade nicht ausgeführt werden. Der lokale Vorabcheck bleibt aktiv.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }
  }

  function install(base){
    if(!base)return false;
    if(base.runtimeVersion===RUNTIME_VERSION)return true;

    // v11.31.22 darf auch über 11.31.18/19 gelegt werden: die XML-Normalisierung
    // ist idempotent, während diese Schicht fehlende Steuerkennung/IBAN bereits
    // vor KoSIT erkennt und den Nutzer direkt zum passenden Feld führt.
    if(![BASE_VERSION,'11.31.16','11.31.17','11.31.18','11.31.19','11.31.20','11.31.21'].includes(base.runtimeVersion))return false;
    if(typeof base.prepareForFinalization!=='function'||typeof base.route!=='function'||typeof base.generateUbl!=='function')return false;

    const original={...base};

    function generateUbl(inv,format='xrechnung'){
      let xml=normalizeLegalMonetaryTotal(original.generateUbl(inv,format));
      if(format==='xrechnung')xml=ensureSellerIdentifier(xml);
      return xml;
    }

    function settings(){
      return globalThis.data?.settings||{};
    }

    function cleanIban(value){
      return String(value||'').replace(/\s+/g,'').toUpperCase();
    }

    function ibanIsValid(value,country='DE'){
      const iban=cleanIban(value);
      const lengths={DE:22,AT:20,CH:21};
      const cc=String(country||iban.slice(0,2)||'').toUpperCase();
      if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban))return false;
      if(lengths[cc]&&iban.length!==lengths[cc])return false;
      const rearranged=iban.slice(4)+iban.slice(0,4);
      let remainder=0;
      for(const ch of rearranged){
        const part=/[A-Z]/.test(ch)?String(ch.charCodeAt(0)-55):ch;
        for(const digit of part)remainder=(remainder*10+Number(digit))%97;
      }
      return remainder===1;
    }

    function inputReadiness(inv){
      const r=original.route(inv);
      if(r?.format!=='xrechnung')return{ok:true,errors:[]};

      const s=settings();
      let xml='';
      try{xml=generateUbl(inv,'xrechnung')}catch(e){}

      const errors=[];
      const taxNumber=String(s.taxNumber||'').trim();
      const vatId=String(s.vatId||'').trim();
      const exemptVat=/<cac:(?:TaxCategory|ClassifiedTaxCategory)>[\s\S]*?<cbc:ID>E<\/cbc:ID>[\s\S]*?<\/cac:(?:TaxCategory|ClassifiedTaxCategory)>/.test(xml);

      if(exemptVat&&!taxNumber&&!vatId){
        errors.push('Steuernummer oder USt-IdNr. des Betriebs fehlt für die XRechnung.');
      }

      const payment58=/<cbc:PaymentMeansCode(?:\s[^>]*)?>58<\/cbc:PaymentMeansCode>/.test(xml);
      const sellerCountry=String(inv?.countryCode||s.countryCode||'DE').toUpperCase();
      if(payment58&&!ibanIsValid(s.iban,sellerCountry)){
        errors.push('IBAN fehlt oder ist nicht plausibel.');
      }

      return{ok:!errors.length,errors};
    }

    function mergeInputReadiness(inv,local){
      const ready=inputReadiness(inv);
      if(ready.ok)return local;
      const errors=uniq([...(local?.errors||[]),...ready.errors]);
      inv.complianceStatus='blocked';
      inv.complianceReport={...(inv.complianceReport||{}),errors};
      return{...(local||{}),ok:false,status:'blocked',failureKind:'input',fixableInputErrors:true,errors};
    }

    function translateFixableKosit(messages){
      const joined=(messages||[]).map(messageText).join('\n');
      const errors=[];
      if(/\bBR-E-02\b|\bBR-DE-16\b/i.test(joined)){
        errors.push('Steuernummer oder USt-IdNr. des Betriebs fehlt für die XRechnung.');
      }
      if(/\bBR-DE-19\b|Payment account identifier|korrekte IBAN/i.test(joined)){
        errors.push('IBAN fehlt oder ist nicht plausibel.');
      }
      return uniq(errors);
    }

    function check(inv){
      // v11.31.22: wichtig – den unveränderten Basis-Check aufrufen.
      // v11.31.20 rief versehentlich check() rekursiv auf und übersprang dadurch
      // die neue Eingabeprüfung in laufenden Sessions.
      const local=original.check(inv);
      if(local?.route?.format!=='xrechnung')return local;
      return mergeInputReadiness(inv,local);
    }

    function structuredBlob(inv){
      const r=original.route(inv);
      if(!['xrechnung','ubl'].includes(r?.format))return null;
      return new Blob([generateUbl(inv,r.format)],{type:'application/xml;charset=utf-8'});
    }

    function structuredFilename(inv){
      if(typeof original.structuredFilename==='function')return original.structuredFilename(inv);
      const safe=String(inv?.number||'rechnung').replace(/[^a-z0-9._-]+/gi,'_');
      return `${safe}-XRechnung-3.0.2.xml`;
    }

    async function validatorJob(inv){
      const r=original.route(inv);
      if(r?.format!=='xrechnung')return typeof original.validatorJob==='function'?original.validatorJob(inv):null;
      const xml=generateUbl(inv,r.format);
      const xmlSha256=await sha256Text(xml);
      return{
        protocol:'angebotspilot-kosit-v1',
        filename:structuredFilename(inv),
        xml,
        xmlSha256,
        invoiceNumber:String(inv?.number||''),
        profile:'xrechnung',
        validator:{engine:'KoSIT Validator',version:'1.6.3',configurationVersion:'2026-08-31',xrechnungVersion:'3.0.2'},
        xmlFixes:{legalMonetaryTotalOrder:'v11.31.22',inputReadiness:'tax-id-and-iban',sellerIdentifier:'BT-29-from-existing-tax-or-vat-id',localPreflight:'before-server',recursionFix:'v11.31.22',loaderUpgrade:'forced-current-server-layer'}
      };
    }

    async function archiveStructured(inv,job=null){
      const r=original.route(inv);
      if(r?.format!=='xrechnung')return typeof original.archiveStructured==='function'?original.archiveStructured(inv):null;
      const prepared=job||await validatorJob(inv);
      if(!prepared?.xml)return null;
      if(!globalThis.CloudFiles?.uploadStructuredInvoice)throw new Error('Cloud-Archiv für E-Rechnungen ist noch nicht bereit.');
      const blob=new Blob([prepared.xml],{type:'application/xml;charset=utf-8'});
      const hash=prepared.xmlSha256||await sha256Text(prepared.xml);
      const filename=prepared.filename||structuredFilename(inv);
      if(inv.structuredStoragePath&&inv.structuredSha256===hash)return{blob,filename,path:inv.structuredStoragePath,sha256:hash};
      const saved=await globalThis.CloudFiles.uploadStructuredInvoice(blob,filename,inv.id);
      inv.structuredStoragePath=saved.path;
      inv.structuredSha256=hash;
      return{blob,filename,path:saved.path,sha256:hash};
    }

    async function serverValidate(inv,job=null){
      const r=original.route(inv);
      if(r?.format!=='xrechnung')return null;
      let preparedJob=job;
      if(!preparedJob)preparedJob=await validatorJob(inv);
      return invokeServerValidation(inv,preparedJob);
    }

    function applyServerValidation(inv,local,server){
      const previous=inv.complianceReport||{};
      const messages=serverMessages(server);
      const official=server?.official_kosit||{};
      const preflight=server?.server_preflight||{};
      const officialPassed=official.status==='passed'&&official.valid===true;
      const officialRejected=official.status==='failed';
      const technicalError=server?.technicalError===true||server?.transport==='error'||official.status==='error'||preflight.status==='error';
      const serverFailed=preflight.status==='failed'||preflight.valid===false;

      inv.complianceReport={
        ...previous,
        serverValidation:{
          checkedAt:new Date().toISOString(),
          xmlSha256:server?.xml_sha256||local.validatorJob?.xmlSha256||'',
          transport:server?.transport||'ok',
          serverPreflight:preflight,
          officialKosit:official,
          validator:server?.validator||{
            xrechnung:'3.0.2',
            configuration:'2026-08-31',
            target_engine:'KoSIT Validator 1.6.3'
          }
        },
        validationLevel:officialPassed?'official-kosit-server-validated':'server-preflight-kosit-gateway',
        validationPipeline:{
          ...(previous.validationPipeline||{}),
          serverPreflight:{status:preflight.status||'unavailable'},
          officialKosit:{
            ...(previous.validationPipeline?.officialKosit||{}),
            status:official.status||'not-run',
            validatorVersion:server?.validator?.version||'1.6.3',
            configurationVersion:server?.validator?.configuration||'2026-08-31'
          }
        }
      };

      if(technicalError){
        const errors=uniq([...(local.errors||[]),...messages.length?messages:['Technische KoSIT-Prüfung derzeit nicht erreichbar.']]);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'technical-error',failureKind:'technical',technicalError:true,errors,serverValidation:server};
      }

      if(serverFailed||officialRejected||server?.ok===false){
        const fixable=officialRejected?translateFixableKosit(messages):[];
        const errors=uniq([...(local.errors||[]),...(fixable.length?fixable:messages)]);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        if(fixable.length){
          return{...local,ok:false,status:'blocked',failureKind:'input',fixableInputErrors:true,errors,serverValidation:server};
        }
        return{...local,ok:false,status:'blocked',failureKind:officialRejected?'validator-rejected':'validation',errors,serverValidation:server};
      }

      const warnings=[...(local.warnings||[])];
      if(officialPassed){
        warnings.push('Serverprüfung abgeschlossen: offizieller KoSIT-Validator hat diese XML-Fassung akzeptiert.');
      }else if(official.status==='unavailable'){
        warnings.push('Server-Vorabprüfung bestanden. Der offizielle KoSIT-Daemon ist noch nicht mit AngebotsPilot verbunden; es wird kein KoSIT-Erfolg vorgetäuscht.');
      }else if(preflight.status==='passed'){
        warnings.push('Server-Vorabprüfung bestanden. Eine offizielle KoSIT-Bestätigung liegt für diese XML-Fassung noch nicht vor.');
      }else if(preflight.status==='unavailable'){
        warnings.push('Serverprüfung war vorübergehend nicht erreichbar. Der lokale XRechnungs-Vorabcheck wurde ausgeführt.');
      }
      inv.complianceReport={...(inv.complianceReport||{}),warnings:uniq(warnings)};
      return{...local,warnings:uniq(warnings),serverValidation:server};
    }

    async function preflightForFinalization(inv){
      original.prepareInvoice?.(inv);
      const local=check(inv);
      if(!local?.ok||local?.route?.format!=='xrechnung')return local;

      let job=null;
      try{
        job=await validatorJob(inv);
      }catch(error){
        const message='XRechnung konnte nicht für die Serverprüfung vorbereitet werden: '+String(error?.message||error);
        const errors=uniq([...(local.errors||[]),message]);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'blocked',errors};
      }

      const server=await serverValidate(inv,job);
      return applyServerValidation(inv,{...local,validatorJob:job},server);
    }

    async function prepareForFinalization(inv){
      const route=original.route(inv);
      if(route?.format!=='xrechnung')return original.prepareForFinalization(inv);

      original.prepareInvoice?.(inv);
      const local=check(inv);
      if(!local?.ok)return local;

      let job=null,archived=null;
      try{
        job=await validatorJob(inv);
        archived=await archiveStructured(inv,job);
        inv.complianceReport={
          ...(inv.complianceReport||{}),
          structuredXmlSha256:job?.xmlSha256||archived?.sha256||'',
          validatorJob:{
            protocol:job?.protocol,filename:job?.filename,xmlSha256:job?.xmlSha256,
            validator:job?.validator,officialStatus:'pending',xmlFixes:job?.xmlFixes
          }
        };
      }catch(error){
        const message='E-Rechnungs-Original konnte nicht sicher vorbereitet/archiviert werden: '+String(error?.message||error);
        const errors=uniq([...(local.errors||[]),message]);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'blocked',errors,archived:null,validatorJob:null};
      }

      const server=await serverValidate(inv,job);
      return applyServerValidation(inv,{...local,archived,validatorJob:job},server);
    }

    function labelFor(inv){
      const r=original.route(inv);
      if(r?.format!=='xrechnung')return original.labelFor?.(inv)||'Rechnungsprüfung';
      const sv=inv?.complianceReport?.serverValidation;
      if(sv?.officialKosit?.status==='passed')return'XRechnung 3.0.2 · Serverprüfung ✓ · KoSIT ✓';
      if(sv?.serverPreflight?.status==='passed')return'XRechnung 3.0.2 · Serverprüfung ✓ · KoSIT noch ausstehend';
      return'XRechnung 3.0.2 · lokale + serverseitige Prüfung vorbereitet';
    }

    globalThis.APCompliance={
      ...base,
      RUNTIME_VERSION,
      runtimeVersion:RUNTIME_VERSION,
      serverValidationFunction:FUNCTION_NAME,
      check,
      inputReadiness,
      ibanIsValid,
      generateUbl,
      structuredBlob,
      structuredFilename,
      archiveStructured,
      validatorJob,
      serverValidate,
      preflightForFinalization,
      prepareForFinalization,
      labelFor
    };

    window.dispatchEvent(new CustomEvent('angebotspilot:compliance-ready',{detail:{
      version:RUNTIME_VERSION,
      serverValidation:true,
      function:FUNCTION_NAME,
      officialKosit:'connected',
      xmlSchemaFix:'LegalMonetaryTotal-order',sellerIdentifier:'BT-29',inputReadiness:'tax-id-and-iban',localPreflight:'before-server',recursionFix:true
    }}));
    try{globalThis.refreshInvoiceComplianceUI?.()}catch(e){}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install(globalThis.APCompliance)){clearInterval(timer);return}
    if(tries>200){clearInterval(timer);console.error('AngebotsPilot v11.31.22 Server-Validierung konnte nicht installiert werden.')}
  },50);
  if(install(globalThis.APCompliance))clearInterval(timer);
})();
