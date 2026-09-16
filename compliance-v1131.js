/* AngebotsPilot v11.31.0 – Rechnungs-Compliance Core
   Stand 2026-09-16: XRechnung 3.0.2 / Bundle 2026-08-31, ZUGFeRD 2.5.2.
   Erweitert die bestehende APCompliance-Schicht, ohne bestehende Rechnungsdaten umzuschreiben. */
(function(){
  'use strict';

  const RUNTIME_VERSION='11.31.0';
  const PROFILE_AS_OF='2026-09-16';
  const XR_CUSTOMIZATION='urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
  const XR_LEGACY_WRONG='urn:cen.eu:en16931:2017#compliant#urn:xoeinkauf.de:kosit:xrechnung_3.0';
  const XR_SPEC_VERSION='3.0.2';
  const XR_BUNDLE_DATE='2026-08-31';
  const XR_VALIDATOR_VERSION='1.6.3';
  const ZUGFERD_VERSION='2.5.2';
  const EN16931='EN 16931';
  const RETENTION_YEARS={DE:8,AT:7,CH:10};
  const INSTALL_KEY='__AP_COMPLIANCE_11_31_0__';

  if(globalThis[INSTALL_KEY])return;
  globalThis[INSTALL_KEY]=true;

  const uniq=list=>[...new Set((list||[]).filter(Boolean))];
  const num=v=>Number(v)||0;
  const lower=v=>String(v||'').trim().toLowerCase();
  const isoNow=()=>new Date().toISOString();
  const clone=v=>{try{return structuredClone(v)}catch(e){return JSON.parse(JSON.stringify(v))}};
  const data=()=>globalThis.data||{};
  const settings=()=>data().settings||{};
  const customerFor=inv=>(data().customers||[]).find(c=>c.id===inv?.customerId)||{};
  const currentYear=()=>new Date().getFullYear();

  function country(v,fallback='DE'){
    const x=String(v||fallback).toUpperCase();
    return ['DE','AT','CH'].includes(x)?x:fallback;
  }

  function recipientType(inv,base){
    if(inv?.recipientType&&inv.recipientType!=='auto')return inv.recipientType;
    const c=customerFor(inv);
    if(c?.customerType&&c.customerType!=='auto')return c.customerType;
    try{return base?.inferCustomerProfile?.(c)?.type||'unknown'}catch(e){return'unknown'}
  }

  function taxTreatment(inv){return String(inv?.taxTreatment||settings().taxTreatment||'standard')}

  function legalDecision(inv,baseRoute,base){
    const s=settings(),c=customerFor(inv),seller=country(inv?.countryCode||s.countryCode||'DE'),buyer=country(inv?.recipientCountryCode||c.countryCode||seller,seller),type=recipientType(inv,base),treatment=taxTreatment(inv),gross=Math.abs(num(inv?.total)),year=currentYear();
    const out={
      asOf:PROFILE_AS_OF,sellerCountry:seller,buyerCountry:buyer,recipientType:type,
      mandatoryNow:false,canUseOtherInvoice:true,receptionRequired:false,status:'not_applicable',
      reason:'Keine besondere strukturierte E‑Rechnungspflicht aus der hinterlegten Regelmatrix erkannt.',
      transitionEnds:'',reference:'',formatPrepared:baseRoute?.format||'pdf'
    };

    if(seller==='DE'){
      out.retentionYears=RETENTION_YEARS.DE;
      if(type==='public'){
        out.mandatoryNow=true;out.canUseOtherInvoice=false;out.status='b2g_structured';
        out.reason='Öffentlicher Rechnungsempfänger: AngebotsPilot bereitet XRechnung vor; der konkrete Übermittlungsweg richtet sich nach dem Auftraggeber.';
        out.reference='XRechnung/B2G';return out;
      }
      if(type==='private'){
        out.status='b2c_outside_b2b_mandate';
        out.reason='B2C-Rechnungen fallen nicht unter die deutsche B2B-E‑Rechnungspflicht.';
        out.reference='§ 14 UStG · BMF E‑Rechnung FAQ';return out;
      }
      if(buyer!=='DE'){
        out.status='cross_border_outside_domestic_mandate';
        out.reason='Die deutsche Pflicht betrifft grundsätzlich Umsätze zwischen inländischen Unternehmern; Empfängeranforderungen im Zielland bleiben separat zu prüfen.';
        out.reference='BMF E‑Rechnung FAQ';return out;
      }
      out.receptionRequired=true;
      if(treatment==='small_business'){
        out.status='issue_exempt_small_business';
        out.reason='Leistungen von Kleinunternehmern sind von der Pflicht zur Ausstellung einer E‑Rechnung ausgenommen; E‑Rechnungen müssen als inländisches Unternehmen dennoch empfangen werden können.';
        out.reference='§ 34a UStDV · BMF E‑Rechnung FAQ';return out;
      }
      if(gross>0&&gross<=250){
        out.status='issue_exempt_low_value';
        out.reason='Kleinbetragsrechnungen bis 250 € brutto sind von der Pflicht zur Ausstellung einer E‑Rechnung ausgenommen; eine strukturierte Rechnung bleibt freiwillig möglich.';
        out.reference='§ 33 UStDV · BMF E‑Rechnung FAQ';return out;
      }
      if(treatment==='exempt'){
        out.status='tax_exemption_case_check';
        out.reason='Bei steuerfreien Umsätzen hängt die E‑Rechnungspflicht davon ab, ob überhaupt eine umsatzsteuerliche Rechnungspflicht besteht. AngebotsPilot erzwingt deshalb keinen Rechtsautomatismus.';
        out.reference='BMF E‑Rechnung FAQ';
      }
      if(type==='business'||type==='unknown'){
        if(year<=2026){
          out.mandatoryNow=false;out.canUseOtherInvoice=true;out.status='transition_2025_2026';out.transitionEnds='2026-12-31';
          out.reason='Bis 31.12.2026 darf im deutschen B2B-Bereich aufgrund der Übergangsregelung noch eine sonstige Rechnung verwendet werden. AngebotsPilot kann bereits jetzt strukturiert ausgeben.';
          out.reference='§ 27 Abs. 38 UStG · BMF E‑Rechnung FAQ';return out;
        }
        if(year===2027){
          out.status='transition_2027_turnover_dependent';out.transitionEnds='2027-12-31';
          out.reason='2027 hängt die weitere Übergangsregelung insbesondere vom Vorjahresumsatz bis 800.000 € ab. AngebotsPilot bereitet vorsorglich eine strukturierte Rechnung vor.';
          out.reference='§ 27 Abs. 38 UStG · BMF E‑Rechnung FAQ';return out;
        }
        out.mandatoryNow=true;out.canUseOtherInvoice=false;out.status='domestic_b2b_structured_required';
        out.reason='Nach Ablauf der Übergangsfristen ist bei inländischen B2B-Umsätzen grundsätzlich eine strukturierte E‑Rechnung zu verwenden, soweit keine Ausnahme greift.';
        out.reference='§ 14 UStG · § 27 Abs. 38 UStG';return out;
      }
    }

    if(seller==='AT'){
      out.retentionYears=RETENTION_YEARS.AT;
      if(type==='public'){
        out.mandatoryNow=true;out.canUseOtherInvoice=false;out.status='at_federal_public_structured';
        out.reason='Bei österreichischen Bundesdienststellen ist die strukturierte elektronische Rechnung verpflichtend; Einbringung erfolgt über USP/e‑Rechnung.gv.at oder PEPPOL.';
        out.reference='§ 5 IKTKonG · USP e‑Rechnung';return out;
      }
      out.status='at_electronic_with_recipient_consent';
      out.reason='In Österreich kann eine Rechnung elektronisch übermittelt werden, wenn der Empfänger dieser Form zustimmt; außerhalb des Bundes besteht keine allgemeine strukturierte B2B-Pflicht wie in Deutschland.';
      out.reference='§ 11 UStG AT · USP e‑Rechnung';return out;
    }

    if(seller==='CH'){
      out.retentionYears=RETENTION_YEARS.CH;
      out.status=type==='public'?'ch_public_process_specific':'ch_format_neutral';
      out.reason=type==='public'
        ?'Bei Schweizer öffentlichen Stellen sind Empfänger- und Bestellreferenzen sowie der vereinbarte Einreichungsweg zu beachten.'
        :'Papier- und elektronische Rechnungen sind grundsätzlich gleichgestellt; Herkunft, Unverändertheit, Lesbarkeit und Prüfspur müssen gewährleistet bleiben.';
      out.reference='MWSTG/OR · ESTV elektronischer Geschäftsverkehr';return out;
    }

    return out;
  }

  function taxCategory(inv){
    const treatment=taxTreatment(inv);
    if(treatment==='reverse_charge')return{code:'AE',rate:0,reason:inv?.taxNote||'Steuerschuldnerschaft des Leistungsempfängers'};
    if(treatment==='small_business')return{code:'E',rate:0,reason:inv?.taxNote||'Kleinunternehmerregelung'};
    if(treatment==='exempt')return{code:'E',rate:0,reason:inv?.taxNote||'Steuerbefreiung'};
    if(treatment==='non_registered')return{code:'O',rate:0,reason:inv?.taxNote||'Nicht der Umsatzsteuer unterliegend'};
    return{code:'S',rate:num(inv?.tax),reason:''};
  }

  function patchAllowanceTax(xml,inv){
    const source=String(xml||''),match=source.match(/<cac:AllowanceCharge>[\s\S]*?<\/cac:AllowanceCharge>/);
    if(!match)return source;
    let block=match[0];
    const tax=taxCategory(inv),reason=tax.reason?`<cbc:TaxExemptionReason>${escapeXml(tax.reason)}</cbc:TaxExemptionReason>`:'';
    const taxNode=`<cac:TaxCategory><cbc:ID>${tax.code}</cbc:ID><cbc:Percent>${Number(tax.rate||0).toFixed(2)}</cbc:Percent>${reason}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>`;
    if(!block.includes('<cbc:AllowanceChargeReason>'))block=block.replace(/(<cbc:ChargeIndicator>false<\/cbc:ChargeIndicator>)/,'$1<cbc:AllowanceChargeReason>Rabatt</cbc:AllowanceChargeReason>');
    if(!block.includes('<cac:TaxCategory>'))block=block.replace(/(<cbc:BaseAmount[^>]*>[^<]*<\/cbc:BaseAmount>)(<\/cac:AllowanceCharge>)/,`$1${taxNode}$2`);
    return source.replace(match[0],block);
  }

  function escapeXml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}

  function patchGeneratedXml(xml,inv,format){
    let out=String(xml||'');
    if(format==='xrechnung'){
      out=out.split(XR_LEGACY_WRONG).join(XR_CUSTOMIZATION);
      // Falls ein älterer Generator eine andere XRechnung-3.0-Kennung liefert, auf die aktuelle CIUS-Kennung normalisieren.
      out=out.replace(/urn:cen\.eu:en16931:2017#compliant#urn:[^<\s]*xrechnung_3\.0/g,XR_CUSTOMIZATION);
    }
    out=patchAllowanceTax(out,inv);
    return out;
  }

  function validatePatchedXml(xml,inv,route,base){
    const errors=[],checks=[];
    const push=(ok,good,bad)=>{checks.push({ok:!!ok,message:ok?good:bad});if(!ok)errors.push(bad)};
    const source=String(xml||'');
    try{
      const legacy=base?.validateStructuredXml?.(source,inv,route);
      (legacy?.checks||[]).filter(x=>!(route?.format==='xrechnung'&&String(x?.message||'').includes('XRechnung-CIUS-Kennung'))).forEach(x=>checks.push(x));
      (legacy?.errors||[]).filter(x=>!(route?.format==='xrechnung'&&String(x||'').includes('XRechnung-CIUS-Kennung'))).forEach(x=>errors.push(x));
    }catch(e){errors.push('Interner XML-Basischeck fehlgeschlagen: '+String(e?.message||e))}

    if(route?.format==='xrechnung'){
      push(source.includes(`<cbc:CustomizationID>${XR_CUSTOMIZATION}</cbc:CustomizationID>`),'XRechnung-CIUS-Kennung entspricht XRechnung 3.0','XRechnung-CIUS-Kennung ist nicht aktuell/korrekt');
      push(!source.includes('xoeinkauf.de'),'Veraltete/fehlerhafte XRechnung-Domain nicht enthalten','Veraltete/fehlerhafte XRechnung-Kennung xoeinkauf.de erkannt');
      push(source.includes('<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>'),'Prozesskennung vorhanden','XRechnung-Prozesskennung fehlt');
    }
    if(Math.abs(num(inv?.discount))>0||Math.abs(num(inv?.discountValue))>0){
      const allowance=(source.match(/<cac:AllowanceCharge>[\s\S]*?<\/cac:AllowanceCharge>/)||[''])[0];
      push(allowance.includes('<cbc:AllowanceChargeReason>'),'Rabattgrund im XML vorhanden','Dokumentenrabatt benötigt einen Rabattgrund im strukturierten XML');
      push(allowance.includes('<cac:TaxCategory>'),'Steuerkategorie des Rabatts vorhanden','Dokumentenrabatt benötigt eine Steuerkategorie im strukturierten XML');
    }
    return{ok:!uniq(errors).length,errors:uniq(errors),checks};
  }

  async function blobSha256(blob){
    const bytes=await blob.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function install(base){
    if(!base||base.runtimeVersion===RUNTIME_VERSION)return false;
    const original={...base};

    function route(inv){
      const r={...(original.route?.(inv)||{format:'pdf',mode:'pdf',label:'PDF-Rechnung',delivery:'email'})};
      const legal=legalDecision(inv,r,original);
      return{...r,legal,standard:r.format==='xrechnung'?'XRechnung':r.format==='ubl'?'UBL 2.1':'PDF',standardVersion:r.format==='xrechnung'?XR_SPEC_VERSION:r.format==='ubl'?'2.1':'',bundleDate:r.format==='xrechnung'?XR_BUNDLE_DATE:'',validationProfile:r.mode==='structured'?'internal-precheck':'document-check'};
    }

    function generateUbl(inv,format='xrechnung'){
      const raw=original.generateUbl(inv,format);
      return patchGeneratedXml(raw,inv,format);
    }

    function validateStructuredXml(xml,inv,r){return validatePatchedXml(xml,inv,r||route(inv),original)}

    function check(inv){
      original.prepareInvoice?.(inv);
      const legacy=original.check?.(inv)||{ok:true,status:'ready',errors:[],warnings:[],internalChecks:[]};
      const r=route(inv),legal=r.legal,errors=[...(legacy.errors||[])],warnings=[...(legacy.warnings||[])],internalChecks=[...(legacy.internalChecks||[])];

      if(r.mode==='structured'){
        try{
          const xml=generateUbl(inv,r.format),sv=validateStructuredXml(xml,inv,r);
          sv.checks.forEach(x=>internalChecks.push(x));
          sv.errors.forEach(x=>errors.push(x));
        }catch(e){errors.push('Strukturierte Rechnung konnte nicht für den v11.31-Vorabcheck erzeugt werden: '+String(e?.message||e))}
      }

      if(legal?.reason)warnings.push(legal.reason);
      if(r.format==='xrechnung')warnings.push(`Technischer Zielstand: XRechnung ${XR_SPEC_VERSION}, Bundle ${XR_BUNDLE_DATE}. Die App führt einen internen Vorabcheck durch; eine vollständige KoSIT-/Schematron-Validierung ist davon zu unterscheiden.`);
      if(r.format==='xrechnung'&&currentYear()>=2027)warnings.push('Vor produktiver Einreichung bei kritischen Empfängern sollte die XML zusätzlich gegen das jeweils aktuelle XRechnung-Bundle validiert werden.');
      if(r.format==='pdf'&&country(inv?.countryCode||settings().countryCode)==='AT')warnings.push('Bei elektronischer PDF-Übermittlung in Österreich Zustimmung des Empfängers beachten.');

      const uniqueErrors=uniq(errors),uniqueWarnings=uniq(warnings),status=uniqueErrors.length?'blocked':uniqueWarnings.length?'warning':'ready',checkedAt=isoNow();
      inv.complianceStatus=status;
      inv.complianceCheckedAt=checkedAt;
      inv.eInvoiceFormat=r.format;
      inv.complianceReport={
        ...(clone(inv.complianceReport||{})),checkedAt,appBuild:RUNTIME_VERSION,profileAsOf:PROFILE_AS_OF,
        route:r,legalDecision:legal,errors:uniqueErrors,warnings:uniqueWarnings,internalChecks,
        standards:{en16931:EN16931,xrechnung:{version:XR_SPEC_VERSION,bundle:XR_BUNDLE_DATE,customizationId:XR_CUSTOMIZATION,validatorReference:XR_VALIDATOR_VERSION},zugferd:{version:ZUGFERD_VERSION,status:'roadmap-not-generated-in-v11.31.0'}},
        validationLevel:r.mode==='structured'?'internal-precheck-not-official-kosit':'mandatory-field-and-math-check',
        retentionYears:legal?.retentionYears||RETENTION_YEARS[country(inv?.countryCode||settings().countryCode)]||10
      };
      return{ok:!uniqueErrors.length,status,route:r,errors:uniqueErrors,warnings:uniqueWarnings,internalChecks,legalDecision:legal};
    }

    function structuredBlob(inv){
      const r=route(inv);if(!['xrechnung','ubl'].includes(r.format))return null;
      return new Blob([generateUbl(inv,r.format)],{type:'application/xml;charset=utf-8'});
    }

    function structuredFilename(inv){
      const safe=String(inv?.number||'rechnung').replace(/[^a-z0-9._-]+/gi,'_');
      const r=route(inv);
      return r.format==='xrechnung'?`${safe}-XRechnung-${XR_SPEC_VERSION}.xml`:`${safe}-UBL-2.1.xml`;
    }

    async function archiveStructured(inv){
      const blob=structuredBlob(inv);if(!blob)return null;
      if(!globalThis.CloudFiles?.uploadStructuredInvoice)throw new Error('Cloud-Archiv für E‑Rechnungen ist noch nicht bereit.');
      const filename=structuredFilename(inv),hash=await blobSha256(blob);
      if(inv.structuredStoragePath&&inv.structuredSha256===hash)return{blob,filename,path:inv.structuredStoragePath,sha256:hash};
      const saved=await globalThis.CloudFiles.uploadStructuredInvoice(blob,filename,inv.id);
      inv.structuredStoragePath=saved.path;inv.structuredSha256=hash;
      return{blob,filename,path:saved.path,sha256:hash};
    }

    async function prepareForFinalization(inv){
      original.prepareInvoice?.(inv);
      const result=check(inv);if(!result.ok)return{...result,archived:null};
      let archived=null;
      if(result.route.mode==='structured'){
        try{archived=await archiveStructured(inv)}catch(e){
          const message='E‑Rechnungs-Original konnte nicht sicher archiviert werden: '+String(e?.message||e);
          result.ok=false;result.status='blocked';result.errors=uniq([...(result.errors||[]),message]);
          inv.complianceStatus='blocked';inv.complianceReport={...(inv.complianceReport||{}),errors:result.errors};
          return{...result,archived:null};
        }
      }
      return{...result,archived};
    }

    function labelFor(inv){
      const r=route(inv);
      if(r.format==='xrechnung')return`XRechnung ${XR_SPEC_VERSION} · UBL 2.1 · interner Vorabcheck`;
      if(r.format==='ubl')return`UBL 2.1 · ${EN16931}-Vorabcheck`;
      if(r.format==='pdf')return`PDF / sonstige Rechnung · Pflichtfelder & Rechenwerte geprüft`;
      return`Elektronische Rechnung · Empfängerweg beachten`;
    }

    globalThis.APCompliance={
      ...base,
      RUNTIME_VERSION,PROFILE_AS_OF,LEGAL_PROFILE_VERSION:`DE-AT-CH-${PROFILE_AS_OF}`,
      RETENTION_YEARS,XR_CUSTOMIZATION,XR_SPEC_VERSION,XR_BUNDLE_DATE,XR_VALIDATOR_VERSION,ZUGFERD_VERSION,
      runtimeVersion:RUNTIME_VERSION,standards:{en16931:EN16931,xrechnung:XR_SPEC_VERSION,zugferd:ZUGFERD_VERSION},
      route,legalDecision:inv=>legalDecision(inv,original.route?.(inv),original),check,generateUbl,validateStructuredXml,
      structuredBlob,structuredFilename,archiveStructured,prepareForFinalization,labelFor
    };
    window.dispatchEvent(new CustomEvent('angebotspilot:compliance-ready',{detail:{version:RUNTIME_VERSION,xrechnung:XR_SPEC_VERSION,zugferd:ZUGFERD_VERSION}}));
    try{globalThis.refreshInvoiceComplianceUI?.()}catch(e){}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install(globalThis.APCompliance)||tries>80)clearInterval(timer);
  },50);
  if(install(globalThis.APCompliance))clearInterval(timer);
})();
