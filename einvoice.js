(()=>{
'use strict';
const XMLNS={
  invoice:'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac:'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc:'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
};
const XRECHNUNG='urn:cen.eu:en16931:2017#compliant#urn:xoeinkauf.de:kosit:xrechnung_3.0';
const PEPPOL='urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
const PROFILE='urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';
const LEGAL_PROFILE_VERSION='DE-AT-CH-2026-09';
const RETENTION_YEARS={DE:8,AT:7,CH:10};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const num=v=>Number(v)||0;
const money=v=>(Math.round((Number(v)||0)*100)/100).toFixed(2);
const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
const emailOk=v=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(v||'').trim());
const vatClean=v=>String(v||'').replace(/\s+/g,'').toUpperCase();
const companySuffix=/(gmbh|ug\b|ag\b|kg\b|ohg|gbr|e\.\s*u\.|gesmbh|sarl|sa\b|ltd\b|inc\b|verein|stiftung|genossenschaft)/i;
const publicWords=/(bundesamt|bundesministerium|ministerium|stadtverwaltung|gemeinde|landratsamt|behörde|behoerde|kanton|verwaltung|magistrat|universität|universitaet|polizei|finanzamt|amt für|amt fuer)/i;
function getData(){return globalThis.data||{};}
function settings(){return getData().settings||{};}
function customerFor(inv){return (getData().customers||[]).find(c=>c.id===inv?.customerId)||{};}
function jobFor(inv){return (getData().jobs||[]).find(j=>j.id===inv?.jobId)||{};}
function normalizeCountry(v,fallback='DE'){const x=String(v||fallback).toUpperCase();return ['DE','AT','CH'].includes(x)?x:fallback;}
function inferCustomerProfile(c){
  const explicit=String(c?.customerType||'auto');
  if(['private','business','public'].includes(explicit))return{type:explicit,confidence:'explicit',reason:'manuell gesetzt'};
  const text=`${c?.name||''} ${c?.contact||''}`;
  if(publicWords.test(text))return{type:'public',confidence:'high',reason:'Behörden-/Verwaltungsbegriff erkannt'};
  if(vatClean(c?.vatId))return{type:'business',confidence:'high',reason:'USt-ID / UID / MWST-Nr. vorhanden'};
  if(companySuffix.test(text))return{type:'business',confidence:'high',reason:'Unternehmensrechtsform erkannt'};
  return{type:'unknown',confidence:'low',reason:'Kundentyp nicht eindeutig erkennbar'};
}
function inferCustomerType(c){const p=inferCustomerProfile(c);return p.type==='unknown'?'private':p.type;}
function parseAddress(raw,country='DE'){
  const s=String(raw||'').replace(/\r/g,'').trim();
  if(!s)return{raw:'',street:'',postalCode:'',city:'',country};
  const lines=s.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
  const pattern=country==='DE'?/(^|\s)(\d{5})\s+(.+)$/:/(^|\s)(\d{4})\s+(.+)$/;
  let postalCode='',city='',postalIndex=-1;
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(pattern);if(m){postalCode=m[2];city=m[3].trim();postalIndex=i;break}
  }
  if(!postalCode){const m=s.match(pattern);if(m){postalCode=m[2];city=m[3].trim().split(/\n|,/)[0].trim()}}
  let street='';
  if(postalIndex>0)street=lines.slice(0,postalIndex).join(', ');
  else if(lines.length>1)street=lines[0];
  else if(postalCode)street=s.slice(0,s.indexOf(postalCode)).replace(/[;,\n]+$/,'').trim();
  else street=s;
  return{raw:s,street,postalCode,city,country};
}
function unitCode(unit){const u=String(unit||'').toLowerCase();if(u.includes('std')||u.includes('stunde'))return'HUR';if(u.includes('tag'))return'DAY';if(u.includes('m²')||u.includes('m2'))return'MTK';if(u.includes('m³')||u.includes('m3'))return'MTQ';if(u==='km'||u.includes('kilometer'))return'KMT';return'C62';}
function taxCategory(inv){const t=String(inv.taxTreatment||settings().taxTreatment||'standard');if(t==='reverse_charge')return{code:'AE',rate:0,reason:inv.taxNote||'Steuerschuldnerschaft des Leistungsempfängers'};if(t==='small_business')return{code:'E',rate:0,reason:inv.taxNote||'Steuerbefreiung / Kleinunternehmerregelung'};if(t==='exempt')return{code:'E',rate:0,reason:inv.taxNote||'Steuerbefreit'};if(t==='non_registered')return{code:'O',rate:0,reason:inv.taxNote||'Nicht der Umsatzsteuer unterliegend'};return{code:'S',rate:num(inv.tax),reason:''};}
function route(inv){
  const s=settings(),seller=normalizeCountry(inv?.countryCode||s.countryCode||'DE'),c=customerFor(inv),buyer=normalizeCountry(inv?.recipientCountryCode||c.countryCode||seller,seller),profile=inferCustomerProfile(c),type=inv?.recipientType&&inv.recipientType!=='auto'?inv.recipientType:profile.type,forced=!!c.eInvoiceRequired,treatment=String(inv?.taxTreatment||s.taxTreatment||'standard');
  const base={sellerCountry:seller,buyerCountry:buyer,recipientType:type,legalProfileVersion:LEGAL_PROFILE_VERSION,retentionYears:RETENTION_YEARS[seller]||10};
  if(forced){
    if(seller==='AT')return{...base,format:'ubl',mode:'structured',label:'UBL 2.1 · E‑Rechnung',delivery:type==='public'?'public_portal':'recipient'};
    if(seller==='DE')return{...base,format:'xrechnung',mode:'structured',label:'XRechnung 3.0 · XML',delivery:type==='public'?'public_portal':'email'};
    if(seller==='CH')return{...base,format:'public_portal',mode:'pdf_electronic',label:'Elektronische Rechnung · Schweiz',delivery:type==='public'?'public_email':'recipient'};
  }
  if(seller==='DE'&&type==='public')return{...base,format:'xrechnung',mode:'structured',label:'XRechnung 3.0 · Behördenrechnung',delivery:'public_portal'};
  if(seller==='DE'&&buyer==='DE'&&type==='business'&&treatment!=='small_business')return{...base,format:'xrechnung',mode:'structured',label:'XRechnung 3.0 · XML',delivery:'email'};
  if(seller==='AT'&&type==='public')return{...base,format:'ubl',mode:'structured',label:'UBL 2.1 · e‑Rechnung.gv.at',delivery:'public_portal'};
  if(seller==='CH'&&type==='public')return{...base,format:'public_portal',mode:'pdf_electronic',label:'Elektronische Behördenrechnung',delivery:'public_email'};
  return{...base,format:'pdf',mode:'pdf',label:'PDF-Rechnung',delivery:'email'};
}
function prepareInvoice(inv){
  if(!inv)return inv;const d=getData(),s=settings(),c=customerFor(inv),j=jobFor(inv),seller=normalizeCountry(inv.countryCode||s.countryCode||'DE');
  inv.serviceDate=inv.serviceDate||j.start||inv.date||new Date().toISOString().slice(0,10);
  inv.recipientType=inv.recipientType&&inv.recipientType!=='auto'?inv.recipientType:(c.customerType||'auto');
  inv.recipientCountryCode=normalizeCountry(c.countryCode||inv.recipientCountryCode||seller,seller);
  inv.recipientVatId=inv.recipientVatId||c.vatId||'';
  inv.buyerReference=inv.buyerReference||c.buyerReference||'';
  inv.eInvoiceFormat=route(inv).format;
  inv.complianceStatus=inv.complianceStatus||'unchecked';
  inv.complianceReport=inv.complianceReport||{};
  return inv;
}
function check(inv){
  prepareInvoice(inv);
  const s=settings(),c=customerFor(inv),profile=inferCustomerProfile(c),r=route(inv),seller=normalizeCountry(inv.countryCode||s.countryCode||'DE'),buyer=normalizeCountry(inv.recipientCountryCode||c.countryCode||seller,seller),type=inv.recipientType&&inv.recipientType!=='auto'?inv.recipientType:profile.type,errors=[],warnings=[],internalChecks=[];
  const req=(ok,msg)=>{if(!ok)errors.push(msg)};
  const note=(ok,good,bad)=>{internalChecks.push({ok:!!ok,message:ok?good:bad});if(!ok)errors.push(bad)};
  req(String(s.companyName||'').trim(),'Firmenname fehlt');
  req(String(s.address||'').trim(),'Firmenadresse fehlt');
  req(String(c.name||'').trim(),'Kundenname/Firma fehlt');
  req(String(c.address||'').trim(),'Kundenadresse fehlt');
  req(String(inv.number||'').trim(),'Rechnungsnummer fehlt');
  req(isoDate(inv.date),'Rechnungsdatum fehlt');
  req(isoDate(inv.serviceDate),'Leistungsdatum fehlt');
  req(isoDate(inv.dueDate),'Fälligkeitsdatum fehlt');
  req(String(inv.subject||'').trim(),'Betreff fehlt');
  const validLines=(inv.lines||[]).filter(l=>String(l.name||'').trim());
  req(validLines.some(l=>num(l.qty)>0),'Mindestens eine gültige Rechnungsposition fehlt');
  validLines.forEach((l,i)=>{req(num(l.qty)>0,`Position ${i+1}: Menge muss größer 0 sein`);req(String(l.unit||'').trim(),`Position ${i+1}: Einheit fehlt`);});

  // Rechenkontrolle unabhängig vom Land. Kleine Rundungsdifferenzen bis 2 Cent sind toleriert.
  const lineBase=validLines.reduce((a,l)=>a+num(l.qty)*num(l.price),0),discount=inv.discount!==undefined?num(inv.discount):(String(inv.discountType||'euro')==='percent'?lineBase*(num(inv.discountValue)/100):num(inv.discountValue)),expectedNet=lineBase-discount,expectedGross=expectedNet+(expectedNet*num(inv.tax)/100),tol=.02;
  note(Math.abs(num(inv.subtotal)-expectedNet)<=tol,'Positionssumme und Zwischensumme stimmen überein','Rechnungssumme stimmt nicht mit den Positionen überein');
  note(Math.abs(num(inv.total)-expectedGross)<=tol,'Gesamtbetrag und Steuer sind rechnerisch stimmig','Gesamtbetrag/Steuer stimmt rechnerisch nicht');

  const treatment=String(inv.taxTreatment||s.taxTreatment||'standard');
  if(treatment==='standard'){
    if(seller==='DE')req(vatClean(s.vatId)||String(s.taxNumber||'').trim(),'Steuernummer oder USt-IdNr. des Betriebs fehlt');
    if(seller==='AT')req(vatClean(s.vatId),'UID des österreichischen Betriebs fehlt');
    if(seller==='CH')req(vatClean(s.vatId),'MWST-/UID-Nummer des schweizerischen Betriebs fehlt');
  }

  // Im Zweifel nicht stillschweigend B2C annehmen, wenn davon das Rechnungsformat abhängt.
  if(profile.type==='unknown'&&String(c.customerType||'auto')==='auto'){
    if(seller==='DE'&&buyer==='DE'&&treatment!=='small_business')errors.push('Kundentyp ist nicht eindeutig: Bitte beim Kunden einmal „Privatkunde“ oder „Unternehmen“ auswählen');
    if(seller==='AT'&&buyer==='AT'&&Math.abs(num(inv.total))>10000)errors.push('Bei Rechnungen über 10.000 € bitte den Kundentyp einmal eindeutig festlegen');
  }
  if(seller==='AT'&&buyer==='AT'&&type==='business'&&Math.abs(num(inv.total))>10000)req(vatClean(inv.recipientVatId||c.vatId),'Bei österreichischen B2B-Rechnungen über 10.000 € fehlt die UID des Kunden');

  if(r.mode==='structured'){
    const sa=parseAddress(s.address,seller),ba=parseAddress(c.address,buyer);
    req(sa.street&&sa.postalCode&&sa.city,'Firmenadresse muss für die E‑Rechnung Straße, PLZ und Ort enthalten');
    req(ba.street&&ba.postalCode&&ba.city,'Kundenadresse muss für die E‑Rechnung Straße, PLZ und Ort enthalten');
    req(emailOk(s.email),'Firmen-E-Mail fehlt oder ist ungültig');
    req(emailOk(c.email)||String(c.eInvoiceAddress||'').trim(),'Elektronische Adresse des Kunden fehlt');
    if(r.format==='xrechnung'&&type==='public')req(String(inv.buyerReference||c.buyerReference||'').trim(),'Bei Behördenrechnungen fehlt die Leitweg-/Käuferreferenz');
    if(r.format==='ubl'&&type==='public'){
      req(String(inv.buyerReference||c.buyerReference||'').trim(),'Auftragsreferenz der Behörde fehlt');
      req(String(c.supplierNumber||'').trim(),'Lieferantennummer der Behörde fehlt');
      req(String(c.eInvoiceAddress||'').trim(),'Elektronische Rechnungsadresse der Behörde fehlt');
    }
    req(String(s.iban||'').trim(),'IBAN fehlt für die strukturierte E‑Rechnung');
    try{
      const xml=generateUbl(inv,r.format),sv=validateStructuredXml(xml,inv,r);
      sv.checks.forEach(x=>internalChecks.push(x));
      sv.errors.forEach(x=>errors.push(x));
    }catch(e){errors.push('Strukturierte E‑Rechnung konnte intern nicht geprüft werden: '+String(e?.message||e));}
  }

  if(seller==='DE'&&buyer==='DE'&&type==='business'&&treatment==='small_business')warnings.push('Kleinunternehmer sind derzeit von der Pflicht zur Ausstellung einer E‑Rechnung ausgenommen; die App nutzt daher PDF, sofern der Empfänger keine E‑Rechnung verlangt.');
  if(seller==='DE'&&r.mode==='structured')warnings.push('Interne Struktur- und Rechenprüfung bestanden, sobald keine Fehler angezeigt werden. Behörden/Empfänger können zusätzlich mit ihrem eigenen EN‑16931/XRechnung-Validator prüfen.');
  if(seller==='AT'&&r.mode==='pdf')warnings.push('Bei elektronischer Übermittlung einer österreichischen PDF-Rechnung muss der Empfänger dieser Form zugestimmt haben; die Zustimmung kann auch durch gelebte Praxis stillschweigend erfolgen.');
  if(seller==='AT'&&r.mode==='structured')warnings.push('PDF und XML sind nur zwei Darstellungen derselben Rechnung; beim gemeinsamen Versand dürfen sie nicht als zwei getrennte Rechnungen behandelt werden.');
  if(r.delivery==='public_portal')warnings.push('Die Datei wird passend vorbereitet. Die tatsächliche Einreichung bei der Behörde erfolgt über deren vorgeschriebenes Portal/Peppol-Verfahren.');
  if(seller==='CH'&&type==='public')warnings.push('Schweizer Bundesstellen akzeptieren je nach Prozess PDF per E‑Mail oder strukturierte E‑Rechnung über einen Service-Provider; die Bestell-/Rechnungsreferenz muss beachtet werden.');

  const status=errors.length?'blocked':warnings.length?'warning':'ready',checkedAt=new Date().toISOString();
  inv.complianceStatus=status;
  inv.complianceReport={checkedAt,legalProfileVersion:LEGAL_PROFILE_VERSION,route:r,errors:[...new Set(errors)],warnings:[...new Set(warnings)],internalChecks,sellerCountry:seller,buyerCountry:buyer,recipientType:type,recipientTypeConfidence:profile.confidence,retentionYears:RETENTION_YEARS[seller]||10,validationLevel:r.mode==='structured'?'internal-structure-and-business-check':'mandatory-field-and-math-check'};
  inv.complianceCheckedAt=checkedAt;inv.eInvoiceFormat=r.format;
  return{ok:!errors.length,status,route:r,errors:[...new Set(errors)],warnings:[...new Set(warnings)],internalChecks};
}
function validateStructuredXml(xml,inv,r){
  const errors=[],checks=[],push=(ok,good,bad)=>{checks.push({ok:!!ok,message:ok?good:bad});if(!ok)errors.push(bad)};
  const source=String(xml||'');
  push(source.startsWith('<?xml'),'XML-Kopf vorhanden','XML-Kopf fehlt');
  push(/<(Invoice|CreditNote)\b/.test(source),'UBL-Rechnungswurzel vorhanden','UBL-Rechnungswurzel fehlt');
  push(source.includes('<cbc:ID>'+esc(inv.number)+'</cbc:ID>'),'Rechnungsnummer im XML vorhanden','Rechnungsnummer fehlt im XML');
  push(source.includes('<cbc:IssueDate>'+esc(inv.date)+'</cbc:IssueDate>'),'Rechnungsdatum im XML vorhanden','Rechnungsdatum fehlt im XML');
  push(source.includes('<cbc:DocumentCurrencyCode>'),'Währung im XML vorhanden','Währung fehlt im XML');
  push(source.includes('<cac:AccountingSupplierParty>')&&source.includes('<cac:AccountingCustomerParty>'),'Rechnungsparteien im XML vorhanden','Rechnungsparteien fehlen im XML');
  push(source.includes('<cac:LegalMonetaryTotal>'),'Summenblock im XML vorhanden','Summenblock fehlt im XML');
  if(r.format==='xrechnung')push(source.includes(XRECHNUNG),'XRechnung-CIUS-Kennung korrekt','XRechnung-CIUS-Kennung ist nicht korrekt');
  if(r.format==='ubl')push(source.includes(PEPPOL),'UBL/EN-16931-Kennung korrekt','UBL/EN-16931-Kennung ist nicht korrekt');
  if(typeof DOMParser!=='undefined'){
    const doc=new DOMParser().parseFromString(source,'application/xml');
    push(!doc.querySelector('parsererror'),'XML ist wohlgeformt','XML ist nicht wohlgeformt');
  }
  return{ok:!errors.length,errors,checks};
}
function partyXml({name,address,country,email,vatId='',taxNumber='',endpointScheme='EM',partyId='',contactName='',phone=''}){
  const a=parseAddress(address,country),endpoint=String(email||'').trim(),endpointOk=endpointScheme==='EM'?emailOk(endpoint):!!endpoint;
  return`<cac:Party>${endpointOk?`<cbc:EndpointID schemeID="${esc(endpointScheme)}">${esc(endpoint)}</cbc:EndpointID>`:''}${partyId?`<cac:PartyIdentification><cbc:ID>${esc(partyId)}</cbc:ID></cac:PartyIdentification>`:''}<cac:PartyName><cbc:Name>${esc(name)}</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>${esc(a.street)}</cbc:StreetName><cbc:CityName>${esc(a.city)}</cbc:CityName><cbc:PostalZone>${esc(a.postalCode)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>${esc(country)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${vatClean(vatId)?`<cac:PartyTaxScheme><cbc:CompanyID>${esc(vatClean(vatId))}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`:''}${taxNumber?`<cac:PartyTaxScheme><cbc:CompanyID>${esc(taxNumber)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`:''}<cac:PartyLegalEntity><cbc:RegistrationName>${esc(name)}</cbc:RegistrationName></cac:PartyLegalEntity>${emailOk(endpointScheme==='EM'?endpoint:'')?`<cac:Contact>${contactName?`<cbc:Name>${esc(contactName)}</cbc:Name>`:''}${phone?`<cbc:Telephone>${esc(phone)}</cbc:Telephone>`:''}<cbc:ElectronicMail>${esc(endpoint)}</cbc:ElectronicMail></cac:Contact>`:''}</cac:Party>`;
}
function generateUbl(inv,format='xrechnung'){
  prepareInvoice(inv);const d=getData(),s=settings(),c=customerFor(inv),seller=normalizeCountry(inv.countryCode||s.countryCode||'DE'),buyer=normalizeCountry(inv.recipientCountryCode||c.countryCode||seller,seller),tax=taxCategory(inv),currency=String(inv.currencyCode||s.currency||'EUR').toUpperCase();
  const isCredit=inv.documentType==='cancellation',isCorrection=inv.documentType==='correction'||!!inv.correctionOf,sign=isCredit?-1:1;
  const rawBase=num(inv.baseSubtotal||(inv.lines||[]).reduce((a,l)=>a+num(l.qty)*num(l.price),0)),base=Math.abs(rawBase),discRaw=inv.discount!==undefined?num(inv.discount):(String(inv.discountType||'euro')==='percent'?rawBase*(num(inv.discountValue)/100):num(inv.discountValue)),discount=Math.abs(discRaw),net=Math.abs(num(inv.subtotal||rawBase-discRaw)),taxAmount=Math.abs(num(inv.total)-num(inv.subtotal||rawBase-discRaw)),payable=Math.abs(num(inv.total));
  const buyerRef=String(inv.buyerReference||c.buyerReference||'').trim()||(format==='xrechnung'?'-':''),custom=format==='xrechnung'?XRECHNUNG:PEPPOL;
  const isPublic=(inv.recipientType&&inv.recipientType!=='auto'?inv.recipientType:inferCustomerProfile(c).type)==='public',orderReferenceId=seller==='AT'&&isPublic?buyerRef:String(inv.offerNumber||''),deLeitweg=/^\d{2,12}-(?:[A-Za-z0-9]{1,30}-)?\d{2}$/i.test(String(c.eInvoiceAddress||inv.buyerReference||c.buyerReference||'').trim()),supplierScheme=seller==='AT'&&vatClean(s.vatId)?'9914':'EM',customerScheme=buyer==='AT'&&c.eInvoiceAddress?'9915':(seller==='DE'&&isPublic&&deLeitweg?'0204':'EM'),supplierEndpoint=supplierScheme==='EM'?s.email:vatClean(s.vatId),buyerEndpoint=customerScheme==='EM'?c.email:(customerScheme==='0204'?String(c.eInvoiceAddress||inv.buyerReference||c.buyerReference||'').trim():c.eInvoiceAddress);
  const sellerParty=partyXml({name:s.companyName,address:s.address,country:seller,email:supplierEndpoint,vatId:s.vatId,taxNumber:s.taxNumber,endpointScheme:supplierScheme,partyId:format==='ubl'?c.supplierNumber||'':'',contactName:s.ownerName,phone:s.phone});
  const buyerParty=partyXml({name:c.name,address:c.address,country:buyer,email:buyerEndpoint,vatId:inv.recipientVatId||c.vatId,endpointScheme:customerScheme,contactName:c.contact,phone:c.phone});
  const lineTag=isCredit?'CreditNoteLine':'InvoiceLine',qtyTag=isCredit?'CreditedQuantity':'InvoicedQuantity';
  const lines=(inv.lines||[]).filter(l=>String(l.name||'').trim()).map((l,i)=>{const qty=Math.abs(num(l.qty)),price=Math.abs(num(l.price)),line=qty*price;return`<cac:${lineTag}><cbc:ID>${i+1}</cbc:ID><cbc:${qtyTag} unitCode="${unitCode(l.unit)}">${qty}</cbc:${qtyTag}><cbc:LineExtensionAmount currencyID="${esc(currency)}">${money(line)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${esc(l.name)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${tax.code}</cbc:ID><cbc:Percent>${money(tax.rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${esc(currency)}">${money(price)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="${unitCode(l.unit)}">1</cbc:BaseQuantity></cac:Price></cac:${lineTag}>`}).join('');
  const payment=!isCredit&&s.iban?`<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentID>${esc(inv.number)}</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>${esc(String(s.iban).replace(/\s+/g,''))}</cbc:ID><cbc:Name>${esc(s.companyName)}</cbc:Name></cac:PayeeFinancialAccount></cac:PaymentMeans>`:'';
  const allowance=discount>0?`<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:Amount currencyID="${esc(currency)}">${money(discount)}</cbc:Amount><cbc:BaseAmount currencyID="${esc(currency)}">${money(base)}</cbc:BaseAmount></cac:AllowanceCharge>`:'';
  const taxReason=tax.reason?`<cbc:TaxExemptionReason>${esc(tax.reason)}</cbc:TaxExemptionReason>`:'';
  let originalNumber='';if(inv.originalInvoiceId||inv.correctionOf){const original=(d.invoices||[]).find(x=>x.id===(inv.originalInvoiceId||inv.correctionOf));originalNumber=original?.number||''}
  const billingRef=originalNumber?`<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${esc(originalNumber)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>`:'';
  const root=isCredit?'CreditNote':'Invoice',rootNs=isCredit?'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2':XMLNS.invoice,typeTag=isCredit?'CreditNoteTypeCode':'InvoiceTypeCode',typeCode=isCredit?'381':(isCorrection?'384':'380'),multiFormatNote=seller==='AT'?'XML-Datei und PDF-Ansicht sind inhaltsgleiche Darstellungen derselben Rechnung und keine getrennten Rechnungen.':'',invoiceNote=[inv.notes,multiFormatNote].filter(Boolean).join(' · ');
  return`<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="${rootNs}" xmlns:cac="${XMLNS.cac}" xmlns:cbc="${XMLNS.cbc}"><cbc:CustomizationID>${esc(custom)}</cbc:CustomizationID><cbc:ProfileID>${esc(PROFILE)}</cbc:ProfileID><cbc:ID>${esc(inv.number)}</cbc:ID><cbc:IssueDate>${esc(inv.date)}</cbc:IssueDate>${!isCredit?`<cbc:DueDate>${esc(inv.dueDate)}</cbc:DueDate>`:''}<cbc:${typeTag}>${typeCode}</cbc:${typeTag}>${invoiceNote?`<cbc:Note>${esc(invoiceNote)}</cbc:Note>`:''}<cbc:DocumentCurrencyCode>${esc(currency)}</cbc:DocumentCurrencyCode>${buyerRef?`<cbc:BuyerReference>${esc(buyerRef)}</cbc:BuyerReference>`:''}${billingRef}${orderReferenceId?`<cac:OrderReference><cbc:ID>${esc(orderReferenceId)}</cbc:ID></cac:OrderReference>`:''}<cac:AccountingSupplierParty>${sellerParty}</cac:AccountingSupplierParty><cac:AccountingCustomerParty>${buyerParty}</cac:AccountingCustomerParty><cac:Delivery><cbc:ActualDeliveryDate>${esc(inv.serviceDate)}</cbc:ActualDeliveryDate></cac:Delivery>${payment}${allowance}<cac:TaxTotal><cbc:TaxAmount currencyID="${esc(currency)}">${money(taxAmount)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${esc(currency)}">${money(net)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${esc(currency)}">${money(taxAmount)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${tax.code}</cbc:ID><cbc:Percent>${money(tax.rate)}</cbc:Percent>${taxReason}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${esc(currency)}">${money(base)}</cbc:LineExtensionAmount><cbc:AllowanceTotalAmount currencyID="${esc(currency)}">${money(discount)}</cbc:AllowanceTotalAmount><cbc:TaxExclusiveAmount currencyID="${esc(currency)}">${money(net)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${esc(currency)}">${money(payable)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${esc(currency)}">${money(payable)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</${root}>`;
}
function structuredBlob(inv){const r=route(inv);if(!['xrechnung','ubl'].includes(r.format))return null;const xml=generateUbl(inv,r.format);return new Blob([xml],{type:'application/xml;charset=utf-8'});}
function structuredFilename(inv){const safe=String(inv.number||'rechnung').replace(/[^a-z0-9._-]+/gi,'_');return`${safe}-${route(inv).format==='xrechnung'?'XRechnung':'UBL'}.xml`;}
async function sha256(blob){const bytes=await blob.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function archiveStructured(inv){const blob=structuredBlob(inv);if(!blob)return null;if(!globalThis.CloudFiles?.uploadStructuredInvoice)throw new Error('Cloud-Archiv für E‑Rechnungen ist noch nicht bereit.');const filename=structuredFilename(inv),hash=await sha256(blob);if(inv.structuredStoragePath&&inv.structuredSha256===hash)return{blob,filename,path:inv.structuredStoragePath,sha256:hash};const saved=await globalThis.CloudFiles.uploadStructuredInvoice(blob,filename,inv.id);inv.structuredStoragePath=saved.path;inv.structuredSha256=hash;return{blob,filename,path:saved.path,sha256:hash};}
async function prepareForFinalization(inv){
  prepareInvoice(inv);
  const result=check(inv);
  if(!result.ok)return {...result,archived:null};
  let archived=null;
  if(result.route.mode==='structured'){
    try{
      archived=await archiveStructured(inv);
    }catch(e){
      result.ok=false;
      result.status='blocked';
      result.errors.push('E‑Rechnungs-Original konnte nicht sicher archiviert werden: '+String(e?.message||e));
      inv.complianceStatus='blocked';
      inv.complianceReport={...inv.complianceReport,errors:[...result.errors]};
      return {...result,archived:null};
    }
  }
  return {...result,archived};
}
function labelFor(inv){const r=route(inv),tag=` · Regelprofil ${LEGAL_PROFILE_VERSION}`;if(r.format==='pdf')return`PDF · Pflichtfelder & Rechenwerte geprüft${tag}`;if(r.format==='xrechnung')return`XRechnung 3.0 XML + PDF-Ansicht${tag}`;if(r.format==='ubl')return`UBL 2.1 XML + PDF-Ansicht${tag}`;return`Elektronische PDF-Rechnung · Empfängerweg beachten${tag}`;}
function customerFields(c={}){return{customerType:c.customerType||'auto',countryCode:normalizeCountry(c.countryCode||settings().countryCode||'DE'),vatId:c.vatId||'',buyerReference:c.buyerReference||'',supplierNumber:c.supplierNumber||'',eInvoiceAddress:c.eInvoiceAddress||'',eInvoiceRequired:!!c.eInvoiceRequired,electronicInvoiceConsentAt:c.electronicInvoiceConsentAt||''};}
function invoiceFields(inv={}){prepareInvoice(inv);return{serviceDate:inv.serviceDate||'',recipientType:inv.recipientType||'auto',recipientCountryCode:inv.recipientCountryCode||settings().countryCode||'DE',recipientVatId:inv.recipientVatId||'',buyerReference:inv.buyerReference||'',eInvoiceFormat:inv.eInvoiceFormat||'auto',structuredStoragePath:inv.structuredStoragePath||'',structuredSha256:inv.structuredSha256||'',complianceStatus:inv.complianceStatus||'unchecked',complianceReport:inv.complianceReport||{},complianceCheckedAt:inv.complianceCheckedAt||''};}
globalThis.APCompliance={LEGAL_PROFILE_VERSION,RETENTION_YEARS,inferCustomerProfile,inferCustomerType,parseAddress,route,prepareInvoice,check,prepareForFinalization,generateUbl,validateStructuredXml,structuredBlob,structuredFilename,archiveStructured,labelFor,customerFields,invoiceFields};
})();
