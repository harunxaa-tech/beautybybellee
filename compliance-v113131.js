/* AngebotsPilot v11.31.31 – ZUGFeRD 2.5.2 / EN16931 hybrid invoices.
   Additive layer over the proven v11.31.28 XRechnung/KoSIT runtime.
   XRechnung behavior is deliberately delegated unchanged. */
(function installAPCompliance113131(){
  'use strict';

  const RUNTIME_VERSION='11.31.31';
  const BASE_VERSION='11.31.28';
  const FUNCTION_NAME='zugferd-generate';
  const FLAG='__AP_COMPLIANCE_11_31_31__';

  const uniq=arr=>[...new Set((arr||[]).filter(Boolean).map(x=>String(x)))];
  const num=v=>Number(v||0);
  const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(String(v)+'T12:00:00'));
  const normalizeCountry=(v,f='DE')=>{const x=String(v||f).toUpperCase();return ['DE','AT','CH'].includes(x)?x:f};

  function appData(){return globalThis.data||{}}
  function settings(){return appData().settings||{}}
  function customerFor(inv){return (appData().customers||[]).find(c=>String(c.id)===String(inv?.customerId))||{}}
  function cloudContext(){try{return globalThis.APCloudContext?.()||null}catch(e){return null}}

  function originalInvoiceFor(inv){
    const id=inv?.documentType==='cancellation'
      ?(inv?.originalInvoiceId||inv?.correctionOf)
      :(inv?.correctionOf||inv?.originalInvoiceId);
    if(!id)return null;
    return (appData().invoices||[]).find(x=>String(x.id)===String(id))||null;
  }

  function install(base){
    if(!base)return false;
    if(base.runtimeVersion===RUNTIME_VERSION)return true;
    if(base.runtimeVersion!==BASE_VERSION)return false;
    if(typeof base.route!=='function'||typeof base.check!=='function'||typeof base.prepareInvoice!=='function')return false;

    const original={...base};

    function route(inv){
      const baseRoute=original.route(inv);
      const s=settings(),c=customerFor(inv);
      const seller=normalizeCountry(inv?.countryCode||s.countryCode||'DE');
      const buyer=normalizeCountry(inv?.recipientCountryCode||c.countryCode||seller,seller);
      const profile=typeof original.inferCustomerProfile==='function'?original.inferCustomerProfile(c):{type:c.customerType||'unknown'};
      const type=inv?.recipientType&&inv.recipientType!=='auto'?inv.recipientType:profile.type;
      const treatment=String(inv?.taxTreatment||s.taxTreatment||'standard');
      const originalInvoice=originalInvoiceFor(inv);
      const originalFormat=String(originalInvoice?.eInvoiceFormat||'').toLowerCase();

      // Korrektur/Storno bleiben in derselben maschinenlesbaren Familie wie ihr Ursprung.
      if(originalFormat==='xrechnung')return baseRoute;
      if(originalFormat==='zugferd'){
        return{
          ...baseRoute,
          sellerCountry:seller,buyerCountry:buyer,recipientType:type,
          format:'zugferd',mode:'hybrid',
          label:'ZUGFeRD 2.5.2 · EN16931 · PDF/A-3b + XML',
          delivery:'email'
        };
      }

      // Behörden bleiben auf dem bereits erprobten XRechnung/KoSIT-Pfad.
      if(seller==='DE'&&type==='public')return baseRoute;

      // Deutsches B2B: Hybrid-PDF mit eingebettetem EN16931-XML.
      // Kleinunternehmer bleiben beim bestehenden PDF-Pfad, solange keine eigene
      // explizite Opt-in-Regel dafür eingeführt wird.
      if(seller==='DE'&&buyer==='DE'&&type==='business'&&treatment!=='small_business'){
        return{
          ...baseRoute,
          sellerCountry:seller,buyerCountry:buyer,recipientType:type,
          format:'zugferd',mode:'hybrid',
          label:'ZUGFeRD 2.5.2 · EN16931 · PDF/A-3b + XML',
          delivery:'email'
        };
      }
      return baseRoute;
    }

    function prepareInvoice(inv){
      original.prepareInvoice(inv);
      if(inv)inv.eInvoiceFormat=route(inv).format;
      return inv;
    }

    function checkZugferd(inv){
      prepareInvoice(inv);
      const s=settings(),c=customerFor(inv),r=route(inv);
      const profile=typeof original.inferCustomerProfile==='function'?original.inferCustomerProfile(c):{type:c.customerType||'unknown',confidence:'unknown'};
      const seller=normalizeCountry(inv?.countryCode||s.countryCode||'DE');
      const buyer=normalizeCountry(inv?.recipientCountryCode||c.countryCode||seller,seller);
      const type=inv?.recipientType&&inv.recipientType!=='auto'?inv.recipientType:profile.type;
      const treatment=String(inv?.taxTreatment||s.taxTreatment||'standard');
      const errors=[],warnings=[],internalChecks=[];
      const req=(ok,msg)=>{internalChecks.push({ok:!!ok,message:msg});if(!ok)errors.push(msg)};

      req(String(s.companyName||'').trim(),'Firmenname fehlt');
      req(String(s.address||'').trim(),'Firmenadresse fehlt');
      req(String(c.name||'').trim(),'Kundenname/Firma fehlt');
      req(String(c.address||'').trim(),'Kundenadresse fehlt');
      req(String(inv?.number||'').trim(),'Rechnungsnummer fehlt');
      req(isoDate(inv?.date),'Rechnungsdatum fehlt');
      req(isoDate(inv?.serviceDate),'Leistungsdatum fehlt');
      req(isoDate(inv?.dueDate),'Fälligkeitsdatum fehlt');
      req(String(inv?.subject||'').trim(),'Betreff fehlt');

      const lines=(inv?.lines||[]).filter(l=>String(l?.name||'').trim());
      req(lines.length>0,'Mindestens eine gültige Rechnungsposition fehlt');
      lines.forEach((l,i)=>{
        req(num(l.qty)>0,`Position ${i+1}: Menge muss größer 0 sein`);
        req(String(l.unit||'').trim(),`Position ${i+1}: Einheit fehlt`);
      });

      const lineBase=lines.reduce((a,l)=>a+num(l.qty)*num(l.price),0);
      const discount=inv?.discount!==undefined
        ?num(inv.discount)
        :(String(inv?.discountType||'euro')==='percent'?lineBase*(num(inv?.discountValue)/100):num(inv?.discountValue));
      const expectedNet=lineBase-discount;
      const expectedGross=expectedNet+(expectedNet*num(inv?.tax)/100);
      const tol=.02;
      req(Math.abs(num(inv?.subtotal)-expectedNet)<=tol,'Rechnungssumme stimmt nicht mit den Positionen überein');
      req(Math.abs(num(inv?.total)-expectedGross)<=tol,'Gesamtbetrag/Steuer stimmt rechnerisch nicht');

      if(treatment==='standard')req(String(s.vatId||s.taxNumber||'').trim(),'Steuernummer oder USt-IdNr. des Betriebs fehlt');
      if(profile.type==='unknown'&&String(c.customerType||'auto')==='auto')errors.push('Kundentyp ist nicht eindeutig: Bitte beim Kunden einmal „Privatkunde“ oder „Unternehmen“ auswählen');
      if(type!=='business')errors.push('ZUGFeRD wird hier nur für Unternehmenskunden verwendet');
      if(seller!=='DE'||buyer!=='DE')errors.push('Dieser ZUGFeRD-Pfad ist für deutsche B2B-Rechnungen vorgesehen');

      const parse=typeof original.parseAddress==='function'?original.parseAddress:null;
      if(parse){
        const sa=parse(s.address,seller),ba=parse(c.address,buyer);
        req(!!(sa?.street&&sa?.postalCode&&sa?.city),'Firmenadresse muss für ZUGFeRD Straße, PLZ und Ort enthalten');
        req(!!(ba?.street&&ba?.postalCode&&ba?.city),'Kundenadresse muss für ZUGFeRD Straße, PLZ und Ort enthalten');
      }
      req(String(s.iban||'').trim(),'IBAN fehlt für die E-Rechnung');

      const status=errors.length?'blocked':'ready',checkedAt=new Date().toISOString();
      inv.complianceStatus=status;
      inv.complianceCheckedAt=checkedAt;
      inv.eInvoiceFormat='zugferd';
      inv.complianceReport={
        ...(inv.complianceReport||{}),
        checkedAt,
        legalProfileVersion:original.LEGAL_PROFILE_VERSION||'11.31',
        route:r,
        errors:uniq(errors),warnings:uniq(warnings),internalChecks,
        sellerCountry:seller,buyerCountry:buyer,recipientType:type,
        recipientTypeConfidence:profile.confidence||'unknown',
        validationLevel:'zugferd-server-validation-required',
        zugferd:{
          status:'pending',standard:'ZUGFeRD 2.5.2',profile:'EN16931',
          generator:'Mustangproject 2.26.0'
        }
      };
      return{ok:!errors.length,status,route:r,errors:uniq(errors),warnings:uniq(warnings),internalChecks};
    }

    function check(inv){
      if(route(inv)?.format!=='zugferd')return original.check(inv);
      return checkZugferd(inv);
    }

    function applyServerResult(inv,local,result){
      const required=['source_fingerprint','structured_storage_path','structured_sha256','hybrid_pdf_storage_path','hybrid_pdf_sha256','verapdf_report_sha256'];
      const missing=required.filter(k=>!String(result?.[k]||'').trim());
      const hashOk=value=>/^[0-9a-f]{64}$/i.test(String(value||''));
      const verifierOk=result?.verapdf_valid===true&&result?.verapdf_version==='1.30.2'&&result?.verapdf_profile==='3b'&&hashOk(result?.verapdf_report_sha256);
      const proofHashesOk=hashOk(result?.source_fingerprint)&&hashOk(result?.structured_sha256)&&hashOk(result?.hybrid_pdf_sha256);
      if(!result?.ok||missing.length||!verifierOk||!proofHashesOk){
        const errors=uniq([...(local?.errors||[]),'ZUGFeRD-Prüfnachweis ist unvollständig. Die Rechnung wurde nicht ausgestellt.']);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'technical-error',failureKind:'technical',technicalError:true,errors};
      }

      inv.eInvoiceFormat='zugferd';
      inv.zugferdSourceFingerprint=result.source_fingerprint||'';
      inv.structuredStoragePath=result.structured_storage_path;
      inv.structuredSha256=result.structured_sha256;
      inv.hybridPdfStoragePath=result.hybrid_pdf_storage_path;
      inv.hybridPdfSha256=result.hybrid_pdf_sha256;
      inv.complianceStatus=result.compliance_status||'ready';
      inv.complianceCheckedAt=result.compliance_checked_at||new Date().toISOString();
      inv.complianceReport=result.compliance_report||{
        checkedAt:inv.complianceCheckedAt,
        zugferd:{
          status:'passed',standard:'ZUGFeRD 2.5.2',profile:'EN16931',engine:'Mustangproject',engineVersion:'2.26.0',
          veraPdf:{valid:true,version:'1.30.2',profile:'3b',reportSha256:result.verapdf_report_sha256}
        }
      };

      return{
        ...local,
        ok:true,status:'ready',route:route(inv),errors:[],warnings:[],
        serverValidation:{
          status:'passed',standard:'ZUGFeRD 2.5.2',profile:'EN16931',
          engine:'Mustangproject',engineVersion:'2.26.0',
          xmlSha256:inv.structuredSha256,pdfSha256:inv.hybridPdfSha256,
          veraPdfValid:true,veraPdfVersion:'1.30.2',veraPdfProfile:'3b',
          veraPdfReportSha256:result.verapdf_report_sha256
        },
        archived:{
          xmlPath:inv.structuredStoragePath,xmlSha256:inv.structuredSha256,
          pdfPath:inv.hybridPdfStoragePath,pdfSha256:inv.hybridPdfSha256
        }
      };
    }

    async function preflightForFinalization(inv){
      const r=route(inv);
      if(r?.format!=='zugferd'){
        if(typeof original.preflightForFinalization==='function')return original.preflightForFinalization(inv);
        prepareInvoice(inv);return original.check(inv);
      }

      const local=checkZugferd(inv);
      if(!local.ok)return local;

      const ctx=cloudContext();
      if(!ctx?.client||!ctx?.company?.id||!ctx?.session?.user){
        const errors=['ZUGFeRD kann erst nach erfolgreicher Cloud-Anmeldung sicher erzeugt werden.'];
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'technical-error',failureKind:'technical',technicalError:true,errors};
      }
      if(!['owner','office'].includes(String(ctx?.membership?.role||''))){
        const errors=['Nur Inhaber oder Büro dürfen eine E-Rechnung ausstellen.'];
        return{...local,ok:false,status:'blocked',failureKind:'permission',errors};
      }

      const invoiceRef=String(inv?.id||'').trim();
      if(!invoiceRef){
        const errors=['Die Rechnung besitzt noch keine stabile Beleg-ID.'];
        return{...local,ok:false,status:'blocked',failureKind:'input',errors};
      }

      try{
        const {data,error}=await ctx.client.functions.invoke(FUNCTION_NAME,{body:{invoice_id:invoiceRef}});
        if(error)throw error;
        return applyServerResult(inv,local,data||{});
      }catch(error){
        console.error('ZUGFeRD-Serverprüfung fehlgeschlagen',error);
        const errors=['ZUGFeRD konnte technisch nicht vollständig erzeugt und validiert werden. Bitte erneut versuchen.'];
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors,zugferd:{status:'error',standard:'ZUGFeRD 2.5.2',profile:'EN16931'}};
        return{...local,ok:false,status:'technical-error',failureKind:'technical',technicalError:true,errors};
      }
    }

    async function prepareForFinalization(inv){return preflightForFinalization(inv)}

    async function archiveStructured(inv){
      if(route(inv)?.format!=='zugferd')return original.archiveStructured?.(inv);
      if(!inv?.structuredStoragePath||!inv?.hybridPdfStoragePath)throw new Error('ZUGFeRD-Archivnachweis fehlt.');
      return{
        path:inv.structuredStoragePath,sha256:inv.structuredSha256||'',
        hybridPdfPath:inv.hybridPdfStoragePath,hybridPdfSha256:inv.hybridPdfSha256||''
      };
    }

    function labelFor(inv){
      const r=route(inv);
      if(r?.format!=='zugferd')return original.labelFor?.(inv)||'Rechnungsprüfung';
      const z=inv?.complianceReport?.zugferd;
      if(z?.status==='passed')return'ZUGFeRD 2.5.2 · EN16931 · PDF/A-3b + XML ✓';
      return'ZUGFeRD 2.5.2 · EN16931 · Serverprüfung beim Ausstellen';
    }

    function invoiceFields(inv={}){
      const baseFields=typeof original.invoiceFields==='function'?original.invoiceFields(inv):{};
      return{
        ...baseFields,
        eInvoiceFormat:inv.eInvoiceFormat||route(inv).format,
        zugferdSourceFingerprint:inv.zugferdSourceFingerprint||'',
        hybridPdfStoragePath:inv.hybridPdfStoragePath||'',
        hybridPdfSha256:inv.hybridPdfSha256||''
      };
    }

    globalThis.APCompliance={
      ...base,
      RUNTIME_VERSION,
      runtimeVersion:RUNTIME_VERSION,
      zugferdGenerationFunction:FUNCTION_NAME,
      route,prepareInvoice,check,checkZugferd,
      preflightForFinalization,prepareForFinalization,
      archiveStructured,labelFor,invoiceFields
    };

    globalThis[FLAG]=true;
    window.dispatchEvent(new CustomEvent('angebotspilot:compliance-ready',{detail:{
      version:RUNTIME_VERSION,
      xrechnung:'v11.31.28-preserved',
      zugferd:{standard:'2.5.2',profile:'EN16931',engine:'Mustangproject 2.26.0',archive:'XML+PDF/A-3b',verifier:'veraPDF 1.30.2'}
    }}));
    try{globalThis.refreshInvoiceComplianceUI?.()}catch(e){}
    return true;
  }

  globalThis.APComplianceUpgradeTo113131=install;
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install(globalThis.APCompliance)){clearInterval(timer);return}
    if(tries>240){clearInterval(timer);console.error('AngebotsPilot v11.31.31 ZUGFeRD-Layer konnte nicht installiert werden.')}
  },50);
  if(install(globalThis.APCompliance))clearInterval(timer);
})();
