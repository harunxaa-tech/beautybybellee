/* AngebotsPilot v11.31.08 – XRechnung / EN16931 Hardening
   Zielstand: XRechnung 3.0.2, KoSIT Validator 1.6.3,
   Validator-Konfiguration 2026-08-31, CEN Schematron 1.3.16.
   Diese Schicht ist ein strenger Vorabcheck und bereitet den späteren offiziellen
   KoSIT-Validator-Handoff vor. Sie behauptet ausdrücklich keinen offiziellen Pass. */
(function(){
  'use strict';

  const RUNTIME_VERSION='11.31.08';
  const PROFILE_AS_OF='2026-09-18';
  const XR_SPEC_VERSION='3.0.2';
  const XR_BUNDLE_DATE='2026-08-31';
  const XR_VALIDATOR_VERSION='1.6.3';
  const CEN_SCHEMATRON_VERSION='1.3.16';
  const XR_CUSTOMIZATION='urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
  const PROFILE_ID='urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';
  const VALIDATOR_CONFIG=`xrechnung-${XR_SPEC_VERSION}-validator-configuration-${XR_BUNDLE_DATE}`;
  const INSTALL_KEY='__AP_COMPLIANCE_11_31_08__';

  if(globalThis[INSTALL_KEY])return;
  globalThis[INSTALL_KEY]=true;

  const uniq=list=>[...new Set((list||[]).filter(Boolean))];
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const num=v=>Number(v)||0;
  const data=()=>globalThis.data||{};
  const settings=()=>data().settings||{};
  const customerFor=inv=>(data().customers||[]).find(c=>c.id===inv?.customerId)||{};
  const lineCount=inv=>(inv?.lines||[]).filter(l=>String(l?.name||'').trim()).length;
  const isCredit=inv=>inv?.documentType==='cancellation';
  const isCorrection=inv=>inv?.documentType==='correction'||!!inv?.correctionOf;
  const hasDiscount=inv=>Math.abs(num(inv?.discount))>0||Math.abs(num(inv?.discountValue))>0;
  const lower=v=>String(v||'').trim().toLowerCase();

  function typeCodeFor(inv){return isCredit(inv)?'381':isCorrection(inv)?'384':'380'}

  function addPaymentTerms(xml,inv){
    let out=String(xml||'');
    if(isCredit(inv)||!inv?.dueDate||out.includes('<cac:PaymentTerms>'))return out;
    const block=`<cac:PaymentTerms><cbc:Note>${esc(`Zahlbar bis ${inv.dueDate}`)}</cbc:Note></cac:PaymentTerms>`;
    if(out.includes('</cac:PaymentMeans>'))return out.replace('</cac:PaymentMeans>',`</cac:PaymentMeans>${block}`);
    if(out.includes('<cac:AllowanceCharge>'))return out.replace('<cac:AllowanceCharge>',`${block}<cac:AllowanceCharge>`);
    if(out.includes('<cac:TaxTotal>'))return out.replace('<cac:TaxTotal>',`${block}<cac:TaxTotal>`);
    return out;
  }

  function normalizeStructuredXml(xml,inv,format){
    let out=String(xml||'');
    if(format==='xrechnung'){
      out=out.replace(/urn:cen\.eu:en16931:2017#compliant#urn:xoeinkauf\.de:kosit:xrechnung_3\.0/g,XR_CUSTOMIZATION);
      out=out.replace(/<cbc:CustomizationID>[^<]*xrechnung_3\.0<\/cbc:CustomizationID>/g,`<cbc:CustomizationID>${XR_CUSTOMIZATION}</cbc:CustomizationID>`);
      if(!out.includes(`<cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>`)){
        out=out.replace(/<cbc:ProfileID>[^<]*<\/cbc:ProfileID>/,`<cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>`);
      }
    }
    out=addPaymentTerms(out,inv);
    return out;
  }

  function countMatches(source,rx){return (String(source||'').match(rx)||[]).length}

  function strictStructuredValidation(xml,inv,route,base){
    const errors=[],warnings=[],checks=[];
    const push=(ok,good,bad,severity='error')=>{
      checks.push({ok:!!ok,message:ok?good:bad,severity:ok?'ok':severity});
      if(ok)return;
      if(severity==='warning')warnings.push(bad); else errors.push(bad);
    };
    const source=String(xml||'');
    const format=route?.format||inv?.eInvoiceFormat||'xrechnung';
    const expectedLines=lineCount(inv);
    const rootCredit=/<CreditNote\b/.test(source);
    const rootInvoice=/<Invoice\b/.test(source);

    try{
      const legacy=base?.validateStructuredXml?.(source,inv,route);
      (legacy?.checks||[]).forEach(x=>checks.push({...x,source:'legacy'}));
      (legacy?.errors||[]).forEach(x=>errors.push(x));
    }catch(e){errors.push('XML-Basischeck fehlgeschlagen: '+String(e?.message||e))}

    push(source.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),'UTF-8 XML-Deklaration vorhanden','XML-Deklaration/UTF-8-Kennung fehlt');
    push(rootInvoice||rootCredit,'UBL Invoice/CreditNote-Wurzel erkannt','UBL Invoice/CreditNote-Wurzel fehlt');
    push(!source.includes('xoeinkauf.de'),'Keine veraltete XRechnung-Domain enthalten','Veraltete XRechnung-Kennung xoeinkauf.de erkannt');
    push(!/\b(?:undefined|NaN)\b/.test(source),'Keine ungültigen JS-Werte im XML','XML enthält undefined oder NaN');
    push(source.includes(`<cbc:ID>${esc(inv?.number||'')}</cbc:ID>`),'Rechnungsnummer im XML vorhanden','Rechnungsnummer fehlt im XML');
    push(source.includes(`<cbc:IssueDate>${esc(inv?.date||'')}</cbc:IssueDate>`),'Rechnungsdatum im XML vorhanden','Rechnungsdatum fehlt oder weicht ab');
    push(/<cbc:DocumentCurrencyCode>[A-Z]{3}<\/cbc:DocumentCurrencyCode>/.test(source),'ISO-Währung vorhanden','ISO-Währung fehlt oder ist ungültig');
    push(source.includes(`<cbc:${rootCredit?'CreditNoteTypeCode':'InvoiceTypeCode'}>${typeCodeFor(inv)}</cbc:${rootCredit?'CreditNoteTypeCode':'InvoiceTypeCode'}>`),'Dokumenttypcode passt zum Beleg','Dokumenttypcode passt nicht zu Rechnung/Korrektur/Storno');
    push(source.includes('<cac:AccountingSupplierParty>')&&source.includes('<cac:AccountingCustomerParty>'),'Verkäufer und Käufer vorhanden','Verkäufer oder Käufer fehlt');
    push(countMatches(source,/<cac:PostalAddress>/g)>=2,'Beide Postanschriften vorhanden','Verkäufer- oder Käuferanschrift fehlt');
    push(countMatches(source,/<cac:Country><cbc:IdentificationCode>[A-Z]{2}<\/cbc:IdentificationCode><\/cac:Country>/g)>=2,'Ländercodes beider Parteien vorhanden','Ländercode einer Partei fehlt');
    push(countMatches(source,/<cac:PartyLegalEntity><cbc:RegistrationName>[^<]+<\/cbc:RegistrationName><\/cac:PartyLegalEntity>/g)>=2,'Rechtliche Namen beider Parteien vorhanden','Rechtlicher Name einer Partei fehlt');
    push(source.includes('<cac:Delivery><cbc:ActualDeliveryDate>'),'Leistungs-/Lieferdatum im XML vorhanden','Leistungs-/Lieferdatum fehlt');
    push(source.includes('<cac:TaxTotal>')&&source.includes('<cac:TaxSubtotal>'),'Steueraufschlüsselung vorhanden','Steueraufschlüsselung fehlt');
    push(source.includes('<cac:LegalMonetaryTotal>'),'EN16931-Summenblock vorhanden','Summenblock fehlt');
    for(const tag of ['LineExtensionAmount','TaxExclusiveAmount','TaxInclusiveAmount','PayableAmount']){
      push(new RegExp(`<cbc:${tag} currencyID="[A-Z]{3}">-?\\d+\\.\\d{2}<\\/cbc:${tag}>`).test(source),`${tag} mit Währung und 2 Dezimalstellen vorhanden`,`${tag} fehlt oder ist nicht sauber auf 2 Dezimalstellen formatiert`);
    }

    const actualLines=countMatches(source,/<cac:(?:InvoiceLine|CreditNoteLine)>/g);
    push(actualLines===expectedLines,`XML enthält ${actualLines} Position(en) wie der Beleg`,`Positionsanzahl stimmt nicht: Beleg ${expectedLines}, XML ${actualLines}`);
    push(countMatches(source,/<cac:ClassifiedTaxCategory>/g)>=expectedLines,'Steuerkategorie je Position vorhanden','Mindestens einer Position fehlt die Steuerkategorie');
    push(countMatches(source,/<cac:Price><cbc:PriceAmount currencyID="[A-Z]{3}">-?\d+\.\d{2}<\/cbc:PriceAmount>/g)>=expectedLines,'Preis mit Währung je Position vorhanden','Mindestens einer Position fehlt ein sauberer Preis');

    if(!rootCredit){
      push(source.includes(`<cbc:DueDate>${esc(inv?.dueDate||'')}</cbc:DueDate>`)||source.includes('<cac:PaymentTerms>'),'Fälligkeit/Zahlungsbedingung vorhanden','Fälligkeit oder Zahlungsbedingung fehlt');
      if(Math.abs(num(inv?.total))>0){
        push(source.includes('<cac:PaymentMeans>'),'Zahlungsweg vorhanden','Zahlungsweg fehlt');
        push(/<cac:PayeeFinancialAccount><cbc:ID>[A-Z]{2}[A-Z0-9]+<\/cbc:ID>/.test(source),'Zahlungskonto/IBAN vorhanden','Zahlungskonto/IBAN fehlt oder ist nicht plausibel');
      }
    }

    if(isCredit(inv)||isCorrection(inv)){
      push(source.includes('<cac:BillingReference>'),'Bezug zur Ursprungsrechnung vorhanden','Korrektur/Storno benötigt die Referenz zur Ursprungsrechnung');
    }

    if(hasDiscount(inv)){
      const allowance=(source.match(/<cac:AllowanceCharge>[\s\S]*?<\/cac:AllowanceCharge>/)||[''])[0];
      push(!!allowance,'Dokumentenrabatt als AllowanceCharge vorhanden','Dokumentenrabatt fehlt im strukturierten XML');
      push(allowance.includes('<cbc:AllowanceChargeReason>'),'Rabattgrund vorhanden','Rabattgrund fehlt');
      push(allowance.includes('<cac:TaxCategory>'),'Steuerkategorie des Rabatts vorhanden','Steuerkategorie des Rabatts fehlt');
    }

    if(format==='xrechnung'){
      push(source.includes(`<cbc:CustomizationID>${XR_CUSTOMIZATION}</cbc:CustomizationID>`),'XRechnung-CIUS-ID exakt korrekt','XRechnung-CIUS-ID ist nicht exakt korrekt');
      push(source.includes(`<cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>`),'Prozesskennung korrekt','XRechnung-Prozesskennung fehlt oder ist falsch');
      const endpoints=countMatches(source,/<cbc:EndpointID schemeID="[^"]+">[^<]+<\/cbc:EndpointID>/g);
      push(endpoints>=2,'Elektronische Adressen von Verkäufer und Käufer vorhanden','XRechnung 3.0 benötigt elektronische Adressen von Verkäufer und Käufer');
      const buyerRef=(source.match(/<cbc:BuyerReference>([^<]*)<\/cbc:BuyerReference>/)||[])[1]||'';
      push(!!buyerRef,'Käuferreferenz vorhanden','Käuferreferenz (BT-10) fehlt');
      if(buyerRef==='-')warnings.push('Käuferreferenz ist nur als Platzhalter „-“ gesetzt. Für Behörden und viele B2B-Prozesse bitte eine echte Referenz hinterlegen.');
    }

    if(typeof DOMParser!=='undefined'){
      const doc=new DOMParser().parseFromString(source,'application/xml');
      push(!doc.querySelector('parsererror'),'XML ist wohlgeformt','XML ist nicht wohlgeformt');
    }else{
      warnings.push('Browser-XML-Parser war für diesen Vorabcheck nicht verfügbar.');
    }

    return{ok:!uniq(errors).length,errors:uniq(errors),warnings:uniq(warnings),checks};
  }

  async function sha256Text(text){
    const bytes=new TextEncoder().encode(String(text||''));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function validatorContract(){
    return{
      protocol:'angebotspilot-kosit-v1',
      request:{method:'POST',contentType:'application/xml',metadataHeaders:['X-AP-Invoice-Number','X-AP-XML-SHA256','X-AP-XRechnung-Version','X-AP-Validator-Config']},
      response:{contentType:'application/json',required:['valid','assessment','messages','validatorVersion','configurationVersion','xmlSha256']},
      validator:{engine:'KoSIT Validator',version:XR_VALIDATOR_VERSION,configuration:XR_BUNDLE_DATE,xrechnung:XR_SPEC_VERSION,cenSchematron:CEN_SCHEMATRON_VERSION},
      status:'prepared-not-connected'
    };
  }

  function install(base){
    if(!base)return false;
    if(base.runtimeVersion===RUNTIME_VERSION)return true;
    // Die 11.31.08-Schicht setzt auf dem 11.31.0-Compliance-Core auf. Falls der Core
    // noch nicht geladen ist, wartet der Loader weiter.
    if(base.runtimeVersion!=='11.31.0')return false;
    if(!base.generateUbl||!base.check||!base.route)return false;

    const original={...base};

    function route(inv){return original.route(inv)}

    function generateUbl(inv,format='xrechnung'){
      return normalizeStructuredXml(original.generateUbl(inv,format),inv,format);
    }

    function validateStructuredXml(xml,inv,r){
      return strictStructuredValidation(normalizeStructuredXml(xml,inv,r?.format||'xrechnung'),inv,r||route(inv),original);
    }

    function check(inv){
      original.prepareInvoice?.(inv);
      const baseResult=original.check(inv)||{ok:true,status:'ready',errors:[],warnings:[],internalChecks:[]};
      const r=route(inv),errors=[...(baseResult.errors||[])],warnings=[...(baseResult.warnings||[])],checks=[...(baseResult.internalChecks||[])];
      let strict=null;
      if(r?.mode==='structured'){
        try{
          const xml=generateUbl(inv,r.format);
          strict=strictStructuredValidation(xml,inv,r,original);
          strict.errors.forEach(x=>errors.push(x));
          strict.warnings.forEach(x=>warnings.push(x));
          strict.checks.forEach(x=>checks.push({...x,source:'v11.31.08'}));
          warnings.push(`Offizielle KoSIT-Validierung ist vorbereitet, aber noch nicht serverseitig ausgeführt. Ziel: Validator ${XR_VALIDATOR_VERSION}, Konfiguration ${XR_BUNDLE_DATE}.`);
        }catch(e){errors.push('Strenger EN16931/XRechnung-Vorabcheck fehlgeschlagen: '+String(e?.message||e))}
      }
      const uniqueErrors=uniq(errors),uniqueWarnings=uniq(warnings),status=uniqueErrors.length?'blocked':uniqueWarnings.length?'warning':'ready';
      const previous=inv.complianceReport||{};
      inv.complianceStatus=status;
      inv.complianceCheckedAt=new Date().toISOString();
      inv.complianceReport={
        ...previous,
        checkedAt:inv.complianceCheckedAt,
        appBuild:RUNTIME_VERSION,
        profileAsOf:PROFILE_AS_OF,
        route:r,
        errors:uniqueErrors,
        warnings:uniqueWarnings,
        internalChecks:checks,
        standards:{
          ...(previous.standards||{}),
          en16931:'EN 16931',
          xrechnung:{version:XR_SPEC_VERSION,bundle:XR_BUNDLE_DATE,customizationId:XR_CUSTOMIZATION,validatorReference:XR_VALIDATOR_VERSION,cenSchematron:CEN_SCHEMATRON_VERSION},
          zugferd:previous.standards?.zugferd||{version:'2.5.2',status:'roadmap-not-generated'}
        },
        validationLevel:r?.mode==='structured'?'strict-local-preflight-kosit-handoff-prepared':'mandatory-field-and-math-check',
        validationPipeline:r?.mode==='structured'?{
          xmlWellFormed:{status:strict?.errors?.some(x=>/wohlgeformt/i.test(x))?'failed':'passed'},
          en16931Preflight:{status:strict?.ok?'passed':'failed'},
          xrechnungPreflight:{status:r.format==='xrechnung'?(strict?.ok?'passed':'failed'):'not-applicable'},
          officialKosit:{status:'pending',validatorVersion:XR_VALIDATOR_VERSION,configurationVersion:XR_BUNDLE_DATE,configurationName:VALIDATOR_CONFIG}
        }:undefined,
        validatorContract:validatorContract()
      };
      return{...baseResult,ok:!uniqueErrors.length,status,route:r,errors:uniqueErrors,warnings:uniqueWarnings,internalChecks:checks,strictValidation:strict};
    }

    function structuredBlob(inv){
      const r=route(inv);if(!['xrechnung','ubl'].includes(r?.format))return null;
      return new Blob([generateUbl(inv,r.format)],{type:'application/xml;charset=utf-8'});
    }

    function structuredFilename(inv){
      const safe=String(inv?.number||'rechnung').replace(/[^a-z0-9._-]+/gi,'_');
      const r=route(inv);
      return r?.format==='xrechnung'?`${safe}-XRechnung-${XR_SPEC_VERSION}.xml`:`${safe}-UBL-2.1.xml`;
    }

    async function archiveStructured(inv){
      const blob=structuredBlob(inv);if(!blob)return null;
      if(!globalThis.CloudFiles?.uploadStructuredInvoice)throw new Error('Cloud-Archiv für E‑Rechnungen ist noch nicht bereit.');
      const xml=await blob.text(),hash=await sha256Text(xml),filename=structuredFilename(inv);
      if(inv.structuredStoragePath&&inv.structuredSha256===hash)return{blob,filename,path:inv.structuredStoragePath,sha256:hash};
      const saved=await globalThis.CloudFiles.uploadStructuredInvoice(blob,filename,inv.id);
      inv.structuredStoragePath=saved.path;inv.structuredSha256=hash;
      return{blob,filename,path:saved.path,sha256:hash};
    }

    async function validatorJob(inv){
      const r=route(inv);
      if(!['xrechnung','ubl'].includes(r?.format))return null;
      const xml=generateUbl(inv,r.format),sha256=await sha256Text(xml),preflight=strictStructuredValidation(xml,inv,r,original);
      return{
        protocol:'angebotspilot-kosit-v1',
        filename:structuredFilename(inv),
        xml,
        xmlSha256:sha256,
        invoiceNumber:String(inv?.number||''),
        profile:r.format,
        preflight:{ok:preflight.ok,errors:preflight.errors,warnings:preflight.warnings},
        validator:{engine:'KoSIT Validator',version:XR_VALIDATOR_VERSION,configurationVersion:XR_BUNDLE_DATE,configurationName:VALIDATOR_CONFIG,xrechnungVersion:XR_SPEC_VERSION,cenSchematron:CEN_SCHEMATRON_VERSION},
        requestContract:validatorContract()
      };
    }

    async function prepareForFinalization(inv){
      original.prepareInvoice?.(inv);
      const result=check(inv);
      if(!result.ok)return{...result,archived:null,validatorJob:null};
      let archived=null,job=null;
      if(result.route?.mode==='structured'){
        try{
          job=await validatorJob(inv);
          archived=await archiveStructured(inv);
          inv.complianceReport={...(inv.complianceReport||{}),structuredXmlSha256:job?.xmlSha256||archived?.sha256||'',validatorJob:{protocol:job?.protocol,filename:job?.filename,xmlSha256:job?.xmlSha256,validator:job?.validator,officialStatus:'pending'}};
        }catch(e){
          const message='E‑Rechnungs-Original/Validator-Handoff konnte nicht sicher vorbereitet werden: '+String(e?.message||e);
          const errors=uniq([...(result.errors||[]),message]);
          inv.complianceStatus='blocked';
          inv.complianceReport={...(inv.complianceReport||{}),errors};
          return{...result,ok:false,status:'blocked',errors,archived:null,validatorJob:null};
        }
      }
      return{...result,archived,validatorJob:job};
    }

    function labelFor(inv){
      const r=route(inv);
      if(r?.format==='xrechnung')return`XRechnung ${XR_SPEC_VERSION} · strenger EN16931-Vorabcheck · KoSIT-Handoff vorbereitet`;
      if(r?.format==='ubl')return`UBL 2.1 · strenger EN16931-Vorabcheck`;
      return original.labelFor?.(inv)||'Rechnungsprüfung';
    }

    globalThis.APCompliance={
      ...base,
      RUNTIME_VERSION,
      runtimeVersion:RUNTIME_VERSION,
      PROFILE_AS_OF,
      XR_SPEC_VERSION,
      XR_BUNDLE_DATE,
      XR_VALIDATOR_VERSION,
      CEN_SCHEMATRON_VERSION,
      XR_CUSTOMIZATION,
      validatorConfiguration:VALIDATOR_CONFIG,
      route,
      check,
      generateUbl,
      validateStructuredXml,
      structuredBlob,
      structuredFilename,
      archiveStructured,
      validatorContract,
      validatorJob,
      prepareForFinalization,
      labelFor
    };
    window.dispatchEvent(new CustomEvent('angebotspilot:compliance-ready',{detail:{version:RUNTIME_VERSION,xrechnung:XR_SPEC_VERSION,validator:XR_VALIDATOR_VERSION,configuration:XR_BUNDLE_DATE}}));
    try{globalThis.refreshInvoiceComplianceUI?.()}catch(e){}
    return true;
  }

  function loadCore(){
    if(globalThis.APCompliance?.runtimeVersion==='11.31.0')return;
    if([...document.scripts].some(s=>/compliance-v1131\.js(?:\?|$)/.test(s.src||'')))return;
    const script=document.createElement('script');
    script.src='./compliance-v1131.js?v=11.31.0';
    script.defer=true;
    script.dataset.apRuntimeLoader='compliance-v113108-core';
    document.head.appendChild(script);
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install(globalThis.APCompliance)){clearInterval(timer);return}
    if(tries===2)loadCore();
    if(tries>160){clearInterval(timer);console.error('AngebotsPilot v11.31.08 Compliance-Hardening konnte nicht installiert werden.')}
  },50);
  if(!install(globalThis.APCompliance))loadCore(); else clearInterval(timer);
})();
